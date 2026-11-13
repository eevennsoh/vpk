import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(__dirname, "uncaptured-work-chin.tsx"), "utf8");
const LIB_SOURCE = readFileSync(join(__dirname, "lib.ts"), "utf8");

test("captured work is removed from the keyboard action sequence", () => {
	const capturedBranch = SOURCE.match(/captured \? \(([\s\S]*?)\) : \(/u)?.[1];

	assert.ok(capturedBranch, "expected the captured-state branch");
	assert.match(capturedBranch, /<Button\s+disabled\s+aria-label=\{`\$\{summary\} captured`\}/u);
	assert.doesNotMatch(capturedBranch, /aria-disabled/u);
});

// Figma node 3002:7233. Rows carry no horizontal padding on purpose: the
// controls' own 12px padding sets the label inset, so nothing shifts sideways
// when the hover surface appears under them.
test("chin geometry matches the Figma spec", () => {
	// 8px footer padding, 2px between rows.
	assert.match(SOURCE, /flex flex-col gap-0\.5 border-t border-dashed border-border-disabled bg-surface p-2"/u);
	// 24px control + 4px vertical padding = the spec's 32px row.
	assert.match(SOURCE, /rounded-md py-1 transition-colors/u);
	assert.doesNotMatch(SOURCE, /pl-0/u);
});

// Fast Refresh can only preserve a component's state when its file exports
// nothing but components, so the chin's pure helpers live in lib.ts.
test("the chin file exports only a component", () => {
	assert.doesNotMatch(SOURCE, /export (?!function UncapturedWorkChin)/u);
	assert.match(LIB_SOURCE, /export function uncapturedWorkLinkLabel\(/u);
	assert.match(LIB_SOURCE, /export function uncapturedWorkLinkActionLabel\(/u);
	assert.match(LIB_SOURCE, /export function uncapturedWorkSuggestionKeys\(/u);
});
