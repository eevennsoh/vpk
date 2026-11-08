# Verification

Owner of how you prove a vpk-html artifact for [SKILL.md](../SKILL.md). Load when you validate a figure (Phase E), port a production video or its source, or hear “too detailed”, “too dark” or “not true to production”.

Contents: 1 Order · 2 Reference frames · 3 Your frames · 4 Dark theme · 5 Error filter · 6 Wheel scroll · 7 Time sweeps · 8 Baselines · 9 Show frames · 10 Complaints

## 1. Prove the work in this order

```
1 reference frames on disk, before you draw; show them with your plan     § 2  (no reference: skip; page sheets still pair light and dark)
2 --verify + check-html, Error-filtered                                     § 5
3 figure beside reference, crops, 0.1 s strips; a page sheet per touched mode; light and dark   § 3-4
4 wheel-scroll test to the end of the page; time-sweep invariants          § 6-7
5 show the sheets, then stop and wait for the user’s call                  § 9
```

## 2. Extract reference frames before you draw

| Wrong | Right |
| --- | --- |
| Draw from memory and compare at the end | Extract reference frames first and show them with your plan |
| One thumbnail frame per chapter | A 0.1 s strip across each move, so timing and arcs show, and one surface cropped at native scale (§ 3) |

```sh
REF=reference.mp4; OUT=output/vpk-html/<slug>/frames/ref; mkdir -p "$OUT"
for t in 02 13 27; do ffmpeg -v error -ss "$t" -i "$REF" -frames:v 1 "$OUT/t$t.png"; done  # zero-padded: sheets sort in time order
ffmpeg -v error -ss 22 -t 1 -i "$REF" -vf "fps=10,scale=320:-2,tile=10x1" -frames:v 1 "$OUT/strip-22s.png"  # 0.1 s strip
```

The tell: you can’t name the reference timestamp a shape came from. The video decides what appears and the source supplies the numbers ([figure motion § Match the production video first](figure-motion.md#match-the-production-video-first)). Use Homebrew `ffmpeg`; Playwright’s bundled ffmpeg has no `fps` or `tile` filter. Evidence lives under `output/vpk-html/<slug>/`, never inside `artifacts/`.

## 3. Capture your frames at the reference times

Run headless Playwright outside the sandbox: inside it Chromium dies with an AppKit SIGTRAP, and a hidden desktop Browser pane throttles `requestAnimationFrame` to about 1 Hz. Save as `output/vpk-html/<slug>/capture.mjs` and run it from the repository root.

```js
import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";

const FILE = "artifacts/vpk-html/<slug>/<slug>.html";
const OUT = "output/vpk-html/<slug>/frames/ours";
const MODES = ["page", "carousel", "lifeline", "theater"]; // the unrenamed EU26 kit uses story, slides, twitter, video
const TIMES = ["02", "13", "27"]; // the § 2 times
const VIEWPORTS = [[1440, 900], [390, 844]]; // 2 columns from 1024 px, stacked below
const painted = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

const browser = await chromium.launch();
for (const [width, height] of VIEWPORTS) {
	for (const theme of ["light", "dark"]) {
		const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme });
		await context.addInitScript(value => localStorage.setItem("vpk-html-theme", value), theme);
		const page = await context.newPage();
		page.on("pageerror", error => console.log(`pageerror ${theme} Error: ${error.message}`));
		await page.goto(pathToFileURL(FILE).href);
		for (const mode of MODES) {
			for (const t of TIMES) {
				await page.evaluate(([m, s]) => {
					window.__vpkStory.setMode(m);
					if (document.querySelector('[data-vpk-story]').dataset.storyMode !== m) throw new Error(`mode ${m} did not apply`);
					window.__eu26Explorer.seek(s); // EU26 hook: call your figure’s seek
				}, [mode, Number(t)]);
				await page.evaluate(painted);
				await page.screenshot({ path: `${OUT}/page-${mode}-w${width}-${theme}-t${t}.png` });
				if (mode === "page" && width === 1440) {
					const figure = page.locator('[data-vpk-figure="eu26-hero"]');
					await figure.screenshot({ path: `${OUT}/fig-${theme}-t${t}.png` });
				}
			}
		}
		await context.close();
	}
}
await browser.close();
```

Build the contact sheets next. Pick one surface’s rectangle once on the t02 pair, as fractions of each image, and reuse both at every time. Each sheet row is one theme, light over dark, times left to right.

```sh
cd output/vpk-html/<slug>/frames
CO="crop=iw*.40:ih*.20:iw*.30:ih*.45"   # the surface in ours
CR="crop=iw*.30:ih*.25:iw*.50:ih*.40"   # the same surface in the reference
for th in light dark; do
	for t in 02 13 27; do
		ffmpeg -v error -y -i "ours/fig-$th-t$t.png" -i "ref/t$t.png" \
			-filter_complex "[0]scale=-2:480[a];[1]scale=-2:480[b];[a][b]hstack" "pair-$th-t$t.png"
		ffmpeg -v error -y -i "ours/fig-$th-t$t.png" -i "ref/t$t.png" \
			-filter_complex "[0]$CO,scale=-2:480[a];[1]$CR,scale=-2:480[b];[a][b]hstack" "crop-$th-t$t.png"
	done
done
sheet() {
	for th in light dark; do
		ffmpeg -v error -y -pattern_type glob -i "$1-$th-t*.png" -vf tile=3x1 -frames:v 1 "row-$th.png"
	done
	ffmpeg -v error -y -i row-light.png -i row-dark.png -filter_complex vstack "sheet-$2.png"
}
sheet pair reference
sheet crop crops
for m in page carousel lifeline theater; do
	for w in 1440 390; do sheet "ours/page-$m-w$w" "$m-w$w"; done
done
```

## 4. Check dark theme at the same times

Measure the shading tokens in each theme and compare them with the light and dark rows of [figure fidelity § 3](figure-fidelity.md#3-shading-after-the-reference-video). Run it in `capture.mjs` after `goto`. It reads the green channel, which is exact for neutral ink and paper; for a tinted `--paper`, average the three channels.

```js
console.log(theme, await page.evaluate(() => {
	const svg = document.querySelector('[data-vpk-figure="eu26-hero"] svg.iso-svg');
	const probe = svg.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "rect"));
	const green = value => {
		probe.style.fill = `color-mix(in srgb, ${value} 100%, transparent)`;
		return Number(getComputedStyle(probe).fill.match(/[\d.]+/g)[1]);
	};
	const ink = green("var(--ink)");
	const paper = green("var(--paper)");
	const names = ["top", "shade-3", "shade-2", "shade-1", "shade-0", "hi", "mid", "lo"];
	const percent = n => Math.round(100 * (green(`var(--anatomy-${n})`) - paper) / (ink - paper));
	const out = Object.fromEntries(names.map(n => [n, percent(n)]));
	probe.remove();
	return out;
}));
```

The EU26 figure prints light `top 0, shade-3…0 4 6 7 8, hi mid lo 42 30 20` and dark `10, 7 6 5 4, 44 32 22`. The tell: a dark side measured above the dark top’s 10%, so sides read brighter than tops. In the dark page sheet, every line of text stays legible and thumbnails and snapshots switch with the page ([figure fidelity § 4](figure-fidelity.md#4-copies-outside-the-root-share-the-colour-scope)).

## 5. Filter every command on Error

A straight apostrophe inside a JS string literal ([writing § Keep exactly](writing.md#keep-exactly)) once threw a `SyntaxError` that scrolled past in a green build. `--verify` printed it as `✗ <file>` then `pageerror: Unexpected identifier 's'`, which a bare `grep -n Error` misses, so `F` matches each tool’s failure markers and `run` echoes a non-zero exit. `Error:` keeps its colon and TAP markers are anchored, so a passing test named “throws an Error” stays silent. A green run prints nothing. A `warn` line is an advisory from check-html, such as the data-URL size budget: explain each one under Not verified. Any other printed line is a failure. Prove the filter once: `const s = 'it's';` in a page must print the `✗`, `pageerror` and `FAIL exit 1` lines.

```sh
FILE=artifacts/vpk-html/<slug>/<slug>.html
F='^not ok|^ℹ fail [1-9]|^✖|^✗|^- |(Syntax|Reference|Type)?Error:|pageerror|did not load|failed request|^FAIL exit|^warn '
run() { { "$@" 2>&1 || echo "FAIL exit $?"; } | grep -n -E "$F" || true; }
run node .agents/skills/vpk-html/scripts/build.mjs --verify "$FILE"
run node .agents/skills/vpk-html/scripts/check-html.mjs "$FILE"
run node --test <suites>
```

## 6. Scroll to the end with the wheel, not `seek()`

Scroll-driven figures clamp time at the last chapter; the EU26 endless wall froze there, and every `seek()` test still passed. The tell: the behaviour suite never calls `mouse.wheel` or scrolls the page. For a figure with an idle clock, also assert the timeline holds while render time advances ([figure motion § An idle clock](figure-motion.md#an-idle-clock-runs-on-top-of-scrolled-time)).

```js
const stage = '[data-vpk-figure="eu26-hero"] svg.iso-svg'; // the live stage, not a thumbnail
const atEnd = () => page.evaluate(() => innerHeight + scrollY >= document.documentElement.scrollHeight - 1);
await page.mouse.move(720, 450);
for (let step = 0; step < 400 && !(await atEnd()); step++) {
	await page.mouse.wheel(0, 600);
}
const frame = () => page.evaluate(selector => document.querySelector(selector).innerHTML, stage);
const before = await frame();
await page.waitForTimeout(2000);
if ((await frame()) === before) throw new Error("figure stopped moving at the end of the page");
```

## 7. Sweep time for invariants

Motion is a pure function of time, so sweep the model in Node at 0.05 s and assert what must always hold. Save as `output/vpk-html/<slug>/sweep.mjs`; the import resolves from there. The example is the EU26 wall invariant, so swap its constants before you run it:

| Constant | EU26 value | Substitute |
| --- | --- | --- |
| `HERO` | `eu26-animation-explained/_figures/eu26-hero.hero.mjs` | `<slug>/_figures/<your hero module>`, the module the build points at |
| `START`, `END` | `27`, `130` s | the first and last second of the chapters your invariant covers; `0` to `data.duration` sweeps the whole figure |
| `variant` | `"paper"` | a variant your hero’s `data.variants` lists |
| the loop body | wall cards airborne only while a cursor carries them | the property your figure must always hold, written against your model’s state |
| the chapter, transition and even times below | EU26 chapter times, `14.1`, `14.15`, `20.4` | your steps’ `time` values, the instants either side of each hand-off, and 36 even times |
| `window.__eu26Explorer`, `[data-vpk-figure="eu26-hero"]` | the EU26 explorer and hero | your explorer global and hero selector |

```js
import assert from "node:assert/strict";

const HERO = "eu26-animation-explained/_figures/eu26-hero.hero.mjs"; // swap: your hero module
const START = 27, END = 130; // swap: the window your invariant covers, in seconds
const { data, model } = await import(new URL(`../../../artifacts/vpk-html/${HERO}`, import.meta.url));
let airborneSamples = 0;
for (let k = 0; k <= Math.round((END - START) / 0.05); k++) {
	const time = START + k * 0.05;
	const state = model({ time, variant: "paper" }, data);
	state.wall.forEach((card, index) => {
		const airborne = card.alpha > .02 && card.at[2] > 1e-3; // off the wall plane, so not riding the wall scroll
		const carried = state.cursors.some(c => c.heldTarget?.kind === "wall" && c.heldTarget.index === index);
		if (airborne) airborneSamples++;
		assert.ok(!airborne || carried, `wall card ${index} is in the air with no cursor at ${time.toFixed(2)} s`);
	});
}
console.log(`${airborneSamples} airborne samples, 0 uncarried`);
```

Test the property, not raw position: the EU26 wall scrolls every card, so “position changed” flags thousands of settled cards. On EU26 the sweep prints a count of airborne samples and 0 uncarried; on your figure, 0 samples where the property’s condition applies means the window or the property is wrong. Depth sorting lives in the renderer, so sample it in the page: chapter times, 36 even times and hand-picked transitions. `seek()` renders synchronously; add this to `capture.mjs`.

```js
const cycles = await page.evaluate(() => {
	const { seek, getState } = window.__eu26Explorer;
	const hero = document.querySelector('[data-vpk-figure="eu26-hero"]');
	const d = getState().duration;
	const chapters = [0, 2, 4, 6, 8, 10, 13, 16, 19, 22, 25, d]; // EU26 chapter times
	const transitions = [14.1, 14.15, 20.4];
	const even = Array.from({ length: 36 }, (_, i) => d * (i + 1) / 37);
	return [...chapters, ...transitions, ...even].filter(t => {
		seek(t);
		return hero.dataset.heroDepthCycles !== "0";
	});
});
if (cycles.length) throw new Error(`depth-sort cycles at ${cycles.join(", ")} s`);
```

## 8. Keep test baselines honest

```sh
cd output/vpk-html/<slug>
node --test <suites> > baseline.txt 2>&1   # before your edit: these failures are not yours
node --test <suites> > after.txt 2>&1      # after your edit
fails() { grep -E '^not ok|^✖' "$1" | sed -E 's/ \([0-9.]+m?s\)$//' | sort -u; }
diff <(fails baseline.txt) <(fails after.txt)   # every > line is yours to fix
node --test --test-concurrency=1 <file>   # run a long real-time suite alone: a failure that also fails alone is real
```

| Wrong: widen the assertion until it passes | Right: behaviour changed on purpose, so assert the new behaviour |
| --- | --- |
| The idle wall clock breaks `near(renderTime, stateTime)`, so the test drops the time check | Wall chapters settle at or after their time: `stateTime >= 27 && renderTime >= stateTime` |

## 9. Show frames before you claim done

**Stop.** Show each mode’s sheet and the 0.1 s strip of every move you changed, then wait for the user’s call. Done means `frames/` holds `sheet-reference.png` and `sheet-crops.png` when a reference exists, plus `sheet-<mode>-w1440.png` and `sheet-<mode>-w390.png` for every touched mode, each in light and dark at the 3 reference times or, with no reference, 3 chapter starts, you looked at each pair at 1× and at a crop, and every check you report ran in this session. If the user says they will verify it, or `VPK_VERIFY=manual` is set, stop browser checks and report NOT VERIFIED with each skipped step. Without rendered frames in both themes at both widths, close with “build verified, visuals unconfirmed” plus each skipped step, never “done”.

Verdict words: VERIFIED when the user saw every sheet above; NOT VERIFIED when the build passed but visuals are unconfirmed, including a user or `VPK_VERIFY=manual` opt-out; INCONCLUSIVE when a check could not run.

| Wrong | Right |
| --- | --- |
| “Done, all checks pass.” | “Sheets at `output/vpk-html/<slug>/frames/sheet-*.png`; strips for the 22 s move; waiting for your call.” |

The tell: a done claim with no frame path in it.

## 10. Map each user complaint to its cause

| User says | Cause | Fix in its owner (the tells are indexed in [anti-patterns § 7](anti-patterns.md#7-figure-failures-the-corrections-users-have-had-to-make)) | Add the check |
| --- | --- | --- | --- |
| “too detailed” or “empty”, “just boxes” | Drew the UI from source, or stripped it, with no reference crop to count against | [figure fidelity § 1](figure-fidelity.md#1-container-outlines-on-opaque-surfaces), [§ 2](figure-fidelity.md#2-no-text-in-product-ui-scenes-except-named-exceptions) | crop beside reference |
| “too dark” or “washed out” | Guessed shading and hairlines; checked one theme only | [figure fidelity § 3](figure-fidelity.md#3-shading-after-the-reference-video) | dark and light pair |
| “not true to production” | Drew from source or memory, not from frames | [figure motion § Match the production video first](figure-motion.md#match-the-production-video-first) | 0.1 s strip of the move |
| “never show floating cards” | Moved an object without its carrier | [figure motion § A named cursor carries every arrival](figure-motion.md#a-named-cursor-carries-every-arrival) | § 7 sweep |
| “it stops at the end” | Scrolled time clamps with no idle clock | [figure motion § An idle clock](figure-motion.md#an-idle-clock-runs-on-top-of-scrolled-time) | § 6 wheel test |
