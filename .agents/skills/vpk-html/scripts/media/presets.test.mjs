import assert from "node:assert/strict";
import test from "node:test";
import {
	PRESETS,
	buildContactSheetPlan,
	buildEncodePlan,
	buildLiteRetryPlan,
	buildProbeArgs,
	buildStillPlan,
	commonVideoArgs,
	encodeInputArgs,
	findTool,
	formatCommand,
	liteRetryTarget,
	parseProbeOutput,
	twoPassBitrate,
} from "./presets.mjs";

const COMMON_1280 = [
	"-fps_mode", "cfr", "-r", "30", "-an", "-movflags", "+faststart", "-pix_fmt", "yuv420p",
	"-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
	"-vf", "scale=1280:-2:flags=lanczos:out_range=tv,format=yuv420p",
];
const CONCAT = ["-hide_banner", "-y", "-f", "concat", "-safe", "0", "-i", "cap/frames.ffconcat"];

test("presets carry the measured settings", () => {
	assert.deepEqual(PRESETS.film, { width: 1280, preset: "slow", crf: 27 });
	assert.deepEqual(PRESETS.lite, { width: 640, preset: "slow", crf: 32, twoPass: true });
	assert.deepEqual(PRESETS.hq, { width: 1920, preset: "slow", crf: 22 });
	assert.deepEqual(commonVideoArgs({ width: 1280 }), COMMON_1280);
});

test("film: exact single-pass argv from a capture list", () => {
	const plan = buildEncodePlan({ input: "cap/frames.ffconcat", output: "out/film.mp4" });
	assert.equal(plan.passes.length, 1);
	assert.deepEqual(plan.passes[0], [...CONCAT, "-c:v", "libx264", "-preset", "slow", "-crf", "27", ...COMMON_1280, "out/film.mp4"]);
	for (const needle of ["out_range=tv", "bt709", "+faststart", "-an"]) assert.ok(plan.passes[0].some(arg => arg.includes(needle)), needle);
	const tuned = buildEncodePlan({ input: "cap/frames.ffconcat", output: "o.mp4", width: 960, crf: 25, fps: 60, gop: 60 });
	assert.deepEqual(tuned.passes[0].slice(8, 18), ["-c:v", "libx264", "-preset", "slow", "-crf", "25", "-g", "60", "-fps_mode", "cfr"]);
	assert.ok(tuned.passes[0].includes("scale=960:-2:flags=lanczos:out_range=tv,format=yuv420p"));
	assert.equal(tuned.passes[0][tuned.passes[0].indexOf("-r") + 1], "60");
});

test("a supplied .mp4 uses -i and no concat demuxer", () => {
	const argv = buildEncodePlan({ input: "media/landing.mp4", output: "film.mp4" }).passes[0];
	assert.deepEqual(argv.slice(0, 4), ["-hide_banner", "-y", "-i", "media/landing.mp4"]);
	assert.equal(argv.includes("concat"), false);
	assert.deepEqual(encodeInputArgs("A.MOV"), ["-i", "A.MOV"]);
	assert.throws(() => encodeInputArgs("frames/"), /\.ffconcat list or a video file/);
});

test("lite: two passes at the target bitrate, and the single retry at 0.85 × target", () => {
	assert.equal(twoPassBitrate(600000, 42.866), 107497);
	const options = { input: "film.mp4", output: "lite.mp4", preset: "lite", targetBytes: 600000, duration: 42.866, passlogfile: "/tmp/pass" };
	const plan = buildEncodePlan(options);
	const common640 = commonVideoArgs({ width: 640 });
	assert.equal(plan.bitrate, 107497);
	assert.deepEqual(plan.passes, [
		["-hide_banner", "-y", "-i", "film.mp4", "-c:v", "libx264", "-preset", "slow", "-b:v", "107497", "-pass", "1", "-passlogfile", "/tmp/pass", ...common640, "-f", "mp4", "/dev/null"],
		["-hide_banner", "-y", "-i", "film.mp4", "-c:v", "libx264", "-preset", "slow", "-b:v", "107497", "-pass", "2", "-passlogfile", "/tmp/pass", ...common640, "lite.mp4"],
	]);
	assert.equal(liteRetryTarget(600000), 510000);
	const retry = buildLiteRetryPlan(options);
	assert.equal(retry.bitrate, twoPassBitrate(510000, 42.866));
	assert.equal(retry.bitrate, 91373, "⌊510000 · 8 · 0.96 / 42.866⌋");
	assert.deepEqual(retry.passes[1].slice(8, 10), ["-b:v", "91373"]);
	assert.throws(() => buildEncodePlan({ ...options, duration: undefined }), /positive target and duration/);
});

test("lite without a target is CRF 32; unknown presets and missing outputs fail", () => {
	const plan = buildEncodePlan({ input: "film.mp4", output: "lite.mp4", preset: "lite" });
	assert.equal(plan.passes.length, 1);
	assert.deepEqual(plan.passes[0].slice(4, 10), ["-c:v", "libx264", "-preset", "slow", "-crf", "32"]);
	assert.ok(plan.passes[0].includes("scale=640:-2:flags=lanczos:out_range=tv,format=yuv420p"));
	assert.deepEqual(buildEncodePlan({ input: "film.mp4", output: "hq.mp4", preset: "hq" }).passes[0].slice(8, 10), ["-crf", "22"]);
	assert.throws(() => buildEncodePlan({ input: "film.mp4", output: "x.mp4", preset: "ultra" }), /unknown preset "ultra"/);
	assert.throws(() => buildEncodePlan({ input: "film.mp4" }), /output path/);
});

test("hq (item 16): exact single-pass argv at 1920 wide, CRF 22, preset slow, with the same colour and no-audio tags as film", () => {
	const plan = buildEncodePlan({ input: "cap/frames.ffconcat", output: "out/film.hq.mp4", preset: "hq" });
	assert.equal(plan.passes.length, 1, "hq is single pass, never two-pass");
	assert.equal(plan.width, 1920);
	assert.deepEqual(plan.passes[0], [
		...CONCAT, "-c:v", "libx264", "-preset", "slow", "-crf", "22",
		...COMMON_1280.slice(0, -1), "scale=1920:-2:flags=lanczos:out_range=tv,format=yuv420p", "out/film.hq.mp4",
	]);
	const withSettings = buildEncodePlan({ input: "film.mp4", output: "o.mp4", preset: "hq", crf: 18, width: 2560, gop: 60, fps: 24 });
	assert.deepEqual([withSettings.width, withSettings.passes[0].includes("-g"), withSettings.passes[0][withSettings.passes[0].indexOf("-crf") + 1], withSettings.passes[0].includes("scale=2560:-2:flags=lanczos:out_range=tv,format=yuv420p")], [2560, true, "18", true], "--width, --crf and --gop override the preset");
	assert.deepEqual(buildEncodePlan({ input: "film.mp4", output: "o.mp4", preset: "hq", targetBytes: 500000, duration: 10 }).passes.length, 1, "a byte target is only for lite");
});

test("stills pipe a PNG frame into cwebp, whose argv ends -o <out> -- -", () => {
	const plan = buildStillPlan({ input: "film.mp4", time: 1.5, output: "poster.webp", which: name => `/opt/homebrew/bin/${name}` });
	assert.equal(plan.tool, "cwebp");
	assert.equal(plan.mime, "image/webp");
	assert.equal(plan.cwebpPath, "/opt/homebrew/bin/cwebp");
	assert.deepEqual(plan.ffmpeg, ["-hide_banner", "-loglevel", "error", "-ss", "1.500", "-i", "film.mp4", "-frames:v", "1", "-vf", "scale=1280:-2", "-f", "image2pipe", "-c:v", "png", "-"]);
	assert.deepEqual(plan.cwebp, ["-quiet", "-q", "72", "-m", "6", "-o", "poster.webp", "--", "-"]);
	assert.deepEqual(plan.cwebp.slice(-4), ["-o", "poster.webp", "--", "-"]);
	const thumb = buildStillPlan({ input: "film.mp4", time: 3, output: "t.webp", width: 360, quality: 60, which: () => "/x/cwebp" });
	assert.deepEqual(thumb.cwebp.slice(0, 3), ["-quiet", "-q", "60"]);
	assert.ok(thumb.ffmpeg.includes("scale=360:-2"));
});

test("the mjpeg fallback is chosen when which() reports no cwebp", () => {
	const plan = buildStillPlan({ input: "film.mp4", time: 2, output: "out/poster.webp", which: () => null });
	assert.equal(plan.tool, "mjpeg");
	assert.equal(plan.output, "out/poster.jpg");
	assert.equal(plan.mime, "image/jpeg");
	assert.equal(plan.cwebp, undefined);
	assert.deepEqual(plan.ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-ss", "2.000", "-i", "film.mp4", "-frames:v", "1", "-vf", "scale=1280:-2", "-c:v", "mjpeg", "-q:v", "4", "out/poster.jpg"]);
});

test("findTool scans PATH and the Homebrew prefixes", () => {
	const present = new Set(["/opt/homebrew/bin/cwebp", "/custom/bin/ffmpeg"]);
	const exists = file => present.has(file);
	assert.equal(findTool("ffmpeg", { env: { PATH: "/usr/bin:/custom/bin" }, exists }), "/custom/bin/ffmpeg");
	assert.equal(findTool("cwebp", { env: { PATH: "/usr/bin" }, exists }), "/opt/homebrew/bin/cwebp");
	assert.equal(findTool("nope", { env: {}, exists }), null);
});

test("contact sheet: fps, scale and tile filters, one frame, and the film time of each cell", () => {
	const plan = buildContactSheetPlan({ input: "film.mp4", output: "sheet.jpg", duration: 48 });
	assert.deepEqual(plan.argv, ["-hide_banner", "-y", "-i", "film.mp4", "-vf", "fps=1.000000,scale=240:-2,tile=8x6", "-frames:v", "1", "sheet.jpg"]);
	assert.equal(plan.times.length, 48);
	assert.deepEqual(plan.times.slice(0, 3), [0, 1, 2]);
	assert.equal(plan.times.at(-1), 47);
	const odd = buildContactSheetPlan({ input: "f.mp4", output: "s.jpg", duration: 42.866, columns: 4, rows: 2 });
	assert.equal(odd.argv[5], "fps=0.186628,scale=240:-2,tile=4x2");
	assert.deepEqual(odd.times, [0, 5.358, 10.717, 16.075, 21.433, 26.791, 32.15, 37.508]);
	assert.throws(() => buildContactSheetPlan({ input: "f.mp4", output: "s.jpg" }), /duration/);
});

test("ffprobe argv and parsing; dry-run commands are shell-quoted", () => {
	assert.deepEqual(buildProbeArgs("film.mp4"), ["-v", "error", "-select_streams", "v:0", "-count_packets", "-show_entries", "stream=width,height,nb_read_packets:format=duration", "-of", "json", "film.mp4"]);
	assert.deepEqual(parseProbeOutput(JSON.stringify({ streams: [{ width: 1280, height: 720, nb_read_packets: "1288" }], format: { duration: "42.933333" } })), { duration: 42.933333, frames: 1288, width: 1280, height: 720 });
	assert.equal(formatCommand("ffmpeg", ["-i", "my film's cut.mp4", "-vf", "scale=640:-2", "out.mp4"]), "ffmpeg -i 'my film'\\''s cut.mp4' -vf scale=640:-2 out.mp4");
});
