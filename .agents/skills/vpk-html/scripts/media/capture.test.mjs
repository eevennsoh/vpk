import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
	CAPTURE_DEFAULTS,
	CaptureSpecError,
	DEFAULT_HOLD_EXPR,
	buildCaptureManifest,
	checkHoldHook,
	defaultCaptureRoot,
	holdExpression,
	holdFrameCount,
	holdFrameTimes,
	isUnderArtifacts,
	loadCaptureSpec,
	normalizeSpec,
	parseCaptureArgs,
	parseViewport,
	specFromUrlArgs,
} from "./capture.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const CAPTURE = path.join(here, "capture.mjs");
const ROOT = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "vpk-capture-test-")));
const SPEC_DIR = path.join(ROOT, "artifacts", "vpk-html", "demo", "_film");
const SPEC_PATH = path.join(SPEC_DIR, "rehearsal-target.capture.mjs");
const HOLD = { url: "../rehearsal-target.html", segments: [{ id: "throws", kind: "hold", label: "three throws", start: 0, end: 6 }] };
// ROOT stands in for the repo root, so no default frames dir points at the real checkout.
const AT_ROOT = { cwd: ROOT, repoRoot: ROOT };
const node = (args, options = {}) => spawnSync(process.execPath, args, { encoding: "utf8", env: { ...process.env, OPENSSL_CONF: "/dev/null" }, ...options });
const framesLine = stdout => stdout.match(/^ {2}frames → (.+)$/m)?.[1];

test.after(() => fs.rmSync(ROOT, { recursive: true, force: true }));

test("importing capture.mjs never resolves Playwright", () => {
	const script = `
		import { registerHooks } from "node:module";
		const seen = [];
		registerHooks({ resolve(specifier, context, next) { if (/playwright/i.test(specifier)) seen.push(specifier); return next(specifier, context); } });
		const capture = await import(${JSON.stringify(pathToFileURL(CAPTURE).href)});
		capture.normalizeSpec({ url: "https://example.com/", segments: [{ id: "a", kind: "hold", end: 1 }] }, { cwd: ${JSON.stringify(ROOT)} });
		console.log(JSON.stringify(seen));`;
	const run = node(["--input-type=module", "-e", script]);
	assert.equal(run.status, 0, run.stderr);
	assert.equal(run.stdout.trim(), "[]");
	assert.doesNotMatch(fs.readFileSync(CAPTURE, "utf8"), /^import\b.*playwright/im, "no static Playwright import");
});

test("normalizeSpec fills the documented defaults", () => {
	const spec = normalizeSpec(HOLD, { specPath: SPEC_PATH, ...AT_ROOT });
	assert.equal(spec.fps, 30);
	assert.deepEqual(spec.viewport, { width: 1920, height: 1080 });
	assert.equal(spec.deviceScaleFactor, 1);
	assert.equal(spec.jpegQuality, 90);
	assert.equal(spec.colorScheme, "light");
	assert.equal(spec.reducedMotion, "no-preference");
	assert.deepEqual(spec.launch, { args: [] });
	assert.equal(spec.ignoreHTTPSErrors, false);
	assert.deepEqual(spec.ready, { selector: null, timeoutMs: CAPTURE_DEFAULTS.readyTimeoutMs, settleMs: 0 });
	assert.equal(spec.name, "rehearsal-target");
	assert.equal(spec.framesDir, path.join(ROOT, "output", "vpk-html-capture", "rehearsal-target"), "frames go under <repo>/output/");
	assert.equal(spec.manifestDir, SPEC_DIR, "capture.json lands beside the spec");
	assert.equal(spec.url, pathToFileURL(path.join(ROOT, "artifacts", "vpk-html", "demo", "rehearsal-target.html")).href, "a relative url resolves against the spec folder");
	const [segment] = spec.segments;
	assert.equal(segment.hold, DEFAULT_HOLD_EXPR, "hold defaults to the rehearsal hook");
	assert.equal(segment.settleMs, 50);
	assert.equal(segment.frames, 181, "frames i = 0 … 180 for 0-6 s at 30 fps");
	assert.equal(segment.timeMap, null);
	const flagged = normalizeSpec({ ...HOLD, viewport: "1280x720", dpr: 2, colorScheme: "dark" }, { specPath: SPEC_PATH, ...AT_ROOT, framesDir: "output/x", manifestDir: "output/y" });
	assert.deepEqual(flagged.viewport, { width: 1280, height: 720 });
	assert.equal(flagged.deviceScaleFactor, 2);
	assert.equal(flagged.framesDir, path.join(ROOT, "output", "x"), "--frames-dir resolves against the cwd");
	assert.equal(flagged.manifestDir, path.join(ROOT, "output", "y"), "--manifest-dir resolves against the cwd");
	const fields = normalizeSpec({ ...HOLD, framesDir: "../../../../output/fields", manifestDir: "records" }, { specPath: SPEC_PATH, ...AT_ROOT });
	assert.equal(fields.framesDir, path.join(ROOT, "output", "fields"), "a spec's framesDir resolves against the spec folder");
	assert.equal(fields.manifestDir, path.join(SPEC_DIR, "records"), "a spec's manifestDir resolves against the spec folder");
	const bare = normalizeSpec({ url: "http://localhost:4321/demo.html", segments: [{ kind: "hold", end: 1 }] }, AT_ROOT);
	assert.equal(bare.name, "localhost-4321");
	assert.equal(bare.manifestDir, bare.framesDir, "without a spec file the manifest stays with the frames");
	assert.equal(bare.segments[0].id, "segment-1");
});

test("normalizeSpec rejects missing urls, unknown kinds and empty spans", () => {
	const reject = (spec, pattern, options = {}) => assert.throws(() => normalizeSpec(spec, { ...AT_ROOT, ...options }), pattern);
	reject(null, /expected an object/);
	reject({ segments: HOLD.segments }, /url is required/);
	reject({ url: "javascript:alert(1)", segments: HOLD.segments }, /http\(s\), file or a path/);
	reject({ url: "https://x.test/", segments: [] }, /non-empty array/);
	reject({ url: "https://x.test/", segments: [{ id: "a", kind: "warp" }] }, /unknown kind "warp"/);
	reject({ url: "https://x.test/", segments: [{ id: "a", kind: "hold", start: 2, end: 2 }] }, /end \(2\) must be greater than start \(2\)/);
	reject({ url: "https://x.test/", segments: [{ id: "a", kind: "hold", start: 3, end: 1 }] }, /end \(1\) must be greater than start \(3\)/);
	reject({ url: "https://x.test/", segments: [{ id: "a", kind: "virtual", start: 2, end: 1 }] }, /end \(1\) must be greater than start \(2\)/);
	reject({ url: "https://x.test/", segments: [{ id: "a", kind: "virtual", end: 1, hold: "go(t)" }] }, /a virtual segment runs on the page's own stepped clock; timeMap and hold belong to hold segments/);
	reject({ url: "https://x.test/", segments: [{ id: "a", kind: "virtual", end: 1, timeMap: u => u }] }, /timeMap and hold belong to hold segments/);
	reject({ url: "https://x.test/", segments: [{ id: "a", kind: "virtual", start: -1, end: 1 }] }, /start must be a number in \[0, Infinity\]/);
	reject({ url: "https://x.test/", segments: HOLD.segments, cursor: { size: 2 } }, /cursor: size must be 8–96 px/);
	reject({ url: "https://x.test/", segments: HOLD.segments, cursor: { start: [1] } }, /cursor: start must be \[x, y\]/);
	reject({ url: "https://x.test/", segments: [{ id: "a", kind: "hold", end: 1 }, { id: "a", kind: "hold", end: 1 }] }, /unique/);
	reject({ url: "https://x.test/", segments: [{ id: "../up", kind: "hold", end: 1 }] }, /segment id "\.\.\/up"/);
	reject({ url: "https://x.test/", segments: [{ id: "a", kind: "hold", end: 1, timeMap: "u * 2" }] }, /timeMap must be a function/);
	reject({ url: "https://x.test/", segments: [{ id: "a", kind: "hold", end: 1, hold: 42 }] }, /hold must be a function or an expression string/);
	reject({ url: "https://x.test/", segments: [{ id: "a", kind: "screencast" }] }, /needs drive/);
	reject({ url: "https://x.test/", fps: 0, segments: HOLD.segments }, /fps must be a number in \[1, 120\]/);
	reject({ url: "https://x.test/", viewport: "wide", segments: HOLD.segments }, /viewport width/);
	reject({ url: "https://x.test/", colorScheme: "sepia", segments: HOLD.segments }, /colorScheme "sepia"/);
	reject({ url: "https://x.test/", segments: HOLD.segments }, /never go under artifacts\//, { framesDir: "artifacts/vpk-html/demo/frames" });
	reject({ url: "https://x.test/", segments: HOLD.segments }, /--only names unknown segments: nope/, { only: "nope" });
});

test("run from <slug>/_film/, frames still land under <repo>/output/ and are named for the slug", () => {
	const film = { specPath: "capture.spec.mjs", cwd: SPEC_DIR, repoRoot: ROOT };
	const canonical = normalizeSpec(HOLD, film);
	assert.equal(canonical.name, "demo", "_film/capture.spec.mjs takes the slug's name");
	assert.equal(canonical.framesDir, path.join(ROOT, "output", "vpk-html-capture", "demo"), "the cwd does not move the default");
	assert.equal(canonical.manifestDir, SPEC_DIR, "capture.json stays in <slug>/_film/");
	assert.equal(canonical.specPath, path.join(SPEC_DIR, "capture.spec.mjs"));
	assert.equal(canonical.url, pathToFileURL(path.join(ROOT, "artifacts", "vpk-html", "demo", "rehearsal-target.html")).href);
	const fromRoot = normalizeSpec(HOLD, { specPath: path.relative(ROOT, path.join(SPEC_DIR, "capture.spec.mjs")), ...AT_ROOT });
	assert.deepEqual({ name: fromRoot.name, framesDir: fromRoot.framesDir, manifestDir: fromRoot.manifestDir }, { name: canonical.name, framesDir: canonical.framesDir, manifestDir: canonical.manifestDir }, "same plan from the repo root");
	const other = normalizeSpec(HOLD, { ...film, specPath: path.join(ROOT, "artifacts", "vpk-html", "other", "_film", "capture.spec.mjs") });
	assert.equal(other.name, "other");
	assert.notEqual(other.framesDir, canonical.framesDir, "two artifacts never share a frames folder");
	assert.equal(normalizeSpec(HOLD, { ...film, specPath: "capture.mjs" }).name, "demo");
	assert.equal(normalizeSpec(HOLD, { ...film, specPath: "../capture.json" }).name, "demo", "a generic spec outside _film/ names its folder");
	assert.equal(normalizeSpec(HOLD, { ...film, specPath: "intro.capture.mjs" }).name, "intro", "a named spec keeps its stem");
	assert.equal(normalizeSpec({ ...HOLD, name: "Hero Film" }, film).name, "hero-film", "an explicit name wins");
	const tmpdir = path.join(ROOT, "tmp");
	const standalone = normalizeSpec(HOLD, { ...film, repoRoot: null, tmpdir });
	assert.equal(standalone.framesDir, path.join(tmpdir, "vpk-html-capture", "demo"), "outside the VPK repo, frames go to the temp dir (ws6 C14), not the cwd");
	assert.equal(defaultCaptureRoot({ repoRoot: ROOT }), path.join(ROOT, "output", "vpk-html-capture"));
	assert.equal(defaultCaptureRoot({ repoRoot: null, tmpdir }), path.join(tmpdir, "vpk-html-capture"));
});

test("no frames dir under an artifacts/ folder is accepted, from any cwd", () => {
	const film = { specPath: "capture.spec.mjs", cwd: SPEC_DIR, repoRoot: ROOT };
	const refuse = (options, spec = HOLD) => assert.throws(() => normalizeSpec(spec, { ...film, ...options }), /never go under artifacts\//);
	for (const framesDir of ["frames", "./out/frames", "..", "../../../../artifacts", path.join(ROOT, "artifacts", "x"), "../../../../output/../Artifacts/x"]) refuse({ framesDir });
	refuse({ framesDir: "elsewhere/artifacts/frames", cwd: ROOT });
	refuse({ framesDir: "frames", repoRoot: null, tmpdir: path.join(ROOT, "tmp") });
	refuse({ framesDir: path.join(path.dirname(ROOT), "artifacts", "frames") }, HOLD);
	refuse({}, { ...HOLD, framesDir: "frames" });
	assert.equal(normalizeSpec(HOLD, { ...film, framesDir: "../../../../output/demo-frames" }).framesDir, path.join(ROOT, "output", "demo-frames"), "a path that climbs out of artifacts/ is fine");
	const nested = path.join(ROOT, "artifacts", "checkout");
	const inNested = normalizeSpec(HOLD, { specPath: path.join(nested, "artifacts", "vpk-html", "demo", "_film", "capture.spec.mjs"), cwd: nested, repoRoot: nested });
	assert.equal(inNested.framesDir, path.join(nested, "output", "vpk-html-capture", "demo"), "a repo that itself sits in an artifacts/ folder can still use its output/");
	assert.equal(isUnderArtifacts(path.join(nested, "artifacts", "x"), { repoRoot: nested }), true);
	assert.equal(isUnderArtifacts(path.join(ROOT, "output", "artifacts-notes"), { repoRoot: ROOT }), false, "only a whole artifacts segment counts");
});

test("hold frame times with and without a timeMap", () => {
	const spec = normalizeSpec({ url: "https://x.test/", segments: [{ id: "a", kind: "hold", start: 2, end: 3 }, { id: "b", kind: "hold", start: 0, end: 0.1, timeMap: u => 5 + u * 2 }] }, AT_ROOT);
	const [plain, mapped] = spec.segments;
	const times = holdFrameTimes(plain, spec.fps);
	assert.equal(times.length, 31);
	assert.equal(times[0], 2);
	assert.equal(times[30], 3);
	assert.equal(times[15], 2.5);
	assert.deepEqual(holdFrameTimes(mapped, spec.fps), [5, 5 + 2 / 30, 5 + 4 / 30, 5.2]);
	assert.equal(holdFrameCount({ start: 0, end: 6 }, 30), 181);
	assert.equal(holdFrameCount({ start: 0, end: 0.01 }, 30), 1, "a sub-frame span still captures its first frame");
	assert.equal(holdExpression(DEFAULT_HOLD_EXPR, 1.5), "(async (t) => { await window.__vpkRehearsal.hold(t); })(1.5)");
});

test("--only keeps the named segments in spec order", () => {
	const spec = normalizeSpec({ url: "https://x.test/", segments: [{ id: "a", kind: "hold", end: 1 }, { id: "b", kind: "screencast", live: 2 }, { id: "c", kind: "hold", end: 1 }] }, { ...AT_ROOT, only: "c, a" });
	assert.deepEqual(spec.segments.map(segment => segment.id), ["a", "c"]);
});

test("the capture manifest carries contiguous film offsets and the right clock per segment kind", () => {
	const spec = normalizeSpec({
		url: "../rehearsal-target.html",
		segments: [
			{ id: "throws", kind: "hold", start: 0, end: 6 },
			{ id: "live", kind: "screencast", live: 1 },
			{ id: "slowmo", kind: "hold", start: 0, end: 0.1, timeMap: u => u / 2 },
		],
	}, { specPath: SPEC_PATH, ...AT_ROOT });
	const errors = Array.from({ length: 25 }, (_, index) => `error ${index}`);
	const manifest = buildCaptureManifest(spec, [
		{ id: "throws", frames: 181, marks: [{ name: "second-throw", frame: 60 }] },
		{ id: "live", frames: 3, durations: [0.02, 0.05, 1 / 30], firstFrame: 40, marks: [{ name: "drop", frame: 1 }] },
		{ id: "slowmo", frames: 4 },
	], { errors });
	assert.equal(manifest.version, 1);
	assert.equal(manifest.fps, 30);
	const [throws, live, slowmo] = manifest.segments;
	assert.deepEqual(throws.film, [0, 181 / 30]);
	assert.equal(throws.film[1] - throws.film[0], throws.frames / 30, "hold: film[1] - film[0] = frames / fps");
	assert.deepEqual(throws.clock, { kind: "linear", start: 0, rate: 1 });
	assert.equal(live.film[0], throws.film[1]);
	assert.equal(live.film[1], Math.round((181 / 30 + 0.07 + 1 / 30) * 1e6) / 1e6, "screencast: summed durations");
	assert.deepEqual(live.clock, { kind: "real" });
	assert.equal(live.firstFrame, 40);
	assert.equal(slowmo.film[0], live.film[1]);
	assert.deepEqual(slowmo.clock, { kind: "samples", samples: [[0, 0], [0.033333, 0.016667], [0.066667, 0.033333], [0.1, 0.05]] });
	assert.equal(manifest.duration, slowmo.film[1]);
	assert.equal(manifest.frames, 188);
	assert.deepEqual(manifest.marks, { "second-throw": 2, drop: Math.round((181 / 30 + 0.02) * 1e6) / 1e6 });
	assert.deepEqual(manifest.viewport, { width: 1920, height: 1080, deviceScaleFactor: 1 });
	assert.equal(manifest.errors.length, 20, "at most 20 page errors");
	assert.deepEqual(manifest.source, { url: "../rehearsal-target.html", spec: "rehearsal-target.capture.mjs" }, "relative paths only");
	assert.doesNotMatch(JSON.stringify(manifest), new RegExp(ROOT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "no absolute path in the record");
	assert.throws(() => buildCaptureManifest(spec, [{ id: "ghost", frames: 1 }]), /unknown segments: ghost/);
});

test("virtual segments (item 14): frames like a hold, a linear clock from `start`, no hold or timeMap, listed in the plan", () => {
	const spec = normalizeSpec({ url: "https://x.test/", fps: 30, segments: [{ id: "page", kind: "virtual", label: "page clock", start: 1, end: 3 }] }, AT_ROOT);
	const [segment] = spec.segments;
	assert.deepEqual({ kind: segment.kind, start: segment.start, end: segment.end, frames: segment.frames, settleMs: segment.settleMs, arm: segment.arm, release: segment.release }, { kind: "virtual", start: 1, end: 3, frames: 61, settleMs: 50, arm: null, release: null });
	assert.equal(spec.cursor, false, "no cursor overlay unless asked");
	const manifest = buildCaptureManifest(spec, [{ id: "page", frames: 61 }]);
	assert.deepEqual(manifest.segments[0], { id: "page", label: "page clock", kind: "virtual", film: [0, 61 / 30], clock: { kind: "linear", start: 1, rate: 1 }, frames: 61 });
	assert.equal(manifest.segments[0].film[1] - manifest.segments[0].film[0], 61 / 30, "film[1] - film[0] = frames / fps, as for a hold");
	const mixed = buildCaptureManifest(normalizeSpec({ url: "https://x.test/", segments: [{ id: "a", kind: "hold", end: 1 }, { id: "b", kind: "virtual", end: 1 }] }, AT_ROOT), [{ id: "a", frames: 31 }, { id: "b", frames: 31 }]);
	assert.equal(mixed.segments[1].film[0], mixed.segments[0].film[1], "contiguous offsets across kinds");
	const fromUrl = normalizeSpec(specFromUrlArgs({ url: "http://x.test/", end: 2, start: 0.5, virtual: true, cursor: true }), AT_ROOT);
	assert.deepEqual({ id: fromUrl.segments[0].id, kind: fromUrl.segments[0].kind, start: fromUrl.segments[0].start, frames: fromUrl.segments[0].frames }, { id: "clock", kind: "virtual", start: 0.5, frames: 46 });
	assert.deepEqual(fromUrl.cursor, { size: 24, start: [960, 540] }, "--cursor: a 24 px arrow starting at the viewport centre");
	assert.deepEqual(parseCaptureArgs(["--url", "http://x.test/", "--end", "2", "--virtual", "--cursor"]), { headed: false, dryRun: false, url: "http://x.test/", end: 2, virtual: true, cursor: true });
	assert.throws(() => parseCaptureArgs(["spec.mjs", "--virtual"]), /--virtual makes the --url segment virtual/);
	assert.equal(normalizeSpec({ url: "https://x.test/", cursor: { size: 32, start: [10, 20] }, segments: HOLD.segments }, AT_ROOT).cursor.size, 32);
});

test("the --url shorthand makes one hold segment on the rehearsal hook, or one screencast", () => {
	const hold = normalizeSpec(specFromUrlArgs({ url: "http://localhost:8080/page.html", end: 2, fps: 24, viewport: "1280x720", readySelector: "#ready", waitMs: 500 }), AT_ROOT);
	assert.equal(hold.segments.length, 1);
	// The id is the IR's default film.clock_id, so cues timed with t_s (data-clock="clock") resolve after embed.
	assert.deepEqual({ id: hold.segments[0].id, kind: hold.segments[0].kind, start: hold.segments[0].start, end: hold.segments[0].end, hold: hold.segments[0].hold, frames: hold.segments[0].frames }, { id: "clock", kind: "hold", start: 0, end: 2, hold: DEFAULT_HOLD_EXPR, frames: 49 });
	assert.equal(normalizeSpec(specFromUrlArgs({ url: "http://x.test/", end: 1, segmentId: "finale" }), AT_ROOT).segments[0].id, "finale", "--segment-id matches another clock_id");
	assert.throws(() => normalizeSpec(specFromUrlArgs({ url: "http://x.test/", end: 1, segmentId: "../up" }), AT_ROOT), /segment id "\.\.\/up"/);
	assert.equal(hold.fps, 24);
	assert.deepEqual(hold.viewport, { width: 1280, height: 720 });
	assert.deepEqual(hold.ready, { selector: "#ready", timeoutMs: CAPTURE_DEFAULTS.readyTimeoutMs, settleMs: 500 });
	const custom = specFromUrlArgs({ url: "http://x.test/", end: 1, hold: "window.seek(t)" });
	assert.equal(custom.segments[0].hold, "window.seek(t)");
	const live = specFromUrlArgs({ url: "http://x.test/", live: 4 });
	assert.deepEqual(live.segments, [{ id: "clock", kind: "screencast", label: "clock", live: 4 }]);
	const drive = normalizeSpec(specFromUrlArgs({ url: "http://x.test/", drive: "drive.mjs" }), AT_ROOT);
	assert.equal(drive.segments[0].drive, path.join(ROOT, "drive.mjs"));
	assert.throws(() => normalizeSpec(specFromUrlArgs({ url: "http://x.test/" }), AT_ROOT), /end must be a number/, "--end is required for a hold");
});

test("a hold on the default hook refuses a page without window.__vpkRehearsal.hold, naming --hold and --live", async () => {
	// page.evaluate(fn) runs fn here, so globalThis stands in for the page's window.
	const page = { calls: 0, evaluate(fn) { this.calls += 1; return fn(); } };
	const [segment] = normalizeSpec(specFromUrlArgs({ url: "http://x.test/plain.html", end: 1 }), AT_ROOT).segments;
	delete globalThis.__vpkRehearsal;
	const refused = await checkHoldHook(page, segment, "http://x.test/plain.html").then(() => null, error => error);
	assert.ok(refused instanceof CaptureSpecError, String(refused));
	assert.match(refused.message, /^capture: hold segment "clock" steps window\.__vpkRehearsal\.hold\(t\), which http:\/\/x\.test\/plain\.html does not define\. Pass --hold "<expr with t>"/);
	assert.match(refused.message, /or --live <s> \(or --drive <module\.mjs>\) to record it in real time$/);
	globalThis.__vpkRehearsal = { hold() {} };
	try {
		await checkHoldHook(page, segment, "http://x.test/");
	} finally {
		delete globalThis.__vpkRehearsal;
	}
	const before = page.calls;
	await checkHoldHook(page, { ...segment, hold: "window.seek(t)" }, "http://x.test/");
	assert.equal(page.calls, before, "a custom --hold is the author's own clock: not probed");
});

test("parseCaptureArgs and parseViewport", () => {
	assert.deepEqual(parseCaptureArgs(["spec.mjs", "--only", "a,b", "--dry-run"]), { headed: false, dryRun: true, specFile: "spec.mjs", only: "a,b" });
	assert.deepEqual(parseCaptureArgs(["--url", "http://x.test/", "--end", "6", "--fps", "60", "--hold", "go(t)", "--headed"]), { headed: true, dryRun: false, url: "http://x.test/", end: 6, fps: 60, hold: "go(t)" });
	assert.throws(() => parseCaptureArgs([]), /spec file or --url/);
	assert.throws(() => parseCaptureArgs(["a.mjs", "--url", "http://x.test/"]), /spec file or --url/);
	assert.throws(() => parseCaptureArgs(["a.mjs", "b.mjs"]), /one spec file only/);
	assert.throws(() => parseCaptureArgs(["a.mjs", "--fast"]), /unknown flag --fast/);
	assert.equal(parseCaptureArgs(["--url", "http://x.test/", "--end", "1", "--segment-id", "finale"]).segmentId, "finale");
	assert.throws(() => parseCaptureArgs(["a.mjs", "--segment-id", "clock"]), /--segment-id names the --url segment/);
	assert.throws(() => parseCaptureArgs(["--url"]), /--url needs a value/);
	assert.throws(() => parseCaptureArgs(["--url", "http://x.test/", "--end", "soon"]), /--end must be a number/);
	assert.deepEqual(parseViewport("640X360"), { width: 640, height: 360 });
	assert.deepEqual(parseViewport({ width: 800, height: 600 }), { width: 800, height: 600 });
	assert.throws(() => parseViewport("0x10"), /viewport width/);
});

test("loadCaptureSpec reads .mjs default exports (functions allowed) and .json specs", async () => {
	fs.mkdirSync(SPEC_DIR, { recursive: true });
	fs.writeFileSync(SPEC_PATH, "export default { url: \"../rehearsal-target.html\", segments: [{ id: \"t\", kind: \"hold\", end: 1, timeMap: (u) => u * 2 }] };\n");
	const mjs = await loadCaptureSpec(SPEC_PATH);
	assert.equal(typeof mjs.segments[0].timeMap, "function");
	const jsonPath = path.join(SPEC_DIR, "plain.json");
	fs.writeFileSync(jsonPath, JSON.stringify(HOLD));
	assert.deepEqual(await loadCaptureSpec(jsonPath), HOLD);
});

test("CLI: --dry-run validates and plans without a browser (real runs: media/pipeline.browser.test.mjs)", () => {
	const jsonPath = path.join(ROOT, "capture.json-spec.json");
	fs.writeFileSync(jsonPath, JSON.stringify({ url: "http://localhost:9/page.html", segments: [{ id: "throws", kind: "hold", end: 6 }, { id: "live", kind: "screencast", live: 2 }] }));
	const dry = node([CAPTURE, jsonPath, "--dry-run"], { cwd: ROOT });
	assert.equal(dry.status, 0, dry.stderr);
	assert.match(dry.stdout, /hold throws: t 0–6 s, 181 frames, film 6\.033333 s/);
	assert.match(dry.stdout, /screencast live: live 2 s, trim 0/);
	assert.equal(framesLine(dry.stdout), path.join(defaultCaptureRoot(), "capture.json-spec"), "the CLI's default is the skill's repo output/, shown absolute when outside the cwd");
	assert.equal(fs.existsSync(path.join(ROOT, "output")), false, "a dry run writes nothing");
	assert.equal(fs.existsSync(path.join(defaultCaptureRoot(), "capture.json-spec")), false, "a dry run writes nothing");
	const bad = node([CAPTURE, "--url", "http://x.test/", "--end", "0", "--start", "1", "--dry-run"], { cwd: ROOT });
	assert.equal(bad.status, 1);
	assert.match(bad.stderr, /capture spec: segment "clock": end \(0\) must be greater than start \(1\)/);
	const named = node([CAPTURE, "--url", "http://x.test/", "--end", "1", "--segment-id", "finale", "--dry-run"], { cwd: ROOT });
	assert.equal(named.status, 0, named.stderr);
	assert.match(named.stdout, /hold finale: t 0–1 s, 31 frames/);
});

test("CLI (r1.2): a real run reaches runCapture, with --virtual, --cursor or a spec file (Playwright stubbed, no browser)", () => {
	// Round 1: capture.mjs re-exported runCapture without importing it, so every non-dry run died on "runCapture is not
	// defined" while the suites (module API and --dry-run only) stayed green. The stub makes chromium.launch throw a marker.
	const hooks = path.join(ROOT, "stub-playwright.mjs");
	fs.writeFileSync(hooks, `import { registerHooks } from "node:module";
registerHooks({ resolve(specifier, context, next) {
	if (specifier !== "@playwright/test") return next(specifier, context);
	return { url: "data:text/javascript,export const chromium = { launch: async () => { throw new Error('STUB chromium.launch reached'); } };", shortCircuit: true };
} });\n`);
	const specPath = path.join(ROOT, "cli-run.spec.json");
	fs.writeFileSync(specPath, JSON.stringify({ url: "http://x.test/", segments: [{ id: "throws", kind: "hold", end: 1 }] }));
	const dirs = ["--frames-dir", path.join(ROOT, "cli-frames"), "--manifest-dir", path.join(ROOT, "cli-manifest")];
	const runs = {
		"--virtual --cursor": [CAPTURE, "--url", "http://x.test/", "--virtual", "--end", "1", "--fps", "10", "--viewport", "1280x800", "--cursor", ...dirs],
		"--hold": [CAPTURE, "--url", "http://x.test/", "--hold", "window.seek(t)", "--end", "1", ...dirs],
		"a spec file": [CAPTURE, specPath, "--cursor", ...dirs],
	};
	for (const [name, args] of Object.entries(runs)) {
		const run = node(["--import", pathToFileURL(hooks).href, ...args], { cwd: ROOT });
		assert.equal(run.status, 1, `${name}: ${run.stdout}${run.stderr}`);
		assert.doesNotMatch(run.stderr, /is not defined/, `${name}: main() must hold a local runCapture binding`);
		assert.match(run.stderr, /STUB chromium\.launch reached/, `${name}: main() reaches runCapture, which launches the browser`);
	}
});

test("CLI from <tmp>/artifacts/<slug>/_film: the documented workflow never plans frames under artifacts/", () => {
	fs.mkdirSync(SPEC_DIR, { recursive: true });
	fs.writeFileSync(path.join(SPEC_DIR, "capture.spec.mjs"), "export default { url: \"../rehearsal-target.html\", segments: [{ id: \"throws\", kind: \"hold\", end: 1 }] };\n");
	const before = fs.readdirSync(SPEC_DIR).sort();
	const dry = node([CAPTURE, "capture.spec.mjs", "--dry-run"], { cwd: SPEC_DIR });
	assert.equal(dry.status, 0, dry.stderr);
	assert.match(dry.stdout, /^capture demo: file:/m, "named for the slug, not capture.spec");
	const frames = path.resolve(SPEC_DIR, framesLine(dry.stdout));
	assert.equal(frames, path.join(defaultCaptureRoot(), "demo"));
	assert.equal(isUnderArtifacts(frames), false);
	assert.match(dry.stdout, /^ {2}manifest → capture\.json$/m, "capture.json stays beside the spec");
	assert.deepEqual(fs.readdirSync(SPEC_DIR).sort(), before, "a dry run adds nothing to _film/");
	const local = node([CAPTURE, "capture.spec.mjs", "--frames-dir", "frames", "--dry-run"], { cwd: SPEC_DIR });
	assert.equal(local.status, 1);
	assert.match(local.stderr, /never go under artifacts\/ \(.*_film[/\\]frames\)/);
	const out = path.join(ROOT, "output", "demo-frames");
	const escaped = node([CAPTURE, "capture.spec.mjs", "--frames-dir", out, "--dry-run"], { cwd: SPEC_DIR });
	assert.equal(escaped.status, 0, escaped.stderr);
	assert.equal(framesLine(escaped.stdout), out);
});
