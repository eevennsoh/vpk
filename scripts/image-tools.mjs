#!/usr/bin/env node

// PNG crop, resize, contact sheet and pixel diff without Python, for screenshots and
// evidence frames. Agents reached for `from PIL import Image` (mostly to crop) and hit
// "No module named 'PIL'"; this does the same with @resvg/resvg-js, which the repo already
// depends on. resvg decodes an embedded PNG and renders it at 1:1 pixel for pixel, so a
// crop or a diff reads the source's exact pixels.
//
//   pnpm image-tools crop <in.png> <x> <y> <width> <height> --out <file>
//   pnpm image-tools resize <in.png> (--width <px> | --height <px> | --scale <f>) --out <file>
//   pnpm image-tools contact-sheet <in.png>... --out <file> [--columns <n>] [--cell-width <px>] [--labels]
//   pnpm image-tools diff <a.png> <b.png> [--out <diff.png>] [--threshold <0-255>] [--json]
//
// diff exits 1 when any pixel differs (or the sizes differ), like cmp.

import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const SVG_NS = "http://www.w3.org/2000/svg";

export function readPngSize(png) {
	if (png.length < 24 || !png.subarray(0, 8).equals(PNG_SIGNATURE) || png.toString("latin1", 12, 16) !== "IHDR") {
		throw new Error("Not a PNG file (only PNG is supported).");
	}
	return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

function imageElement(png, { x = 0, y = 0, width, height }) {
	return `<image x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="none" href="data:image/png;base64,${png.toString("base64")}"/>`;
}

// System fonts load only for labelled contact sheets; scanning them costs about a second.
function render(svg, { fonts = false } = {}) {
	return new Resvg(svg, { font: { loadSystemFonts: fonts } }).render();
}

// RGBA bytes of a PNG, exactly as stored (opaque screenshots round-trip bit for bit).
export function decodePixels(png) {
	const { width, height } = readPngSize(png);
	const image = render(`<svg xmlns="${SVG_NS}" width="${width}" height="${height}">${imageElement(png, { width, height })}</svg>`);
	return { width, height, pixels: Buffer.from(image.pixels) };
}

export function encodePng(width, height, rgba) {
	const stride = width * 4;
	const raw = Buffer.alloc((stride + 1) * height);
	for (let row = 0; row < height; row += 1) {
		rgba.copy(raw, row * (stride + 1) + 1, row * stride, (row + 1) * stride);
	}
	const chunk = (type, data) => {
		const length = Buffer.alloc(4);
		length.writeUInt32BE(data.length);
		const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
		const crc = Buffer.alloc(4);
		crc.writeUInt32BE(zlib.crc32(body));
		return Buffer.concat([length, body, crc]);
	};
	const header = Buffer.alloc(13);
	header.writeUInt32BE(width, 0);
	header.writeUInt32BE(height, 4);
	header[8] = 8; // bit depth
	header[9] = 6; // RGBA
	return Buffer.concat([PNG_SIGNATURE, chunk("IHDR", header), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

export function crop(png, { x, y, width, height }) {
	const size = readPngSize(png);
	for (const [name, value] of Object.entries({ x, y, width, height })) {
		if (!Number.isInteger(value) || value < 0) throw new Error(`crop ${name} must be a non-negative integer.`);
	}
	if (width === 0 || height === 0 || x + width > size.width || y + height > size.height) {
		throw new Error(`crop ${width}x${height}+${x}+${y} does not fit inside the ${size.width}x${size.height} image.`);
	}
	const svg = `<svg xmlns="${SVG_NS}" width="${width}" height="${height}">${imageElement(png, { x: -x, y: -y, ...size })}</svg>`;
	return Buffer.from(render(svg).asPng());
}

export function resize(png, { width, height, scale }) {
	const size = readPngSize(png);
	const given = [width, height, scale].filter((value) => value !== undefined);
	if (given.length !== 1) throw new Error("resize takes exactly one of --width, --height or --scale.");
	const factor = scale ?? (width !== undefined ? width / size.width : height / size.height);
	if (!(factor > 0) || !Number.isFinite(factor)) throw new Error("resize needs a positive size or scale.");
	const outWidth = Math.max(1, Math.round(size.width * factor));
	const outHeight = Math.max(1, Math.round(size.height * factor));
	const svg = `<svg xmlns="${SVG_NS}" width="${outWidth}" height="${outHeight}">${imageElement(png, { width: outWidth, height: outHeight })}</svg>`;
	return Buffer.from(render(svg).asPng());
}

function escapeXml(text) {
	return text.replace(/[<>&"']/gu, (char) => `&#${char.charCodeAt(0)};`);
}

// A grid of images scaled to one cell width, in the order given, on a white background.
export function contactSheet(entries, { columns = Math.min(entries.length, 4), cellWidth = 480, gap = 16, labels = false } = {}) {
	if (entries.length === 0) throw new Error("contact-sheet needs at least one image.");
	const labelHeight = labels ? 28 : 0;
	const cells = entries.map(({ png, label }) => {
		const size = readPngSize(png);
		return { png, label, width: cellWidth, height: Math.max(1, Math.round((size.height * cellWidth) / size.width)) };
	});
	const rows = [];
	for (let index = 0; index < cells.length; index += columns) rows.push(cells.slice(index, index + columns));
	const rowHeights = rows.map((row) => Math.max(...row.map((cell) => cell.height)) + labelHeight);
	const width = gap + columns * (cellWidth + gap);
	const height = gap + rowHeights.reduce((sum, rowHeight) => sum + rowHeight + gap, 0);
	const parts = [`<rect width="${width}" height="${height}" fill="#ffffff"/>`];
	let top = gap;
	rows.forEach((row, rowIndex) => {
		row.forEach((cell, column) => {
			const left = gap + column * (cellWidth + gap);
			parts.push(imageElement(cell.png, { x: left, y: top, width: cell.width, height: cell.height }));
			if (labels) {
				parts.push(`<text x="${left}" y="${top + cell.height + 20}" font-family="sans-serif" font-size="16" fill="#172b4d">${escapeXml(cell.label)}</text>`);
			}
		});
		top += rowHeights[rowIndex] + gap;
	});
	return { width, height, png: Buffer.from(render(`<svg xmlns="${SVG_NS}" width="${width}" height="${height}">${parts.join("")}</svg>`, { fonts: labels }).asPng()) };
}

// Pixels whose largest channel difference exceeds `threshold`. The diff image shows the
// first image dimmed to grey with every differing pixel in red.
export function pixelDiff(pngA, pngB, { threshold = 0 } = {}) {
	const a = decodePixels(pngA);
	const b = decodePixels(pngB);
	if (a.width !== b.width || a.height !== b.height) {
		return { sameSize: false, width: [a.width, b.width], height: [a.height, b.height], differentPixels: null, ratio: null, diffPng: null };
	}
	const out = Buffer.alloc(a.pixels.length);
	let differentPixels = 0;
	for (let offset = 0; offset < a.pixels.length; offset += 4) {
		let delta = 0;
		for (let channel = 0; channel < 4; channel += 1) {
			delta = Math.max(delta, Math.abs(a.pixels[offset + channel] - b.pixels[offset + channel]));
		}
		if (delta > threshold) {
			differentPixels += 1;
			out.set([255, 0, 0, 255], offset);
		} else {
			const grey = Math.round(0.3 * a.pixels[offset] + 0.59 * a.pixels[offset + 1] + 0.11 * a.pixels[offset + 2]);
			const dimmed = Math.round(255 - (255 - grey) * 0.25);
			out.set([dimmed, dimmed, dimmed, 255], offset);
		}
	}
	const total = a.width * a.height;
	return {
		sameSize: true,
		width: a.width,
		height: a.height,
		differentPixels,
		ratio: total === 0 ? 0 : differentPixels / total,
		diffPng: encodePng(a.width, a.height, out),
	};
}

function parseArgs(argv) {
	const positional = [];
	const flags = {};
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--labels" || arg === "--json") flags[arg.slice(2)] = true;
		else if (arg.startsWith("--")) {
			const value = argv[index + 1];
			if (value === undefined) throw new Error(`${arg} needs a value.`);
			flags[arg.slice(2)] = value;
			index += 1;
		} else positional.push(arg);
	}
	return { positional, flags };
}

function number(value, name) {
	if (value === undefined) return undefined;
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number.`);
	return parsed;
}

function requireOut(flags) {
	if (!flags.out) throw new Error("--out <file> is required.");
	fs.mkdirSync(path.dirname(path.resolve(flags.out)), { recursive: true });
	return flags.out;
}

const USAGE = `Usage:
  image-tools crop <in.png> <x> <y> <width> <height> --out <file>
  image-tools resize <in.png> (--width <px> | --height <px> | --scale <f>) --out <file>
  image-tools contact-sheet <in.png>... --out <file> [--columns <n>] [--cell-width <px>] [--labels]
  image-tools diff <a.png> <b.png> [--out <diff.png>] [--threshold <0-255>] [--json]
`;

export function runCli(argv, { stdout = process.stdout } = {}) {
	const [command, ...rest] = argv;
	const { positional, flags } = parseArgs(rest);
	const read = (file) => fs.readFileSync(file);
	if (command === "crop" && positional.length === 5) {
		const [input, x, y, width, height] = positional;
		const out = requireOut(flags);
		fs.writeFileSync(out, crop(read(input), { x: number(x, "x"), y: number(y, "y"), width: number(width, "width"), height: number(height, "height") }));
		stdout.write(`${out}\n`);
		return 0;
	}
	if (command === "resize" && positional.length === 1) {
		const out = requireOut(flags);
		fs.writeFileSync(out, resize(read(positional[0]), { width: number(flags.width, "--width"), height: number(flags.height, "--height"), scale: number(flags.scale, "--scale") }));
		stdout.write(`${out}\n`);
		return 0;
	}
	if (command === "contact-sheet" && positional.length > 0) {
		const out = requireOut(flags);
		const sheet = contactSheet(positional.map((file) => ({ png: read(file), label: path.basename(file) })), {
			columns: number(flags.columns, "--columns"),
			cellWidth: number(flags["cell-width"], "--cell-width"),
			labels: Boolean(flags.labels),
		});
		fs.writeFileSync(out, sheet.png);
		stdout.write(`${out}\n`);
		return 0;
	}
	if (command === "diff" && positional.length === 2) {
		const result = pixelDiff(read(positional[0]), read(positional[1]), { threshold: number(flags.threshold, "--threshold") ?? 0 });
		if (result.diffPng && flags.out) fs.writeFileSync(requireOut(flags), result.diffPng);
		const summary = { a: positional[0], b: positional[1], ...result, diffPng: undefined, out: result.diffPng && flags.out ? flags.out : null };
		stdout.write(flags.json
			? `${JSON.stringify(summary, null, "\t")}\n`
			: result.sameSize
				? `${result.differentPixels} of ${result.width * result.height} pixels differ (${(result.ratio * 100).toFixed(3)}%)${summary.out ? `; diff image ${summary.out}` : ""}\n`
				: `Sizes differ: ${result.width[0]}x${result.height[0]} vs ${result.width[1]}x${result.height[1]}\n`);
		return result.sameSize && result.differentPixels === 0 ? 0 : 1;
	}
	process.stderr.write(USAGE);
	return 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
	try {
		process.exitCode = runCli(process.argv.slice(2));
	} catch (error) {
		process.stderr.write(`image-tools: ${error.message}\n`);
		process.exitCode = 2;
	}
}
