import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { collectColorTokenIssues, collectSvgGrammarIssues, validateHtmlString } from "../check-html.mjs";
import { escapeLabText, normalizeGanttSpec, renderGantt } from "./gantt.mjs";
import { ganttX } from "./runtime/core.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.join(here, "..", "..");

// The EU26 finale run of show (finale clock 0-12 s), expressed as a spec.
const SAMPLE = Object.freeze({
	id: "finale-gantt",
	filmTarget: "film-player",
	clock: "clock",
	label: "Gantt chart of the finale clock from 0 to 12 seconds",
	description: "Light, deck, camera keys, tiles, glows, title, year, the throw and the wall's glide, on one 12 second clock.",
	tMin: 0,
	tMax: 12,
	tickEvery: 1,
	viewBox: { width: 1000, x0: 132, x1: 984 },
	rows: ["Light", "Deck", { id: "camera", label: "Camera" }, "Tiles", "Glow", "Title", "Year", "Throw", "Wall"],
	marks: [{ t: 0, label: "ACT I" }, { t: 4.92, label: "ACT II" }, { t: 8.17, label: "ACT III" }],
	bars: [
		{ row: 0, start: 0, end: 0.62 },
		{ row: 1, start: 0.62, end: 2.18, label: "toss 0.62" },
		{ row: 3, start: 4.27, end: 4.92, label: "hero, then 5 tiles" },
		{ row: 3, start: 5.14, end: 5.79, opacity: 0.73 },
		{ row: 4, start: 5.12, end: 6.77, fillOpacity: 0.6, tone: 1 },
		{ row: "Wall", start: 8.73, end: 11.33, fillOpacity: 0.55, tone: 3, label: "endless glide" },
	],
	keys: [{ row: "camera", t: 0.82 }, { row: "camera", t: 1.52 }, { row: "camera", t: 4.92 }],
	spans: [{ row: "camera", start: 0.82, end: 4.92 }, { row: 6, start: 6.72, end: 7.57, dashed: true }],
	ticks: [{ row: 7, t: 9.57, label: "landings · title" }, { row: 7, t: 9.69 }, { row: 7, t: 10.37, weight: 2.5 }],
	tails: [{ row: 8, from: 11.33 }],
});

const attr = (html, name) => html.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

test("renderGantt output passes the SVG grammar and colour-token checks", () => {
	const html = renderGantt(SAMPLE);
	assert.deepEqual(collectSvgGrammarIssues(html), []);
	assert.deepEqual(collectColorTokenIssues(html), []);
});

test("the container carries the slider semantics, the mapping and the lightbox opt-out", () => {
	const html = renderGantt(SAMPLE);
	const open = html.match(/^<div\b[^>]*>/)?.[0] ?? "";
	assert.match(open, /\sclass="vpk-gantt"/);
	assert.match(open, /\sdata-vpk-gantt[\s>]/);
	assert.match(open, /\sdata-vpkh-no-lightbox[\s>]/);
	assert.equal(attr(open, "role"), "slider");
	assert.equal(attr(open, "tabindex"), "0");
	assert.equal(attr(open, "aria-label"), SAMPLE.label);
	assert.equal(attr(open, "aria-describedby"), "finale-gantt-desc");
	assert.equal(attr(open, "aria-valuemin"), "0");
	assert.equal(attr(open, "aria-valuemax"), "12");
	assert.equal(attr(open, "aria-valuenow"), "0");
	assert.equal(attr(open, "aria-valuetext"), "0 s");
	assert.equal(attr(open, "data-clock"), "clock");
	assert.equal(attr(open, "data-t0"), "0");
	assert.equal(attr(open, "data-t1"), "12");
	assert.equal(attr(open, "data-x0"), "132");
	assert.equal(attr(open, "data-x1"), "984");
	assert.equal(attr(open, "data-film-target"), "film-player");
	assert.match(html, /<p class="vpk-sr-only" id="finale-gantt-desc">Light, deck, camera keys/);
	assert.match(html, /<svg class="vpk-gantt-svg" viewBox="0 0 1000 300" aria-hidden="true" focusable="false">/);
	const head = html.match(/<line data-vpk-gantt-head[^>]*>/)?.[0] ?? "";
	assert.equal(attr(head, "x1"), "132");
	assert.equal(attr(head, "x2"), "132");
	assert.equal(attr(head, "opacity"), "0.25");
	assert.equal(attr(head, "stroke"), "var(--focal)");
});

test("paint is grayscale: tone fills, line and guide strokes, focal on the head only, widths 1-2.5", () => {
	const html = renderGantt(SAMPLE);
	const paints = new Set([...html.matchAll(/\s(?:fill|stroke)="([^"]+)"/g)].map(match => match[1]));
	assert.deepEqual([...paints].sort(), ["var(--focal)", "var(--ill-guide-dashed)", "var(--ill-ink50)", "var(--ill-line)", "var(--ill-tone1)", "var(--ill-tone2)", "var(--ill-tone3)"]);
	assert.equal(html.split("var(--focal)").length - 1, 1, "one focal element: the playhead");
	assert.doesNotMatch(html, /--(?:success|warning|danger|info)\b/, "no status hues");
	const widths = [...html.matchAll(/stroke-width="([^"]+)"/g)].map(match => Number(match[1]));
	assert.ok(widths.length > 20);
	for (const width of widths) assert.ok([1, 1.5, 2, 2.5].includes(width), `stroke-width ${width}`);
	for (const family of html.matchAll(/font-family="([^"]+)"/g)) assert.equal(family[1], "Geist Mono, monospace");
});

test("geometry follows the runtime mapping (ganttX) and is deterministic", () => {
	const html = renderGantt(SAMPLE);
	const map = { t0: 0, t1: 12, x0: 132, x1: 984 };
	const toss = html.match(/<rect x="([\d.]+)" y="(\d+)" width="([\d.]+)"[^>]*fill="var\(--ill-tone2\)"/g) ?? [];
	assert.ok(toss.length >= 3);
	assert.ok(html.includes(`<rect x="${Math.round(ganttX(0.62, map) * 100) / 100}" y="72"`), "the deck bar starts at ganttX(0.62) on row 1");
	assert.ok(html.includes(`rotate(45 ${Math.round(ganttX(4.92, map) * 100) / 100} 104)`), "camera keys are diamonds centred on their time");
	assert.ok(html.includes(`stroke-dasharray="4 4"`), "dashed span and tail");
	assert.equal(renderGantt(SAMPLE), html, "same spec, same bytes");
	assert.ok(renderGantt({ ...SAMPLE, bars: [{ row: 0, start: -5, end: 99 }] }).includes(`<rect x="132" y="46" width="852"`), "times clamp to the clock span");
});

test("authored text is escaped so colour-like and placeholder-like labels stay check-html clean", () => {
	assert.equal(escapeLabText(`#feed {{x}} rgb(1,2,3) <b>"'&`), "&#35;feed &#123;&#123;x&#125;&#125; rgb&#40;1,2,3&#41; &lt;b&gt;&quot;&#39;&amp;");
	const hostile = renderGantt({
		...SAMPLE,
		label: "#feed {{x}} rgb(1,2,3) gantt",
		description: "</svg><script>alert(1)</script> #abc",
		rows: ["#fade", "{{row}}", "hsl(1,2%,3%)"],
		bars: [{ row: 0, start: 1, end: 2, label: "#c0ffee" }],
		keys: [], spans: [], ticks: [], tails: [], marks: [{ t: 1, label: "rgba(0,0,0,0)" }],
	});
	assert.deepEqual(collectColorTokenIssues(hostile), []);
	assert.deepEqual(collectSvgGrammarIssues(hostile), []);
	assert.doesNotMatch(hostile, /\{\{|<script|<\/svg><script/);
});

test("the Gantt drops into a document that still passes validateHtmlString", () => {
	const template = fs.readFileSync(path.join(SKILL, "assets", "templates", "feature-essay.html"), "utf8");
	const index = template.indexOf("</main>");
	const html = `${template.slice(0, index)}<section id="run-of-show">${renderGantt(SAMPLE)}</section>\n${template.slice(index)}`;
	const result = validateHtmlString(html, "feature-essay+gantt");
	assert.deepEqual(result.failures, []);
});

test("invalid specs fail with a named reason", () => {
	const cases = [
		[{ ...SAMPLE, tMax: 0 }, /tMax must be greater than tMin/],
		[{ ...SAMPLE, rows: [] }, /rows must hold 1-16 entries/],
		[{ ...SAMPLE, rows: Array.from({ length: 17 }, (_, index) => `r${index}`) }, /rows must hold 1-16 entries/],
		[{ ...SAMPLE, bars: [{ row: 12, start: 0, end: 1 }] }, /bars\[0\]\.row "12" is not a row/],
		[{ ...SAMPLE, keys: [{ row: "nope", t: 1 }] }, /keys\[0\]\.row "nope" is not a row/],
		[{ ...SAMPLE, bars: [{ row: 0, start: 3, end: 1 }] }, /ends before it starts/],
		[{ ...SAMPLE, bars: [{ row: 0, start: 0, end: 1, tone: 4 }] }, /tone must be 1, 2 or 3/],
		[{ ...SAMPLE, ticks: [{ row: 0, t: 1, weight: 3 }] }, /weight must be 1, 1.5 or 2.5/],
		[{ ...SAMPLE, label: "no" }, /label must be 4-200 characters/],
		[{ ...SAMPLE, description: "" }, /description must be 4-400 characters/],
		[{ ...SAMPLE, id: "Bad Id" }, /id "Bad Id" must match/],
		[{ ...SAMPLE, viewBox: { width: 100, x0: 50, x1: 40 } }, /viewBox needs/],
		[{ ...SAMPLE, marks: [{ t: "soon" }] }, /marks\[0\]\.t must be a finite number/],
		[{ ...SAMPLE, tickEvery: 0.001 }, /at most 200 ticks/],
	];
	for (const [spec, pattern] of cases) assert.throws(() => renderGantt(spec), pattern);
	assert.equal(normalizeGanttSpec(SAMPLE, { filmTarget: "other-film" }).filmTarget, "other-film", "the CLI flag wins over the spec");
	assert.doesNotMatch(renderGantt({ ...SAMPLE, filmTarget: undefined }), /data-film-target/);
});

test("CLI renders a spec file to stdout and honours --film-target", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-gantt-"));
	const specPath = path.join(dir, "gantt.json");
	fs.writeFileSync(specPath, JSON.stringify(SAMPLE));
	const run = args => spawnSync(process.execPath, [path.join(here, "gantt.mjs"), ...args], { encoding: "utf8", env: { ...process.env, OPENSSL_CONF: "/dev/null" } });
	const ok = run([specPath, "--film-target", "film-two"]);
	assert.equal(ok.status, 0, ok.stderr);
	assert.equal(ok.stdout, `${renderGantt(SAMPLE, { filmTarget: "film-two" })}\n`);
	const usage = run([]);
	assert.equal(usage.status, 1);
	assert.match(usage.stderr, /Usage: gantt\.mjs/);
	fs.writeFileSync(specPath, JSON.stringify({ ...SAMPLE, tMax: -1 }));
	const bad = run([specPath]);
	assert.equal(bad.status, 1);
	assert.match(bad.stderr, /gantt spec: tMax must be greater than tMin/);
	fs.rmSync(dir, { recursive: true, force: true });
});
