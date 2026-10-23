#!/usr/bin/env node
// vpk-html media · encode: frames or a supplied film → an H.264 MP4 for embed.mjs (references/media-pipeline.md).
//
//   node .agents/skills/vpk-html/scripts/media/encode.mjs <capture-dir|frames.ffconcat|film.mp4> [--preset film|lite|hq]
//        [--out film.mp4] [--width N] [--crf N] [--fps 30] [--gop N] [--target-bytes N] [--contact-sheet sheet.jpg]
//        [--record <encode.json>] [--dry-run]
//
// A capture dir means <dir>/frames.ffconcat (the concat demuxer); a .mp4/.mov/.m4v is the supplied-film path (-i).
// Presets live in presets.mjs: film (1280, CRF 27), lite (640; two-pass to --target-bytes with one retry at 0.85x,
// else CRF 32), hq (1920, CRF 22; a derived deliverable that embed.mjs refuses, default film.hq.mp4 + encode.hq.json).
// Audio is always dropped. --record writes { argv, ffmpegVersion, input, output, bytes, sha256_12, duration, frames }
// (default: encode.json beside --out). Needs ffmpeg and ffprobe on PATH.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { sha256_12 } from "./fence.mjs";
import { PRESETS, buildContactSheetPlan, buildEncodePlan, buildLiteRetryPlan, buildProbeArgs, findTool, formatCommand, parseProbeOutput } from "./presets.mjs";

export class EncodeError extends Error {}

/** Run a tool synchronously; throws EncodeError with its stderr tail on failure. */
export function runTool(tool, argv, { input } = {}) {
	const result = spawnSync(tool, argv, { encoding: input ? undefined : "utf8", input, maxBuffer: 64 * 1024 * 1024 });
	if (result.error || result.status !== 0) {
		const detail = String(result.stderr ?? result.error?.message ?? "").trim().split("\n").slice(-6).join("\n");
		throw new EncodeError(`${path.basename(tool)} failed (exit ${result.status ?? "?"}):\n${detail}`);
	}
	return result;
}

/** The ffmpeg input for a capture dir, a .ffconcat list or a supplied film. */
export function resolveEncodeInput(input) {
	const abs = path.resolve(input);
	if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
		const list = path.join(abs, "frames.ffconcat");
		if (!fs.existsSync(list)) throw new EncodeError(`no frames.ffconcat in ${input} (run capture.mjs first)`);
		return list;
	}
	if (!fs.existsSync(abs)) throw new EncodeError(`no such input: ${input}`);
	return abs;
}

/** Sum of the `duration` lines of an ffconcat list (seconds). */
export function ffconcatDuration(text) {
	return [...String(text).matchAll(/^duration ([\d.]+)$/gm)].reduce((sum, match) => sum + Number(match[1]), 0);
}

/** `{ duration, frames, width, height }` of a video file through ffprobe. */
export function probeFilm(file, { ffprobe = findTool("ffprobe"), run = runTool } = {}) {
	if (!ffprobe) throw new EncodeError("ffprobe is not on PATH (install ffmpeg)");
	return parseProbeOutput(run(ffprobe, buildProbeArgs(file)).stdout);
}

/**
 * Encode `input` to `output`. → { plan, passes: argv[][], bytes, retried, probe }. A lite encode with a target that
 * still overshoots retries once at 0.85 × target. `run` and the tool paths are injectable for tests.
 */
export function encodeFilm({ input, output, preset = "film", width, crf, fps = 30, gop, targetBytes, dryRun = false, ffmpeg = findTool("ffmpeg"), ffprobe = findTool("ffprobe"), run = runTool, size = file => fs.statSync(file).size }) {
	if (!PRESETS[preset]) throw new EncodeError(`unknown preset "${preset}" (film, lite, hq)`);
	if (!dryRun && !ffmpeg) throw new EncodeError("ffmpeg is not on PATH (install ffmpeg 5 or later)");
	const source = resolveEncodeInput(input);
	let duration = null;
	if (targetBytes != null) duration = /\.ffconcat$/i.test(source) ? ffconcatDuration(fs.readFileSync(source, "utf8")) : probeFilm(source, { ffprobe, run }).duration;
	const passlogfile = path.join(os.tmpdir(), `vpk-html-encode-${process.pid}-${path.basename(output)}`);
	const options = { input: source, output: path.resolve(output), preset, width, crf, fps, gop, targetBytes, duration, passlogfile };
	const plan = buildEncodePlan(options);
	const passes = [...plan.passes];
	if (dryRun) return { plan, passes, bytes: null, retried: false, probe: null };
	fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
	plan.passes.forEach(argv => run(ffmpeg, argv));
	let bytes = size(path.resolve(output));
	let retried = false;
	if (preset === "lite" && targetBytes != null && bytes > targetBytes) {
		const retry = buildLiteRetryPlan(options);
		retry.passes.forEach(argv => run(ffmpeg, argv));
		passes.push(...retry.passes);
		bytes = size(path.resolve(output));
		retried = true;
	}
	for (const suffix of ["-0.log", "-0.log.mbtree"]) fs.rmSync(`${passlogfile}${suffix}`, { force: true });
	return { plan, passes, bytes, retried, probe: ffprobe ? probeFilm(path.resolve(output), { ffprobe, run }) : null };
}

/** The encode.json record (relative paths only). */
export function encodeRecord({ result, input, output, ffmpeg = findTool("ffmpeg"), run = runTool, cwd = process.cwd() }) {
	const rel = file => path.relative(cwd, path.resolve(file)).split(path.sep).join("/");
	const version = ffmpeg ? String(run(ffmpeg, ["-version"]).stdout).split("\n")[0].trim() : "unknown";
	return {
		argv: result.passes.map(argv => argv.map(arg => (path.isAbsolute(arg) && arg !== "/dev/null" ? rel(arg) : arg))),
		ffmpegVersion: version, input: rel(input), output: rel(output), bytes: result.bytes,
		sha256_12: sha256_12(fs.readFileSync(output)), duration: result.probe?.duration ?? null, frames: result.probe?.frames ?? null,
		preset: result.plan.preset, width: result.plan.width, retried: result.retried,
	};
}

function parseArgs(argv) {
	const args = { preset: "film", dryRun: false };
	const flags = { "--preset": "preset", "--out": "out", "--width": "width", "--crf": "crf", "--fps": "fps", "--gop": "gop", "--target-bytes": "targetBytes", "--contact-sheet": "contactSheet", "--record": "record" };
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--dry-run") args.dryRun = true;
		else if (arg in flags) {
			const value = argv[(index += 1)];
			if (value == null) throw new EncodeError(`${arg} needs a value`);
			args[flags[arg]] = ["width", "crf", "fps", "gop", "targetBytes"].includes(flags[arg]) ? Number(value) : value;
		} else if (arg.startsWith("--")) throw new EncodeError(`unknown flag ${arg}`);
		else if (args.input) throw new EncodeError(`one input only (got ${args.input} and ${arg})`);
		else args.input = arg;
	}
	if (!args.input) throw new EncodeError("Usage: encode.mjs <capture-dir|frames.ffconcat|film.mp4> [--preset film|lite|hq] [--out film.mp4] …");
	return args;
}

function main(argv) {
	const args = parseArgs(argv);
	// hq is a derived deliverable (1920 wide, never embedded): its own file and record names keep it from replacing the film.
	const hq = args.preset === "hq";
	const output = args.out ?? path.join(fs.statSync(path.resolve(args.input)).isDirectory() ? args.input : path.dirname(args.input), hq ? "film.hq.mp4" : "film.mp4");
	const result = encodeFilm({ ...args, output });
	const ffmpeg = findTool("ffmpeg") ?? "ffmpeg";
	if (args.dryRun) {
		result.passes.forEach(pass => console.log(formatCommand(ffmpeg, pass)));
		return 0;
	}
	console.log(`✓ ${path.relative(process.cwd(), path.resolve(output))}: ${result.bytes} B, ${result.probe?.frames ?? "?"} frames, ${result.probe?.duration?.toFixed(3) ?? "?"} s (preset ${result.plan.preset}${result.retried ? ", retried at 0.85× target" : ""})`);
	const record = args.record ?? path.join(path.dirname(path.resolve(output)), hq ? "encode.hq.json" : "encode.json");
	fs.writeFileSync(record, `${JSON.stringify(encodeRecord({ result, input: resolveEncodeInput(args.input), output }), null, "\t")}\n`);
	console.log(`  record ${path.relative(process.cwd(), record)}`);
	if (args.contactSheet) {
		const sheet = buildContactSheetPlan({ input: path.resolve(output), output: path.resolve(args.contactSheet), duration: result.probe.duration });
		runTool(ffmpeg, sheet.argv);
		console.log(`  contact sheet ${args.contactSheet}: cells at ${sheet.times.join(", ")} s (review it before embedding: it is the privacy check)`);
	}
	return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	try {
		process.exitCode = main(process.argv.slice(2));
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
