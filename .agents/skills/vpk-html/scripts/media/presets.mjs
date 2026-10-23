// vpk-html media · ffmpeg, ffprobe and cwebp argv builders for encode.mjs and embed.mjs
// (references/media-pipeline.md). Pure: nothing here spawns a process or reads a file.
//
// Measured with ffmpeg 8.1.1 (ws4a V12, V25, V26): `film` on the EU26 ffconcat gives 2,605,952 B
// (1288 frames, 42.933 s) and 739,547 B on the 82.03 s landing film; `lite` two-pass targeting
// 600,000 B gave 612,139 B, CRF 32 gave 602,213 B; `-g 60` costs about +22%.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

export const PRESETS = Object.freeze({
	film: Object.freeze({ width: 1280, preset: "slow", crf: 27 }),
	lite: Object.freeze({ width: 640, preset: "slow", crf: 32, twoPass: true }),
	hq: Object.freeze({ width: 1920, preset: "slow", crf: 22 }),
});
export const DEFAULT_FPS = 30;
export const TWO_PASS_HEADROOM = 0.96;
export const LITE_RETRY_FACTOR = 0.85;
export const STILLS = Object.freeze({ poster: { width: 1280, quality: 72 }, litePoster: { width: 640, quality: 72 }, thumb: { width: 360, quality: 60 }, strip: { width: 320, quality: 50 } });
const HEAD = Object.freeze(["-hide_banner", "-y"]);
const VIDEO_INPUT = /\.(?:mp4|m4v|mov)$/i;

/** Two-pass video bitrate (bits/s) that lands a film of `duration` seconds near `targetBytes`. */
export function twoPassBitrate(targetBytes, duration) {
	if (!(targetBytes > 0) || !(duration > 0)) throw new Error("twoPassBitrate needs a positive target and duration");
	return Math.floor((targetBytes * 8 * TWO_PASS_HEADROOM) / duration);
}

/** The retry target after a lite encode overshoots: 0.85 × the first target. */
export function liteRetryTarget(targetBytes) {
	return Math.floor(targetBytes * LITE_RETRY_FACTOR);
}

/** `-i` for a supplied film, the concat demuxer for a capture list. */
export function encodeInputArgs(input) {
	if (/\.ffconcat$/i.test(input)) return ["-f", "concat", "-safe", "0", "-i", input];
	if (VIDEO_INPUT.test(input)) return ["-i", input];
	throw new Error(`encode input must be a .ffconcat list or a video file: ${input}`);
}

/** Arguments every preset shares: CFR, no audio, faststart, yuv420p, bt709 tags and a TV-range lanczos scale. */
export function commonVideoArgs({ fps = DEFAULT_FPS, width }) {
	return [
		"-fps_mode", "cfr", "-r", String(fps), "-an", "-movflags", "+faststart", "-pix_fmt", "yuv420p",
		"-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
		"-vf", `scale=${width}:-2:flags=lanczos:out_range=tv,format=yuv420p`,
	];
}

/**
 * ffmpeg passes for one encode: `{ preset, width, bitrate?, passes: argv[] }`. `lite` with `targetBytes`
 * is two-pass at twoPassBitrate (pass 1 writes `-f mp4 /dev/null`); without a target it is CRF 32.
 */
export function buildEncodePlan({ input, output, preset = "film", width, crf, fps = DEFAULT_FPS, gop, targetBytes, duration, passlogfile }) {
	const settings = PRESETS[preset];
	if (!settings) throw new Error(`unknown preset "${preset}" (film, lite, hq)`);
	if (!output) throw new Error("encode needs an output path");
	const size = width ?? settings.width;
	const codec = ["-c:v", "libx264", "-preset", settings.preset];
	const tail = [...(gop ? ["-g", String(gop)] : []), ...commonVideoArgs({ fps, width: size })];
	const source = [...HEAD, ...encodeInputArgs(input)];
	if (settings.twoPass && targetBytes != null) {
		const bitrate = twoPassBitrate(targetBytes, duration);
		const log = passlogfile ?? path.join(os.tmpdir(), `vpk-html-encode-${path.basename(output)}`);
		const rate = ["-b:v", String(bitrate)];
		return {
			preset, width: size, bitrate,
			passes: [
				[...source, ...codec, ...rate, "-pass", "1", "-passlogfile", log, ...tail, "-f", "mp4", "/dev/null"],
				[...source, ...codec, ...rate, "-pass", "2", "-passlogfile", log, ...tail, output],
			],
		};
	}
	return { preset, width: size, passes: [[...source, ...codec, "-crf", String(crf ?? settings.crf), ...tail, output]] };
}

/** The lite plan for the single retry (0.85 × target). */
export function buildLiteRetryPlan(options) {
	return buildEncodePlan({ ...options, preset: "lite", targetBytes: liteRetryTarget(options.targetBytes) });
}

/** Contact sheet: `{ argv, times }`, one cell every duration/cells seconds, tiled `columns`×`rows`. */
export function buildContactSheetPlan({ input, output, duration, columns = 8, rows = 6, width = 240 }) {
	if (!(duration > 0)) throw new Error("contact sheet needs the film duration");
	const cells = columns * rows;
	const rate = (cells / duration).toFixed(6);
	const times = Array.from({ length: cells }, (_, index) => Math.round(((index * duration) / cells) * 1000) / 1000);
	return { times, argv: [...HEAD, "-i", input, "-vf", `fps=${rate},scale=${width}:-2,tile=${columns}x${rows}`, "-frames:v", "1", output] };
}

/** First executable `name` on PATH (plus Homebrew prefixes), else null. Injectable for tests. */
export function findTool(name, { env = process.env, exists = fs.existsSync } = {}) {
	const dirs = [...String(env.PATH ?? "").split(path.delimiter), "/opt/homebrew/bin", "/usr/local/bin"].filter(Boolean);
	for (const dir of new Set(dirs)) {
		const candidate = path.join(dir, name);
		if (exists(candidate)) return candidate;
	}
	return null;
}

/**
 * A still at `time`: ffmpeg pipes one PNG frame into cwebp (`-o <out> -- -`, which reads stdin), or, when
 * `which("cwebp")` finds nothing, ffmpeg writes an MJPEG `.jpg` beside the requested path instead.
 * Returns `{ tool: "cwebp" | "mjpeg", output, mime, ffmpeg: argv, cwebp?: argv }`.
 */
export function buildStillPlan({ input, time, output, width = STILLS.poster.width, quality = STILLS.poster.quality, which = findTool }) {
	const quiet = ["-hide_banner", "-loglevel", "error"];
	const frame = ["-ss", Number(time).toFixed(3), "-i", input, "-frames:v", "1", "-vf", `scale=${width}:-2`];
	const cwebp = which("cwebp");
	if (cwebp) {
		return {
			tool: "cwebp", output, mime: "image/webp", cwebpPath: cwebp,
			ffmpeg: [...quiet, ...frame, "-f", "image2pipe", "-c:v", "png", "-"],
			cwebp: ["-quiet", "-q", String(quality), "-m", "6", "-o", output, "--", "-"],
		};
	}
	const jpg = `${output.replace(/\.webp$/i, "")}.jpg`;
	return { tool: "mjpeg", output: jpg, mime: "image/jpeg", ffmpeg: [...quiet, "-y", ...frame, "-c:v", "mjpeg", "-q:v", "4", jpg] };
}

/** ffprobe argv for duration, frame count and size of the first video stream (JSON output). */
export function buildProbeArgs(file) {
	return ["-v", "error", "-select_streams", "v:0", "-count_packets", "-show_entries", "stream=width,height,nb_read_packets:format=duration", "-of", "json", file];
}

/** Parse buildProbeArgs output into `{ duration, frames, width, height }`. */
export function parseProbeOutput(text) {
	const data = JSON.parse(text);
	const stream = data.streams?.[0] ?? {};
	return { duration: Number(data.format?.duration), frames: Number(stream.nb_read_packets), width: Number(stream.width), height: Number(stream.height) };
}

/** Shell-quoted command line for --dry-run output. */
export function formatCommand(tool, argv) {
	return [tool, ...argv].map(arg => (/^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.split("'").join("'\\''")}'`)).join(" ");
}
