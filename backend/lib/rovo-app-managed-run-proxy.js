"use strict";

const {
	resolveAgentsRfpDemoChatTurn: defaultResolveAgentsRfpDemoChatTurn,
} = require("./agents-rfp-demo-chat");
const {
	shouldReplaceActiveRunForRequest: defaultShouldReplaceActiveRunForRequest,
} = require("./rovo-app-run-continuation");
const { getNonEmptyString } = require("./shared-utils");

function requireFunction(name, value) {
	if (typeof value !== "function") {
		throw new Error(`createRovoAppManagedRunProxy requires ${name}`);
	}
	return value;
}

function createRovoAppManagedRunProxy({
	agentsRfpDemoChatStreamOwner,
	logger = console,
	persistRovoAppRunState,
	persistRovoAppRunStateInBackground,
	resolveAgentsRfpDemoChatTurn = defaultResolveAgentsRfpDemoChatTurn,
	rovoAppRunManager,
	rovoCancelChat,
	shouldReplaceActiveRunForRequest = defaultShouldReplaceActiveRunForRequest,
	settleRovoAppRun,
	startManagedRovoAppRun,
} = {}) {
	requireFunction("agentsRfpDemoChatStreamOwner.streamAgentsRfpDemoChatTurn", agentsRfpDemoChatStreamOwner?.streamAgentsRfpDemoChatTurn);
	requireFunction("logger.info", logger?.info);
	requireFunction("persistRovoAppRunState", persistRovoAppRunState);
	requireFunction("persistRovoAppRunStateInBackground", persistRovoAppRunStateInBackground);
	requireFunction("resolveAgentsRfpDemoChatTurn", resolveAgentsRfpDemoChatTurn);
	requireFunction("rovoAppRunManager.attachSubscriber", rovoAppRunManager?.attachSubscriber);
	requireFunction("rovoAppRunManager.createRun", rovoAppRunManager?.createRun);
	requireFunction("rovoAppRunManager.getRun", rovoAppRunManager?.getRun);
	requireFunction("rovoCancelChat", rovoCancelChat);
	requireFunction("shouldReplaceActiveRunForRequest", shouldReplaceActiveRunForRequest);
	requireFunction("settleRovoAppRun", settleRovoAppRun);
	requireFunction("startManagedRovoAppRun", startManagedRovoAppRun);

	async function proxyRovoAppChatRequest(req, res) {
		const requestBody =
			req.body && typeof req.body === "object" ? { ...req.body } : {};
		const threadId = getNonEmptyString(requestBody.id);
		if (!threadId) {
			return res.status(400).json({ error: "threadId is required" });
		}

		let existingRun = rovoAppRunManager.getRun(threadId);
		if (shouldReplaceActiveRunForRequest({ existingRun, requestBody })) {
			if (typeof existingRun?.rovoPort === "number" && existingRun.rovoPort > 0) {
				await rovoCancelChat(existingRun.rovoPort, { timeoutMs: 3_000 }).catch(() => {});
			}
			// Only the run read above: one that took its place during the wait is kept.
			await settleRovoAppRun(existingRun, "cancelled");
			existingRun = rovoAppRunManager.getRun(threadId);
		}

		const agentsRfpDemoTurn = !existingRun
			? resolveAgentsRfpDemoChatTurn(requestBody)
			: null;
		if (agentsRfpDemoTurn) {
			agentsRfpDemoChatStreamOwner.streamAgentsRfpDemoChatTurn(res, agentsRfpDemoTurn, requestBody);
			return;
		}

		const run =
			existingRun ||
			rovoAppRunManager.createRun({
				backend: "ai-gateway",
				threadId,
				requestBody,
				requestedPortIndex: null,
			});

		const subscriberId = rovoAppRunManager.attachSubscriber(threadId, res, {
			onDetached: (detachedRun) => {
				if (!detachedRun) {
					return;
				}
				persistRovoAppRunStateInBackground(threadId, detachedRun);
			},
		});
		if (!subscriberId) {
			return res.status(404).json({ error: "No active Rovo run for threadId" });
		}

		if (!existingRun) {
			logger.info("[TIMING][rovo-app] start-managed-run", {
				threadId,
			});
			await startManagedRovoAppRun(run);
		}

		await persistRovoAppRunState(threadId, rovoAppRunManager.getRun(threadId));
	}

	return {
		proxyRovoAppChatRequest,
	};
}

module.exports = {
	createRovoAppManagedRunProxy,
};
