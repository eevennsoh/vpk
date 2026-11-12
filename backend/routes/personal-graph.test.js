"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const express = require("express");
const test = require("node:test");
const {
	createCapturedResponse,
	createInProcessRequest,
} = require("../lib/in-process-http");
const personalGraphQmd = require("../lib/personal-graph-qmd");
const summaryContext = require("../lib/personal-graph-summary-context");
const twgSource = require("../lib/personal-graph-twg-source");
const {
	registerPersonalGraphRoutes,
} = require("./personal-graph");

function createPersonalGraphTestApp() {
	const app = express();
	app.use(express.json());
	registerPersonalGraphRoutes(app);
	app.get("/{*splat}", (req, res) => {
		if (req.path.startsWith("/api/")) {
			return res.status(404).json({
				error: `API route not found: ${req.path}`,
			});
		}
		return res.status(404).end();
	});
	return app;
}

function setEnvValueForTest(t, key, value) {
	const originalValue = process.env[key];
	process.env[key] = value;

	t.after(() => {
		if (originalValue === undefined) {
			delete process.env[key];
			return;
		}

		process.env[key] = originalValue;
	});
}

async function dispatch(app, { method = "GET", requestSignalGetter, url }) {
	const req = createInProcessRequest({
		headers: { Accept: "application/json", Host: "localhost" },
	});
	req.socket = { remoteAddress: "127.0.0.1" };
	req.method = method;
	req.url = url;
	req.originalUrl = url;
	if (requestSignalGetter) {
		Object.defineProperty(req, "signal", {
			get: requestSignalGetter,
		});
	}

	const res = createCapturedResponse();
	app.handle(req, res, (error) => {
		if (error) {
			res.status(500).json({
				error: error instanceof Error ? error.message : String(error),
			});
			return;
		}
		res.status(404).json({
			error: `API route not found: ${url}`,
		});
	});
	await res.waitForHeaders();
	return res.toWebResponse();
}

async function listen(app, t) {
	const server = app.listen(0, "127.0.0.1");
	t.after(() => new Promise((resolve, reject) => {
		server.close((error) => {
			if (error) {
				reject(error);
				return;
			}
			resolve();
		});
	}));

	await new Promise((resolve, reject) => {
		server.once("listening", resolve);
		server.once("error", reject);
	});

	const address = server.address();
	assert.ok(address && typeof address === "object");
	return `http://127.0.0.1:${address.port}`;
}

function configureSelectedVault(t, vaultRoot) {
	const originalVault = process.env.PERSONAL_GRAPH_VAULT;
	const originalSelectedVault = process.env.PERSONAL_GRAPH_SELECTED_VAULT;
	const originalConfigPath = process.env.PERSONAL_GRAPH_VAULT_CONFIG_PATH;
	const configPath = path.join(
		os.tmpdir(),
		`personal-graph-route-test-${process.pid}-${Date.now()}.json`,
	);
	delete process.env.PERSONAL_GRAPH_VAULT;
	process.env.PERSONAL_GRAPH_SELECTED_VAULT = vaultRoot;
	process.env.PERSONAL_GRAPH_VAULT_CONFIG_PATH = configPath;

	t.after(() => {
		if (originalVault === undefined) {
			delete process.env.PERSONAL_GRAPH_VAULT;
		} else {
			process.env.PERSONAL_GRAPH_VAULT = originalVault;
		}
		if (originalSelectedVault === undefined) {
			delete process.env.PERSONAL_GRAPH_SELECTED_VAULT;
		} else {
			process.env.PERSONAL_GRAPH_SELECTED_VAULT = originalSelectedVault;
		}
		if (originalConfigPath === undefined) {
			delete process.env.PERSONAL_GRAPH_VAULT_CONFIG_PATH;
		} else {
			process.env.PERSONAL_GRAPH_VAULT_CONFIG_PATH = originalConfigPath;
		}
		fs.rmSync(configPath, { force: true });
		fs.rmSync(vaultRoot, { force: true, recursive: true });
	});

	return configPath;
}

test("GET /api/personal-graph/vault is handled by the Personal Graph router", async (t) => {
	const configPath = path.join(os.tmpdir(), `personal-graph-route-test-${process.pid}.json`);
	fs.rmSync(configPath, { force: true });
	t.after(() => {
		fs.rmSync(configPath, { force: true });
	});
	setEnvValueForTest(t, "PERSONAL_GRAPH_VAULT", "/tmp/ignored-personal-graph-env-vault");
	setEnvValueForTest(t, "PERSONAL_GRAPH_SELECTED_VAULT", "");
	setEnvValueForTest(t, "PERSONAL_GRAPH_VAULT_CONFIG_PATH", configPath);

	const response = await dispatch(createPersonalGraphTestApp(), {
		url: "/api/personal-graph/vault",
	});
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.status, "unconfigured");
	assert.equal(body.message, "Select a folder to get started.");
	assert.equal(body.error, undefined);
});

test("GET /api/personal-graph/search normalizes non-positive limits", async (t) => {
	const originalSearch = personalGraphQmd.search;
	const observedLimits = [];
	personalGraphQmd.search = async (_query, options) => {
		observedLimits.push(options.limit);
		return [];
	};
	t.after(() => {
		personalGraphQmd.search = originalSearch;
	});

	const response = await dispatch(createPersonalGraphTestApp(), {
		url: "/api/personal-graph/search?q=graph&limit=-1",
	});
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.deepEqual(body, { results: [] });
	assert.deepEqual(observedLimits, [10]);
});

test("POST /api/personal-graph/raw accepts multipart file uploads into the selected vault", async (t) => {
	const vaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), "personal-graph-route-raw-"));
	configureSelectedVault(t, vaultRoot);
	const baseUrl = await listen(createPersonalGraphTestApp(), t);
	const boundary = "----personal-graph-route-test";
	const uploadBody = [
		`--${boundary}`,
		"Content-Disposition: form-data; name=\"file\"; filename=\"capture.txt\"",
		"Content-Type: text/plain",
		"",
		"Captured source body.",
		`--${boundary}--`,
		"",
	].join("\r\n");

	const response = await fetch(`${baseUrl}/api/personal-graph/raw`, {
		body: uploadBody,
		headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
		method: "POST",
	});
	const body = await response.json();

	assert.equal(response.status, 201);
	assert.equal(body.relativePath, "raw/capture.txt");
	assert.equal(
		fs.readFileSync(path.join(vaultRoot, "raw", "capture.txt"), "utf8"),
		"Captured source body.",
	);
});

test("POST /api/personal-graph/vault/reset clears folder picker state without deleting vault files", async (t) => {
	const envRoot = fs.mkdtempSync(path.join(os.tmpdir(), "personal-graph-route-reset-env-"));
	const selectedRoot = fs.mkdtempSync(path.join(os.tmpdir(), "personal-graph-route-reset-selected-"));
	const configPath = configureSelectedVault(t, selectedRoot);
	const selectedRawPath = path.join(selectedRoot, "raw", "capture.md");
	fs.mkdirSync(path.dirname(selectedRawPath), { recursive: true });
	fs.writeFileSync(selectedRawPath, "selected vault source", "utf8");
	fs.writeFileSync(configPath, JSON.stringify({ vaultRoot: selectedRoot }), "utf8");
	process.env.PERSONAL_GRAPH_VAULT = envRoot;
	process.env.PERSONAL_GRAPH_SELECTED_VAULT = selectedRoot;
	t.after(() => {
		fs.rmSync(envRoot, { force: true, recursive: true });
		fs.rmSync(selectedRoot, { force: true, recursive: true });
	});

	const beforeResponse = await dispatch(createPersonalGraphTestApp(), {
		url: "/api/personal-graph/vault",
	});
	const beforeBody = await beforeResponse.json();
	assert.equal(beforeResponse.status, 200);
	assert.equal(beforeBody.root, selectedRoot);
	assert.equal(beforeBody.source, "folder-picker");

	const resetResponse = await dispatch(createPersonalGraphTestApp(), {
		method: "POST",
		url: "/api/personal-graph/vault/reset",
	});
	const resetBody = await resetResponse.json();

	assert.equal(resetResponse.status, 200);
	assert.equal(resetBody.root, null);
	assert.equal(resetBody.source, null);
	assert.equal(resetBody.status, "unconfigured");
	assert.equal(process.env.PERSONAL_GRAPH_SELECTED_VAULT, undefined);
	assert.equal(fs.existsSync(configPath), false);
	assert.equal(fs.readFileSync(selectedRawPath, "utf8"), "selected vault source");
});

function configureTwgEnv(t) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "personal-graph-twg-env-"));
	const sourcePath = path.join(dir, "source.json");
	const cachePath = path.join(dir, "twg-cache.json");
	setEnvValueForTest(t, "PERSONAL_GRAPH_SOURCE_PATH", sourcePath);
	setEnvValueForTest(t, "PERSONAL_GRAPH_TWG_CACHE_PATH", cachePath);
	t.after(() => fs.rmSync(dir, { force: true, recursive: true }));
	return { sourcePath, cachePath };
}

function createCachedTwgExplorer() {
	return {
		edges: [],
		generatedAt: "2026-05-07T10:00:00.000Z",
		nodes: [
			{
				bodyPreview: "",
				connectionCount: 0,
				dangling: false,
				externalUrl: null,
				frontmatter: { type: "ConfluencePage" },
				id: "ari:cloud:confluence:site:page/1",
				kind: "source",
				label: "Page",
				missing: false,
				path: null,
				provider: "twg",
				relativePath: "ari:cloud:confluence:site:page/1",
				size: 1,
				slug: "ari%3Acloud%3Aconfluence%3Asite%3Apage%2F1",
				title: "Page",
				updatedAt: null,
			},
		],
		stats: { danglingCount: 0, edgeCount: 0, nodeCount: 1, rawCount: 0, wikiCount: 1 },
	};
}

test("GET /api/personal-graph/source defaults to vault when no state file exists", async (t) => {
	configureTwgEnv(t);
	const response = await dispatch(createPersonalGraphTestApp(), {
		url: "/api/personal-graph/source",
	});
	const body = await response.json();
	assert.equal(response.status, 200);
	assert.equal(body.source, "vault");
	assert.equal(body.generatedAt, null);
});

test("POST /api/personal-graph/source persists the active source", async (t) => {
	const { sourcePath } = configureTwgEnv(t);
	const post = await fetch(`${await listen(createPersonalGraphTestApp(), t)}/api/personal-graph/source`, {
		body: JSON.stringify({ source: "twg" }),
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});
	const postBody = await post.json();
	assert.equal(post.status, 200);
	assert.equal(postBody.source, "twg");
	assert.equal(JSON.parse(fs.readFileSync(sourcePath, "utf8")).source, "twg");
});

test("POST /api/personal-graph/source rejects invalid sources", async (t) => {
	configureTwgEnv(t);
	const baseUrl = await listen(createPersonalGraphTestApp(), t);
	const post = await fetch(`${baseUrl}/api/personal-graph/source`, {
		body: JSON.stringify({ source: "nope" }),
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});
	assert.equal(post.status, 400);
});

test("GET /api/personal-graph/explorer returns cached TWG payload when source is twg and cache exists", async (t) => {
	const { sourcePath, cachePath } = configureTwgEnv(t);
	fs.writeFileSync(sourcePath, JSON.stringify({ source: "twg" }), "utf8");
	const cachedExplorer = {
		edges: [],
		generatedAt: "2026-05-07T10:00:00.000Z",
		nodes: [{ id: "ari:cloud:identity::user/me", title: "Me", provider: "twg" }],
		stats: { nodeCount: 1, edgeCount: 0, danglingCount: 0, rawCount: 0, wikiCount: 0 },
	};
	fs.writeFileSync(cachePath, JSON.stringify(cachedExplorer), "utf8");
	const response = await dispatch(createPersonalGraphTestApp(), {
		url: "/api/personal-graph/explorer",
	});
	const body = await response.json();
	assert.equal(response.status, 200, JSON.stringify(body));
	assert.equal(body.generatedAt, "2026-05-07T10:00:00.000Z");
	assert.equal(body.nodes.length, 1);
});

test("GET /api/personal-graph/explorer ignores unavailable request signals for cached TWG payloads", async (t) => {
	const { sourcePath, cachePath } = configureTwgEnv(t);
	fs.writeFileSync(sourcePath, JSON.stringify({ source: "twg" }), "utf8");
	fs.writeFileSync(cachePath, JSON.stringify({
		edges: [],
		generatedAt: "2026-05-07T10:00:00.000Z",
		nodes: [{ id: "ari:cloud:identity::user/me", title: "Me", provider: "twg" }],
		stats: { nodeCount: 1, edgeCount: 0, danglingCount: 0, rawCount: 0, wikiCount: 0 },
	}), "utf8");

	const response = await dispatch(createPersonalGraphTestApp(), {
		requestSignalGetter: () => {
			throw new Error("request signal unavailable");
		},
		url: "/api/personal-graph/explorer",
	});
	const body = await response.json();

	assert.equal(response.status, 200, JSON.stringify(body));
	assert.equal(body.generatedAt, "2026-05-07T10:00:00.000Z");
	assert.equal(body.nodes.length, 1);
});

test("GET /api/personal-graph/explorer hydrates stale cached TWG artifact titles", async (t) => {
	const { sourcePath, cachePath } = configureTwgEnv(t);
	fs.writeFileSync(sourcePath, JSON.stringify({ source: "twg" }), "utf8");
	const cachedExplorer = createCachedTwgExplorer();
	cachedExplorer.nodes[0].label = "Confluence Page 1";
	cachedExplorer.nodes[0].title = "Confluence Page 1";
	fs.writeFileSync(cachePath, JSON.stringify(cachedExplorer), "utf8");

	const originalHydrate = twgSource.hydrateTwgArtifactTitles;
	twgSource.hydrateTwgArtifactTitles = async (explorer, options) => {
		assert.equal(options.limit, 32);
		return {
			...explorer,
			nodes: explorer.nodes.map((node) => ({
				...node,
				externalUrl: "https://hello.atlassian.net/wiki/spaces/ENG/pages/1/Roadmap",
				label: "Roadmap",
				title: "Roadmap",
			})),
		};
	};
	t.after(() => {
		twgSource.hydrateTwgArtifactTitles = originalHydrate;
	});

	const response = await dispatch(createPersonalGraphTestApp(), {
		url: "/api/personal-graph/explorer",
	});
	const body = await response.json();
	await new Promise((resolve) => setImmediate(resolve));
	const persisted = JSON.parse(fs.readFileSync(cachePath, "utf8"));

	assert.equal(response.status, 200, JSON.stringify(body));
	assert.equal(body.nodes[0].title, "Confluence Page 1");
	assert.equal(persisted.nodes[0].title, "Roadmap");
	assert.equal(persisted.nodes[0].externalUrl, "https://hello.atlassian.net/wiki/spaces/ENG/pages/1/Roadmap");
});

test("POST /api/personal-graph/twg/expand expands a cached TWG explorer and updates cache", async (t) => {
	const { cachePath } = configureTwgEnv(t);
	const cachedExplorer = createCachedTwgExplorer();
	fs.writeFileSync(cachePath, JSON.stringify(cachedExplorer), "utf8");
	const originalExpand = twgSource.expandTwgExplorerNode;
	twgSource.expandTwgExplorerNode = async ({ explorer, nodeId }) => {
		assert.equal(explorer.generatedAt, cachedExplorer.generatedAt);
		assert.equal(nodeId, "ari:cloud:confluence:site:page/1");
		const merged = {
			...explorer,
			edges: [
				{
					id: "mentioned-in:ari:cloud:confluence:site:page/1->ari:cloud:jira:site:issue/2",
					kind: "mentioned-in",
					label: "mentioned",
					metadata: {},
					relationKinds: ["mentioned-in"],
					source: "ari:cloud:confluence:site:page/1",
					target: "ari:cloud:jira:site:issue/2",
				},
			],
			nodes: [
				...explorer.nodes,
				{
					...explorer.nodes[0],
					frontmatter: { type: "JiraIssue" },
					id: "ari:cloud:jira:site:issue/2",
					label: "JRA-2",
					relativePath: "ari:cloud:jira:site:issue/2",
					slug: "ari%3Acloud%3Ajira%3Asite%3Aissue%2F2",
					title: "JRA-2",
				},
			],
			stats: { danglingCount: 0, edgeCount: 1, nodeCount: 2, rawCount: 0, wikiCount: 2 },
		};
		return {
			addedEdgeCount: 1,
			addedNodeCount: 1,
			expandedNodeId: nodeId,
			explorer: merged,
		};
	};
	t.after(() => {
		twgSource.expandTwgExplorerNode = originalExpand;
	});

	const response = await fetch(`${await listen(createPersonalGraphTestApp(), t)}/api/personal-graph/twg/expand`, {
		body: JSON.stringify({ nodeId: "ari:cloud:confluence:site:page/1" }),
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.expandedNodeId, "ari:cloud:confluence:site:page/1");
	assert.equal(body.addedNodeCount, 1);
	assert.equal(body.addedEdgeCount, 1);
	assert.equal(body.explorer.nodes.length, 2);
	assert.equal(JSON.parse(fs.readFileSync(cachePath, "utf8")).nodes.length, 2);
});

test("POST /api/personal-graph/twg/expand requires a cached TWG explorer", async (t) => {
	configureTwgEnv(t);
	const response = await fetch(`${await listen(createPersonalGraphTestApp(), t)}/api/personal-graph/twg/expand`, {
		body: JSON.stringify({ nodeId: "ari:cloud:confluence:site:page/1" }),
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});
	const body = await response.json();

	assert.equal(response.status, 409);
	assert.equal(body.code, "TWG_CACHE_REQUIRED");
});

test("POST /api/personal-graph/twg/refresh preserves cached explorer when refresh fails", async (t) => {
	const { cachePath } = configureTwgEnv(t);
	const cachedExplorer = createCachedTwgExplorer();
	fs.writeFileSync(cachePath, JSON.stringify(cachedExplorer), "utf8");
	const originalBuildTwgExplorer = twgSource.buildTwgExplorer;
	twgSource.buildTwgExplorer = async () => {
		throw new Error("temporary twg failure");
	};
	t.after(() => {
		twgSource.buildTwgExplorer = originalBuildTwgExplorer;
	});

	const response = await fetch(`${await listen(createPersonalGraphTestApp(), t)}/api/personal-graph/twg/refresh`, {
		body: JSON.stringify({}),
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});
	const body = await response.json();

	assert.equal(response.status, 500);
	assert.equal(body.code, "PERSONAL_GRAPH_TWG_REFRESH_FAILED");
	assert.equal(JSON.parse(fs.readFileSync(cachePath, "utf8")).generatedAt, cachedExplorer.generatedAt);
});

test("POST /api/personal-graph/twg/expand maps missing cached nodes to a client error", async (t) => {
	const { cachePath } = configureTwgEnv(t);
	fs.writeFileSync(cachePath, JSON.stringify(createCachedTwgExplorer()), "utf8");
	const originalExpand = twgSource.expandTwgExplorerNode;
	twgSource.expandTwgExplorerNode = async () => {
		const error = new Error("missing");
		error.code = "NODE_NOT_FOUND";
		throw error;
	};
	t.after(() => {
		twgSource.expandTwgExplorerNode = originalExpand;
	});

	const response = await fetch(`${await listen(createPersonalGraphTestApp(), t)}/api/personal-graph/twg/expand`, {
		body: JSON.stringify({ nodeId: "missing" }),
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});
	const body = await response.json();

	assert.equal(response.status, 400);
	assert.equal(body.code, "NODE_NOT_FOUND");
});

test("POST /api/personal-graph/twg/expand maps TWG auth and not-found errors", async (t) => {
	const { cachePath } = configureTwgEnv(t);
	fs.writeFileSync(cachePath, JSON.stringify(createCachedTwgExplorer()), "utf8");
	const originalExpand = twgSource.expandTwgExplorerNode;
	const baseUrl = await listen(createPersonalGraphTestApp(), t);
	t.after(() => {
		twgSource.expandTwgExplorerNode = originalExpand;
	});

	twgSource.expandTwgExplorerNode = async () => {
		throw new twgSource.TwgAuthError("login required");
	};
	const authResponse = await fetch(`${baseUrl}/api/personal-graph/twg/expand`, {
		body: JSON.stringify({ nodeId: "ari:cloud:confluence:site:page/1" }),
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});
	const authBody = await authResponse.json();
	assert.equal(authResponse.status, 401);
	assert.equal(authBody.error, "twg_auth_required");
	assert.equal(authBody.remediation, "Run `twg login` and retry.");

	twgSource.expandTwgExplorerNode = async () => {
		throw new twgSource.TwgNotFoundError("twg missing");
	};
	const missingResponse = await fetch(`${baseUrl}/api/personal-graph/twg/expand`, {
		body: JSON.stringify({ nodeId: "ari:cloud:confluence:site:page/1" }),
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});
	const missingBody = await missingResponse.json();
	assert.equal(missingResponse.status, 503);
	assert.equal(missingBody.error, "twg_not_found");
});

test("GET /api/personal-graph/source includes generatedAt when TWG cache is present", async (t) => {
	const { sourcePath, cachePath } = configureTwgEnv(t);
	fs.writeFileSync(sourcePath, JSON.stringify({ source: "twg" }), "utf8");
	fs.writeFileSync(cachePath, JSON.stringify({ generatedAt: "2026-05-07T10:00:00.000Z" }), "utf8");
	const response = await dispatch(createPersonalGraphTestApp(), {
		url: "/api/personal-graph/source",
	});
	const body = await response.json();
	assert.equal(body.source, "twg");
	assert.equal(body.generatedAt, "2026-05-07T10:00:00.000Z");
});

function createSummaryVault(t) {
	const vaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), "personal-graph-summary-route-"));
	configureSelectedVault(t, vaultRoot);
	setEnvValueForTest(t, "PERSONAL_GRAPH_SOURCE_PATH", path.join(vaultRoot, "source-state.json"));
	fs.mkdirSync(path.join(vaultRoot, "raw"), { recursive: true });
	fs.mkdirSync(path.join(vaultRoot, "wiki", "sources"), { recursive: true });
	fs.writeFileSync(
		path.join(vaultRoot, "raw", "source.md"),
		"---\ntitle: Raw Source\n---\n\nRaw body.",
		"utf8",
	);
	fs.writeFileSync(
		path.join(vaultRoot, "wiki", "sources", "source.md"),
		"---\ntitle: Source Page\ntype: source\nsources:\n  - raw/source.md\n---\n\n# Source Page\n\n[[entities/Thing]]",
		"utf8",
	);
	return vaultRoot;
}

async function readSseEvents(response) {
	const text = await response.text();
	return text
		.split("\n\n")
		.map((chunk) => chunk.trim())
		.filter(Boolean)
		.map((chunk) => JSON.parse(chunk.replace(/^data:\s*/u, "")));
}

test("POST /api/personal-graph/summarize requires a selected node", async (t) => {
	createSummaryVault(t);
	const baseUrl = await listen(createPersonalGraphTestApp(), t);
	const response = await fetch(`${baseUrl}/api/personal-graph/summarize`, {
		body: JSON.stringify({ action: "summary", length: "short", nodeId: "" }),
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});
	const events = await readSseEvents(response);
	assert.equal(response.status, 200);
	assert.equal(events.at(-1).type, "error");
	assert.equal(events.at(-1).code, "NODE_SELECTION_REQUIRED");
});

test("POST /api/personal-graph/summarize streams selected vault context", async (t) => {
	createSummaryVault(t);
	const originalSummarizeSelection = summaryContext.summarizeSelection;
	summaryContext.summarizeSelection = async ({ explorer, length, nodeId }) => {
		assert.equal(nodeId, "raw:source");
		assert.equal(length, "long");
		assert.ok(explorer.nodes.some((node) => node.id === "wiki:sources/source"));
		return {
			inputKind: "vault-file",
			summary: "# Vault article\n\n## What this is\nVault summary",
		};
	};
	t.after(() => {
		summaryContext.summarizeSelection = originalSummarizeSelection;
	});

	const response = await fetch(`${await listen(createPersonalGraphTestApp(), t)}/api/personal-graph/summarize`, {
		body: JSON.stringify({ action: "summary", length: "long", nodeId: "raw:source" }),
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});
	const events = await readSseEvents(response);
	assert.deepEqual(
		events.filter((event) => event.type === "stage").map((event) => event.stage),
		["validating", "enriching", "writing", "rendering"],
	);
	const summaryEvent = events.find((event) => event.type === "article");
	assert.equal(summaryEvent.articleMarkdown, "# Vault article\n\n## What this is\nVault summary");
	assert.equal(summaryEvent.cache, "miss");
	assert.equal(summaryEvent.source, "vault");
	assert.equal(typeof summaryEvent.sourceFingerprint, "string");
	assert.equal(events.at(-1).type, "done");
});

test("POST /api/personal-graph/summarize reuses cached articles and bypasses on regenerate", async (t) => {
	createSummaryVault(t);
	const originalSummarizeSelection = summaryContext.summarizeSelection;
	let callCount = 0;
	summaryContext.summarizeSelection = async () => {
		callCount += 1;
		return {
			inputKind: "vault-file",
			summary: `# Cached article ${callCount}\n\n## What this is\nCached body`,
		};
	};
	t.after(() => {
		summaryContext.summarizeSelection = originalSummarizeSelection;
	});

	const baseUrl = await listen(createPersonalGraphTestApp(), t);
	const requestBody = { action: "summary", clientId: "cache-client", length: "short", nodeId: "raw:source" };
	const firstResponse = await fetch(`${baseUrl}/api/personal-graph/summarize`, {
		body: JSON.stringify(requestBody),
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});
	const firstEvents = await readSseEvents(firstResponse);
	const secondResponse = await fetch(`${baseUrl}/api/personal-graph/summarize`, {
		body: JSON.stringify(requestBody),
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});
	const secondEvents = await readSseEvents(secondResponse);
	const bypassResponse = await fetch(`${baseUrl}/api/personal-graph/summarize`, {
		body: JSON.stringify({ ...requestBody, bypassCache: true }),
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});
	const bypassEvents = await readSseEvents(bypassResponse);

	assert.equal(firstEvents.find((event) => event.type === "article").cache, "miss");
	assert.equal(secondEvents.find((event) => event.type === "article").cache, "hit");
	assert.equal(secondEvents.find((event) => event.type === "article").articleMarkdown, "# Cached article 1\n\n## What this is\nCached body");
	assert.equal(bypassEvents.find((event) => event.type === "article").cache, "bypass");
	assert.equal(bypassEvents.find((event) => event.type === "article").articleMarkdown, "# Cached article 2\n\n## What this is\nCached body");
	assert.equal(callCount, 2);
});

test("POST /api/personal-graph/summarize bounds cached article entries", async (t) => {
	createSummaryVault(t);
	setEnvValueForTest(t, "PERSONAL_GRAPH_SUMMARY_ARTICLE_CACHE_MAX_ENTRIES", "2");
	const originalCreateSourceFingerprint = summaryContext.createSourceFingerprint;
	const originalSummarizeSelection = summaryContext.summarizeSelection;
	const fingerprints = ["article-a", "article-b", "article-c", "article-a"];
	let callCount = 0;
	summaryContext.createSourceFingerprint = () => fingerprints.shift() ?? "article-a";
	summaryContext.summarizeSelection = async () => {
		callCount += 1;
		return {
			inputKind: "vault-file",
			summary: `# Bounded article ${callCount}\n\n## What this is\nBounded body`,
		};
	};
	t.after(() => {
		summaryContext.createSourceFingerprint = originalCreateSourceFingerprint;
		summaryContext.summarizeSelection = originalSummarizeSelection;
	});

	const baseUrl = await listen(createPersonalGraphTestApp(), t);
	const requestBody = { action: "summary", clientId: "bounded-cache-client", length: "short", nodeId: "raw:source" };
	const firstResponse = await fetch(`${baseUrl}/api/personal-graph/summarize`, {
		body: JSON.stringify(requestBody),
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});
	const secondResponse = await fetch(`${baseUrl}/api/personal-graph/summarize`, {
		body: JSON.stringify(requestBody),
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});
	const thirdResponse = await fetch(`${baseUrl}/api/personal-graph/summarize`, {
		body: JSON.stringify(requestBody),
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});
	const repeatedFirstResponse = await fetch(`${baseUrl}/api/personal-graph/summarize`, {
		body: JSON.stringify(requestBody),
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});

	await readSseEvents(firstResponse);
	await readSseEvents(secondResponse);
	await readSseEvents(thirdResponse);
	const repeatedFirstEvents = await readSseEvents(repeatedFirstResponse);

	assert.equal(repeatedFirstEvents.find((event) => event.type === "article").cache, "miss");
	assert.equal(repeatedFirstEvents.find((event) => event.type === "article").articleMarkdown, "# Bounded article 4\n\n## What this is\nBounded body");
	assert.equal(callCount, 4);
});

test("POST /api/personal-graph/summarize uses cached TWG explorer without refreshing", async (t) => {
	const { sourcePath, cachePath } = configureTwgEnv(t);
	fs.writeFileSync(sourcePath, JSON.stringify({ source: "twg" }), "utf8");
	fs.writeFileSync(cachePath, JSON.stringify({
		edges: [{ id: "edge:me->page", kind: "worked-on", label: "worked on", metadata: {}, relationKinds: ["worked-on"], source: "me", target: "page" }],
		generatedAt: "2026-05-07T10:00:00.000Z",
		nodes: [
			{ bodyPreview: "", connectionCount: 1, dangling: false, externalUrl: null, frontmatter: {}, id: "me", kind: "entity", label: "Me", missing: false, path: null, provider: "twg", relativePath: "me", size: 1, slug: "me", title: "Me", updatedAt: null },
			{ bodyPreview: "Page", connectionCount: 1, dangling: false, externalUrl: "https://example.com", frontmatter: {}, id: "page", kind: "source", label: "Page", missing: false, path: null, provider: "twg", relativePath: "page", size: 1, slug: "page", title: "Page", updatedAt: null },
		],
		stats: { danglingCount: 0, edgeCount: 1, nodeCount: 2, rawCount: 0, wikiCount: 1 },
	}), "utf8");
	const originalSummarizeSelection = summaryContext.summarizeSelection;
	summaryContext.summarizeSelection = async ({ explorer, nodeId }) => {
		assert.equal(nodeId, "page");
		assert.equal(explorer.generatedAt, "2026-05-07T10:00:00.000Z");
		return {
			inputKind: "context-file",
			summary: "# TWG article\n\n## What this is\nTWG summary",
		};
	};
	t.after(() => {
		summaryContext.summarizeSelection = originalSummarizeSelection;
	});

	const response = await fetch(`${await listen(createPersonalGraphTestApp(), t)}/api/personal-graph/summarize`, {
		body: JSON.stringify({ action: "summary", length: "medium", nodeId: "page" }),
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});
	const events = await readSseEvents(response);
	const articleEvent = events.find((event) => event.type === "article");
	assert.equal(articleEvent.articleMarkdown, "# TWG article\n\n## What this is\nTWG summary");
	assert.equal(articleEvent.workWindow, "7d");
});

test("POST /api/personal-graph/summarize blocks TWG generation until setup exists", async (t) => {
	const { sourcePath } = configureTwgEnv(t);
	fs.writeFileSync(sourcePath, JSON.stringify({ source: "twg" }), "utf8");
	const originalSummarizeSelection = summaryContext.summarizeSelection;
	let didSummarize = false;
	summaryContext.summarizeSelection = async () => {
		didSummarize = true;
		return { inputKind: "context-file", summary: "Should not run" };
	};
	t.after(() => {
		summaryContext.summarizeSelection = originalSummarizeSelection;
	});

	const response = await fetch(`${await listen(createPersonalGraphTestApp(), t)}/api/personal-graph/summarize`, {
		body: JSON.stringify({ action: "summary", length: "medium", nodeId: "page" }),
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});
	const events = await readSseEvents(response);
	const errorEvent = events.find((event) => event.type === "error");

	assert.equal(errorEvent.code, "TWG_CACHE_REQUIRED");
	assert.match(errorEvent.error, /twg login/u);
	assert.equal(didSummarize, false);
});

test("POST /api/personal-graph/summarize degrades TWG expansion failures to limited context notice", async (t) => {
	const { sourcePath, cachePath } = configureTwgEnv(t);
	fs.writeFileSync(sourcePath, JSON.stringify({ source: "twg" }), "utf8");
	fs.writeFileSync(cachePath, JSON.stringify({
		edges: [{ id: "edge:me->page", kind: "worked-on", label: "worked on", metadata: {}, relationKinds: ["worked-on"], source: "me", target: "page" }],
		generatedAt: "2026-05-07T10:00:00.000Z",
		nodes: [
			{ bodyPreview: "", connectionCount: 1, dangling: false, externalUrl: null, frontmatter: {}, id: "me", kind: "entity", label: "Me", missing: false, path: null, provider: "twg", relativePath: "me", size: 1, slug: "me", title: "Me", updatedAt: null },
			{ bodyPreview: "Page", connectionCount: 1, dangling: false, externalUrl: "https://example.com", frontmatter: {}, id: "page", kind: "source", label: "Page", missing: false, path: null, provider: "twg", relativePath: "page", size: 1, slug: "page", title: "Page", updatedAt: null },
		],
		stats: { danglingCount: 0, edgeCount: 1, nodeCount: 2, rawCount: 0, wikiCount: 1 },
	}), "utf8");
	const originalExpand = twgSource.expandTwgExplorerNode;
	const originalSummarizeSelection = summaryContext.summarizeSelection;
	twgSource.expandTwgExplorerNode = async () => {
		throw new twgSource.TwgAuthError("login required");
	};
	summaryContext.summarizeSelection = async () => ({
		inputKind: "context-file",
		summary: "# Limited TWG article\n\n## What this is\nLimited context",
	});
	t.after(() => {
		twgSource.expandTwgExplorerNode = originalExpand;
		summaryContext.summarizeSelection = originalSummarizeSelection;
	});

	const response = await fetch(`${await listen(createPersonalGraphTestApp(), t)}/api/personal-graph/summarize`, {
		body: JSON.stringify({ action: "summary", length: "medium", nodeId: "page", workWindow: "14d" }),
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});
	const events = await readSseEvents(response);
	const articleEvent = events.find((event) => event.type === "article");

	assert.equal(articleEvent.sourceNotice, "Selected Team Work Graph expansion was unavailable, so this article uses the cached one-hop context.");
	assert.equal(articleEvent.workWindow, "14d");
	assert.equal(articleEvent.articleMarkdown, "# Limited TWG article\n\n## What this is\nLimited context");
});

test("POST /api/personal-graph/summarize aborts the previous in-flight run for the same client", async (t) => {
	createSummaryVault(t);
	let firstStarted;
	const firstStartedPromise = new Promise((resolve) => {
		firstStarted = resolve;
	});
	let firstAborted = false;
	const originalSummarizeSelection = summaryContext.summarizeSelection;
	let callCount = 0;
	summaryContext.summarizeSelection = async ({ signal }) => {
		callCount += 1;
		if (callCount === 1) {
			firstStarted();
			await new Promise((resolve) => {
				signal.addEventListener("abort", () => {
					firstAborted = true;
					resolve();
				}, { once: true });
			});
			const error = new Error("aborted");
			error.code = "SUMMARIZE_ABORTED";
			throw error;
		}
		return {
			inputKind: "vault-file",
			summary: "# Latest article\n\n## What this is\nLatest summary",
		};
	};
	t.after(() => {
		summaryContext.summarizeSelection = originalSummarizeSelection;
	});

	const baseUrl = await listen(createPersonalGraphTestApp(), t);
	const firstResponsePromise = fetch(`${baseUrl}/api/personal-graph/summarize`, {
		body: JSON.stringify({ action: "summary", bypassCache: true, clientId: "summary-client-a", length: "short", nodeId: "raw:source" }),
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});
	await firstStartedPromise;
	const secondResponse = await fetch(`${baseUrl}/api/personal-graph/summarize`, {
		body: JSON.stringify({ action: "summary", bypassCache: true, clientId: "summary-client-a", length: "medium", nodeId: "raw:source" }),
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});
	const secondEvents = await readSseEvents(secondResponse);
	const firstResponse = await firstResponsePromise;
	await readSseEvents(firstResponse);

	assert.equal(firstAborted, true);
	assert.equal(secondEvents.find((event) => event.type === "article").articleMarkdown, "# Latest article\n\n## What this is\nLatest summary");
});

test("POST /api/personal-graph/summarize keeps other clients' in-flight runs alive", async (t) => {
	createSummaryVault(t);
	let firstStarted;
	const firstStartedPromise = new Promise((resolve) => {
		firstStarted = resolve;
	});
	let releaseFirst;
	const releaseFirstPromise = new Promise((resolve) => {
		releaseFirst = resolve;
	});
	let firstAborted = false;
	const originalSummarizeSelection = summaryContext.summarizeSelection;
	let callCount = 0;
	summaryContext.summarizeSelection = async ({ signal }) => {
		callCount += 1;
		if (callCount === 1) {
			firstStarted();
			signal.addEventListener("abort", () => {
				firstAborted = true;
				releaseFirst();
			}, { once: true });
			await releaseFirstPromise;
			return {
				inputKind: "vault-file",
				summary: "# First article\n\n## What this is\nFirst summary",
			};
		}
		return {
			inputKind: "vault-file",
			summary: "# Second article\n\n## What this is\nSecond summary",
		};
	};
	t.after(() => {
		summaryContext.summarizeSelection = originalSummarizeSelection;
	});

	const baseUrl = await listen(createPersonalGraphTestApp(), t);
	const firstResponsePromise = fetch(`${baseUrl}/api/personal-graph/summarize`, {
		body: JSON.stringify({ action: "summary", bypassCache: true, clientId: "summary-client-a", length: "short", nodeId: "raw:source" }),
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});
	await firstStartedPromise;
	const secondResponse = await fetch(`${baseUrl}/api/personal-graph/summarize`, {
		body: JSON.stringify({ action: "summary", bypassCache: true, clientId: "summary-client-b", length: "medium", nodeId: "raw:source" }),
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});
	const secondEvents = await readSseEvents(secondResponse);
	assert.equal(firstAborted, false);
	assert.equal(secondEvents.find((event) => event.type === "article").articleMarkdown, "# Second article\n\n## What this is\nSecond summary");

	releaseFirst();
	const firstEvents = await readSseEvents(await firstResponsePromise);
	assert.equal(firstEvents.find((event) => event.type === "article").articleMarkdown, "# First article\n\n## What this is\nFirst summary");
});
