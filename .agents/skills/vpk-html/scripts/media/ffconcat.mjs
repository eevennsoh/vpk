// vpk-html media · ffconcat: frame durations, the concat-demuxer list and film offsets for capture.mjs
// (references/media-pipeline.md). Held frames last 1/fps; screencast frames last ts[i+1] - ts[i] clamped to
// [0.001, 1.0], the last until the screencast stopped (>= 1/fps). Paths are relative to the list, POSIX, single-quoted.
// `option framerate <fps>` on each file (FFmpeg 5+): without it image2 gives every JPEG 1/25 s, CFR output duplicates an
// early frame and the film runs a frame late (FFmpeg 8.1.1: 88 of 91 held frames off by one); no last-file repeat needed.
import fs from "node:fs";
import path from "node:path";

export const FFCONCAT_HEADER = "ffconcat version 1.0";
export const FRAME_SECONDS = Object.freeze({ min: 0.001, max: 1.0 });
const round6 = value => Math.round(value * 1e6) / 1e6;

/** Frame file name inside a segment folder: f00000.jpg, f00001.jpg, … */
export function frameFileName(index) {
	return `f${String(index).padStart(5, "0")}.jpg`;
}

/** Durations for a screencast segment from CDP frame timestamps (seconds). `stop`, on the same clock, is when the
 * screencast stopped: the last frame lasts until then (at least 1/fps), so a page that settles keeps its still tail. */
export function screencastDurations(timestamps, { fps = 30, stop = null } = {}) {
	return timestamps.map((stamp, index) => (index + 1 < timestamps.length
		? Math.min(FRAME_SECONDS.max, Math.max(FRAME_SECONDS.min, timestamps[index + 1] - stamp))
		: Math.max(1 / fps, Number.isFinite(stop) ? stop - stamp : 0)));
}

/** The screencast stop time on the frames' clock: local stop time shifted by the smallest receive lag (stamps, received in s). */
export function screencastStopTime(stamps, received, stoppedAt) {
	let offset = -Infinity;
	for (let index = 0; index < stamps.length; index += 1) offset = Math.max(offset, stamps[index] - received[index]);
	return Number.isFinite(offset) ? stoppedAt + offset : null;
}

/** Single-quote a path for an ffconcat `file` line (`'` becomes `'\''`). */
export function quoteFfconcatPath(file) {
	return `'${String(file).split("'").join("'\\''")}'`;
}

/** The ffconcat text for `[{ file, duration }]`; durations are differences of the 1e-6-rounded running total (no drift). */
export function buildFfconcat(entries, { fps = 30 } = {}) {
	if (!entries.length) throw new Error("ffconcat: no frames");
	if (!(fps > 0)) throw new Error("ffconcat: fps must be positive");
	const lines = [FFCONCAT_HEADER];
	let total = 0;
	let written = 0;
	for (const { file, duration } of entries) {
		if (!(duration > 0)) throw new Error(`ffconcat: ${file} has no duration`);
		total += duration;
		const end = round6(total);
		lines.push(`file ${quoteFfconcatPath(file)}`, `option framerate ${fps}`, `duration ${String(round6(end - written))}`);
		written = end;
	}
	return `${lines.join("\n")}\n`;
}

/** Segment durations: hold segments repeat 1/fps; screencast segments use their measured `durations`. */
export function segmentDurations(segment, fps) {
	if (segment.kind === "screencast") return segment.durations ?? [];
	return Array.from({ length: segment.frames }, () => 1 / fps);
}

/** Film ranges in capture order: holds span frames/fps exactly, screencasts the sum of their durations (1e-6). New objects. */
export function segmentFilmRanges(segments, { fps }) {
	let start = 0;
	return segments.map(segment => {
		const end = segment.kind === "screencast"
			? round6(start + segmentDurations(segment, fps).reduce((sum, value) => sum + value, 0))
			: start + segment.frames / fps;
		const ranged = { ...segment, film: [start, end] };
		start = end;
		return ranged;
	});
}

/** Film time of each `{ name, frame }` mark (frame index within its segment) for ranged segments. */
export function markFilmTimes(rangedSegments, { fps }) {
	const marks = {};
	for (const segment of rangedSegments) {
		const durations = segmentDurations(segment, fps);
		for (const { name, frame } of segment.marks ?? []) {
			const offset = durations.slice(0, Math.max(0, Math.min(frame, durations.length))).reduce((sum, value) => sum + value, 0);
			marks[name] = round6(segment.film[0] + offset);
		}
	}
	return marks;
}

/** ffconcat entries for segments whose frames live in `<framesDir>/<segment id>/fNNNNN.jpg` from `firstFrame` (default 0). */
export function ffconcatEntries(segments, { framesDir, fps, relativeTo = framesDir }) {
	return segments.flatMap(segment => segmentDurations(segment, fps).map((duration, index) => ({
		file: path.relative(relativeTo, path.join(framesDir, segment.id, frameFileName((segment.firstFrame ?? 0) + index))).split(path.sep).join("/"),
		duration,
	})));
}

/** Write `<framesDir>/frames.ffconcat` and return its path. */
export function writeFfconcat(segments, { framesDir, fps }) {
	const file = path.join(framesDir, "frames.ffconcat");
	fs.writeFileSync(file, buildFfconcat(ffconcatEntries(segments, { framesDir, fps }), { fps }));
	return file;
}
