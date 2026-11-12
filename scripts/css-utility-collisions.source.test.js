const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT_DIR = path.resolve(__dirname, "..");
const GLOBALS_CSS = path.join(ROOT_DIR, "app", "globals.css");
const VENDOR_IMPORT = "shadcn/tailwind.css";
const VENDOR_CSS = path.join(ROOT_DIR, "node_modules", "shadcn", "dist", "tailwind.css");

// Local stylesheets are discovered by walking the relative `@import` graph from
// globals.css rather than being listed here. A hardcoded list silently stops
// covering the build the moment someone adds a stylesheet — and `@utility`
// rules live in five of these files today, including one reached only through a
// nested import inside tailwind-theme.css.
function collectLocalCssFiles(entryPath, seen = new Set()) {
	const resolved = path.resolve(entryPath);

	if (seen.has(resolved) || !fs.existsSync(resolved)) {
		return seen;
	}

	seen.add(resolved);
	const source = fs.readFileSync(resolved, "utf8");

	for (const match of source.matchAll(/^@import\s+["'](\.[^"']+)["']/gm)) {
		collectLocalCssFiles(path.resolve(path.dirname(resolved), match[1]), seen);
	}

	return seen;
}

/**
 * Tailwind v4 does not replace a duplicated `@utility` name — it emits BOTH
 * rules into `@layer utilities`, so the two definitions merge by source order
 * and each property is won by whichever rule happens to land later. A local
 * redefinition of a vendored utility therefore half-applies: some declarations
 * win, the rest silently leak through from the vendor rule, and the utility's
 * documented modifiers (`shimmer-duration-*`, `scroll-fade-none`, ...) go inert
 * because they set custom properties the surviving declarations never read.
 *
 * Nothing else in the repo catches this. Lint and typecheck never parse CSS,
 * and the collision produces no build warning — it only shows up as a utility
 * that "half works" in the browser. Hence this guard.
 */
function readUtilityNames(cssPath) {
	const source = fs.readFileSync(cssPath, "utf8");
	const names = new Set();

	for (const match of source.matchAll(/^[ \t]*@utility\s+([a-zA-Z0-9_-]+\*?)\s*\{/gm)) {
		names.add(match[1]);
	}

	return names;
}

test("local @utility names do not collide with the vendored shadcn utility stylesheet", () => {
	const globals = fs.readFileSync(GLOBALS_CSS, "utf8");

	if (!globals.includes(VENDOR_IMPORT)) {
		// The vendored sheet is no longer part of the cascade, so there is
		// nothing to collide with. Nothing to assert.
		return;
	}

	assert.ok(
		fs.existsSync(VENDOR_CSS),
		`${GLOBALS_CSS} imports "${VENDOR_IMPORT}" but ${VENDOR_CSS} is missing. Run pnpm install.`
	);

	const vendorNames = readUtilityNames(VENDOR_CSS);
	assert.ok(vendorNames.size > 0, `Parsed no @utility names from ${VENDOR_CSS}; the parser or the vendored format changed.`);

	const collisions = [];
	const localCssFiles = collectLocalCssFiles(GLOBALS_CSS);

	assert.ok(
		localCssFiles.size > 1,
		`Walked the @import graph from ${GLOBALS_CSS} and found no local imports; the import syntax or the parser changed.`
	);

	for (const absolutePath of localCssFiles) {
		for (const name of readUtilityNames(absolutePath)) {
			if (vendorNames.has(name)) {
				collisions.push(`${path.relative(ROOT_DIR, absolutePath)}: @utility ${name}`);
			}
		}
	}

	collisions.sort();

	assert.deepEqual(
		collisions,
		[],
		`These local @utility names are also defined by ${VENDOR_IMPORT}. Tailwind v4 emits both rules instead of replacing, so each utility half-applies and its modifiers go inert. Either delete the local definition and use the vendored one, or rename the local utility:\n  ${collisions.join("\n  ")}`
	);
});
