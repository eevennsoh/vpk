"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const express = require("express");

const { createRuntimeAdminControls } = require("../middleware/runtime-admin");
const {
	buildOrchestratorLogFilter,
	createOrchestratorRouter,
	parsePositiveIntegerQuery,
	registerOrchestratorRoutes,
} = require("./orchestrator");

const ADMIN = Object.freeze({ headers: { "x-runtime-admin": "allowed" } });

async function withServer(overrides, run) {
	const app = express();
	const calls = {
		clear: 0,
		getEntries: [],
		getStats: 0,
		toTimeline: [],
	};
	const orchestratorLog = {
		clear: () => {
			calls.clear += 1;
		},
		getEntries: (filter) => {
			calls.getEntries.push(filter);
			return [{ id: "entry-1", portIndex: 2 }];
		},
		getStats: () => {
			calls.getStats += 1;
			return { total: 1 };
		},
		toTimeline: (filter) => {
			calls.toTimeline.push(filter);
			return [{ id: "timeline-1", label: "User turn" }];
		},
	};

	registerOrchestratorRoutes(app, {
		logger: {
			error: () => {},
		},
		orchestratorLog,
		requireRuntimeAdmin: (req, res, next) => {
			if (req.headers["x-runtime-admin"] !== "allowed") {
				return res.status(403).json({ error: "runtime admin required" });
			}
			return next();
		},
		...overrides,
	});

	const server = http.createServer(app);
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	const baseUrl = `http://127.0.0.1:${address.port}`;

	try {
		await run(baseUrl, calls);
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

test("orchestrator router validates required dependencies", () => {
	assert.throws(() => createOrchestratorRouter(), /orchestratorLog/u);
	assert.throws(() => createOrchestratorRouter({
		orchestratorLog: {},
	}), /getEntries/u);
	assert.throws(() => createOrchestratorRouter({
		orchestratorLog: {
			clear: () => {},
			getEntries: () => [],
			getStats: () => ({}),
			toTimeline: () => [],
		},
	}), /requireRuntimeAdmin/u);
});

test("parsePositiveIntegerQuery preserves existing positive limit parsing", () => {
	assert.equal(parsePositiveIntegerQuery("25"), 25);
	assert.equal(parsePositiveIntegerQuery(["12", "30"]), 12);
	assert.equal(parsePositiveIntegerQuery("0"), undefined);
	assert.equal(parsePositiveIntegerQuery("-1"), undefined);
	assert.equal(parsePositiveIntegerQuery("not-a-number"), undefined);
	assert.equal(parsePositiveIntegerQuery(undefined), undefined);
});

test("buildOrchestratorLogFilter returns undefined when no positive limit is present", () => {
	assert.deepEqual(buildOrchestratorLogFilter({ limit: "2" }), { limit: 2 });
	assert.equal(buildOrchestratorLogFilter({ limit: "0" }), undefined);
	assert.equal(buildOrchestratorLogFilter({}), undefined);
});

test("orchestrator log route returns entries and stats with positive limit filter", async () => {
	await withServer({}, async (baseUrl, calls) => {
		const response = await fetch(`${baseUrl}/api/orchestrator/log?limit=25&portIndex=2`, ADMIN);

		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), {
			entries: [{ id: "entry-1", portIndex: 2 }],
			stats: { total: 1 },
		});
		assert.deepEqual(calls.getEntries, [{ limit: 25 }]);
		assert.equal(calls.getStats, 1);
	});
});

test("orchestrator timeline route returns timeline and stats with positive limit filter", async () => {
	await withServer({}, async (baseUrl, calls) => {
		const response = await fetch(`${baseUrl}/api/orchestrator/timeline?limit=10`, ADMIN);

		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), {
			stats: { total: 1 },
			timeline: [{ id: "timeline-1", label: "User turn" }],
		});
		assert.deepEqual(calls.toTimeline, [{ limit: 10 }]);
		assert.equal(calls.getStats, 1);
	});
});

test("orchestrator log delete remains runtime-admin protected", async () => {
	await withServer({}, async (baseUrl, calls) => {
		const blockedResponse = await fetch(`${baseUrl}/api/orchestrator/log`, {
			method: "DELETE",
		});
		assert.equal(blockedResponse.status, 403);
		assert.deepEqual(await blockedResponse.json(), { error: "runtime admin required" });
		assert.equal(calls.clear, 0);

		const allowedResponse = await fetch(`${baseUrl}/api/orchestrator/log`, {
			headers: { "x-runtime-admin": "allowed" },
			method: "DELETE",
		});
		assert.equal(allowedResponse.status, 200);
		assert.deepEqual(await allowedResponse.json(), {
			ok: true,
			message: "Orchestrator log cleared",
		});
		assert.equal(calls.clear, 1);
	});
});

test("orchestrator routes preserve existing error responses", async () => {
	const loggerCalls = [];
	await withServer({
		logger: {
			error: (...args) => {
				loggerCalls.push(args);
			},
		},
		orchestratorLog: {
			clear: () => {
				throw new Error("clear failed");
			},
			getEntries: () => {
				throw new Error("read failed");
			},
			getStats: () => ({ total: 0 }),
			toTimeline: () => {
				throw new Error("timeline failed");
			},
		},
		requireRuntimeAdmin: (req, res, next) => {
			if (req.headers["x-runtime-admin"] !== "allowed") {
				return res.status(403).json({ error: "runtime admin required" });
			}
			return next();
		},
	}, async (baseUrl) => {
		const logResponse = await fetch(`${baseUrl}/api/orchestrator/log`, ADMIN);
		assert.equal(logResponse.status, 500);
		assert.deepEqual(await logResponse.json(), { error: "Failed to retrieve orchestrator log" });

		const timelineResponse = await fetch(`${baseUrl}/api/orchestrator/timeline`, ADMIN);
		assert.equal(timelineResponse.status, 500);
		assert.deepEqual(await timelineResponse.json(), { error: "Failed to retrieve orchestrator timeline" });

		const deleteResponse = await fetch(`${baseUrl}/api/orchestrator/log`, {
			headers: { "x-runtime-admin": "allowed" },
			method: "DELETE",
		});
		assert.equal(deleteResponse.status, 500);
		assert.deepEqual(await deleteResponse.json(), { error: "Failed to clear orchestrator log" });
		assert.equal(loggerCalls.length, 3);
	});
});

test("orchestrator log and timeline reads are runtime-admin protected", async () => {
	await withServer({}, async (baseUrl, calls) => {
		for (const route of ["/api/orchestrator/log", "/api/orchestrator/timeline"]) {
			const blocked = await fetch(`${baseUrl}${route}`);
			assert.equal(blocked.status, 403, route);
			assert.deepEqual(await blocked.json(), { error: "runtime admin required" });
		}
		assert.deepEqual(calls.getEntries, []);
		assert.deepEqual(calls.toTimeline, []);
	});
});

test("with the real runtime admin gate, a signed-in caller cannot read the log but the admin and a dev caller can", async () => {
	const silent = { error() {} };
	const production = createRuntimeAdminControls({
		allowedOrigins: [],
		consoleImpl: silent,
		env: { NODE_ENV: "production", VPK_RUNTIME_ADMIN_TOKEN: "admin-secret" },
		exit: () => {},
	});
	await withServer({ requireRuntimeAdmin: production.requireRuntimeAdmin }, async (baseUrl, calls) => {
		for (const route of ["/api/orchestrator/log", "/api/orchestrator/timeline"]) {
			const signedIn = await fetch(`${baseUrl}${route}`, { headers: { "x-slauth-subject": "bob" } });
			assert.equal(signedIn.status, 403, route);
			assert.deepEqual(await signedIn.json(), { error: "Runtime admin authorization required" });

			const admin = await fetch(`${baseUrl}${route}`, {
				headers: { "x-slauth-subject": "alice", "x-vpk-runtime-admin-token": "admin-secret" },
			});
			assert.equal(admin.status, 200, route);
		}
		assert.equal(calls.getEntries.length, 1);
		assert.equal(calls.toTimeline.length, 1);
	});

	const development = createRuntimeAdminControls({ allowedOrigins: [], consoleImpl: silent, env: {}, exit: () => {} });
	await withServer({ requireRuntimeAdmin: development.requireRuntimeAdmin }, async (baseUrl) => {
		for (const route of ["/api/orchestrator/log", "/api/orchestrator/timeline"]) {
			const local = await fetch(`${baseUrl}${route}`);
			assert.equal(local.status, 200, route);
		}
	});
});
