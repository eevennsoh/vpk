const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");
const WebSocket = require("ws");

async function verify(t, { token = "secret-fixture-token", rejectUpgrade = false } = {}, args = []) {
	const requests = [];
	const server = http.createServer((req, res) => {
		requests.push({ path: req.url, origin: req.headers.origin });
		res.setHeader("Content-Type", "application/json");
		if (req.url === "/api/realtime/ws-url") {
			res.end(JSON.stringify({ wsUrl: `ws://127.0.0.1:${server.address().port}` }));
		} else if (req.url === "/api/realtime/audio-conversation-token") {
			res.end(JSON.stringify({ token, expiresInMs: token ? 60000 : 0 }));
		} else {
			res.statusCode = 404;
			res.end("{}");
		}
	});
	const wss = new WebSocket.Server({ noServer: true });
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const baseUrl = `http://127.0.0.1:${server.address().port}`;
	server.on("upgrade", (req, socket, head) => {
		requests.push({ path: req.url, origin: req.headers.origin });
		const actualToken = new URL(req.url, baseUrl).searchParams.get("realtimeToken");
		if (rejectUpgrade || req.headers.origin !== baseUrl || actualToken !== token) {
			socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
			socket.destroy();
			return;
		}
		wss.handleUpgrade(req, socket, head, (ws) => {
			wss.emit("connection", ws);
		});
	});
	t.after(() => {
		for (const client of wss.clients) client.terminate();
		wss.close();
		server.closeAllConnections();
		return new Promise((resolve) => server.close(resolve));
	});
	const child = spawn(process.execPath, [path.join(__dirname, "verify-wss.mjs"), baseUrl, ...args]);
	const deadline = setTimeout(() => child.kill(), 8000);
	t.after(() => clearTimeout(deadline));
	let output = "";
	child.stdout.on("data", (data) => { output += data; });
	child.stderr.on("data", (data) => { output += data; });
	const status = await new Promise((resolve, reject) => {
		child.on("error", reject);
		child.on("close", resolve);
	});
	return { status, output, requests, baseUrl };
}

test("scoped token upgrades and closes without exposing the token", async (t) => {
	const result = await verify(t);
	assert.equal(result.status, 0, result.output);
	assert.match(result.output, /Authenticated WebSocket upgrade: 101/u);
	assert.doesNotMatch(result.output, /secret-fixture-token/u);
	const upgrade = result.requests.find((request) => request.path.startsWith("/api/realtime/audio-conversation?"));
	assert.equal(upgrade.origin, result.baseUrl);
});

test("localhost discovery permits a tokenless development upgrade", async (t) => {
	const result = await verify(t, { token: null }, ["--discovery", "--allow-tokenless-dev"]);
	assert.equal(result.status, 0, result.output);
	assert.match(result.output, /WebSocket discovery: 200/u);
	assert.match(result.output, /Development WebSocket upgrade: 101/u);
});

test("a missing scoped token fails outside tokenless development mode", async (t) => {
	const result = await verify(t, { token: null });
	assert.equal(result.status, 1, result.output);
	assert.match(result.output, /Scoped socket token unavailable/u);
	assert.ok(!result.requests.some((request) => request.path.startsWith("/api/realtime/audio-conversation?")));
});

test("a rejected upgrade reports the HTTP status without logging the token", async (t) => {
	const result = await verify(t, { rejectUpgrade: true });
	assert.equal(result.status, 1, result.output);
	assert.match(result.output, /WebSocket upgrade HTTP 403/u);
	assert.doesNotMatch(result.output, /secret-fixture-token/u);
});
