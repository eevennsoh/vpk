import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's strip-types test runner requires the explicit .ts extension here.
import { formatElapsedTime, formatRelativeTime, toCompactRelativeTimeLabel } from "./elapsed-time.ts";

test("formatElapsedTime omits zero seconds from exact-minute durations", () => {
	assert.equal(formatElapsedTime(300), "5m");
});

test("formatElapsedTime omits zero minutes from sub-minute durations", () => {
	assert.equal(formatElapsedTime(4), "4s");
});

test("formatElapsedTime keeps padded seconds when a remainder exists", () => {
	assert.equal(formatElapsedTime(304), "5m 04s");
	assert.equal(formatElapsedTime(312), "5m 12s");
});

test("formatElapsedTime hides empty and invalid durations", () => {
	assert.equal(formatElapsedTime(0), "");
	assert.equal(formatElapsedTime(-1), "");
	assert.equal(formatElapsedTime(Number.NaN), "");
});

test("formatRelativeTime uses contextual minute, hour, and day labels", () => {
	assert.equal(formatRelativeTime(5), "Just now");
	assert.equal(formatRelativeTime(5 * 60), "5m ago");
	assert.equal(formatRelativeTime(60 * 60), "1h ago");
	assert.equal(formatRelativeTime(24 * 60 * 60), "Yesterday");
	assert.equal(formatRelativeTime(3 * 24 * 60 * 60), "3d ago");
});

test("toCompactRelativeTimeLabel drops ago and shortens compact hours to h", () => {
	assert.equal(toCompactRelativeTimeLabel("18m ago"), "18m");
	assert.equal(toCompactRelativeTimeLabel("7m ago"), "7m");
	assert.equal(toCompactRelativeTimeLabel("5h ago"), "5h");
	assert.equal(toCompactRelativeTimeLabel("5hr ago"), "5h");
	assert.equal(toCompactRelativeTimeLabel("1h"), "1h");
	assert.equal(toCompactRelativeTimeLabel("3d ago"), "3d");
	assert.equal(toCompactRelativeTimeLabel("5mo ago"), "5mo");
	assert.equal(toCompactRelativeTimeLabel("Last week"), "Last week");
	assert.equal(toCompactRelativeTimeLabel("Yesterday"), "Yesterday");
	assert.equal(toCompactRelativeTimeLabel("Just now"), "Just now");
});
