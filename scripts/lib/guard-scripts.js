"use strict";

// The repository guard stage: `pnpm run verify:fast` (= `node scripts/check.mjs --guards`)
// runs each of these package.json scripts concurrently, and `pnpm run check` runs them
// alongside lint, typecheck and related suites. Order is the old `&&` chain's order.
const GUARD_SCRIPTS = Object.freeze([
	"verify:root-artifacts",
	"verify:url-credentials",
	"verify:route-manifest",
	"verify:api-surfaces",
	"verify:repo-map",
	"verify:vpk-feature-map",
	"verify:file-size",
	"verify:catalog",
	"verify:lazy-load",
	"verify:source-guardrails",
	"verify:eslint-suppressions",
	"verify:cursor-rules",
	"verify:doc-scripts",
	"validate:agents",
	"validate:skills",
]);

// A script line that hands control to check.mjs runs the guard stage.
const CHECK_COMMAND = /(?:^|&&\s*)node scripts\/check\.mjs(?:\s|$)/u;

module.exports = { CHECK_COMMAND, GUARD_SCRIPTS };
