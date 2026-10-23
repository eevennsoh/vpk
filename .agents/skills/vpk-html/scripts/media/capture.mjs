#!/usr/bin/env node
// vpk-html media · capture: drive a page into deterministic JPEG frames for encode.mjs (references/media-pipeline.md).
//
//   node .agents/skills/vpk-html/scripts/media/capture.mjs <spec.mjs|spec.json> [--frames-dir <dir>] [--manifest-dir <dir>]
//        [--only <id,…>] [--cursor] [--headed] [--dry-run]
//   node .agents/skills/vpk-html/scripts/media/capture.mjs --url <url> [--hold "<expr with t>" | --virtual] [--start 0] --end <s>
//        [--fps 30] [--viewport 1920x1080] [--dpr 1] [--ready-selector <css>] [--settle-ms 50] [--wait-ms 2000] [--segment-id clock]
//        [--live <s> | --drive <module.mjs>] [--cursor] [--frames-dir <dir>] [--manifest-dir <dir>] [--dry-run]
//
// Frames go to <repo>/output/vpk-html-capture/<name>/ (or <tmpdir>/vpk-html-capture/<name>/ outside the VPK repo,
// ws6 C14), whatever the cwd, so running from <slug>/_film/ is safe. They are disposable and refused anywhere under an
// artifacts/ folder. <name> is the spec's stem; the canonical _film/capture.spec.mjs takes the slug's name. capture.json
// goes to the manifest dir, which defaults to the spec's folder (for an artifact, <slug>/_film/). --frames-dir and
// --manifest-dir resolve against the cwd; framesDir/manifestDir fields in a spec resolve against the spec's folder.
// Playwright is imported only inside runCapture() (capture-run.mjs), so importing this module launches nothing. Run
// captures unsandboxed. Hold frames: hold(t), two animation frames, settleMs, a JPEG screenshot. Virtual frames: the
// page's rAF, timers, Date and performance.now stepped 1/fps at a time (capture-clock.mjs). Screencasts: CDP
// Page.startScreencast frames with their timestamps while the driver (or --live seconds) runs; the last frame lasts
// until the screencast stopped, so a page that settles keeps its still tail. A drive gets { page, mark, glide }; with
// `cursor` (or --cursor) a grayscale arrow follows the mouse and glide(x, y, ms) moves it along an eased path.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveRepoRoot } from "../repo-root.mjs";
import { normalizeCursor } from "./capture-clock.mjs";
import { checkHoldHook, runCapture, runHook } from "./capture-run.mjs";
import { markFilmTimes, segmentFilmRanges } from "./ffconcat.mjs";

// main() calls runCapture, so it needs the local binding that `export … from` would not create.
export { checkHoldHook, runCapture, runHook };

/** The default hold hook (C8): the page's rehearsal clock. Evaluated as `(async (t) => { <expr>; })(t)`. */
export const DEFAULT_HOLD_EXPR = "await window.__vpkRehearsal.hold(t)";
export const CAPTURE_DEFAULTS = Object.freeze({
	fps: 30, viewport: Object.freeze({ width: 1920, height: 1080 }), deviceScaleFactor: 1, jpegQuality: 90,
	colorScheme: "light", reducedMotion: "no-preference", settleMs: 50, readyTimeoutMs: 30000,
});
const SEGMENT_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const round6 = value => Math.round(value * 1e6) / 1e6;

export class CaptureSpecError extends Error {}
const fail = message => { throw new CaptureSpecError(`capture spec: ${message}`); };

function numberIn(value, name, { min = -Infinity, max = Infinity, integer = false } = {}) {
	const number = Number(value);
	if (!Number.isFinite(number) || number < min || number > max || (integer && !Number.isInteger(number))) fail(`${name} must be ${integer ? "an integer" : "a number"} in [${min}, ${max}]`);
	return number;
}

function hook(value, name) {
	if (value != null && typeof value !== "function" && typeof value !== "string") fail(`${name} must be a function or an expression string`);
	return value ?? null;
}

/** Parse "1920x1080" or `{ width, height }`. */
export function parseViewport(value) {
	const [width, height] = typeof value === "string" ? value.split(/x/i).map(Number) : [value?.width, value?.height];
	return { width: numberIn(width, "viewport width", { min: 1, max: 7680, integer: true }), height: numberIn(height, "viewport height", { min: 1, max: 4320, integer: true }) };
}

function normalizeUrl(value, baseDir) {
	if (typeof value !== "string" || !value.trim()) fail("url is required");
	const url = value.trim();
	if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) return pathToFileURL(path.resolve(baseDir, url)).href;
	if (!/^(?:https?|file):/i.test(url)) fail(`url must be http(s), file or a path: ${url}`);
	return url;
}

/** Frame count of a hold segment: frames i = 0 … round((end − start) · fps), inclusive. */
export function holdFrameCount({ start, end }, fps) {
	return Math.round((end - start) * fps) + 1;
}

/** Clock time of each hold frame: u = i/fps, t = timeMap ? timeMap(u) : start + u. */
export function holdFrameTimes(segment, fps) {
	return Array.from({ length: holdFrameCount(segment, fps) }, (_, index) => {
		const u = index / fps;
		return segment.timeMap ? Number(segment.timeMap(u)) : segment.start + u;
	});
}

/** The page expression for one hold frame. */
export function holdExpression(expression, t) {
	return `(async (t) => { ${expression}; })(${JSON.stringify(t)})`;
}

function normalizeSegment(raw, index, { fps, baseDir }) {
	if (!raw || typeof raw !== "object") fail(`segments[${index}] must be an object`);
	const id = String(raw.id ?? `segment-${index + 1}`);
	if (!SEGMENT_ID.test(id)) fail(`segment id "${id}" must match ${SEGMENT_ID}`);
	const label = String(raw.label ?? id);
	if (raw.kind === "hold" || raw.kind === "virtual") {
		const start = numberIn(raw.start ?? 0, `segment "${id}" start`, { min: raw.kind === "virtual" ? 0 : -Infinity });
		const end = numberIn(raw.end, `segment "${id}" end`);
		if (!(end > start)) fail(`segment "${id}": end (${end}) must be greater than start (${start})`);
		if (raw.kind === "virtual") {
			if (raw.timeMap != null || raw.hold != null) fail(`segment "${id}": a virtual segment runs on the page's own stepped clock; timeMap and hold belong to hold segments`);
			const segment = { id, kind: "virtual", label, start, end, arm: hook(raw.arm, `segment "${id}" arm`), release: hook(raw.release, `segment "${id}" release`), settleMs: numberIn(raw.settleMs ?? CAPTURE_DEFAULTS.settleMs, `segment "${id}" settleMs`, { min: 0, max: 60000 }) };
			return { ...segment, frames: holdFrameCount(segment, fps) };
		}
		if (raw.timeMap != null && typeof raw.timeMap !== "function") fail(`segment "${id}": timeMap must be a function (use a .mjs spec)`);
		const segment = {
			id, kind: "hold", label, start, end,
			hold: hook(raw.hold, `segment "${id}" hold`) ?? DEFAULT_HOLD_EXPR,
			arm: hook(raw.arm, `segment "${id}" arm`), release: hook(raw.release, `segment "${id}" release`),
			timeMap: raw.timeMap ?? null,
			settleMs: numberIn(raw.settleMs ?? CAPTURE_DEFAULTS.settleMs, `segment "${id}" settleMs`, { min: 0, max: 60000 }),
		};
		return { ...segment, frames: holdFrameCount(segment, fps) };
	}
	if (raw.kind === "screencast") {
		const drive = typeof raw.drive === "string" ? path.resolve(baseDir, raw.drive) : hook(raw.drive, `segment "${id}" drive`);
		const live = raw.live == null ? null : numberIn(raw.live, `segment "${id}" live`, { min: 0.1, max: 600 });
		if (!drive && live == null) fail(`segment "${id}": a screencast needs drive (function or module path) or live seconds`);
		return { id, kind: "screencast", label, drive, live, trimStartFrames: numberIn(raw.trimStartFrames ?? 0, `segment "${id}" trimStartFrames`, { min: 0, integer: true }) };
	}
	return fail(`segment "${id}": unknown kind "${raw.kind}" (hold, virtual or screencast)`);
}

const GENERIC_STEM = /^(?:capture|spec)$/i;
const slugName = value => String(value ?? "").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");

/** The stem of a spec file; a generic one (capture.spec.mjs, capture.mjs) names the slug: the parent of _film/, else the folder. */
function specName(specFile) {
	const stem = path.basename(specFile).replace(/\.(?:mjs|json)$/i, "").replace(/(?:\.capture|\.spec)+$/i, "");
	if (!GENERIC_STEM.test(stem)) return stem;
	const dir = path.dirname(specFile);
	return path.basename(dir) === "_film" ? path.basename(path.dirname(dir)) : path.basename(dir);
}

function captureName(spec, specFile, url) {
	const fromUrl = () => url.startsWith("file:") ? path.basename(fileURLToPath(url)).replace(/\.html?$/i, "") : new URL(url).host;
	return slugName(spec.name) || (specFile ? slugName(specName(specFile)) : "") || slugName(fromUrl()) || "capture";
}

/** Where default frames live: <repo>/output/vpk-html-capture, else <tmpdir>/vpk-html-capture. Never the cwd. */
export function defaultCaptureRoot({ repoRoot = resolveRepoRoot(), tmpdir = os.tmpdir() } = {}) {
	return repoRoot ? path.join(repoRoot, "output", "vpk-html-capture") : path.join(tmpdir, "vpk-html-capture");
}

/** True when an absolute `dir` has an artifacts/ segment; inside the repo only the part below the repo root counts. */
export function isUnderArtifacts(dir, { repoRoot = null } = {}) {
	const relative = repoRoot ? path.relative(repoRoot, dir) : null;
	const inside = relative != null && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
	return (inside ? relative : dir).split(path.sep).some(segment => segment.toLowerCase() === "artifacts");
}

/**
 * Validate a capture spec and fill defaults. `specPath`, `framesDir` and `manifestDir` (the CLI flags) resolve against
 * `cwd`; a relative `url`, a string `drive` and the spec's own framesDir/manifestDir resolve against the spec's folder.
 * Default frames go under defaultCaptureRoot({ repoRoot, tmpdir }), never the cwd, and no frames dir may sit under
 * artifacts/. Throws CaptureSpecError.
 */
export function normalizeSpec(spec, { specPath = null, cwd = process.cwd(), framesDir, manifestDir, only, repoRoot = resolveRepoRoot(), tmpdir = os.tmpdir() } = {}) {
	if (!spec || typeof spec !== "object") fail("expected an object");
	const specFile = specPath ? path.resolve(cwd, specPath) : null;
	const baseDir = specFile ? path.dirname(specFile) : cwd;
	const url = normalizeUrl(spec.url, baseDir);
	const fps = numberIn(spec.fps ?? CAPTURE_DEFAULTS.fps, "fps", { min: 1, max: 120 });
	if (!Array.isArray(spec.segments) || !spec.segments.length) fail("segments must be a non-empty array");
	let segments = spec.segments.map((raw, index) => normalizeSegment(raw, index, { fps, baseDir }));
	const ids = segments.map(segment => segment.id);
	if (new Set(ids).size !== ids.length) fail(`segment ids must be unique (${ids.join(", ")})`);
	if (only != null) {
		const wanted = (Array.isArray(only) ? only : String(only).split(",")).map(item => item.trim()).filter(Boolean);
		const unknown = wanted.filter(id => !ids.includes(id));
		if (unknown.length) fail(`--only names unknown segments: ${unknown.join(", ")}`);
		segments = segments.filter(segment => wanted.includes(segment.id));
	}
	const name = captureName(spec, specFile, url);
	const fallback = path.join(defaultCaptureRoot({ repoRoot, tmpdir }), name);
	let frames = fallback;
	if (framesDir != null) frames = path.resolve(cwd, String(framesDir));
	else if (spec.framesDir != null) frames = path.resolve(baseDir, String(spec.framesDir));
	if (isUnderArtifacts(frames, { repoRoot })) fail(`frames are disposable and never go under artifacts/ (${frames}); drop the frames dir to use ${fallback}`);
	const ready = typeof spec.ready === "function" ? spec.ready : {
		selector: spec.ready?.selector ?? null,
		timeoutMs: numberIn(spec.ready?.timeoutMs ?? CAPTURE_DEFAULTS.readyTimeoutMs, "ready.timeoutMs", { min: 0 }),
		settleMs: numberIn(spec.ready?.settleMs ?? 0, "ready.settleMs", { min: 0 }),
	};
	const colorScheme = spec.colorScheme ?? CAPTURE_DEFAULTS.colorScheme;
	if (!["light", "dark", "no-preference"].includes(colorScheme)) fail(`colorScheme "${colorScheme}" must be light, dark or no-preference`);
	const reducedMotion = spec.reducedMotion ?? CAPTURE_DEFAULTS.reducedMotion;
	if (!["reduce", "no-preference"].includes(reducedMotion)) fail(`reducedMotion "${reducedMotion}" must be reduce or no-preference`);
	const viewport = parseViewport(spec.viewport ?? CAPTURE_DEFAULTS.viewport);
	return {
		name, url, fps, segments, ready, colorScheme, reducedMotion, viewport,
		cursor: normalizeCursor(spec.cursor, viewport, message => fail(`cursor: ${message}`)),
		deviceScaleFactor: numberIn(spec.deviceScaleFactor ?? spec.dpr ?? CAPTURE_DEFAULTS.deviceScaleFactor, "deviceScaleFactor", { min: 0.5, max: 4 }),
		jpegQuality: numberIn(spec.jpegQuality ?? CAPTURE_DEFAULTS.jpegQuality, "jpegQuality", { min: 1, max: 100, integer: true }),
		launch: { args: [...(spec.launch?.args ?? [])] },
		ignoreHTTPSErrors: Boolean(spec.ignoreHTTPSErrors),
		framesDir: frames,
		manifestDir: manifestDir != null ? path.resolve(cwd, String(manifestDir)) : path.resolve(baseDir, String(spec.manifestDir ?? (specFile ? "." : frames))),
		specPath: specFile,
	};
}

/** The `--url` shorthand: one hold segment on the rehearsal hook, a `virtual` one (--virtual), or one screencast for --live / --drive, with id and label segmentId (default "clock", as the IR's film.clock_id). */
export function specFromUrlArgs({ url, hold, start = 0, end, fps = 30, viewport = "1920x1080", dpr = 1, readySelector = null, settleMs = 50, waitMs = 2000, live, drive, virtual = false, cursor = false, segmentId: id = "clock" }) {
	let segment;
	if (drive) segment = { id, kind: "screencast", label: id, drive };
	else if (live != null && hold == null && !virtual) segment = { id, kind: "screencast", label: id, live };
	else if (virtual) segment = { id, kind: "virtual", label: id, start, end, settleMs };
	else segment = { id, kind: "hold", label: id, start, end, hold: hold ?? DEFAULT_HOLD_EXPR, settleMs };
	return { url, fps, viewport, deviceScaleFactor: dpr, cursor, ready: { selector: readySelector, settleMs: waitMs }, segments: [segment] };
}

/**
 * capture.json from a normalised spec and per-segment results `{ id, frames, durations?, times?, marks?, firstFrame? }`.
 * Hold segments get a `linear` clock (`samples` when a timeMap ran); screencasts get `real`. film[1] − film[0] is
 * frames/fps for holds and the summed frame durations for screencasts.
 */
export function buildCaptureManifest(spec, results, { errors = [], ffconcat = null } = {}) {
	const byId = new Map(spec.segments.map(segment => [segment.id, segment]));
	const unknown = results.filter(result => !byId.has(result.id)).map(result => result.id);
	if (unknown.length) fail(`results name unknown segments: ${unknown.join(", ")}`);
	const ranged = segmentFilmRanges(results.map(result => ({ ...byId.get(result.id), ...result })), { fps: spec.fps });
	const segments = ranged.map(segment => {
		let clock = { kind: "real" };
		if (segment.kind === "hold" && segment.timeMap) clock = { kind: "samples", samples: (segment.times ?? holdFrameTimes(segment, spec.fps)).map((t, index) => [round6(index / spec.fps), round6(t)]) };
		else if (segment.kind !== "screencast") clock = { kind: "linear", start: segment.start, rate: 1 };
		return { id: segment.id, label: segment.label, kind: segment.kind, film: segment.film, clock, frames: segment.frames, ...(segment.firstFrame ? { firstFrame: segment.firstFrame } : {}) };
	});
	const sourceUrl = spec.url.startsWith("file:") ? path.relative(spec.manifestDir, fileURLToPath(spec.url)).split(path.sep).join("/") : spec.url;
	return {
		version: 1, tool: "vpk-html/media/capture.mjs", fps: spec.fps, duration: segments.at(-1)?.film[1] ?? 0, segments,
		marks: markFilmTimes(ranged, { fps: spec.fps }),
		viewport: { ...spec.viewport, deviceScaleFactor: spec.deviceScaleFactor },
		frames: segments.reduce((sum, segment) => sum + segment.frames, 0),
		errors: errors.slice(0, 20).map(String),
		source: {
			url: sourceUrl,
			...(spec.specPath ? { spec: path.relative(spec.manifestDir, spec.specPath).split(path.sep).join("/") } : {}),
			...(ffconcat ? { ffconcat: path.relative(spec.manifestDir, ffconcat).split(path.sep).join("/") } : {}),
		},
	};
}

/** Parse the CLI flags into `{ specFile?, url?, …, framesDir, manifestDir, only, headed, dryRun }`. */
export function parseCaptureArgs(argv) {
	const args = { headed: false, dryRun: false };
	const numeric = { "--start": "start", "--end": "end", "--fps": "fps", "--dpr": "dpr", "--settle-ms": "settleMs", "--wait-ms": "waitMs", "--live": "live" };
	const strings = { "--url": "url", "--hold": "hold", "--viewport": "viewport", "--ready-selector": "readySelector", "--drive": "drive", "--segment-id": "segmentId", "--frames-dir": "framesDir", "--manifest-dir": "manifestDir", "--only": "only" };
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--headed") args.headed = true;
		else if (arg === "--dry-run") args.dryRun = true;
		else if (arg === "--virtual" || arg === "--cursor") args[arg.slice(2)] = true;
		else if (arg in numeric || arg in strings) {
			const value = argv[(index += 1)];
			if (value == null) fail(`${arg} needs a value`);
			if (arg in numeric) args[numeric[arg]] = numberIn(value, arg);
			else args[strings[arg]] = value;
		} else if (arg.startsWith("--")) fail(`unknown flag ${arg}`);
		else if (args.specFile) fail(`one spec file only (got ${args.specFile} and ${arg})`);
		else args.specFile = arg;
	}
	if (!args.specFile === !args.url) fail("pass a spec file or --url, not both and not neither");
	if (args.specFile && args.segmentId != null) fail("--segment-id names the --url segment; a spec file names its own segments");
	if (args.specFile && args.virtual) fail("--virtual makes the --url segment virtual; a spec file sets kind: \"virtual\" itself");
	return args;
}

/** Load a `.mjs` (default export, may hold functions) or `.json` (expression strings only) spec. */
export async function loadCaptureSpec(file) {
	const absolute = path.resolve(process.cwd(), file);
	if (/\.json$/i.test(absolute)) return JSON.parse(fs.readFileSync(absolute, "utf8"));
	const loaded = await import(pathToFileURL(absolute).href);
	return loaded.default ?? fail(`${file} has no default export`);
}

function describePlan(spec) {
	const lines = [`capture ${spec.name}: ${spec.url}`, `  ${spec.viewport.width}x${spec.viewport.height} @${spec.deviceScaleFactor}x, ${spec.fps} fps, ${spec.colorScheme}${spec.cursor ? `, cursor overlay ${spec.cursor.size} px` : ""}`];
	for (const segment of spec.segments) {
		lines.push(segment.kind !== "screencast"
			? `  ${segment.kind} ${segment.id}: t ${segment.start}–${segment.end} s, ${segment.frames} frames, film ${round6(segment.frames / spec.fps)} s`
			: `  screencast ${segment.id}: ${segment.live != null ? `live ${segment.live} s` : "driven"}, trim ${segment.trimStartFrames}`);
	}
	lines.push(`  frames → ${shownPath(spec.framesDir)}`, `  manifest → ${path.join(shownPath(spec.manifestDir), "capture.json")}`);
	return lines.join("\n");
}

/** cwd-relative below the cwd, absolute elsewhere (the default frames dir sits at the repo root, not beside _film/). */
function shownPath(dir) {
	const relative = path.relative(process.cwd(), dir);
	if (!relative) return ".";
	return relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) ? dir : relative;
}

async function main(argv) {
	const args = parseCaptureArgs(argv);
	const loaded = args.specFile ? await loadCaptureSpec(args.specFile) : specFromUrlArgs(args);
	const raw = args.cursor && args.specFile ? { ...loaded, cursor: loaded.cursor ?? true } : loaded;
	const spec = normalizeSpec(raw, { specPath: args.specFile ?? null, framesDir: args.framesDir, manifestDir: args.manifestDir, only: args.only });
	console.log(describePlan(spec));
	if (args.dryRun) return 0;
	const { manifest, manifestPath, ffconcat } = await runCapture(spec, { headed: args.headed });
	console.log(`✓ captured ${manifest.frames} frames, film ${manifest.duration.toFixed(3)} s → ${shownPath(ffconcat)}`);
	console.log(`  manifest ${shownPath(manifestPath)}${manifest.errors.length ? ` (${manifest.errors.length} page errors recorded)` : ""}`);
	return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	main(process.argv.slice(2)).then(code => {
		process.exitCode = code;
	}, error => {
		console.error(error.message);
		process.exitCode = 1;
	});
}
