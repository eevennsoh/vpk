import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
	FFCONCAT_HEADER,
	buildFfconcat,
	ffconcatEntries,
	frameFileName,
	markFilmTimes,
	quoteFfconcatPath,
	screencastDurations,
	screencastStopTime,
	segmentDurations,
	segmentFilmRanges,
	writeFfconcat,
} from "./ffconcat.mjs";

const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} vs ${expected}`);

test("screencast timestamps become clamped durations; without a stop time the last frame lasts 1/fps", () => {
	const durations = screencastDurations([10, 10.0165, 10.01652, 10.05, 12.5, 12.6], { fps: 30 });
	near(durations[0], 0.0165);
	assert.equal(durations[1], 0.001, "clamped up to 1 ms");
	near(durations[2], 0.03348);
	assert.equal(durations[3], 1, "clamped down to 1 s");
	near(durations[4], 0.1);
	assert.equal(durations[5], 1 / 30);
	assert.deepEqual(screencastDurations([5], { fps: 25 }), [0.04]);
	assert.deepEqual(screencastDurations([]), []);
});

test("with a stop time the last frame lasts until the stop (at least 1/fps), so a settled page keeps its tail", () => {
	const single = screencastDurations([100], { fps: 30, stop: 101.5 });
	near(single[0], 1.5);
	const durations = screencastDurations([100, 100.2, 100.4], { fps: 30, stop: 102.4 });
	near(durations[2], 2, 1e-9);
	near(durations.reduce((sum, value) => sum + value, 0), 2.4, 1e-9);
	assert.equal(screencastDurations([100, 100.2], { fps: 30, stop: 100.21 })[1], 1 / 30, "never under one frame");
	assert.equal(screencastDurations([100], { fps: 30, stop: null })[0], 1 / 30, "no stop → 1/fps");
});

test("screencastStopTime maps the local stop onto the frames' clock with the smallest receive lag", () => {
	near(screencastStopTime([10, 10.5], [1010.02, 1010.53], 1012), 11.98, 1e-9);
	near(screencastStopTime([10], [10.004], 11.5), 11.496, 1e-9);
	assert.equal(screencastStopTime([], [], 5), null);
});

test("paths are single-quoted, with a quote written as '\\''", () => {
	assert.equal(quoteFfconcatPath("hold/f00000.jpg"), "'hold/f00000.jpg'");
	assert.equal(quoteFfconcatPath("it's/f00000.jpg"), "'it'\\''s/f00000.jpg'");
	assert.equal(frameFileName(0), "f00000.jpg");
	assert.equal(frameFileName(1287), "f01287.jpg");
});

test("buildFfconcat writes the header, a frame rate and a duration per file, and no trailing repeat", () => {
	const text = buildFfconcat([{ file: "a/f00000.jpg", duration: 0.5 }, { file: "it's/f00001.jpg", duration: 0.25 }], { fps: 24 });
	assert.equal(text, [
		FFCONCAT_HEADER,
		"file 'a/f00000.jpg'", "option framerate 24", "duration 0.5",
		"file 'it'\\''s/f00001.jpg'", "option framerate 24", "duration 0.25",
		"",
	].join("\n"));
	assert.match(buildFfconcat([{ file: "x.jpg", duration: 1 }]), /option framerate 30\n/, "30 fps by default");
	assert.throws(() => buildFfconcat([]), /no frames/);
	assert.throws(() => buildFfconcat([{ file: "x.jpg", duration: 0 }]), /x\.jpg has no duration/);
	assert.throws(() => buildFfconcat([{ file: "x.jpg", duration: 1 }], { fps: 0 }), /fps must be positive/);
});

test("listed durations add up to the film length without drift", () => {
	const frames = 1286;
	const text = buildFfconcat(Array.from({ length: frames }, (_, index) => ({ file: frameFileName(index), duration: 1 / 30 })));
	const listed = [...text.matchAll(/^duration (.+)$/gm)].map(match => match[1]);
	assert.equal(listed.length, frames);
	for (const value of listed) assert.match(value, /^0\.03333[34]$/, "six decimals at most");
	const total = listed.reduce((sum, value) => sum + Math.round(Number(value) * 1e6), 0) / 1e6;
	assert.equal(total, Math.round((frames / 30) * 1e6) / 1e6, "integer microseconds telescope to the rounded total");
	assert.equal((text.match(/^file /gm) ?? []).length, frames, "each frame is listed once");
	assert.equal((text.match(/^option framerate 30$/gm) ?? []).length, frames, "each frame carries the capture rate");
});

test("hold-segment film offsets sum exactly; screencasts span their summed durations", () => {
	const ranged = segmentFilmRanges([
		{ id: "a", kind: "hold", frames: 181 },
		{ id: "b", kind: "hold", frames: 181 },
		{ id: "live", kind: "screencast", durations: [0.0165, 0.03265, 0.00417, 1 / 30] },
		{ id: "c", kind: "hold", frames: 60 },
	], { fps: 30 });
	assert.deepEqual(ranged[0].film, [0, 181 / 30]);
	assert.deepEqual(ranged[1].film, [181 / 30, 181 / 30 + 181 / 30]);
	assert.equal(ranged[1].film[1] - ranged[1].film[0], 181 / 30, "film[1] - film[0] = frames / fps");
	assert.equal(ranged[1].film[1], 362 / 30);
	near(ranged[2].film[1] - ranged[2].film[0], 0.0165 + 0.03265 + 0.00417 + 1 / 30, 1e-6);
	assert.equal(ranged[3].film[0], ranged[2].film[1], "segments are contiguous");
	near(ranged[3].film[1] - ranged[3].film[0], 2, 1e-12);
	assert.equal(ranged[0].id, "a", "segment fields are kept");
	assert.deepEqual(segmentDurations({ kind: "hold", frames: 2 }, 25), [0.04, 0.04]);
});

test("marks resolve to the film time of their frame", () => {
	const ranged = segmentFilmRanges([
		{ id: "hold", kind: "hold", frames: 31, marks: [{ name: "lift", frame: 0 }, { name: "one-second", frame: 30 }] },
		{ id: "live", kind: "screencast", durations: [0.1, 0.2, 0.3], marks: [{ name: "drop", frame: 2 }, { name: "past-end", frame: 99 }] },
	], { fps: 30 });
	const marks = markFilmTimes(ranged, { fps: 30 });
	assert.equal(marks.lift, 0);
	assert.equal(marks["one-second"], 1);
	assert.equal(marks.drop, Math.round((31 / 30 + 0.3) * 1e6) / 1e6);
	assert.equal(marks["past-end"], Math.round((31 / 30 + 0.6) * 1e6) / 1e6, "a mark past the last frame lands at the segment end");
});

test("ffconcatEntries lists <framesDir>/<segment>/fNNNNN.jpg relative to the list, honouring firstFrame", () => {
	const framesDir = path.join(os.tmpdir(), "vpk-capture-x");
	const entries = ffconcatEntries([
		{ id: "hold", kind: "hold", frames: 2 },
		{ id: "live", kind: "screencast", durations: [0.5, 0.25], firstFrame: 40 },
	], { framesDir, fps: 30 });
	assert.deepEqual(entries.map(entry => entry.file), ["hold/f00000.jpg", "hold/f00001.jpg", "live/f00040.jpg", "live/f00041.jpg"]);
	assert.deepEqual(entries.map(entry => entry.duration), [1 / 30, 1 / 30, 0.5, 0.25]);
	const nested = ffconcatEntries([{ id: "hold", kind: "hold", frames: 1 }], { framesDir, fps: 30, relativeTo: path.dirname(framesDir) });
	assert.equal(nested[0].file, "vpk-capture-x/hold/f00000.jpg");
});

test("writeFfconcat writes frames.ffconcat into the frames dir", () => {
	const framesDir = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-ffconcat-"));
	const file = writeFfconcat([{ id: "hold", kind: "hold", frames: 3 }], { framesDir, fps: 25 });
	assert.equal(file, path.join(framesDir, "frames.ffconcat"));
	const text = fs.readFileSync(file, "utf8");
	assert.match(text, /^ffconcat version 1\.0\nfile 'hold\/f00000\.jpg'\noption framerate 25\nduration 0\.04\n/);
	assert.deepEqual(text.trimEnd().split("\n").slice(-3), ["file 'hold/f00002.jpg'", "option framerate 25", "duration 0.04"]);
	fs.rmSync(framesDir, { recursive: true, force: true });
});
