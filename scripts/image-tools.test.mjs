import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { contactSheet, crop, decodePixels, encodePng, pixelDiff, readPngSize, resize, runCli } from "./image-tools.mjs";

// An opaque image whose every pixel is distinct, so a shifted crop cannot pass.
function fixture(width, height, seed = 13) {
	const pixels = Buffer.alloc(width * height * 4);
	for (let index = 0; index < pixels.length; index += 1) pixels[index] = (index * 7919 + seed) % 256;
	for (let index = 3; index < pixels.length; index += 4) pixels[index] = 255;
	return { pixels, png: encodePng(width, height, pixels) };
}

test("a PNG round-trips through decode bit for bit", () => {
	const { pixels, png } = fixture(37, 23);
	assert.deepEqual(readPngSize(png), { width: 37, height: 23 });
	assert.ok(decodePixels(png).pixels.equals(pixels));
	assert.throws(() => readPngSize(Buffer.from("GIF89a")), /Not a PNG/u);
});

test("crop keeps the source's exact pixels and rejects a box outside the image", () => {
	const { pixels, png } = fixture(37, 23);
	const cropped = decodePixels(crop(png, { x: 3, y: 4, width: 10, height: 5 }));
	assert.equal(cropped.width, 10);
	assert.equal(cropped.height, 5);
	for (let row = 0; row < 5; row += 1) {
		const source = pixels.subarray(((row + 4) * 37 + 3) * 4, ((row + 4) * 37 + 13) * 4);
		assert.ok(cropped.pixels.subarray(row * 40, (row + 1) * 40).equals(source), `row ${row}`);
	}
	assert.throws(() => crop(png, { x: 30, y: 0, width: 10, height: 5 }), /does not fit/u);
	assert.throws(() => crop(png, { x: -1, y: 0, width: 10, height: 5 }), /non-negative integer/u);
});

test("resize keeps the aspect ratio from one dimension or a scale", () => {
	const { png } = fixture(40, 20);
	assert.deepEqual(readPngSize(resize(png, { width: 10 })), { width: 10, height: 5 });
	assert.deepEqual(readPngSize(resize(png, { height: 40 })), { width: 80, height: 40 });
	assert.deepEqual(readPngSize(resize(png, { scale: 0.5 })), { width: 20, height: 10 });
	assert.throws(() => resize(png, { width: 10, scale: 2 }), /exactly one/u);
});

test("a contact sheet lays images out in a grid scaled to one cell width", () => {
	const wide = fixture(40, 20).png;
	const tall = fixture(20, 40, 99).png;
	const sheet = contactSheet([{ png: wide, label: "a" }, { png: tall, label: "b" }, { png: wide, label: "c" }], { columns: 2, cellWidth: 100, gap: 10 });
	// Row 1 is as tall as the tall image (200), row 2 as the wide one (50).
	assert.deepEqual({ width: sheet.width, height: sheet.height }, { width: 230, height: 280 });
	assert.deepEqual(readPngSize(sheet.png), { width: 230, height: 280 });
});

test("pixel diff counts pixels over the threshold and marks them red", () => {
	const a = fixture(8, 4);
	const changed = Buffer.from(a.pixels);
	changed[0] = (changed[0] + 50) % 256;
	changed[(3 * 8 + 7) * 4 + 1] = (changed[(3 * 8 + 7) * 4 + 1] + 3) % 256;
	const b = encodePng(8, 4, changed);

	const strict = pixelDiff(a.png, b);
	assert.equal(strict.differentPixels, 2);
	assert.equal(strict.ratio, 2 / 32);
	const marks = decodePixels(strict.diffPng).pixels;
	assert.deepEqual([...marks.subarray(0, 4)], [255, 0, 0, 255]);
	assert.equal(pixelDiff(a.png, b, { threshold: 5 }).differentPixels, 1);
	assert.equal(pixelDiff(a.png, a.png).differentPixels, 0);
	assert.equal(pixelDiff(a.png, fixture(4, 8).png).sameSize, false);
});

test("the CLI writes its outputs and diff exits like cmp", (t) => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "image-tools-"));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	const a = path.join(dir, "a.png");
	const b = path.join(dir, "b.png");
	fs.writeFileSync(a, fixture(16, 8).png);
	fs.writeFileSync(b, fixture(16, 8, 14).png);
	const out = [];
	const stdout = { write: (text) => out.push(text) };

	assert.equal(runCli(["crop", a, "0", "0", "4", "4", "--out", path.join(dir, "crop.png")], { stdout }), 0);
	assert.deepEqual(readPngSize(fs.readFileSync(path.join(dir, "crop.png"))), { width: 4, height: 4 });
	assert.equal(runCli(["resize", a, "--scale", "2", "--out", path.join(dir, "big.png")], { stdout }), 0);
	assert.equal(runCli(["contact-sheet", a, b, "--out", path.join(dir, "sheet.png"), "--cell-width", "32"], { stdout }), 0);
	assert.equal(runCli(["diff", a, a], { stdout }), 0);
	assert.equal(runCli(["diff", a, b, "--out", path.join(dir, "diff.png"), "--json"], { stdout }), 1);
	assert.equal(JSON.parse(out.at(-1)).differentPixels, 128);
	assert.ok(fs.existsSync(path.join(dir, "diff.png")));
	assert.throws(() => runCli(["crop", a, "0", "0", "4", "4"], { stdout }), /--out <file> is required/u);
});
