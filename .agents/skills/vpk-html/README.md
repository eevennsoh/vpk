# vpk-html

<!-- vpk-html-catalog-counts: templates=35 diagrams=61 demos=133 -->

Offline, single-file HTML documents for the VPK monorepo, including two-column story explainers whose figure scrubs with the text (repo-only: the story kit lives in `artifacts/vpk-html/eu26-animation-explained/`). **[See the index →](index.html)** Agents start at [SKILL.md](SKILL.md), whose hard rules set the look.

vpk-html uses [kami’s](https://github.com/tw93/Kami) template-edit architecture: copy an HTML template, fill its `{{placeholders}}` with real content, and ship one self-contained file.

## What you get

- **35 document templates** at `assets/templates/`: 15 general shells plus 20 engineering shells patterned after [ThariqS/html-effectiveness](https://github.com/ThariqS/html-effectiveness).
- **61 SVG diagram/chart primitives** at `assets/diagrams/`, to embed inside any template.
- **12 technical illustration exemplars** at `assets/illustrations/`: five hand-drawn SVGs and seven iso-kit figures built from JSON briefs. `assets/demos/demo-illustration-gallery.html` gathers them; the hairline, anatomy, anatomy WebGL and teardown galleries are separate demos.
- **133 HTML demos** at `assets/demos/`, counted as top-level `.html` files (the `media/` folder holds their assets).
- **A story-explainer kit** (Page, Slides, X Threads, Video) copied from the reference artifact per [story modes](references/story-modes.md).
- **Figure engines**: the iso kit, the anatomy hero, hairline and anatomy-gl ([figure engines](references/figure-engines.md)).
- **Contract and content IR**: `<slug>.content.json`, checked by `build.mjs --check-content` (schemas in `references/schemas/`), and per-template playbooks in `references/playbooks/`.
- **A review loop**, a motion case study with captured film and labs, an X thread composer, and PDF, landing, MP4 and publishing tracks.
- **Evals** in `evals/`: frozen task scenarios, trigger queries, a rubric and a critic brief ([evals](evals/README.md)).

## Invoking the skill

Name the skill in Claude Code, Codex or Cursor: `/vpk-html resume`, `/vpk-html one-pager`. Add `--github` to go live on GitHub Pages; [publish](references/publish.md) owns every publishing track. [CHEATSHEET](CHEATSHEET.md) maps intent to template and diagram.

## Quick start

```bash
mkdir -p artifacts/vpk-html/my-doc
# write the contract and content IR first: references/contract.md
node .agents/skills/vpk-html/scripts/build.mjs --check-content artifacts/vpk-html/my-doc/my-doc.content.json
cp .agents/skills/vpk-html/assets/templates/one-pager.html artifacts/vpk-html/my-doc/my-doc.html
# replace every double-brace placeholder; leave the CSS alone
node .agents/skills/vpk-html/scripts/build.mjs --check-placeholders artifacts/vpk-html/my-doc/my-doc.html
node .agents/skills/vpk-html/scripts/build.mjs --verify artifacts/vpk-html/my-doc/my-doc.html
```

Each artifact keeps its HTML, sidecar, PDFs and captures in `artifacts/vpk-html/<slug>/`.

## Commands

`build.mjs --help` lists every command and flag; run `--doctor` when the environment fails.

## Directory map

| Path | Purpose |
|---|---|
| `SKILL.md`, `CHEATSHEET.md`, `llms.txt` | Agent router, intent lookup, machine index |
| `index.html` | Demo catalog |
| `assets/templates/`, `assets/diagrams/`, `assets/illustrations/`, `assets/demos/` | The catalog counted above |
| `assets/html-effectiveness/`, `assets/fonts/`, `assets/video/` | Upstream snapshot, Geist fonts, the MP4 worked example |
| `styles.css`, `references/tokens.json` | Shared stylesheet and its token source |
| `references/` | One owner per topic; [SKILL.md § Read when](SKILL.md#read-when) says when to load each |
| `evals/` | Scenarios, triggers, rubric, critic brief |
| `scripts/` | Build, checks, runtime, and the `iso/`, `anatomy/`, `anatomy-gl/`, `hairline/`, `figures/`, `lab/`, `media/`, `review/`, `x-thread/`, `code/` kits |

## License

Inherits the VPK monorepo license. The 8 base templates and the original 14 diagram primitives are ported from [tw93/kami](https://github.com/tw93/Kami) (MIT) and re-skinned; their layout structure and SVG geometry are kami’s work. The 20 engineering templates and later chart additions are original vpk-html work. See [LICENSE](LICENSE) for vendored code.

## Acknowledgements

- Kami by [@tw93](https://github.com/tw93): template architecture, diagram primitives, demo curation.
- html-effectiveness by [@ThariqS](https://github.com/ThariqS): the engineering use-case catalog.
- lavish-axi by Kun Chen (MIT): revision registry, “reveal changes” and the `cssPathFor` selector behind review anchors.
- html-plan by Thariq Shihipar (MIT): comment, decision and seen-tracking ideas and the data-not-instructions wording.
- anatomy by wheresryan22 (MIT): hero kit, audit and line check, vendored at `scripts/anatomy/vendor/`.
- twitter/twitter-text (Apache-2.0): counting rules, TLD data and conformance vectors, ported in `scripts/x-thread/`.
- sugar-high (MIT): build-time code highlighting, vendored in `scripts/code/`.
- Geist and Geist Mono fonts are committed locally for offline use.
