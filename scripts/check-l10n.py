#!/usr/bin/env python3
"""Every language in L10n.swift has every English key, with the same placeholders. Prints what is off; exit 1 if any."""
import re, sys, collections
src = open(sys.argv[1] if len(sys.argv) > 1 else "Sources/Clotch/L10n.swift", encoding="utf-8").read()
tables, merged = {}, set()
for m in re.finditer(r'private static let (\w+): \[String: String\] = (en\.merging\()?\[(.*?)\n    \]', src, re.S):
    tables[m.group(1)] = dict(re.findall(r'^\s*"([^"]+)":\s*"((?:[^"\\]|\\.)*)"', m.group(3), re.M))
    if m.group(2): merged.add(m.group(1))
ph = lambda s: collections.Counter(re.findall(r'%(?:\d+\$)?[-+ 0#]*\d*(?:\.\d+)?(?:ll|l|h)?[@dfsuxXeg%]', s))
en, bad = tables["en"], 0
for lang, t in tables.items():
    if lang == "en": continue
    full = {**en, **t} if lang in merged else t
    missing = sorted(set(en) - set(full))
    diff = sorted(k for k in en if k in full and ph(en[k]) != ph(full[k]))
    if missing: print(f"{lang}: {len(missing)} missing: {missing}")
    if diff: print(f"{lang}: placeholders differ: {diff}")
    bad += len(missing) + len(diff)
print(f"{len(tables)} tables, {len(en)} English keys, {bad} problems")
sys.exit(1 if bad else 0)
