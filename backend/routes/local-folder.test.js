"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const { createLocalFolderRouter, isLocalRequest } = require("./local-folder");

test("local folder chooser allows only local macOS development requests", () => {
	const request = (origin, address = "127.0.0.1", hostname = "127.0.0.1") => ({ socket: { remoteAddress: address }, hostname, get: () => origin });
	const local = request("https://3a26.localhost");
	assert.equal(isLocalRequest(local, { env: {}, platform: "darwin" }), true);
	assert.equal(isLocalRequest(local, { env: { NODE_ENV: "production" }, platform: "darwin" }), false);
	assert.equal(isLocalRequest(local, { env: {}, platform: "linux" }), false);
	assert.equal(isLocalRequest(request("https://example.com"), { env: {}, platform: "darwin" }), false);
	assert.equal(isLocalRequest(request("https://3a26.localhost", "192.0.2.1"), { env: {}, platform: "darwin" }), false);
	assert.equal(isLocalRequest(request("https://3a26.localhost", "127.0.0.1", "evil.example"), { env: {}, platform: "darwin" }), false);
	assert.equal(isLocalRequest(request(undefined), { env: {}, platform: "darwin" }), false);
});

test("chooser returns the selected path and preserves cancellation without opening for untrusted requests", async (t) => {
	let calls = 0;
	const app = express();
	app.use("/api/local-folder", createLocalFolderRouter({ env: {}, platform: "darwin", choose: async () => {
		calls += 1;
		if (calls === 2) throw Object.assign(new Error("cancelled"), { code: "VAULT_SELECTION_CANCELLED" });
		return "/Users/example/my workspace/";
	} }));
	const server = app.listen(0, "127.0.0.1");
	await new Promise((resolve) => server.once("listening", resolve));
	t.after(() => server.close());
	const url = `http://127.0.0.1:${server.address().port}/api/local-folder`;
	const post = (origin) => fetch(url, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: "{}" });
	assert.equal((await post("https://example.com")).status, 403);
	assert.equal(calls, 0);
	const response = await post("https://3a26.localhost");
	assert.equal(response.headers.get("access-control-allow-origin"), "https://3a26.localhost");
	assert.deepEqual(await response.json(), { path: "/Users/example/my workspace/" });
	assert.deepEqual(await (await post("https://3a26.localhost")).json(), { path: null });
});
