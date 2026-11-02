const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

const GLOBALS_CSS_FILE = path.join(__dirname, "globals.css");
const GLOBALS_CSS_SOURCE = fs.readFileSync(GLOBALS_CSS_FILE, "utf8");
const REPO_ROOT = path.join(__dirname, "..");

function readRepoFile(...segments) {
	return fs.readFileSync(path.join(REPO_ROOT, ...segments), "utf8");
}

function collectFiles(dir, extensions) {
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			files.push(...collectFiles(fullPath, extensions));
			continue;
		}

		if (extensions.has(path.extname(entry.name))) {
			files.push(fullPath);
		}
	}

	return files;
}

function getRuleBlock(selector) {
	const pattern = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`);
	const match = GLOBALS_CSS_SOURCE.match(pattern);

	assert.ok(match, `expected ${selector} rule`);
	return match[1];
}

test("website content clears the fixed sidebar rail before desktop overrides", () => {
	const baseRuleStart = GLOBALS_CSS_SOURCE.indexOf("@utility website-main-content {");
	const desktopRuleStart = GLOBALS_CSS_SOURCE.indexOf("@media (min-width: 768px)", baseRuleStart);

	assert.ok(baseRuleStart >= 0, "expected base website-main-content rule");
	assert.ok(desktopRuleStart >= 0, "expected desktop sidebar media query");
	assert.ok(
		baseRuleStart < desktopRuleStart,
		"expected rail offset to apply before desktop sidebar overrides",
	);
	assert.match(
		getRuleBlock("@utility website-main-content"),
		/margin-left:\s*48px;\s*\/\* rail only \*\//,
	);
});

test("desktop sidebar keeps the expanded panel offset", () => {
	assert.match(
		GLOBALS_CSS_SOURCE,
		/body:has\(aside\[data-sidebar-open="true"\]\) &\s*\{\s*margin-left:\s*304px;\s*\/\* 48px rail \+ 256px panel \*\//,
	);
});

test("global pointer cursor covers discrete interactive controls", () => {
	assert.match(
		GLOBALS_CSS_SOURCE,
		/button:not\(:disabled\),\s*\[role="button"\]:not\(:disabled\),\s*\[role="checkbox"\]:not\(\[aria-disabled="true"\]\),\s*\[role="combobox"\]:not\(\[aria-disabled="true"\]\),\s*\[role="radio"\]:not\(\[aria-disabled="true"\]\),\s*\[role="switch"\]:not\(\[aria-disabled="true"\]\),\s*input:is\(\[type="button"\], \[type="submit"\], \[type="reset"\], \[type="checkbox"\], \[type="radio"\]\):not\(:disabled\)\s*\{\s*cursor:\s*pointer;/u,
	);
});

test("auto-hide scrollbars are zero-width in WebKit until actively scrolling", () => {
	assert.match(
		GLOBALS_CSS_SOURCE,
		/&::-webkit-scrollbar\s*\{\s*width:\s*0;\s*height:\s*0;\s*\}/u,
	);
	assert.match(
		GLOBALS_CSS_SOURCE,
		/&\[data-scrolling\]::-webkit-scrollbar\s*\{\s*width:\s*10px;\s*height:\s*10px;\s*\}/u,
	);
	assert.match(
		GLOBALS_CSS_SOURCE,
		/&\[data-scrolling\]::-webkit-scrollbar-thumb\s*\{[\s\S]*background-color:\s*color-mix\(in oklab, currentColor 20%, transparent\);/u,
	);
});

test("shared UI surfaces do not reintroduce the old translucent overlay contract", () => {
	const targetSources = [
		readRepoFile("components.json"),
		GLOBALS_CSS_SOURCE,
		readRepoFile(".agents", "rules", "token-priority.md"),
		readDetailCategorySource("ui"),
		readWebsiteRegistrySource(),
		readRepoFile("components", "website", "demos", "ui", "dropdown-menu-demo.tsx"),
		...collectFiles(path.join(REPO_ROOT, "components", "ui"), new Set([".ts", ".tsx"])).map((file) => fs.readFileSync(file, "utf8")),
		...collectFiles(path.join(REPO_ROOT, "components", "ui-custom"), new Set([".ts", ".tsx"])).map((file) => fs.readFileSync(file, "utf8")),
		...collectFiles(path.join(REPO_ROOT, "components", "blocks"), new Set([".ts", ".tsx"])).map((file) => fs.readFileSync(file, "utf8")),
	].join("\n");

	assert.doesNotMatch(targetSources, /cn-menu-translucent/);
	assert.doesNotMatch(targetSources, /translucentMenuSurfaceClass/);
	assert.doesNotMatch(targetSources, /default-translucent/);
	assert.doesNotMatch(targetSources, /dropdown-menu-demo-translucent-image/);
	assert.doesNotMatch(targetSources, /supports-backdrop-filter:backdrop-blur/);
	assert.doesNotMatch(targetSources, /backdrop-(blur|filter)/);
});
