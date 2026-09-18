const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { brotliDecompressSync, gunzipSync } = require("node:zlib");
const exportModule = import("./prepare-static-export.mjs");

function fixture(t) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-export-inventory-"));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	fs.mkdirSync(path.join(root, "_next/static/chunks"), { recursive: true });
	fs.writeFileSync(path.join(root, "index.html"), '<script src="/_next/static/chunks/a.js"></script><a href="/other">Other</a>');
	fs.writeFileSync(path.join(root, "_next/static/chunks/a.js"), "const repeated = 123;\n".repeat(100));
	return root;
}

test("inventory verifies referenced assets and separates packaged inventory from route bytes", async (t) => {
	const { inspectExport } = await exportModule;
	const root = fixture(t);
	fs.writeFileSync(path.join(root, "unused.svg"), "<svg></svg>");
	const result = inspectExport(root);
	assert.equal(result.packagedFiles, 3);
	assert.equal(result.routes[0].assetCount, 1);
	assert.equal(result.routes[0].jsBytes, 2200);
	assert.equal(result.routes[0].assets[0].gzipBytes, null);
});

test("missing references fail before any compression output", async (t) => {
	const { prepareExport } = await exportModule;
	const root = fixture(t);
	fs.unlinkSync(path.join(root, "_next/static/chunks/a.js"));
	await assert.rejects(prepareExport(root), /Missing referenced asset/u);
	assert.equal(fs.existsSync(path.join(root, "index.html.gz")), false);
});

test("compression preserves source bytes and refreshes both codecs for smaller replacements", async (t) => {
	const { prepareExport } = await exportModule;
	const root = fixture(t);
	const asset = path.join(root, "_next/static/chunks/a.js");
	const original = fs.readFileSync(asset);
	await prepareExport(root);
	assert.deepEqual(fs.readFileSync(asset), original);
	assert.deepEqual(gunzipSync(fs.readFileSync(`${asset}.gz`)), original);
	assert.deepEqual(brotliDecompressSync(fs.readFileSync(`${asset}.br`)), original);
	fs.writeFileSync(asset, "x");
	await prepareExport(root);
	assert.equal(gunzipSync(fs.readFileSync(`${asset}.gz`)).toString(), "x");
	assert.equal(brotliDecompressSync(fs.readFileSync(`${asset}.br`)).toString(), "x");
});

test("reports cannot become packaged public files and symlinks are rejected", async (t) => {
	const { inspectExport, main } = await exportModule;
	const root = fixture(t);
	await assert.rejects(main([root, "--report", path.join(root, "report.json")]), /outside/u);
	fs.symlinkSync(path.join(root, "index.html"), path.join(root, "alias.html"));
	assert.throws(() => inspectExport(root), /Symlink/u);
});

test("inventory supports URL-encoded names and serialized Next references", async (t) => {
	const { inspectExport } = await exportModule;
	const root = fixture(t);
	fs.mkdirSync(path.join(root, "_next/static/chunks/[id]"));
	fs.writeFileSync(path.join(root, "_next/static/chunks/[id]/page.js"), "1234");
	fs.writeFileSync(path.join(root, "index.html"), '<script>const next="\\\"/_next/static/chunks/%5Bid%5D/page.js\\\"";</script>');
	const inventory = inspectExport(root);
	assert.equal(inventory.routes[0].jsBytes, 4);
});
