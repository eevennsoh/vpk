const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

// The gateway's side of a pool lease: every path that acquires a port ends its lease.
const {
	initPool,
	replayViaRovo,
	streamViaRovo,
} = require("./rovo-gateway");

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
	return new Promise((resolve) => server.close(() => resolve()));
}

test("a paused tool call's continuation replay uses its reserved pool port as busy", async () => {
	const { createRovoPool } = require("./rovo-pool");
	const server = http.createServer((req, res) => {
		req.resume();
		req.on("end", () => {
			if (req.url === "/v3/replay" && req.method === "POST") {
				res.writeHead(200, { "Content-Type": "text/event-stream" });
				res.write('event: part_start\ndata: {"index":0,"part":{"content":"Resumed","part_kind":"text"},"event_kind":"part_start"}\n\n');
				res.end();
				return;
			}
			res.writeHead(404, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ detail: "Not Found" }));
		});
	});
	const port = await listen(server);
	const pool = createRovoPool([port], { healthCheckIntervalMs: 0, healthCheck: async () => {} });
	try {
		const handle = await pool.acquire();
		handle.reserve("paused tool call");
		const statusDuringReplay = [];

		await replayViaRovo({
			port,
			portHandle: handle,
			onTextDelta: () => {
				statusDuringReplay.push(pool.getStatus().ports[0].status);
			},
		});

		assert.deepEqual(statusDuringReplay, ["busy"]);
		assert.equal(handle.settleLease("release"), true);
		assert.equal(pool.getStatus().ports[0].status, "available");
	} finally {
		pool.shutdown();
		await close(server);
	}
});

test("streamViaRovo ends the lease when a callback throws before the stream starts", async () => {
	const settles = [];
	initPool({
		acquire: async () => ({
			port: 9,
			settleLease: (disposition) => {
				settles.push(disposition);
				return true;
			},
		}),
	});
	try {
		await assert.rejects(
			streamViaRovo({
				message: "hello",
				onTextDelta: () => {},
				onPortAcquired: () => {
					throw new Error("listener failed");
				},
			}),
			/listener failed/u,
		);
		assert.deepEqual(settles, ["release"]);
	} finally {
		initPool(null);
	}
});
