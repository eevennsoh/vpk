# STE-inspired writing

Use plain English inspired by ASD-STE100. Clarity and preserved meaning take
priority over a short sentence or a low finding count. This is not a claim of
compliance with the controlled-language specification.

## Choose the writing discipline

**Default explanation:** use clear, natural prose and narration. Treat 25
words per sentence as a review guideline, not a hard limit. Keep technical
terms and grammatical forms when they carry useful precision. Do not flatten
the user's requested voice or apply this discipline to unrelated creative copy.

**Controlled instructions:** when requested with `--controlled`, or when
rewriting procedures or tool descriptions for unambiguous execution, tighten
the structure. Aim for at most 20 words per instruction, one action per
sentence, explicit actors/conditions, short noun phrases, and simple tenses.
Keep technical terminology and meaningful uncertainty. Treat these as our
clarity constraints, not proof of the official dictionary's approval.

**Strict ASD-STE100:** if explicitly requested, obtain the applicable official
edition's rules and dictionary from a permitted source and check against them.
A summary image, memorized word list, or checker report is insufficient. If
the specification is unavailable, say compliance is unverified and label the
result STE-inspired. “80% STE” requests a softened style, not a measurable score.
The [official request page](https://www.asd-ste100.org/STE_downloads.html) is
the starting point for obtaining the standard; do not redistribute its dictionary.

## Ambiguity checklist

Read the source for meaning before making edits. Review these points manually:

| Check | Better writing | Precision to retain |
| --- | --- | --- |
| Actor and action | Name who does what; prefer active voice | Do not invent an actor when the source leaves it unknown |
| Conditions and scope | State when the action applies and what it affects | Preserve negation, exceptions, order, quantities, and units |
| Requirement and certainty | Keep must, should, may, could, sometimes, and likely at their original strength | “May have failed” must not become “failed”; “must” must not become “should” |
| Terminology | Give one entity or action a consistent name; define domain terms once | Check whether different terms actually describe different things; checking size and verifying a signature can be distinct actions |
| Noun phrases | Unpack long stacks of modifiers into relationships | Preserve exact technical names and identifiers |
| Verb forms | Prefer a direct verb to “perform an analysis”; replace vague idioms such as “spin up” with “start” | Keep compound tenses when time or current relevance matters |
| Sentence structure | Separate successive actions and unrelated clauses; prefer full stops to semicolons | Keep a condition with its action; do not remove articles or subjects to save words |
| Paragraph structure | One topic per paragraph; use lists for steps and comparisons | Do not detach a qualifier from the statement it limits |
| Empty claims | Replace unsupported quality adjectives with evidence, or remove them | Never invent a measurement, cause, mechanism, or benefit to make the text useful |

Remove filler such as “it is important to note that,” but preserve real
uncertainty. Shortening is complete when the text is clear, not when no more
words can be removed. Clear but unsupported content still needs evidence.

## Rewrite and explain changes

For a rewrite-only request, return the revised text without a preamble or
style report. If the text is already clear, keep it. Compare the original and
revision statement by statement: facts, actors, conditions, negation,
requirement strength, uncertainty, numbers, and causal claims must agree.
Do not add an explanation's new example or inference to a pure rewrite.

When asked for `--before-after`, “show the diff,” or “explain the changes,”
provide the revised text plus a compact table of meaningful edits:

| Original | Revision | Why |
| --- | --- | --- |
| Perform an analysis of the log. | Analyze the log. | Names the action directly |
| Spin up the server. | Start the server. | Replaces an idiom with a literal action |

Name observed clarity issues; do not invent official rule numbers or a
compliance percentage. Mention a deliberately retained phrase only when its
precision or ambiguity matters. See [worked examples](writing-examples.md).

## Advisory checks

Use [writing-check.py](../scripts/writing-check.py) for substantial drafts,
extracted visible text, or narration scripts. It accepts plain text/simple
Markdown, not HTML source, captions with timing metadata, or arbitrary code.
Run it against an existing draft file, or provide the extracted text on stdin:

```bash
python3 .agents/skills/vpk-explain/scripts/writing-check.py explanation.md
python3 .agents/skills/vpk-explain/scripts/writing-check.py --json explanation.md
python3 .agents/skills/vpk-explain/scripts/writing-check.py --instructions procedure.md
```

The checker reports long sentences across paragraph line wraps, semicolons,
selected vague phrasal verbs, action nominalizations, and quality adjectives.
It skips fenced code, inline code, frontmatter, headings, and link targets;
list items and standard leading-pipe table cells are separate prose units.
Review terminology, actors, tenses, noun phrases, and meaning manually.

Findings are advisory and never fail a style gate or edit the input. Exit 0
means the check ran; exit 2 means an input/argument error. `--disable RULE`
can suppress a named check; see `--help` for available names. English sentence
segmentation and Markdown handling are heuristic, not a complete parser.
Do not interpret an empty report as compliance or preserved meaning.

Keep narration natural enough to listen to. Shorter on-screen labels must
retain the script's terminology, conditions, and uncertainty. Apply the
semantic review after compressing labels as well as after rewriting prose.

## Attribution

The checklist, rewrite process, and advisory-check approach adapt ideas from
[danyuchn/asd-ste100-skill](https://github.com/danyuchn/asd-ste100-skill/tree/7d4a135a199a5d7447c4886bcd7ffe742a627bc9)
(skill version 0.4.0), by Dustin Yuchen Teng. Its MIT notice is retained in
[upstream-license.txt](upstream-license.txt). The checker is independently
implemented to handle wrapped sentences and avoid automatic synonym policing.
