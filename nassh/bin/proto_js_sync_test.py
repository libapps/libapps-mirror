#!/usr/bin/env python3
# Copyright 2025 The ChromiumOS Authors
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

"""Verifies JavaScript class implementations match Protocol Buffer definitions.

It checks for class structure, methods, and getters/setters corresponding to
proto fields.
"""

import re
import unittest
from pathlib import Path


class ColorTestResult(unittest.TextTestResult):
    """Custom TestResult to colorize FAIL/ERROR messages in test output."""

    def addFailure(self, test, err):
        super().addFailure(test, err)
        self.stream.write("\033[91mFAIL\033[0m\n")

    def addError(self, test, err):
        super().addError(test, err)
        self.stream.write("\033[91mERROR\033[0m\n")


class ColorTestRunner(unittest.TextTestRunner):
    """TestRunner using ColorTestResult for enhanced output."""

    resultclass = ColorTestResult


class ProtoField:
    """Represents a single field from a .proto file."""

    def __init__(self, name: str):
        """Initializes with the field's snake_case name and converts it to
        camelCase."""
        self.name = name
        self.camel_name = self.to_camel_case(name)

    def to_camel_case(self, snake_str: str) -> str:
        """Converts snake_case string to camelCase."""
        components = snake_str.split("_")
        return components[0] + "".join(
            word.capitalize() for word in components[1:]
        )


def parse_proto_fields(content: str):
    """Extracts field names from .proto file content within message blocks."""
    fields = []
    in_message = False

    for line in content.split("\n"):
        line = line.strip()

        if not line or line.startswith("//") or line.startswith("/*"):
            continue

        if "message" in line and "{" in line:
            in_message = True
        elif line == "}" and in_message:
            in_message = False
        elif in_message:
            match = re.match(
                r"(?:optional|required|repeated)?\s*\w+\s+(\w+)\s*=\s*\d+", line
            )
            if match:
                fields.append(ProtoField(match.group(1)))

    return fields


class ProtoJsSyncTests(unittest.TestCase):
    """Tests synchronization between .proto field definitions and JavaScript
    class implementation.
    """

    def setUp(self):
        """Loads proto and JS file contents and parses proto fields for tests"""
        self.proto_file = Path("proto/ssh_policy.proto")
        self.js_file = Path("js/ssh_policy.js")

        with open(self.proto_file, "r", encoding="utf-8") as f:
            self.proto_content = f.read()

        with open(self.js_file, "r", encoding="utf-8") as f:
            self.js_content = f.read()

        self.fields = parse_proto_fields(self.proto_content)

    def test_class_exists(self):
        """Asserts the main class (e.g., SshPolicy) is defined in the JS
        file."""
        self.assertIn(
            "class SshPolicy", self.js_content, "Class name not found"
        )

    def test_constructor_exists(self):
        """Verifies the constructor method is present in the JS class."""
        self.assertIn(
            "constructor()", self.js_content, "constructor() method not found"
        )

    def test_create_method_exists(self):
        """Checks for the static 'create' method in the JS class."""
        self.assertIn(
            "static create(", self.js_content, "create() method not found"
        )

    def test_getters_setters_exist(self):
        """Confirms getters and setters for each proto field exist in the JS
        class."""
        for field in self.fields:
            capitalized = field.camel_name[0].upper() + field.camel_name[1:]
            self.assertIn(
                f"get{capitalized}",
                self.js_content,
                f"getter for {field.name} not found",
            )
            self.assertIn(
                f"set{capitalized}",
                self.js_content,
                f"setter for {field.name} not found",
            )

    def test_camel_case_used(self):
        """Ensures the camelCase version of each proto field name is used in the
        JS content."""
        for field in self.fields:
            self.assertIn(
                field.camel_name,
                self.js_content,
                f"camelCase field name '{field.camel_name}' not found",
            )
