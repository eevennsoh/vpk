import assert from "node:assert/strict";
import test from "node:test";

import { describeRelativeTimeLabel, formatElapsedTime, formatRelativeTime, toCompactRelativeTimeLabel } from "./elapsed-time.ts";

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
	assert.equal(formatRelativeTime(10, { showSeconds: true }), "10s ago");
	assert.equal(formatRelativeTime(60, { showSeconds: true }), "1m ago");
	assert.equal(formatRelativeTime(5 * 60), "5m ago");
	assert.equal(formatRelativeTime(60 * 60), "1h ago");
	assert.equal(formatRelativeTime(24 * 60 * 60), "Yesterday");
	assert.equal(formatRelativeTime(3 * 24 * 60 * 60), "3d ago");
});

test("toCompactRelativeTimeLabel shortens numeric relative timestamps", () => {
	assert.equal(toCompactRelativeTimeLabel("18m ago"), "18m");
	assert.equal(toCompactRelativeTimeLabel("7m ago"), "7m");
	assert.equal(toCompactRelativeTimeLabel("5h ago"), "5h");
	assert.equal(toCompactRelativeTimeLabel("5hr ago"), "5h");
	assert.equal(toCompactRelativeTimeLabel("1h"), "1h");
	assert.equal(toCompactRelativeTimeLabel("3d ago"), "3d");
	assert.equal(toCompactRelativeTimeLabel("5mo ago"), "5mo");
	assert.equal(toCompactRelativeTimeLabel("18 mins ago"), "18m");
	assert.equal(toCompactRelativeTimeLabel("1 hour ago"), "1h");
	assert.equal(toCompactRelativeTimeLabel("19 days ago"), "19d");
	assert.equal(toCompactRelativeTimeLabel("2 weeks ago"), "2w");
	assert.equal(toCompactRelativeTimeLabel("3 months ago"), "3mo");
	assert.equal(toCompactRelativeTimeLabel("1 year ago"), "1y");
	assert.equal(toCompactRelativeTimeLabel("19 May"), "19 May");
	assert.equal(toCompactRelativeTimeLabel("Last week"), "Last week");
	assert.equal(toCompactRelativeTimeLabel("Yesterday"), "Yesterday");
	assert.equal(toCompactRelativeTimeLabel("Just now"), "Just now");
});

test("describeRelativeTimeLabel spells out relative durations and recognizes named periods", () => {
	assert.equal(describeRelativeTimeLabel("2m"), "2 minutes ago");
	assert.equal(describeRelativeTimeLabel("18 mins ago"), "18 minutes ago");
	assert.equal(describeRelativeTimeLabel("1h"), "1 hour ago");
	assert.equal(describeRelativeTimeLabel("29d"), "29 days ago");
	assert.equal(describeRelativeTimeLabel("1mo"), "1 month ago");
	assert.equal(describeRelativeTimeLabel("last week"), "Last week");
	assert.equal(describeRelativeTimeLabel("Yesterday"), "Yesterday");
	assert.equal(describeRelativeTimeLabel("Just now"), "Less than a minute ago");
	assert.equal(describeRelativeTimeLabel("Just now", Date.UTC(2026, 10, 20)), undefined);
	assert.equal(describeRelativeTimeLabel("19 May"), undefined);
	assert.equal(describeRelativeTimeLabel(""), undefined);
});
