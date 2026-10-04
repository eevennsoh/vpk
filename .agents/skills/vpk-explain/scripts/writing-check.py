"""Read-only, stdlib-only advisory checks for plain text and simple Markdown.

Writing checks are informed by danyuchn/asd-ste100-skill, revision 7d4a135.
See ../references/upstream-license.txt. This is an independent implementation;
it does not include ASD's dictionary or certify meaning/STE compliance.
"""

import argparse
import json
from pathlib import Path
import re
import sys


PATTERNS = {
    "semicolon": (re.compile(r";"), "Consider separate sentences if this joins distinct ideas."),
    "phrasal-verb": (
        re.compile(r"\b(?:spin(?:s|ning)? up|spun up|kick(?:s|ed|ing)? off|"
                   r"reach(?:es|ed|ing)? out|dive(?:s|d)? into|diving into)\b", re.I),
        "Consider a literal action verb, such as start, contact, or read."),
    "nominalization": (
        re.compile(r"\b(?:perform(?:s|ed)?|conduct(?:s|ed)?)\s+(?:a|an|the)\s+"
                   r"(?:analysis|evaluation|implementation|investigation)\b", re.I),
        "Consider naming the action directly with a verb."),
    "marketing-adjective": (
        re.compile(r"\b(?:seamless(?:ly)?|robust(?:ly)?|effortless(?:ly)?|"
                   r"cutting-edge|blazing[- ]fast|world-class)\b", re.I),
        "Review this quality claim; use evidence or keep it only if its meaning is precise."),
}
RULE_NAMES = ("long-sentence", *PATTERNS)
FENCE = re.compile(r"^\s{0,3}(`{3,}|~{3,})")
LIST_START = re.compile(r"^\s*(?:[-*+] |\d+[.)] )")
ABBREVIATION = re.compile(r"\b(?:e\.g\.|i\.e\.|Mr\.|Mrs\.|Dr\.|vs\.|etc\.)", re.I)


def _mask(match):
    return " " * len(match.group(0))


def _clean_line(line):
    # Keep offsets stable while excluding syntax and exact identifiers.
    line = re.sub(r"(`+)(.+?)\1", lambda m: "X" + " " * (len(m.group(0)) - 1), line)
    line = re.sub(r"(?<=\])\([^\n)]*\)", _mask, line)
    line = re.sub(r"https?://\S+", _mask, line)
    return line


def _prose_segments(text):
    """Keep soft wraps in paragraphs, separate list items and table cells."""
    segments = []
    pending = []
    start = 0
    offset = 0
    fence = None
    frontmatter = False

    def flush():
        if pending:
            segments.append(("".join(pending), start))
            pending.clear()

    for index, line in enumerate(text.splitlines(keepends=True)):
        stripped = line.strip()
        if index == 0 and stripped == "---":
            frontmatter = True
        elif frontmatter and stripped == "---":
            frontmatter = False
            offset += len(line)
            continue
        if frontmatter:
            offset += len(line)
            continue
        marker = FENCE.match(line)
        if marker:
            delimiter = marker.group(1)
            flush()
            if fence is None:
                fence = delimiter
            elif delimiter[0] == fence[0] and len(delimiter) >= len(fence) and stripped == delimiter:
                fence = None
            offset += len(line)
            continue
        if fence is not None:
            offset += len(line)
            continue
        if not stripped or stripped.startswith("#"):
            flush()
        elif stripped.startswith("|") and stripped.endswith("|"):
            flush()
            # Standard leading-pipe tables only; escaped pipes stay in cells.
            separators = [m.start() for m in re.finditer(r"(?<!\\)\|", line)]
            for left, right in zip(separators, separators[1:]):
                cell = line[left + 1:right]
                if not re.fullmatch(r"\s*:?-{3,}:?\s*", cell):
                    segments.append((_clean_line(cell), offset + left + 1))
        else:
            item = LIST_START.match(line)
            if item:
                flush()
                line = " " * item.end() + line[item.end():]
            if not pending:
                start = offset
            pending.append(_clean_line(line))
        offset += len(line)
    flush()
    return segments


def _sentences(text):
    boundaries = ABBREVIATION.sub(lambda m: m.group(0).replace(".", "_"), text)
    boundaries = re.sub(r"(?<=\d)\.(?=\d)", "_", boundaries)
    start = 0
    for match in re.finditer(r"[.!?](?:[\"')\]]*)\s+|[.!?]$", boundaries):
        yield start, text[start:match.end()]
        start = match.end()
    if text[start:].strip():
        yield start, text[start:]


def check_text(text, filename="<stdin>", max_words=25, disabled=()):
    findings = []

    def add(rule, position, message, **details):
        if rule in disabled:
            return
        findings.append({"file": filename, "line": text.count("\n", 0, position) + 1,
                         "column": position - text.rfind("\n", 0, position),
                         "rule": rule, "level": "advisory", "message": message, **details})

    for segment, offset in _prose_segments(text):
        normalized = segment.replace("\n", " ").replace("\r", " ")
        for start, sentence in _sentences(normalized):
            count = len(sentence.split())
            if count > max_words:
                leading = len(sentence) - len(sentence.lstrip())
                add("long-sentence", offset + start + leading,
                    f"Review this {count}-word sentence (guideline: {max_words}); preserve necessary precision.",
                    words=count)
        for rule, (pattern, message) in PATTERNS.items():
            for match in pattern.finditer(normalized):
                add(rule, offset + match.start(), message, match=match.group(0))
    return sorted(findings, key=lambda f: (f["file"], f["line"], f["column"], f["rule"]))


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="*", help="Plain text or simple Markdown; default: stdin")
    parser.add_argument("--json", action="store_true", help="Print structured advisory findings")
    parser.add_argument("--instructions", action="store_true", help="Use a 20-word guideline instead of 25")
    parser.add_argument("--disable", action="append", choices=RULE_NAMES, default=[], metavar="RULE",
                        help="Checks to suppress: " + ", ".join(RULE_NAMES))
    args = parser.parse_args(argv)
    findings = []
    try:
        sources = [(name, Path(name).read_text(encoding="utf-8")) for name in args.files]
        if not sources:
            sources = [("<stdin>", sys.stdin.read())]
        for name, text in sources:
            findings.extend(check_text(text, name, 20 if args.instructions else 25, args.disable))
    except (OSError, UnicodeError) as error:
        print(f"Cannot read input: {error}", file=sys.stderr)
        return 2
    if args.json:
        print(json.dumps({"findings": findings, "count": len(findings), "advisory_only": True}, indent=2))
    else:
        for finding in findings:
            print(f"{finding['file']}:{finding['line']}:{finding['column']} "
                  f"{finding['rule']}: {finding['message']}")
        print(f"{len(findings)} advisory findings. No meaning or STE compliance guarantee.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
