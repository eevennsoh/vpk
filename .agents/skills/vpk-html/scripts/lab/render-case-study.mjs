#!/usr/bin/env node
// vpk-lab · content IR → the structured regions of motion-case-study.html (references/lab-kit.md, Content IR).
//
//   node .agents/skills/vpk-html/scripts/lab/render-case-study.mjs <content.json> --into <file.html> [--check]
//   node .agents/skills/vpk-html/scripts/lab/render-case-study.mjs <content.json>          # regions as JSON on stdout
//
// <content.json>: the sidecar envelope { type: "motion-case-study", lang, brief, content } or bare content. --into
// replaces the regions present (<!-- vpk-region <name> --> … <!-- /vpk-region <name> -->), each IR lab's title and
// [data-vpk-lab-source] line, the data-vpk-content="motion-case-study" island (inserted after <main> when absent),
// and the authored film-data keys (fps, chapters, posterTime; clock segments until a film is embedded). Prose
// outside regions is untouched; no data-vpk-id is written. --check ignores data-vpk-id/data-vpk-revision (R20).
// Content with a repeated cue, lab or timeline-kind id is refused (exit 1); checkCaseStudyHtml is the island hook.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { findJsonIslands, parseJsonIsland, serializeJsonIsland } from "../json-island.mjs";
import { escapeLabText, renderGantt } from "./gantt.mjs";
import { collectDuplicateCueIssues } from "./kit.mjs";

export const CONTENT_TYPE = "motion-case-study";
export const REGION_NAMES = Object.freeze(["process", "gantt", "cues", "layers", "discards"]);
const esc = escapeLabText;
const num = value => String(Math.round(Number(value) * 1e6) / 1e6);
export const regionMarkers = name => ({ start: `<!-- vpk-region ${name} -->`, end: `<!-- /vpk-region ${name} -->` });

/** The bare content of an envelope or content object. */
export const contentOf = ir => (ir && typeof ir === "object" && ir.content && typeof ir.content === "object" ? ir.content : ir);
const parseOr = raw => { try { return parseJsonIsland(raw); } catch { return null; } };

/** Rules beyond the schema (R8): cue, lab and timeline-kind ids are unique. → [{ severity, path, message }] (CONTRACT_HOOKS) */
export function caseStudyContentIssues(content) {
	return [["cues", content?.cues], ["labs", content?.labs], ["timeline.kinds", content?.timeline?.kinds]].flatMap(([key, list]) => (Array.isArray(list) ? list : []).flatMap((item, index, all) => {
		const first = all.findIndex(other => other?.id === item?.id);
		return typeof item?.id === "string" && first < index ? [{ severity: "error", path: `content.${key}[${index}].id`, message: `duplicate id "${item.id}" (first at ${key}[${first}]); ids must be unique` }] : [];
	}));
}

/** The CONTENT_TYPE_HOOKS check (R8, K10): the island's content rules and unique cue buttons. → { ok, errors, warnings } */
export function checkCaseStudyHtml(html) {
	const island = findJsonIslands(String(html), "data-vpk-content").find(entry => entry.attrs["data-vpk-content"] === CONTENT_TYPE);
	const errors = [...caseStudyContentIssues(island ? parseOr(island.raw) : null).map(issue => `${issue.path}: ${issue.message}`), ...collectDuplicateCueIssues(html)];
	return { ok: !errors.length, errors, warnings: [] };
}

function renderCues(content, { clockId }) {
	return (content.cues ?? []).map(cue => {
		const at = Number.isFinite(cue.film_s) ? `data-film="${num(cue.film_s)}"` : `data-clock="${esc(clockId)}" data-t="${num(cue.t_s ?? 0)}"`;
		return [
			`<button type="button" class="vpk-cue" data-vpk-cue="${esc(cue.id)}" data-act="${esc(cue.act)}" ${at}>`,
			`<canvas class="vpk-cue-thumb" width="240" height="135" aria-hidden="true"></canvas>`,
			`<span><span class="vpk-cue-t"></span><span class="vpk-cue-name">${esc(cue.title)}</span>`,
			cue.nums ? `<span class="vpk-cue-nums">${esc(cue.nums)}</span>` : "",
			cue.body ? `<span class="vpk-cue-body" hidden>${esc(cue.body)}</span>` : "",
			"</span></button>",
		].join("");
	}).join("\n");
}

function renderProcess(content) {
	const timeline = content.timeline;
	if (!timeline) return null;
	const label = Object.fromEntries(timeline.kinds.map(kind => [kind.id, kind.label]));
	const filters = [`<button type="button" class="vpk-btn vpk-btn-sm" data-vpk-filter="all" aria-pressed="true">All</button>`,
		...timeline.kinds.map(kind => `<button type="button" class="vpk-btn vpk-btn-sm" data-vpk-filter="${esc(kind.id)}" aria-pressed="false">${esc(kind.label)}</button>`)].join("");
	const most = Math.max(1, ...timeline.days.map(day => day.commits ?? 0));
	const days = timeline.days.map(day => {
		const commits = Number.isInteger(day.commits)
			? `<span class="bar${day.commits ? "" : " zero"}" style="width:${Math.max(2, Math.round((day.commits / most) * 76))}px"></span><span>${day.commits} commit${day.commits === 1 ? "" : "s"}</span>`
			: "";
		const events = day.events.map(event => `<li class="event" data-kind="${esc(event.kind)}"><span class="event-kind">${esc(label[event.kind] ?? event.kind)}</span><p>${event.who ? `<span class="who">${esc(event.who)}</span> ` : ""}${esc(event.text)}</p></li>`).join("");
		return `<li class="day" data-vpk-filter-group><div class="day-date">${esc(day.date)}${day.dow ? `<small>${esc(day.dow)}</small>` : ""}</div><div class="day-commits">${commits}</div><ul class="events">${events}</ul></li>`;
	});
	return [
		`<div class="vpk-filters" data-vpk-filters="process" data-vpkh-no-lightbox role="group" aria-label="${esc(timeline.label ?? "Filter the timeline by theme")}">${filters}</div>`,
		`<ol class="days" data-vpk-filter-scope="process">`, ...days, "</ol>",
	].join("\n");
}

function renderDiscards(content) {
	if (!content.discards) return null;
	const cards = content.discards.map(item => [
		`<button type="button" class="vpk-flip" data-vpk-flip aria-pressed="false"><span class="vpk-flip-inner">`,
		`<span class="vpk-flip-face" data-face="front"><span class="vpk-flip-tag">${esc(item.tag ?? "Idea")} · tried</span><span class="vpk-flip-what">${esc(item.what)}</span><span class="vpk-flip-hint">Turn over ›</span></span>`,
		`<span class="vpk-flip-face vpk-flip-back" data-face="back" aria-hidden="true"><span class="vpk-flip-tag">Why it lost</span><span class="vpk-flip-why">${esc(item.why)}</span>${item.src ? `<span class="vpk-flip-src">${esc(item.src)}</span>` : ""}</span>`,
		"</span></button>",
	].join(""));
	return [`<div class="vpk-flip-deck" data-vpk-flip-deck data-vpkh-no-lightbox>`, ...cards, "</div>"].join("\n");
}

function renderLayers(content) {
	const layers = content.layers;
	if (!layers) return null;
	const height = 140 + Math.max(0, layers.length - 1) * 40;
	const planes = layers.map((layer, index) => {
		const y = height - 60 - index * 40;
		return `<g class="vpk-layer-plane" data-index="${index}"><path class="vpk-layer-face" d="M70 ${y} L250 ${y - 40} L470 ${y} L290 ${y + 40} Z" fill="var(--ill-tone${index % 2 ? 1 : 2})" stroke="var(--ill-line)" stroke-width="1"/><text x="40" y="${y + 4}" font-family="Geist Mono, monospace" font-size="11" fill="var(--ill-ink50)" text-anchor="end">${String(index + 1).padStart(2, "0")}</text></g>`;
	}).join("");
	const items = layers.map((layer, index) => `<li><button type="button" class="vpk-layer-button" data-vpk-select="layers" data-index="${index}" aria-pressed="${index === 0}"><span class="vpk-layer-n">${String(index + 1).padStart(2, "0")}</span><span class="vpk-select-title">${esc(layer.name)}</span><span class="vpk-layer-tech">${esc(layer.tech ?? "")}</span><span class="vpk-select-body" hidden>${esc(layer.body)}</span></button></li>`);
	return [
		`<div class="vpk-layers" data-vpk-layers data-vpkh-no-lightbox>`,
		`<svg class="vpk-layers-svg" viewBox="0 0 520 ${height}" aria-hidden="true" data-vpk-select-target="layers">${planes}</svg>`,
		"<div>", `<ul class="vpk-layer-list">`, ...items, "</ul>",
		`<div class="vpk-select-detail" data-vpk-select-detail="layers" data-vpk-review-ignore aria-live="polite"><h3 class="vpk-select-title"></h3><p class="vpk-select-body"></p></div>`,
		"</div>", "</div>",
	].join("\n");
}

/** The authored part of the film data (C4) from the IR film block. */
export function authoredFilmData(content) {
	const film = content.film ?? {};
	const duration = Number(film.duration_s) || 0;
	const offset = film.clock_offset_s;
	const clockId = film.clock_id ?? "clock";
	const clock = { id: clockId, label: film.clock_label ?? clockId, kind: "hold", clock: { kind: "linear", start: 0, rate: 1 } };
	let segments = [{ id: "film", label: "film", kind: "real", film: [0, duration], clock: { kind: "real" } }];
	if (Number.isFinite(offset)) {
		segments = offset > 0
			? [{ id: "real", label: "real time", kind: "real", film: [0, offset], clock: { kind: "real" } }, { ...clock, film: [offset, duration] }]
			: [{ ...clock, film: [0, duration] }];
	}
	return {
		version: 1, fps: film.fps ?? 30, duration, segments,
		chapters: (content.chapters ?? []).map(chapter => ({ label: chapter.label, film: chapter.film_s })),
		...(Number.isFinite(film.poster_s) ? { posterTime: film.poster_s } : {}),
	};
}

/** Merge the authored keys into existing film data: fps, chapters and posterTime always; duration and segments only while no film is embedded (duration not > 0). */
export function mergeFilmData(existing, authored) {
	const out = { ...(existing && typeof existing === "object" ? existing : {}), version: 1, fps: authored.fps, chapters: authored.chapters };
	if (authored.posterTime != null) out.posterTime = authored.posterTime;
	else delete out.posterTime;
	if (!(Number(existing?.duration) > 0)) {
		out.duration = authored.duration;
		out.segments = authored.segments;
	}
	return out;
}

/** Render every owned part. → { regions, filmData, island, labs: [{ id, title, source }] } */
export function renderCaseStudy(ir, { filmId = "film-player" } = {}) {
	const content = contentOf(ir);
	if (!content || !Array.isArray(content.cues)) throw new Error("render-case-study: expected motion-case-study content with cues");
	const issues = caseStudyContentIssues(content);
	if (issues.length) throw new Error(`render-case-study: nothing rendered: ${issues.map(issue => `${issue.path}: ${issue.message}`).join("; ")}`);
	const clockId = content.film?.clock_id ?? "clock";
	const gantt = content.gantt ? renderGantt(content.gantt, { filmTarget: filmId }) : null;
	const regions = { cues: renderCues(content, { clockId }), process: renderProcess(content), gantt, layers: renderLayers(content), discards: renderDiscards(content) };
	const island = `<script type="application/json" data-vpk-content="${CONTENT_TYPE}">${serializeJsonIsland(content)}</script>`;
	return { regions, filmData: authoredFilmData(content), island, labs: (content.labs ?? []).map(({ id, title, source }) => ({ id, title, source })) };
}

/** [start, end) of a region's inner text, or null. */
export function regionRange(html, name) {
	const { start, end } = regionMarkers(name);
	const open = html.indexOf(start);
	const close = open < 0 ? -1 : html.indexOf(end, open);
	return open < 0 || close < 0 ? null : [open + start.length, close];
}

const splice = (html, [from, to], text) => `${html.slice(0, from)}${text}${html.slice(to)}`;

/** [start, end) of the inner text of the first element in lab `id` whose open tag matches `attribute` (a
 * data-vpk-lab-source attribute or the vpk-lab-title class), bounded by the next lab root; null when absent. */
export function labPartRange(html, id, attribute) {
	const root = html.search(new RegExp(`\\sdata-vpk-lab="${id}"`));
	if (root < 0) return null;
	const next = html.slice(root + 1).search(/\sdata-vpk-lab="/);
	const limit = next < 0 ? html.length : root + 1 + next;
	const tag = html.slice(root, limit).search(new RegExp(`<[a-z][\\w-]*\\b[^>]*\\s${attribute}(?=[\\s>=/])[^>]*>`));
	if (tag < 0) return null;
	const from = html.indexOf(">", root + tag) + 1;
	const to = html.indexOf(`</${/^<([a-z][\w-]*)/.exec(html.slice(root + tag))[1]}>`, from);
	return to < 0 || to > limit ? null : [from, to];
}
const LAB_PARTS = Object.freeze({ source: "data-vpk-lab-source", title: "class=\"vpk-lab-title\"" });
const labPartHtml = { source: lab => `Maths ported from <code class="vpk-code">${esc(lab.source)}</code>`, title: lab => esc(lab.title) };

const islandFor = html => findJsonIslands(html, "data-vpk-content").find(entry => entry.attrs["data-vpk-content"] === CONTENT_TYPE) ?? null;
const filmIslandFor = html => findJsonIslands(html, "data-vpk-film-data")[0] ?? null;

/** Apply a render to an HTML document (slicing only, never a replacement pattern). */
export function applyCaseStudy(html, rendered) {
	let out = html;
	for (const name of REGION_NAMES) {
		const range = regionRange(out, name);
		if (range && rendered.regions[name] != null) out = splice(out, range, `\n${rendered.regions[name]}\n`);
	}
	for (const lab of rendered.labs) {
		for (const [part, attribute] of Object.entries(LAB_PARTS)) {
			const range = labPartRange(out, lab.id, attribute);
			if (range) out = splice(out, range, labPartHtml[part](lab));
		}
	}
	const film = filmIslandFor(out);
	if (film) out = splice(out, [film.contentStart, film.contentEnd], serializeJsonIsland(mergeFilmData(parseOr(film.raw), rendered.filmData)));
	const island = islandFor(out);
	if (island) return splice(out, [island.start, island.end], rendered.island);
	if (!/<main\b[^>]*>/i.test(out)) throw new Error("render-case-study: the document has no <main> for the content island");
	return out.replace(/<main\b[^>]*>/i, tag => `${tag}\n${rendered.island}`);
}

const stripStamps = text => text.replace(/\s(?:data-vpk-id|data-vpk-revision)="[^"]*"/g, "");

/** Owned-part differences between `html` and a fresh render: string[] (empty when current). */
export function caseStudyDrift(html, rendered) {
	const fresh = applyCaseStudy(html, rendered);
	const drift = [];
	for (const name of REGION_NAMES) {
		const [a, b] = [regionRange(html, name), regionRange(fresh, name)];
		if (a && stripStamps(html.slice(...a)) !== stripStamps(fresh.slice(...b))) drift.push(`region ${name}`);
	}
	for (const lab of rendered.labs) {
		for (const [part, attribute] of Object.entries(LAB_PARTS)) {
			const [a, b] = [labPartRange(html, lab.id, attribute), labPartRange(fresh, lab.id, attribute)];
			if (a && html.slice(...a) !== fresh.slice(...b)) drift.push(`lab ${lab.id} ${part}`);
		}
	}
	const island = islandFor(html);
	if (!island) drift.push("content island missing");
	else if (island.raw !== islandFor(fresh).raw) drift.push("content island");
	const film = filmIslandFor(html);
	if (film && film.raw !== filmIslandFor(fresh).raw) drift.push("film data (authored keys)");
	return drift;
}

function main(argv) {
	const intoIndex = argv.indexOf("--into");
	const into = intoIndex >= 0 ? argv[intoIndex + 1] : null;
	const check = argv.includes("--check");
	const files = argv.filter((arg, index) => !arg.startsWith("--") && (intoIndex < 0 || index !== intoIndex + 1));
	if (files.length !== 1 || (intoIndex >= 0 && !into) || (check && !into)) {
		console.error("Usage: render-case-study.mjs <content.json> [--into <file.html> [--check]]");
		return 2;
	}
	const ir = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), files[0]), "utf8"));
	if (ir.type && ir.type !== CONTENT_TYPE) throw new Error(`render-case-study: ${files[0]} is a "${ir.type}" sidecar, not ${CONTENT_TYPE}`);
	const rendered = renderCaseStudy(ir);
	if (!into) {
		process.stdout.write(`${JSON.stringify(rendered, null, "\t")}\n`);
		return 0;
	}
	const target = path.resolve(process.cwd(), into);
	const rel = path.relative(process.cwd(), target);
	const html = fs.readFileSync(target, "utf8");
	const drift = check ? caseStudyDrift(html, rendered) : [];
	const next = check ? html : applyCaseStudy(html, rendered);
	if (next !== html) fs.writeFileSync(target, next);
	if (drift.length) console.error(`✗ ${rel}: differs from ${files[0]} in ${drift.join(", ")}; re-run without --check`);
	else console.log(check ? `✓ ${rel}: regions, labs and content island match ${files[0]}` : `${next === html ? "unchanged" : "✓ rendered"} ${rel}`);
	const stamped = fs.existsSync(path.join(path.dirname(target), `${path.basename(target, ".html")}.vpk-blocks.json`));
	if ((!check || drift.length) && stamped) console.log(`Reviewable artifact: run node .agents/skills/vpk-html/scripts/build.mjs --stamp ${rel} to restore block ids.`);
	return drift.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	try { process.exitCode = main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
