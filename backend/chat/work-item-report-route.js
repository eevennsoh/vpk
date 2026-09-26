"use strict";

async function handleWorkItemReportRoute({
	contextDescription,
	handlerDependencies = {},
	latestUserMessage,
	messages,
	provider,
	req,
	requestOrigin,
	res,
	stageTrace,
	threadId,
} = {}) {
	const {
		WORK_ITEM_REPORT_REQUEST_START,
		buildWorkItemReportRequestContext,
		createAbortControllerFromRequest,
		createRouteDecisionPart,
		createRovoAppThreadId,
		createUIMessageStream,
		handleRovoAppArtifactToolRequest,
		pipeUIMessageStreamToResponse,
		pipeWebResponseToExpressResponse,
		resolveWorkItemReportRequest,
	} = handlerDependencies;

	const workItemReportRequest = resolveWorkItemReportRequest({
		contextDescription,
		promptText: latestUserMessage,
	});

	if (workItemReportRequest.isIntent && !workItemReportRequest.hasContext) {
		const stream = createUIMessageStream({
			execute: async ({ writer }) => {
				const textId = `work-item-report-missing-context-${Date.now()}`;
				writer.write({ type: "text-start", id: textId });
				writer.write({
					type: "text-delta",
					id: textId,
					delta:
						"I can create the HTML report once a Jira Work Item is open or included in the chat context. Open the Work Item, then ask me to generate the report again.",
				});
				writer.write({ type: "text-end", id: textId });
				writer.write(createRouteDecisionPart({
					intent: "chat",
					origin: requestOrigin,
					reason: "work_item_report_missing_context",
				}));
				writer.write({
					type: "data-turn-complete",
					data: { timestamp: new Date().toISOString() },
				});
			},
			onError: (error) =>
				error instanceof Error
					? error.message
					: "Failed to resolve Work Item report context",
		});
		pipeUIMessageStreamToResponse({ response: res, stream });
		return true;
	}

	if (!workItemReportRequest.shouldCreateArtifact) {
		return false;
	}

	const reportThreadId = threadId || createRovoAppThreadId();
	const workItemReportContextDescription =
		workItemReportRequest.contextBlock ||
		(contextDescription?.includes(WORK_ITEM_REPORT_REQUEST_START)
			? null
			: buildWorkItemReportRequestContext({
					contextDescription,
					promptText: latestUserMessage,
					skillId: workItemReportRequest.skillId,
				}));
	const reportContextDescription = [
		contextDescription,
		workItemReportContextDescription,
	]
		.filter(Boolean)
		.join("\n\n");
	const { abortController, cleanup } = createAbortControllerFromRequest(req, res, {
		onAbort: () => {
			console.log("[CHAT-SDK] Client disconnected, aborting Work Item report artifact stream");
		},
	});
	try {
		const handled = await handleRovoAppArtifactToolRequest({
			activeArtifact: null,
			activeDocument: null,
			artifactSteering: null,
			artifactBackendPreference:
				workItemReportRequest.artifactBackendPreference || "ai-gateway",
			contextDescription: reportContextDescription || null,
			requestOrigin,
			requestBody: {
				...(req.body || {}),
				id: reportThreadId,
				messages,
				provider,
				futureArtifactMode: "create",
				futureArtifactTitle: workItemReportRequest.title,
				futureArtifactKind: "html",
			},
			signal: abortController.signal,
			streamingArtifact: null,
			threadId: reportThreadId,
		});

		if (handled?.handled && handled.response) {
			stageTrace.mark("chat_sdk_report_artifact_route_handled", {
				threadId: reportThreadId,
				skillId: workItemReportRequest.skillId,
			});
			await pipeWebResponseToExpressResponse(handled.response, res);
			return true;
		}
	} finally {
		cleanup();
	}

	return false;
}

module.exports = {
	handleWorkItemReportRoute,
};
