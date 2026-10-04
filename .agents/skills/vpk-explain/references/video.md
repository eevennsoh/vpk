# Requested explainer video

A video request authorizes producing a real video artifact through the
available production workflow. Complete source creation, rendering, and
review; do not stop at a script, prompt, storyboard, or slideshow unless that
is the user's requested deliverable. Narration is optional.

## Select the production owner

Discover the installed skills by name through the current skill catalog;
do not assume a developer-specific absolute path. Load the `hyperframes`
entrypoint before video creation. It owns project-state handling, workflow
selection, dependency setup, rendering, and production checks.

- For a fresh general topic, article, or notes explainer, the usual workflow
  is `faceless-explainer`.
- For a GitHub PR/code change explainer from a PR reference, use `pr-to-video`.
- For longer or custom sequences outside those contracts, use `general-video`.
- When the user explicitly chooses Manim, load `manim-video` and follow its
  setup, scene, render, and review workflow. Manim suits geometric intuition,
  equations, and algorithm visualization. A 3Blue1Brown-style request alone
  does not silently override HyperFrames' default framework.

These are routing hints; read the selected owner's current contract rather
than recreating a pipeline from this reference. Load only the needed media,
animation, and rendering references. Do not assume that an installed skill
means its renderer or audio dependencies are already installed.

## Carry the teaching brief forward

Preserve the audience, learning outcome, evidence, concrete example,
misconception, and analogy limits from `vpk-explain`. Infer unspecified
production choices where the owning workflow permits; use its required
intake/review steps without re-asking questions already answered.

For a fresh project, record those teaching choices in the owner's brief or
plan, together with medium/framework, approximate duration, aspect ratio,
narration choice, sources, and requested outputs. Do not manufacture an
existing brief to bypass required intake. For an existing project, preserve
its recorded choices and edit the requested explanation in place.

For a short standalone concept, 30–90 seconds at 16:9 is a useful starting
point, not a fixed requirement. Give a dense idea enough time or narrow its
scope explicitly; do not accelerate speech to fit arbitrary timing. Show one
conceptual change at a time. Keep objects and labels stable across scenes;
allow time to absorb a key reveal. On-screen text should support the visual
argument rather than duplicate a paragraph of narration.

## Narration and accessibility

If the user requests narration, use their named or configured provider through
the production workflow's media/audio capability. ElevenLabs is supported
when authorized credentials and the capability are available; read keys from
the environment or credential mechanism without printing or embedding them.
Do not require ElevenLabs for every video or switch to a different paid
provider without authorization.

If requested narration cannot run, check available local/free TTS through the
owning workflow. Local options such as Qwen3-TTS still have model-download,
hardware, and setup requirements; verify feasibility before promising them.
Complete independent visuals while resolving audio. If no suitable narration
path is available, report the blocker and preserve the renderable source;
do not silently present a silent video as the requested narrated result.

For narrated output, supply synchronized captions and a readable transcript.
For silent output, provide enough on-screen text to explain the mechanism
and a companion text explanation. Meaning must not depend on audio or color
alone. Preserve player pause/seek controls where a player is supplied.

## Render, review, and deliver

Use `artifacts/vpk-explain/<slug>/` as the project/deliverable root, unless
continuing an existing user-specified project. Retain the editable composition
or Manim script, brief/plan, required local media, final MP4, and captions/text
companions. Keep disposable browser captures in `output/agent-browser/`.

Run the selected workflow's actual lint/check/render commands. Inspect
representative frames at teaching transitions and watch/listen to the video
for timing, legibility, factual consistency, clipping, caption sync, and
the worked example's correctness. Check that the output plays and has the
intended duration, dimensions, and audio when requested.

Return the playable MP4 with an absolute local link or embed and links to
important companions. Mark a failed render as blocked or draft, name the
concrete failing dependency/command, and retain useful sources. Do not replace
a requested MP4 with HTML or claim production verification from a storyboard.
Publishing requires an explicit publishing request.
