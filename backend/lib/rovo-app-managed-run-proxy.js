"use strict";

const {
	resolveAgentsRfpDemoChatTurn: defaultResolveAgentsRfpDemoChatTurn,
} = require("./agents-rfp-demo-chat");
const { currentGeneratedMediaScope } = require("./generated-media-owners");
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
	requireFunction("startManagedRovoAppRun", startManagedRovoAppRun);

	async function proxyRovoAppChatRequest(req, res) {
		const requestBody =
			req.body && typeof req.body === "object" ? { ...req.body } : {};
		const threadId = getNonEmptyString(requestBody.id);
		if (!threadId) {
			return res.status(400).json({ error: "threadId is required" });
		}

		const existingRun = rovoAppRunManager.getRun(threadId);

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
				// The chat guard runs this request as its caller's turn; the run keeps the
				// caller with it.
				mediaScope: currentGeneratedMediaScope(),
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
