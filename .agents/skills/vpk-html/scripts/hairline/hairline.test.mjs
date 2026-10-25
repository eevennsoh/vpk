// hairline engine: vendor pin, figure catalogue, bundle shape, theme mapping and the figure-engine record.
//   OPENSSL_CONF=/dev/null node --test .agents/skills/vpk-html/scripts/hairline/hairline.test.mjs
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { test } from "node:test";

const VENDOR = new URL("./vendor/", import.meta.url);
const { HAIRLINE_FIGURES, HAIRLINE_SHELVES } = await import("./figures.mjs");
const inline = await import("./inline.mjs");

test("HL1 every vendored file matches its VENDOR.json sha256, and nothing is unlisted", () => {
	const pin = JSON.parse(fs.readFileSync(new URL("VENDOR.json", VENDOR), "utf8"));
	assert.equal(pin.version, "0.5.1");
	for (const [file, hash] of Object.entries(pin.files)) {
		assert.equal(crypto.createHash("sha256").update(fs.readFileSync(new URL(file, VENDOR))).digest("hex"), hash, file);
	}
	const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => (entry.isDirectory() ? walk(new URL(`${entry.name}/`, dir)) : [new URL(entry.name, dir)]));
	const listed = new Set(Object.keys(pin.files).map(file => new URL(file, VENDOR).href));
	for (const url of walk(VENDOR)) if (!url.href.endsWith("/VENDOR.json")) assert.ok(listed.has(url.href), `${url.pathname} is not pinned`);
});

test("HL2 the catalogue covers the 33 package figures and the 3 marks, each on a known shelf", () => {
	const specs = inline.hairlineSpecs();
	assert.equal(HAIRLINE_FIGURES.length, 36);
	assert.deepEqual(HAIRLINE_FIGURES.map(figure => figure.id).sort(), Object.keys(specs).sort());
	const shelves = new Set(HAIRLINE_SHELVES.map(([key]) => key));
	for (const figure of HAIRLINE_FIGURES) {
		assert.ok(shelves.has(figure.shelf), figure.id);
		assert.equal(specs[figure.id].mark, figure.mark, figure.id);
		assert.ok(figure.title && figure.summary && figure.caption, figure.id);
	}
});

test("HL3 a page's bundle carries only its figures, on the shared loop, deterministically", async () => {
	const one = await inline.hairlineRuntimeBlock(["terrain"]);
	const shelf = await inline.hairlineRuntimeBlock(["terrain", "phosphor", "riffle"]);
	assert.ok(one.length < shelf.length);
	assert.equal(await inline.hairlineRuntimeBlock(["terrain", "phosphor", "riffle"]), shelf);
	for (const block of [one, shelf, await inline.hairlineRuntimeBlock(["vercel", "mastra", "notion"])]) {
		assert.ok(block.startsWith(inline.HAIRLINE_START) && block.endsWith(inline.HAIRLINE_END));
		assert.match(block, /Lucas Marques/);
		assert.match(block, /gen&&run\(\)/, "the inlined vpk frame loop");
		assert.equal((block.match(/requestAnimationFrame/g) ?? []).length, 1, "only the vpk loop asks for frames");
		assert.equal((block.match(/IntersectionObserver/g) ?? []).length, 1, "only the vpk loop observes the stages");
		assert.ok(!/<\/script/i.test(block.slice(block.indexOf(">") + 1, block.lastIndexOf("</script>"))));
	}
});

test("HL4 the stylesheet has no raw colour and maps all five hairline colours in both themes", () => {
	const text = inline.hairlineCss();
	assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(text));
	for (const key of ["plate", "hi", "edge", "mid", "lo"]) {
		assert.match(text, new RegExp(`--hl-${key}:var\\(--hairline-${key}\\)`));
		for (const theme of ["light", "dark"]) assert.match(inline.HAIRLINE_PALETTE[theme][key], /var\(--[a-z0-9-]+\)/);
	}
	assert.match(text, /\[data-theme="dark"\] :where\(\[data-vpk-engine="hairline"\]\)/);
});

test("HL5 a plate passes the figure-engine record and hairline structure checks", async () => {
	const { collectFigureEngineIssues } = await import("../figures/check-figures.mjs");
	const { deriveFigureEngine } = await import("../figures/page.mjs");
	const plate = inline.hairlinePlate({ id: "riffle", caption: "x" });
	assert.match(plate, /role="group" tabindex="0" aria-label="A tray of eight cards/);
	const page = meta => `<html><head>${meta}${inline.hairlineStyleTag()}</head><body>${plate}<script data-vpk-hairline-runtime></script></body></html>`;
	assert.equal(deriveFigureEngine(plate), "hairline");
	assert.deepEqual(collectFigureEngineIssues(page('<meta name="vpk-figure-engine" content="hairline">')).failures, []);
	assert.match(collectFigureEngineIssues(page('<meta name="vpk-figure-engine" content="both">')).failures.join(), /does not cover the hairline root/);
	assert.match(collectFigureEngineIssues(`<html><head><meta name="vpk-figure-engine" content="hairline"></head><body>${plate}</body></html>`).failures.join(), /hairline L1/);
});
