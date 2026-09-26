"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const express = require("express");

const {
	createApiHealthHandler,
	createHealthcheckHandler,
	createStatusRouter,
	parseOptionalInteger,
	registerStatusRoutes,
} = require("./status");
const {
	buildRuntimeStatusSnapshot,
} = require("../lib/runtime-status");

async function withServer(dependencies, run) {
	const app = express();
	app.use(express.json());
	registerStatusRoutes(app, {
		buildRuntimeStatusSnapshot,
		getRovoPort: () => "9001",
		...dependencies,
	});

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

function createStatusDependencies(overrides = {}) {
	return {
		isRovoAvailable: async () => true,
		...overrides,
	};
}

test("status router returns aggregate Rovo status", async () => {
	await withServer(createStatusDependencies(), async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/status`);
		assert.equal(response.status, 200);
		const payload = await response.json();

		assert.equal(payload.status, "ok");
		assert.equal(payload.surfaces.rovo.available, true);
		assert.equal(payload.surfaces.rovo.url, "http://localhost:9001");
	});
});

test("status router exposes individual surface endpoints", async () => {
	await withServer(createStatusDependencies(), async (baseUrl) => {
		const rovoResponse = await fetch(`${baseUrl}/api/status/rovo`);
		assert.equal(rovoResponse.status, 200);
		assert.equal((await rovoResponse.json()).name, "rovo");

		const hermesResponse = await fetch(`${baseUrl}/api/status/hermes`);
		assert.equal(hermesResponse.status, 404);
	});
});

test("status router owns the Micros healthcheck endpoint", async () => {
	await withServer(createStatusDependencies(), async (baseUrl) => {
		const response = await fetch(`${baseUrl}/healthcheck`);
		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), { status: "ok" });
	});
});

test("status router owns the legacy API health payload", async () => {
	await withServer(createStatusDependencies({
		getAiGatewayConfigReport: () => ({
			AI_GATEWAY_URL: "SET",
			ASAP_PRIVATE_KEY: "SET",
		}),
		getAsapPrivateKey: () => "private-key",
		getEnvVars: () => ({
			AI_GATEWAY_URL: "https://gateway.example.test",
		}),
		getRovoPort: () => "9001",
		hasGatewayUrlConfigured: () => true,
		now: () => new Date("2026-07-04T00:00:00.000Z"),
	}), async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/health`);
		assert.equal(response.status, 200);
		const payload = await response.json();

		assert.equal(payload.status, "OK");
		assert.equal(payload.message, "Backend server is working!");
		assert.equal(payload.timestamp, "2026-07-04T00:00:00.000Z");
		assert.equal(payload.authMethod, "ASAP");
		assert.equal(payload.rovoMode, true);
		assert.equal(payload.llmRouting.chatSdk.backend, "ai-gateway");
		assert.equal(payload.llmRouting.aiGatewayConfig.AI_GATEWAY_URL, "SET");
		assert.deepEqual(payload.envCheck, {
			ASAP_PRIVATE_KEY: "SET",
			ROVO_PORT: "SET",
		});
	});
});

test("status router keeps route-specific error messages", async () => {
	await withServer(createStatusDependencies({
		isRovoAvailable: async () => {
			throw new Error("rovo probe failed");
		},
	}), async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/status/rovo`);
		assert.equal(response.status, 500);
		assert.deepEqual(await response.json(), {
			error: "Failed to check Rovo status",
			details: "rovo probe failed",
		});
	});
});

test("status router validates required dependencies", () => {
	assert.throws(() => createStatusRouter(), /buildRuntimeStatusSnapshot/u);
	assert.throws(() => createStatusRouter({
		buildRuntimeStatusSnapshot,
	}), /isRovoAvailable/u);
	assert.equal(typeof createHealthcheckHandler(), "function");
	assert.throws(() => createApiHealthHandler(), /isRovoAvailable/u);
});

test("parseOptionalInteger preserves the existing status route port parsing", () => {
	assert.equal(parseOptionalInteger(9000), 9000);
	assert.equal(parseOptionalInteger("9001"), 9001);
	assert.equal(parseOptionalInteger(""), null);
	assert.equal(parseOptionalInteger("not-a-port"), null);
	assert.equal(parseOptionalInteger(12.5), null);
});
