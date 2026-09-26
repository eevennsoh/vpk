const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROVO_APP_RUNTIME_COMPOSITION_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "backend/lib/rovo-app-runtime-composition.js"),
	"utf8",
);
const CHAT_SDK_HANDLER_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "backend/chat/chat-sdk-handler.js"),
	"utf8",
);
const REQUEST_USER_INPUT_QUESTION_CARD_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "backend/chat/request-user-input-question-card.js"),
	"utf8",
);
const AI_GATEWAY_FINAL_OUTPUT_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "backend/chat/ai-gateway-final-output.js"),
	"utf8",
);
const ROVO_MARKER_STREAM_ADAPTER_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "backend/chat/rovo-marker-stream-adapter.js"),
	"utf8",
);
const ROVO_STREAM_TEXT_DELTA_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "backend/chat/rovo-stream-text-delta.js"),
	"utf8",
);
const ROVO_CHAT_STREAM_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "backend/chat/rovo-chat-stream.js"),
	"utf8",
);
const WORK_ITEM_REPORT_ROUTE_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "backend/chat/work-item-report-route.js"),
	"utf8",
);
const CHAT_ROUTE_DECISION_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "backend/chat/route-decision.js"),
	"utf8",
);
const AGENTS_RFP_DEMO_CHAT_STREAM_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "backend/lib/agents-rfp-demo-chat-stream.js"),
	"utf8",
);
const ROVO_APP_ARTIFACT_GENERATION_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "backend/lib/rovo-app-artifact-generation.js"),
	"utf8",
);
const ROVO_APP_ARTIFACT_TOOL_RESPONSE_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "backend/lib/rovo-app-artifact-tool-response.js"),
	"utf8",
);
const ROVO_APP_MANAGED_RUN_PREPARATION_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "backend/lib/rovo-app-managed-run-preparation.js"),
	"utf8",
);
const ROVO_APP_MANAGED_RUN_ROUTING_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "backend/lib/rovo-app-managed-run-routing.js"),
	"utf8",
);
const DEMOS_ROUTE_SOURCE = fs.readFileSync(path.join(process.cwd(), "backend/routes/demos.js"), "utf8");
const ROVO_CHAT_CONTEXT_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "app/contexts/context-rovo-chat.tsx"),
	"utf8",
);
const ROVO_CHAT_HELPERS_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "app/contexts/rovo-chat-helpers.ts"),
	"utf8",
);
const SIDEBAR_SUBMIT_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/sidebar-chat/hooks/use-chat-submit.ts"),
	"utf8",
);
const FLOATING_CHAT_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/rovo-floating-chat/components/rovo-floating-chat.tsx"),
	"utf8",
);
const MESSAGE_MARKDOWN_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/ui-custom/message-markdown.tsx"),
	"utf8",
);
const AGENTS_VIEW_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/jira/page.tsx"),
	"utf8",
);

test("shared chat prompt path auto-routes Work Item vpk-html artifact intents for sidebar and floating chat", () => {
	assert.match(
		ROVO_CHAT_CONTEXT_SOURCE,
		/resolveWorkItemReportPromptOptions\(\s*trimmedPrompt,\s*mergeSendPromptOptions/u,
	);
	assert.match(
		ROVO_CHAT_HELPERS_SOURCE,
		/if \(options\?\.creationMode === "agent"\) \{[\s\S]*return options;/u,
	);
	assert.doesNotMatch(
		ROVO_CHAT_HELPERS_SOURCE,
		/options\?\.creationMode === "agent" \|\| options\?\.creationMode === "skill"/u,
	);
	assert.match(
		ROVO_CHAT_HELPERS_SOURCE,
		/buildWorkItemReportRequestContext\(\{[\s\S]*skillId: VPK_HTML_SKILL_ID/u,
	);
	assert.doesNotMatch(
		ROVO_CHAT_HELPERS_SOURCE,
		/mergeHermesSkillIds|hermesContext/u,
	);
	assert.match(
		SIDEBAR_SUBMIT_SOURCE,
		/sendPrompt\(\s*promptText,\s*defaultPromptOptions,\s*files\s*\)/u,
	);
	assert.match(
		FLOATING_CHAT_SOURCE,
		/import ChatPanel from "@\/components\/projects\/sidebar-chat\/page";/u,
	);
	assert.match(FLOATING_CHAT_SOURCE, /<ChatPanel/u);
});

test("backend Work Item artifact route uses the vpk-html runner and emits an html artifact result", () => {
	assert.match(
		ROVO_APP_RUNTIME_COMPOSITION_SOURCE,
		/createRovoAppArtifactToolResponseStreamer: defaultCreateRovoAppArtifactToolResponseStreamer/u,
	);
	assert.match(
		ROVO_APP_ARTIFACT_TOOL_RESPONSE_SOURCE,
		/const \{\s*generateWorkItemVpkHtmlReport: defaultGenerateWorkItemVpkHtmlReport,\s*\} = require\("\.\/work-item-vpk-html-report-generator"\);/u,
	);
	assert.match(ROVO_APP_ARTIFACT_TOOL_RESPONSE_SOURCE, /generateWorkItemVpkHtmlReport\(\{/u);
	assert.match(ROVO_APP_ARTIFACT_GENERATION_SOURCE, /function shouldUseWorkItemVpkHtmlReportGenerator\(\{/u);
	assert.match(ROVO_APP_ARTIFACT_GENERATION_SOURCE, /hasActiveWorkItemContext\(contextDescription\)/u);
	assert.match(ROVO_APP_ARTIFACT_GENERATION_SOURCE, /contextDescription\.includes\(WORK_ITEM_REPORT_REQUEST_START\) \|\|[\s\S]*isWorkItemReportIntent\(latestUserMessage\)/u);
	assert.match(ROVO_APP_ARTIFACT_TOOL_RESPONSE_SOURCE, /const shouldUseWorkItemVpkHtmlSkill = shouldUseWorkItemVpkHtmlReportGenerator\(\{[\s\S]*artifactKind: artifactDocument\.kind,[\s\S]*contextDescription,[\s\S]*latestUserMessage/u);
	assert.match(ROVO_APP_ARTIFACT_TOOL_RESPONSE_SOURCE, /if \(shouldUseWorkItemVpkHtmlSkill\) \{[\s\S]*generateWorkItemVpkHtmlReport\(\{/u);
	assert.match(ROVO_APP_ARTIFACT_TOOL_RESPONSE_SOURCE, /backendPreference:\s*"ai-gateway"/u);
	assert.match(CHAT_SDK_HANDLER_SOURCE, /handleWorkItemReportRoute\(\{/u);
	assert.match(WORK_ITEM_REPORT_ROUTE_SOURCE, /futureArtifactKind:\s*"html"/u);
	assert.match(ROVO_APP_ARTIFACT_TOOL_RESPONSE_SOURCE, /type:\s*"data-artifact-result"/u);
	assert.match(ROVO_APP_ARTIFACT_TOOL_RESPONSE_SOURCE, /threadId:\s*persistedArtifactDocument\.threadId/u);
	assert.match(ROVO_APP_ARTIFACT_TOOL_RESPONSE_SOURCE, /documentId:\s*persistedArtifactDocument\.id/u);
	assert.match(AGENTS_RFP_DEMO_CHAT_STREAM_SOURCE, /threadId:\s*artifactDocument\.threadId/u);
	assert.match(AGENTS_RFP_DEMO_CHAT_STREAM_SOURCE, /documentId:\s*artifactDocument\.id/u);
	assert.match(AGENTS_RFP_DEMO_CHAT_STREAM_SOURCE, /buildAgentsRfpDemoReportConfirmationText\(\{[\s\S]*documentId:\s*artifactDocument\.id/u);
	assert.match(DEMOS_ROUTE_SOURCE, /router\.post\("\/agents\/rfp-demo\/vpk-html-report"/u);
	assert.match(DEMOS_ROUTE_SOURCE, /generateAgentsRfpDemoReportPreview\(req\.body \|\| \{\}\)/u);
	assert.match(AGENTS_RFP_DEMO_CHAT_STREAM_SOURCE, /runSkillValidation:\s*false/u);
	assert.match(MESSAGE_MARKDOWN_SOURCE, /const prefix = "#rovo-canvas-";/u);
	assert.match(MESSAGE_MARKDOWN_SOURCE, /window\.dispatchEvent\(new CustomEvent\("rovo:open-canvas-artifact"/u);
	assert.match(AGENTS_VIEW_SOURCE, /window\.addEventListener\("rovo:open-canvas-artifact", handleOpenRfpCanvas\);/u);
	assert.match(AGENTS_VIEW_SOURCE, /event\.preventDefault\(\);[\s\S]*rfpDemo\.actions\.setCanvasOpen\(true\);/u);
});

test("RFP demo agent creation emits an agent result instead of an artifact result", () => {
	assert.match(ROVO_APP_MANAGED_RUN_PREPARATION_SOURCE, /const requestCreationMode =[\s\S]*requestBody\.creationMode === "agent"[\s\S]*requestBody\.creationMode[\s\S]*: null;/u);
	assert.match(
		ROVO_APP_MANAGED_RUN_ROUTING_SOURCE,
		/resolveManagedRunDeterministicRouteDecision\(\{[\s\S]*requestCreationMode,[\s\S]*workItemReportRequest,[\s\S]*\}\)/u,
	);
	assert.match(
		CHAT_ROUTE_DECISION_SOURCE,
		/if \(requestCreationMode === "agent"\) \{[\s\S]*reason: "agent_creation_mode"[\s\S]*if \(workItemReportRequest\.isIntent && !workItemReportRequest\.hasContext\)/u,
	);
	assert.match(ROVO_APP_MANAGED_RUN_ROUTING_SOURCE, /creationMode: requestCreationMode/u);
	assert.match(AGENTS_RFP_DEMO_CHAT_STREAM_SOURCE, /turn === "agent-creation"/u);
	assert.match(AGENTS_RFP_DEMO_CHAT_STREAM_SOURCE, /buildAgentsRfpDemoAgentCreationTrace\(\{ selectedKnowledge \}\)/u);
	assert.match(AGENTS_RFP_DEMO_CHAT_STREAM_SOURCE, /type:\s*"data-agent-result"/u);
	assert.match(AGENTS_RFP_DEMO_CHAT_STREAM_SOURCE, /buildAgentsRfpDemoAgentCreationConfirmationText\(\)/u);
	assert.match(
		AGENTS_RFP_DEMO_CHAT_STREAM_SOURCE,
		/if \(turn === "agent-creation"\) \{[\s\S]*writeAgentsRfpDemoAgentResult\(writer, \{ selectedKnowledge \}\);[\s\S]*writeAgentsRfpDemoTurnComplete\(writer\);[\s\S]*return;\s*\}\s*if \(turn === "qualification-answer"\)/u,
	);
});

test("backend clarification question cards preserve creation mode metadata", () => {
	assert.match(
		AGENTS_RFP_DEMO_CHAT_STREAM_SOURCE,
		/payload: \{\s*\.\.\.questionCardPayload,[\s\S]*\.\.\.\(creationMode === "agent" \|\| creationMode === "skill"[\s\S]*\? \{ creationMode \}/u,
	);
	assert.match(
		REQUEST_USER_INPUT_QUESTION_CARD_SOURCE,
		/payload: \{\s*\.\.\.payload,[\s\S]*\.\.\.\(creationMode === "agent" \|\| creationMode === "skill"[\s\S]*\? \{ creationMode \}/u,
	);
	assert.match(
		ROVO_MARKER_STREAM_ADAPTER_SOURCE,
		/resolvedWidgetType === clarificationWidgetType &&[\s\S]*\(creationMode === "agent" \|\| creationMode === "skill"\)[\s\S]*\.\.\.parsedWidget,[\s\S]*creationMode/u,
	);
	assert.match(ROVO_CHAT_STREAM_SOURCE, /createRovoMarkerStreamAdapter\(\{/u);
});

test("Rovo agent-result stream parser uses shared tolerant JSON parsing", () => {
	assert.match(
		ROVO_MARKER_STREAM_ADAPTER_SOURCE,
		/parseAgentResultObject = parseJsonObjectAt/u,
	);
	assert.match(
		ROVO_MARKER_STREAM_ADAPTER_SOURCE,
		/if \(creationMode === "agent" && textBuffer\.startsWith\(agentResultPrefix\)\) \{[\s\S]*processAgentResult\(isFinalChunk\)/u,
	);
	assert.match(
		ROVO_MARKER_STREAM_ADAPTER_SOURCE,
		/const processAgentResult = \(isFinalChunk\) => \{[\s\S]*const parsedAgentResult = parseAgentResultObject\(\s*textBuffer,\s*jsonStartIndex\s*\);/u,
	);
	assert.match(
		ROVO_MARKER_STREAM_ADAPTER_SOURCE,
		/const normalizedAgentResult = normalizeStudioAgentResult\(\s*parsedAgentResult\.value\s*\);/u,
	);
	assert.doesNotMatch(
		ROVO_MARKER_STREAM_ADAPTER_SOURCE,
		/normalizeStudioAgentResult\(\s*JSON\.parse\(jsonPayload\)\s*\)/u,
	);
	assert.match(ROVO_STREAM_TEXT_DELTA_SOURCE, /rovoMarkerStream\.push\(delta\)/u);
	assert.match(ROVO_CHAT_STREAM_SOURCE, /rovoMarkerStream\.flush\(\)/u);
});

test("agent-creation fallback question cards strip internal deferred-tool text", () => {
	assert.match(
		AI_GATEWAY_FINAL_OUTPUT_SOURCE,
		/stripDeferredToolFencesFromText/u,
	);
	assert.match(
		AI_GATEWAY_FINAL_OUTPUT_SOURCE,
		/isFirstAgentCreationTurn &&[\s\S]*fallbackAgentCreationQuestionInput[\s\S]*visibleText = stripDeferredToolFencesFromText\(visibleText\);/u,
	);
	assert.match(
		CHAT_SDK_HANDLER_SOURCE,
		/fallbackAgentCreationQuestionInput:\s*FALLBACK_AGENT_CREATION_QUESTION_INPUT/u,
	);
});
