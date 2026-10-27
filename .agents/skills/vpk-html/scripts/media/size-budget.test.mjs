// Page weight and the data-URL viewer budget (ws0 T-B*; ws4a extends this suite).

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
	DATA_URL_SAFE_HTML_BYTES,
	URL_CAP_CHARS,
	dataUrlLength,
	formatMB,
	liteFilmTargetBytes,
	measureHtmlWeight,
	weightRemedy,
	weightWarnings,
} from "./size-budget.mjs";

const SCRIPTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILL_ROOT = path.resolve(SCRIPTS, "..");
const MINIMAL_VALID_PAGE = `<!doctype html><html><head><style>@font-face { font-family: "Geist"; src: url(data:font/woff2;base64,AA==); } :root { color-scheme: light dark; } [data-theme="dark"] { color-scheme: light dark; }</style></head><body><main><p>x</p></main></body></html>`;

function pageOfBytes(bytes) {
	const filler = bytes - Buffer.byteLength(MINIMAL_VALID_PAGE) - "<!--  -->".length;
	return MINIMAL_VALID_PAGE.replace("</main>", `</main><!-- ${"x".repeat(filler)} -->`);
}

test("T-B1 the budget is the measured base64 data-URL limit", () => {
	assert.equal(DATA_URL_SAFE_HTML_BYTES, 1572846);
	assert.equal(dataUrlLength(1572846), 2097150);
	assert.ok(dataUrlLength(1572846) <= URL_CAP_CHARS);
	assert.equal(dataUrlLength(1572847), 2097154);
	assert.ok(dataUrlLength(1572847) > URL_CAP_CHARS);
	assert.equal(formatMB(1572846), "1.57 MB");
});

test("T-B2 weightWarnings fires one byte over budget; measureHtmlWeight tallies media and runtime blocks", () => {
	assert.equal(Buffer.byteLength(pageOfBytes(1572846)), 1572846);
	assert.deepEqual(weightWarnings(pageOfBytes(1572846)), []);
	const warnings = weightWarnings(pageOfBytes(1572847), { label: "big.html" });
	assert.equal(warnings.length, 1);
	assert.match(warnings[0], /^big\.html: 1\.57 MB exceeds the 1\.57 MB data-URL viewer budget/);
	assert.match(warnings[0], /base64 data: URL render it blank, and percent-encoded viewers fail earlier/);
	assert.deepEqual(weightWarnings(pageOfBytes(2000), { budgetBytes: 1000 }).length, 1, "callers may pass a tighter budget");

	const html = [
		`<video src="data:video/mp4;base64,${"A".repeat(4000)}"></video>`,
		`<img alt="" src="data:image/webp;base64,${"B".repeat(2000)}">`,
		`<style>@font-face { src: url(data:font/woff2;base64,${"C".repeat(1000)}); }</style>`,
		"<!-- vpkh-enhance:begin -->\n<script>1</script>\n<!-- vpkh-enhance:end -->",
		"<!-- vpk-smil-starter:start -->\n<script data-vpk-smil-starter>2</script>\n<!-- vpk-smil-starter:end -->",
	].join("\n");
	const weight = measureHtmlWeight(html);
	assert.equal(weight.bytes, Buffer.byteLength(html));
	assert.deepEqual(Object.keys(weight.dataUrls).sort(), ["font/woff2", "image/webp", "video/mp4"]);
	assert.equal(weight.dataUrls["video/mp4"], "data:video/mp4;base64,".length + 4000);
	assert.deepEqual(weight.largest.map(item => item.mime), ["video/mp4", "image/webp", "font/woff2"]);
	assert.equal(weight.largest[0].line, 1);
	assert.deepEqual(weight.runtimeBlocks.map(block => block.id), ["vpkh-enhance", "vpk-smil-starter"]);
	assert.ok(weight.nonMediaBytes < weight.bytes);
	const overBudget = weightWarnings(html, { label: "media.html", budgetBytes: 100 });
	assert.match(overBudget[0], /\(video\/mp4 0\.00 MB, image\/webp 0\.00 MB, fonts 0\.00 MB\)/);
});

test("T-B3 checks-thresholds.json mirrors the single size value", () => {
	const thresholds = JSON.parse(fs.readFileSync(path.join(SKILL_ROOT, "references", "checks-thresholds.json"), "utf8"));
	assert.equal(thresholds.sizeBudget.warnBytes, DATA_URL_SAFE_HTML_BYTES);
});

// The user's standing rule: no warning on page size. A large page only loads more slowly.
test("T-B4 check-html stays ok on an over-budget file and prints no size warning", () => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-html-size-"));
	const file = path.join(tmp, "big.html");
	try {
		fs.writeFileSync(file, pageOfBytes(DATA_URL_SAFE_HTML_BYTES + 10));
		const result = spawnSync(process.execPath, [path.join(SCRIPTS, "check-html.mjs"), file], { encoding: "utf8" });
		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, /^ok .*big\.html$/m);
		assert.doesNotMatch(result.stderr, /data-URL viewer budget/);
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
});

// ---- ws4a P4: lite film target and composition-specific remedy ----

const weightOf = (bytes, dataUrls) => ({ bytes, dataUrls, nonMediaBytes: 0, largest: [], runtimeBlocks: [] });

test("T-B5 liteFilmTargetBytes: the EU26 worked example and the defaults", () => {
	assert.equal(liteFilmTargetBytes({ htmlBytes: 4428225, filmDataUrlChars: 3596258, marginBytes: 16384 }), 543371);
	assert.equal(liteFilmTargetBytes({ htmlBytes: 4428225, filmDataUrlChars: 3596258 }), 543371, "16 KB margin and the 1,572,846 B budget by default");
	assert.equal(liteFilmTargetBytes({ htmlBytes: 600000, filmDataUrlChars: 200000, budgetBytes: 500000, marginBytes: 0 }), 75000);
	assert.ok(liteFilmTargetBytes({ htmlBytes: 3000000, filmDataUrlChars: 100 }) < 0, "a non-film excess cannot be fixed by the film");
});

test("T-B6 weightRemedy picks film, fonts, images or the generic split by the 40% rule", () => {
	assert.equal(weightRemedy(weightOf(4428225, { "video/mp4": 3596258, "image/webp": 250000 }), { slug: "report" }), "Ship report.lite.html (scripts/media/embed.mjs writes it automatically).");
	assert.match(weightRemedy(weightOf(3000000, { "font/otf": 900000, "font/ttf": 600000 })), /^Fonts are 1\.50 MB: run build\.mjs --inject-runtime <file>/);
	assert.match(weightRemedy(weightOf(2000000, { "image/png": 900000 })), /^Images are 0\.90 MB: re-encode them \(encode\.mjs stills, WebP q60–72\)/);
	assert.equal(weightRemedy(weightOf(2000000, { "video/mp4": 700000, "image/png": 700000 })), "Split the document or move media out of the HTML.");
	assert.equal(weightRemedy(weightOf(2000000, {})), "Split the document or move media out of the HTML.");
	assert.match(weightRemedy(weightOf(1, { "video/mp4": 1 })), /<slug>\.lite\.html/, "default slug");
	const generic = "Split the document or move media out of the HTML.";
	for (const [mime, remedy] of [["video/mp4", /^Ship <slug>\.lite\.html/], ["font/woff2", /^Fonts are 0\.40 MB/], ["image/webp", /^Images are 0\.40 MB/]]) {
		assert.match(weightRemedy(weightOf(1000000, { [mime]: 400000 })), remedy, `${mime} at exactly 40% picks its remedy`);
		assert.equal(weightRemedy(weightOf(1000000, { [mime]: 399999 })), generic, `${mime} just under 40% falls through`);
	}
});

test("T-B7 weightWarnings appends the remedy, naming the lite copy after the file", () => {
	const film = `<video src="data:video/mp4;base64,${"A".repeat(3000)}"></video>`;
	const [warning] = weightWarnings(film, { label: "artifacts/vpk-html/report/report.html", budgetBytes: 1000 });
	assert.match(warning, /^artifacts\/vpk-html\/report\/report\.html: 0\.00 MB exceeds the 0\.00 MB data-URL viewer budget \(video\/mp4 0\.00 MB\)\./);
	assert.match(warning, /percent-encoded viewers fail earlier\. Ship report\.lite\.html \(scripts\/media\/embed\.mjs writes it automatically\)\.$/);
	assert.deepEqual(weightWarnings(film, { budgetBytes: 10000 }), []);
});
