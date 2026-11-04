const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const MESSAGES_SOURCE = fs.readFileSync(
	path.join(__dirname, "rovo-app-messages.tsx"),
	"utf8",
);
const CORE_MESSAGES_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/rovo-core/components/rovo-app-messages.tsx"),
	"utf8",
);
const AUTOMATION_ARTIFACT_LIST_WIDGET_SOURCE = fs.readFileSync(
	path.join(__dirname, "studio-automation-artifact-list-widget.tsx"),
	"utf8",
);
const AUTOMATION_ARTIFACT_LIST_LIB_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "lib", "studio-automation-artifact-list.ts"),
	"utf8",
);
const AUTOMATION_DISCOVERY_PROMPT_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "lib", "studio-automation-discovery-prompt.ts"),
	"utf8",
);
const SHELL_SOURCE = fs.readFileSync(
	path.join(__dirname, "rovo-app-shell.tsx"),
	"utf8",
);
const GENERATING_AGENTS_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "lib", "studio-automation-generating-agents.ts"),
	"utf8",
);
const THINKING_TRACE_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/shared/components/assistant-thinking-trace.tsx"),
	"utf8",
);
const THINKING_TRACE_PRESENTATION_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/shared/lib/assistant-thinking-trace-presentation.tsx"),
	"utf8",
);
const TWG_TOOL_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/ui-custom/twg-tool.tsx"),
	"utf8",
);
const CHAIN_OF_THOUGHT_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/ui-custom/chain-of-thought.tsx"),
	"utf8",
);
const USE_ROVO_APP_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "hooks", "use-rovo-app.ts"),
	"utf8",
);
const ROVO_APP_CHAT_TRANSPORT_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/rovo-core/hooks/use-rovo-app-chat-transport.ts"),
	"utf8",
);
const STUDIO_APP_ADAPTER_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/studio/studio-app-adapter.ts"),
	"utf8",
);
const BACKEND_CHAT_SDK_HANDLER_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "backend/chat/chat-sdk-handler.js"),
	"utf8",
);
const BACKEND_CHAT_REQUEST_NORMALIZATION_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "backend/chat/request-normalization.js"),
	"utf8",
);
const BACKEND_AUTOMATION_DISCOVERY_CHAT_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "backend/lib/studio-automation-discovery-chat.js"),
	"utf8",
);
const BACKEND_AUTOMATION_DISCOVERY_DEMO_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "backend/lib/studio-automation-discovery-demo.js"),
	"utf8",
);
const BACKEND_AUTOMATION_DISCOVERY_DEMO_DATA_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "backend/lib/studio-automation-discovery-demo-data.js"),
	"utf8",
);

test("Studio automation discovery widget renders with ArtifactList and row selection", () => {
	assert.match(AUTOMATION_ARTIFACT_LIST_WIDGET_SOURCE, /import \{ ArtifactList \} from "@\/components\/ui-custom\/artifact-list";/u);
	assert.match(AUTOMATION_ARTIFACT_LIST_WIDGET_SOURCE, /import type \{ StudioAutomationArtifactListPayload \} from "@\/components\/projects\/studio\/lib\/studio-automation-artifact-list";/u);
	assert.match(AUTOMATION_ARTIFACT_LIST_LIB_SOURCE, /export const STUDIO_AUTOMATION_ARTIFACT_LIST_TYPE = "studio-automation-artifact-list";/u);
	assert.match(AUTOMATION_ARTIFACT_LIST_LIB_SOURCE, /export function parseStudioAutomationArtifactListPayload\(payload: unknown\)/u);
	assert.match(AUTOMATION_ARTIFACT_LIST_LIB_SOURCE, /function parseStudioAutomationAgentResult\(value: unknown\)/u);
	assert.match(AUTOMATION_ARTIFACT_LIST_LIB_SOURCE, /const agentId = getString\(record\.agentId\);[\s\S]*const name = getString\(record\.name\);[\s\S]*const summary = getString\(record\.summary\);/u);
	assert.doesNotMatch(AUTOMATION_ARTIFACT_LIST_WIDGET_SOURCE, /isGeneratedAgentResult/u);
	assert.match(AUTOMATION_ARTIFACT_LIST_WIDGET_SOURCE, /function StudioAutomationArtifactListWidget/u);
	assert.match(AUTOMATION_ARTIFACT_LIST_WIDGET_SOURCE, /<ArtifactList[\s\S]*openLabel="View agent"[\s\S]*onOpen=\{\(item\) => \{/u);
	assert.match(AUTOMATION_ARTIFACT_LIST_WIDGET_SOURCE, /<ArtifactList[\s\S]*openOnRowClick/u);
	assert.match(AUTOMATION_ARTIFACT_LIST_WIDGET_SOURCE, /onAgentResultSelect\?\.\(agent, \{ sourceMessageId: messageId \}\);/u);
	assert.match(MESSAGES_SOURCE, /from "@\/components\/projects\/studio\/components\/studio-automation-artifact-list-widget";/u);
	assert.match(MESSAGES_SOURCE, /renderCustomWidget=\{\(\{ message, widget \}\) => \{/u);
	assert.match(MESSAGES_SOURCE, /widget\.type !== STUDIO_AUTOMATION_ARTIFACT_LIST_TYPE/u);
	assert.match(MESSAGES_SOURCE, /parseStudioAutomationArtifactListPayload\(widget\.payload\)/u);
	assert.match(MESSAGES_SOURCE, /<StudioAutomationArtifactListWidget/u);
	assert.match(MESSAGES_SOURCE, /onAgentResultSelect=\{onAgentResultSelect\}/u);
	assert.match(CORE_MESSAGES_SOURCE, /renderCustomWidget\?: \(context: RovoAppCustomWidgetRenderContext\) => ReactNode;/u);
	assert.doesNotMatch(CORE_MESSAGES_SOURCE, /StudioAutomationArtifactListWidget/u);
	assert.doesNotMatch(MESSAGES_SOURCE, /<section className="w-full max-w-3xl rounded-lg border border-border bg-surface-raised p-3">/u);
});

test("Studio automation discovery result keeps clearance above the sticky composer", () => {
	assert.match(MESSAGES_SOURCE, /contentSpacingClassName="pt-6 pb-32"/u);
	assert.match(CORE_MESSAGES_SOURCE, /contentSpacingClassName = "py-6"/u);
});

test("Studio automation discovery widget is visible on text-routed tool responses", () => {
	assert.match(MESSAGES_SOURCE, /const STUDIO_TOOL_DRIVEN_WIDGET_TYPES = new Set\(\[[\s\S]*STUDIO_AUTOMATION_ARTIFACT_LIST_TYPE,[\s\S]*\]\);/u);
	assert.match(MESSAGES_SOURCE, /additionalToolDrivenWidgetTypes=\{STUDIO_TOOL_DRIVEN_WIDGET_TYPES\}/u);
	assert.doesNotMatch(MESSAGES_SOURCE, /"studio-automation-artifact-list"/u);
});

test("Studio requests preserve their chat SDK source through the Rovo app proxy", () => {
	assert.match(USE_ROVO_APP_SOURCE, /routeAdapter: studioAppAdapter/u);
	assert.match(ROVO_APP_CHAT_TRANSPORT_SOURCE, /\.\.\.routeAdapter\.chatRequestBodyOptions/u);
	assert.match(STUDIO_APP_ADAPTER_SOURCE, /chatSdkSource: "studio"/u);
	assert.match(BACKEND_CHAT_REQUEST_NORMALIZATION_SOURCE, /chatSdkSource: rawChatSdkSource/u);
	assert.match(BACKEND_CHAT_REQUEST_NORMALIZATION_SOURCE, /const chatSdkSource = getNonEmptyString\(rawChatSdkSource\) \|\| "direct";/u);
	assert.match(BACKEND_CHAT_SDK_HANDLER_SOURCE, /chatSdkSource,/u);
});

test("Studio automation discovery clarification emits pre-question thinking before awaiting input", () => {
	assert.match(BACKEND_AUTOMATION_DISCOVERY_CHAT_SOURCE, /function buildStudioAutomationDiscoveryInitialQuestionPreflightTrace/u);
	assert.match(BACKEND_AUTOMATION_DISCOVERY_CHAT_SOURCE, /toolName: "studio\.scope_agent_discovery"/u);
	assert.match(BACKEND_AUTOMATION_DISCOVERY_CHAT_SOURCE, /toolName: "studio\.plan_source_scan"/u);
	assert.match(BACKEND_AUTOMATION_DISCOVERY_CHAT_SOURCE, /await writeStudioAutomationDiscoveryQuestionPreflightTrace/u);
	assert.match(BACKEND_AUTOMATION_DISCOVERY_CHAT_SOURCE, /label: "Waiting for your choices"/u);
	assert.match(BACKEND_AUTOMATION_DISCOVERY_CHAT_SOURCE, /type: "data-thinking-event"[\s\S]*phase: "start"[\s\S]*toolName: STUDIO_AUTOMATION_DISCOVERY_QUESTION_TOOL_NAME/u);
	assert.match(BACKEND_AUTOMATION_DISCOVERY_CHAT_SOURCE, /questions: \["priority", "source-weighting", "conservatism"\]/u);
	assert.match(BACKEND_AUTOMATION_DISCOVERY_CHAT_SOURCE, /label: "Asking for draft boundaries"/u);
	assert.match(BACKEND_AUTOMATION_DISCOVERY_CHAT_SOURCE, /questions: \["creation-boundary", "approval-boundary", "hero-moment"\]/u);
	assert.match(BACKEND_AUTOMATION_DISCOVERY_CHAT_SOURCE, /Before I create any agents, I need to lock the decision frame/u);
	assert.match(BACKEND_CHAT_SDK_HANDLER_SOURCE, /handleStudioAutomationDiscoveryChatTurn/u);
	assert.doesNotMatch(BACKEND_CHAT_SDK_HANDLER_SOURCE, /function buildStudioAutomationDiscoveryInitialQuestionPreflightTrace/u);
	assert.doesNotMatch(BACKEND_CHAT_SDK_HANDLER_SOURCE, /function streamStudioAutomationDiscoveryQuestionCard/u);
	assert.doesNotMatch(BACKEND_AUTOMATION_DISCOVERY_CHAT_SOURCE, /I found the automation-discovery brief/u);
	assert.doesNotMatch(BACKEND_AUTOMATION_DISCOVERY_CHAT_SOURCE, /ranking matches Venn's presentation goals/u);
});

test("Studio automation discovery routes initial and follow-up answers to separate phases", () => {
	assert.match(BACKEND_AUTOMATION_DISCOVERY_CHAT_SOURCE, /function resolveStudioAutomationDiscoveryTurn/u);
	assert.match(BACKEND_AUTOMATION_DISCOVERY_CHAT_SOURCE, /isStudioAutomationDiscoveryInitialSession\(clarificationSubmission\?\.sessionId\)/u);
	assert.match(BACKEND_AUTOMATION_DISCOVERY_CHAT_SOURCE, /isStudioAutomationDiscoveryFollowupSession\(clarificationSubmission\?\.sessionId\)/u);
	assert.match(BACKEND_AUTOMATION_DISCOVERY_CHAT_SOURCE, /phase: "discovery"/u);
	assert.match(BACKEND_AUTOMATION_DISCOVERY_CHAT_SOURCE, /phase: "generation"/u);
	assert.match(BACKEND_AUTOMATION_DISCOVERY_CHAT_SOURCE, /isStudioAutomationDiscoveryInitialDismissalPrompt\(latestVisiblePromptText\)/u);
	assert.match(BACKEND_AUTOMATION_DISCOVERY_CHAT_SOURCE, /isStudioAutomationDiscoveryFollowupDismissalPrompt\(latestVisiblePromptText\)/u);
	assert.match(BACKEND_CHAT_SDK_HANDLER_SOURCE, /const didHandleStudioAutomationDiscovery =\s*handleStudioAutomationDiscoveryChatTurn/u);
	assert.doesNotMatch(BACKEND_CHAT_SDK_HANDLER_SOURCE, /isStudioAutomationDiscoveryInitialSession\(clarificationSubmission\?\.sessionId\)/u);
	assert.doesNotMatch(BACKEND_CHAT_SDK_HANDLER_SOURCE, /isStudioAutomationDiscoveryFollowupSession\(clarificationSubmission\?\.sessionId\)/u);
});

test("Studio automation discovery prompt does not enter generic agent creation mode", () => {
	assert.match(SHELL_SOURCE, /from "@\/components\/projects\/studio\/lib\/studio-automation-discovery-prompt";/u);
	assert.match(AUTOMATION_DISCOVERY_PROMPT_SOURCE, /export function isStudioAutomationDiscoveryDemoPrompt\(prompt: string\): boolean/u);
	assert.doesNotMatch(SHELL_SOURCE, /function isStudioAutomationDiscoveryDemoPrompt\(prompt: string\): boolean/u);
	assert.match(SHELL_SOURCE, /const isAutomationDiscoveryDemoPrompt = isStudioAutomationDiscoveryDemoPrompt\(trimmedText\);/u);
	assert.match(SHELL_SOURCE, /!isAutomationDiscoveryDemoPrompt/u);
	assert.match(SHELL_SOURCE, /\.\.\.\(shouldStartStudioAgentCreation \? \{ creationMode: "agent" as const \} : \{\}\)/u);
});

test("scripted TWG trace step renders TwgTool as the first-level step header", () => {
	assert.match(THINKING_TRACE_SOURCE, /defaultAssistantThinkingToolTracePresentationResolver/u);
	assert.match(THINKING_TRACE_SOURCE, /toolTracePresentationResolver\?: AssistantThinkingToolTracePresentationResolver/u);
	assert.match(THINKING_TRACE_SOURCE, /toolTracePresentationResolver = defaultAssistantThinkingToolTracePresentationResolver/u);
	assert.doesNotMatch(THINKING_TRACE_SOURCE, /const STUDIO_AUTOMATION_TWG_TOOL_NAME/u);
	assert.doesNotMatch(THINKING_TRACE_SOURCE, /STUDIO_AUTOMATION_THINKING_TOOL_TRACE_PRESENTATION_REGISTRY/u);
	assert.match(THINKING_TRACE_PRESENTATION_SOURCE, /import \{ TwgTool, type TwgToolSource \} from "@\/components\/ui-custom\/twg-tool";/u);
	assert.match(THINKING_TRACE_PRESENTATION_SOURCE, /export const STUDIO_AUTOMATION_THINKING_TOOL_TRACE_PRESENTATION_REGISTRY = \{/u);
	assert.match(THINKING_TRACE_PRESENTATION_SOURCE, /"twg\.search_work_patterns": \{[\s\S]*title: "Correlating through Teamwork Graph"/u);
	assert.match(THINKING_TRACE_PRESENTATION_SOURCE, /satisfies AssistantThinkingToolTracePresentationRegistry/u);
	assert.match(CHAIN_OF_THOUGHT_SOURCE, /headerRender\?: \(context: ChainOfThoughtStepHeaderRenderContext\) => ReactNode;/u);
	assert.match(THINKING_TRACE_PRESENTATION_SOURCE, /function getToolTracePresentationByline/u);
	assert.match(THINKING_TRACE_PRESENTATION_SOURCE, /function TraceNarrationRowsDetail/u);
	assert.match(THINKING_TRACE_PRESENTATION_SOURCE, /export function createAssistantThinkingToolTracePresentationResolver/u);
	assert.match(THINKING_TRACE_PRESENTATION_SOURCE, /const entry = registry\[options\.toolCall\.toolName\];/u);
	assert.match(THINKING_TRACE_PRESENTATION_SOURCE, /const renderHeader = \(\{ isOpen, toggleOpen \}: ChainOfThoughtStepHeaderRenderContext\) => \([\s\S]*<TwgTool[\s\S]*title=\{header\.title\}[\s\S]*renderHeader\.displayName = "ToolTraceHeaderRender";/u);
	assert.doesNotMatch(THINKING_TRACE_SOURCE, /className="pl-11 text-xs leading-5 text-text-subtle"/u);
	assert.doesNotMatch(THINKING_TRACE_SOURCE, /ml-11 space-y-1 text-xs leading-5 text-text-subtle/u);
	assert.doesNotMatch(THINKING_TRACE_SOURCE, /rounded-md border border-border\/60 bg-surface px-2\.5 py-2/u);
	assert.doesNotMatch(THINKING_TRACE_PRESENTATION_SOURCE, /isStudioAutomationTwgTool/u);
	assert.doesNotMatch(THINKING_TRACE_PRESENTATION_SOURCE, /STUDIO_AUTOMATION_TOOL_CYCLE_DETAILS/u);
	assert.match(TWG_TOOL_SOURCE, /import \{ TWGLoader \} from "@\/components\/ui-custom\/twg-loader";/u);
	assert.match(TWG_TOOL_SOURCE, /<TWGLoader label="Teamwork Graph" size="small" \/>/u);
	assert.match(TWG_TOOL_SOURCE, /<CyclingByline>\{description\}<\/CyclingByline>/u);
	assert.doesNotMatch(TWG_TOOL_SOURCE, /AtlassianLogo/u);
	assert.doesNotMatch(TWG_TOOL_SOURCE, /flex w-8 shrink-0 flex-col items-center/u);
});

test("scripted automation trace renders extra tool cycling moments", () => {
	assert.match(THINKING_TRACE_PRESENTATION_SOURCE, /export const STUDIO_AUTOMATION_THINKING_TOOL_TRACE_PRESENTATION_REGISTRY/u);
	assert.match(THINKING_TRACE_PRESENTATION_SOURCE, /"parallel\.source_scan": \{[\s\S]*title: "Cycling through source apps"/u);
	assert.match(THINKING_TRACE_PRESENTATION_SOURCE, /"studio\.rank_automation_candidates": \{[\s\S]*title: "Cycling create, skip, and evidence buckets"/u);
	assert.match(THINKING_TRACE_PRESENTATION_SOURCE, /"studio\.create_agent_drafts": \{[\s\S]*title: "Cycling through three Studio drafts"/u);
	assert.match(THINKING_TRACE_PRESENTATION_SOURCE, /function TraceNarrationRowsDetail/u);
	assert.match(THINKING_TRACE_PRESENTATION_SOURCE, /detail: \{[\s\S]*type: "narration-rows"/u);
	assert.doesNotMatch(THINKING_TRACE_PRESENTATION_SOURCE, /studioAutomationToolCycleDetail/u);
});

test("Studio automation discovery create-agent trace drives sidebar generating rows", () => {
	assert.match(GENERATING_AGENTS_SOURCE, /const STUDIO_AUTOMATION_CREATE_AGENT_DRAFTS_TOOL_NAME = "studio\.create_agent_drafts";/u);
	assert.match(GENERATING_AGENTS_SOURCE, /import \{ STUDIO_AUTOMATION_ARTIFACT_LIST_TYPE \} from "@\/components\/projects\/studio\/lib\/studio-automation-artifact-list";/u);
	assert.match(GENERATING_AGENTS_SOURCE, /avatarSrc: "\/avatar-agent-new\/purple\/customer-insight\.svg"[\s\S]*id: "venn-loom-distribution-agent"/u);
	assert.match(GENERATING_AGENTS_SOURCE, /id: "venn-loom-distribution-agent",[\s\S]*label: "Loom Distribution Agent"/u);
	assert.match(GENERATING_AGENTS_SOURCE, /avatarSrc: "\/avatar-agent-new\/yellow\/ops-agent\.svg"[\s\S]*id: "venn-inactive-agent-triage-agent"/u);
	assert.match(GENERATING_AGENTS_SOURCE, /id: "venn-inactive-agent-triage-agent",[\s\S]*label: "Inactive Agent Triage Agent"/u);
	assert.match(GENERATING_AGENTS_SOURCE, /avatarSrc: "\/avatar-agent-new\/orange\/research-scout\.svg"[\s\S]*id: "venn-weekly-sprint-atlas-digest-agent"/u);
	assert.match(GENERATING_AGENTS_SOURCE, /id: "venn-weekly-sprint-atlas-digest-agent",[\s\S]*label: "Weekly Sprint\/Atlas Digest Agent"/u);
	assert.match(GENERATING_AGENTS_SOURCE, /part\.data\?\.type === STUDIO_AUTOMATION_ARTIFACT_LIST_TYPE/u);
	assert.match(GENERATING_AGENTS_SOURCE, /event\.toolName === STUDIO_AUTOMATION_CREATE_AGENT_DRAFTS_TOOL_NAME/u);
	assert.match(GENERATING_AGENTS_SOURCE, /latestCreateDraftEvent\.phase !== "start"/u);
	assert.match(SHELL_SOURCE, /import \{ getStudioAutomationGeneratingAgents \} from "@\/components\/projects\/studio\/lib\/studio-automation-generating-agents";/u);
	assert.match(SHELL_SOURCE, /const studioAutomationGeneratingAgents = useMemo\(\(\) => \(\s*getStudioAutomationGeneratingAgents\(chat\.messages\)\s*\), \[chat\.messages\]\);/u);
	assert.match(SHELL_SOURCE, /generatingAgents=\{studioAutomationGeneratingAgents\}/u);
});

test("Studio automation discovery draft trace uses distinct agent avatar families", () => {
	assert.match(THINKING_TRACE_PRESENTATION_SOURCE, /id: "loom-agent"[\s\S]*iconSrc: "\/avatar-agent-new\/purple\/customer-insight\.svg"/u);
	assert.match(THINKING_TRACE_PRESENTATION_SOURCE, /id: "triage-agent"[\s\S]*iconSrc: "\/avatar-agent-new\/yellow\/ops-agent\.svg"/u);
	assert.match(THINKING_TRACE_PRESENTATION_SOURCE, /id: "digest-agent"[\s\S]*iconSrc: "\/avatar-agent-new\/orange\/research-scout\.svg"/u);
});

test("generated automation discovery agent fixtures live outside the demo flow module", () => {
	assert.match(BACKEND_AUTOMATION_DISCOVERY_DEMO_SOURCE, /studio-automation-discovery-demo-data/u);
	assert.match(BACKEND_AUTOMATION_DISCOVERY_DEMO_SOURCE, /buildStudioAutomationDiscoveryDataWidgetPayload/u);
	assert.doesNotMatch(BACKEND_AUTOMATION_DISCOVERY_DEMO_SOURCE, /const GENERATED_AGENT_FIXTURES/u);
	assert.match(BACKEND_AUTOMATION_DISCOVERY_DEMO_DATA_SOURCE, /const GENERATED_AGENT_FIXTURES/u);
	assert.match(BACKEND_AUTOMATION_DISCOVERY_DEMO_DATA_SOURCE, /function buildStudioAutomationDiscoveryGeneratedAgentResults/u);
	assert.match(BACKEND_AUTOMATION_DISCOVERY_DEMO_DATA_SOURCE, /function buildStudioAutomationDiscoveryArtifactAgent/u);
});
