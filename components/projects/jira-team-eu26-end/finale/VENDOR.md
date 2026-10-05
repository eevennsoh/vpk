# Rovo Stage Kit integration notes

- Upstream: the Rovo stage lab in Rovo Desktop, packaged by
  `libs/features/welcome/scripts/stage-kit.mjs` (Rovo Desktop repo).
- Release: kit `1.0.0`, built 2026-10-05. Its stage file was exported
  2026-10-05T07:35:14Z and names kit `1.0.0`.
- Status: **vendored built output, not source.** The kit lives whole and
  unedited in `public/1p/rovo-stage-kit/`. VPK owns only the adapter:
  `lib/finale-wall-pieces.ts` (loader, layout, timing) and
  `components/finale-wall-pieces.tsx` (the frame and the wall's tiles).
- Licence: internal Atlassian material (Atlassian Sans and Mono, and images
  under Atlassian's licences, inside the bundle). Publishing it in this repo is
  an accepted decision.

## Which copy this is

Only one build of the runtime exists: the one exported from Rovo Desktop on
2026-10-05. That checkout is not on this machine, so the kit can't be rebuilt
from source here. Every copy of `dist/` found was that build, byte for byte.
It agrees with the catalogue and stage file beside it: all 68 pieces in
`pieces.json` are in the bundle, and so is every piece the wall places.

| File | SHA-256 |
| --- | --- |
| `dist/rovo-stage.js` | `569713d924b3951c0d37ab7654293c7e351e9bdd27a6fef7b7fd60a98ac048df` |
| `dist/react/index.js` | `2b82aadd9d8ebdc3db98f28ccc6c6526c03d03b04474bbaebee286e1ca1bf185` |
| `rovo-stage.json` | `60b41ba3eb8f6a938cea2d2e592d1c04b8ea0bdd07e4bcea6fb690093a6983fe` |

## Why it lives in `public/`

The finale runs the kit in a same-origin frame (the kit guide's integration
A). VPK sets its own Atlaskit theme and Tailwind's preflight styles bare
elements, and the kit writes design tokens onto its document. A frame needs
the kit served as static files, and `public/1p/` is where VPK keeps
first-party assets. One copy in one place means an update is a straight
replacement, which the kit asks for: never edit, re-minify or split `dist/`.

These alternatives were weighed and rejected for now:

- **`vendor/` plus a copied runtime in `public/`.** This would stop the docs,
  examples, reference frames and React build being served, but it needs a sync
  step and a drift check. Revisit it with the size work below.
- **An npm dependency.** Nothing is published, and a package in
  `node_modules` can't give the frame a URL. If Rovo Desktop publishes the kit
  (to `atlassian-npm`, like `@atlassian/logo-third-party`), import it instead,
  following `.agents/docs/playbooks/adopt-upstream-runtime.md`, and copy just
  the runtime into `public/`.
- **Rebuilding pieces in VPK.** The kit's first rule forbids it: hand-made
  copies drift from the lab's design.

## What VPK uses

| Kit file | Used by | How |
| --- | --- | --- |
| `dist/rovo-stage.js` | `lib/finale-wall-pieces.ts` | Imported as a module in the frame; draws every `<rovo-piece>` |
| `rovo-stage.json` | `lib/finale-wall-pieces.ts` | Fetched in the frame; checked with `stageInfo`; supplies `pieceStyles` |
| `pieces.json` | `lib/finale-wall-pieces.test.js` | Each wall piece's id and box |
| `types/stage-file.d.ts` | the adapter | Types, via `@/public/1p/rovo-stage-kit/types/stage-file` |

The rest ships with the kit and VPK doesn't load it: the React build, the
guide and prompt, the examples, the reference frames, and the schema. The
kit's own pages are served too: `/1p/rovo-stage-kit/pieces.html` plays every
piece and `/1p/rovo-stage-kit/stage.html` plays the stage. Both are handy for
checking a piece outside the finale.

The kit is exempt from the repo's usual rules: `.gitignore` re-includes its
`dist/` (the repo ignores `dist/` everywhere else), `tsconfig.json` and
`eslint.config.mjs` skip the folder, and `scripts/verify-file-size-budget.js`
treats it as vendored.

## Updating

- **The stage changed** (composition, styles): export it again from the lab
  (Lab panel → Stage kit → Export stage JSON, or the composer's Export stage)
  and replace `rovo-stage.json`. Nothing else changes.
- **The pieces changed** (a newer kit): replace the whole folder with the new
  kit, never part of it. Then check that `git status` lists `dist/`, and update
  the release and fingerprints above.

Then run the finale's tests and look at the wall in the browser:

```bash
node --test components/projects/jira-team-eu26-end/finale/lib/finale-wall-pieces.test.js components/projects/jira-team-eu26-end/finale/components/finale-wall-pieces.behavior.test.js
```

`finale-wall-pieces.test.js` fails in each of these cases:

- every file the kit's `package.json` names isn't in the folder;
- the README names a different release;
- a newer kit wrote the stage file than the kit vendored here;
- a wall tile names a piece this kit doesn't draw.

## Known limitations

- **Size.** `dist/rovo-stage.js` is 4.6 MB (2.2 MB gzipped) and the unused
  React build adds 4.4 MB to the deploy. Shrinking them is planned for once the
  wall looks right. Start by not serving the React build and dev-only files,
  then ask upstream for a slimmer build. Don't re-minify `dist/` here.
- **One appearance per page.** The frame is light only; the wall never follows
  the product theme.
- **A missing kit leaves blank tiles.** If the frame can't load the kit, the
  wall's product tiles stay as grey cards and the console warns. The tests
  above catch it before it ships.
