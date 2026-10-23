// lab/kit.mjs: the built block, injection into a docnav document, idempotency, literal replacement, forbidden text,
// bundling rules, line targets, the registry adapter and side-effect-free imports (ws4a-labs.md §9 kit.test).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import { validateHtmlString } from "../check-html.mjs";
import { labKitStep } from "../runtime/lab.mjs";
import {
	LAB_MARKERS, LAB_RUNTIME_FILES, LAB_SCOPE, buildLabBlock, buildLabCss, buildLabRuntimeSource, checkLabHtml,
	collectDuplicateCueIssues, collectFilmClockIssues, collectLabMarkupIssues, extractLabBlock, hasLabBlock, injectLabKit, refreshLabKit,
	stripLineComments, stripModule,
} from "./kit.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS = path.join(here, "..");
const SKILL = path.join(SCRIPTS, "..");
const ESSAY = fs.readFileSync(path.join(SKILL, "assets", "templates", "feature-essay.html"), "utf8");
const count = (text, needle) => text.split(needle).length - 1;
const block = buildLabBlock();
const css = buildLabCss();
const js = buildLabRuntimeSource();

test("injecting into a copy of feature-essay.html: one block before the single </body>, docnav untouched, scripts parse, check-html ok", () => {
	const out = injectLabKit(ESSAY);
	assert.equal(count(out, LAB_MARKERS.start), 1);
	assert.equal(count(out, LAB_MARKERS.end), 1);
	assert.equal(count(out.toLowerCase(), "</body>"), 1);
	assert.ok(out.indexOf(LAB_MARKERS.end) < out.toLowerCase().lastIndexOf("</body>"), "the block sits before </body>");
	assert.ok(count(ESSAY, "</main>") >= 2, "the shell carries a second </main> inside the docnav runtime (V21)");
	const docnav = source => /document\.body\.innerHTML = '<main class="vpk-presenter">[\s\S]*?<\/main>';/.exec(source)?.[0];
	assert.ok(docnav(ESSAY));
	assert.equal(docnav(out), docnav(ESSAY), "the docnav string is byte-identical");
	const classic = [...out.matchAll(/<script(?![^>]*\btype=)[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
	assert.ok(classic.length >= 4);
	for (const source of classic) assert.doesNotThrow(() => new Function(source));
	for (const match of out.matchAll(/<script type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi)) assert.doesNotThrow(() => JSON.parse(match[1]));
	const result = validateHtmlString(out, "feature-essay-with-lab.html");
	assert.deepEqual(result.failures, []);
	assert.equal(result.ok, true);
});

test("the block inlines the shared frame loop (R1): one loop source, no separate loop block", () => {
	assert.match(js, /function createFrameLoop\(/);
	assert.match(js, /function getFrameLoop\(/);
	assert.equal(count(js, "function createFrameLoop("), 1);
	assert.ok(js.indexOf("function createFrameLoop(") < js.indexOf("function clamp("), "frame-loop.mjs is concatenated first");
	assert.equal(LAB_RUNTIME_FILES[0], "../runtime/frame-loop.mjs");
	assert.doesNotMatch(block, /vpk-figure-loop|self\.vpkFigures/);
	assert.match(js, /installLab\(globalThis\);\n\}\)\(\);$/, "the IIFE ends by installing the kit");
	assert.match(js, /^\(\(\) => \{\n"use strict";/);
});

test("idempotent: injecting twice equals once; refresh leaves unmarked documents byte-identical", () => {
	const once = injectLabKit(ESSAY);
	assert.equal(injectLabKit(once), once);
	assert.equal(refreshLabKit(ESSAY), ESSAY);
	assert.equal(refreshLabKit(once), once);
	assert.equal(hasLabBlock(ESSAY), false);
	assert.equal(hasLabBlock(once), true);
	assert.equal(extractLabBlock(once), block);
	assert.deepEqual(checkLabHtml(once), { ok: true, missing: false, stale: false, issues: [] });
	assert.equal(checkLabHtml(ESSAY).missing, true);
});

test("replacement is literal: $& $$ $` $' in stale or new blocks never act as replacement patterns", () => {
	const stale = `<html><body><main>x</main>\n${LAB_MARKERS.start}\nOLD $& $$ $\` $' $1\n${LAB_MARKERS.end}\n</body></html>`;
	const refreshed = refreshLabKit(stale);
	assert.equal(count(refreshed, block), 1);
	assert.doesNotMatch(refreshed, /OLD/);
	assert.equal(checkLabHtml(stale).stale, true);
	const odd = `${LAB_MARKERS.start}\nX $& $$ $\` $' $1 Y\n${LAB_MARKERS.end}`;
	const inserted = injectLabKit("<html><body><main>x</main></body></html>", { block: odd });
	assert.ok(inserted.includes(odd), "a new block is inserted byte for byte");
	assert.ok(refreshLabKit(stale, { block: odd }).includes(odd), "and replaced byte for byte");
});

test("forbidden text (§4.3) never appears in the built style or script", () => {
	const inner = `${css}\n${js}`;
	const rules = [
		[/#[0-9a-f]/i, "a # followed by a hex digit"], [/\b(?:rgba?|hsla?)\(/i, "a colour function"],
		[/<(?:button|svg|input|img|script)\b/i, "a tag"], [/<\/script/i, "a script terminator"], [/<!--|-->/, "a comment marker"],
		[/(^|[^-])ease-in(?!-)/i, "a bare ease-in"], [/\{\{/, "a placeholder"], [/var\(--ds-/, "an ADS token"], [/\.repeat\(/, ".repeat("],
		[/["']#["']/, "a lone # string"], [/\$&|\$`|\$'|\$\$/, "a replacement pattern"],
	];
	for (const [pattern, label] of rules) assert.doesNotMatch(inner, pattern, label);
	assert.equal(count(inner, "`#${"), 1, "exactly one hex template literal (bytesToHex)");
	assert.doesNotMatch(css, /@kit/);
	assert.equal(count(css, LAB_SCOPE), 5, "one scope per nesting context");
	assert.doesNotMatch(css, /(^|[\s,{}])(?:button|input|select|kbd|canvas|svg|video|img|b)\s*[{,:[]/m, "no element selectors");
});

test("bundling: unique top-level names, no import or export survives, other import forms throw", () => {
	const names = [...js.matchAll(/^(?:async )?(?:function\*?|const|let|class) ([A-Za-z_$][\w$]*)/gm)].map(match => match[1]);
	assert.ok(names.length > 60);
	assert.deepEqual(names.filter((name, index) => names.indexOf(name) !== index), []);
	assert.doesNotMatch(js, /^\s*(?:import|export)\b/m);
	assert.throws(() => stripModule('import {\n\ta,\n} from "./x.mjs";\n', "multi.mjs"), /import form/);
	assert.throws(() => stripModule('import x from "./x.mjs";\n', "default.mjs"), /import form/);
	assert.throws(() => stripModule('const m = await import("./x.mjs");\n', "dynamic.mjs"), /import form/);
	assert.throws(() => stripModule("export default 1;\n", "default-export.mjs"), /export/);
	assert.equal(stripModule('import { a } from "../b/c.mjs";\nexport function f() {}\n'), "function f() {}\n");
	assert.equal(stripLineComments("// a\nconst x = 1; // keep\n\t/** doc\n\t */\nconst y = 'http://x';\n"), "const x = 1; // keep\nconst y = 'http://x';\n");
});

test("the K2 lab-step budget recorded in lab-kit.md is the measured block (block, script, frame loop, style, gzip, template, demo)", () => {
	const doc = fs.readFileSync(path.join(SKILL, "references", "lab-kit.md"), "utf8").replace(/\s+/g, " ");
	const record = /measured \d{4}-\d\d-\d\d: ([\d,]+) B \(script ([\d,]+) B including the ([\d,]+) B frame loop, style ([\d,]+) B; ([\d,]+) B gzipped\)\. The template is ([\d,]+) B and the demo ([\d,]+) B/.exec(doc);
	assert.ok(record, "lab-kit.md § Block, size and checks keeps the measured record");
	const [blockB, scriptB, loopB, styleB, gzipB, templateB, demoB] = record.slice(1).map(value => Number(value.replaceAll(",", "")));
	const loop = js.slice(js.indexOf("// frame-loop.mjs\n"), js.indexOf("\n// core.mjs\n"));
	const bytes = text => Buffer.byteLength(text);
	const measured = { block: bytes(block), script: bytes(js), loop: bytes(loop), style: bytes(css) };
	assert.deepEqual(measured, { block: blockB, script: scriptB, loop: loopB, style: styleB }, `re-measure and update lab-kit.md: ${JSON.stringify(measured)}, gzip ${zlib.gzipSync(block).length} B`);
	const near = (actual, recorded, label) => assert.ok(Math.abs(actual - recorded) <= recorded * 0.01, `${label}: ${actual} B measured, ${recorded} B recorded`);
	near(zlib.gzipSync(block).length, gzipB, "gzip");
	near(fs.statSync(path.join(SKILL, "assets", "templates", "motion-case-study.html")).size, templateB, "template");
	near(fs.statSync(path.join(SKILL, "assets", "demos", "demo-motion-case-study.html")).size, demoB, "demo");
});

test("line targets (§5) hold for every kit file", () => {
	const targets = {
		"lab/kit.mjs": 220, "lab/runtime/core.mjs": 260, "lab/runtime/color.mjs": 170, "lab/runtime/loop-adapter.mjs": 80,
		"lab/runtime/frame.mjs": 340, "lab/runtime/film.mjs": 390, "lab/runtime/gantt.mjs": 130, "lab/runtime/widgets.mjs": 150,
		"lab/runtime/index.mjs": 110, "lab/lab.css": 640, "lab/gantt.mjs": 220, "lab/render-case-study.mjs": 260,
		"lab/build-template.mjs": 160, "lab/build-demo.mjs": 180, "runtime/lab.mjs": 30,
		// Recorded deviation (P4): runtime/gantt.mjs is 130, not 120, for the click snap to cues and marks and the held
		// logical clock (items 16 and 17).
		// The media pipeline (§5): capture 400, capture-clock 140, ffconcat 100, presets 190, encode 200, embed 400, fence 70,
		// and size-budget's +40 over the 81 lines WS0 created. Recorded deviation (P3): capture.mjs sheds its browser half
		// to capture-run.mjs (140) to make room for the virtual segment, and capture-clock.mjs holds the virtual clock,
		// the cursor overlay, glide and their wiring (195 instead of 140).
		"media/capture.mjs": 400, "media/capture-run.mjs": 140, "media/capture-clock.mjs": 195, "media/ffconcat.mjs": 100, "media/presets.mjs": 190,
		"media/encode.mjs": 200, "media/embed.mjs": 400, "media/fence.mjs": 70, "media/size-budget.mjs": 121,
	};
	for (const [file, max] of Object.entries(targets)) {
		const lines = fs.readFileSync(path.join(SCRIPTS, file), "utf8").split("\n").length - 1;
		assert.ok(lines <= max, `${file} has ${lines} lines (target ${max})`);
	}
});

test("labKitStep refreshes existing blocks only (registry slot lab, kinds template/demo/artifact)", () => {
	assert.equal(labKitStep.id, "lab");
	assert.deepEqual([...labKitStep.kinds], ["template", "demo", "artifact"]);
	assert.equal(labKitStep.apply(ESSAY), ESSAY);
	const stale = injectLabKit(ESSAY, { block: `${LAB_MARKERS.start}\nold\n${LAB_MARKERS.end}` });
	assert.equal(labKitStep.apply(stale), injectLabKit(ESSAY));
});

test("importing kit.mjs and runtime/lab.mjs reads no file", () => {
	const probe = `
		import fs from "node:fs";
		const original = fs.readFileSync;
		let reads = 0;
		// Node 24.21 (CI) loads ESM source through the public fs.readFileSync; count only calls not made by Node itself.
		fs.readFileSync = (...args) => {
			if (!/^\\s*at (?:[^(]*\\()?node:/.test((new Error().stack ?? "").split("\\n")[2] ?? "")) reads += 1;
			return original(...args);
		};
		await import(${JSON.stringify(path.join(here, "kit.mjs"))});
		await import(${JSON.stringify(path.join(SCRIPTS, "runtime", "lab.mjs"))});
		const step = (await import(${JSON.stringify(path.join(SCRIPTS, "runtime", "lab.mjs"))})).labKitStep;
		step.apply("<html><body><main>no block</main></body></html>");
		console.log(reads);`;
	const result = spawnSync(process.execPath, ["--input-type=module", "-e", probe], { encoding: "utf8", env: { ...process.env, OPENSSL_CONF: "/dev/null" } });
	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.stdout.trim(), "0");
});

test("collectLabMarkupIssues names each contract breach and is quiet on good markup", () => {
	const bad = [
		'<div class="vpk-lab" data-vpk-lab="a"><p data-vpk-readout></p></div>',
		'<div class="vpk-film" data-vpk-film data-vpkh-no-lightbox><video data-vpk-film-video autoplay></video><div data-vpk-beat></div></div>',
		'<svg data-vpk-external-asset data-vpk-lab-swatches="short" aria-hidden="true"><rect data-vpk-swatch/></svg>',
		"<script>const x = '<div data-vpk-lab=\"ignored\">';</script>",
	].join("\n");
	const issues = collectLabMarkupIssues(bad);
	const has = pattern => issues.some(issue => pattern.test(issue));
	assert.ok(has(/\[data-vpk-lab\] lacks data-vpkh-no-lightbox/));
	assert.ok(has(/lab "a" has no \[data-vpk-lab-source\]/));
	assert.ok(has(/must not autoplay/));
	assert.ok(has(/lacks muted/) && has(/lacks playsinline/));
	assert.ok(has(/\[data-vpk-readout\] mirrors runtime text/) && has(/\[data-vpk-beat\] mirrors runtime text/));
	assert.ok(has(/data-vpk-swatch/));
	assert.equal(issues.some(issue => issue.includes("ignored")), false, "scripts are not markup");
	const good = '<div class="vpk-lab" data-vpk-lab="a" data-vpkh-no-lightbox><p data-vpk-readout data-vpk-review-ignore></p><p data-vpk-lab-source>x</p></div>';
	assert.deepEqual(collectLabMarkupIssues(good), []);
	const cues = ids => `<div class="vpk-cues" data-vpk-cues data-vpkh-no-lightbox>${ids.map(id => `<button type="button" class="vpk-cue" data-vpk-cue="${id}" data-film="0"></button>`).join("")}</div>`;
	assert.deepEqual(collectLabMarkupIssues(cues(["a", "b", "c"])), []);
	const repeated = '3 cue buttons share data-vpk-cue="a"; cue ids must be unique (fix cues[].id in the content IR and re-render)';
	assert.deepEqual(collectDuplicateCueIssues(cues(["a", "b", "a", "a"])), [repeated]);
	assert.deepEqual(collectLabMarkupIssues(cues(["a", "b", "a", "a"])), [repeated], "kit.mjs --check warns about it");
});

test("collectFilmClockIssues flags cues and Gantts whose data-clock segment the embedded film data lacks (a dead cue sheet)", () => {
	const film = (id, segments, duration = 6) => `<div class="vpk-film" id="${id}" data-vpk-film data-vpkh-no-lightbox><video data-vpk-film-video muted playsinline></video><script type="application/json" data-vpk-film-data>${JSON.stringify({ version: 1, fps: 30, duration, segments: segments.map(sid => ({ id: sid, kind: "hold", film: [0, duration] })) })}</script></div>`;
	const cues = (target = "") => `<div class="vpk-cues" data-vpk-cues data-vpkh-no-lightbox${target ? ` data-film-target="${target}"` : ""}><button data-vpk-cue="a" data-clock="clock" data-t="0">A</button><button data-vpk-cue="b" data-film="1">B</button></div>`;
	const gantt = '<div class="vpk-gantt" id="g" data-vpk-gantt data-vpkh-no-lightbox data-clock="clock"></div>';
	assert.deepEqual(collectFilmClockIssues(film("f", ["clock"]) + cues() + gantt), []);
	const [issue, ...rest] = collectFilmClockIssues(film("f", ["hold"]) + cues() + gantt);
	assert.deepEqual(rest, []);
	assert.match(issue, /^cue a, Gantt g follow clock segment "clock", which the film data of "f" lacks \(segments: hold\)/);
	assert.match(issue, /--segment-id clock/);
	assert.match(collectLabMarkupIssues(film("f", ["hold"]) + cues()).join("\n"), /cue a follows clock segment "clock"/, "kit.mjs --check warns about it");
	assert.deepEqual(collectFilmClockIssues(film("f", ["film"], 0) + cues() + gantt), [], "no film embedded yet (duration 0): the template's placeholders pass");
	assert.deepEqual(collectFilmClockIssues(film("f", ["hold"]) + film("g2", ["clock"]) + cues("g2")), [], "a cue list follows its data-film-target");
	assert.equal(collectFilmClockIssues(film("f", ["clock"]) + film("g2", ["hold"]) + cues("g2")).length, 1);
	for (const file of ["assets/templates/motion-case-study.html", "assets/demos/demo-motion-case-study.html"]) {
		assert.deepEqual(collectFilmClockIssues(fs.readFileSync(path.join(SKILL, file), "utf8")), [], file);
	}
});
