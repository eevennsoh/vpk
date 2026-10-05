# Rovo Stage Kit 1.0.0

The Rovo stage, the wall of animated product pieces from Rovo Desktop's stage lab, packaged so another codebase can draw it exactly as the lab's composer shows it.

- `rovo-stage.json`: the stage (exported from the lab).
- `dist/`: the code that draws it.
    - `rovo-stage.js` is a self-contained web component.
    - `react/index.js` is for React 18 apps.
- `GUIDE.md`: the integration guide.
- `PROMPT.md`: the prompt to hand the other codebase's coding agent.

## Hand it to an agent

1. Copy this folder into the other repository, for example `vendor/rovo-stage-kit/`.
2. Open `PROMPT.md`, fill in the two blanks (where the stage goes, how it's used) and paste it into the agent.

## Try it

```sh
npx serve .            # or: python3 -m http.server
```

Then open these pages:

- `/stage.html`: the stage, fitted to the window.
- `/stage.html?t=12`: held on second 12.
- `/stage.html?curtain=2`: opening on the keynote curtain.
- `/pieces.html`: every piece.

## Update the stage

In the lab, use **Stage kit → Export stage JSON** in the Lab panel, or **Export stage** in the composer. Then replace `rovo-stage.json`; no code changes.

## Notes

- Internal to Atlassian. It carries Atlassian Sans and Mono, and images used in the stage under Atlassian's licences. Don't publish it outside Atlassian.
- Built 2026-10-05 from Rovo Desktop (`libs/features/welcome/scripts/stage-kit.mjs`).
