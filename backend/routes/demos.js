"use strict";

const express = require("express");

const {
	handleDeleteClaimTest,
	handleGetClaimTest,
	handlePostClaimTest,
} = require("../lib/claim-test-handler");
const { getNonEmptyString } = require("../lib/shared-utils");
const { classifyTickets } = require("../lib/ticket-classifier");
const { generateStandupSummary } = require("../lib/standup-summary");

function requireFunction(name, value) {
	if (typeof value !== "function") {
		throw new Error(`createDemosRouter requires ${name}`);
	}
}

function createDemosRouter({
	advanceAgentsRfpDemoProcessing,
	agentsRfpDemoStateManager,
	classifyTicketsFn = classifyTickets,
	generateAgentsRfpDemoReportPreview,
	generateStandupSummaryFn = generateStandupSummary,
	getString = getNonEmptyString,
	handleDeleteClaimTestFn = handleDeleteClaimTest,
	handleGetClaimTestFn = handleGetClaimTest,
	handlePostClaimTestFn = handlePostClaimTest,
	runAgentsRfpDemoJob,
	resetAgentsRfpDemo,
	saveAgentsRfpDemoState,
	handleAgentsRfpDemoTicketEvent,
} = {}) {
	requireFunction("advanceAgentsRfpDemoProcessing", advanceAgentsRfpDemoProcessing);
	requireFunction("classifyTicketsFn", classifyTicketsFn);
	requireFunction("generateAgentsRfpDemoReportPreview", generateAgentsRfpDemoReportPreview);
	requireFunction("generateStandupSummaryFn", generateStandupSummaryFn);
	requireFunction("getString", getString);
	requireFunction("handleDeleteClaimTestFn", handleDeleteClaimTestFn);
	requireFunction("handleGetClaimTestFn", handleGetClaimTestFn);
	requireFunction("handlePostClaimTestFn", handlePostClaimTestFn);
	requireFunction("runAgentsRfpDemoJob", runAgentsRfpDemoJob);
	requireFunction("resetAgentsRfpDemo", resetAgentsRfpDemo);
	requireFunction("saveAgentsRfpDemoState", saveAgentsRfpDemoState);
	requireFunction("handleAgentsRfpDemoTicketEvent", handleAgentsRfpDemoTicketEvent);
	if (!agentsRfpDemoStateManager || typeof agentsRfpDemoStateManager !== "object") {
		throw new Error("createDemosRouter requires agentsRfpDemoStateManager");
	}
	requireFunction("agentsRfpDemoStateManager.readState", agentsRfpDemoStateManager.readState);
	requireFunction("agentsRfpDemoStateManager.writeState", agentsRfpDemoStateManager.writeState);
	requireFunction("agentsRfpDemoStateManager.resetState", agentsRfpDemoStateManager.resetState);
	requireFunction("agentsRfpDemoStateManager.updateState", agentsRfpDemoStateManager.updateState);

	const router = express.Router();

	router.post("/agents/rfp-demo/vpk-html-report", async (req, res) => {
		try {
			const report = await generateAgentsRfpDemoReportPreview(req.body || {});
			return res.status(200).json(report);
		} catch (error) {
			console.error("[AGENTS-RFP-DEMO] Failed to generate vpk-html report preview:", error);
			return res.status(400).json({
				error: error instanceof Error ? error.message : "Failed to generate vpk-html report preview",
			});
		}
	});

	router.post("/ticket-classify", async (req, res) => {
		try {
			const { siteUrl, project, excludeStatuses, limit } = req.body || {};
			const result = await classifyTicketsFn({
				siteUrl,
				project,
				excludeStatuses,
				limit,
			});
			return res.json(result);
		} catch (error) {
			const statusCode = error.statusCode || 500;
			return res.status(statusCode).json({
				error: "Failed to classify tickets",
				details: error instanceof Error ? error.message : String(error),
			});
		}
	});

	router.get("/claim-test", async (req, res) => {
		try {
			const result = await handleGetClaimTestFn(req.query);
			return res.status(result.status).json(result.body);
		} catch (error) {
			console.error("Claim test GET error:", error);
			return res.status(500).json({
				error: "Claim test GET failed",
				details: error.message,
			});
		}
	});

	router.post("/claim-test", async (req, res) => {
		try {
			const result = await handlePostClaimTestFn(req.body);
			return res.status(result.status).json(result.body);
		} catch (error) {
			console.error("Claim test POST error:", error);
			return res.status(500).json({
				error: "Claim test POST failed",
				details: error.message,
			});
		}
	});

	router.delete("/claim-test", async (req, res) => {
		try {
			const result = await handleDeleteClaimTestFn(req.query);
			return res.status(result.status).json(result.body);
		} catch (error) {
			console.error("Claim test DELETE error:", error);
			return res.status(500).json({
				error: "Claim test DELETE failed",
				details: error.message,
			});
		}
	});

	router.post("/standup", async (req, res) => {
		try {
			const { siteUrl, hoursAgo, projects, limit } = req.body || {};
			const summary = await generateStandupSummaryFn({
				siteUrl,
				hoursAgo,
				projects,
				limit,
			});
			return res.json(summary);
		} catch (error) {
			const statusCode = error.statusCode || 500;
			return res.status(statusCode).json({
				error: "Failed to generate standup summary",
				details: error instanceof Error ? error.message : String(error),
			});
		}
	});

	router.get("/agents/rfp-demo/state", async (_req, res) => {
		try {
			const state = await advanceAgentsRfpDemoProcessing();
			return res.json({ state });
		} catch (error) {
			return res.status(500).json({
				error: "Failed to load Agents RFP demo state",
				details: error instanceof Error ? error.message : String(error),
			});
		}
	});

	router.post("/agents/rfp-demo/state", async (req, res) => {
		try {
			if (!req.body?.state || typeof req.body.state !== "object") {
				return res.status(400).json({ error: "state is required." });
			}

			const state = await saveAgentsRfpDemoState(req.body.state);
			return res.json({ state });
		} catch (error) {
			return res.status(500).json({
				error: "Failed to save Agents RFP demo state",
				details: error instanceof Error ? error.message : String(error),
			});
		}
	});

	router.post("/agents/rfp-demo/reset", async (_req, res) => {
		try {
			const state = await resetAgentsRfpDemo();
			return res.json({ state });
		} catch (error) {
			return res.status(500).json({
				error: "Failed to reset Agents RFP demo state",
				details: error instanceof Error ? error.message : String(error),
			});
		}
	});

	router.post("/agents/rfp-demo/agent/apply", async (_req, res) => {
		try {
			const { job, state } = await runAgentsRfpDemoJob({
				source: "agent-apply",
			});
			return res.json({ job, state });
		} catch (error) {
			return res.status(error?.code === "INVALID_INPUT" ? 400 : 500).json({
				error: "Failed to apply RFP Drafting Agent",
				details: error instanceof Error ? error.message : String(error),
			});
		}
	});

	router.post("/agents/rfp-demo/events/ticket-entered-column", async (req, res) => {
		try {
			const ticketCode = getString(req.body?.ticketCode ?? req.body?.key);
			const targetColumn = getString(req.body?.targetColumn ?? req.body?.column);
			if (!ticketCode || !targetColumn) {
				return res.status(400).json({ error: "ticketCode and targetColumn are required." });
			}

			const result = await handleAgentsRfpDemoTicketEvent({
				ticketCode, targetColumn, runId: getString(req.body?.runId),
			});
			return res.json(result);
		} catch (error) {
			return res.status(error?.code === "INVALID_INPUT" ? 400 : 500).json({
				error: "Failed to process Agents RFP demo ticket event",
				details: error instanceof Error ? error.message : String(error),
			});
		}
	});

	return router;
}

function registerDemosRoutes(app, dependencies) {
	app.use("/api", createDemosRouter(dependencies));
}

module.exports = {
	createDemosRouter,
	registerDemosRoutes,
};
