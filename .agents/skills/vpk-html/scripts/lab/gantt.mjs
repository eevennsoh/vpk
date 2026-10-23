#!/usr/bin/env node
// vpk-lab · build-time Gantt: a JSON spec to the film-synced Gantt slider (references/lab-kit.md).
//
// Usage: node .agents/skills/vpk-html/scripts/lab/gantt.mjs <spec.json> [--film-target <id>] > gantt.html
//
// Output: div.vpk-gantt[data-vpk-gantt][data-vpkh-no-lightbox][role=slider][tabindex=0] with the mapping
// attributes the runtime reads (data-clock, data-t0, data-t1, data-x0, data-x1), an aria-describedby
// description and an aria-hidden SVG painted with grayscale figure tokens only: fills var(--ill-tone1..3),
// strokes var(--ill-line) and var(--ill-guide-dashed), mono labels in var(--ill-ink50), and var(--focal)
// on the playhead alone. Stroke widths are 1, 1.5, 2 or 2.5.
//
// Spec (times are clock seconds, clamped to [tMin, tMax]; rows are referenced by index or id):
// {
//   id, filmTarget?, clock = "clock", label (4-200 chars), description (4-400 chars), tMin = 0, tMax, tickEvery?,
//   viewBox?: { width = 1000, x0 = 132, x1 = width - 16, top = 40, rowHeight = 26, bottom = 26 },
//   rows: ["Light", { id: "deck", label: "Deck" }, ...]  (1-16),
//   marks?: [{ t, label? }]                 act lines across every row (each path carries data-vpk-gantt-mark="t",
//                                           so a click near it seeks to that time)
//   bars?:  [{ row, start, end, tone?: 1|2|3 = 2, opacity?, fillOpacity?, label? }]
//   keys?:  [{ row, t, label? }]            keyframe diamonds
//   spans?: [{ row, start, end, dashed?, label? }]   thin connectors
//   ticks?: [{ row, t, weight?: 1|1.5|2.5 = 1.5, label? }]   short event ticks
//   tails?: [{ row, from, label? }]         dashed continuation to the right edge
// }
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { ganttX } from "./runtime/core.mjs";

const ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const TICK_WEIGHTS = new Set([1, 1.5, 2.5]);
const TEXT = 'font-family="Geist Mono, monospace" fill="var(--ill-ink50)"';

/** Escape text for HTML/SVG, including the characters check-html would read as colours, colour functions or
 * placeholders (`#`, parentheses, braces), so authored labels such as "#feed {{x}}" stay check-html clean. */
export function escapeLabText(value) {
	const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "#": "&#35;", "(": "&#40;", ")": "&#41;", "{": "&#123;", "}": "&#125;" };
	return String(value).replace(/[&<>"'#(){}]/g, character => entities[character]);
}

const num = value => String(Math.round(value * 100) / 100);

function fail(message) {
	throw new Error(`gantt spec: ${message}`);
}

function finite(value, name) {
	if (!Number.isFinite(value)) fail(`${name} must be a finite number`);
	return value;
}

function text(value, name, min, max) {
	const trimmed = String(value ?? "").trim();
	if (trimmed.length < min || trimmed.length > max) fail(`${name} must be ${min}-${max} characters`);
	return trimmed;
}

/** Validate a spec and fill defaults; throws `gantt spec: …` errors. */
export function normalizeGanttSpec(spec, { filmTarget } = {}) {
	if (!spec || typeof spec !== "object") fail("expected an object");
	const id = String(spec.id ?? "");
	if (!ID_PATTERN.test(id)) fail(`id "${id}" must match ${ID_PATTERN}`);
	const target = filmTarget ?? spec.filmTarget ?? null;
	if (target !== null && !ID_PATTERN.test(String(target))) fail(`filmTarget "${target}" must match ${ID_PATTERN}`);
	const clock = String(spec.clock ?? "clock");
	if (!/^[A-Za-z0-9._-]{1,64}$/.test(clock)) fail(`clock "${clock}" is not a segment id`);
	const tMin = finite(spec.tMin ?? 0, "tMin");
	const tMax = finite(spec.tMax, "tMax");
	if (!(tMax > tMin)) fail("tMax must be greater than tMin");
	const box = spec.viewBox ?? {};
	const width = finite(box.width ?? 1000, "viewBox.width");
	const x0 = finite(box.x0 ?? 132, "viewBox.x0");
	const x1 = finite(box.x1 ?? width - 16, "viewBox.x1");
	if (!(x0 >= 0 && x1 > x0 && x1 <= width)) fail("viewBox needs 0 <= x0 < x1 <= width");
	const rows = Array.isArray(spec.rows) ? spec.rows.map((row, index) => {
		const label = text(typeof row === "string" ? row : row?.label, `rows[${index}].label`, 1, 60);
		return { id: typeof row === "string" ? row : String(row?.id ?? index), label };
	}) : [];
	if (rows.length < 1 || rows.length > 16) fail("rows must hold 1-16 entries");
	const tickEvery = spec.tickEvery == null ? 0 : finite(spec.tickEvery, "tickEvery");
	if (tickEvery < 0 || (tickEvery > 0 && (tMax - tMin) / tickEvery > 200)) fail("tickEvery must be positive and give at most 200 ticks");
	return {
		id, filmTarget: target, clock, tMin, tMax, tickEvery, rows,
		label: text(spec.label, "label", 4, 200),
		description: text(spec.description, "description", 4, 400),
		box: { width, x0, x1, top: finite(box.top ?? 40, "viewBox.top"), rowHeight: finite(box.rowHeight ?? 26, "viewBox.rowHeight"), bottom: finite(box.bottom ?? 26, "viewBox.bottom") },
		marks: spec.marks ?? [], bars: spec.bars ?? [], keys: spec.keys ?? [], spans: spec.spans ?? [], ticks: spec.ticks ?? [], tails: spec.tails ?? [],
	};
}

/** Render the Gantt container and SVG (deterministic; same spec, same bytes). */
export function renderGantt(spec, options = {}) {
	const g = normalizeGanttSpec(spec, options);
	const { width, x0, x1, top, rowHeight, bottom } = g.box;
	const map = { t0: g.tMin, t1: g.tMax, x0, x1 };
	const time = (value, name) => Math.min(g.tMax, Math.max(g.tMin, finite(value, name)));
	const gx = value => ganttX(value, map);
	const ry = index => top + index * rowHeight;
	const floor = ry(g.rows.length);
	const height = floor + bottom;
	const rowOf = (ref, name) => {
		const index = typeof ref === "number" ? ref : g.rows.findIndex(row => row.id === ref);
		if (!Number.isInteger(index) || index < 0 || index >= g.rows.length) fail(`${name}.row "${ref}" is not a row`);
		return index;
	};
	const label = (item, row, t, name) => (item.label == null ? "" : `<text x="${num(gx(t) + 4)}" y="${num(ry(row) + 4)}" ${TEXT} font-size="10">${escapeLabText(text(item.label, `${name}.label`, 1, 80))}</text>`);
	const parts = [];
	if (g.tickEvery > 0) {
		for (let step = 0; g.tMin + step * g.tickEvery <= g.tMax + 1e-9; step += 1) {
			const t = g.tMin + step * g.tickEvery;
			parts.push(`<path d="M${num(gx(t))} ${num(top - 6)} V${num(floor)}" stroke="var(--ill-guide-dashed)" stroke-width="1"/>`);
			parts.push(`<text x="${num(gx(t))}" y="${num(floor + 16)}" ${TEXT} font-size="11" text-anchor="middle">${num(t)}</text>`);
		}
	}
	g.marks.forEach((mark, index) => {
		const t = time(mark.t, `marks[${index}].t`);
		parts.push(`<path data-vpk-gantt-mark="${num(t)}" d="M${num(gx(t))} 14 V${num(floor)}" stroke="var(--ill-line)" stroke-width="1.5"/>`);
		if (mark.label != null) parts.push(`<text x="${num(gx(t) + 6)}" y="24" ${TEXT} font-size="11" letter-spacing="1.5">${escapeLabText(text(mark.label, `marks[${index}].label`, 1, 40))}</text>`);
	});
	g.rows.forEach((row, index) => parts.push(`<text x="0" y="${num(ry(index) + 16)}" ${TEXT} font-size="11">${escapeLabText(row.label)}</text>`));
	g.spans.forEach((span, index) => {
		const row = rowOf(span.row, `spans[${index}]`);
		const [a, b] = [time(span.start, `spans[${index}].start`), time(span.end, `spans[${index}].end`)];
		parts.push(`<path d="M${num(gx(a))} ${num(ry(row) + 12)} H${num(gx(b))}" stroke="var(--ill-line)" stroke-width="1"${span.dashed ? ' stroke-dasharray="4 4"' : ""}/>`, label(span, row, a, `spans[${index}]`));
	});
	g.bars.forEach((bar, index) => {
		const row = rowOf(bar.row, `bars[${index}]`);
		const [a, b] = [time(bar.start, `bars[${index}].start`), time(bar.end, `bars[${index}].end`)];
		if (b < a) fail(`bars[${index}] ends before it starts`);
		const tone = bar.tone ?? 2;
		if (![1, 2, 3].includes(tone)) fail(`bars[${index}].tone must be 1, 2 or 3`);
		const extra = (bar.opacity == null ? "" : ` opacity="${num(finite(bar.opacity, `bars[${index}].opacity`))}"`) + (bar.fillOpacity == null ? "" : ` fill-opacity="${num(finite(bar.fillOpacity, `bars[${index}].fillOpacity`))}"`);
		parts.push(`<rect x="${num(gx(a))}" y="${num(ry(row) + 6)}" width="${num(Math.max(2, gx(b) - gx(a)))}" height="12" rx="2" fill="var(--ill-tone${tone})" stroke="var(--ill-line)" stroke-width="1"${extra}/>`, label(bar, row, a, `bars[${index}]`));
	});
	g.keys.forEach((key, index) => {
		const row = rowOf(key.row, `keys[${index}]`);
		const t = time(key.t, `keys[${index}].t`);
		const cy = ry(row) + 12;
		parts.push(`<rect x="${num(gx(t) - 4)}" y="${num(cy - 4)}" width="8" height="8" transform="rotate(45 ${num(gx(t))} ${num(cy)})" fill="var(--ill-tone3)" stroke="var(--ill-line)" stroke-width="1"/>`, label(key, row, t, `keys[${index}]`));
	});
	g.ticks.forEach((tick, index) => {
		const row = rowOf(tick.row, `ticks[${index}]`);
		const t = time(tick.t, `ticks[${index}].t`);
		const weight = tick.weight ?? 1.5;
		if (!TICK_WEIGHTS.has(weight)) fail(`ticks[${index}].weight must be 1, 1.5 or 2.5`);
		parts.push(`<path d="M${num(gx(t))} ${num(ry(row) + 4)} V${num(ry(row) + 20)}" stroke="var(--ill-line)" stroke-width="${weight}"/>`, label(tick, row, t, `ticks[${index}]`));
	});
	g.tails.forEach((tail, index) => {
		const row = rowOf(tail.row, `tails[${index}]`);
		const t = time(tail.from, `tails[${index}].from`);
		parts.push(`<path d="M${num(gx(t))} ${num(ry(row) + 12)} H${num(Math.min(width, x1 + 10))}" stroke="var(--ill-line)" stroke-width="1.5" stroke-dasharray="4 4"/>`, label(tail, row, t, `tails[${index}]`));
	});
	parts.push(`<line data-vpk-gantt-head x1="${num(x0)}" x2="${num(x0)}" y1="10" y2="${num(floor)}" stroke="var(--focal)" stroke-width="2" opacity="0.25"/>`);
	const descId = `${g.id}-desc`;
	const attrs = [
		`class="vpk-gantt"`, `id="${g.id}"`, "data-vpk-gantt", "data-vpkh-no-lightbox", `role="slider"`, `tabindex="0"`,
		`aria-label="${escapeLabText(g.label)}"`, `aria-describedby="${descId}"`,
		`aria-valuemin="${num(g.tMin)}"`, `aria-valuemax="${num(g.tMax)}"`, `aria-valuenow="${num(g.tMin)}"`, `aria-valuetext="${num(g.tMin)} s"`,
		`data-clock="${g.clock}"`, `data-t0="${num(g.tMin)}"`, `data-t1="${num(g.tMax)}"`, `data-x0="${num(x0)}"`, `data-x1="${num(x1)}"`,
		...(g.filmTarget ? [`data-film-target="${g.filmTarget}"`] : []),
	];
	return [
		`<div ${attrs.join(" ")}>`,
		`<p class="vpk-sr-only" id="${descId}">${escapeLabText(g.description)}</p>`,
		`<svg class="vpk-gantt-svg" viewBox="0 0 ${num(width)} ${num(height)}" aria-hidden="true" focusable="false">${parts.filter(Boolean).join("")}</svg>`,
		"</div>",
	].join("\n");
}

function main(argv) {
	const args = argv.slice(2);
	const targetIndex = args.indexOf("--film-target");
	const filmTarget = targetIndex >= 0 ? args[targetIndex + 1] : undefined;
	const files = args.filter((arg, index) => !arg.startsWith("--") && (targetIndex < 0 || index !== targetIndex + 1));
	if (files.length !== 1 || (targetIndex >= 0 && !filmTarget)) {
		console.error("Usage: gantt.mjs <spec.json> [--film-target <id>] > gantt.html");
		return 1;
	}
	const spec = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), files[0]), "utf8"));
	process.stdout.write(`${renderGantt(spec, { filmTarget })}\n`);
	return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	try {
		process.exitCode = main(process.argv);
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
