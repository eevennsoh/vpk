/**
 * Contract for the link-flash sweep's timing.
 *
 * The sweep runs from a CSS utility, but the board has to know how long it
 * lasts so it can retire the flash on its own clock instead of clearing it when
 * the next drag starts — the clear is what made the acknowledgement look
 * intermittent. That makes the exported duration and the CSS two halves of one
 * contract, pinned here so neither can drift.
 */

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const LINK_FLASH_SOURCE = readFileSync(join(__dirname, "agent-link-flash.tsx"), "utf8");
const GLOBALS_CSS = readFileSync(join(__dirname, "../../../app/globals.css"), "utf8");
const THEME_CSS = readFileSync(join(__dirname, "../../../app/tailwind-theme.css"), "utf8");

test("the exported sweep duration matches the CSS that actually runs it", () => {
	const exported = LINK_FLASH_SOURCE.match(
		/export const JIRA_ISSUE_LINK_FLASH_DURATION_MS = (\d+);/u,
	);
	assert.ok(exported, "agent-link-flash.tsx must export JIRA_ISSUE_LINK_FLASH_DURATION_MS");

	const utility = GLOBALS_CSS.match(
		/@utility jira-issue-link-flash \{\s*animation: jira-issue-link-flash calc\(var\(--duration-slowest\) \* ([\d.]+)\)/u,
	);
	assert.ok(utility, "the jira-issue-link-flash utility must scale --duration-slowest");

	const token = THEME_CSS.match(/--duration-slowest:\s*(\d+)ms;/u);
	assert.ok(token, "tailwind-theme.css must define --duration-slowest in ms");

	assert.equal(
		Number(exported[1]),
		Number(token[1]) * Number(utility[1]),
		"JIRA_ISSUE_LINK_FLASH_DURATION_MS must equal --duration-slowest times the utility's multiplier",
	);
});

test("reduced motion drops the sweep rather than shortening it", () => {
	// The sweep carries nothing the row does not already say, so the honest
	// reduced-motion treatment is no sweep at all. Both halves have to agree:
	// the component returns nothing, and the utility cannot animate if some
	// other path mounts it.
	assert.match(LINK_FLASH_SOURCE, /const shouldReduceMotion = useReducedMotion\(\);\s*if \(shouldReduceMotion\) \{\s*return null;/u);
	assert.match(
		GLOBALS_CSS,
		/@media \(prefers-reduced-motion: reduce\) \{\s*\.jira-issue-link-flash \{\s*animation: none;/u,
	);
});
