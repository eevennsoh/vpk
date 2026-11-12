"use strict";

const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
	registerHtmlSelectorRoutes,
} = require("./html-selector");

async function withServer(dependencies, run) {
	const app = express();
	app.use(express.json({ limit: "1mb" }));
	registerHtmlSelectorRoutes(app, dependencies);

	const server = http.createServer(app);
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	const baseUrl = `http://127.0.0.1:${address.port}`;

	try {
		await run(baseUrl);
	} finally {
		await new Promise((resolve, reject) => {
			server.close((error) => {
				if (error) {
					reject(error);
					return;
				}
				resolve();
			});
		});
	}
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

test("html-selector dispatch refuses non-local requests before launching an agent", async () => {
	const execCalls = [];
	const dependencies = {
		env: { NODE_ENV: "development" },
		execFileImpl: (...args) => { execCalls.push(args); args.at(-1)(null, "", ""); },
	};
	await withServer(dependencies, async (baseUrl) => {
		const body = JSON.stringify({ agent: "rovo", prompt: "hello" });
		const rebound = await postWithHeaders(baseUrl, "/api/html-selector/dispatch", { Host: "rebound.example" }, { body });
		const crossSite = await postWithHeaders(baseUrl, "/api/html-selector/dispatch", { Origin: "https://evil.example" }, { body });
		assert.equal(rebound.status, 403);
		assert.equal(crossSite.status, 403);
	});
	assert.equal(execCalls.length, 0);
});

test("html-selector dispatch is not available in production", async () => {
	await withServer({ env: { NODE_ENV: "production" } }, async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/html-selector/dispatch`, {
			body: JSON.stringify({ agent: "codex", prompt: "hello" }),
			headers: { "Content-Type": "application/json" },
			method: "POST",
		});

		assert.equal(response.status, 404);
		assert.deepEqual(await response.json(), { error: "Not available" });
	});
});

test("html-selector dispatch rejects unknown agents and invalid prompts", async () => {
	await withServer({ env: { NODE_ENV: "development" } }, async (baseUrl) => {
		const unknownAgent = await fetch(`${baseUrl}/api/html-selector/dispatch`, {
			body: JSON.stringify({ agent: "vim", prompt: "hello" }),
			headers: { "Content-Type": "application/json" },
			method: "POST",
		});
		const emptyPrompt = await fetch(`${baseUrl}/api/html-selector/dispatch`, {
			body: JSON.stringify({ agent: "codex", prompt: " " }),
			headers: { "Content-Type": "application/json" },
			method: "POST",
		});
		const oversizedPrompt = await fetch(`${baseUrl}/api/html-selector/dispatch`, {
			body: JSON.stringify({ agent: "codex", prompt: "x".repeat(64 * 1024 + 1) }),
			headers: { "Content-Type": "application/json" },
			method: "POST",
		});

		assert.equal(unknownAgent.status, 400);
		assert.deepEqual(await unknownAgent.json(), { error: "Unknown agent" });
		assert.equal(emptyPrompt.status, 400);
		assert.deepEqual(await emptyPrompt.json(), { error: "Prompt is required" });
		assert.equal(oversizedPrompt.status, 400);
		assert.deepEqual(await oversizedPrompt.json(), { error: "Prompt exceeds 64KB" });
	});
});

test("html-selector dispatch writes prompt to a temp file and opens a tmux window without argv interpolation", async (t) => {
	const execCalls = [];
	const writes = [];
	const tempDirs = [];
	const prompt = "Change the <h1> safely; do not shell me $(rm -rf /).";
	const repoRoot = path.resolve(__dirname, "..", "..");
	const fsImpl = {
		mkdtempSync(prefix) {
			const dir = fs.mkdtempSync(prefix);
			tempDirs.push(dir);
			return dir;
		},
		writeFileSync(filePath, contents, encoding) {
			writes.push({ contents, encoding, filePath });
			fs.writeFileSync(filePath, contents, encoding);
		},
		readFileSync: fs.readFileSync,
	};

	t.after(() => {
		for (const dir of tempDirs) {
			fs.rmSync(dir, { force: true, recursive: true });
		}
	});

	const execFileImpl = (file, args, callback) => {
		execCalls.push({ args, file });
		if (args[0] === "has-session") {
			callback(new Error("missing session"));
			return;
		}
		callback(null, "", "");
	};

	await withServer({
		env: { NODE_ENV: "development", ROVO_TMUX_SESSION: "vpk-dev-test" },
		execFileImpl,
		fsImpl,
		now: () => new Date(2026, 6, 11, 12, 34, 56),
	}, async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/html-selector/dispatch`, {
			body: JSON.stringify({ agent: "codex", prompt }),
			headers: { "Content-Type": "application/json" },
			method: "POST",
		});

		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), {
			ok: true,
			agent: "codex",
			sessionName: "vpk-dev-test",
			windowName: "hs-codex-123456",
		});
	});

	assert.equal(writes.length, 1);
	assert.equal(writes[0].contents, prompt);
	assert.equal(writes[0].encoding, "utf8");
	assert.equal(path.basename(writes[0].filePath), "prompt.txt");
	assert.equal(fs.readFileSync(writes[0].filePath, "utf8"), prompt);

	assert.deepEqual(execCalls.slice(0, 2), [
		{ file: "tmux", args: ["has-session", "-t", "vpk-dev-test"] },
		{
			file: "tmux",
			args: ["new-session", "-d", "-s", "vpk-dev-test", "-n", "agents", "-c", repoRoot],
		},
	]);

	assert.equal(execCalls[2].file, "tmux");
	assert.deepEqual(execCalls[2].args, [
		"new-window",
		"-P",
		"-F",
		"#{window_id}",
		"-t",
		"vpk-dev-test:",
		"-n",
		"hs-codex-123456",
		"-c",
		repoRoot,
	]);
	assert.equal(execCalls[3].file, "tmux");
	assert.deepEqual(execCalls[3].args.slice(0, 3), ["send-keys", "-t", "vpk-dev-test:hs-codex-123456"]);
	assert.match(execCalls[3].args[3], /^cd '.*' && codex-gw -- "\$\(cat '.*prompt\.txt'\)"$/u);
	assert.equal(execCalls[3].args[4], "Enter");
	for (const call of execCalls) {
		assert.doesNotMatch(JSON.stringify(call.args), /Change the <h1>/u);
		assert.doesNotMatch(JSON.stringify(call.args), /\$\(rm -rf/u);
	}
});

test("html-selector tokens route is dev-only", async (t) => {
	const tokenRoot = fs.mkdtempSync(path.join(os.tmpdir(), "html-selector-tokens-"));
	t.after(() => {
		fs.rmSync(tokenRoot, { force: true, recursive: true });
	});

	const fsImpl = {
		mkdtempSync: fs.mkdtempSync,
		writeFileSync: fs.writeFileSync,
		readFileSync(filePath) {
			assert.match(filePath, /\.agents\/skills\/vpk-html\/references\/tokens\.json$/u);
			return JSON.stringify({ color: { brand: "#0c66e4" } }, null, 2);
		},
	};

	await withServer({ env: { NODE_ENV: "development" }, fsImpl }, async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/html-selector/tokens`);
		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), { color: { brand: "#0c66e4" } });
	});
	await withServer({ env: { NODE_ENV: "production" }, fsImpl }, async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/html-selector/tokens`);
		assert.equal(response.status, 404);
		assert.deepEqual(await response.json(), { error: "Not available" });
	});
});
