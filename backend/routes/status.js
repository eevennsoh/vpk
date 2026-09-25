"use strict";

const express = require("express");
const {
	getAIGatewayConfigReport,
	getEnvVars,
	hasGatewayUrlConfigured,
} = require("../lib/ai-gateway-helpers");
const {
	buildLlmRoutingStatus,
} = require("../lib/llm-routing-status");

function parseOptionalInteger(value) {
	if (typeof value === "number" && Number.isInteger(value)) {
		return value;
	}
	if (typeof value === "string" && value.trim()) {
		const parsed = Number.parseInt(value, 10);
		return Number.isInteger(parsed) ? parsed : null;
	}
	return null;
}

function createRovoSurface({ available, port }) {
	return {
		available,
		message: available
			? "Rovo Serve is ready for interactive chat."
			: "Rovo Serve is unavailable.",
		status: available ? "ready" : "unavailable",
		url: typeof port === "number" ? `http://localhost:${port}` : null,
	};
}


function createStatusRouter({
	buildRuntimeStatusSnapshot,
	getRovoPort = () => process.env.ROVO_PORT,
	isRovoAvailable,
} = {}) {
	if (typeof buildRuntimeStatusSnapshot !== "function") {
		throw new Error("createStatusRouter requires buildRuntimeStatusSnapshot");
	}
	if (typeof isRovoAvailable !== "function") {
		throw new Error("createStatusRouter requires isRovoAvailable");
	}

	const router = express.Router();

	router.get("/rovo", async (_req, res) => {
		try {
			const available = await isRovoAvailable();
			const port = parseOptionalInteger(getRovoPort());
			return res.json(
				buildRuntimeStatusSnapshot({
					rovo: createRovoSurface({ available, port }),
				}).surfaces.rovo,
			);
		} catch (error) {
			return res.status(500).json({
				error: "Failed to check Rovo status",
				details: error instanceof Error ? error.message : String(error),
			});
		}
	});


	router.get("/", async (_req, res) => {
		try {
			const rovoAvailable = await isRovoAvailable();
			const port = parseOptionalInteger(getRovoPort());
			return res.json(
				buildRuntimeStatusSnapshot({
					rovo: createRovoSurface({ available: rovoAvailable, port }),
				}),
			);
		} catch (error) {
			return res.status(500).json({
				error: "Failed to resolve runtime status",
				details: error instanceof Error ? error.message : String(error),
			});
		}
	});

	return router;
}

function createHealthcheckHandler() {
	return (_req, res) => {
		console.log("Healthcheck requested by Micros");
		res.status(200).json({ status: "ok" });
	};
}

function createApiHealthHandler({
	buildLlmRoutingStatus: buildLlmRoutingStatusFn = buildLlmRoutingStatus,
	debugLog = () => {},
	debugMode = process.env.DEBUG === "true",
	getAiGatewayConfigReport = getAIGatewayConfigReport,
	getAsapPrivateKey = () => process.env.ASAP_PRIVATE_KEY,
	getEnvVars: getEnvVarsFn = getEnvVars,
	getRovoPort = () => process.env.ROVO_PORT,
	hasGatewayUrlConfigured: hasGatewayUrlConfiguredFn = hasGatewayUrlConfigured,
	isRovoAvailable,
	now = () => new Date(),
} = {}) {
	if (typeof buildLlmRoutingStatusFn !== "function") {
		throw new Error("createApiHealthHandler requires buildLlmRoutingStatus");
	}
	if (typeof getAiGatewayConfigReport !== "function") {
		throw new Error("createApiHealthHandler requires getAiGatewayConfigReport");
	}
	if (typeof getEnvVarsFn !== "function") {
		throw new Error("createApiHealthHandler requires getEnvVars");
	}
	if (typeof hasGatewayUrlConfiguredFn !== "function") {
		throw new Error("createApiHealthHandler requires hasGatewayUrlConfigured");
	}
	if (typeof isRovoAvailable !== "function") {
		throw new Error("createApiHealthHandler requires isRovoAvailable");
	}

	return async (_req, res) => {
		console.log("Health check requested");
		debugLog("HEALTH", "Processing health check");

		const key = getAsapPrivateKey();
		const rovoAvailable = await isRovoAvailable();
		const envVars = getEnvVarsFn();
		const aiGatewayConfigured = hasGatewayUrlConfiguredFn(envVars);
		const llmRouting = buildLlmRoutingStatusFn({
			rovoAvailable,
			aiGatewayConfigured,
		});

		debugLog("HEALTH", "Auth configuration", {
			hasAsapKey: !!key,
			rovoAvailable,
			chatSdkBackend: llmRouting.chatSdk.backend,
			chatSdkRequiresRovo: llmRouting.chatSdk.requiresRovo,
			aiGatewayConfigured,
		});

		const response = {
			status: "OK",
			message: "Backend server is working!",
			timestamp: now().toISOString(),
			authMethod: "ASAP",
			debugMode,
			rovoMode: rovoAvailable,
			llmRouting: {
				...llmRouting,
				aiGatewayConfig: getAiGatewayConfigReport(envVars),
			},
			envCheck: {
				ASAP_PRIVATE_KEY: key ? "SET" : "MISSING",
				ROVO_PORT: getRovoPort() ? "SET" : "MISSING",
			},
		};

		res.status(200).json(response);
	};
}

function registerStatusRoutes(app, dependencies) {
	app.use("/api/status", createStatusRouter(dependencies));
	app.get("/healthcheck", createHealthcheckHandler());
	app.get("/api/health", createApiHealthHandler(dependencies));
}

module.exports = {
	createApiHealthHandler,
	createHealthcheckHandler,
	createRovoSurface,
	createStatusRouter,
	parseOptionalInteger,
	registerStatusRoutes,
};
