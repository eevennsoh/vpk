const assert = require("node:assert/strict");
const net = require("node:net");
const test = require("node:test");

const { listListenerCwds, listenerOwnership, probePortAlive } = require("./port-liveness");

function listenOnEphemeralPort() {
	return new Promise((resolve, reject) => {
		const server = net.createServer();
		server.unref();
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (!address || typeof address === "string") {
				server.close();
				reject(new Error("Failed to bind ephemeral port"));
				return;
			}
			resolve({ server, port: address.port });
		});
	});
}

function closeServer(server) {
	return new Promise((resolve) => {
		server.close(() => resolve());
	});
}

test("probePortAlive returns true when a listener accepts connections", async () => {
	const { server, port } = await listenOnEphemeralPort();
	try {
		assert.equal(await probePortAlive(port), true);
		assert.equal(await probePortAlive(String(port)), true);
	} finally {
		await closeServer(server);
	}
});

test("probePortAlive returns false when nothing is listening", async () => {
	const { server, port } = await listenOnEphemeralPort();
	await closeServer(server);
	assert.equal(await probePortAlive(port), false);
});

test("probePortAlive returns false for invalid inputs", async () => {
	assert.equal(await probePortAlive(null), false);
	assert.equal(await probePortAlive(undefined), false);
	assert.equal(await probePortAlive(0), false);
	assert.equal(await probePortAlive(-1), false);
	assert.equal(await probePortAlive("not-a-port"), false);
});

test("probePortAlive honors the configured timeout", async () => {
	// 10.255.255.1 is a non-routable address that will hang instead of
	// returning ECONNREFUSED — perfect for timeout testing. Skip if the
	// test environment routes it differently (CI may be stricter).
	const start = Date.now();
	const alive = await probePortAlive(80, { host: "10.255.255.1", timeoutMs: 100 });
	const elapsed = Date.now() - start;
	assert.equal(alive, false);
	assert.ok(elapsed < 1000, `probe should give up quickly; took ${elapsed}ms`);
});

test("listListenerCwds maps each listening port to its processes' cwds in two lsof calls", () => {
	const calls = [];
	const spawnSyncImpl = (command, args) => {
		calls.push([command, ...args].join(" "));
		if (args.includes("-iTCP")) return { stdout: "p101\nn127.0.0.1:9740\np202\nn*:3000\nn[::1]:3000\np303\nn127.0.0.1:9780\n" };
		return { stdout: "p101\nfcwd\nn/wt/smfe14\np202\nfcwd\nn/wt/own\n" };
	};
	const owners = listListenerCwds({ spawnSyncImpl });
	assert.equal(calls.length, 2);
	assert.match(calls[1], /-p 101,202,303/);
	assert.deepEqual([...owners.get(9740)], ["/wt/smfe14"]);
	assert.deepEqual([...owners.get(3000)], ["/wt/own"]);
	assert.equal(owners.has(9780), false, "a listener whose cwd is unreadable is not listed");
	assert.equal(listenerOwnership(owners, 3000, "/wt/own"), true);
	assert.equal(listenerOwnership(owners, 9740, "/wt/own"), false);
	assert.equal(listenerOwnership(owners, 9780, "/wt/own"), null);
	assert.equal(listListenerCwds({ spawnSyncImpl: () => ({ error: new Error("ENOENT") }) }), null);
});
