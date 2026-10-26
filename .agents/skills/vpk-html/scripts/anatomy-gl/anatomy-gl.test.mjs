// anatomy-gl engine (figure-engines.md § 11): vendor integrity, the token map, the plate and the page block.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { ANATOMY_GL_FIGURES } from "./figures.mjs";
import { ANATOMY_GL_TOKENS, anatomyGlPlate, anatomyGlRuntimeBlock, anatomyGlStyleTag, vendoredElementExists } from "./inline.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VENDOR = path.join(HERE, "vendor");

test("vendored files match VENDOR.json byte for byte, and every figure has its element entry", () => {
	const record = JSON.parse(fs.readFileSync(path.join(VENDOR, "VENDOR.json"), "utf8"));
	for (const [file, hash] of Object.entries(record.files)) {
		assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(VENDOR, file))).digest("hex"), hash, file);
	}
	assert.deepEqual(record.figures, ANATOMY_GL_FIGURES.map(figure => figure.slug));
	for (const figure of ANATOMY_GL_FIGURES) assert.ok(vendoredElementExists(figure.slug), figure.slug);
});

test("the token map sets every --anatomy-* colour the figures read from vpk tokens only, in both themes", () => {
	const keys = ["--anatomy-card", "--anatomy-paper", "--anatomy-face", "--anatomy-top", "--anatomy-shade-0", "--anatomy-shade-1", "--anatomy-shade-2", "--anatomy-shade-3", "--anatomy-hi", "--anatomy-mid", "--anatomy-lo", "--anatomy-faint", "--anatomy-lit", "--anatomy-lit-top", "--anatomy-lit-shade", "--anatomy-text", "--anatomy-strong", "--anatomy-muted"];
	for (const theme of ["light", "dark"]) {
		const tokens = ANATOMY_GL_TOKENS[theme];
		for (const key of keys) assert.ok(tokens[key], `${theme} ${key}`);
		for (const [key, value] of Object.entries(tokens)) assert.doesNotMatch(value, /#[0-9a-f]{3,8}\b|rgba?\(/i, `${theme} ${key} is a token, not a raw colour`);
	}
	assert.equal(ANATOMY_GL_TOKENS.light["--anatomy-lit"], "var(--ill-accent)", "the lit part is the iso kit's accent");
	assert.match(anatomyGlStyleTag(), /--ill-accent:/, "the style tag declares the accent pair");
});

test("the plate is an anatomy-gl root with an accessible host, opted out of the lightbox", () => {
	const plate = anatomyGlPlate({ slug: "afterburner" });
	assert.match(plate, /data-vpk-engine="anatomy-gl"/);
	assert.match(plate, /data-vpk-anatomy-gl="afterburner"[^>]*aria-label="[^"]+"/);
	assert.match(plate, /data-vpkh-no-lightbox/);
	assert.throws(() => anatomyGlPlate({ slug: "nope" }), /unknown anatomy-gl figure/);
});

test("the runtime block bundles only the figures asked for, offline, with the notice first", async () => {
	const one = await anatomyGlRuntimeBlock(["afterburner"]);
	assert.match(one, /^<!-- vpk-anatomy-gl:start -->\n<script data-vpk-anatomy-gl-runtime>\n\/\* vpk anatomy-gl runtime/);
	assert.match(one, /<!-- vpk-anatomy-gl:end -->$/);
	assert.doesNotMatch(one, /\bimport\s*\{|\bimport\(|https?:\/\/(?!www\.w3\.org)/, "no module imports or remote fetches survive bundling");
	assert.doesNotMatch(one.slice(one.indexOf("<script"), one.lastIndexOf("</script>")), /<\/script/i);
	assert.ok(one.includes("AFTERBURNER") || one.includes("afterburner"));
	assert.ok(!one.includes("TOKAMAK"), "tree-shaken: a one-figure page carries no other figure");
	await assert.rejects(() => anatomyGlRuntimeBlock(["nope"]), /unknown anatomy-gl figure/);
});
