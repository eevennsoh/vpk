# Writing guide

The renderer provides structure, not claims. The agent distills the source
accurately, then writes every visible word. The reader gets the point in a
30-second scan and can audit the detail in a deeper read.

Precedence: genre order and the user's requested voice outrank "lead with the
answer". That covers math (prerequisites before definitions, intuition before
proof, worked examples before exercises), narrative and feature essays, resumes,
interviews, editorial, decks, and X threads. Do not apply the sentence rules to
creative copy. Source discipline still applies to every word.

Adapted from vpk-explain `references/writing.md`, whose checklist adapts
[danyuchn/asd-ste100-skill](https://github.com/danyuchn/asd-ste100-skill) (MIT).
STE-inspired plain English, not ASD-STE100 compliance.

## Source discipline

- Do not invent metrics, dates, citations, math claims, people, project status,
  causes, mechanisms, or benefits.
- Describe a process with the steps the source states, and no others. A step
  that seems obvious still counts: "a miss stores the page" is invented when the
  source says only "a miss renders in 180 ms". Leave the step out, or mark it
  `[DATA NEEDED: does a miss store the page?]` in the page and list it as an
  assumption in the contract. This applies to prose, captions, figure labels,
  and the options you describe when you ask a question.
- Use `[DATA NEEDED: ...]` only for an intentional visible gap. Never leave
  `TBD`, lorem ipsum, or a silent guess. Omit an optional section the source
  does not support.
- Body copy adds to its heading. Do not repeat the heading in a sentence.

## Headings, captions, labels

- Keep headings concrete and short. Name the finding or the contents, not the
  genre: "Why the rollout paused at 50%", not "Overview".
- Prefer human-readable captions for diagrams and tables. Say what the reader
  sees and what to notice: "p95 latency by region. Only eu-west exceeds 600 ms."
- Keep labels, chips, and legends short. A short label still keeps the body's
  term, condition, and uncertainty.

## Sentences and paragraphs

- **Lead with the answer.** Put the result first, then background and method.
- **One topic per paragraph.** Use lists for steps and tables for comparisons.
- **Short sentences.** About 25 words is a review guideline, not a hard limit.
  Split a sentence that carries two actions. Prefer full stops to semicolons.
  Keep a condition next to its action.
- **Active voice.** Name the actor unless the source leaves
  it unknown: "The data team removed the index", not "The index was removed".
- **One name per thing.** Give one entity or action one term, defined once at
  first use. Keep distinct terms for distinct things ("check the size" and
  "verify the signature" differ).
- **Direct verbs, plain nouns.** "Analyze the log", not "perform an analysis of
  the log". "Start the canary", not "spin up the canary". Avoid idioms. Keep
  compound tenses when time or current relevance matters. Unpack long noun
  stacks into relationships, and keep exact technical names.
- **No filler.** Cut "it is important to note that", "in order to", and "at
  this point in time". Replace unsupported quality words such as robust,
  seamless, and significant with evidence from the source, or delete them.
- **Cut pass.** After the draft, cut repeats and words that carry no fact. Stop
  when the text is clear, not when no words remain. Keep articles, subjects, and
  qualifiers. Undo a cut that changes a fact, number, or claim strength.

## Keep exactly

- Requirement strength and certainty: must, should, may, could, sometimes,
  likely. "Must" never becomes "should". "May have failed" never becomes
  "failed". Label estimates and hypotheticals.
- Numbers, units, dates, versions, identifiers, and negation.
- Conditions, exceptions, and order. Never detach a qualifier from the claim it
  limits.
- Facts in the exact form the sidecar states, so `--check-content` coverage
  still matches.

## Before and after

Examples are illustrative. Real text uses only the source's facts.

| Before | After | Why |
| --- | --- | --- |
| In this document we discuss the latency analysis of the checkout service. | Checkout p95 latency rose from 420 ms to 610 ms after the 4.2 deploy. | The lead gives the result. Use a number only if the source has it |
| It is important to note that the team performed an analysis of the logs and spun up a canary. | The team analyzed the logs and started a canary. | No filler, direct verbs, no idiom |
| A robust, seamless failover with significantly reduced downtime. | Failover took 38 s. The old path took 4 min. | Evidence replaces adjectives. If the source has no number, delete the adjectives |

## Review checklist

Run it on the distilled notes before you fill the template. Run it again on the
finished text.

- [ ] Does each section open with its answer, unless the genre sets its order?
- [ ] Does each paragraph hold one topic, using lists and tables where they fit?
- [ ] Does each sentence prefer active voice, name its actor unless the source
      leaves it unknown, and keep its condition with its action?
- [ ] Does each thing keep one name, with terms defined once?
- [ ] Is every number, unit, date, and negation identical to the source?
- [ ] Do must, should, may, could, sometimes, and likely keep their original strength?
- [ ] Are filler, idioms, and unsupported adjectives gone, and long noun stacks
      unpacked?
- [ ] Does each heading name the finding or the contents, and does each caption
      say what the reader sees?
- [ ] Does each caption and paragraph add to its heading, without restating the
      heading or a fact already given in the lede or a caption?
- [ ] Is every claim from the source, and is every gap either marked
      `[DATA NEEDED: ...]` or omitted?
- [ ] Does every process, flow, or figure use only the steps the source states?
      Search the text for verbs the source never uses (stores, retries, caches,
      notifies) and cut or mark each one.

`--check-caption-echo` findings (`scripts/gates.mjs`) are evidence for the
"adds to its heading" box. Check each one against that box and fix the text. Do
not dismiss a finding as a false positive without naming the new fact the caption
adds.

Run vpk-explain's advisory checker on substantial saved prose:
`python3 .agents/skills/vpk-explain/scripts/writing-check.py <file>`. Save the
visible text as plain text or Markdown first, because it does not read HTML.
Review its findings against meaning. A clean report does not prove clarity.

Resumes also follow [resume writing](resume-writing.md). Banned content patterns
are in [anti-patterns](anti-patterns.md).
