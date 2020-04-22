// Rough polyfill for Intl.Segmenter proposal
//
// https://github.com/tc39/proposal-intl-segmenter/blob/master/README.md
//
// Caveats and Limitations
//  * granularity: 'line': 'strictness' option is not supported (ignored)
//  * In Chrome, uses v8BreakIterator
//  * Otherwise, uses very simplistic rules
//    * Ignores locale; only "usable" on English
//    * granularity: 'grapheme' does not understand combining characters
//    * granularity: 'sentence' does not understand decimals

(function(global) {
  if ('Intl' in global && 'Segmenter' in global.Intl) {
    return;
  }

  global.Intl = global.Intl || {};

  const GRANULARITIES = ['grapheme', 'word', 'sentence', 'line'];

  // TODO: Implement https://www.unicode.org/reports/tr29/
  const RULES = {
    grapheme: {
      grapheme: /^(.|\n)/,
    },
    word: {
      letter: /^[a-z](?:'?[a-z])*/i,
      number: /^\d+([,.]\d+)*/,
    },
    sentence: {
      terminator: /^[^.?!\r\n]+[.?!]+[\r\n]?/,
      separator: /^[^.?!\r\n]+[\r\n]?/,
    },
    line: {
      hard: /^\S*[\r\n]/,
      soft: /^\S*\s*/,
    },
  };

  // Work around bug in v8BreakIterator where ICU's UWordBreak enum is
  // used even if granularity is not "word". See the code in
  // Runtime_BreakIteratorBreakType in runtime/runtime-i18n.cc for
  // details.
  function fixBreakType(value, granularity) {
    // Undo the mapping of UWordBreak to string
    const ruleStatus = {
      none: 0, // UBRK_WORD_NONE
      number: 100, // UBRK_WORD_NUMBER
      letter: 200, // UBRK_WORD_LETTER
      kana: 300, // UBRK_WORD_KANA
      ideo: 400, // UBRK_WORD_IDEO
      unknown: -1,
    }[value] || 0;


    switch (granularity) {
    case 'character':
      return undefined;
    case 'word':
      return value;
    case 'sentence':
      // Map ULineBreakTag rule status to string.
      return {
        0: 'terminator',
        100: 'separator',
      }[ruleStatus] || value;
    case 'line':
      // Map ULineBreakTag rule status to string.
      return {
        0: 'soft',
        100: 'hard',
      }[ruleStatus] || value;
    default:
      return value;
    }
  }

  function segment(locale, granularity, string) {
    const breaks = [];
    if ('v8BreakIterator' in global.Intl) {
      if (granularity === 'grapheme') {
        granularity = 'character';
      }
      const vbi = new global.Intl.v8BreakIterator(locale, {type: granularity});
      vbi.adoptText(string);
      let last = 0;
      let pos = vbi.next();
      while (pos !== -1) {
        breaks.push({
          pos: vbi.current(),
          segment: string.slice(last, pos),
          breakType: fixBreakType(vbi.breakType(), granularity),
        });
        last = pos;
        pos = vbi.next();
      }
    } else {
      const rules = RULES[granularity];
      let pos = 0;
      while (pos < string.length) {
        let found = false;
        for (const rule of Object.keys(rules)) {
          const re = rules[rule];
          const m = string.slice(pos).match(re);
          if (m) {
            pos += m[0].length;
            breaks.push({
              pos: pos,
              segment: m[0],
              breakType: granularity === 'grapheme' ? undefined : rule,
            });
            found = true;
            break;
          }
        }
        if (!found) {
          breaks.push({
            pos: pos + 1,
            segment: string.slice(pos, ++pos),
            breakType: 'none',
          });
        }
      }
    }
    return breaks;
  }

  class $SegmentIterator$ {
    constructor(string, breaks) {
      this._cur = -1;
      this._type = undefined;
      this._breaks = breaks;
    }

    [Symbol.iterator]() {
      return this;
    }

    next() {
      if (this._cur < this._breaks.length) {
        ++this._cur;
      }

      if (this._cur >= this._breaks.length) {
        this._type = undefined;
        return {done: true, value: undefined};
      }

      this._type = this._breaks[this._cur].breakType;
      return {
        done: false,
        value: {
          segment: this._breaks[this._cur].segment,
          breakType: this._breaks[this._cur].breakType,
        },
      };
    }

    following(index = undefined) {
      if (!this._breaks.length) {
        return true;
      }
      if (index === undefined) {
        if (this._cur < this._breaks.length) {
          ++this._cur;
        }
      } else {
        // TODO: binary search
        for (this._cur = 0;
             this._cur < this._breaks.length
             && this._breaks[this._cur].pos < index;
             ++this._cur) { /* TODO */ }
      }

      this._type = this._cur < this._breaks.length
        ? this._breaks[this._cur].breakType : undefined;
      return this._cur + 1 >= this._breaks.length;
    }

    preceding(index = undefined) {
      if (!this._breaks.length) {
        return true;
      }
      if (index === undefined) {
        if (this._cur >= this._breaks.length) {
          --this._cur;
        }
        if (this._cur >= 0) {
          --this._cur;
        }
      } else {
        // TODO: binary search
        for (this._cur = this._breaks.length - 1;
             this._cur >= 0
             && this._breaks[this._cur].pos >= index;
             --this._cur) { /* TODO */ }
      }

      this._type =
        this._cur + 1 >= this._breaks.length ? undefined :
        this._breaks[this._cur + 1].breakType;
      return this._cur < 0;
    }

    get position() {
      if (this._cur < 0 || !this._breaks.length) {
        return 0;
      }
      if (this._cur >= this._breaks.length) {
        return this._breaks[this._breaks.length - 1].pos;
      }
      return this._breaks[this._cur].pos;
    }

    get breakType() {
      return this._type;
    }
  }

  global.Intl.Segmenter = class Segmenter {
    constructor(locale, {localeMatcher, granularity = 'grapheme'} = {}) {
      this._locale = Array.isArray(locale)
        ? locale.map((s) => String(s)) : String(locale || navigator.language);
      this._granularity = GRANULARITIES.includes(granularity)
        ? granularity : 'grapheme';
    }

    segment(string) {
      return new $SegmentIterator$(
        string, segment(this._locale, this._granularity, string));
    }
  };
}(typeof window !== 'undefined' ?
      window :
      (typeof global !== 'undefined' ? global : this)));
