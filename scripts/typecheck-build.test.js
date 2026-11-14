const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("typecheck:build runs the TypeScript 6 compiler that next build loads", async () => {
	const { resolveTypeScript6 } = await import("./typecheck-build.mjs");
	const typescript = resolveTypeScript6();
	assert.match(typescript.version, /^6\./u);
	assert.ok(fs.existsSync(typescript.bin), typescript.bin);
	// Next resolves the same package by the name "typescript".
	assert.equal(path.dirname(require.resolve("typescript/package.json")), path.dirname(path.dirname(typescript.bin)));
});
