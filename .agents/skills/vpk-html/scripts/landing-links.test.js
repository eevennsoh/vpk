#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

let modules;

async function loadModules() {
	if (!modules) {
		const [checkHtml, shared] = await Promise.all([
			import("./check-html.mjs"),
			import("./shared.mjs"),
		]);
		modules = {
			validateHtmlFile: checkHtml.validateHtmlFile,
			ROOT: shared.ROOT,
		};
	}
	return modules;
}

function readLandingRows(indexPath) {
	const html = fs.readFileSync(indexPath, "utf8");
	const rows = [];
	const rowPattern = /<a\s+class="demo-row"\s+href="([^"]+)"/g;
	let match;
	while ((match = rowPattern.exec(html)) !== null) {
		rows.push(match[1]);
	}
	return rows;
}

function readCssBlock(html, selector) {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`).exec(html);
	assert.ok(match, `missing CSS block: ${selector}`);
	return match[1];
}

function readCssBlocks(html, selector) {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return [...html.matchAll(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "g"))]
		.map(match => match[1]);
}

test("landing rows link only to demo files", async () => {
	const { ROOT } = await loadModules();
	const rows = readLandingRows(path.join(ROOT, "index.html"));
	assert.ok(rows.length > 0, "expected at least one landing demo row");

	for (const href of rows) {
		assert.ok(
			href.startsWith("assets/demos/"),
			`landing row must point to assets/demos/: ${href}`,
		);
		assert.ok(
			!href.startsWith("assets/templates/") && !href.startsWith("assets/diagrams/"),
			`landing row must not point at raw sources: ${href}`,
		);
	}
});

test("landing removes decorative section separators", async () => {
	const { ROOT } = await loadModules();
	const landing = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

	for (const selector of [".hero", ".hero-intro", ".demo-contents", ".demo-category", ".demo-category:last-child"]) {
		assert.doesNotMatch(readCssBlock(landing, selector), /border-(?:top|bottom)\s*:/);
	}

	const titleBlocks = readCssBlocks(landing, ".module-index__title");
	assert.ok(titleBlocks.length > 0, "missing module index title CSS");
	const pageTitleBlock = titleBlocks.at(-1);
	assert.match(pageTitleBlock, /border-top:\s*0;/);
	assert.match(pageTitleBlock, /padding-top:\s*0;/);
});

test("landing omits logo and search chrome", async () => {
	const { ROOT } = await loadModules();
	const landing = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

	assert.doesNotMatch(landing, /sidebar__logo/);
	assert.doesNotMatch(landing, /sidebar__search/);
	assert.doesNotMatch(landing, /search-input/);
	assert.doesNotMatch(landing, /search__icon/);
	assert.doesNotMatch(landing, /aria-label="Search catalog"/);
});

test("landing has no footer", async () => {
	const { ROOT } = await loadModules();
	const landing = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

	assert.doesNotMatch(landing, /<footer\b/i);
	assert.doesNotMatch(landing, /\bfooter\s*\{/);
	assert.doesNotMatch(landing, /local-only demo catalog/);
});

test("landing backdrop uses plain paper background", async () => {
	const { ROOT } = await loadModules();
	const landing = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
	const bodyStyles = readCssBlock(landing, "body");

	assert.match(bodyStyles, /background:\s*var\(--paper-background\);/);
	assert.doesNotMatch(bodyStyles, /grid-background/);
	assert.doesNotMatch(bodyStyles, /background-size\s*:/);
});

test("landing demo targets exist and validate", async () => {
	const { ROOT, validateHtmlFile } = await loadModules();
	for (const href of readLandingRows(path.join(ROOT, "index.html"))) {
		const target = path.join(ROOT, href);
		assert.ok(fs.existsSync(target), `missing landing target: ${href}`);

		const html = fs.readFileSync(target, "utf8");
		if (/{{[^}]+}}/.test(html)) {
			assert.match(
				html,
				/data-vpk-literal-double-braces="true"/,
				`literal double braces require explicit opt-in: ${href}`,
			);
		}

		const result = validateHtmlFile(target);
		assert.equal(
			result.ok,
			true,
			`${href} failed check-html:\n${result.failures.join("\n")}`,
		);
	}
});

test("every demo appears in exactly one catalog row", async () => {
	const { ROOT } = await loadModules();
	const rows = readLandingRows(path.join(ROOT, "index.html"));
	const duplicates = rows.filter((href, index) => rows.indexOf(href) !== index);
	assert.deepEqual(duplicates, [], "a demo is listed more than once");
	const demos = fs.readdirSync(path.join(ROOT, "assets", "demos"))
		.filter(name => name.endsWith(".html"))
		.map(name => `assets/demos/${name}`)
		.sort();
	assert.deepEqual([...rows].sort(), demos, "the catalog lists every demo");
});
