// Copyright 2018 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Simple SSH daemon with inline shell for quick testing.

#include <cctype>
#include <codecvt>
#include <locale>
#include <map>
#include <string>
#include <vector>

#include <err.h>
#include <signal.h>
#include <stdarg.h>
#include <stdio.h>
#include <unistd.h>

#include <sys/wait.h>

#include <libssh/callbacks.h>
#include <libssh/libssh.h>
#include <libssh/server.h>

namespace {

// Command line settings.
class Options {
 public:
  Options();

  std::string user;
  std::string host;
  std::string port;
  int verbosity;
};

Options::Options()
  : user("anon"),
    host("localhost"),
    port("22222"),
    verbosity(0) {}

// Data passed to various SSH callbacks.
class Userdata {
 public:
  const Options* options;
  struct ssh_channel_callbacks_struct* channel_cb;
  bool authenticated;
  bool tty_allocated;
  ssh_channel channel;
};

// Left in for easy access for debugging.
#if 0
// A sprintf for C++.
std::string sprintf(const std::string fmt, ...) {  // NOLINT(runtime/printf)
  // Overestimate the size of the initial buffer.
  int size = (int)fmt.size() * 2;
  std::string ret;
  va_list ap;

  while (1) {
    // Allocate the buffer we're going to write to.
    ret.resize(size);

    // Attempt the format to the buffer.
    va_start(ap, fmt);
    int len = vsnprintf(const_cast<char*>(ret.data()), size, fmt.c_str(), ap);
    va_end(ap);

    // If we had enough space, then shrink the buffer back and return.
    if (len >= 0 && len < size) {
      ret.resize(len);
      break;
    }

    // If we need more space, increase it!
    if (len < 0)
      size *= 2;
    else
      size = len + 1;
  }

  return ret;
}
#endif

// Helper to write a constant string.
int ssh_channel_write_str(ssh_channel channel, const std::string& str) {
  return ssh_channel_write(channel, str.c_str(), str.length());
}

// Convert a Unicode codepoint to a string.
const std::string codepointToUtf8(unsigned long codepoint) {
  std::wstring_convert<std::codecvt_utf8<char32_t>, char32_t> converter;
  return converter.to_bytes(codepoint);
}

// Callback when processing a NONE authorization request.
int auth_none(ssh_session session, const char* user, void* userdata) {
  Userdata* data = (Userdata*)(userdata);

  printf("Authenticating user '%s' via NONE ... ", user);

  if (data->options->user == user) {
    data->authenticated = true;
    printf("OK!\n");
    return SSH_AUTH_SUCCESS;
  } else {
    printf("FAIL: wanted '%s'\n", data->options->user.c_str());
    ssh_disconnect(session);
    return SSH_AUTH_DENIED;
  }
}

// Callback when a tty is requested.
int pty_request(ssh_session session,
                ssh_channel channel,
                const char* term,
                int x,
                int y,
                int px,
                int py,
                void* userdata) {
  Userdata* data = (Userdata*)(userdata);
  data->tty_allocated = true;

  const std::string str = "Allocated terminal [" + std::to_string(x) +
                          " cols x " + std::to_string(y) + " rows] [" +
                          std::to_string(px) + "px x " + std::to_string(py) +
                          "px] TERM=" + std::string(term) + "\n\r";
  fputs(str.c_str(), stdout);
  ssh_channel_write_str(channel, str);

  return 0;
}

// Callback when a shell is requested.
int shell_request(ssh_session session, ssh_channel channel, void* userdata) {
  printf("Allocated shell\n");
  return 0;
}

// Callback when an env var is sent.
int env_request(ssh_session session,
                ssh_channel channel,
                const char* env_name,
                const char* env_value,
                void* userdata) {
  printf("Received env %s=\"%s\"\n", env_name, env_value);
  return 0;
}

// Callback when a new channel is requested.
ssh_channel new_session_channel(ssh_session session, void* userdata) {
  Userdata* data = (Userdata*)(userdata);

  if (data->channel)
    return nullptr;
  printf("Allocated session channel\n");
  data->channel = ssh_channel_new(session);
  ssh_callbacks_init(data->channel_cb);
  ssh_set_channel_callbacks(data->channel, data->channel_cb);
  return data->channel;
}

// Extract a hex value from the string starting as pos.  By default we
// consume exactly count bytes, but if the hex value is enclosed by braces
// (e.g. {FF} rather than FF), we allow an arbitrary number of digits.
bool parse_hex(const std::string& str,
               size_t pos,
               size_t count,
               unsigned long* hex,
               size_t* read) {
  *read = 0;

  if (str[pos] == '{') {
    size_t end = str.find('}', pos + 1);
    if (pos + 1 == end || end == std::string::npos)
      return false;
    *read = 2;
    ++pos;
    count = end - pos;
  }

  std::string dbuf = str.substr(pos, count);
  if (dbuf.length() != count)
    return false;
  for (auto ch : dbuf)
    if (!isxdigit(ch))
      return false;

  *hex = std::stoul(dbuf, 0, 16);
  *read += count;

  return true;
}

enum {
  CMD_CONTINUE = 0,
  CMD_EXIT_CLIENT,
  CMD_EXIT_SERVER,
};

// Handle the "osc" command.
int cmd_osc(ssh_channel chan, const std::vector<std::string>& argv) {
  if (argv.size() == 1) {
    ssh_channel_write_str(chan, "error: osc needs at least one argument\n\r");
    return CMD_CONTINUE;
  }

  ssh_channel_write_str(chan, "\e]");
  for (size_t i = 1; i < argv.size(); ++i) {
    if (i > 1)
      ssh_channel_write_str(chan, ";");

    ssh_channel_write_str(chan, argv[i]);
  }
  ssh_channel_write_str(chan, "\a");

  return CMD_CONTINUE;
}

// Handle the "print" command.
int cmd_print(ssh_channel chan, const std::vector<std::string>& argv) {
  // Skip the "print" command itself in argv[0].
  for (size_t argi = 1; argi < argv.size(); ++argi) {
    const std::string arg = argv[argi];

    if (argi > 1)
      ssh_channel_write_str(chan, " ");

    // Walk the arg one char at a time.  Could be made faster with a search,
    // but meh -- it's fast enough already for our needs.
    for (size_t i = 0; i < arg.length(); ++i) {
      char ch = arg[i];

      if (ch == '\\') {
        // Process an escape sequence.
        ch = arg[++i];
        switch (ch) {
          case '\\':  // Escape the escape!
            ssh_channel_write_str(chan, "\\");
            break;
          case '0' ... '7': {  // 1 to 3 digit octal.
            std::string dbuf = {ch};
            if (arg[i + 1] >= '0' && arg[i + 1] <= '7') {
              dbuf.push_back(arg[++i]);
              if (arg[i + 1] >= '0' && arg[i + 1] <= '7')
                dbuf.push_back(arg[++i]);
            }
            int digit = std::stoi(dbuf, 0, 8);
            if (digit > 0xff) {
              ssh_channel_write_str(chan,
                                    "\n\rprint: octal number too big\n\r");
            } else {
              ch = digit;
              ssh_channel_write(chan, &ch, 1);
            }
            break;
          }
          case 'a':  // Bell.
            ssh_channel_write_str(chan, "\a");
            break;
          case 'b':  // Backspace.
            ssh_channel_write_str(chan, "\b");
            break;
          case 'c':  // Control char.  Ctrl+a == 0x01 ... Ctrl+z == 0x1a.
            ch = tolower(arg[i + 1]);
            if (!isalpha(ch)) {
              ssh_channel_write_str(
                  chan, "\n\rprint: invalid control escape sequence\n\r");
            } else {
              ++i;
              ch = ch - 'a' + 1;
              ssh_channel_write(chan, &ch, 1);
            }
            break;
          case 'E':
          case 'e':  // Escape.
            ssh_channel_write_str(chan, "\e");
            break;
          case 'f':  // Form feed.
            ssh_channel_write_str(chan, "\f");
            break;
          case 'n':  // New line.
            ssh_channel_write_str(chan, "\n");
            break;
          case 'r':  // Carriage return.
            ssh_channel_write_str(chan, "\r");
            break;
          case 't':  // Tab.
            ssh_channel_write_str(chan, "\t");
            break;
          case 'v':  // Vertical tab.
            ssh_channel_write_str(chan, "\v");
            break;
          case 'x': {  // 2 digit hexcode.
            unsigned long hex;
            size_t consumed;
            if (!parse_hex(arg, i + 1, 2, &hex, &consumed)) {
              ssh_channel_write_str(
                  chan, "\n\rprint: invalid \\xHH escape sequence\n\r");
            } else if (hex > 0xff) {
              ssh_channel_write_str(chan, "\n\rprint: hex number too big\n\r");
            } else {
              ch = hex;
              ssh_channel_write(chan, &ch, 1);
            }
            i += consumed;
            break;
          }
          case 'u':    // 4 digit unicode codepoint.
          case 'U': {  // 8 digit unicode codepoint.
            unsigned long hex;
            size_t consumed;
            if (!parse_hex(arg, i + 1, ch == 'u' ? 4 : 8, &hex, &consumed)) {
              ssh_channel_write_str(
                  chan, "\n\rprint: invalid Unicode escape sequence\n\r");
            } else if (hex > 0x10FFFF) {
              ssh_channel_write_str(chan,
                                    "\n\rprint: Unicode codepoint too big\n\r");
            } else {
              ssh_channel_write_str(chan, codepointToUtf8(hex));
            }
            i += consumed;
            break;
          }
          default:
            ssh_channel_write_str(chan,
                                  "\n\rprint: unknown escape sequence\n\r");
            break;
        }
      } else {
        ssh_channel_write(chan, &ch, 1);
      }
    }
  }

  ssh_channel_write_str(chan, "\n\r");

  return CMD_CONTINUE;
}

// Handle the "quit" command.
int cmd_quit(ssh_channel chan, const std::vector<std::string>& argv) {
  int status;
  switch (argv.size()) {
    case 1:
      status = 0;
      break;
    case 2:
      status = std::stoi(argv[1]);
      break;
    default:
      ssh_channel_write_str(chan, "error: quit takes only one argument\n\r");
      status = 255;
      break;
  }
  ssh_channel_write_str(chan, "BYE\n\r");
  ssh_channel_request_send_exit_status(chan, status);  // TODO: Doesn't work.

  return CMD_EXIT_CLIENT;
}

// Handle the "shutdown" command.
int cmd_shutdown(ssh_channel chan, const std::vector<std::string>& argv) {
  if (argv.size() > 1)
    ssh_channel_write_str(chan, "error: shutdown takes no arguments\n\r");

  ssh_channel_write_str(chan, "shutting down\n\r");
  ssh_channel_request_send_exit_status(chan, 0);  // TODO: Doesn't work.

  return CMD_EXIT_SERVER;
}

// Handle the "image" command.
// We support a few stock images of common sizes.
int cmd_image(ssh_channel chan, const std::vector<std::string>& argv) {
  int img = 16;

  if (argv.size() > 1)
    img = std::stoi(argv[1]);

  switch (img) {
    case 16:
    case 32:
    case 64:
    case 128:
    case 256:
    case 512:
      break;
    default:
      ssh_channel_write_str(chan, "error: unknown image: " + argv[1] + "\n\r");
      return CMD_CONTINUE;
  }

  ssh_channel_write_str(
      chan, "\e]1337;File=name=dGVzdC5naWY=;width=8px;inline=1;height=" +
                std::to_string(img) + "px");
  for (size_t i = 2; i < argv.size(); ++i)
    ssh_channel_write_str(chan, ";" + argv[i]);

  ssh_channel_write_str(chan, ":");
  switch (img) {
    case 16:
      ssh_channel_write_str(
          chan,
          "R0lGODdhCAAQAIAAAP///wAAACwAAAAACAAQAAACFkSAhpfMC1uMT1mabHWZy6t1U/"
          "htQAEAOw==");
      break;
    case 32:
      ssh_channel_write_str(
          chan,
          "R0lGODdhCAAgAIAAAP///wAAACwAAAAACAAgAAACI0SAhpfMC1uMT1mabHWZy6t1U/"
          "hto4eVIoiS6evG7XzWLFAAADs=");
      break;
    case 64:
      ssh_channel_write_str(
          chan,
          "R0lGODdhCABAAIAAAP///wAAACwAAAAACABAAAACOUSAhpfMC1uMT1mabHWZy6t1U/"
          "hto4eVIoiS6evG7XzWrG3ees6vvQqE0Xa+YlCGMwqTx+FvSZQUAAA7");
      break;
    case 128:
      ssh_channel_write_str(
          chan,
          "R0lGODdhCACAAIAAAP///wAAACwAAAAACACAAAACWESAhpfMC1uMT1mabHWZy6t1U/"
          "hto4eVIoiS6evG7XzWrG3ees6vvQqE0Xa+YlCGMwqTx+"
          "FvSWwyoU9klKq0Vp1ZrvSq7U7D3+3Yiy2LwWhy+u2Ot+fnegEAOw==");
      break;
    case 256:
      ssh_channel_write_str(
          chan,
          "R0lGODdhCAAAAYAAAP///wAAACwAAAAACAAAAQACjESAhpfMC1uMT1mabHWZy6t1U/"
          "hto4eVIoiS6evG7XzWrG3ees6vvQqE0Xa+YlCGMwqTx+"
          "FvSWwyoU9klKq0Vp1ZrvSq7U7D3+3Yiy2LwWhy+u2Ot+fnOttuvuvz/"
          "HVfDQhHt+dXGCiHZyiYeDj4t0jYyAj5iBhJqWhZ6ZjJKXmp2TkZ+"
          "rk56olZKloAADs=");
      break;
    case 512:
      ssh_channel_write_str(
          chan,
          "R0lGODdhCAAAAoAAAP///wAAACwAAAAACAAAAgAC10SAhpfMC1uMT1mabHWZy6t1U/"
          "hto4eVIoiS6evG7XzWrG3ees6vvQqE0Xa+YlCGMwqTx+"
          "FvSWwyoU9klKq0Vp1ZrvSq7U7D3+3Yiy2LwWhy+u2Ot+fnOttuvuvz/"
          "HVfDQhHt+dXGCiHZyiYeDj4t0jYyAj5iBhJqWhZ6ZjJKXmp2TkZ+"
          "rk56olZKgqKSpr66hrbOntay2prequby7vaqwoMS7vrWxwsi2ssnHw8/LtM3MwM/"
          "YwcTa1sXe2czS19rd09Hf69Pe6NXS4Ojk6e/u4e3z5/XlcAADs=");
      break;
  }
  ssh_channel_write_str(chan, "\a");

  return CMD_CONTINUE;
}

// Forward decl.
int cmd_help(ssh_channel chan, const std::vector<std::string>& argv);

// Register all the commands available to the client.
using cmd_t = int (*)(ssh_channel chan, const std::vector<std::string>&);
struct cmd {
  cmd_t func;
  const std::string args;
  const std::string usage;
};
std::map<const std::string, cmd> CommandMap = {
    {"help", {cmd_help, "", "This help screen!"}},
    {"h", {cmd_help}},
    {"?", {cmd_help}},
    {"print", {cmd_print, "<str>", "Print a string (w/escape sequences)"}},
    {"p", {cmd_print}},
    {"quit", {cmd_quit, "[code]", "Exit this loop"}},
    {"q", {cmd_quit}},
    {"exit", {cmd_quit}},
    {"shutdown", {cmd_shutdown, "", "Shutdown the server"}},
    {"stop", {cmd_shutdown}},
    {"s", {cmd_shutdown}},
    {"image", {cmd_image, "[name]", "Display an image"}},
    {"i", {cmd_image}},
    {"osc", {cmd_osc, "[args]", "Run an Operating System Command (OSC)"}},
    {"o", {cmd_osc}},
};

// Handle the "help" command.
int cmd_help(ssh_channel chan, const std::vector<std::string>& argv) {
  if (argv.size() > 1)
    ssh_channel_write_str(chan, "error: help takes no arguments\n\r");

  ssh_channel_write_str(chan, "Available commands:\n\r");

  // Calculate the max LHS width.
  size_t width = 0;
  for (auto it : CommandMap) {
    const cmd* cmd = &it.second;
    if (cmd->usage.empty())
      continue;
    std::string lhs = it.first + " " + cmd->args;
    width = std::max(width, lhs.size());
  }
  // Pad the right side by 3.
  width += 3;

  // Display all the lines now.
  for (auto it : CommandMap) {
    const cmd* cmd = &it.second;
    if (cmd->usage.empty())
      continue;
    std::string lhs = it.first + " " + cmd->args;
    lhs += std::string(width - lhs.size(), ' ');
    ssh_channel_write_str(chan, "  " + lhs + cmd->usage + "\n\r");
  }

  return CMD_CONTINUE;
}

// Split a string up into a command vector.
std::vector<std::string> ParseCommand(const std::string& str) {
  std::vector<std::string> ret;

  size_t startpos = str.find_first_not_of(' ');
  if (startpos == std::string::npos)
    return ret;

  while (1) {
    size_t pos = str.find(' ', startpos + 1);
    if (pos == std::string::npos)
      break;
    ret.push_back(str.substr(startpos, pos - startpos));
    startpos = str.find_first_not_of(' ', pos + 1);
    if (startpos == std::string::npos)
      return ret;
  }
  ret.push_back(str.substr(startpos));

  return ret;
}

// The main interactive loop for the client.
int client_loop(Userdata* data) {
  ssh_channel chan = data->channel;
  std::string buf;
  char readbuf[4096];
  int readlen;
  size_t pos;

  ssh_channel_write_str(chan, "echosshd shell started\n\r");
  ssh_channel_write_str(chan, ">>> ");
  while (1) {
    readlen = ssh_channel_read(chan, readbuf, sizeof(readbuf), 0);
    if (readlen <= 0)
      return CMD_EXIT_CLIENT;
    size_t oldlen = buf.length();
    buf.append(readbuf, readlen);

    // Deal with non-printable sequences.
    pos = oldlen;
    while (pos < buf.length()) {
      switch (buf[pos]) {
        // List characters we accept.
        case 0x04:  // EOT CTRL+D
        case 0x0a:  // \n newline
        case 0x0d:  // \r return
        case 0x20 ... 0x7e:
          ++pos;
          break;

        // Special case a few controls.
        case 0x03:  // CTRL+C
          // Abort everything.
          ssh_channel_write_str(chan, "^C\n\r>>> ");
          buf.clear();
          continue;
        case 0x08:  // \b backspace
        case 0x7f:  // DEL
          if (pos == 0) {
            // Start of the buffer so just eat it.
            buf.erase(pos, 1);
          } else {
            // Start of the new part of the buffer, so back up.
            if (pos == oldlen)
              --oldlen;
            ssh_channel_write_str(chan, "\b \b");
            buf.erase(pos - 1, 2);
          }
          break;
        case 0x0c:  // CTRL+L
          buf.erase(pos, 1);
          // Move cursor home & clear screen.
          ssh_channel_write_str(chan, "\e[H\e[2J");
          // Redisplay prompt & pending buffer.
          ssh_channel_write_str(chan, ">>> ");
          ssh_channel_write_str(chan, buf);
          break;
        case 0x15:  // CTRL+U
          // Clear to start of line & move cursor to start of line.
          ssh_channel_write_str(chan, "\e[1K\e[G");
          ssh_channel_write_str(chan, ">>> ");
          buf.clear();
          continue;

        // Throw away everything else.
        default:
          buf.erase(pos, 1);
          break;
      }
    }

    // Wait for the buffer to get a newline.
  reparse:
    pos = buf.find('\n', oldlen);
    if (pos == std::string::npos) {
      pos = buf.find('\r', oldlen);
      if (pos == std::string::npos) {
        if (buf[0] == 0x04) {
          // CTRL+D for EOT.
          buf = "q";
        } else {
          // Keep waiting for more data.
          ssh_channel_write(chan, buf.c_str() + oldlen, buf.length() - oldlen);
          continue;
        }
      }
    }

    // We've got a newline, so extract the command.
    ssh_channel_write_str(chan, "\n\r");
    std::vector<std::string> argv = ParseCommand(buf.substr(0, pos));
    buf.erase(0, pos + 1);

    // Dispatch the command.
    if (argv.empty()) {
      // Nothing to do.  User hit enter.
    } else {
      const std::string cmd = argv[0];
      auto it = CommandMap.find(cmd);
      if (it != CommandMap.end()) {
        int ret = it->second.func(chan, argv);
        if (ret != CMD_CONTINUE)
          return ret;
      } else {
        ssh_channel_write_str(chan, "uknown command: " + cmd + "\n\r");
      }
    }

    // If there's more data pending, see if there are commands.
    if (!buf.empty()) {
      oldlen = buf.length();
      goto reparse;
    }
    ssh_channel_write_str(chan, ">>> ");
  }
}

// The main loop for the sshd to wait for a connection and start a client.
int sshd_main(ssh_bind sshbind, const Options& options) {
  struct ssh_channel_callbacks_struct channel_cb;
  struct ssh_server_callbacks_struct cb;
  Userdata data = {
      .options = &options,
      .channel_cb = &channel_cb,
      .authenticated = false,
      .tty_allocated = false,
      .channel = nullptr,
  };

  memset(&channel_cb, 0, sizeof(channel_cb));
  channel_cb.userdata = (void*)&data;
  channel_cb.channel_pty_request_function = pty_request;
  channel_cb.channel_shell_request_function = shell_request;
  channel_cb.channel_env_request_function = env_request;

  memset(&cb, 0, sizeof(cb));
  cb.userdata = (void*)&data;
  cb.auth_none_function = auth_none;
  cb.channel_open_request_session_function = new_session_channel;

  ssh_event event;
  int ret;
  ssh_session session = ssh_new();

  ssh_callbacks_init(&cb);

  ret = ssh_bind_accept(sshbind, session);
  if (ret == SSH_ERROR)
    errx(1, "ssh_bind_accept: %s\n", ssh_get_error(sshbind));

  switch (fork()) {
    default:
      // Clean up in the parent and return.
      ssh_disconnect(session);
      ssh_free(session);
      return CMD_CONTINUE;
    case 0:
      // Clean up resrouces in the child to unblock the parent.
      ssh_bind_free(sshbind);
      signal(SIGCHLD, SIG_IGN);
      break;
    case -1:
      err(1, "fork");
  }

  ssh_set_server_callbacks(session, &cb);

  if (ssh_handle_key_exchange(session)) {
    warn("ssh_handle_key_exchange: %s", ssh_get_error(session));
    ret = CMD_CONTINUE;
    goto done;
  }
  ssh_set_auth_methods(session, SSH_AUTH_METHOD_NONE);
  event = ssh_event_new();
  ssh_event_add_session(event, session);

  while (!data.authenticated || !data.tty_allocated ||
         data.channel == nullptr) {
    ret = ssh_event_dopoll(event, -1);
    if (ret == SSH_ERROR) {
      ssh_disconnect(session);
      errx(1, "ssh_event_dopoll: %s", ssh_get_error(session));
    }
  }
  printf("Starting client loop\n");
  ret = client_loop(&data);

done:
  printf("Finishing session\n");
  ssh_disconnect(session);
  ssh_free(session);
  exit(ret);
}

// Watch the exit status of children.
void sigchild(int signum, siginfo_t* info, void* data) {
  if (info->si_status == CMD_EXIT_SERVER)
    exit(0);
  waitpid(info->si_pid, nullptr, WNOHANG);
}

// Show the CLI usage and exit.
void usage(const Options* options, int status) {
  fprintf(status ? stderr : stdout,
          "Usage: echosshd [options]\n"
          "Options:\n"
          "  -l<host>  The host to listen on (default %s)\n"
          "  -p<port>  The port to listen on (default %s)\n"
          "  -u<user>  The user to allow (default %s)\n"
          "  -h        This help screen\n",
          options->host.c_str(), options->port.c_str(), options->user.c_str());
  exit(status);
}

// Parse the command line arguments and set up the server options.
void parse_args(int argc, char* argv[], Options* options) {
  int c;
  int verbosity = 0;
  std::string user = options->user;
  std::string host = options->host;
  std::string port = options->port;

  while ((c = getopt(argc, argv, "l:p:u:vh")) != -1) {
    switch (c) {
      case 'l':
        host = optarg;
        break;
      case 'p':
        port = optarg;
        break;
      case 'u':
        user = optarg;
        break;
      case 'v':
        ++verbosity;
        break;
      case 'h':
        usage(options, 0);
        break;
      default:
        usage(options, 1);
        break;
    }
  }
  if (argc != optind)
    errx(1, "no arguments accepted");

  options->user = std::move(user);
  options->host = std::move(host);
  options->port = std::move(port);
  options->verbosity = verbosity;
}

}  // namespace

int main(int argc, char* argv[]) {
  Options options;
  ssh_bind sshbind = ssh_bind_new();

  parse_args(argc, argv, &options);

  ssh_bind_options_set(sshbind, SSH_BIND_OPTIONS_BINDADDR,
                       options.host.c_str());
  ssh_bind_options_set(sshbind, SSH_BIND_OPTIONS_BINDPORT_STR,
                       options.port.c_str());
#if LIBSSH_VERSION_INT < SSH_VERSION_INT(0, 6, 4)
  ssh_bind_options_set(sshbind, SSH_BIND_OPTIONS_RSAKEY, "host_key.rsa");
#else
  ssh_bind_options_set(sshbind, SSH_BIND_OPTIONS_ECDSAKEY, "host_key.ecdsa");
#endif
  ssh_bind_options_set(sshbind, SSH_BIND_OPTIONS_LOG_VERBOSITY,
                       &options.verbosity);

  struct sigaction sa;
  sa.sa_sigaction = sigchild;
  sa.sa_flags = SA_NOCLDSTOP | SA_RESTART | SA_SIGINFO;
  sigemptyset(&sa.sa_mask);
  sigaction(SIGCHLD, &sa, nullptr);

  if (ssh_bind_listen(sshbind) < 0)
    errx(1, "ssh_bind_listen: %s", ssh_get_error(sshbind));

  while (1) {
    printf("waiting for connection on %s:%s for user %s\n",
           options.host.c_str(), options.port.c_str(), options.user.c_str());
    if (sshd_main(sshbind, options) == CMD_EXIT_SERVER)
      break;
  }

  ssh_bind_free(sshbind);
  ssh_finalize();
  return 0;
}
