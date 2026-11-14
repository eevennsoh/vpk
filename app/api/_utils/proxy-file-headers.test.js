const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { build } = require("esbuild");

// BE-F8: a file response the backend sandboxes stays sandboxed through the dev proxy.

async function loadBundledRoute(t, routePath) {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "proxy-file-headers-"));
	t.after(() => fs.rmSync(tempDir, { force: true, recursive: true }));
	const outfile = path.join(tempDir, "route.cjs");
	await build({
		bundle: true,
		entryPoints: [path.join(__dirname, "..", routePath)],
		format: "cjs",
		logLevel: "silent",
		outfile,
		platform: "node",
	});
	return require(outfile);
}

test("the file route proxy keeps the backend's CSP and nosniff", async (t) => {
	const originalBackendUrl = process.env.BACKEND_URL;
	const originalFetch = globalThis.fetch;
	process.env.BACKEND_URL = "http://backend.local";
	const backendHeaders = {
		"Content-Disposition": "inline; filename=\"logo.svg\"",
		"Content-Security-Policy": "sandbox; default-src 'none'",
		"Content-Type": "image/svg+xml",
		"X-Content-Type-Options": "nosniff",
	};
	globalThis.fetch = async () => new Response("<svg/>", { headers: backendHeaders, status: 200 });
	t.after(() => {
		globalThis.fetch = originalFetch;
		if (originalBackendUrl === undefined) delete process.env.BACKEND_URL;
		else process.env.BACKEND_URL = originalBackendUrl;
	});

	const { GET } = await loadBundledRoute(t, "rovo/files/[fileId]/route.ts");
	const response = await GET({}, { params: Promise.resolve({ fileId: "file-1" }) });

	assert.equal(response.status, 200);
	for (const [name, value] of Object.entries(backendHeaders)) {
		assert.equal(response.headers.get(name), value, name);
	}
	assert.equal(await response.text(), "<svg/>");
});
