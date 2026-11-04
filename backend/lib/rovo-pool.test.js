const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const { createRovoPool } = require("./rovo-pool");

function listen(server) {
	return new Promise((resolve, reject) => {
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (!address || typeof address !== "object") {
				reject(new Error("Failed to read test server address"));
				return;
			}
			resolve(address.port);
		});
	});
}

function close(server) {
	return new Promise((resolve, reject) => {
		server.close((error) => {
			if (error) {
				reject(error);
				return;
			}
			resolve();
		});
	});
}

test("acquire returns first available port when no preference is supplied", async () => {
	const pool = createRovoPool([8000, 8001, 8002], {
		healthCheckIntervalMs: 0,
	});

	const handle = await pool.acquire();
	assert.equal(handle.port, 8000);

	handle.release();
	pool.shutdown();
});

test("acquire prefers the requested sticky port when it is available", async () => {
	const pool = createRovoPool([8000, 8001, 8002], {
		healthCheckIntervalMs: 0,
	});

	const handle = await pool.acquire({ preferredPort: 8002 });
	assert.equal(handle.port, 8002);

	handle.release();
	pool.shutdown();
});

test("acquire skips avoided ports when alternatives are available", async () => {
	const pool = createRovoPool([8000, 8001, 8002], {
		healthCheckIntervalMs: 0,
	});

	const handle = await pool.acquire({ avoidPorts: [8000, 8001] });
	assert.equal(handle.port, 8002);

	handle.release();
	pool.shutdown();
});

test("busy lease survives multiple health checks until explicitly released", async () => {
	const pool = createRovoPool([19000], {
		healthCheckIntervalMs: 25,
	});

	const handle = await pool.acquire();
	assert.equal(handle.port, 19000);

	await new Promise((resolve) => setTimeout(resolve, 125));

	let status = pool.getStatus();
	const busyEntry = status.ports[0];
	assert.equal(status.busy, 1, "busy lease should remain leased across health checks");
	assert.equal(status.available, 0);
	assert.equal(status.unhealthy, 0);
	assert.equal(busyEntry.status, "busy");
	assert.equal(busyEntry.acquiredAt != null, true);

	handle.release();

	status = pool.getStatus();
	const releasedEntry = status.ports[0];
	assert.equal(status.available, 1);
	assert.equal(status.busy, 0);
	assert.equal(status.unhealthy, 0);
	assert.equal(releasedEntry.status, "available");
	assert.equal(releasedEntry.acquiredAt, null);

	pool.shutdown();
});

test("acquire times out with ROVO_BUSY code when all ports busy", async () => {
	const pool = createRovoPool([19000], {
		healthCheckIntervalMs: 0,
	});

	const handle = await pool.acquire();
	assert.equal(handle.port, 19000);

	await assert.rejects(
		() => pool.acquire({ timeoutMs: 50 }),
		(err) => {
			assert.equal(err.code, "ROVO_BUSY");
			return true;
		}
	);

	handle.release();
	pool.shutdown();
});

test("releaseAsUnhealthy quarantines a failed port while other ports remain available", async () => {
	const serverA = http.createServer((_req, res) => {
		setTimeout(() => {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ status: "healthy" }));
		}, 250);
	});
	const serverB = http.createServer((_req, res) => {
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ status: "healthy" }));
	});

	const portA = await listen(serverA);
	const portB = await listen(serverB);
	const pool = createRovoPool([portA, portB], {
		healthCheckIntervalMs: 25,
		unhealthyQuarantineMs: 100,
	});

	try {
		const firstHandle = await pool.acquire({ preferredPort: portA });
		assert.equal(firstHandle.port, portA);
		firstHandle.releaseAsUnhealthy();

		const fallbackHandle = await pool.acquire({ preferredPort: portA });
		assert.equal(fallbackHandle.port, portB);
		fallbackHandle.release();

		const deadline = Date.now() + 5000;
		while (pool.getStatus().ports.find((entry) => entry.port === portA)?.status !== "available" && Date.now() < deadline) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}
		assert.equal(pool.getStatus().ports.find((entry) => entry.port === portA)?.status, "available");

		const recoveredHandle = await pool.acquire({ preferredPort: portA });
		assert.equal(recoveredHandle.port, portA);
		recoveredHandle.release();
	} finally {
		pool.shutdown();
		await close(serverA);
		await close(serverB);
	}
});

test("releaseAsUnhealthy does not deadlock a single-port pool", async () => {
	const server = http.createServer((_req, res) => {
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ status: "healthy" }));
	});
	const port = await listen(server);
	const pool = createRovoPool([port], {
		healthCheckIntervalMs: 25,
	});

	try {
		const firstHandle = await pool.acquire();
		assert.equal(firstHandle.port, port);
		firstHandle.releaseAsUnhealthy();

		await new Promise((resolve) => setTimeout(resolve, 50));

		const secondHandle = await pool.acquire({ timeoutMs: 500 });
		assert.equal(secondHandle.port, port);
		secondHandle.release();
	} finally {
		pool.shutdown();
		await close(server);
	}
});
