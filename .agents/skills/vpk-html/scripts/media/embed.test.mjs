// embed.mjs suite (ws4a-labs.md §9): the input fence (fence.mjs), then embed, film data, WS1 preservation, the lite
// copy and the lite encoder's single retry. Every tool (ffprobe, stills, the lite encode) is injected: no ffmpeg runs.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateHtmlString } from "../check-html.mjs";
import { findJsonIslands, parseJsonIsland } from "../json-island.mjs";
import { LITE_STRIP_BELOW_BYTES, applyEmbed, clickStillTime, embedDocument, liteSourceHash, mergeCaptureData, provenanceText, setTagAttribute } from "./embed.mjs";
import { encodeFilm } from "./encode.mjs";
import { FenceError, MAX_INPUT_BYTES, SECRET_NAME, checkFencedInput, describeEmbedded, fenceRoots, sha256_12 } from "./fence.mjs";

const ROOT = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "vpk-fence-")));
const REPO = path.join(ROOT, "repo");
const DOC = path.join(REPO, "artifacts", "vpk-html", "demo");
const HTML = path.join(DOC, "demo.html");
const ELSEWHERE = path.join(ROOT, "elsewhere");
const write = (file, bytes = 16) => {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, Buffer.alloc(bytes, 7));
	return file;
};

test.before(() => {
	write(HTML);
	write(path.join(DOC, "_film", "film.mp4"), 1024);
	write(path.join(REPO, "output", "vpk-html-capture", "demo", "poster.webp"));
	write(path.join(ELSEWHERE, "film.mp4"));
	// .env* and *.pem are refused by name before the file system is touched, so they are never created here
	// (sandboxes also guard those names). id_rsa exists so a harmless-looking symlink can resolve to it.
	write(path.join(DOC, "_film", "id_rsa"));
	fs.symlinkSync(path.join(DOC, "_film", "id_rsa"), path.join(DOC, "_film", "innocent.mp4"));
	fs.symlinkSync(path.join(ELSEWHERE, "film.mp4"), path.join(DOC, "_film", "escape.mp4"));
	fs.mkdirSync(path.join(REPO, "extra"), { recursive: true });
	write(path.join(REPO, "extra", "clip.mp4"));
});
test.after(() => fs.rmSync(ROOT, { recursive: true, force: true }));

// The temp dir is a default root, and these fixtures live in it; drop it so "outside" means outside.
const roots = (extra = []) => fenceRoots({ htmlFile: HTML, cwd: REPO, roots: extra, tmpdir: null });

test("fence: inputs under the HTML's folder and output/ pass, with cwd-relative paths", () => {
	const film = checkFencedInput("artifacts/vpk-html/demo/_film/film.mp4", { roots: roots(), cwd: REPO });
	assert.deepEqual({ relative: film.relative, bytes: film.bytes }, { relative: "artifacts/vpk-html/demo/_film/film.mp4", bytes: 1024 });
	assert.equal(path.isAbsolute(film.path), true, "the resolved path is for reading only");
	assert.equal(checkFencedInput("output/vpk-html-capture/demo/poster.webp", { roots: roots(), cwd: REPO }).relative, "output/vpk-html-capture/demo/poster.webp");
	assert.equal(checkFencedInput("extra/clip.mp4", { roots: roots(["extra"]), cwd: REPO }).relative, "extra/clip.mp4", "--root widens the fence");
	assert.ok(fenceRoots({ htmlFile: HTML, cwd: REPO }).includes(fs.realpathSync(os.tmpdir())), "the temp dir is a root by default");
});

test("fence: paths outside the roots, symlink escapes, secrets, oversize files and folders are refused", () => {
	const refuse = (file, pattern, options = {}) => assert.throws(() => checkFencedInput(file, { roots: roots(), cwd: REPO, ...options }), error => error instanceof FenceError && pattern.test(error.message));
	refuse(path.join(ELSEWHERE, "film.mp4"), /outside the allowed roots/);
	refuse("../elsewhere/film.mp4", /outside the allowed roots/);
	refuse("artifacts/vpk-html/demo/_film/escape.mp4", /outside the allowed roots/);
	refuse("extra/clip.mp4", /outside the allowed roots/);
	refuse("artifacts/vpk-html/demo/.env.local", /looks like a secret/);
	refuse("artifacts/vpk-html/demo/_film/id_rsa", /looks like a secret/);
	refuse("artifacts/vpk-html/demo/_film/innocent.mp4", /looks like a secret/, { roots: roots() });
	refuse("artifacts/vpk-html/demo/keys/server.pem", /looks like a secret/);
	refuse("artifacts/vpk-html/demo/_film/missing.mp4", /no such file/);
	refuse("artifacts/vpk-html/demo/_film", /not a file/);
	refuse("artifacts/vpk-html/demo/_film/film.mp4", /exceeds the 100 B input cap/, { maxBytes: 100 });
	assert.equal(MAX_INPUT_BYTES, 50 * 1024 * 1024);
});

test("fence: SECRET_NAME matches secret-looking segments only", () => {
	for (const name of [".env", ".env.production", "a/.ssh/config", "id_ed25519", "x/credentials.json", "secrets/film.mp4", "tls.key", "cert.PEM", "store.p12", ".npmrc", ".netrc", ".aws/config"]) {
		assert.equal(SECRET_NAME.test(name), true, name);
	}
	for (const name of ["film.mp4", "_film/poster.webp", "keyframes.mp4", "monkey.jpg", "environment.png", "ids/film.mp4", "secretary.mp4"]) {
		assert.equal(SECRET_NAME.test(name), false, name);
	}
});

test("fence: the manifest line names the relative path, size and short hash, never an absolute path", () => {
	const buffer = Buffer.from("film bytes");
	const entry = checkFencedInput("artifacts/vpk-html/demo/_film/film.mp4", { roots: roots(), cwd: REPO });
	const line = describeEmbedded(entry, buffer);
	assert.equal(line, `embedded: artifacts/vpk-html/demo/_film/film.mp4 1024 sha256:${sha256_12(buffer)}`);
	assert.equal(sha256_12(buffer).length, 12);
	assert.equal(line.includes(ROOT), false);
});

// ---------- embed.mjs ----------

const TEMPLATE = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "assets", "templates", "motion-case-study.html"), "utf8");
const AUTHORED = { version: 1, fps: 30, duration: 0, posterTime: 3.3, segments: [{ id: "clock", label: "clock", kind: "hold", film: [0, 6.0333], clock: { kind: "linear", start: 0, rate: 1 } }], chapters: [{ label: "#feed", film: 0 }, { label: "Throw 2", film: 2 }] };
const MANIFEST = {
	version: 1, tool: "vpk-html/media/capture.mjs", fps: 30, duration: 6.033333,
	segments: [{ id: "clock", label: "rehearsal clock", kind: "hold", film: [0, 6.033333], clock: { kind: "linear", start: 0, rate: 1 }, frames: 181 }],
	marks: { throw: 1.2 }, viewport: { width: 1280, height: 720, deviceScaleFactor: 1 }, frames: 181,
	errors: ["pageerror: should never reach the HTML"], source: { url: "../rehearsal-target.html", spec: "rehearsal-target.capture.mjs" },
};
const WS1 = {
	meta: '<meta name="vpk-doc-id" content="doc_k3x9q2a1">\n<meta name="vpk-doc-revision" content="r2">',
	blocks: '<script type="application/json" data-vpk-revisions>{"schema":"vpk-revisions/1","revisions":[]}</script>\n<!-- vpk-review-data:start -->\n<script type="application/json" data-vpk-review>{"schema":"vpk-review/1","comments":[]}</script>\n<!-- vpk-review-data:end -->\n',
};

/** A reviewable copy of the template: WS1 metas, stamped ids, the revisions and review islands, authored film data. */
function fixtureHtml() {
	return TEMPLATE
		.replace('<meta name="generator" content="vpk-html">', `<meta name="generator" content="vpk-html">\n${WS1.meta}`)
		.replace('<h1>{{Case study headline}}</h1>', '<h1 data-vpk-id="h1abcd" data-vpk-revision="r2">{{Case study headline}}</h1>')
		.replace('data-vpk-cue="cue-2"', 'data-vpk-id="cue2xx" data-vpk-cue="cue-2"')
		.replace('data-vpk-cue="cue-1" data-act="{{Act}}" data-film="0"', 'data-vpk-cue="cue-1" data-act="{{Act}}" data-clock="clock" data-t="0.6"')
		.replace(/(<script type="application\/json" data-vpk-film-data>)[\s\S]*?(<\/script>)/, (_, open, close) => `${open}${JSON.stringify(AUTHORED)}${close}`)
		.replace("<!-- vpkh-enhance:begin -->", `${WS1.blocks}<!-- vpkh-enhance:begin -->`);
}

function fakeTools(log = []) {
	return {
		probe: file => (/\.lite\.mp4$/.test(file) ? { duration: 6.033333, frames: 181, width: 640, height: 360 } : { duration: 6.033333, frames: 181, width: 1280, height: 720 }),
		still: ({ time, width }) => {
			log.push(["still", Number(time.toFixed(3)), width]);
			return { mime: "image/webp", buffer: Buffer.from(`webp ${width} ${time.toFixed(2)}`) };
		},
		encodeLite: ({ output, targetBytes }) => {
			log.push(["lite", targetBytes]);
			fs.writeFileSync(output, Buffer.alloc(Math.min(90000, targetBytes - 1), 5));
			return { bytes: Math.min(90000, targetBytes - 1), retried: false };
		},
	};
}

function embedDir(filmBytes = 300000) {
	const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "vpk-embed-test-")));
	fs.mkdirSync(path.join(dir, "_film"));
	fs.writeFileSync(path.join(dir, "case.html"), fixtureHtml());
	fs.writeFileSync(path.join(dir, "_film", "film.mp4"), Buffer.alloc(filmBytes, 7));
	fs.writeFileSync(path.join(dir, "_film", "capture.json"), JSON.stringify(MANIFEST));
	return dir;
}

/** Everything outside the parts embed owns (video tag, film-data island, provenance text, baked thumbs, lite note). */
function outsideOwned(html) {
	return html.replace(/<video\b[^>]*>/, "<video>").replace(/(data-vpk-film-data>)[\s\S]*?(<\/script>)/, "$1$2")
		.replace(/(data-vpk-film-provenance>)[^<]*/, "$1").replace(/<img class="vpk-cue-thumb"[^>]*>/g, "");
}

test("embed: data URL src, merged film data, provenance; idempotent; WS1 metas, ids and islands untouched", async () => {
	const dir = embedDir();
	try {
		const options = { htmlFile: "case.html", film: "_film/film.mp4", manifest: "_film/capture.json", cwd: dir, tools: fakeTools(), lite: "never" };
		const first = await embedDocument(options);
		const once = fs.readFileSync(path.join(dir, "case.html"), "utf8");
		await embedDocument(options);
		assert.equal(fs.readFileSync(path.join(dir, "case.html"), "utf8"), once, "a second embed is byte-identical");
		const video = /<video\b[^>]*>/.exec(once)[0];
		assert.match(video, /^<video src="data:video\/mp4;base64,BwcH/);
		assert.match(video, /poster="data:image\/webp;base64,/);
		assert.equal((video.match(/\ssrc=/g) ?? []).length, 1);
		const data = parseJsonIsland(findJsonIslands(once, "data-vpk-film-data")[0].raw);
		assert.equal(data.duration, 6.033333, "duration from ffprobe");
		assert.deepEqual(data.chapters, AUTHORED.chapters, "authored chapters kept");
		assert.equal(data.posterTime, 3.3);
		assert.deepEqual(data.marks, { throw: 1.2 });
		assert.deepEqual(Object.keys(data.segments[0]), ["id", "label", "kind", "film", "clock"], "frames, source and errors are not copied");
		assert.doesNotMatch(once, /should never reach the HTML|rehearsal-target\.capture\.mjs/);
		assert.match(once, /data-vpk-film-provenance>Captured from rehearsal-target\.html at 1280 × 720, 30 fps\. rehearsal clock: hold, 181 frames, 6\.03 s\. Encoded 1280 × 720, 6\.03 s, 293 KB H\.264, no audio\. Held frames are drawn from the page&#39;s own clock; worker and iframe clocks are not held\.</);
		assert.equal(once.includes(dir), false, "no absolute path is written");
		assert.ok(first.lines[0].startsWith("embedded: _film/film.mp4 300000 sha256:"));
		assert.match(first.lines.at(-1), /^weight: case\.html \d\.\d\d MB/);
		const result = validateHtmlString(once, "case.html");
		assert.deepEqual(result.failures, [], "a #feed chapter label stays check-html clean through serializeJsonIsland");
		assert.equal(outsideOwned(once), outsideOwned(fixtureHtml()), "byte-identical outside the embed-owned regions");
		for (const keep of [WS1.meta, WS1.blocks, 'data-vpk-id="h1abcd" data-vpk-revision="r2"', 'data-vpk-id="cue2xx"']) assert.ok(once.includes(keep), keep);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("embed: refuses a dead cue sheet (cues and the Gantt follow data-clock \"clock\", the capture names its segment otherwise) and writes nothing", async () => {
	const dir = embedDir();
	try {
		const renamed = { ...MANIFEST, segments: MANIFEST.segments.map(segment => ({ ...segment, id: "hold", label: "hold" })) };
		fs.writeFileSync(path.join(dir, "_film", "capture.json"), JSON.stringify(renamed));
		const before = fs.readFileSync(path.join(dir, "case.html"), "utf8");
		await assert.rejects(
			embedDocument({ htmlFile: "case.html", film: "_film/film.mp4", manifest: "_film/capture.json", cwd: dir, tools: fakeTools(), lite: "never" }),
			/nothing written: Gantt run-gantt, cue cue-1 follow clock segment "clock", which the film data of "film-player" lacks \(segments: hold\).*--segment-id clock/,
		);
		assert.equal(fs.readFileSync(path.join(dir, "case.html"), "utf8"), before);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("P4 cycle 2 item 2: clickStillTime aims ffmpeg (first frame at or after) at the frame a cue click shows", () => {
	const film = { fps: 30, duration: 6 };
	const frameOf = time => Math.max(0, Math.ceil(time * film.fps - 1e-9)); // ffmpeg -ss: the first frame starting at or after `time`
	for (const [t, frame] of [[0, 0], [2, 60], [2 + 1 / 60, 60], [2 - 1 / 30, 59], [5.99, 179]]) {
		assert.equal(frameOf(Number(clickStillTime(t, film).toFixed(3))), frame, `cue ${t} s: still of frame ${frame}`);
	}
	assert.equal(clickStillTime(0, film), 0, "never negative");
});

test("embed: --bake-thumbs puts one 360-wide still before each cue canvas, at the cue's film time; re-runs replace them", async () => {
	const dir = embedDir();
	try {
		const log = [];
		const options = { htmlFile: "case.html", film: "_film/film.mp4", manifest: "_film/capture.json", cwd: dir, tools: fakeTools(log), lite: "never", bakeThumbs: true, noPoster: true };
		await embedDocument(options);
		await embedDocument(options);
		const html = fs.readFileSync(path.join(dir, "case.html"), "utf8");
		assert.equal((html.match(/<img class="vpk-cue-thumb" alt="" width="240" height="135" src="data:image\/webp/g) ?? []).length, 3);
		assert.ok(/<img class="vpk-cue-thumb"[^>]*><canvas class="vpk-cue-thumb"/.test(html), "the img sits right before the canvas");
		// The frame a click shows (P4 cycle 2 item 2): a quarter frame before frames 18, 60 and 120, not 50 ms past the cue.
		assert.deepEqual(log.filter(entry => entry[0] === "still").slice(0, 3), [["still", 0.592, 360], ["still", 1.992, 360], ["still", 3.992, 360]], "the clock cue (t 0.6) resolves through the segment");
		assert.doesNotMatch(/<video\b[^>]*>/.exec(html)[0], /poster=/, "--no-poster");
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("embed (J5): the film data names the frame the poster shows, so the kit's readout agrees with the poster", async () => {
	const dir = embedDir();
	try {
		const posterTimeOf = () => parseJsonIsland(findJsonIslands(fs.readFileSync(path.join(dir, "case.html"), "utf8"), "data-vpk-film-data")[0].raw).posterTime;
		const base = { htmlFile: "case.html", film: "_film/film.mp4", manifest: "_film/capture.json", cwd: dir, lite: "never" };
		const log = [];
		await embedDocument({ ...base, tools: fakeTools(log) });
		assert.equal(posterTimeOf(), 3.3, "the authored poster time is baked and kept");
		await embedDocument({ ...base, tools: fakeTools(log), posterTime: 5 });
		assert.equal(posterTimeOf(), 5, "--poster-time changes both the still and the time the kit reports");
		assert.deepEqual(log.filter(entry => entry[0] === "still").at(-1).slice(0, 2), ["still", 5]);
		const once = fs.readFileSync(path.join(dir, "case.html"), "utf8");
		await embedDocument({ ...base, tools: fakeTools(), posterTime: 5 });
		assert.equal(fs.readFileSync(path.join(dir, "case.html"), "utf8"), once, "byte-stable on a re-run");
		await embedDocument({ ...base, tools: fakeTools(), noPoster: true });
		assert.equal(posterTimeOf(), 5, "--no-poster keeps the authored time for the runtime seek");
		fs.writeFileSync(path.join(dir, "_film", "poster.webp"), Buffer.alloc(20, 3));
		await embedDocument({ ...base, tools: fakeTools(), poster: "_film/poster.webp" });
		assert.equal(posterTimeOf(), undefined, "a custom image has no film time unless --poster-time says so");
		await embedDocument({ ...base, tools: fakeTools(), poster: "_film/poster.webp", posterTime: 2 });
		assert.equal(posterTimeOf(), 2);
		await embedDocument({ ...base, tools: fakeTools(), posterTime: 0 });
		assert.equal(posterTimeOf(), undefined, "a poster at film 0 needs no time");
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("embed: the fence refuses inputs outside the roots and secret names", async () => {
	const dir = embedDir();
	const outside = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "vpk-embed-out-")));
	try {
		fs.writeFileSync(path.join(outside, "film.mp4"), Buffer.alloc(10));
		const base = { htmlFile: path.join(dir, "case.html"), cwd: dir, tools: fakeTools(), lite: "never", tmpdir: null };
		await assert.rejects(embedDocument({ ...base, film: path.join(outside, "film.mp4") }), error => error instanceof FenceError && /outside the allowed roots/.test(error.message));
		await assert.doesNotReject(embedDocument({ ...base, film: path.join(outside, "film.mp4"), roots: [outside] }), "--root widens the fence");
		fs.writeFileSync(path.join(dir, "_film", "id_rsa"), "x");
		await assert.rejects(embedDocument({ ...base, film: "_film/id_rsa" }), /looks like a secret/);
		fs.writeFileSync(path.join(dir, "_film", "film.hq.mp4"), Buffer.alloc(10));
		await assert.rejects(embedDocument({ ...base, film: "_film/film.hq.mp4" }), /film\.hq\.mp4 is the hq deliverable \(1920 wide\), never embedded/);
		await assert.rejects(embedDocument({ ...base, film: "_film/film.mp4", lite: "sometimes" }), /--lite must be auto, always or never/);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
		fs.rmSync(outside, { recursive: true, force: true });
	}
});

test("lite: over budget writes <slug>.lite.html under budget, variant + note, no review data, WS1 addresses kept", async () => {
	const dir = embedDir(300000);
	try {
		const log = [];
		const budgetBytes = 700000;
		const result = await embedDocument({ htmlFile: "case.html", film: "_film/film.mp4", manifest: "_film/capture.json", cwd: dir, tools: fakeTools(log), budgetBytes });
		assert.ok(result.weight.bytes > budgetBytes);
		assert.match(result.warnings.join("\n"), /exceeds the 0\.70 MB data-URL viewer budget/);
		assert.ok(result.lite, "the lite copy is written");
		const lite = fs.readFileSync(path.join(dir, "case.lite.html"), "utf8");
		assert.ok(Buffer.byteLength(lite) <= budgetBytes, `lite is ${Buffer.byteLength(lite)} B`);
		assert.deepEqual(validateHtmlString(lite, "case.lite.html").failures, []);
		assert.match(/<html\b[^>]*>/.exec(lite)[0], /^<html data-vpk-variant="lite" data-vpk-lite-source="sha256:[0-9a-f]{12}" lang="en" data-vpk-literal-double-braces="true">$/);
		assert.equal(/data-vpk-lite-source="([^"]*)"/.exec(lite)[1], liteSourceHash(fs.readFileSync(path.join(dir, "case.html"), "utf8")), "the lite copy records its full copy");
		assert.match(lite, /<p class="vpk-film-lite-note" data-vpk-review-ignore>Lite copy: the film is re-encoded at 640 × 360 so viewers that cap file size can open it\. The full copy is case\.html\.<\/p>/);
		assert.doesNotMatch(lite, /data-vpk-review>|vpk-review-data:start/, "no review-data block by default (R21)");
		for (const keep of [WS1.meta, 'data-vpk-id="h1abcd"', 'data-vpk-id="cue2xx"', "data-vpk-revisions>"]) assert.ok(lite.includes(keep), keep);
		assert.match(/<video\b[^>]*>/.exec(lite)[0], /src="data:video\/mp4;base64,BQUF/);
		const target = log.find(entry => entry[0] === "lite")[1];
		const expected = Math.floor(((budgetBytes - (result.weight.bytes - /src="(data:video[^"]+)"/.exec(fs.readFileSync(path.join(dir, "case.html"), "utf8"))[1].length) - 16384) * 3) / 4);
		assert.equal(target, expected, "the target is liteFilmTargetBytes of the full file");
		assert.deepEqual(log.filter(entry => entry[0] === "still").map(entry => entry[2]), [1280, 640], "a 1280 poster, then a 640 lite poster");
		const keep = await embedDocument({ htmlFile: "case.html", film: "_film/film.mp4", manifest: "_film/capture.json", cwd: dir, tools: fakeTools(), budgetBytes, liteKeepReview: true });
		assert.ok(keep.lite);
		assert.match(fs.readFileSync(path.join(dir, "case.lite.html"), "utf8"), /data-vpk-review>/, "--lite-keep-review keeps the island");
		const under = await embedDocument({ htmlFile: "case.html", film: "_film/film.mp4", cwd: dir, tools: fakeTools(), budgetBytes: 5000000 });
		assert.equal(under.lite, null, "auto writes no lite copy under budget");
		await assert.rejects(embedDocument({ htmlFile: "case.html", film: "_film/film.mp4", cwd: dir, tools: fakeTools(), budgetBytes: 300000, lite: "always" }), /no lite copy: the page is \d+ B even with the film replaced by chapter stills, over the 300000 B budget/);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("lite still strip (item 17): a film target below 120 KB drops the film for chapter stills instead of failing; at 120 KB the film is re-encoded", async () => {
	const dir = embedDir(300000);
	try {
		const base = { htmlFile: "case.html", film: "_film/film.mp4", manifest: "_film/capture.json", cwd: dir };
		const full = await embedDocument({ ...base, tools: fakeTools(), lite: "never" });
		const html = fs.readFileSync(path.join(dir, "case.html"), "utf8");
		const nonFilm = full.weight.bytes - /src="(data:video[^"]+)"/.exec(html)[1].length;
		const budgetFor = target => nonFilm + 16384 + Math.ceil((target * 4) / 3);
		assert.equal(LITE_STRIP_BELOW_BYTES, 120000);
		const log = [];
		const result = await embedDocument({ ...base, tools: fakeTools(log), budgetBytes: budgetFor(100000), lite: "always" });
		assert.equal(result.lite.strip, true);
		assert.equal(log.some(entry => entry[0] === "lite"), false, "no lite encode was run");
		assert.deepEqual(log.filter(entry => entry[0] === "still").map(entry => entry.slice(1)), [[3.3, 1280], [3.3, 640], [0.05, 320], [2.05, 320]], "the poster, the lite poster, then one 320-wide still per chapter at its film time + 0.05 s");
		const lite = fs.readFileSync(path.join(dir, "case.lite.html"), "utf8");
		assert.deepEqual(validateHtmlString(lite, "case.lite.html").failures, []);
		assert.ok(Buffer.byteLength(lite) <= budgetFor(100000));
		const video = /<video\b[^>]*>/.exec(lite)[0];
		assert.doesNotMatch(video, /\ssrc=/, "no film in the lite copy");
		assert.doesNotMatch(lite, /data:video\/mp4/);
		assert.match(video, /poster="data:image\/webp/);
		assert.match(/<html\b[^>]*>/.exec(lite)[0], /data-vpk-variant="lite" data-vpk-lite-source="sha256:[0-9a-f]{12}"/);
		const strip = /<ol class="vpk-film-strip"[\s\S]*?<\/ol>/.exec(lite)[0];
		assert.equal((strip.match(/<li>/g) ?? []).length, 2, "one still per authored chapter");
		assert.match(strip, /alt="Chapter 1: &#35;feed, film 0\.0 s" width="320" height="180" src="data:image\/webp/, "labels are escaped the way the Gantt's are (a hash-like label cannot trip check-html)");
		assert.match(strip, /<figcaption>2 · Throw 2 · film 2\.0 s<\/figcaption>/);
		assert.match(strip, /^<ol class="vpk-film-strip" data-vpk-review-ignore aria-label="Film chapters, as stills">/);
		assert.match(lite, /<p class="vpk-film-lite-note" data-vpk-review-ignore>Lite copy: the film is left out so viewers that cap file size can open it; the chapter stills below stand in for it\. The full copy plays it: case\.html\.<\/p>/);
		assert.match(lite, /data-vpk-film-empty[^>]*>The film is left out of this lite copy; the chapter stills below stand in for it\.<\/p>/);
		assert.match(lite, /<div class="vpk-film-bar" hidden>/);
		assert.match(lite, /<style data-vpk-lite-strip>[^<]*var\(--rule\)[^<]*<\/style>\n<\/head>/, "the strip's CSS is in the head, with tokens only");
		assert.doesNotMatch(/<style data-vpk-lite-strip>[^<]*/.exec(lite)[0], /#[0-9a-f]{3,8}\b|rgb|hsl/i);
		assert.match(result.lines.at(-1), /^lite: case\.lite\.html .* \(chapter still strip, film target 98 KB is below 120 KB\)$/);
		for (const keep of [WS1.meta, 'data-vpk-id="h1abcd"', 'data-vpk-id="cue2xx"', "data-vpk-revisions>"]) assert.ok(lite.includes(keep), keep);
		const at = await embedDocument({ ...base, tools: fakeTools(), budgetBytes: budgetFor(120000), lite: "always" });
		assert.equal(at.lite.strip, false, "a target of exactly 120,000 B still gets the re-encoded film");
		assert.match(/<video\b[^>]*>/.exec(fs.readFileSync(path.join(dir, "case.lite.html"), "utf8"))[0], /\ssrc="data:video\/mp4/);
		const below = await embedDocument({ ...base, tools: fakeTools(), budgetBytes: budgetFor(119990), lite: "always" });
		assert.equal(below.lite.strip, true, "119,9xx B is below the threshold");
		const none = [];
		await embedDocument({ ...base, tools: fakeTools(none), budgetBytes: budgetFor(100000), lite: "always", noPoster: true });
		assert.deepEqual(none.filter(entry => entry[0] === "still").map(entry => entry[2]), [320, 320], "--no-poster: only the strip stills");
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("lite: a re-embed that writes no lite copy warns about an earlier <slug>.lite.html of another film or other content and leaves it in place", async () => {
	const dir = embedDir(300000);
	try {
		const htmlPath = path.join(dir, "case.html");
		const litePath = path.join(dir, "case.lite.html");
		const base = { htmlFile: "case.html", manifest: "_film/capture.json", cwd: dir, tools: fakeTools() };
		const staleOf = result => result.warnings.filter(warning => warning.startsWith("stale lite copy"));
		const STALE = /^stale lite copy: case\.lite\.html was made from another version of case\.html \(film or content changed; recorded (?:sha256:[0-9a-f]{12}|none), now sha256:[0-9a-f]{12}\) and is not rewritten/;
		const UNDER = /because the full copy is under the 5\.00 MB budget; delete it, or re-run with --lite always to refresh it$/;
		const NEVER = /because --lite never was passed/;
		const expectStale = (result, reason, written) => {
			assert.equal(result.lite, null);
			const stale = staleOf(result);
			assert.equal(stale.length, 1, JSON.stringify(result.warnings));
			assert.match(stale[0], STALE);
			assert.match(stale[0], reason);
			assert.equal(fs.readFileSync(litePath, "utf8"), written, "warned about, never deleted");
		};
		// A heavy figure the author later deletes: the page is over budget, so the lite copy is written and holds it.
		const figure = `<figure id="heavy"><img alt="old screenshot" width="10" height="10" src="data:image/png;base64,${Buffer.alloc(60000, 7).toString("base64")}"></figure>\n`;
		fs.writeFileSync(htmlPath, fs.readFileSync(htmlPath, "utf8").replace("</main>", `${figure}</main>`));
		assert.ok((await embedDocument({ ...base, film: "_film/film.mp4", budgetBytes: 700000 })).lite, "over budget: the lite copy is written");
		const written = fs.readFileSync(litePath, "utf8");
		assert.ok(written.includes('id="heavy"'));
		const same = await embedDocument({ ...base, film: "_film/film.mp4", budgetBytes: 5000000 });
		assert.equal(same.lite, null);
		assert.deepEqual(staleOf(same), [], "the lite copy holds this film and this content: nothing to report");
		// WS1 work on the full copy (stamps, doc metas, review islands) reaches the lite copy through review sync-lite.
		const full = fs.readFileSync(htmlPath, "utf8");
		fs.writeFileSync(htmlPath, full.replace("<h2", '<h2 data-vpk-id="h2zzzz" data-vpk-revision="r3"').replace('content="r2"', 'content="r3"').replace('"comments":[]', '"comments":[{"id":"c1"}]'));
		assert.deepEqual(staleOf(await embedDocument({ ...base, film: "_film/film.mp4", budgetBytes: 5000000 })), [], "WS1-owned changes only: not stale");
		// The same film and other content: the author deletes the heavy figure and re-embeds (round 5, verify5/stale).
		fs.writeFileSync(htmlPath, full.replace(figure, ""));
		expectStale(await embedDocument({ ...base, film: "_film/film.mp4", budgetBytes: 5000000 }), UNDER, written);
		expectStale(await embedDocument({ ...base, film: "_film/film.mp4", budgetBytes: 700000, lite: "never" }), NEVER, written);
		// Another film, under budget and with --lite never.
		fs.writeFileSync(path.join(dir, "_film", "small.mp4"), Buffer.alloc(40000, 9));
		expectStale(await embedDocument({ ...base, film: "_film/small.mp4", budgetBytes: 5000000 }), UNDER, written);
		expectStale(await embedDocument({ ...base, film: "_film/small.mp4", budgetBytes: 700000, lite: "never" }), NEVER, written);
		// A lite copy that predates the record is reported too.
		fs.writeFileSync(litePath, written.replace(/\sdata-vpk-lite-source="[^"]*"/, ""));
		assert.match(staleOf(await embedDocument({ ...base, film: "_film/small.mp4", budgetBytes: 5000000 }))[0] ?? "", /recorded none, now sha256:/);
		// --lite always refreshes it, and the next run that writes no lite copy is quiet again.
		assert.ok((await embedDocument({ ...base, film: "_film/small.mp4", budgetBytes: 700000, lite: "always" })).lite);
		assert.doesNotMatch(fs.readFileSync(litePath, "utf8"), /id="heavy"/, "the refreshed lite copy drops the deleted figure");
		assert.deepEqual(staleOf(await embedDocument({ ...base, film: "_film/small.mp4", budgetBytes: 5000000 })), []);
		fs.rmSync(litePath);
		assert.deepEqual(staleOf(await embedDocument({ ...base, film: "_film/small.mp4", budgetBytes: 5000000 })), [], "no lite copy, no warning");
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("mergeCaptureData: supplied films get the probed duration; offsets that disagree by more than a frame warn", () => {
	const supplied = mergeCaptureData({ fps: 30, chapters: [{ label: "A", film: 0 }], segments: [{ id: "film", kind: "real", film: [0, 0] }] }, null, { duration: 82.03 });
	assert.deepEqual(supplied.data.segments, [{ id: "film", label: "film", kind: "real", film: [0, 82.03], clock: { kind: "real" } }]);
	assert.deepEqual(supplied.warnings, []);
	const shifted = mergeCaptureData({ segments: [{ id: "clock", kind: "hold", film: [0.5, 6] }] }, MANIFEST, { duration: 6.04 });
	assert.match(shifted.warnings[0], /segment "clock" starts at 0\.500 s in the authored data but at 0\.000 s in the capture/);
	assert.equal(shifted.data.segments.at(-1).film[1], 6.04, "the last segment ends at the probed duration");
	assert.equal(setTagAttribute('<video a="1" src="old" muted>', "src", "new"), '<video src="new" a="1" muted>');
	assert.equal(setTagAttribute('<video src="old" muted>', "src", null), "<video muted>");
	assert.match(provenanceText({ manifest: null, probe: { width: 1280, height: 720, duration: 82.03 }, bytes: 739547, filmName: "landing.mp4" }), /^Supplied film landing\.mp4\. Encoded 1280 × 720, 82\.03 s, 722 KB H\.264, no audio\.$/);
	assert.throws(() => applyEmbed("<html><body><main></main></body></html>", { videoSrc: "x", filmData: {} }), /no \[data-vpk-film\] element/);
});

test("encodeFilm: a lite encode that overshoots its target retries once at 0.85x; the argv is the preset's", () => {
	const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "vpk-encode-test-")));
	try {
		const input = path.join(dir, "film.mp4");
		fs.writeFileSync(input, Buffer.alloc(10));
		const calls = [];
		const sizes = [700000, 560000];
		const run = (tool, argv) => {
			calls.push(argv);
			if (tool === "ffprobe") return { stdout: JSON.stringify({ format: { duration: "42.866" }, streams: [{ width: 640, height: 360, nb_read_packets: "1286" }] }) };
			return { stdout: "" };
		};
		const result = encodeFilm({ input, output: path.join(dir, "lite.mp4"), preset: "lite", targetBytes: 600000, ffmpeg: "ffmpeg", ffprobe: "ffprobe", run, size: () => sizes.shift() ?? 560000 });
		assert.equal(result.retried, true);
		assert.equal(result.bytes, 560000);
		const passes = calls.filter(argv => argv.includes("-pass"));
		assert.equal(passes.length, 4, "two passes, then two more for the retry");
		assert.equal(passes[0][passes[0].indexOf("-b:v") + 1], "107497", "twoPassBitrate(600000, 42.866)");
		assert.equal(passes[2][passes[2].indexOf("-b:v") + 1], String(Math.floor((510000 * 8 * 0.96) / 42.866)), "retry at 0.85 × target");
		assert.ok(passes.every(argv => argv.includes("-an")));
		const once = encodeFilm({ input, output: path.join(dir, "film.mp4.out.mp4"), preset: "film", ffmpeg: "ffmpeg", ffprobe: "ffprobe", run, size: () => 1 });
		assert.equal(once.retried, false);
		assert.equal(once.plan.passes.length, 1);
		assert.deepEqual(encodeFilm({ input, output: path.join(dir, "x.mp4"), dryRun: true, ffmpeg: null }).bytes, null);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});
