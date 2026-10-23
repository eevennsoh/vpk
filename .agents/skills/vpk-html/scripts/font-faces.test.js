#!/usr/bin/env node

// @font-face repair and checks (ws0 T-F*).

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

const load = name => import(pathToFileURL(path.join(__dirname, name)).href);

const badFace = family => `@font-face {\n\tfont-family: var(--font-mono)"${family}";\n\tsrc: url("data:font/otf;base64,AA==");\n\tfont-display: swap;\n}`;
const goodFace = family => `@font-face {\n\tfont-family: "${family}";\n\tsrc: url("data:font/woff2;base64,AA==") format("woff2");\n}`;

// The calendar-heatmap shape: shared block marker, invalid faces after it, masked body rule.
const CALENDAR = `<!doctype html><html><head><style>
  *, *::before, *::after { box-sizing: border-box; }

/* vpk-shared:start */
html, body { font-family: "Geist Mono Numeric", var(--font-body) !important; }
/* vpk-shared:end */
${badFace("Geist")}
${badFace("Geist Mono")}

  body { font-family: var(--font-mono)"Geist Mono Numeric", var(--font-sans); color: var(--ink); }
</style></head><body><main>x</main></body></html>`;

test("T-F1 repairFontFaces strips invalid faces, inserts the shared faces before the marker, collapses declarations", async () => {
	const { collectFontFaceIssues, listFontFaceRules, registeredFontFamilies, repairFontFaces, REQUIRED_FONT_FAMILIES } = await load("font-faces.mjs");
	const out = repairFontFaces(CALENDAR);
	assert.equal(listFontFaceRules(out).filter(rule => !rule.valid).length, 0);
	for (const family of REQUIRED_FONT_FAMILIES) assert.ok(registeredFontFamilies(out).has(family), family);
	const marker = out.indexOf("/* vpk-shared:start */");
	for (const rule of listFontFaceRules(out)) assert.ok(rule.index < marker, `${rule.family} sits before the shared block`);
	assert.equal(listFontFaceRules(out).length, 3, "exactly the three shared faces");
	assert.match(out, /body \{ font-family: var\(--font-mono\); color: var\(--ink\); \}/);
	assert.match(out, /html, body \{ font-family: "Geist Mono Numeric", var\(--font-body\) !important; \}/, "valid declarations are untouched");
	assert.deepEqual(collectFontFaceIssues(out), []);
	assert.equal(repairFontFaces(out), out, "idempotent");

	const valid = CALENDAR.replace(badFace("Geist"), goodFace("Geist")).replace(badFace("Geist Mono"), goodFace("Geist Mono")).replace('var(--font-mono)"Geist Mono Numeric", var(--font-sans)', "var(--font-sans)");
	assert.equal(repairFontFaces(valid), valid, "a file with valid faces is unchanged");
	const none = "<!doctype html><html><head><style>body { color: var(--ink); }</style></head><body><main>x</main></body></html>";
	assert.equal(repairFontFaces(none), none, "a file with no faces never gains fonts");
});

test("T-F2 partial coverage inserts only the families left without a valid face", async () => {
	const { listFontFaceRules, repairFontFaces } = await load("font-faces.mjs");
	const html = CALENDAR.replace(badFace("Geist"), goodFace("Geist")).replace(badFace("Geist Mono"), `${badFace("Geist Mono")}\n${badFace("Geist Mono Numeric")}`);
	const out = repairFontFaces(html);
	const families = listFontFaceRules(out).map(rule => rule.family).sort();
	assert.deepEqual(families, ['"Geist Mono Numeric"', '"Geist Mono"', '"Geist"'].sort());
	assert.equal(families.filter(family => family === '"Geist"').length, 1, "no duplicate Geist face");
});

test("T-F3 collectFontFaceIssues flags invalid descriptors and residue declarations only inside <style>", async () => {
	const { collectFontFaceIssues, isValidFontFamilyDescriptor } = await load("font-faces.mjs");
	const faceIssues = collectFontFaceIssues(`<style>${badFace("Geist")}</style>`);
	assert.equal(faceIssues.length, 1);
	assert.match(faceIssues[0], /@font-face rules with invalid font-family descriptors \(1, e\.g\. var\(--font-mono\)"Geist"\)/);
	assert.match(faceIssues[0], /--inject-runtime <file> \(artifacts\) or --refresh-library \(skill assets\)/);
	const declarationIssues = collectFontFaceIssues(`<style>.m { font-family: var(--font-mono)"SF Mono", Menlo; }</style>`);
	assert.equal(declarationIssues.length, 1);
	assert.match(declarationIssues[0], /font-family declarations with a var\(--…\)"…" residue \(1, e\.g\. font-family: var\(--font-mono\)"SF Mono", Menlo\)/);
	assert.deepEqual(collectFontFaceIssues(`<style>${goodFace("Geist Mono")}</style>`), []);
	assert.deepEqual(collectFontFaceIssues(`<p><code style="font-family:var(--mono)">x</code></p>`), [], "style attributes are not <style> blocks");
	for (const [raw, valid] of [['"Geist"', true], ["'Geist Mono'", true], ["Geist Mono", true], ['var(--font-mono)"Geist"', false], ["", false], ['"Geist", serif', false]]) {
		assert.equal(isValidFontFamilyDescriptor(raw), valid, raw);
	}
});
