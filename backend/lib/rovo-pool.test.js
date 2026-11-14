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

	handle.settleLease("release");
	pool.shutdown();
});

test("acquire prefers the requested sticky port when it is available", async () => {
	const pool = createRovoPool([8000, 8001, 8002], {
		healthCheckIntervalMs: 0,
	});

	const handle = await pool.acquire({ preferredPort: 8002 });
	assert.equal(handle.port, 8002);

	handle.settleLease("release");
	pool.shutdown();
});

test("acquire skips avoided ports when alternatives are available", async () => {
	const pool = createRovoPool([8000, 8001, 8002], {
		healthCheckIntervalMs: 0,
	});

	const handle = await pool.acquire({ avoidPorts: [8000, 8001] });
	assert.equal(handle.port, 8002);

	handle.settleLease("release");
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

	handle.settleLease("release");

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

	handle.settleLease("release");
	pool.shutdown();
});

test("settleLease unhealthy quarantines a failed port while other ports remain available", async () => {
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
		firstHandle.settleLease("unhealthy");

		const fallbackHandle = await pool.acquire({ preferredPort: portA });
		assert.equal(fallbackHandle.port, portB);
		fallbackHandle.settleLease("release");

		const deadline = Date.now() + 5000;
		while (pool.getStatus().ports.find((entry) => entry.port === portA)?.status !== "available" && Date.now() < deadline) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}
		assert.equal(pool.getStatus().ports.find((entry) => entry.port === portA)?.status, "available");

		const recoveredHandle = await pool.acquire({ preferredPort: portA });
		assert.equal(recoveredHandle.port, portA);
		recoveredHandle.settleLease("release");
	} finally {
		pool.shutdown();
		await close(serverA);
		await close(serverB);
	}
});

test("settleLease unhealthy does not deadlock a single-port pool", async () => {
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
		firstHandle.settleLease("unhealthy");

		await new Promise((resolve) => setTimeout(resolve, 50));

		const secondHandle = await pool.acquire({ timeoutMs: 500 });
		assert.equal(secondHandle.port, port);
		secondHandle.settleLease("release");
	} finally {
		pool.shutdown();
		await close(server);
	}
});

// No timer and no network: health checks run only when the test calls them.
function createQuietPool(ports, { healthy = true } = {}) {
	return createRovoPool(ports, {
		healthCheckIntervalMs: 0,
		healthCheck: async () => {
			if (!healthy) throw new Error("down");
		},
	});
}

function portStatus(pool, port) {
	const entry = pool.getStatus().ports.find((each) => each.port === port);
	return entry ? { status: entry.status, reason: entry.reason } : null;
}

test("a reserved lease shows its reason, survives health checks and port updates, and releases once", async () => {
	const pool = createQuietPool([9101, 9102]);
	try {
		const handle = await pool.acquire({ preferredPort: 9101 });
		handle.reserve("paused tool call");

		assert.deepEqual(portStatus(pool, 9101), { status: "reserved", reason: "paused tool call" });
		const status = pool.getStatus();
		assert.equal(status.reserved, 1);
		assert.equal(status.busy, 1);
		assert.equal(status.available, 1);

		await pool.runHealthChecks();
		pool.updatePorts([9102]);
		assert.deepEqual(portStatus(pool, 9101), { status: "reserved", reason: "paused tool call" });

		handle.resume();
		assert.deepEqual(portStatus(pool, 9101), { status: "busy", reason: null });
		handle.reserve("paused tool call");

		assert.equal(handle.settleLease("release"), true);
		assert.deepEqual(portStatus(pool, 9101), { status: "available", reason: null });
		assert.equal(handle.settleLease("unhealthy", { reason: "late" }), false);
		handle.reserve("late");
		assert.deepEqual(portStatus(pool, 9101), { status: "available", reason: null });
	} finally {
		pool.shutdown();
	}
});

test("an unhealthy settle keeps its reason until a health check recovers the port", async () => {
	const pool = createQuietPool([9201, 9202]);
	try {
		const handle = await pool.acquire({ preferredPort: 9201 });
		assert.equal(handle.settleLease("unhealthy", { reason: "chat in progress conflict" }), true);
		assert.deepEqual(portStatus(pool, 9201), { status: "unhealthy", reason: "chat in progress conflict" });
		assert.equal(pool.getStatus().unhealthy, 1);
		assert.equal(handle.settleLease("release"), false);
		assert.deepEqual(portStatus(pool, 9201), { status: "unhealthy", reason: "chat in progress conflict" });
		assert.equal(handle.settleLease("paused"), false);

		await pool.runHealthChecks();
		assert.deepEqual(portStatus(pool, 9201), { status: "available", reason: null });
	} finally {
		pool.shutdown();
	}
});

test("a failed health check records why the port is unhealthy", async () => {
	const pool = createQuietPool([9301], { healthy: false });
	try {
		await pool.runHealthChecks();
		assert.deepEqual(portStatus(pool, 9301), { status: "unhealthy", reason: "health check failed" });
	} finally {
		pool.shutdown();
	}
});
