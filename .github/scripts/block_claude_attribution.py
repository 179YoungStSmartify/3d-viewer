#!/usr/bin/env python3
"""Fail if commits or PR text credit Claude/Anthropic as author or co-author.

Usage: block_claude_attribution.py <git log revision args...>
  e.g. block_claude_attribution.py <head_sha> --not <base_sha>
PR title and body are read from the PR_TITLE and PR_BODY environment variables.
Stdlib only; exit 0 = clean, 1 = attribution found, 2 = usage/git error.
"""
import os
import re
import subprocess
import sys

LINE_PATTERNS = [
    re.compile(r"co-authored-by\s*:.*\b(claude|anthropic)\b", re.IGNORECASE),
    re.compile(r"generated\s+with\b.*\bclaude\b", re.IGNORECASE),
]
NAME_PATTERN = re.compile(r"\bclaude\b", re.IGNORECASE)
EMAIL_PATTERN = re.compile(r"anthropic\.com", re.IGNORECASE)
FIELD = "\x1f"
RECORD = "\x1e"


def message_hits(text):
    return [
        line.strip()
        for line in text.splitlines()
        if any(p.search(line) for p in LINE_PATTERNS)
    ]


def main(argv):
    if not argv:
        print("usage: block_claude_attribution.py <git log rev args...>", file=sys.stderr)
        return 2
    fmt = FIELD.join(["%H", "%an", "%ae", "%cn", "%ce", "%B"]) + RECORD
    result = subprocess.run(
        ["git", "log", "--format=" + fmt, *argv], capture_output=True, text=True
    )
    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
        return 2

    problems = []
    commits = 0
    for record in result.stdout.split(RECORD):
        record = record.strip("\n")
        if not record:
            continue
        sha, an, ae, cn, ce, body = record.split(FIELD, 5)
        commits += 1
        short = sha[:9]
        for label, value in (("author name", an), ("committer name", cn)):
            if NAME_PATTERN.search(value):
                problems.append(f"{short}: {label} {value!r}")
        for label, value in (("author email", ae), ("committer email", ce)):
            if EMAIL_PATTERN.search(value):
                problems.append(f"{short}: {label} {value!r}")
        for hit in message_hits(body):
            problems.append(f"{short}: commit message line {hit!r}")

    for label in ("PR_TITLE", "PR_BODY"):
        for hit in message_hits(os.environ.get(label, "")):
            problems.append(f"{label}: {hit!r}")

    print(f"checked {commits} commit(s)")
    if problems:
        print("Claude/Anthropic attribution found:")
        for p in problems:
            print("  - " + p)
        print("Remove the attribution (rewrite the commits, edit the PR text) and push again.")
        return 1
    print("OK: no Claude/Anthropic attribution found")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
