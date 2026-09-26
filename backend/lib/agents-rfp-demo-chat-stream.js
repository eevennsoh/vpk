"use strict";

const { getAiSdk } = require("./ai-sdk-runtime");
const {
	RFP_DEMO_REPORT_PREVIEW_SUMMARY,
	RFP_DEMO_REPORT_TITLE,
	RFP_DEMO_QUESTION_TOOL_CALL_ID,
	buildAgentsRfpDemoAnswerTrace,
	buildAgentsRfpDemoAgentCreationConfirmationText,
	buildAgentsRfpDemoAgentCreationTrace,
	buildAgentsRfpDemoAgentResultPayload,
	buildAgentsRfpDemoQualificationIntro,
	buildAgentsRfpDemoQualificationTrace,
	buildAgentsRfpDemoQuestionCardPayload,
	buildAgentsRfpDemoReportConfirmationText,
	extractAgentsRfpDemoSelectedKnowledge,
	getAgentsRfpDemoPreloadDelayMs,
	getAgentsRfpDemoToolCallDelayMs,
} = require("./agents-rfp-demo-chat");
const { buildQuestionMetaFromQuestionCardPayload: defaultBuildQuestionMetaFromQuestionCardPayload } = require("./ai-gateway-deferred-tools");
const { createRouteDecisionPart } = require("./route-decision");
const { getNonEmptyString } = require("./shared-utils");
const {
	generateWorkItemVpkHtmlReport: defaultGenerateWorkItemVpkHtmlReport,
} = require("./work-item-vpk-html-report-generator");

function requireFunction(name, value) {
	if (typeof value !== "function") {
		throw new Error(`createAgentsRfpDemoChatStreamOwner requires ${name}`);
	}
	return value;
}

function waitForAgentsRfpDemoTraceDelay(delayMs) {
	return new Promise((resolve) => {
		setTimeout(resolve, delayMs);
	});
}

function createAgentsRfpDemoThinkingEventPart(step, phase) {
	const timestamp = new Date().toISOString();
	const part = {
		type: "data-thinking-event",
		id: `${step.toolCallId}-${phase}`,
		data: {
			eventId: `${step.toolCallId}-${phase}`,
			phase,
			toolName: step.toolName,
			label: step.label,
			toolCallId: step.toolCallId,
			timestamp,
		},
	};

	if (phase === "start" && step.input !== undefined) {
		part.data.input = step.input;
	}
	if (phase === "result") {
		part.data.output = step.output ?? step.outputPreview ?? "Completed.";
		if (step.outputPreview) {
			part.data.outputPreview = step.outputPreview;
		}
	}

	return part;
}

function buildAgentsRfpDemoReportPreviewFields(variant) {
	if (variant === "refined" || variant === "branded") {
		return {
			includeAtlassianLogo: variant === "branded",
			recommendationText: "Provisional recommendation: respond to the Acmecorp RFP only if budget, stakeholder access, and review owners are confirmed before the team commits to a full response package.",
			driverText: "Driver: Maya Chen, proposal manager.",
			approverText: "Approver: Darius Pavri for deal desk and Elena Ruiz for security/legal posture.",
			contributorsText: "Contributors: Jordan Lee, Priya Shah, product specialists, and partner coverage owners.",
			informedText: "Informed: executive sponsor, support leadership, and partner teams after the bid/no-bid decision is recorded.",
			relationshipText: "Relationship is workable but not complete: the account team has working-level Acmecorp context, while executive sponsor access and champion strength still need confirmation.",
			budgetText: "Budget is not fully qualified; treat the multi-thousand-user scale as a pursuit signal, not proof that Acmecorp has approved spend.",
			campaignFitText: "Acmecorp is a strong fit for the enterprise service-management campaign because the RFP centers on ITSM, CMDB maturity, knowledge, reporting, governed AI, and cross-team service delivery.",
			competitiveAdvantages: [
				"Atlassian can connect service, software, knowledge, and business teams through one system of work.",
				"Jira Service Management plus Assets supports the Acmecorp ITSM, portal, incident, change, and CMDB story.",
				"Rovo and Teamwork Graph give the response a credible AI and knowledge-reuse differentiator.",
			],
			decisionRisks: [
				"Budget qualification and discount guardrails are not confirmed.",
				"Legal, data residency, audit, vulnerability, and pricing answers need owner approval.",
				"HAM/SAM and partner coverage need careful positioning before customer-facing commitments.",
			],
			openGaps: [
				"Executive sponsor and champion strength are not recorded in the Work Item context.",
				"Approved legal wording for data residency, audit, and vulnerability responses is not recorded.",
				"Deal desk pricing approval timing and discount guardrails are not recorded.",
			],
		};
	}

	return {
		recommendationText: "Initial recommendation: qualify Acmecorp before responding; the platform fit is strong, but budget, stakeholder relationship, and review ownership need confirmation.",
		driverText: "Driver: Maya Chen, proposal manager.",
		approverText: "Approver: Darius Pavri for deal desk and Elena Ruiz for security/legal posture.",
		contributorsText: "Contributors: Jordan Lee for account strategy, Priya Shah for sales engineering, and product specialists for risky sections.",
		informedText: "Informed: executive stakeholders, support leadership, and partner teams once the bid/no-bid recommendation is recorded.",
		relationshipText: "The Work Item shows active account and proposal ownership for Acmecorp, but it does not prove executive sponsor access or champion strength.",
		budgetText: "Acmecorp scale is recorded as multi-thousand users; budget qualification is still pending and should remain a decision gate.",
		campaignFitText: "Acmecorp fits the enterprise service-management campaign through tool consolidation, ITSM workflows, CMDB maturity, knowledge, reporting, AI readiness, and governed compliance requirements.",
		competitiveAdvantages: [
			"Atlassian System of Work maps well to Acmecorp's fragmented service and work-management environment.",
			"Jira Service Management, Assets, Confluence, Guard, and automation cover the core operating model.",
			"Rovo and Teamwork Graph add a differentiated AI and knowledge-reuse story.",
		],
		decisionRisks: [
			"Budget qualification is not confirmed.",
			"Legal, data residency, audit, vulnerability, HAM/SAM, and pricing responses need owner review.",
			"CMDB scale and asset-management assumptions need credible evidence before final response drafting.",
		],
		openGaps: [
			"Bid/no-bid decision date and final approval owner are not specified.",
			"Stakeholder relationship strength is not confirmed.",
			"Required data residency region is not recorded in the Work Item context.",
		],
	};
}

function createAgentsRfpDemoChatStreamOwner({
	agentsRfpDemoStateManager,
	updateAgentsRfpDemoState,
	buildQuestionMetaFromQuestionCardPayload = defaultBuildQuestionMetaFromQuestionCardPayload,
	createUIMessageStream,
	generateTextViaGateway,
	generateWorkItemVpkHtmlReport = defaultGenerateWorkItemVpkHtmlReport,
	pipeUIMessageStreamToResponse,
	requestUserInputQuestionMetaStore,
	rovoAppDocumentManager,
	rovoAppThreadManager,
	waitForTraceDelay = waitForAgentsRfpDemoTraceDelay,
} = {}) {
	if (!createUIMessageStream || !pipeUIMessageStreamToResponse) {
		const aiSdk = getAiSdk();
		createUIMessageStream ||= aiSdk.createUIMessageStream;
		pipeUIMessageStreamToResponse ||= aiSdk.pipeUIMessageStreamToResponse;
	}

	requireFunction("agentsRfpDemoStateManager.readState", agentsRfpDemoStateManager?.readState);
	requireFunction("updateAgentsRfpDemoState", updateAgentsRfpDemoState);
	requireFunction("buildQuestionMetaFromQuestionCardPayload", buildQuestionMetaFromQuestionCardPayload);
	requireFunction("createUIMessageStream", createUIMessageStream);
	requireFunction("generateTextViaGateway", generateTextViaGateway);
	requireFunction("generateWorkItemVpkHtmlReport", generateWorkItemVpkHtmlReport);
	requireFunction("pipeUIMessageStreamToResponse", pipeUIMessageStreamToResponse);
	requireFunction("requestUserInputQuestionMetaStore.set", requestUserInputQuestionMetaStore?.set);
	requireFunction("rovoAppDocumentManager.createDocument", rovoAppDocumentManager?.createDocument);
	requireFunction("rovoAppThreadManager.getThread", rovoAppThreadManager?.getThread);
	requireFunction("rovoAppThreadManager.updateThread", rovoAppThreadManager?.updateThread);
	requireFunction("waitForTraceDelay", waitForTraceDelay);

	async function writeAgentsRfpDemoTrace(writer, steps) {
		for (const step of steps) {
			const toolCallDelayMs =
				typeof step.delayMs === "number" && Number.isFinite(step.delayMs) && step.delayMs > 0
					? step.delayMs
					: getAgentsRfpDemoToolCallDelayMs();
			const hasResult = step.output !== undefined || step.outputPreview;
			const resultDelayMs = hasResult
				? Math.round(toolCallDelayMs * 0.7)
				: toolCallDelayMs;
			const resultHoldDelayMs = hasResult
				? Math.max(0, toolCallDelayMs - resultDelayMs)
				: 0;

			writer.write({
				type: "data-thinking-status",
				id: `${step.toolCallId}-status`,
				data: {
					label: step.label,
					content: step.content,
					activity: "data",
					source: "backend",
					timestamp: new Date().toISOString(),
				},
			});
			writer.write(createAgentsRfpDemoThinkingEventPart(step, "start"));
			await waitForTraceDelay(resultDelayMs);
			if (hasResult) {
				writer.write(createAgentsRfpDemoThinkingEventPart(step, "result"));
				if (resultHoldDelayMs > 0) {
					await waitForTraceDelay(resultHoldDelayMs);
				}
			}
		}
	}

	function writeAgentsRfpDemoText(writer, id, text) {
		writer.write({ type: "text-start", id });
		writer.write({
			type: "text-delta",
			id,
			delta: text,
		});
		writer.write({ type: "text-end", id });
	}

	async function createAgentsRfpDemoReportArtifact(requestBody) {
		const threadId = getNonEmptyString(requestBody?.id);
		if (!threadId) {
			throw new Error("Cannot create the RFP report artifact without an active Rovo thread.");
		}

		const report = await generateWorkItemVpkHtmlReport({
			contextDescription: requestBody.contextDescription,
			generateText: (options) =>
				generateTextViaGateway({
					...options,
					backendPreference: "ai-gateway",
					provider: options?.provider || getNonEmptyString(requestBody.provider),
				}),
			provider: getNonEmptyString(requestBody.provider),
			runSkillValidation: true,
			runVisualVerify: false,
		});
		const artifactDocument = await rovoAppDocumentManager.createDocument({
			threadId,
			title: RFP_DEMO_REPORT_TITLE,
			kind: "html",
			content: report.html,
			previewSummary: RFP_DEMO_REPORT_PREVIEW_SUMMARY,
			changeLabel: "Generated with vpk-html",
			sourceMessageId: null,
		});
		await rovoAppThreadManager.updateThread(threadId, {
			activeDocumentId: artifactDocument.id,
		});

		return artifactDocument;
	}

	async function generateAgentsRfpDemoReportPreview(requestBody) {
		const contextDescription = getNonEmptyString(requestBody?.contextDescription);
		if (!contextDescription) {
			throw new Error("contextDescription is required");
		}

		const variant = getNonEmptyString(requestBody?.variant) === "refined"
			? "refined"
			: getNonEmptyString(requestBody?.variant) === "branded"
			? "branded"
			: "initial";
		const report = await generateWorkItemVpkHtmlReport({
			contextDescription,
			generateText: async () => JSON.stringify(buildAgentsRfpDemoReportPreviewFields(variant)),
			runSkillValidation: false,
			runVisualVerify: false,
		});

		return {
			html: report.html,
			skill: report.skill,
			variant,
		};
	}

	function writeAgentsRfpDemoArtifactResult(writer, artifactDocument) {
		writer.write({
			type: "data-artifact-result",
			data: {
				documentId: artifactDocument.id,
				threadId: artifactDocument.threadId,
				title: artifactDocument.title,
				kind: artifactDocument.kind,
				action: "create",
			},
		});
	}

	function writeAgentsRfpDemoAgentResult(writer, options = {}) {
		writer.write({
			type: "data-agent-result",
			data: buildAgentsRfpDemoAgentResultPayload(options),
		});
	}

	function writeAgentsRfpDemoTurnComplete(writer, intent = "chat") {
		writer.write(createRouteDecisionPart({
			intent,
			origin: "text",
			reason: "agents_rfp_demo",
		}));
		writer.write({
			type: "data-turn-complete",
			data: { timestamp: new Date().toISOString() },
		});
	}

	function streamAgentsRfpDemoChatTurn(res, turn, requestBody) {
		const creationMode =
			requestBody?.creationMode === "agent" || requestBody?.creationMode === "skill"
				? requestBody.creationMode
				: null;
		const stream = createUIMessageStream({
			execute: async ({ writer }) => {
				if (turn === "agent-creation") {
					const currentState = await agentsRfpDemoStateManager.readState();
					const selectedKnowledge = getNonEmptyString(currentState.chat?.selectedRfpKnowledge);
					await writeAgentsRfpDemoTrace(writer, buildAgentsRfpDemoAgentCreationTrace({ selectedKnowledge }));
					writeAgentsRfpDemoAgentResult(writer, { selectedKnowledge });
					writeAgentsRfpDemoText(
						writer,
						`agents-rfp-demo-agent-created-${Date.now()}`,
						buildAgentsRfpDemoAgentCreationConfirmationText(),
					);
					writeAgentsRfpDemoTurnComplete(writer);
					return;
				}

				if (turn === "qualification-answer") {
					const selectedKnowledge = extractAgentsRfpDemoSelectedKnowledge(requestBody);
					if (selectedKnowledge) {
						await updateAgentsRfpDemoState((currentState) => ({
							...currentState,
							chat: {
								...currentState.chat,
								selectedRfpKnowledge: selectedKnowledge,
							},
						}));
					}
					await writeAgentsRfpDemoTrace(writer, buildAgentsRfpDemoAnswerTrace());
					const artifactDocument = await createAgentsRfpDemoReportArtifact(requestBody);
					writeAgentsRfpDemoArtifactResult(writer, artifactDocument);
					writeAgentsRfpDemoText(
						writer,
						`agents-rfp-demo-report-${Date.now()}`,
						buildAgentsRfpDemoReportConfirmationText({
							documentId: artifactDocument.id,
							title: artifactDocument.title,
						}),
					);
					writeAgentsRfpDemoTurnComplete(writer, "artifact_create");
					return;
				}

				const preloadDelayMs = getAgentsRfpDemoPreloadDelayMs(turn);
				if (preloadDelayMs > 0) {
					await waitForTraceDelay(preloadDelayMs);
				}

				const questionCardPayload = buildAgentsRfpDemoQuestionCardPayload();
				requestUserInputQuestionMetaStore.set(
					questionCardPayload.sessionId,
					buildQuestionMetaFromQuestionCardPayload(questionCardPayload),
				);
				await writeAgentsRfpDemoTrace(writer, buildAgentsRfpDemoQualificationTrace());
				writeAgentsRfpDemoText(
					writer,
					`agents-rfp-demo-qualification-${Date.now()}`,
					buildAgentsRfpDemoQualificationIntro(),
				);
				writer.write({
					type: "data-widget-data",
					id: RFP_DEMO_QUESTION_TOOL_CALL_ID,
					data: {
						type: "question-card",
						payload: {
							...questionCardPayload,
							...(creationMode === "agent" || creationMode === "skill"
								? { creationMode }
								: {}),
							toolCallId: RFP_DEMO_QUESTION_TOOL_CALL_ID,
							deferredToolCallId: RFP_DEMO_QUESTION_TOOL_CALL_ID,
							tool_call_id: RFP_DEMO_QUESTION_TOOL_CALL_ID,
						},
					},
				});
				writeAgentsRfpDemoTurnComplete(writer);
			},
			onError: (error) => {
				if (error instanceof Error) {
					return error.message;
				}
				return "Failed to stream RFP demo response";
			},
		});

		pipeUIMessageStreamToResponse({
			response: res,
			stream,
		});
	}

	return {
		createAgentsRfpDemoReportArtifact,
		generateAgentsRfpDemoReportPreview,
		streamAgentsRfpDemoChatTurn,
		writeAgentsRfpDemoTrace,
	};
}

module.exports = {
	buildAgentsRfpDemoReportPreviewFields,
	createAgentsRfpDemoChatStreamOwner,
	createAgentsRfpDemoThinkingEventPart,
	waitForAgentsRfpDemoTraceDelay,
};
