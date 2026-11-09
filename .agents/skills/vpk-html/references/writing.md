# Writing guide

Owner of visible prose for [SKILL.md](../SKILL.md). Load when you write any visible word or source.

The renderer provides structure, not claims. The agent distills the source accurately, then writes every visible word. The reader gets the point in a 30-second scan and can audit the detail in a deeper read.

Precedence: genre order and the user’s requested voice outrank "lead with the answer". That covers math (prerequisites before definitions, intuition before proof, worked examples before exercises), narrative and feature essays, resumes, interviews, editorial, decks, and X threads. Do not apply the sentence rules to creative copy. Source discipline still applies to every word.

Adapted from vpk-explain `references/writing.md`, whose checklist adapts [danyuchn/asd-ste100-skill](https://github.com/danyuchn/asd-ste100-skill) (MIT). STE-inspired plain English, not ASD-STE100 compliance.

## Write only the steps and facts the source states

Do not invent metrics, dates, citations, math claims, people, project status, causes, mechanisms, or benefits. A step that seems obvious still counts. This applies to prose, captions, figure labels, and the options you describe when you ask a question.

| Wrong | → Right |
| --- | --- |
| "A miss stores the page" when the source says only "a miss renders in 180 ms" | → leave the step out, or mark `[DATA NEEDED: does a miss store the page?]` in the page and list it as an assumption in the contract |
| `TBD`, `lorem ipsum` or a silent guess | → `[DATA NEEDED: ...]` for an intentional visible gap |
| An optional section the source does not support, padded | → omit the section |
| A sentence that repeats its heading | → body copy that adds to the heading |

## Headings name the finding, captions say what to notice

| Element | Wrong | → Right |
| --- | --- | --- |
| Heading | "Overview" | → "Why the rollout paused at 50%" |
| Caption | "Figure 3: Latency" | → "p95 latency by region. Only eu-west exceeds 600 ms." |
| Label, chip, legend | A short label that drops the body’s term, condition or uncertainty | → short, keeping the term, condition and uncertainty |

## Lead with the answer, one topic per paragraph

| Wrong | → Right |
| --- | --- |
| "The index was removed" | → "The data team removed the index" |
| "Perform an analysis of the log" · "spin up the canary" | → "Analyze the log" · "Start the canary" |
| "It is important to note that", "in order to", "at this point in time" | → cut |
| Robust, seamless, significant | → the evidence from the source, or delete |

- **Lead with the answer.** Put the result first, then background and method.
- **One topic per paragraph.** Use lists for steps and tables for comparisons.
- **Short sentences.** About 25 words is a review guideline, not a hard limit. Split a sentence that carries two actions. Prefer full stops to semicolons. Keep a condition next to its action.
- **Active voice.** Name the actor unless the source leaves it unknown: "The data team removed the index", not "The index was removed".
- **One name per thing.** Give one entity or action one term, defined once at first use. Keep distinct terms for distinct things ("check the size" and "verify the signature" differ).
- **Direct verbs, plain nouns.** "Analyze the log", not "perform an analysis of the log". "Start the canary", not "spin up the canary". Avoid idioms. Keep compound tenses when time or current relevance matters. Unpack long noun stacks into relationships, and keep exact technical names.
- **No filler.** Cut "it is important to note that", "in order to", and "at this point in time". Replace unsupported quality words such as robust, seamless, and significant with evidence from the source, or delete them.
- **Cut pass.** After the draft, cut repeats and words that carry no fact. Stop when the text is clear, not when no words remain. Keep articles, subjects, and qualifiers. Undo a cut that changes a fact, number, or claim strength.

## Keep exactly

| Keep | Wrong | → Right |
| --- | --- | --- |
| Requirement strength and certainty (must, should, may, could, sometimes, likely) | "Must" → "should"; "may have failed" → "failed" | → the source’s word; label estimates and hypotheticals |
| Numbers, units, dates, versions, identifiers, negation | "~600 ms" for the source’s "612 ms" | → "612 ms" |
| Conditions, exceptions, order | A qualifier moved away from the claim it limits | → the qualifier beside its claim |
| Facts in the sidecar’s exact form | "62 percent" when the sidecar says `62%` | → `62%`, so `--check-content` coverage still matches |
| Typographic apostrophes and quotes in reader-facing prose | "don't" · `'it's'` in a JS string, which throws a `SyntaxError` | → “don’t” · `'it’s'`; code, attribute values and identifiers keep straight quotes |

## Before and after

Examples are illustrative. Real text uses only the source’s facts.

| Before | After | Why |
| --- | --- | --- |
| In this document we discuss the latency analysis of the checkout service. | Checkout p95 latency rose from 420 ms to 610 ms after the 4.2 deploy. | The lead gives the result. Use a number only if the source has it |
| It is important to note that the team performed an analysis of the logs and spun up a canary. | The team analyzed the logs and started a canary. | No filler, direct verbs, no idiom |
| A robust, seamless failover with significantly reduced downtime. | Failover took 38 s. The old path took 4 min. | Evidence replaces adjectives. If the source has no number, delete the adjectives |

## Review checklist

Run it on the distilled notes before you fill the template. Run it again on the finished text.

| # | Ask |
| --- | --- |
| 1 | Does each section open with its answer, unless the genre sets its order? |
| 2 | Does each paragraph hold one topic, using lists and tables where they fit? |
| 3 | Does each sentence prefer active voice, name its actor unless the source leaves it unknown, and keep its condition with its action? |
| 4 | Does each thing keep one name, with terms defined once? |
| 5 | Is every number, unit, date, and negation identical to the source? |
| 6 | Does every apostrophe and quote in visible text use ’ “ ” instead of ' and "? |
| 7 | Do must, should, may, could, sometimes, and likely keep their original strength? |
| 8 | Are filler, idioms, and unsupported adjectives gone, and long noun stacks unpacked? |
| 9 | Does each heading name the finding or the contents, and does each caption say what the reader sees? |
| 10 | Does each caption and paragraph add to its heading, without restating the heading or a fact already given in the lede or a caption? |
| 11 | Is every claim from the source, and is every gap either marked `[DATA NEEDED: ...]` or omitted? |
| 12 | Does every process, flow, or figure use only the steps the source states? Search the text for verbs the source never uses (stores, retries, caches, notifies) and cut or mark each one. |

`--check-caption-echo` findings (`scripts/gates.mjs`) are evidence for the "adds to its heading" row (10). Check each one against that row and fix the text. Do not dismiss a finding as a false positive without naming the new fact the caption adds.

Run vpk-explain’s advisory checker on substantial saved prose: `python3 .agents/skills/vpk-explain/scripts/writing-check.py <file>`. Save the visible text as plain text or Markdown first, because it does not read HTML. Review its findings against meaning. A clean report does not prove clarity.

Resumes also follow [resume writing](resume-writing.md). Banned content patterns are in [anti-patterns](anti-patterns.md).
