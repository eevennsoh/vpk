const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { build } = require("esbuild");

const APP_API_DIR = path.join(__dirname, "..");

// Every dev proxy adapter whose backend route is local-only (P0-1), with its write method.
const GUARDED_ADAPTERS = [
	["html-selector/dispatch", "POST", "/api/html-selector/dispatch"],
	["vpk-html/apply-tokens", "POST", "/api/vpk-html/apply-tokens"],
	["vpk-html/notes", "PUT", "/api/vpk-html/notes?page=assets/demos/demo.html"],
	["vpk-html/publish-gist", "POST", "/api/vpk-html/publish-gist"],
	["personal-graph/capture", "POST", "/api/personal-graph/capture"],
	["personal-graph/ingest", "POST", "/api/personal-graph/ingest"],
	["personal-graph/raw", "POST", "/api/personal-graph/raw"],
	["personal-graph/source", "POST", "/api/personal-graph/source"],
	["personal-graph/summarize", "POST", "/api/personal-graph/summarize"],
	["personal-graph/page/[...slug]", "PUT", "/api/personal-graph/page/notes/intro"],
	["personal-graph/twg/chat", "POST", "/api/personal-graph/twg/chat"],
	["personal-graph/twg/expand", "POST", "/api/personal-graph/twg/expand"],
	["personal-graph/twg/refresh", "POST", "/api/personal-graph/twg/refresh"],
	["personal-graph/vault/reset", "POST", "/api/personal-graph/vault/reset"],
	["personal-graph/vault/select", "POST", "/api/personal-graph/vault/select"],
];

let bundleDir;
async function loadRoute(adapter) {
	bundleDir ??= fs.mkdtempSync(path.join(os.tmpdir(), "local-request-routes-"));
	const outfile = path.join(bundleDir, `${adapter.replace(/[^a-z0-9]+/giu, "-")}.cjs`);
	await build({
		bundle: true,
		entryPoints: [path.join(APP_API_DIR, adapter, "route.ts")],
		format: "cjs",
		logLevel: "silent",
		outfile,
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
	});
	return require(outfile);
}
test.after(() => {
	if (bundleDir) fs.rmSync(bundleDir, { force: true, recursive: true });
});

function mockBackendFetch(t) {
	const originalBackendUrl = process.env.BACKEND_URL;
	const originalFetch = globalThis.fetch;
	const calls = [];
	process.env.BACKEND_URL = "http://backend.local";
	globalThis.fetch = async (url) => {
		calls.push(String(url));
		return new Response("{}", { headers: { "Content-Type": "application/json" }, status: 200 });
	};
	t.after(() => {
		globalThis.fetch = originalFetch;
		if (originalBackendUrl === undefined) delete process.env.BACKEND_URL;
		else process.env.BACKEND_URL = originalBackendUrl;
	});
	return calls;
}

function callAdapter(route, method, url, headers = {}) {
	const request = new Request(url, {
		body: JSON.stringify({ agent: "codex", prompt: "hello", url: "https://example.com", source: "vault", content: "x", tokens: {} }),
		headers: { "Content-Type": "text/plain", ...headers },
		method,
	});
	return route[method](request, { params: Promise.resolve({ slug: ["notes", "intro"] }) });
}

for (const [adapter, method, routePath] of GUARDED_ADAPTERS) {
	test(`${method} /api/${adapter} refuses cross-site and non-local requests before calling the backend`, async (t) => {
		const route = await loadRoute(adapter);
		const calls = mockBackendFetch(t);

		const crossSite = await callAdapter(route, method, `http://localhost:4333${routePath}`, { Origin: "https://evil.example" });
		const tunnelled = await callAdapter(route, method, `https://research.atlastunnel.com${routePath}`);
		const reboundHost = await callAdapter(route, method, `http://localhost:4333${routePath}`, { Host: "rebound.example:4333" });
		assert.equal(crossSite.status, 403);
		assert.deepEqual(await crossSite.json(), { error: "Only local requests are allowed" });
		assert.equal(tunnelled.status, 403);
		assert.equal(reboundHost.status, 403);
		assert.deepEqual(calls, []);

		const sameOrigin = await callAdapter(route, method, `https://feature.vpk.localhost${routePath}`, { Origin: "https://feature.vpk.localhost" });
		assert.notEqual(sameOrigin.status, 403);
		assert.equal(calls.length, 1, "a same-origin localhost request is proxied");
	});
}

test("local requests by plain localhost, 127.0.0.1 and no-Origin tooling still pass", async () => {
	const { isLocalFrontendRequest } = await (async () => {
		const outfile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "local-request-helper-")), "helper.cjs");
		await build({ bundle: true, entryPoints: [path.join(__dirname, "local-request.ts")], format: "cjs", logLevel: "silent", outfile, platform: "node", tsconfig: path.join(process.cwd(), "tsconfig.json") });
		return require(outfile);
	})();
	const request = (url, headers) => new Request(url, { headers, method: "POST" });
	assert.equal(isLocalFrontendRequest(request("http://localhost:4333/api/x", { Origin: "http://localhost:4333" })), true);
	assert.equal(isLocalFrontendRequest(request("http://127.0.0.1:4333/api/x", { Origin: "http://127.0.0.1:4333" })), true);
	assert.equal(isLocalFrontendRequest(request("http://[::1]:4333/api/x", {})), true);
	assert.equal(isLocalFrontendRequest(request("http://localhost:4333/api/x", {})), true, "curl and scripts send no Origin");
	assert.equal(isLocalFrontendRequest(request("http://localhost:4333/api/x", { Origin: "null" })), false);
	assert.equal(isLocalFrontendRequest(request("http://localhost:4333/api/x", { Origin: "http://localhost.evil.example" })), false);
	assert.equal(isLocalFrontendRequest(request("http://192.168.0.10:4333/api/x", {})), false, "a LAN client of next dev");
});

// Dev with VPK_RUNTIME_ADMIN_TOKEN set: the Next proxy forwards no admin token, so the
// local-only write routes must not require one, or every UI write through the proxy 403s.
test("with a runtime admin token configured, local writes still reach the backend through the adapters", async (t) => {
	const express = require("express");
	const { registerBackendAppRoutes } = require("../../../backend/app.js");
	const { createRuntimeAdminControls } = require("../../../backend/middleware/runtime-admin.js");
	const { createRuntimeRouteStackTestDependencies } = require("../../../backend/routes/route-stack-test-dependencies.js");
	await require("../../../backend/lib/ai-sdk-runtime.js").loadAiSdk();
	const { requireRuntimeAdmin } = createRuntimeAdminControls({ env: { VPK_RUNTIME_ADMIN_TOKEN: "configured-admin-token" }, allowedOrigins: [] });

	const app = express();
	app.use(express.json());
	registerBackendAppRoutes(app, { ...createRuntimeRouteStackTestDependencies(), requireRuntimeAdmin });
	const server = app.listen(0, "127.0.0.1");
	await new Promise((resolve) => server.once("listening", resolve));
	t.after(() => new Promise((resolve) => server.close(resolve)));
	const backendUrl = `http://localhost:${server.address().port}`;
	const originalBackendUrl = process.env.BACKEND_URL;
	process.env.BACKEND_URL = backendUrl;
	t.after(() => {
		if (originalBackendUrl === undefined) delete process.env.BACKEND_URL;
		else process.env.BACKEND_URL = originalBackendUrl;
	});

	const post = async (adapter, body) => {
		const route = await loadRoute(adapter);
		return route.POST(new Request(`https://feature.vpk.localhost/api/${adapter}`, {
			body: JSON.stringify(body),
			headers: { "Content-Type": "application/json", Origin: "https://feature.vpk.localhost" },
			method: "POST",
		}));
	};
	// Each reaches the backend handler's own validation (400), not a runtime-admin 403.
	assert.equal((await post("html-selector/dispatch", { agent: "unknown", prompt: "hello" })).status, 400);
	assert.equal((await post("vpk-html/apply-tokens", { tokens: "not-an-object" })).status, 400);
	assert.equal((await post("personal-graph/source", { source: "not-a-source" })).status, 400);

	// The token is in force: a route that already required runtime admin still refuses.
	const adminOnly = await fetch(`${backendUrl}/api/orchestrator/log`, { method: "DELETE" });
	assert.equal(adminOnly.status, 403);
});
