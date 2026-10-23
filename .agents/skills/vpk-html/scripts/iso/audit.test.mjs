import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { auditHtml, auditHtmlFile, auditScene, auditSvg, formatFindings, runCheckIso, scenePoses, uniqueFindings } from "./audit.mjs";
import { renderRegion } from "./emit.mjs";
import { enterKeyframes, fadeAnimation, MANUAL_STEP_MS } from "./motion.mjs";
import { ISO_PRESET } from "./palette.mjs";
import { buildScene } from "./scene.mjs";

const EXEMPLAR = JSON.parse(fs.readFileSync(new URL("./briefs/exploded-stack.json", import.meta.url), "utf8"));
const DEMO = new URL("../../assets/demos/demo-illustration-iso-exploded-stack.html", import.meta.url);
const BUILD = fileURLToPath(new URL("../build.mjs", import.meta.url));
const AUDIT = fileURLToPath(new URL("./audit.mjs", import.meta.url));
const region = () => renderRegion(buildScene(EXEMPLAR));
const rules = result => [...new Set(result.findings.filter(f => f.severity === "error").map(f => f.rule))].sort();
const replaceOnce = (text, from, to) => {
	assert.ok(text.includes(from), `fixture contains ${from}`);
	return text.replace(from, to);
};

test("the exemplar region is clean", () => {
	const result = auditHtml(region());
	assert.equal(result.figures, 1);
	assert.deepEqual(result.findings, []);
	assert.deepEqual(auditScene(buildScene(EXEMPLAR)), []);
});

// Round-4 verifier: with explode.min 0 one Home keypress collapsed the stack, the focal MODULE sat
// under the top shell with its arrow on the shell (gap 0.00–0.30) and the TOP SHELL and MODULE
// leaders crossed (0.00, 0.05). A7 now runs at every slider stop; the browser sweep agrees stop by stop.
test("A7 runs at every Gap slider stop: a range that hides the focal part or crosses leaders fails", () => {
	const at = min => buildScene({ ...EXEMPLAR, interact: { ...EXEMPLAR.interact, explode: { ...EXEMPLAR.interact.explode, min } } });
	assert.deepEqual(scenePoses(at(0)).map(pose => pose.gap), Array.from({ length: 21 }, (_, i) => Math.round(i * 5) / 100));
	assert.deepEqual(scenePoses(buildScene({ ...EXEMPLAR, interact: null })), [{ gap: null, k: 0 }]);
	const wide = auditScene(at(0));
	assert.deepEqual(wide.map(f => f.rule), ["A7"]);
	assert.ok(wide.some(f => /label "Module" leader ends under "shell".* at gap 0\.00…0\.15 \(4 of 21 slider stops\)/.test(f.message)), JSON.stringify(wide));
	// 0.15 still leaves the leader end under the shell; the brief's MODULE anchor (on the module's near side) is clear of it from
	// 0.2. The fit includes the rest pose's cast shadows, so the drawing is a little smaller than before shadows.
	assert.equal(auditScene(at(0.15)).length, 1);
	assert.deepEqual(auditScene(at(0.2)), []);
	assert.deepEqual(auditScene(at(0.4)), []);
	assert.equal(EXEMPLAR.interact.explode.min, 0.4, "the shipped exemplar keeps the clean range");
});

// B2 decision 17b (G2 verifier ws3-A.10): the slider-stop check used to exist only in the model audit,
// so a figure that failed A7 at a stop passed check-html and `--check-iso --strict`. The HTML audit now
// reads the pose model back from the emitted document.
test("auditHtml runs A7 at every Gap slider stop, from the HTML alone (decision 17b)", () => {
	const r = region();
	assert.deepEqual(auditHtml(r).findings, [], "the shipped range is clean");
	// Hand-widen the slider to the failing range; the SVG itself (the rest pose) is untouched.
	const wide = replaceOnce(r, 'min="0.4"', 'min="0"');
	const found = auditHtml(wide).findings.filter(f => f.severity === "error");
	assert.deepEqual(found.map(f => f.rule), ["A7"], JSON.stringify(found));
	assert.ok(found.some(f => /label "Module" leader ends under "shell".* at gap 0\.00…0\.15 \(4 of 21 slider stops\)/.test(f.message)), JSON.stringify(found));
	// Same findings the model audit reports for the same brief (one pose model, two readers).
	const model = auditScene(buildScene({ ...EXEMPLAR, interact: { ...EXEMPLAR.interact, explode: { ...EXEMPLAR.interact.explode, min: 0 } } }));
	assert.deepEqual(found.map(f => f.message).sort(), model.map(f => f.message).sort());
	assert.equal(uniqueFindings([...model, ...found]).length, 1, "the two audits report each failure once");
	// 0.15 is the last failing start in the model audit too: one error, clean from 0.2.
	assert.equal(auditHtml(replaceOnce(r, 'min="0.4"', 'min="0.15"')).findings.filter(f => f.severity === "error").length, 1);
	assert.deepEqual(auditHtml(replaceOnce(r, 'min="0.4"', 'min="0.2"')).findings.filter(f => f.severity === "error"), []);
	// A figure with no slider, or an unusable one, is audited at rest only.
	assert.deepEqual(auditHtml(renderRegion(buildScene({ ...EXEMPLAR, interact: null }))).findings, []);
	assert.deepEqual(auditHtml(replaceOnce(r, 'step="0.05"', 'step="0"')).findings, []);
	// A hand-edited step far below the brief limit still audits in bounded time (the stop sweep is capped).
	const started = Date.now();
	const fine = auditHtml(replaceOnce(replaceOnce(r, 'step="0.05"', 'step="0.000001"'), 'min="0.4"', 'min="0"'));
	assert.ok(Date.now() - started < 5000, "bounded sweep");
	assert.ok(fine.findings.some(f => f.rule === "A7" && /slider stops/.test(f.message)));
});

// G2 J4: the narrow-stage tags are audited with the labels they replace.
test("A7 audits the narrow-stage tags: one per label, on its target, with the root opt-in", () => {
	const r = region();
	const errors = html => auditHtml(html).findings.filter(f => f.severity === "error").map(f => f.message);
	assert.deepEqual(auditHtml(r).findings, []);
	// A figure built before tags existed: warns (the labels render near 4 px on a phone), never errors.
	const TAG = /<g data-vpk-iso-tag="\d"[^>]*>[\s\S]*?<\/g><\/g>/g;
	const tagOf = n => new RegExp(`<g data-vpk-iso-tag="${n}"[^>]*>[\\s\\S]*?<\\/g><\\/g>`).exec(r)[0];
	const old = r.replace(TAG, "").replace(" data-vpk-iso-narrow", "");
	const warned = auditHtml(old).findings;
	assert.deepEqual(warned.map(f => [f.rule, f.severity]), [["A7", "warning"]]);
	assert.match(warned[0].message, /4 label\(s\) but no numbered narrow-stage tags; the labels render near 4 px/);
	// A dropped tag, a disc moved onto the figure, a relabelled tag, a missing opt-in.
	assert.match(errors(r.replace(tagOf(2), "")).join("\n"), /3 numbered tags for 4 labels/);
	const onFigure = tagOf(1).replace(/<circle cx="[\d.]+" cy="[\d.]+"/, '<circle cx="360" cy="300"');
	assert.match(errors(r.replace(tagOf(1), onFigure)).join("\n"), /tag 1 disc sits on the figure; it belongs in the gutter/);
	assert.match(errors(r.replace(tagOf(1), tagOf(1).replace('data-vpk-iso-tag-for="shell"', 'data-vpk-iso-tag-for="base"'))).join("\n"), /tag 1 is for "base", its label is for "shell"/);
	assert.match(errors(r.replace(" data-vpk-iso-narrow", "")).join("\n"), /without data-vpk-iso-narrow on the root <svg>/);
	// A tag moved into a part group: gutter tags belong to the labels layer.
	const moved = r.replace(tagOf(1), "").replace(/(<g data-vpk-iso-part="base"[^>]*>)/, `$1${tagOf(1)}`);
	assert.match(errors(moved).join("\n"), /tag 1 sits inside part "base"; gutter tags belong to the labels layer/);
});

test("runCheckIso: exit 0, 1 under --strict, and a clean message with exit 2 for a missing file (decision 17d)", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-iso-check-"));
	const good = path.join(dir, "good.html");
	const bad = path.join(dir, "bad.html");
	fs.writeFileSync(good, region());
	fs.writeFileSync(bad, replaceOnce(region(), 'min="0.4"', 'min="0"'));
	const quiet = fn => {
		const log = console.log;
		const error = console.error;
		const lines = { out: [], err: [] };
		console.log = (...args) => void lines.out.push(args.join(" "));
		console.error = (...args) => void lines.err.push(args.join(" "));
		try {
			return { code: fn(), ...lines };
		} finally {
			console.log = log;
			console.error = error;
		}
	};
	assert.equal(quiet(() => runCheckIso({ file: good, strict: true })).code, 0);
	assert.equal(quiet(() => runCheckIso({ file: bad })).code, 0, "advisory by default");
	assert.equal(quiet(() => runCheckIso({ file: bad, strict: true })).code, 1);
	const json = quiet(() => runCheckIso({ file: bad, json: true }));
	assert.equal(JSON.parse(json.out.join("\n")).findings.length, 1);
	const missing = quiet(() => runCheckIso({ file: path.join(dir, "nope.html"), strict: true }));
	assert.equal(missing.code, 2);
	assert.match(missing.err.join("\n"), /^File not found: .*nope\.html$/);
	assert.deepEqual(missing.out, []);
	assert.equal(quiet(() => runCheckIso({})).code, 2);
	const directory = quiet(() => runCheckIso({ file: dir }));
	assert.equal(directory.code, 2);
	assert.match(directory.err.join("\n"), /it is a directory/);
});

test("--check-iso on a missing file or without a file: a clean message and exit 2, no stack trace (build.mjs and audit.mjs)", () => {
	const missing = path.join(os.tmpdir(), "vpk-iso-definitely-missing.html");
	const env = { ...process.env, OPENSSL_CONF: "/dev/null" };
	for (const [script, args] of [[BUILD, ["--check-iso", missing]], [BUILD, ["--check-iso", missing, "--strict"]], [BUILD, ["--check-iso"]], [AUDIT, [missing]], [AUDIT, []]]) {
		const result = spawnSync(process.execPath, [script, ...args], { encoding: "utf8", env, cwd: os.tmpdir() });
		const label = `${path.basename(script)} ${args.map(arg => path.basename(arg)).join(" ")}`;
		assert.equal(result.status, 2, `${label}: ${result.stderr}`);
		assert.doesNotMatch(result.stderr, /\n\s+at |node:internal|ENOENT/, `${label}: no stack trace`);
		assert.match(result.stderr, /File not found: .*vpk-iso-definitely-missing\.html|Usage: /, label);
		assert.equal(result.stdout, "", label);
	}
});

test("one failing fixture per check", () => {
	const r = region();
	const depth = /data-vpk-iso-part="base" data-vpk-iso-depth="([\d.]+)"/.exec(r)[1];
	const cases = {
		A1: [
			replaceOnce(r, 'data-vpk-iso-tone="light" d="', 'data-vpk-iso-tone="light" stroke="var(--heat2)" d="'),
			replaceOnce(r, '<div class="vpk-iso-plate__foot"', '<div data-vpk-external-asset class="vpk-iso-plate__foot"'),
		],
		// Two extra face fills (the flat figure has four: top, near side, far side and the accent) make six.
		A2: [replaceOnce(r, 'data-vpk-iso-tone="top" d="M', 'data-vpk-iso-tone="top" fill="var(--paper)" data-x d="M').replace(/(data-x d="[^"]*") fill="var\(--surface-raised\)"/, "$1").replace(/data-vpk-iso-tone="light" d="([^"]*)" fill="[^"]*"/, 'data-vpk-iso-tone="light" d="$1" fill="var(--ill-tone3)"')],
		A3: [
			replaceOnce(r, 'data-vpk-iso-part="base"', 'data-vpk-iso-part="base" data-vpk-iso-focal'),
			// The accent on a non-focal face, and on a label chip that does not name the focal part.
			replaceOnce(r, 'data-vpk-iso-tone="light" d="', 'data-vpk-iso-tone="light" stroke="var(--ill-accent)" d="'),
			replaceOnce(r, '<rect data-vpk-iso-chip x="', '<rect data-vpk-iso-chip data-x x="').replace(/(<rect data-vpk-iso-chip data-x [^>]*)fill="none"/, '$1fill="var(--ill-accent)"'),
		],
		A4: [replaceOnce(r, 'stroke-width="1"', 'stroke-width="3"')],
		A5: [replaceOnce(r, `data-vpk-iso-part="base" data-vpk-iso-depth="${depth}"`, 'data-vpk-iso-part="base" data-vpk-iso-depth="999"')],
		A6: [replaceOnce(r, 'data-vpk-iso-from="core"', 'data-vpk-iso-from="base"')],
		A7: [r.replace(/(data-vpk-iso-label-for="[^"]*"[^>]*>\s*<path[^>]*>\s*<rect[^>]*>\s*<text x=")[\d.]+(" y=")[\d.]+/, "$1360$2230")],
		A9: [replaceOnce(r, ' data-vpk-fig-id="FIG_001"', ""), `${r}\n${r}`],
		A10: [replaceOnce(r, 'data-vpk-camera="45 30"', 'data-vpk-camera="45 31"'), replaceOnce(r, ' data-vpk-camera="45 30"', "")],
		A11: [replaceOnce(r, 'data-vpk-iso-part="base"', 'transform="translate(1 2)" data-vpk-iso-part="base"')],
		A12: [r.replace(/dur="\d+ms"/g, 'dur="2400ms"'), replaceOnce(r, '<animateTransform data-vpk-begin="0s"', "<animateTransform"), replaceOnce(r, "<animateTransform ", '<animateTransform repeatCount="2" ')],
		A15: [
			replaceOnce(r, "<defs>", '<defs><pattern id="vpk-iso-exploded-stack-p" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--paper)"/></pattern>'),
			r.replace(/(data-vpk-iso-role="top" data-vpk-iso-tone="top" d="[^"]*") fill="[^"]*"/, '$1 fill="url(#vpk-iso-exploded-stack-missing)"'),
			// A stale figure with the removed hatched cut face (a cut-role path on a -hatch pattern) fails rather than passing silently.
			replaceOnce(r, "<defs>", '<defs><pattern id="vpk-iso-exploded-stack-hatch" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="var(--ill-tone1)"/></pattern>').replace('<path data-vpk-iso-role="top"', '<path data-vpk-iso-role="cut" d="M0 0L1 1Z" fill="url(#vpk-iso-exploded-stack-hatch)"/><path data-vpk-iso-role="top"'),
		],
		A16: [replaceOnce(r, 'stroke-dasharray="3 3"', 'stroke-dasharray="4 4"')],
		A17: [replaceOnce(r, 'data-vpk-iso-role="mark" d="', `data-vpk-iso-role="mark" d="M0 0${"L1 1".repeat(34000)}`), replaceOnce(r, 'data-vpk-iso-role="mark" d="M', 'data-vpk-iso-role="mark" d="M0.25 0.75L')],
	};
	for (const [rule, fixtures] of Object.entries(cases)) {
		for (const [index, html] of fixtures.entries()) {
			const found = rules(auditHtml(html));
			assert.ok(found.includes(rule), `${rule} fixture ${index} → ${found.join(", ") || "no errors"}`);
		}
	}
});

function layeredSvg(layers, { fade = false } = {}) {
	const starts = Array.from({ length: layers }, (_, i) => i * MANUAL_STEP_MS);
	const timing = { layers, part: 600, starts, lastStart: starts.at(-1), total: starts.at(-1) + 600 };
	const anims = Array.from({ length: layers }, (_, i) => {
		const k = enterKeyframes(i, timing, [0, -10]);
		return `<g data-vpk-iso-enter="${i}"><g data-vpk-iso-part="p${i}" data-vpk-iso-depth="${i}"><path data-vpk-iso-role="fill" d="M${i * 30} 0L${i * 30 + 20} 0L${i * 30 + 20} 20Z" fill="var(--ill-tone1)"/></g><animateTransform data-vpk-begin="0s" attributeName="transform" type="translate" begin="indefinite" dur="${timing.total}ms" values="${k.values}" keyTimes="${k.keyTimes}" calcMode="spline" keySplines="${k.keySplines}" fill="freeze"/></g>`;
	});
	const labels = fade ? `<g data-vpk-iso-labels>${fadeAnimation(0.9, timing)}</g>` : "";
	return `<svg data-vpk-iso data-vpk-iso-id="t" data-vpk-iso-style="manual" data-vpk-smil-arm viewBox="0 0 400 100" aria-label="t"><g data-vpk-iso-scene>${anims.join("")}</g>${labels}</svg>`;
}

test("A12 counts layers from animateTransform holds only: 7 fail, 6 plus a label fade pass", () => {
	const a12 = svg => auditSvg(svg, { figure: "t" }).filter(f => f.rule === "A12");
	assert.ok(a12(layeredSvg(7)).some(f => /7 assembly layers/.test(f.message)));
	assert.deepEqual(a12(layeredSvg(6, { fade: true })), [], "6 layers + fade = 7 offsets, still valid");
	assert.ok(a12(layeredSvg(3).replace(/ data-vpk-smil-arm/, "")).some(f => /data-vpk-smil-arm/.test(f.message)));
});

test("formatFindings and the file entry points", () => {
	const bad = auditHtml(replaceOnce(region(), 'stroke-width="1"', 'stroke-width="3"'));
	const text = formatFindings({ ...bad, file: "x.html" });
	assert.match(text, /✗ A4 FIG_001: stroke-width="3"/);
	assert.match(text, /✗ iso audit: x\.html: 1 figure\(s\), \d+ error\(s\)/);
	assert.match(formatFindings({ ...auditHtml(region()), file: "ok.html" }), /✓ iso audit: ok\.html: 1 figure\(s\), 0 errors/);
	assert.deepEqual(auditHtml("<main><p>no figures</p></main>"), { figures: 0, findings: [] });
});

test("auditHtml on the generated demo returns 0 errors", () => {
	assert.ok(fs.existsSync(DEMO), "assets/demos/demo-illustration-iso-exploded-stack.html exists (build-illustrations.mjs)");
	const result = auditHtmlFile(DEMO);
	assert.equal(result.figures, 1);
	assert.deepEqual(result.findings.filter(f => f.severity === "error"), []);
});

// P5 (ws3-manual, B2 decision 28): A18 fails a focal part that renders nothing a reader can see; A19 holds every
// part but the focal one to one interior mark. Hand-built SVG, so each case isolates one cause.
const SQUARE = "M10 10L60 10L60 60L10 60Z";
function focalSvg({ fill = "var(--ill-tone1)", stroke = "var(--ill-line)", cover = null, clip = null } = {}) {
	const edge = stroke === null ? "" : `<path data-vpk-iso-role="edge" d="${SQUARE}" stroke="${stroke}" stroke-width="2"/>`;
	const covering = cover ? `<g data-vpk-iso-part="cover" data-vpk-iso-depth="1"><path data-vpk-iso-role="fill" data-vpk-iso-tone="light" d="${cover}" fill="var(--ill-tone2)"/></g>` : "";
	const defs = clip ? `<defs><clipPath id="w"><path d="${clip}"/></clipPath></defs>` : "";
	return `<svg data-vpk-iso data-vpk-iso-id="t" data-vpk-iso-style="manual" viewBox="0 0 200 100" aria-label="t">${defs}<g data-vpk-iso-scene><g data-vpk-iso-part="f" data-vpk-iso-depth="0" data-vpk-iso-focal${clip ? ' clip-path="url(#w)"' : ""}><path data-vpk-iso-role="fill" data-vpk-iso-tone="light" d="${SQUARE}" fill="${fill}"/>${edge}</g>${covering}</g></svg>`;
}
const a18 = svg => auditSvg(svg, { figure: "t" }).filter(f => f.rule === "A18");

test("A18: a focal part that paints nothing, sits under a later part, or lies outside its clip window fails", () => {
	assert.deepEqual(a18(focalSvg()), [], "a plain focal part with a fill and a stroke is visible");
	// nothing painted at all
	const none = a18(focalSvg({ fill: "none", stroke: "none" }));
	assert.equal(none.length, 1);
	assert.equal(none[0].severity, "error");
	assert.match(none[0].message, /focal part "f" paints nothing/);
	// painted but covered: the later part hides the fill and the whole stroke
	const covered = a18(focalSvg({ cover: "M0 0L80 0L80 80L0 80Z" }));
	assert.equal(covered.length, 1);
	assert.match(covered[0].message, /focal part "f" renders nothing a reader can see: 0% of its fill is uncovered and no stroke shows/);
	// covered except a 20% strip: below the 30% floor, so it still fails ...
	const strip = "M0 0L80 0L80 50L0 50Z";
	const sliver = /(\d+)% of its fill is uncovered and no stroke shows/.exec(a18(focalSvg({ cover: strip, stroke: "none" }))[0]?.message ?? "");
	assert.ok(sliver && Number(sliver[1]) >= 10 && Number(sliver[1]) < 30, `a ~20% strip is below the 30% floor (${sliver?.[1]}%)`);
	// ... unless a stroke point shows in that strip
	assert.deepEqual(a18(focalSvg({ cover: strip })), [], "a visible stroke carries a mostly covered focal part");
	// half covered with no stroke: 50% uncovered clears the floor
	assert.deepEqual(a18(focalSvg({ cover: "M0 0L80 0L80 35L0 35Z", stroke: "none" })), []);
	// a clip window that never meets the part: fill and stroke are clipped away (the F1 flash-ring failure)
	const clipped = a18(focalSvg({ clip: "M100 10L120 10L120 30L100 30Z" }));
	assert.equal(clipped.length, 1);
	assert.match(clipped[0].message, /fall outside its clip window/);
	assert.deepEqual(a18(focalSvg({ clip: "M0 0L40 0L40 40L0 40Z" })), [], "a window over part of the part keeps its inside visible");
});

test("A18 reads a built manual figure: a focal ring with its stroke removed fails, with it the figure is clean", () => {
	const brief = JSON.parse(fs.readFileSync(new URL("./fixtures/eu26-done-column.json", import.meta.url), "utf8"));
	const html = renderRegion(buildScene(brief));
	assert.deepEqual(auditHtml(html).findings.filter(f => f.severity === "error"), []);
	const ring = /<g data-vpk-iso-part="flash-ring"[\s\S]*?<\/g>/.exec(html)[0];
	const hidden = html.replace(ring, ring.replace(/(data-vpk-iso-role="edge"[^>]*) stroke="var\(--ill-accent\)"/, '$1 stroke="none"'));
	assert.notEqual(hidden, html);
	const found = auditHtml(hidden).findings.filter(f => f.severity === "error");
	assert.ok(found.some(f => f.rule === "A18" && /focal part "flash-ring"/.test(f.message)), JSON.stringify(found));
});

test("A19: a part draws at most one interior mark; the focal part is exempt", () => {
	const brief = {
		schema: "vpk-iso-brief/1", id: "marks", figId: "FIG_001", title: "Marks", label: "A tray with two cards.",
		parts: [
			{ id: "tray", kind: "tray", at: [0, 0, 0], size: [80, 100, 6] },
			{ id: "card-a", kind: "plate", at: [5, 8, 4], size: [70, 32, 2], marks: [[[4, 6], [30, 6]]] },
			{ id: "card-b", kind: "plate", at: [5, 50, 4], size: [70, 32, 2], marks: [[[4, 6], [30, 6]]] },
		],
		focal: "card-b",
		labels: [{ text: "Tray", target: "tray" }],
	};
	const build = input => renderRegion(buildScene(input));
	const a19 = html => auditHtml(html).findings.filter(f => f.rule === "A19");
	const marksIn = (html, part) => (new RegExp(`<g data-vpk-iso-part="${part}[^"]*"[^>]*>[\\s\\S]*?</g>`).exec(html)?.[0].match(/data-vpk-iso-role="mark"/g) ?? []).length;
	assert.deepEqual(a19(build(brief)), [], "one mark per part is within the budget");
	// The emitter already enforces the budget: a part given two marks draws only the longest.
	const busy = structuredClone(brief);
	busy.parts[1].marks = [[[4, 6], [30, 6]], [[4, 12], [50, 12]]];
	const trimmed = build(busy);
	assert.equal(marksIn(trimmed, "card-a"), 1, "the emitter keeps one interior mark");
	assert.match(/<g data-vpk-iso-part="card-a"[\s\S]*?<\/g>/.exec(trimmed)[0], /data-vpk-iso-role="mark" d="M[\d.]+ [\d.]+L[\d.]+ [\d.]+"/);
	assert.deepEqual(a19(trimmed), []);
	// The audit is the backstop for hand-edited HTML: a second mark path in the same part fails.
	const mark = /<path data-vpk-iso-role="mark"[^>]*\/>/.exec(trimmed)[0];
	const edited = trimmed.replace(mark, `${mark}\n${mark}`);
	const found = a19(edited);
	assert.equal(found.length, 1, JSON.stringify(found));
	assert.equal(found[0].severity, "error");
	assert.match(found[0].message, /part "card-a" draws 2 interior marks/);
	// The focal part keeps every mark.
	const focal = structuredClone(brief);
	focal.parts[2].marks = [[[4, 6], [30, 6]], [[4, 12], [30, 12]], [[4, 18], [30, 18]]];
	const focalHtml = build(focal);
	assert.equal(marksIn(focalHtml, "card-b"), 3);
	assert.deepEqual(a19(focalHtml), []);
});

// F1 (ws3-B): the HTML audit reads silhouettes back from the emitted paths, and a clipped ring's path is the
// whole disc. Its hull is now the intersection with its <clipPath>, as the browser paints it.
test("auditHtml clips a part to its clip-path before reading its silhouette", () => {
	const brief = {
		schema: "vpk-iso-brief/1", id: "clip", figId: "FIG_001", title: "Clip", label: "A tray with a large flash ring.",
		parts: [
			{ id: "column", kind: "tray", at: [0, 0, 0], size: [60, 150, 6], label: "column" },
			{ id: "ring", kind: "ring", at: [30, 3, 4], size: [171.3, 171.3, 0], clipTo: "column", clipPad: 28, label: "ring" },
		],
		focal: "ring",
		// The ring is a stroked arc: its leader dot sits on the arc inside the clip window (A20).
		labels: [{ text: "Column", target: "column", side: "left", anchor: [0, 120, 3] }, { text: "Ring", target: "ring", side: "left", anchor: [-20, 166.8, 4] }],
	};
	const html = renderRegion(buildScene(brief));
	assert.deepEqual(auditHtml(html).findings, [], "clipped: the labels sit outside the visible figure");
	const unclipped = replaceOnce(html, /\sclip-path="url\(#[\w-]+\)"/.exec(html)[0], "");
	const found = auditHtml(unclipped).findings.filter(f => f.severity === "error");
	assert.ok(found.some(f => f.rule === "A7" && /overlaps the figure/.test(f.message)), `without the clip the disc swallows the labels: ${JSON.stringify(found)}`);
});

// Verify round 1 (r1.6): the flash ring is a stroked arc in manual, so a leader dot beside it names nothing.
test("manual: a leader dot must sit on visible ink of its target", () => {
	const brief = JSON.parse(fs.readFileSync(new URL("./fixtures/eu26-done-column.json", import.meta.url), "utf8"));
	const ink = anchor => {
		const copy = structuredClone(brief);
		copy.labels.find(label => label.text === "Flash ring").anchor = anchor;
		return auditHtml(renderRegion(buildScene(copy))).findings.filter(f => f.severity === "error" && /not on visible ink/.test(f.message));
	};
	assert.deepEqual(ink([-20, 166.8, 4]), [], "a point on the arc passes");
	const off = ink([-20, 148, 4]);
	assert.equal(off.length, 1, JSON.stringify(off));
	assert.match(off[0].message, /"Flash ring" leader dot is not on visible ink of "flash-ring"/);
});

// Verify round 1 (r1.7/r1.8): manual narrow tags are gutter discs in the labels layer, never inside a part or clip window.
test("manual: narrow tags are gutter discs on leaders in the labels layer; a tag inside a part fails", () => {
	const brief = JSON.parse(fs.readFileSync(new URL("./fixtures/eu26-done-column.json", import.meta.url), "utf8"));
	const html = renderRegion(buildScene(brief));
	assert.equal(auditHtml(html).findings.filter(f => f.severity === "error").length, 0);
	assert.equal((html.match(/data-vpk-iso-tag-for=/g) ?? []).length, 4, "every label has a gutter tag");
	const labels = /<g data-vpk-iso-labels>[\s\S]*<\/g>\s*<\/g>/.exec(html)?.[0] ?? "";
	assert.equal((labels.match(/data-vpk-iso-tag-for=/g) ?? []).length, 4, "all four sit in the labels layer");
	const tag = /<g data-vpk-iso-tag="1"[\s\S]*?<\/g><\/g>/.exec(html)[0];
	const moved = html.replace(tag, "").replace(/(<g data-vpk-iso-part="column[^"]*"[^>]*>)/, `$1${tag}`);
	const found = auditHtml(moved).findings.filter(f => f.severity === "error" && /sits inside part/.test(f.message));
	assert.equal(found.length, 1, JSON.stringify(found));
});

// Verify round 1 (r1.9): a boxed dimension must clear every posed part at every Gap stop.
test("manual: the TOSS dimension clears the lifted cards at every slider stop, a dimension on the tray front fails", () => {
	const brief = JSON.parse(fs.readFileSync(new URL("./fixtures/eu26-done-column.json", import.meta.url), "utf8"));
	const errors = copy => auditHtml(renderRegion(buildScene(copy))).findings.filter(f => f.severity === "error");
	assert.deepEqual(errors(brief), []);
	const bad = structuredClone(brief);
	// On the tray's far side with a short offset the dimension's box lands on the lifted cards.
	bad.annotations[0] = { kind: "dimension", from: [0, 0, 6], to: [0, 150, 6], text: "Toss · 0.62 s", offset: -30 };
	assert.ok(errors(bad).some(f => /dimension "Toss · 0\.62 s" overlaps/.test(f.message)), JSON.stringify(errors(bad)));
});

test("A7: a dimension's extension lines, line and ticks never cross a label's text box (manual)", () => {
	const brief = JSON.parse(fs.readFileSync(new URL("./fixtures/eu26-done-column.json", import.meta.url), "utf8"));
	const errors = copy => auditHtml(renderRegion(buildScene(copy))).findings.filter(f => f.severity === "error");
	const modelErrors = copy => auditScene(buildScene(copy));
	assert.deepEqual(errors(brief), []);
	// Put DONE COLUMN back on the right: its text sits where the TOSS dimension's far tick runs.
	const bad = structuredClone(brief);
	bad.labels[0] = { text: "Done column", target: "column", side: "right", anchor: [60, 100, 3] };
	for (const found of [errors(bad), modelErrors(bad)]) assert.ok(found.some(f => /dimension "Toss · 0\.62 s" runs through the label "Done column"/.test(f.message)), JSON.stringify(found));
});

// A21 cast shadows: flat, one tone, under every part, from parts with faces only. A3: an owned motion arrow may take the accent
// only with the focal part.
test("A21: shadows sit under every part as one flat fill; gaps and rings cast none; a figure without shadows warns", async () => {
	const { SHADOW } = await import("./accent.mjs");
	const r = region();
	assert.deepEqual(rules(auditHtml(r)), [], "the exemplar's shadows are clean");
	const errors = html => auditHtml(html).findings.filter(f => f.rule === "A21").map(f => f.message).join("\n");
	const shadow = /<path data-vpk-iso-role="shadow" data-vpk-iso-shadow-for="base"[^>]*\/>/.exec(r)[0];
	assert.match(errors(replaceOnce(r, shadow, shadow.replace("/>", ' stroke="var(--ill-line)" stroke-width="1"/>'))), /shadow for "base" carries stroke/);
	assert.match(errors(replaceOnce(r, shadow, shadow.replace("/>", ' opacity="0.5"/>'))), /shadow for "base" carries opacity/);
	assert.match(errors(replaceOnce(r, shadow, shadow.replace("/>", ' fill="var(--ill-tone3)"/>'))), /shadow for "base" is filled var\(--ill-tone3\), not the one shadow tone/);
	assert.match(errors(replaceOnce(r, `data-vpk-iso-shadows fill="${SHADOW.TONE}"`, 'data-vpk-iso-shadows fill="var(--ill-tone2)"')), /the shadow group is filled var\(--ill-tone2\)/);
	// Move the whole shadow group after the first part: shadows must sit under every part.
	const group = /\t*<g data-vpk-iso-shadows[\s\S]*?\n\t*<\/g>\n(?=\t*<g data-vpk-iso-enter)/.exec(r)[0];
	const moved = r.replace(group, "").replace(/(<\/g>\n)(\t*<g data-vpk-iso-enter="1">)/, `$1${group}$2`);
	assert.match(errors(moved), /the shadow group paints after a part/);
	// A gap or a ring casts no shadow.
	const kinds = renderRegion(buildScene({ ...EXEMPLAR, id: "with-gap", parts: [...EXEMPLAR.parts, { id: "slot", kind: "gap", at: [130, 0, 0], size: [20, 20, 0] }], assemble: { layers: [...EXEMPLAR.assemble.layers.slice(0, -1), [...EXEMPLAR.assemble.layers.at(-1), "slot"]] } }));
	assert.doesNotMatch(kinds, /data-vpk-iso-shadow-for="slot"/, "the emitter casts no shadow for a gap");
	const kindsShadow = /<path data-vpk-iso-role="shadow" data-vpk-iso-shadow-for="base"[^>]*\/>/.exec(kinds)[0];
	const gapShadow = replaceOnce(kinds, kindsShadow, `${kindsShadow}<path data-vpk-iso-role="shadow" data-vpk-iso-shadow-for="slot" d="M0 0L5 0L5 5Z"/>`);
	assert.match(errors(gapShadow), /"slot" is line work \(a gap outline or a ring\) and casts no shadow/);
	// Without shadows (a figure built before them) the audit only warns.
	const none = r.replace(group, "").replace(/(\t*)<g data-vpk-iso-received[^>]*>[\s\S]*?\n\1<\/g>\n/g, "");
	assert.doesNotMatch(none, /data-vpk-iso-role="shadow"/, "every shadow stripped");
	assert.deepEqual(auditHtml(none).findings.filter(f => f.rule === "A21").map(f => f.severity), ["warning"]);
});

test("A3: a motion arrow paints the accent only when it names the focal part", () => {
	const brief = { ...structuredClone(EXEMPLAR), annotations: [{ kind: "arrow", from: [130, 90, 0], to: [130, 60, 0], of: "module" }] };
	const r = renderRegion(buildScene(brief));
	assert.match(r, /data-vpk-iso-arrow-for="module" data-vpk-iso-accent/);
	assert.deepEqual(auditHtml(r).findings.filter(f => f.rule === "A3"), [], "the focal part's arrow may take the accent");
	const stray = r.replace('data-vpk-iso-arrow-for="module"', 'data-vpk-iso-arrow-for="core"');
	assert.ok(auditHtml(stray).findings.some(f => f.rule === "A3" && /paints the accent/.test(f.message)), "an arrow of another part may not");
});

// Redline 2a: the focal part's line work is the darker accent (ISO_PRESET.focalEdge = ACCENT_FACES.edge). A grey crease or an
// ink outline on the orange part fails A3; the accent stroke on its edge, creases and marks passes.
test("A3: the focal part's edge, creases and marks take the accent stroke; ink or grey lines on it fail", () => {
	const r = renderRegion(buildScene(structuredClone(EXEMPLAR)));
	const a3 = html => auditHtml(html).findings.filter(f => f.rule === "A3");
	assert.deepEqual(a3(r), [], "the emitted focal passes");
	const focal = /(\t*)<g data-vpk-iso-part="module"[^>]*data-vpk-iso-focal>[\s\S]*?\n\1<\/g>/.exec(r)[0];
	assert.ok(focal.includes(`stroke="${ISO_PRESET.focalEdge}" stroke-width="2"`) && ISO_PRESET.focalEdge.includes("--ill-accent"));
	const inkOutline = r.replace(focal, focal.replace(`stroke="${ISO_PRESET.focalEdge}" stroke-width="2"`, 'stroke="var(--ill-line)" stroke-width="2"'));
	assert.ok(a3(inkOutline).some(f => /edge must be a 2px/.test(f.message)), "an ink outline fails");
	const greyCrease = r.replace(focal, focal.replace(/(data-vpk-iso-role="crease" d="[^"]*") stroke="[^"]*"/, `$1 stroke="${ISO_PRESET.crease}"`));
	assert.ok(a3(greyCrease).some(f => /crease is .* not the accent stroke/.test(f.message)), "a grey crease on the accent part fails");
});
