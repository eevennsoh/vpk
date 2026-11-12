"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const express = require("express");
const test = require("node:test");
const {
	registerPersonalGraphRoutes,
} = require("./personal-graph");

function createPersonalGraphTestApp() {
	const app = express();
	app.use(express.json());
	registerPersonalGraphRoutes(app, { env: { NODE_ENV: "development" } });
	return app;
}

async function listen(app, t) {
	const server = app.listen(0, "127.0.0.1");
	t.after(() => new Promise((resolve) => server.close(resolve)));
	await new Promise((resolve, reject) => {
		server.once("listening", resolve);
		server.once("error", reject);
	});
	return `http://127.0.0.1:${server.address().port}`;
}

function setEnvForTest(t, key, value) {
	const original = process.env[key];
	if (value === undefined) delete process.env[key];
	else process.env[key] = value;
	t.after(() => {
		if (original === undefined) delete process.env[key];
		else process.env[key] = original;
	});
}

function configureSelectedVault(t, vaultRoot) {
	const configPath = path.join(os.tmpdir(), `personal-graph-local-only-${process.pid}-${Date.now()}.json`);
	setEnvForTest(t, "PERSONAL_GRAPH_VAULT", undefined);
	setEnvForTest(t, "PERSONAL_GRAPH_SELECTED_VAULT", vaultRoot);
	setEnvForTest(t, "PERSONAL_GRAPH_VAULT_CONFIG_PATH", configPath);
	setEnvForTest(t, "PERSONAL_GRAPH_SOURCE_PATH", path.join(vaultRoot, "source-state.json"));
	t.after(() => {
		fs.rmSync(configPath, { force: true });
		fs.rmSync(vaultRoot, { force: true, recursive: true });
	});
}

function postWithHeaders(baseUrl, routePath, headers, { body = "{}", method = "POST" } = {}) {
	const url = new URL(routePath, baseUrl);
	return new Promise((resolve, reject) => {
		const req = http.request({
			headers: { "Content-Type": "application/json", ...headers },
			host: url.hostname,
			method,
			path: url.pathname,
			port: url.port,
		}, (res) => {
			let text = "";
			res.setEncoding("utf8");
			res.on("data", (chunk) => { text += chunk; });
			res.on("end", () => resolve({ status: res.statusCode, text }));
		});
		req.on("error", reject);
		req.end(body);
	});
}

test("Personal Graph writes refuse non-local requests while reads stay open", async (t) => {
	const vaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), "personal-graph-local-only-"));
	fs.mkdirSync(path.join(vaultRoot, "raw"), { recursive: true });
	fs.mkdirSync(path.join(vaultRoot, "wiki"), { recursive: true });
	configureSelectedVault(t, vaultRoot);
	const baseUrl = await listen(createPersonalGraphTestApp(), t);

	for (const [routePath, body] of [
		["/api/personal-graph/capture", { url: "https://example.com" }],
		["/api/personal-graph/source", { source: "twg" }],
		["/api/personal-graph/vault/reset", {}],
	]) {
		for (const headers of [{ Host: "rebound.example" }, { Origin: "https://evil.example" }]) {
			const response = await postWithHeaders(baseUrl, routePath, headers, { body: JSON.stringify(body) });
			assert.equal(response.status, 403, `${routePath} ${JSON.stringify(headers)}`);
		}
	}
	const pageWrite = await postWithHeaders(baseUrl, "/api/personal-graph/page/notes/intro", { Host: "rebound.example" }, {
		body: JSON.stringify({ content: "x" }),
		method: "PUT",
	});
	assert.equal(pageWrite.status, 403);
	assert.equal(fs.existsSync(path.join(vaultRoot, "wiki", "notes")), false);

	const read = await fetch(`${baseUrl}/api/personal-graph/vault`);
	assert.equal(read.status, 200);
});

test("POST /api/personal-graph/capture rejects loopback and link-local targets", async (t) => {
	const vaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), "personal-graph-capture-route-"));
	fs.mkdirSync(path.join(vaultRoot, "raw"), { recursive: true });
	fs.mkdirSync(path.join(vaultRoot, "wiki"), { recursive: true });
	configureSelectedVault(t, vaultRoot);
	const baseUrl = await listen(createPersonalGraphTestApp(), t);

	for (const url of ["http://127.0.0.1:8080/api/status", "http://169.254.169.254/latest/meta-data/", "http://localhost/"]) {
		const response = await fetch(`${baseUrl}/api/personal-graph/capture`, {
			body: JSON.stringify({ url }),
			headers: { "Content-Type": "application/json" },
			method: "POST",
		});
		assert.equal(response.status, 400, url);
		assert.equal((await response.json()).code, "INVALID_URL");
	}
});
