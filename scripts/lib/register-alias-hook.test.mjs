import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { aliasTarget, resolveFile } from "./register-alias-hook.mjs";

const HOOK = fileURLToPath(new URL("./register-alias-hook.mjs", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

function fixture(t) {
	const root = mkdtempSync(path.join(tmpdir(), "vpk-alias-hook-"));
	t.after(() => rmSync(root, { force: true, recursive: true }));
	mkdirSync(path.join(root, "lib/util"), { recursive: true });
	writeFileSync(path.join(root, "lib/model.ts"), "export const model = 1;\n");
	writeFileSync(path.join(root, "lib/util/index.ts"), "export const util = 2;\n");
	writeFileSync(path.join(root, "lib/esm.ts"), "export const esm = 3;\n");
	return `${root}/`;
}

test("resolves @/ to the root and extensionless or .js-for-.ts specifiers the way TypeScript does", (t) => {
	const root = fixture(t);
	const parent = pathToFileURL(path.join(root, "lib/consumer.ts")).href;
	assert.equal(aliasTarget("@/lib/model", parent, root), `${root}lib/model.ts`);
	assert.equal(aliasTarget("@/lib/util", parent, root), `${root}lib/util/index.ts`);
	assert.equal(aliasTarget("./model", parent, root), `${root}lib/model.ts`);
	assert.equal(aliasTarget("./esm.js", parent, root), `${root}lib/esm.ts`);
	assert.equal(aliasTarget("../lib/util", parent, root), `${root}lib/util/index.ts`);
	assert.equal(aliasTarget("@/lib/missing", parent, root), null);
	assert.equal(aliasTarget("react", parent, root), null);
	assert.equal(aliasTarget("./model", "node:internal", root), null);
	assert.equal(resolveFile(`${root}lib/model.ts`), `${root}lib/model.ts`);
});

// Run in a child process so the hook is registered there, not in this test process.
function runWithHook(source, { hook = true } = {}) {
	return spawnSync(process.execPath, [...(hook ? ["--import", HOOK] : []), "--input-type=module", "-e", source], {
		cwd: REPO_ROOT, encoding: "utf8", timeout: 30000,
	});
}

test("a module loaded by node:test can import the app through @/ and extensionless paths", () => {
	const source = [
		'const graph = await import("@/scripts/lib/import-graph");',
		'const gates = await import("@/scripts/lib/package-gates.js");',
		'const { createRequire } = await import("node:module");',
		'const required = createRequire(import.meta.url)("@/scripts/lib/guard-scripts");',
		"console.log(typeof graph.buildReverseImports, typeof gates.default.gateRunsScript, required.GUARD_SCRIPTS.length);",
	].join("\n");
	const withHook = runWithHook(source);
	assert.equal(withHook.status, 0, withHook.stderr);
	assert.equal(withHook.stdout.trim(), "function function 17");

	// Fail-first: without the hook Node cannot resolve the alias at all.
	const withoutHook = runWithHook(source, { hook: false });
	assert.notEqual(withoutHook.status, 0);
	assert.match(withoutHook.stderr, /Cannot find package '@\/scripts'|ERR_MODULE_NOT_FOUND/u);
});

test("real resolution wins and a genuinely missing module still fails", () => {
	const ok = runWithHook('const fs = await import("node:fs"); const p = await import("./scripts/lib/guard-scripts.js"); console.log(typeof fs.readFileSync, p.default.GUARD_SCRIPTS[0]);');
	assert.equal(ok.status, 0, ok.stderr);
	assert.equal(ok.stdout.trim(), "function verify:root-artifacts");
	const missing = runWithHook('await import("@/scripts/lib/does-not-exist");');
	assert.notEqual(missing.status, 0);
	assert.match(missing.stderr, /ERR_MODULE_NOT_FOUND|Cannot find/u);
});
