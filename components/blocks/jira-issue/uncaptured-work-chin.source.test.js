import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(__dirname, "uncaptured-work-chin.tsx"), "utf8");
const LIB_SOURCE = readFileSync(join(__dirname, "lib.ts"), "utf8");

// Fast Refresh can only preserve a component's state when its file exports
// nothing but components, so the chin's pure helpers live in lib.ts.
test("the chin file exports only a component", () => {
	assert.doesNotMatch(SOURCE, /export (?!function UncapturedWorkChin)/u);
	assert.match(LIB_SOURCE, /export function uncapturedWorkLinkLabel\(/u);
	assert.match(LIB_SOURCE, /export function uncapturedWorkLinkActionLabel\(/u);
	assert.match(LIB_SOURCE, /export function uncapturedWorkSuggestionKeys\(/u);
});
