import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { managedEntries, upsertNpmrc } from "./write-npmrc.mjs";

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "write-npmrc.mjs");

function keyCounts(text) {
	const counts = new Map();
	for (const line of text.split("\n")) {
		const eq = line.indexOf("=");
		if (eq > 0 && !line.startsWith("#")) {
			const key = line.slice(0, eq);
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
	}
	return counts;
}

test("writes every managed key once into an empty file", () => {
	const out = upsertNpmrc("", managedEntries("tok"));
	assert.equal(out.split("\n").filter(Boolean).length, 5);
	assert.ok(out.includes("//packages.atlassian.com/api/npm/atlassian-npm/:_authToken=tok"));
});

test("adds the Motion+ registry token only when one is given", () => {
	const withoutMotion = upsertNpmrc("", managedEntries("tok"));
	assert.ok(!withoutMotion.includes("api.motion.dev"));

	const withMotion = upsertNpmrc("", managedEntries("tok", "motion-tok"));
	assert.equal(withMotion.split("\n").filter(Boolean).length, 6);
	assert.ok(withMotion.includes("//api.motion.dev/npm/:_authToken=motion-tok"));
	assert.equal(upsertNpmrc(withMotion, managedEntries("tok", "motion-tok")), withMotion);
});

test("rerunning does not stack duplicate entries", () => {
	const once = upsertNpmrc("", managedEntries("tok"));
	const twice = upsertNpmrc(once, managedEntries("tok"));
	assert.equal(twice, once);
});

test("collapses pre-existing duplicates and refreshes the token in place", () => {
	const legacyAppendedTwice = [
		"registry=https://registry.npmjs.org/",
		"//packages.atlassian.com/api/npm/atlassian-npm/:_authToken=old",
		"registry=https://registry.npmjs.org/",
		"//packages.atlassian.com/api/npm/atlassian-npm/:_authToken=old",
	].join("\n");
	const out = upsertNpmrc(legacyAppendedTwice, managedEntries("new"));
	for (const [key, count] of keyCounts(out)) {
		assert.equal(count, 1, `${key} appears ${count} times`);
	}
	assert.ok(!out.includes("=old"));
});

test("preserves unrelated lines, comments, and other registries", () => {
	const existing = "# machine config\n@trello:registry=https://example.test/\nreplace-registry-host=never\n";
	const out = upsertNpmrc(existing, managedEntries("tok"));
	assert.ok(out.startsWith("# machine config\n@trello:registry=https://example.test/\nreplace-registry-host=never\n"));
});

test("CLI fails clearly without a token and leaves the file untouched", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "write-npmrc-"));
	const target = path.join(dir, ".npmrc");
	fs.writeFileSync(target, "keep=me\n");
	assert.throws(() =>
		execFileSync(process.execPath, [SCRIPT], {
			env: { ...process.env, ATLASSIAN_NPM_TOKEN: "  ", MOTION_TOKEN: "motion-tok", NPMRC_PATH: target },
			stdio: "pipe",
		}),
	);
	assert.equal(fs.readFileSync(target, "utf8"), "keep=me\n");
	fs.rmSync(dir, { recursive: true, force: true });
});

test("CLI fails clearly without a Motion+ token and leaves the file untouched", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "write-npmrc-"));
	const target = path.join(dir, ".npmrc");
	fs.writeFileSync(target, "keep=me\n");
	let stderr = "";
	try {
		execFileSync(process.execPath, [SCRIPT], {
			env: { ...process.env, ATLASSIAN_NPM_TOKEN: "tok", MOTION_TOKEN: "", NPMRC_PATH: target },
			stdio: "pipe",
		});
	} catch (error) {
		stderr = String(error.stderr);
	}
	assert.ok(stderr.includes("MOTION_TOKEN is empty"), stderr);
	assert.equal(fs.readFileSync(target, "utf8"), "keep=me\n");
	fs.rmSync(dir, { recursive: true, force: true });
});

test("CLI is idempotent on disk", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "write-npmrc-"));
	const target = path.join(dir, ".npmrc");
	const env = { ...process.env, ATLASSIAN_NPM_TOKEN: "tok", MOTION_TOKEN: "motion-tok", NPMRC_PATH: target };
	execFileSync(process.execPath, [SCRIPT], { env, stdio: "pipe" });
	const first = fs.readFileSync(target, "utf8");
	execFileSync(process.execPath, [SCRIPT], { env, stdio: "pipe" });
	assert.equal(fs.readFileSync(target, "utf8"), first);
	fs.rmSync(dir, { recursive: true, force: true });
});
