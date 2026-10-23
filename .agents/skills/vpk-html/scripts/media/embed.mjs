#!/usr/bin/env node
// vpk-html media · embed: put an encoded film into a motion case study (references/media-pipeline.md, Embed).
//
//   node .agents/skills/vpk-html/scripts/media/embed.mjs <file.html> --film <film.mp4> [--manifest <capture.json>]
//        [--film-id film-player] [--poster-time <s> | --poster <image>] [--no-poster] [--bake-thumbs]
//        [--lite auto|always|never] [--lite-keep-review] [--budget-bytes N] [--root <dir>…] [--dry-run]
//
// Every input is fence-checked (fence.mjs) and listed as `embedded: <path> <bytes> sha256:<12>`; no absolute path is
// written. Embed edits only: the video src (a data URL, keyed by the attribute), its poster, the film-data island
// (manifest segments, fps, marks and the ffprobe duration merged into the authored chapters and posterTime, written
// with serializeJsonIsland), the [data-vpk-film-provenance] line and baked cue thumbnails. Doc ids, revisions,
// data-vpk-id stamps and review islands are never touched, and re-runs are byte-stable. A film document over the
// data-URL budget also gets <slug>.lite.html (--lite auto): a 640-wide two-pass film at liteFilmTargetBytes, a
// 640 poster, data-vpk-variant="lite", a lite note, and no review-data block unless --lite-keep-review (R21). The
// lite copy records data-vpk-lite-source (liteSourceHash of the full copy). When no lite copy is written, an existing
// <slug>.lite.html whose recorded source is not this full copy (film or content changed) is reported as stale (warn).
// Exit 0 even when the full file is over budget (the warning is advisory); exit 1 when the lite copy cannot fit, or
// when a cue or Gantt follows a data-clock segment the merged film data lacks (a dead cue sheet; nothing is written).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { validateHtmlString } from "../check-html.mjs";
import { findJsonIslands, parseJsonIsland, serializeJsonIsland } from "../json-island.mjs";
import { escapeLabText } from "../lab/gantt.mjs";
import { collectFilmClockIssues } from "../lab/kit.mjs";
import { filmFromClock } from "../lab/runtime/core.mjs";
import { filmSeekTime } from "../lab/runtime/film.mjs";
import { markerPair, removeMarkedBlock } from "../runtime/blocks.mjs";
import { encodeFilm, probeFilm } from "./encode.mjs";
import { checkFencedInput, describeEmbedded, fenceRoots, sha256_12 } from "./fence.mjs";
import { STILLS, buildStillPlan, findTool } from "./presets.mjs";
import { DATA_URL_SAFE_HTML_BYTES, formatHtmlWeight, formatMB, liteFilmTargetBytes, measureHtmlWeight, weightWarnings } from "./size-budget.mjs";

export class EmbedError extends Error {}
const fixed = (n, d = 2) => Number(n).toFixed(d);
const MIME = { ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png" };
export const dataUrl = (mime, buffer) => `data:${mime};base64,${Buffer.from(buffer).toString("base64")}`;

/** [start, end) of the element whose open tag starts at `open` (balanced on its own tag name). */
export function elementRange(html, open) {
	const name = /^<([a-z][\w-]*)/i.exec(html.slice(open))?.[1];
	if (!name) throw new EmbedError("embed: no element at the given offset");
	const tags = new RegExp(`<(/?)${name}\\b[^>]*>`, "gi");
	tags.lastIndex = open;
	let depth = 0;
	for (let match = tags.exec(html); match; match = tags.exec(html)) {
		depth += match[1] ? -1 : 1;
		if (depth === 0) return [open, match.index + match[0].length];
	}
	return [open, html.length];
}

/** The film root (an element with this id and data-vpk-film) as [start, end), else throws. */
export function filmRootRange(html, filmId) {
	const match = new RegExp(`<[a-z][\\w-]*\\b[^>]*\\sid="${filmId}"[^>]*>`, "i").exec(html);
	if (!match || !/\sdata-vpk-film(?=[\s>=/])/.test(match[0])) throw new EmbedError(`embed: no [data-vpk-film] element with id "${filmId}" (pass --film-id)`);
	return elementRange(html, match.index);
}

/** Set (or remove, with null) one attribute on an open-tag string. */
export function setTagAttribute(tag, name, value) {
	const stripped = tag.replace(new RegExp(`\\s${name}(?:="[^"]*")?(?=[\\s>/])`, "i"), "");
	if (value == null) return stripped;
	const at = /^<[a-z][\w-]*/i.exec(stripped)[0].length;
	return `${stripped.slice(0, at)} ${name}="${value}"${stripped.slice(at)}`;
}

const splice = (html, [from, to], text) => `${html.slice(0, from)}${text}${html.slice(to)}`;

/** Merge a capture manifest (or nothing, for a supplied film) into the authored film data. → { data, warnings } */
export function mergeCaptureData(authored = {}, manifest = null, { duration, posterTime }) {
	const pick = segment => ({ id: segment.id, label: segment.label ?? segment.id, kind: segment.kind, film: [...segment.film], clock: segment.clock ?? { kind: "real" } });
	const fps = Number(manifest?.fps ?? authored.fps) || 30;
	const warnings = [];
	let segments = (manifest ? manifest.segments : authored.segments ?? []).map(pick).filter(segment => segment.film[0] < duration);
	if (!segments.length) segments = [{ id: "film", label: "film", kind: "real", film: [0, duration], clock: { kind: "real" } }];
	segments.at(-1).film[1] = duration;
	for (const own of manifest ? authored.segments ?? [] : []) {
		const captured = manifest.segments.find(segment => segment.id === own.id);
		if (captured && Math.abs(captured.film[0] - own.film[0]) > 1 / fps + 1e-9) {
			warnings.push(`film data: segment "${own.id}" starts at ${fixed(own.film[0], 3)} s in the authored data but at ${fixed(captured.film[0], 3)} s in the capture; check film.clock_offset_s`);
		}
	}
	const poster = posterTime === undefined ? authored.posterTime : posterTime;
	const data = { version: 1, fps, duration, ...(poster != null && poster > 0 ? { posterTime: poster } : {}), segments, chapters: authored.chapters ?? [] };
	if (manifest?.marks && Object.keys(manifest.marks).length) data.marks = manifest.marks;
	return { data, warnings };
}

/** The provenance sentence: viewport, segments, fps, encoding and the worker/iframe clock note. */
export function provenanceText({ manifest, probe, preset, bytes, filmName }) {
	const parts = [];
	if (manifest) {
		const { width, height, deviceScaleFactor = 1 } = manifest.viewport ?? {};
		const source = path.basename(String(manifest.source?.url ?? "the page"));
		parts.push(`Captured from ${source} at ${width} × ${height}${deviceScaleFactor !== 1 ? ` @${deviceScaleFactor}x` : ""}, ${manifest.fps} fps`);
		parts.push(manifest.segments.map(segment => `${segment.label ?? segment.id}: ${segment.kind}, ${segment.frames} frames, ${fixed(segment.film[1] - segment.film[0])} s`).join("; "));
	} else parts.push(`Supplied film ${filmName}`);
	parts.push(`Encoded ${probe.width} × ${probe.height}, ${fixed(probe.duration)} s${preset ? `, preset ${preset}` : ""}, ${Math.round(bytes / 1024)} KB H.264, no audio`);
	if (manifest?.segments.some(segment => segment.kind === "hold")) parts.push("Held frames are drawn from the page's own clock; worker and iframe clocks are not held");
	if (manifest?.segments.some(segment => segment.kind === "virtual")) parts.push("Virtual frames step the page's animation frames, timers and clocks; worker and iframe clocks are not stepped");
	return `${parts.join(". ")}.`;
}

/** Cue buttons that target `filmId` (or the only film) with their film times: [{ index, film }] by canvas offset. */
function cueThumbSlots(html, filmId, data) {
	const slots = [];
	for (const box of html.matchAll(/<[a-z][\w-]*\b[^>]*\sdata-vpk-cues(?=[\s>=/])[^>]*>/gi)) {
		const target = /data-film-target="([^"]*)"/.exec(box[0])?.[1];
		if (target && target !== filmId) continue;
		const [from, to] = elementRange(html, box.index);
		for (const cue of html.slice(from, to).matchAll(/<button\b[^>]*\sdata-vpk-cue="[^"]*"[^>]*>/gi)) {
			const attr = name => new RegExp(`\\s${name}="([^"]*)"`).exec(cue[0])?.[1];
			let film = attr("data-film") != null ? Number(attr("data-film")) : null;
			if (film == null && attr("data-clock")) {
				try { film = filmFromClock(data, attr("data-clock"), Number(attr("data-t"))); } catch { film = null; }
			}
			const canvas = html.slice(from + cue.index, to).search(/<canvas\b[^>]*class="vpk-cue-thumb"/);
			if (canvas >= 0 && Number.isFinite(film)) slots.push({ index: from + cue.index + canvas, film });
		}
	}
	return slots;
}

/** ffmpeg still time for the frame a click on film time `t` shows. The kit seeks to filmSeekTime (t + 1 ms) and the
 * browser shows the frame on screen at that time; `ffmpeg -ss` returns the first frame at or after its time, so aim a
 * quarter frame before that frame starts. A baked cue thumbnail then previews its click exactly, a cut cue included. */
export function clickStillTime(t, { fps, duration }) {
	const frame = Math.floor(filmSeekTime(t, duration, fps) * fps + 1e-6);
	return Math.max(0, (frame - 0.25) / fps);
}

/** Pure HTML surgery for one embed. `thumbs`: [{ film, src }] or null (keep none). */
export function applyEmbed(html, { filmId = "film-player", videoSrc, poster = null, filmData, provenance, thumbs = null }) {
	let out = html.replace(/<img\b[^>]*class="vpk-cue-thumb"[^>]*>/gi, "");
	if (thumbs?.length) {
		const slots = cueThumbSlots(out, filmId, filmData);
		for (const slot of [...slots].reverse()) {
			const thumb = thumbs.find(item => Math.abs(item.film - slot.film) < 1e-6);
			if (thumb) out = `${out.slice(0, slot.index)}<img class="vpk-cue-thumb" alt="" width="240" height="135" src="${thumb.src}">${out.slice(slot.index)}`;
		}
	}
	const root = filmRootRange(out, filmId);
	const video = /<video\b[^>]*\sdata-vpk-film-video(?=[\s>=/])[^>]*>/i.exec(out.slice(...root));
	if (!video) throw new EmbedError(`embed: film "${filmId}" has no [data-vpk-film-video]`);
	const tagAt = root[0] + video.index;
	const tag = setTagAttribute(setTagAttribute(video[0], "poster", poster), "src", videoSrc);
	out = splice(out, [tagAt, tagAt + video[0].length], tag);
	const range = filmRootRange(out, filmId);
	const island = findJsonIslands(out, "data-vpk-film-data").find(item => item.start >= range[0] && item.end <= range[1]);
	const json = serializeJsonIsland(filmData);
	if (island) out = splice(out, [island.contentStart, island.contentEnd], json);
	else out = splice(out, [range[1] - "</div>".length, range[1] - "</div>".length], `<script type="application/json" data-vpk-film-data>${json}</script>\n`);
	const proof = /<[a-z][\w-]*\b[^>]*\sdata-vpk-film-provenance(?=[\s>=/])[^>]*>/i.exec(out);
	if (proof && provenance != null) {
		const from = proof.index + proof[0].length;
		const name = /^<([a-z][\w-]*)/i.exec(proof[0])[1];
		out = splice(out, [from, out.indexOf(`</${name}>`, from)], escapeLabText(provenance));
	}
	return out;
}

/** "sha256:<12>" of a full copy without the parts WS1's sync-lite keeps current in both files (doc metas, data-vpk-id
 * and data-vpk-revision stamps, review and revisions blocks and islands): the film, prose, figures and runtime. */
export function liteSourceHash(full) {
	let text = ["revisions", "review", "review-content", "review-data"].reduce((html, id) => removeMarkedBlock(html, markerPair(id).start, markerPair(id).end), full);
	text = text.replace(/<script\b[^>]*\sdata-vpk-(?:revisions|review)(?=[\s>])[^>]*>[\s\S]*?<\/script>/gi, "")
		.replace(/<meta\s+name="vpk-doc-(?:id|revision)"[^>]*>/gi, "").replace(/\s(?:data-vpk-id|data-vpk-revision)="[^"]*"/g, "");
	return `sha256:${sha256_12(text)}`;
}

/** Below this lite film target (bytes) the lite copy drops the film for a strip of chapter stills (P3, item 17). */
export const LITE_STRIP_BELOW_BYTES = 120000;
const STRIP_CSS = ".vpk-film-bar[hidden]{display:none}.vpk-film-strip{list-style:none;margin:12px 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}.vpk-film-strip figure{margin:0}.vpk-film-strip img{display:block;width:100%;height:auto;border:1px solid var(--rule)}.vpk-film-strip figcaption{margin-top:4px;color:var(--muted-text);font-family:var(--font-numeric);font-size:12px;line-height:1.3}";

/** The chapter stills of a lite strip: `chapters` (≤ 9, the keyboard's reach), else five evenly spaced frames. */
export function stripTimes(data) {
	const chapters = (data.chapters ?? []).filter(item => Number.isFinite(item.film) && item.film >= 0 && item.film < data.duration).slice(0, 9);
	return chapters.length ? chapters : Array.from({ length: 5 }, (_, index) => ({ label: `Frame ${index + 1}`, film: Math.round(((index * data.duration) / 5) * 100) / 100 }));
}

const stripMarkup = stills => `<ol class="vpk-film-strip" data-vpk-review-ignore aria-label="Film chapters, as stills">${stills.map((still, index) => `<li><figure><img alt="Chapter ${index + 1}: ${escapeLabText(still.label)}, film ${fixed(still.film, 1)} s" width="${still.width}" height="${still.height}" src="${still.src}"><figcaption>${index + 1} · ${escapeLabText(still.label)} · film ${fixed(still.film, 1)} s</figcaption></figure></li>`).join("")}</ol>\n\t\t`;

/** The lite copy of an embedded document: lite film and poster (or, with `stills`, no film and a chapter still strip),
 * variant and source attributes, lite note, no baked thumbs, no review-data block unless keepReview. Everything WS1
 * owns (metas, ids, revisions) is kept. */
export function liteVariant(full, { filmId = "film-player", videoSrc, poster, filmData, provenance, slug, width, height, keepReview = false, stills = null }) {
	let out = applyEmbed(full, { filmId, videoSrc: stills ? null : videoSrc, poster, filmData, provenance, thumbs: null });
	out = out.replace(/<html\b[^>]*>/i, tag => setTagAttribute(setTagAttribute(tag, "data-vpk-lite-source", liteSourceHash(full)), "data-vpk-variant", "lite"));
	const root = filmRootRange(out, filmId);
	const island = findJsonIslands(out, "data-vpk-film-data").find(item => item.start >= root[0] && item.end <= root[1]);
	// Static build output, so data-vpk-review-ignore only: kit init removes [data-vpk-generated] inside kit roots.
	const text = stills
		? `Lite copy: the film is left out so viewers that cap file size can open it; the chapter stills below stand in for it. The full copy plays it: ${escapeLabText(slug)}.html.`
		: `Lite copy: the film is re-encoded at ${width} × ${height} so viewers that cap file size can open it. The full copy is ${escapeLabText(slug)}.html.`;
	out = splice(out, [island.start, island.start], `<p class="vpk-film-lite-note" data-vpk-review-ignore>${text}</p>\n\t\t${stills ? stripMarkup(stills) : ""}`);
	if (stills) {
		// No film: the kit shows its empty state, so say why; hide the dead controls; the strip's own CSS goes in the head (lab.css is at its cap).
		out = out.replace(/(<p\b[^>]*\sdata-vpk-film-empty(?=[\s>=/])[^>]*>)[^<]*(<\/p>)/i, (_, open, close) => `${open}The film is left out of this lite copy; the chapter stills below stand in for it.${close}`)
			.replace(/<div class="vpk-film-bar">/, () => '<div class="vpk-film-bar" hidden>')
			.replace("</head>", () => `<style data-vpk-lite-strip>${STRIP_CSS}</style>\n</head>`);
	}
	if (!keepReview) {
		const { start, end } = markerPair("review-data");
		out = removeMarkedBlock(out, start, end);
		for (const review of findJsonIslands(out, "data-vpk-review").reverse()) out = splice(out, [review.start, review.end], "");
	}
	return out;
}

/** Real tools: ffprobe, still frames (ffmpeg → cwebp, or the mjpeg fallback) and the lite encoder. */
export function defaultTools({ tmp }) {
	const ffmpeg = findTool("ffmpeg");
	if (!ffmpeg) throw new EmbedError("embed: ffmpeg is not on PATH (install ffmpeg 5 or later)");
	let n = 0;
	return {
		probe: file => probeFilm(file),
		still({ film, time, width, quality }) {
			const plan = buildStillPlan({ input: film, time, output: path.join(tmp, `still-${(n += 1)}.webp`), width, quality });
			const png = spawnSync(ffmpeg, plan.ffmpeg, { maxBuffer: 64 * 1024 * 1024 });
			if (png.status !== 0) throw new EmbedError(`embed: ffmpeg could not read a frame at ${time} s: ${String(png.stderr).trim()}`);
			if (plan.tool === "cwebp") {
				const webp = spawnSync(plan.cwebpPath, plan.cwebp, { input: png.stdout });
				if (webp.status !== 0) throw new EmbedError(`embed: cwebp failed: ${String(webp.stderr).trim()}`);
			}
			return { mime: plan.mime, buffer: fs.readFileSync(plan.output) };
		},
		encodeLite({ input, output, targetBytes }) {
			return encodeFilm({ input, output, preset: "lite", targetBytes });
		},
	};
}

/**
 * Embed `film` into `htmlFile`. → { html, lines, warnings, weight, lite: { path, bytes } | null }. Writes nothing when
 * dryRun. `tools` (probe, still, encodeLite) are injectable for tests.
 */
export async function embedDocument(options) {
	const { htmlFile, film, manifest: manifestFile = null, filmId = "film-player", posterTime = null, poster: posterFile = null, noPoster = false, bakeThumbs = false, lite = "auto", liteKeepReview = false, budgetBytes = DATA_URL_SAFE_HTML_BYTES, roots = [], cwd = process.cwd(), tmpdir = os.tmpdir(), dryRun = false } = options;
	if (!["auto", "always", "never"].includes(lite)) throw new EmbedError(`--lite must be auto, always or never (got ${lite})`);
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-embed-"));
	try {
		const tools = options.tools ?? defaultTools({ tmp });
		const htmlPath = path.resolve(cwd, htmlFile);
		const fence = fenceRoots({ htmlFile: htmlPath, cwd, roots, tmpdir });
		const lines = [];
		const read = file => {
			const entry = checkFencedInput(file, { roots: fence, cwd });
			const buffer = fs.readFileSync(entry.path);
			lines.push(describeEmbedded(entry, buffer));
			return { entry, buffer };
		};
		if (/\.hq\.mp4$/i.test(film)) throw new EmbedError(`embed: ${path.basename(film)} is the hq deliverable (1920 wide), never embedded; embed the film preset's film.mp4 instead`);
		const filmIn = read(film);
		const manifest = manifestFile ? JSON.parse(read(manifestFile).buffer.toString("utf8")) : null;
		const encodeRecordFile = path.join(path.dirname(filmIn.entry.path), "encode.json");
		const record = fs.existsSync(encodeRecordFile) ? JSON.parse(fs.readFileSync(encodeRecordFile, "utf8")) : null;
		const probe = tools.probe(filmIn.entry.path);
		const html = fs.readFileSync(htmlPath, "utf8");
		const root = filmRootRange(html, filmId);
		const island = findJsonIslands(html, "data-vpk-film-data").find(item => item.start >= root[0] && item.end <= root[1]);
		const authored = island ? parseJsonIsland(island.raw) : {};
		const at = Number(posterTime ?? authored.posterTime ?? 0);
		// J5: until the first play the kit reports the poster frame's film time, so the film data names it. A baked still
		// is film `at`; a custom image only has a time when --poster-time says so; --no-poster keeps the authored time.
		const { data, warnings } = mergeCaptureData(authored, manifest, { duration: probe.duration, posterTime: posterFile ? posterTime : noPoster ? undefined : at });
		const still = (source, time, preset) => {
			const shot = tools.still({ film: source, time, ...preset });
			return dataUrl(shot.mime, shot.buffer);
		};
		let posterSrc = null;
		if (posterFile) posterSrc = dataUrl(MIME[path.extname(posterFile).toLowerCase()] ?? "image/webp", read(posterFile).buffer);
		else if (!noPoster) posterSrc = still(filmIn.entry.path, at, STILLS.poster);
		const thumbs = bakeThumbs ? cueThumbSlots(html, filmId, data).map(slot => ({ film: slot.film, src: still(filmIn.entry.path, clickStillTime(slot.film, data), STILLS.thumb) })) : null;
		const filmName = path.basename(filmIn.entry.relative);
		const provenance = provenanceText({ manifest, probe, preset: record?.preset ?? null, bytes: filmIn.entry.bytes, filmName });
		const videoSrc = dataUrl("video/mp4", filmIn.buffer);
		const out = applyEmbed(html, { filmId, videoSrc, poster: posterSrc, filmData: data, provenance, thumbs });
		const dead = collectFilmClockIssues(out);
		if (dead.length) throw new EmbedError(`embed: nothing written: ${dead.join("; ")}`);
		if (!dryRun && out !== html) fs.writeFileSync(htmlPath, out);
		const weight = measureHtmlWeight(out);
		lines.push(`weight: ${path.relative(cwd, htmlPath)} ${formatHtmlWeight(weight)}; budget ${formatMB(budgetBytes)}`);
		warnings.push(...weightWarnings(out, { label: path.relative(cwd, htmlPath), budgetBytes }));
		let liteResult = null;
		const slug = path.basename(htmlPath).replace(/\.html?$/i, "");
		const litePath = path.join(path.dirname(htmlPath), `${slug}.lite.html`);
		if (lite === "always" || (lite === "auto" && weight.bytes > budgetBytes)) {
			const targetBytes = liteFilmTargetBytes({ htmlBytes: weight.bytes, filmDataUrlChars: videoSrc.length, budgetBytes });
			// Below 120 KB a 640-wide film is unwatchable, so the lite copy drops it for a strip of chapter stills (item 17).
			const strip = targetBytes < LITE_STRIP_BELOW_BYTES;
			const litePosterSrc = posterFile || noPoster ? posterSrc : still(filmIn.entry.path, at, STILLS.litePoster);
			let encoded = { bytes: 0, retried: false };
			let liteHtml;
			if (strip) {
				const stills = stripTimes(data).map(chapter => ({ ...chapter, width: STILLS.strip.width, height: Math.round((STILLS.strip.width * probe.height) / probe.width), src: still(filmIn.entry.path, Math.min(chapter.film + 0.05, Math.max(0, data.duration - 0.05)), STILLS.strip) }));
				liteHtml = liteVariant(out, { filmId, slug, keepReview: liteKeepReview, filmData: data, poster: litePosterSrc, stills, provenance: `${provenance} Lite copy: no film, ${stills.length} chapter stills at ${STILLS.strip.width} px.` });
			} else {
				const liteFilm = path.join(tmp, `${slug}.lite.mp4`);
				encoded = tools.encodeLite({ input: filmIn.entry.path, output: liteFilm, targetBytes });
				const liteProbe = tools.probe(liteFilm);
				liteHtml = liteVariant(out, {
					filmId, slug, keepReview: liteKeepReview, filmData: data, width: liteProbe.width, height: liteProbe.height,
					videoSrc: dataUrl("video/mp4", fs.readFileSync(liteFilm)), poster: litePosterSrc,
					provenance: `${provenance} Lite copy: re-encoded ${liteProbe.width} × ${liteProbe.height}, ${Math.round(encoded.bytes / 1024)} KB${encoded.retried ? " (second pass at 0.85× target)" : ""}.`,
				});
			}
			const liteBytes = Buffer.byteLength(liteHtml);
			const check = validateHtmlString(liteHtml, `${slug}.lite.html`);
			if (liteBytes > budgetBytes) throw new EmbedError(strip
				? `no lite copy: the page is ${liteBytes} B even with the film replaced by chapter stills, over the ${budgetBytes} B budget (the film target was ${Math.max(0, targetBytes)} B); move other media out of the HTML or pass a larger --budget-bytes`
				: `lite film still exceeds the budget after one retry; pass --budget-bytes or shorten the film (${slug}.lite.html is ${liteBytes} B, budget ${budgetBytes} B)`);
			if (!check.ok) throw new EmbedError(`${slug}.lite.html fails check-html: ${check.failures.join("; ")}`);
			if (!dryRun) fs.writeFileSync(litePath, liteHtml);
			liteResult = { path: litePath, bytes: liteBytes, filmBytes: encoded.bytes, retried: encoded.retried, strip };
			lines.push(`lite: ${path.relative(cwd, litePath)} ${formatMB(liteBytes)} (${strip ? `chapter still strip, film target ${Math.round(targetBytes / 1024)} KB is below ${Math.round(LITE_STRIP_BELOW_BYTES / 1000)} KB` : `film ${Math.round(encoded.bytes / 1024)} KB, target ${Math.round(targetBytes / 1024)} KB${encoded.retried ? ", retried" : ""}`})`);
		} else if (fs.existsSync(litePath)) {
			// A lite copy from an earlier embed of another film or other content (or one that predates the record).
			const recorded = /<html\b[^>]*\sdata-vpk-lite-source="([^"]*)"/i.exec(fs.readFileSync(litePath, "utf8"))?.[1] ?? null;
			const source = liteSourceHash(out);
			if (recorded !== source) warnings.push(`stale lite copy: ${path.relative(cwd, litePath)} was made from another version of ${path.basename(htmlPath)} (film or content changed; recorded ${recorded ?? "none"}, now ${source}) and is not rewritten, because ${lite === "never" ? "--lite never was passed" : `the full copy is under the ${formatMB(budgetBytes)} budget`}; delete it, or re-run with --lite always to refresh it`);
		}
		return { html: out, lines, warnings, weight, lite: liteResult };
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
}

function parseArgs(argv) {
	const args = { roots: [], lite: "auto" };
	const values = { "--film": "film", "--manifest": "manifest", "--film-id": "filmId", "--poster-time": "posterTime", "--poster": "poster", "--lite": "lite", "--budget-bytes": "budgetBytes", "--root": "root" };
	const flags = { "--no-poster": "noPoster", "--bake-thumbs": "bakeThumbs", "--lite-keep-review": "liteKeepReview", "--dry-run": "dryRun" };
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg in flags) args[flags[arg]] = true;
		else if (arg in values) {
			const value = argv[(index += 1)];
			if (value == null) throw new EmbedError(`${arg} needs a value`);
			if (arg === "--root") args.roots.push(value);
			else args[values[arg]] = ["--poster-time", "--budget-bytes"].includes(arg) ? Number(value) : value;
		} else if (arg.startsWith("--")) throw new EmbedError(`unknown flag ${arg}`);
		else if (args.htmlFile) throw new EmbedError(`one HTML file only (got ${args.htmlFile} and ${arg})`);
		else args.htmlFile = arg;
	}
	if (!args.htmlFile || !args.film) throw new EmbedError("Usage: embed.mjs <file.html> --film <film.mp4> [--manifest <capture.json>] [--lite auto|always|never] …");
	if (args.poster && args.noPoster) throw new EmbedError("--poster and --no-poster are exclusive");
	return args;
}

async function main(argv) {
	const result = await embedDocument(parseArgs(argv));
	result.lines.forEach(line => console.log(line));
	result.warnings.forEach(line => console.warn(`warn ${line}`));
	return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	main(process.argv.slice(2)).then(code => { process.exitCode = code; }, error => {
		console.error(error.message);
		process.exitCode = 1;
	});
}
