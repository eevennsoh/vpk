import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { isSmokeSpec, selectSmokeSpecs } from "./run-playwright-smoke.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("only specs that tag a test @smoke are selected", () => {
	const sources = {
		"tests/a.spec.ts": 'test("x", { tag: "@smoke" }, async () => {});',
		"tests/b.spec.ts": 'test.describe("y", { tag: ["@slow", "@smoke"] }, () => {});',
		"tests/c.spec.ts": 'test("mentions @smoke in a title only", async () => {});',
		"tests/d.spec.ts": 'test("z", { tag: "@smoker" }, async () => {});',
		"tests/helpers/e.ts": 'test("x", { tag: "@smoke" }, async () => {});',
	};
	assert.deepEqual(selectSmokeSpecs(Object.keys(sources), (file) => sources[file]), ["tests/a.spec.ts", "tests/b.spec.ts"]);
	assert.equal(isSmokeSpec('{ tag: "@smoke" }'), true);
});

test("the smoke suite covers Butter, blocks, UI and a Rovo surface", async () => {
	const { execFileSync } = await import("node:child_process");
	const files = execFileSync("git", ["ls-files", "tests/**/*.spec.ts"], { cwd: REPO_ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
	const smoke = selectSmokeSpecs(files, (file) => readFileSync(path.join(REPO_ROOT, file), "utf8"));
	assert.ok(smoke.some((file) => file.startsWith("tests/projects/butter")), "a Butter spec");
	assert.ok(smoke.some((file) => file.startsWith("tests/blocks/")), "a blocks spec");
	assert.ok(smoke.some((file) => file.startsWith("tests/ui/")), "a UI spec");
	assert.ok(smoke.some((file) => file.startsWith("tests/rovo/")), "a Rovo spec");
	assert.ok(smoke.length >= 8 && smoke.length <= 15, `${smoke.length} smoke spec files`);
});
