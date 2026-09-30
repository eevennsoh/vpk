import assert from "node:assert/strict";
import test from "node:test";

import { caretAfterFormat, formatAmount, formFor, toRaw, valueCharsBefore, wrap } from "./lib.ts";
import { EXAMPLES, EXAMPLE_IDS } from "./data.ts";

// ── wrap ──
//
// torph's root is `white-space: nowrap` so a morph can measure glyph boxes
// without the browser rewrapping underneath it, which means every line break in
// a multi-line value has to be explicit. This is what puts them there.

test("wrap keeps a short value on one line", () => {
	assert.equal(wrap("short", 20), "short");
});

test("wrap breaks between words rather than inside them", () => {
	assert.equal(wrap("alpha beta gamma", 11), "alpha beta\ngamma");
});

test("wrap never splits a word longer than the limit", () => {
	assert.equal(wrap("a supercalifragilistic b", 8), "a\nsupercalifragilistic\nb");
});

test("wrap keeps every line within the limit when the words allow it", () => {
	const text = "The capital of Australia is Canberra which sits in the Territory";
	for (const line of wrap(text, 28).split("\n")) {
		assert.ok(line.length <= 28, `"${line}" is ${line.length} chars`);
	}
});

test("wrap round-trips the original words in order", () => {
	const text = "one two three four five six seven";
	assert.equal(wrap(text, 9).split("\n").join(" "), text);
});

// ── formFor ──

test("formFor picks the longest form that still fits", () => {
	// Natural widths, widest first; 150px fits the 120px form but not the 200px one.
	assert.equal(formFor([200, 120, 60], 150, 1), 1);
});

test("formFor allows a form to squash down to the floor before giving", () => {
	// At a 0.75 floor the 200px form fits 150px, so it holds rather than abbreviating.
	assert.equal(formFor([200, 120, 60], 150, 0.75), 0);
});

test("formFor falls back to the shortest form when nothing fits", () => {
	assert.equal(formFor([200, 120, 60], 10, 1), 2);
});

// ── the formatted field ──
//
// A field somebody types in is the one place place-value matching is wrong, so
// the morph is driven by caret instead. These keep the caret on the same digit
// across a reformat that inserts or removes a separator.

test("formatAmount groups the integer part in threes", () => {
	assert.equal(formatAmount("1234567"), "1,234,567");
});

test("formatAmount leaves the fraction ungrouped", () => {
	assert.equal(formatAmount("1234567.89"), "1,234,567.89");
});

test("formatAmount does not group a value under four digits", () => {
	assert.equal(formatAmount("999"), "999");
});

test("formatAmount caps the fraction at two digits", () => {
	assert.equal(formatAmount("1.23456"), "1.23");
});

test("toRaw strips characters the field does not accept", () => {
	assert.equal(toRaw("1,234abc.5$6"), "1234.56");
});

test("toRaw keeps only the first decimal point", () => {
	assert.equal(toRaw("1.2.3"), "1.23");
});

test("valueCharsBefore ignores separators", () => {
	// "1,234" with the caret at index 5 is 4 value characters in, not 5.
	assert.equal(valueCharsBefore("1,234", 5), 4);
});

test("caretAfterFormat skips over separators", () => {
	assert.equal(caretAfterFormat("1,234", 4), 5);
});

test("caretAfterFormat places a zero count at the start", () => {
	assert.equal(caretAfterFormat("1,234", 0), 0);
});

test("caretAfterFormat clamps a count past the end to the end", () => {
	assert.equal(caretAfterFormat("1,234", 99), 5);
});

test("caret stays after the same digit when a reformat inserts a comma", () => {
	// Typing a digit onto "999" makes "9,999": the caret was after 4 value
	// characters and must still be, which is index 5 now, not 4.
	const before = valueCharsBefore("9999", 4);
	assert.equal(caretAfterFormat(formatAmount("9999"), before), 5);
});

test("caret survives a round trip through the field's own reformat", () => {
	// The exact sequence NumoraField runs on every keystroke.
	const typed = "1,2345";
	const count = valueCharsBefore(typed, typed.length);
	const raw = toRaw(typed);
	assert.equal(raw, "12345");
	assert.equal(formatAmount(raw), "12,345");
	// Five value characters in is the end of "12,345", which is index 6.
	assert.equal(caretAfterFormat(formatAmount(raw), count), 6);
});

// ── example registry ──

test("EXAMPLES declares the 33 examples shown on torph.lochie.me/examples", () => {
	assert.equal(EXAMPLES.length, 33);
	assert.equal(EXAMPLE_IDS.length, 33);
});

test("every example id is unique", () => {
	assert.equal(new Set(EXAMPLE_IDS).size, EXAMPLE_IDS.length);
});

test("every example carries a label and a blurb", () => {
	for (const example of EXAMPLES) {
		assert.ok(example.label.length > 0, `${example.id} has no label`);
		assert.ok(example.blurb.length > 0, `${example.id} has no blurb`);
		assert.equal(typeof example.interactive, "boolean", `${example.id} has no interactive flag`);
	}
});

test("every example id is kebab-case", () => {
	for (const id of EXAMPLE_IDS) {
		assert.match(id, /^[a-z]+(-[a-z]+)*$/u);
	}
});
