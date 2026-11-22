"use strict";

const express = require("express");

function parsePositiveIntegerQuery(value) {
	const rawValue = Array.isArray(value) ? value[0] : value;
	const parsedValue = rawValue !== undefined
		? parseInt(rawValue, 10)
		: undefined;
	return typeof parsedValue === "number" && !isNaN(parsedValue) && parsedValue > 0
		? parsedValue
		: undefined;
}

function buildOrchestratorLogFilter(query = {}) {
	const limit = parsePositiveIntegerQuery(query.limit);
	return limit ? { limit } : undefined;
}

function createOrchestratorRouter({
	logger = console,
	orchestratorLog,
	requireRuntimeAdmin,
} = {}) {
	if (!orchestratorLog || typeof orchestratorLog !== "object") {
		throw new Error("createOrchestratorRouter requires orchestratorLog");
	}
	if (typeof orchestratorLog.getEntries !== "function") {
		throw new Error("createOrchestratorRouter requires orchestratorLog.getEntries");
	}
	if (typeof orchestratorLog.getStats !== "function") {
		throw new Error("createOrchestratorRouter requires orchestratorLog.getStats");
	}
	if (typeof orchestratorLog.toTimeline !== "function") {
		throw new Error("createOrchestratorRouter requires orchestratorLog.toTimeline");
	}
	if (typeof orchestratorLog.clear !== "function") {
		throw new Error("createOrchestratorRouter requires orchestratorLog.clear");
	}
	if (typeof requireRuntimeAdmin !== "function") {
		throw new Error("createOrchestratorRouter requires requireRuntimeAdmin");
	}

	const router = express.Router();

	// The log and timeline cover every caller's turns, so reading them is admin-only too.
	router.get("/log", requireRuntimeAdmin, (req, res) => {
		try {
			const filter = buildOrchestratorLogFilter(req.query);
			const entries = orchestratorLog.getEntries(filter);
			const stats = orchestratorLog.getStats();

			return res.json({ entries, stats });
		} catch (error) {
			logger.error?.("[ORCHESTRATOR] Failed to get log:", error);
			return res.status(500).json({ error: "Failed to retrieve orchestrator log" });
		}
	});

	router.get("/timeline", requireRuntimeAdmin, (req, res) => {
		try {
			const filter = buildOrchestratorLogFilter(req.query);
			const timeline = orchestratorLog.toTimeline(filter);
			const stats = orchestratorLog.getStats();

			return res.json({ timeline, stats });
		} catch (error) {
			logger.error?.("[ORCHESTRATOR] Failed to get timeline:", error);
			return res.status(500).json({ error: "Failed to retrieve orchestrator timeline" });
		}
	});

	router.delete("/log", requireRuntimeAdmin, (_req, res) => {
		try {
			orchestratorLog.clear();
			return res.json({ ok: true, message: "Orchestrator log cleared" });
		} catch (error) {
			logger.error?.("[ORCHESTRATOR] Failed to clear log:", error);
			return res.status(500).json({ error: "Failed to clear orchestrator log" });
		}
	});

	return router;
}

function registerOrchestratorRoutes(app, dependencies) {
	app.use("/api/orchestrator", createOrchestratorRouter(dependencies));
}

module.exports = {
	buildOrchestratorLogFilter,
	createOrchestratorRouter,
	parsePositiveIntegerQuery,
	registerOrchestratorRoutes,
};
