import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { isSmokeSpec, selectSmokeSpecs, trackedSpecs } from "./run-playwright-smoke.mjs";

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

test("specs directly under tests/ are listed alongside nested ones", (t) => {
	const root = mkdtempSync(path.join(tmpdir(), "vpk-smoke-specs-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
	git("init", "--quiet");
	mkdirSync(path.join(root, "tests/projects/deep"), { recursive: true });
	for (const file of ["tests/top.spec.ts", "tests/projects/nested.spec.ts", "tests/projects/deep/deeper.spec.ts", "tests/helpers.ts"]) {
		writeFileSync(path.join(root, file), "");
	}
	git("add", "tests/top.spec.ts", "tests/projects/nested.spec.ts");
	writeFileSync(path.join(root, "tests/untracked.spec.ts"), "");
	assert.deepEqual(trackedSpecs(root).sort(), [
		"tests/projects/deep/deeper.spec.ts",
		"tests/projects/nested.spec.ts",
		"tests/top.spec.ts",
		"tests/untracked.spec.ts",
	]);
});

test("the smoke suite covers Butter, blocks, UI and a Rovo surface", () => {
	const smoke = selectSmokeSpecs(trackedSpecs(REPO_ROOT), (file) => readFileSync(path.join(REPO_ROOT, file), "utf8"));
	assert.ok(smoke.some((file) => file.startsWith("tests/projects/butter")), "a Butter spec");
	assert.ok(smoke.some((file) => file.startsWith("tests/blocks/")), "a blocks spec");
	assert.ok(smoke.some((file) => file.startsWith("tests/ui/")), "a UI spec");
	assert.ok(smoke.some((file) => file.startsWith("tests/rovo/")), "a Rovo spec");
	assert.ok(smoke.length >= 8 && smoke.length <= 15, `${smoke.length} smoke spec files`);
});
