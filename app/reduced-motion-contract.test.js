const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

// motion-decisions.md tells agents not to add per-component reduced-motion guards
// because these two owners cover them. If either moves, that guidance must change too.
const GLOBALS_CSS = fs.readFileSync(path.join(__dirname, "globals.css"), "utf8");
const PROVIDERS = fs.readFileSync(path.join(__dirname, "providers.tsx"), "utf8");

function findUniversalReducedMotionRules(css) {
	for (const block of css.split("@media (prefers-reduced-motion: reduce)").slice(1)) {
		const universal = block.match(/^\s*\{[^@]*?(\*,\s*\*::before,\s*\*::after\s*\{[^}]*\})/u);
		if (universal) {
			return universal[1];
		}
	}
	return null;
}

test("globals.css collapses every CSS transition and animation under reduced motion", () => {
	const rules = findUniversalReducedMotionRules(GLOBALS_CSS);
	assert.ok(rules, "app/globals.css lost its universal prefers-reduced-motion reset");
	assert.match(rules, /transition-duration:\s*0\.01ms\s*!important/u);
	assert.match(rules, /animation-duration:\s*0\.01ms\s*!important/u);
	assert.match(rules, /animation-iteration-count:\s*1\s*!important/u);
});

test("the root providers honor the user's reduced-motion setting for Motion for React", () => {
	assert.match(PROVIDERS, /<MotionConfig reducedMotion="user">/u);
});
