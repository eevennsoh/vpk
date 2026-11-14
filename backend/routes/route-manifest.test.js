const assert = require("node:assert/strict");
const express = require("express");
const { mkdtempSync, mkdirSync, rmSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { before, test } = require("node:test");

const {
	collectRuntimeRouteStackRoutes,
	collectNextRouteEntries,
	collectRouteManifest,
	collectProxyHelperBypasses,
	findUnregisteredServerRouteRegistrars,
	extractPathsFromExpression,
	findProxyTargetParityFailures,
	getConcreteRoutePath,
	getRouteContext,
	normalizeBackendTargetPath,
	readRouteManifest,
} = require("./route-manifest");
const {
	createBackendApp,
	registerBackendAppRoutes,
} = require("../app");
const ts = require("typescript");
const { loadAiSdk } = require("../lib/ai-sdk-runtime");

before(async () => {
	await loadAiSdk();
});

function parseExpression(source) {
	const sourceFile = ts.createSourceFile(
		"expression.ts",
		`const value = ${source};`,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS,
	);
	const statement = sourceFile.statements[0];
	return statement.declarationList.declarations[0].initializer;
}

function parseRouteFunction(source, fileName = "app/api/status/route.ts") {
	const sourceFile = ts.createSourceFile(
		fileName,
		source,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS,
	);
	const functionNode = sourceFile.statements.find((statement) => ts.isFunctionDeclaration(statement));
	assert.ok(functionNode, "expected source to include a route function declaration");
	return {
		functionNode,
		sourceFile,
	};
}

function withTempProject(callback) {
	const tempDir = mkdtempSync(path.join(os.tmpdir(), "route-manifest-"));
	try {
		mkdirSync(path.join(tempDir, "backend/routes"), { recursive: true });
		return callback(tempDir);
	} finally {
		rmSync(tempDir, { force: true, recursive: true });
	}
}

const { createRuntimeRouteStackTestDependencies } = require("./route-stack-test-dependencies");

test("route context normalizes Next dynamic segments to backend-style path params", () => {
	assert.deepEqual(getRouteContext("app/api/jobs/[id]/run/route.ts"), {
		catchAllParams: [],
		dynamicParams: ["id"],
		nextPath: "/api/jobs/:id/run",
		relativeRouteFile: "app/api/jobs/[id]/run/route.ts",
	});

	assert.deepEqual(getRouteContext("app/api/personal-graph/page/[...slug]/route.ts"), {
		catchAllParams: ["slug"],
		dynamicParams: [],
		nextPath: "/api/personal-graph/page/*slug",
		relativeRouteFile: "app/api/personal-graph/page/[...slug]/route.ts",
	});
});

test("target path extraction strips query-only template spans", () => {
	const context = getRouteContext("app/api/jobs/[id]/route.ts");
	assert.deepEqual(extractPathsFromExpression(
		parseExpression("`/api/jobs/${encodeURIComponent(id)}${request.nextUrl.search}`"),
		context,
	), ["/api/jobs/:id"]);

	assert.deepEqual(extractPathsFromExpression(
		parseExpression("query ? `/api/skills/hub/search${request.nextUrl.search}` : `/api/skills/hub/browse${request.nextUrl.search}`"),
		getRouteContext("app/api/skills/hub/route.ts"),
	), [
		"/api/skills/hub/search",
		"/api/skills/hub/browse",
	]);
});

test("normalizes backend target paths before comparison", () => {
	assert.equal(normalizeBackendTargetPath("/api/status?verbose=true"), "/api/status");
	assert.equal(normalizeBackendTargetPath("/api/status/"), "/api/status");
});

test("route path samples make Express dynamic and catch-all paths matchable", () => {
	assert.equal(getConcreteRoutePath("/api/checkpoints/:id/rollback"), "/api/checkpoints/__id__/rollback");
	assert.equal(getConcreteRoutePath("/api/personal-graph/page/*slug"), "/api/personal-graph/page/__slug__");
});

test("collector follows route-local proxy helper path arguments", () => {
	withTempProject((tempDir) => {
		const routeDir = path.join(tempDir, "app/api/checkpoints");
		mkdirSync(routeDir, { recursive: true });
		writeFileSync(path.join(routeDir, "route.ts"), [
			"export async function POST(request: Request) {",
			'  return proxyCheckpointRequest(request, "/api/checkpoints");',
			"}",
		].join("\n"));
		const [route] = collectNextRouteEntries(tempDir);
		assert.equal(route.nextPath, "/api/checkpoints");
		assert.deepEqual(route.targets.map((target) => `${target.method} ${target.path}`), ["POST /api/checkpoints"]);
	});
});

test("collector excludes removed control-plane proxy routes", () => {
	const manifest = collectRouteManifest();
	assert.equal(manifest.nextApiRoutes.some((route) => /^\/api\/(?:jobs|skills|wiki)(?:\/|$)/u.test(route.nextPath)), false);
});

test("collector flags direct backend fetches inside Next API route handlers", () => {
	const routeFile = "app/api/items/[id]/route.ts";
	const { functionNode, sourceFile } = parseRouteFunction([
		"export async function POST() {",
		"\treturn fetch(`${getBackendUrl()}/api/items/${id}?verbose=true`, { method: \"PUT\" });",
		"}",
		"",
	].join("\n"), routeFile);

	assert.deepEqual(
		collectProxyHelperBypasses(functionNode, sourceFile, getRouteContext(routeFile), "POST"),
		[
			{
				method: "PUT",
				path: "/api/items/:id",
				source: "app/api/items/[id]/route.ts",
			},
		],
	);
});

test("collector output does not move when lines are added above a handler", () => {
	const routeFile = "app/api/items/[id]/route.ts";
	const handler = [
		"export async function POST() {",
		"\treturn fetch(`${getBackendUrl()}/api/items/${id}`, { method: \"PUT\" });",
		"}",
		"",
	].join("\n");
	const collect = (source) => {
		const { functionNode, sourceFile } = parseRouteFunction(source, routeFile);
		return collectProxyHelperBypasses(functionNode, sourceFile, getRouteContext(routeFile), "POST");
	};
	// The generated files carry no line numbers, so an unrelated edit above a route leaves
	// them unchanged and parallel PRs stop colliding on them.
	assert.deepEqual(collect(`\n\n// a comment\n${handler}`), collect(handler));
});

test("collector does not flag shared backend proxy helpers as bypasses", () => {
	const routeFile = "app/api/status/route.ts";
	const { functionNode, sourceFile } = parseRouteFunction([
		"export async function GET() {",
		"\treturn fetchBackend(\"/api/status\");",
		"}",
		"",
	].join("\n"), routeFile);

	assert.deepEqual(
		collectProxyHelperBypasses(functionNode, sourceFile, getRouteContext(routeFile), "GET"),
		[],
	);
});

test("checked-in route manifest matches source collectors", () => {
	const checkedInManifest = readRouteManifest();
	assert.ok(checkedInManifest, "route-manifest.json should exist");
	assert.deepEqual(collectRouteManifest(), checkedInManifest);
});

test("runtime Express route stack registers every backend manifest route", () => {
	const { app } = createBackendApp(createRuntimeRouteStackTestDependencies());
	const manifest = collectRouteManifest();
	const runtimeRouteKeys = collectRuntimeRouteStackRoutes(app, manifest.backendRoutes)
		.map((route) => `${route.method} ${route.path}`)
		.sort((a, b) => a.localeCompare(b));
	const manifestRouteKeys = manifest.backendRoutes
		.map((route) => `${route.method} ${route.path}`)
		.sort((a, b) => a.localeCompare(b));

	assert.deepEqual(runtimeRouteKeys, manifestRouteKeys);
});

test("Next API proxy targets are backed by registered backend routes", () => {
	const manifest = readRouteManifest();
	assert.deepEqual(findProxyTargetParityFailures(manifest), []);
});

test("Next API route adapters cannot directly fetch backend API routes", () => {
	const manifest = {
		backendRoutes: [
			{
				method: "GET",
				path: "/api/status",
			},
		],
		nextApiRoutes: [
			{
				method: "GET",
				nextPath: "/api/status",
				proxyHelperBypasses: [
					{
						method: "GET",
						path: "/api/status",
						source: "app/api/status/route.ts:2",
					},
				],
				source: "app/api/status/route.ts:1",
				targets: [],
			},
		],
	};

	assert.deepEqual(findProxyTargetParityFailures(manifest), [
		{
			nextRoute: "GET /api/status",
			source: "app/api/status/route.ts:2",
			target: "GET /api/status",
			type: "route-proxy-helper-bypass",
		},
	]);
});

test("proxy target parity checks dynamic targets instead of skipping them", () => {
	const manifest = {
		backendRoutes: [
			{
				method: "GET",
				path: "/api/items/:id",
			},
		],
		nextApiRoutes: [
			{
				method: "GET",
				nextPath: "/api/items/:id",
				source: "app/api/items/[id]/route.ts:1",
				targets: [
					{
						method: "GET",
						path: "/api/items/:id",
						source: "app/api/items/[id]/route.ts:4",
					},
				],
			},
			{
				method: "GET",
				nextPath: "/api/missing/:id",
				source: "app/api/missing/[id]/route.ts:1",
				targets: [
					{
						method: "GET",
						path: "/api/missing/:id",
						source: "app/api/missing/[id]/route.ts:4",
					},
				],
			},
		],
	};

	assert.deepEqual(findProxyTargetParityFailures(manifest), [
		{
			nextRoute: "GET /api/missing/:id",
			source: "app/api/missing/[id]/route.ts:4",
			target: "GET /api/missing/:id",
			type: "unbacked-proxy-target",
		},
	]);
});

test("route-local Next API handlers must be explicitly classified", () => {
	const manifest = {
		backendRoutes: [],
		nextApiRoutes: [
			{
				method: "GET",
				nextPath: "/api/realtime/ws-url",
				source: "app/api/realtime/ws-url/route.ts:12",
				targets: [],
			},
			{
				method: "POST",
				nextPath: "/api/unclassified-local",
				source: "app/api/unclassified-local/route.ts:1",
				targets: [],
			},
		],
	};

	assert.deepEqual(findProxyTargetParityFailures(manifest), [
		{
			nextRoute: "POST /api/unclassified-local",
			source: "app/api/unclassified-local/route.ts:1",
			type: "unclassified-local-next-route",
		},
	]);
});

test("dynamic proxy fan-out exceptions must keep their backing routes registered", () => {
	const nextRoute = {
		method: "POST",
		nextPath: "/api/chromium-preview/:action",
		source: "app/api/chromium-preview/[action]/route.ts:22",
		targets: [
			{
				method: "POST",
				path: "/api/chromium-preview/:action",
				source: "app/api/chromium-preview/[action]/route.ts:43",
			},
		],
	};
	const backingRoutes = [
		"back",
		"click",
		"click-ref",
		"fill-ref",
		"forward",
		"hover-ref",
		"press",
		"reload",
		"scroll",
		"select-ref",
		"type",
		"type-ref",
		"viewport",
		"wheel",
	].map((action) => ({
		method: "POST",
		path: `/api/chromium-preview/${action}`,
	}));

	assert.deepEqual(findProxyTargetParityFailures({
		backendRoutes: backingRoutes,
		nextApiRoutes: [nextRoute],
	}), []);

	assert.deepEqual(findProxyTargetParityFailures({
		backendRoutes: backingRoutes.filter((route) => route.path !== "/api/chromium-preview/wheel"),
		nextApiRoutes: [nextRoute],
	}), [
		{
			missingBackingTargets: ["POST /api/chromium-preview/wheel"],
			nextRoute: "POST /api/chromium-preview/:action",
			reason: "Route-local action validation fans one dynamic Next segment out to static backend Chromium preview action endpoints.",
			source: "app/api/chromium-preview/[action]/route.ts:43",
			target: "POST /api/chromium-preview/:action",
			type: "incomplete-proxy-target-fanout",
		},
	]);
});

test("server route manifest reports exported route registrars missing from SERVER_ROUTE_FILES", () => {
	withTempProject((cwd) => {
		writeFileSync(
			path.join(cwd, "backend/routes/status.js"),
			[
				"function registerStatusRoutes(app) {",
				"\tapp.get('/api/status', () => {});",
				"}",
				"module.exports = { registerStatusRoutes };",
				"",
			].join("\n"),
		);
		writeFileSync(
			path.join(cwd, "backend/routes/new-surface.js"),
			[
				"function registerNewSurfaceRoutes(app) {",
				"\tapp.get('/api/new-surface', () => {});",
				"}",
				"module.exports = { registerNewSurfaceRoutes };",
				"",
			].join("\n"),
		);
		writeFileSync(
			path.join(cwd, "backend/routes/utility.js"),
			"module.exports = { helper: () => null };\n",
		);

		assert.deepEqual(findUnregisteredServerRouteRegistrars(cwd), [
			{
				filePath: "backend/routes/new-surface.js",
				registrars: ["registerNewSurfaceRoutes"],
			},
		]);
	});
});

// Dispatches one request through the Express app in-process. No listener is bound, so the
// guard also runs where binding a local port is not permitted (the agent sandbox).
function dispatch(app, method, routePath) {
	const { IncomingMessage, ServerResponse } = require("node:http");
	const { Duplex } = require("node:stream");
	return new Promise((resolve, reject) => {
		const socket = new Duplex({ read() {}, write(_chunk, _encoding, callback) { callback(); } });
		Object.defineProperty(socket, "remoteAddress", { value: "127.0.0.1" });
		const req = new IncomingMessage(socket);
		Object.assign(req, { headers: { host: "127.0.0.1" }, method, url: routePath });
		req.push(null);
		const res = new ServerResponse(req);
		res.assignSocket(socket);
		res.once("finish", () => resolve(res.statusCode));
		res.once("error", reject);
		app(req, res, (error) => (error ? reject(error) : resolve(404)));
	});
}

test("removed APIs return 404 from the complete backend route stack", async () => {
	const app = express();
	registerBackendAppRoutes(app, createRuntimeRouteStackTestDependencies());
	// Control: a live route answers, so the in-process dispatch is not 404 for everything.
	assert.notEqual(await dispatch(app, "GET", "/api/health"), 404);
	for (const [method, routePath] of [["GET", "/api/jobs"], ["POST", "/api/jobs/run-1/run"], ["GET", "/api/skills"], ["POST", "/api/skills/drafts/draft-1/approve"], ["GET", "/api/wiki/memory-explorer"], ["POST", "/api/wiki/sync"], ["GET", "/api/status/hermes"]]) {
		assert.equal(await dispatch(app, method, routePath), 404, `${method} ${routePath}`);
	}
});
