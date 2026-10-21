#!/usr/bin/env python3
"""Prints the CodeIslandCore sources and tests that build on Linux, one path per line.

Rule, no file names: a file is out when it uses an Apple-only API (the pattern below), or when it
names a type, or calls a method an extension adds, that a file already out declares. Repeated
until nothing changes, so a new Core file joins by itself unless it depends on Apple-only code.
"""
import re, sys
from pathlib import Path

APPLE_ONLY = re.compile(
    r"^import (SQLite3|CryptoKit|Darwin|AppKit|Security|os)$"   # modules Linux lacks
    r"|\bDarwin\.|SO_NOSIGPIPE"                                  # BSD sockets
    r"|\bCF[A-Z]\w+\("                                           # CoreFoundation functions
    r"|inlineOnlyPreservingWhitespace|PresentationIntent",       # AttributedString markdown, Apple Foundation only
    re.M)
NETWORK = re.compile(r"\bURL(Session|Request)\b|HTTPURLResponse")  # FoundationNetworking: fine where the file imports it
TYPE = re.compile(r"^(?:(?:public|internal|private|fileprivate|final|indirect)\s+)*(?:struct|class|enum|protocol|actor|typealias)\s+(\w+)", re.M)
EXTENSION = re.compile(r"^(?:public\s+)?extension\s+(\w+)")
OWN_FUNC = re.compile(r"\bfunc\s+(\w+)")
FUNC = re.compile(r"^\s+(?:(?:public|internal|mutating|@\w+)\s+)*func\s+(\w+)")  # static ones are called through their type


def declared(text):
    """Top-level types the file declares (nested ones are too generic to match), and methods it adds to other files' types through an extension."""
    names, in_extension = set(TYPE.findall(text)), False
    for line in text.splitlines():
        if line and not line[0].isspace() and line[0] != "}":
            m = EXTENSION.match(line)
            in_extension = bool(m) and m.group(1) not in names
        elif in_extension and (m := FUNC.match(line)):
            names.add(m.group(1))
    return names


def uses(text, names):
    return bool(names) and re.search(r"\b(" + "|".join(map(re.escape, sorted(names))) + r")\b", text) is not None


root = Path(sys.argv[1])
files = {p: p.read_text() for d in ("Sources/CodeIslandCore", "Tests/CodeIslandCoreTests") for p in sorted((root / d).glob("*.swift"))}
out = {p for p, t in files.items() if APPLE_ONLY.search(t) or (NETWORK.search(t) and "import FoundationNetworking" not in t)}
while True:
    gone = set().union(*(declared(files[p]) for p in out)) if out else set()
    # A name the file declares itself, type or any func, is its own (NotchFeeds' `headline` is not SessionHeadline's).
    more = {p for p, t in files.items() if p not in out and uses(t, gone - declared(t) - set(OWN_FUNC.findall(t)))}
    if not more:
        break
    out |= more
for p in files:
    if p not in out:
        print(p)
for p in sorted(out):
    print("skipped (needs Apple-only code):", p.relative_to(root), file=sys.stderr)
