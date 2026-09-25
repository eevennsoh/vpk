const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { build } = require("esbuild");

async function loadBundledRoute(t, routePath) {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "proxy-query-route-"));
	t.after(() => {
		fs.rmSync(tempDir, { force: true, recursive: true });
	});

	const outfile = path.join(tempDir, "route.cjs");
	await build({
		bundle: true,
		entryPoints: [path.join(__dirname, routePath)],
		format: "cjs",
		logLevel: "silent",
		outfile,
		platform: "node",
	});

	return require(outfile);
}

function createNextRequest(url) {
	return {
		nextUrl: new URL(url),
		url,
	};
}

function mockBackendFetch(t) {
	const originalBackendUrl = process.env.BACKEND_URL;
	const originalFetch = globalThis.fetch;
	const requests = [];
	process.env.BACKEND_URL = "http://backend.local";
	globalThis.fetch = (async (url, init = {}) => {
		requests.push({
			body: String(init.body ?? ""),
			contentType: new Headers(init.headers).get("Content-Type"),
			method: init.method,
			url: String(url),
		});
		return new Response(
			JSON.stringify({ ok: true }),
			{ headers: { "Content-Type": "application/json" }, status: 200 },
		);
	});

	t.after(() => {
		globalThis.fetch = originalFetch;
		if (originalBackendUrl === undefined) {
			delete process.env.BACKEND_URL;
			return;
		}

		process.env.BACKEND_URL = originalBackendUrl;
	});

	return requests;
}

const queryRouteCases = [
	{
		label: "/api/orchestrator/log",
		routePath: "orchestrator/log/route.ts",
		requestUrl: "http://localhost/api/orchestrator/log?ignored=true&limit=25&portIndex=2",
		expectedBackendPath: "/api/orchestrator/log?portIndex=2&limit=25",
	},
	{
		label: "/api/orchestrator/timeline",
		routePath: "orchestrator/timeline/route.ts",
		requestUrl: "http://localhost/api/orchestrator/timeline?limit=10&portIndex=0&debug=1",
		expectedBackendPath: "/api/orchestrator/timeline?portIndex=0&limit=10",
	},
	{
		label: "/api/rovo/documents",
		routePath: "rovo/documents/route.ts",
		requestUrl: "http://localhost/api/rovo/documents?documentId=doc%201&threadId=thread%2F7&extra=1",
		expectedBackendPath: "/api/rovo/documents?threadId=thread%2F7&documentId=doc+1",
	},
	{
		label: "/api/sessions/search",
		routePath: "sessions/search/route.ts",
		requestUrl: "http://localhost/api/sessions/search?limit=5&q=planning%20notes&ignored=true",
		expectedBackendPath: "/api/sessions/search?q=planning+notes&limit=5",
	},

];

for (const queryRouteCase of queryRouteCases) {
	test(`GET ${queryRouteCase.label} forwards supported query parameters in stable order`, async (t) => {
		const { GET } = await loadBundledRoute(t, queryRouteCase.routePath);
		const requests = mockBackendFetch(t);

		const response = await GET(createNextRequest(queryRouteCase.requestUrl));

		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), { ok: true });
		assert.deepEqual(requests, [{
			body: "",
			contentType: "application/json",
			method: "GET",
			url: `http://backend.local${queryRouteCase.expectedBackendPath}`,
		}]);
	});
}
