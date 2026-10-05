# Prompt for the integrating agent

Copy everything below the line into the other codebase's coding agent. First fill in the two `«…»` blanks, and put the kit folder at the path you name.

---

You're integrating the **Rovo Stage Kit 1.0.0** into this codebase. The kit is at `«path, e.g. vendor/rovo-stage-kit»`.

**Goal:** «where and how the stage should appear, e.g. "the hero of /launch, full width above the fold, playing; paused off screen; the poster frame for reduced motion"».

**Before you write any code:**

1. Read `«path»/GUIDE.md` from start to end. It is the contract: integrations, sizing, time, the stage file, isolation, and how to check your work.
2. Look at `«path»/rovo-stage.json`, `pieces.json` and `examples/`. Note this stage's size (1600 × 900 points) and loop (46.45 s).
3. Check this codebase for:
    - its framework and React version;
    - whether it uses Atlaskit or Atlassian design tokens;
    - global CSS that targets bare elements;
    - its Content Security Policy;
    - SSR.

   Then pick an integration (A iframe, B web component, C React 18, D headless capture) by the table in GUIDE.md, "Choose an integration". Say which one you picked and why before going on.

**Rules:**

- Draw the stage and its pieces **only** through the kit.
    - Don't re-implement, restyle, re-time or recolour anything.
    - Don't edit `dist/`.
    - Don't hand-edit `rovo-stage.json`.
- Keep the kit as one folder, so a newer kit or stage file can replace it whole.
- Load the stage file as data, imported or fetched. Don't paste its contents into code.
- Hold one appearance (light or dark) per page.
- Use the iframe if the page has its own Atlaskit theme.
- Pause it off screen, show the poster frame for `prefers-reduced-motion`, and keep it client-side only under SSR.

**Done means all of these:**

- It renders at the agreed place without distortion, at the board's ratio, in Atlassian Sans, with pieces moving.
- No console errors, and the page's own styles and theme are unchanged around it.
- You checked parity against `reference/` as GUIDE.md, "Check your work", describes:
    - the same viewport and scale, a fresh page per frame;
    - under 0.1 % of pixels differing by more than 8/255.

  Report the numbers you got.
- Updating is a file swap. Document in this repo where the kit lives, and that a new stage arrives as a new `rovo-stage.json` exported from the Rovo stage lab.
