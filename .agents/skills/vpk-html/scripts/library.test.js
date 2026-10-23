#!/usr/bin/env node

// The committed skill library stays at the runtime-pipeline fixed point and passes check-html (ws0 T-L*).

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

const load = name => import(pathToFileURL(path.join(__dirname, name)).href);
let library;

async function libraryFiles() {
	if (library) return library;
	const { classifyTarget, listLibraryFiles } = await load("runtime/pipeline.mjs");
	library = listLibraryFiles().map(file => ({ file, rel: path.relative(path.resolve(__dirname, ".."), file), kind: classifyTarget(file), html: fs.readFileSync(file, "utf8") }));
	return library;
}

test("T-L1 the library is at the runtime-pipeline fixed point", async () => {
	const { formatRefreshReport, refreshLibrary } = await load("runtime/pipeline.mjs");
	const result = await refreshLibrary({ write: false });
	assert.ok(result.total >= 200, `library has ${result.total} files`);
	assert.equal(result.changed.length, 0, formatRefreshReport(result, { check: true }));
});

test("T-L2 every library file passes check-html (templates may keep {{…}} placeholders)", async () => {
	const { validateHtmlString } = await load("check-html.mjs");
	const failures = [];
	for (const { rel, kind, html } of await libraryFiles()) {
		const result = validateHtmlString(html, rel);
		const relevant = result.failures.filter(failure => !(kind === "template" && /unresolved \{\{\.\.\.\}\} placeholder/.test(failure)));
		if (relevant.length > 0) failures.push(`${rel}: ${relevant.join("; ").slice(0, 300)}`);
	}
	assert.deepEqual(failures, []);
});

test("T-L3 no library file exceeds the data-URL viewer budget", async () => {
	const { weightWarnings } = await load("media/size-budget.mjs");
	const over = (await libraryFiles()).flatMap(({ rel, html }) => weightWarnings(html, { label: rel }));
	assert.deepEqual(over, []);
});

test("T-L4 every SMIL file carries exactly one marked starter and no stray starter scripts", async () => {
	const { listSmilElements } = await load("runtime/smil-starter.mjs");
	const { markedRanges } = await load("runtime/blocks.mjs");
	const problems = [];
	let smilFiles = 0;
	for (const { rel, html } of await libraryFiles()) {
		const ranges = markedRanges(html);
		for (const match of html.matchAll(/<script\b[^>]*\bdata-vpk-smil-starter\b/gi)) {
			if (!ranges.some(([start, end]) => match.index >= start && match.index < end)) problems.push(`${rel}: data-vpk-smil-starter script outside a marked block`);
		}
		if (listSmilElements(html).length === 0) continue;
		smilFiles += 1;
		const starters = html.split("<!-- vpk-smil-starter:start -->").length - 1;
		if (starters !== 1) problems.push(`${rel}: ${starters} vpk-smil-starter blocks`);
	}
	assert.deepEqual(problems, []);
	assert.ok(smilFiles > 0, "the library has SMIL files");
});

test("T-L5 every library file registers the three Geist families with valid faces", async () => {
	const { collectFontFaceIssues, registeredFontFamilies, REQUIRED_FONT_FAMILIES } = await load("font-faces.mjs");
	const problems = [];
	for (const { rel, html } of await libraryFiles()) {
		const families = registeredFontFamilies(html);
		const missing = REQUIRED_FONT_FAMILIES.filter(family => !families.has(family));
		if (missing.length > 0) problems.push(`${rel}: missing ${missing.join(", ")}`);
		const issues = collectFontFaceIssues(html);
		if (issues.length > 0) problems.push(`${rel}: ${issues[0].slice(0, 120)}`);
	}
	assert.deepEqual(problems, []);
});
