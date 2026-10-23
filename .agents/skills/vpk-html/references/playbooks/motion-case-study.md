---
template: motion-case-study.html
demo: demo-motion-case-study.html
schema: motion-case-study
evals: [motion-case-study-film-labs]
figure_engines: [none, iso-kit, anatomy-hero, both]
---

# motion-case-study playbook

Format and checker: [contract](../contract.md#playbooks). Kit, markup and labs: [lab kit](../lab-kit.md). Capture,
encode, embed and the lite copy: [media pipeline](../media-pipeline.md).

## Use when

- A shipped animation, interaction or film needs a retrospective the reader can check frame by frame: what is on
  screen, when, and why.
- There is a film of the work: a supplied recording, or a page that can be captured through its own clock.
- The maths behind the motion (easing, springs, clocks, simulations) is part of the story and can run in a lab.

## Choose

- `prototype-animation.html` when the motion is a spec for something not yet built, with no film to study.
- `feature-essay.html` when the story is prose and static figures, with no film or interactive maths.
- `research-concept-explainer.html` when the reader needs a concept explained, not a shipped piece of work audited.
- `slides.html` when the case study is presented live; keep this document as the reference behind the talk.

## Structure

- Opening: eyebrow, a headline that names the moment, a dek, a byline that says when and from which sources it was
  written, and a fact strip of at most four numbers the reader can find again in the film.
- Film (00 · Watch it first): the film panel, a lede on how it was captured, chapters for the acts.
- Brief: the problem in the asker's words and a ledger of the questions, each pointing at the section that answers.
- Process: the timeline region, filterable by theme; one row per day, one event per decision.
- Run of show: the Gantt of the clock, then the cue sheet. Every cue is a time on the film's clock.
- Labs: one section per lab, each with its `[data-vpk-lab-source]` line and a note on what to try.
- Engineering: decisions as ledger rows, the layer stack, then the figure slot.
- Discards: the ideas that lost, each with why and where that came from.
- Credits: people with their roles, the sources, and the film provenance line that embed fills.

## Figures

- Lab canvases, the Gantt and the layer stack are grayscale figures: `vpkLab.tokens` and one focal only.
- Static mechanism figures go in the `engineering` figure slot through the shared engine question: `iso-kit` for
  diagrams, `anatomy-hero` for one hero, `both` when the document needs each. Never an Epic tier.
- The film is footage, not illustration; it keeps its own colour.

## Contract

- Film source: a supplied MP4 path, or a capture (URL, hold hook or screencast driver, fps, viewport, segments).
- Budget: full only, or full plus the automatic lite copy (default). Record which in the contract.
- Labs: id, kind (`time` or `simulation`), title, and the source file:lines of the maths each one ports.
- Record cues with `t_s` on the clock segment, not hand-converted film times, so a re-capture cannot shift them.
  The captured segment's id must equal `film.clock_id` (default `clock`). `capture.mjs --url` names its segment
  `clock` unless you pass `--segment-id`, and `embed.mjs` refuses a film whose data lacks the cues' clock.
- Content IR: `<slug>.content.json` with `type: "motion-case-study"`; render the regions from it.

## Pitfalls

- Embedding a film by hand. Use `embed.mjs`, which fences inputs, writes film data and provenance, and keeps
  review ids.
- A film over the data-URL budget without a lite copy, or a lite copy the reader is never told about.
- `autoplay`, or a film without `muted` and `playsinline`.
- Cue times off the film clock: a cue that lands a frame early names the wrong beat. Check every cue by clicking it
  and looking at the picture, not only the beat panel. A renderer can hold the outgoing scene on the frame at the
  cut: if the frame at a cut's time still shows the previous scene, put the cue on the new scene's first frame
  (t + 1/fps).
- Labs with invented maths. Each lab ports real code and says where from; if it cannot, it is an illustration.
- Hue on lab canvases. Product colour needs the declared swatch exception and an `explicit_deviations` entry.
- Editing inside a region by hand. Change `<slug>.content.json` and re-render, or the next render undoes it.
- Narration in an audio track. Films carry no audio; put the narration in the cue text.
