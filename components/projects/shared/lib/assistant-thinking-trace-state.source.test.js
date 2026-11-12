const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const esbuild = require("esbuild");

function loadTsModule(entryPoint) {
	const build = esbuild.buildSync({
		entryPoints: [entryPoint],
		bundle: true,
		platform: "node",
		format: "cjs",
		loader: {
			".css": "empty",
		},
		write: false,
		logLevel: "silent",
	});
	const moduleInstance = new Module(entryPoint);
	moduleInstance.filename = entryPoint;
	moduleInstance.paths = Module._nodeModulePaths(path.dirname(entryPoint));
	moduleInstance._compile(build.outputFiles[0].text, entryPoint);
	return moduleInstance.exports;
}

const {
	areAllThinkingToolCallsSettled,
	collectAssistantThinkingTraceData,
	isSettledThinkingToolState,
	resolveAssistantThinkingTraceOpen,
	resolveAssistantThinkingTracePhase,
	resolveAssistantThinkingTraceResponseGenerationStep,
	resolveAssistantThinkingTraceVisibility,
	resolveThinkingToolCallStepOpen,
	shouldCollapseAssistantThinkingTraceOnPhaseChange,
} = loadTsModule(path.join(__dirname, "assistant-thinking-trace-state.ts"));
const { getReasoningSectionTitle } = loadTsModule(
	path.join(__dirname, "../lib/reasoning-labels.ts"),
);
const {
	getThinkingToolByline,
	getThinkingToolTitle,
} = loadTsModule(path.join(__dirname, "thinking-tool-display.ts"));
const {
	resolveToolIcon,
} = loadTsModule(path.join(__dirname, "tool-icon-resolver.tsx"));

test("thinking trace uses distinct copy for the expanded reasoning section", () => {
	assert.equal(getReasoningSectionTitle("thinking"), "Reasoning");
});

test("collectAssistantThinkingTraceData detects event-only traces", () => {
	const data = collectAssistantThinkingTraceData({
		parts: [
			{
				type: "data-thinking-event",
				data: {
					eventId: "event-1",
					phase: "start",
					toolName: "search",
					toolCallId: "tool-1",
				},
			},
		],
	});

	assert.equal(data.hasThinkingStatusPart, false);
	assert.equal(data.hasThinkingEvents, true);
	assert.equal(data.hasTraceDataSignals, true);
	assert.equal(data.hasBackendThinkingActivity, true);
	assert.equal(data.thinkingToolCalls[0].state, "running");
});

test("thinking tool titles prefer plain English labels and useful fallbacks", () => {
	const legacyVpkHtmlLabel = ["Loading", "vpk-html"].join(" ");

	assert.equal(
		getThinkingToolTitle({
			id: "tool-1",
			toolName: "jira.read_work_item",
			label: "Reading RFP-101",
			state: "running",
			input: { key: "RFP-101" },
		}),
		"Reading RFP-101",
	);

	assert.equal(
		getThinkingToolTitle({
			id: "tool-2",
			toolName: "rfp.check_unfinished_work",
			state: "running",
		}),
		"Checking open work",
	);

	assert.equal(
		getThinkingToolTitle({
			id: "tool-3",
			toolName: "agent_skill.load",
			state: "running",
			input: { skill: "create-agent" },
		}),
		"Using create-agent skill",
	);

	assert.equal(
		getThinkingToolTitle({
			id: "tool-4",
			toolName: "agent_skill.load",
			state: "running",
			input: { skill: "create-automation" },
		}),
		"Using create-automation skill",
	);
	assert.equal(
		getThinkingToolTitle({
			id: "tool-5",
			toolName: "agent_skill.load",
			state: "running",
			input: { skill: "generate-pdf" },
		}),
		"Using generate-pdf skill",
	);
	assert.equal(
		getThinkingToolTitle({
			id: "tool-legacy-vpk-html",
			toolName: "agent_skill.load",
			label: legacyVpkHtmlLabel,
			state: "running",
			input: { skill: "vpk-html" },
		}),
		"Using generate-pdf skill",
	);
	assert.equal(
		getThinkingToolByline({
			id: "tool-legacy-vpk-html",
			toolName: "agent_skill.load",
			label: legacyVpkHtmlLabel,
			state: "running",
			input: { skill: "vpk-html" },
		}),
		"Using generate-pdf",
	);

	assert.equal(
		getThinkingToolTitle({
			id: "tool-6",
			toolName: "jira.read_work_item",
			state: "running",
			input: { key: "RFP-101" },
		}),
		"Reading RFP-101",
	);

	assert.equal(
		getThinkingToolTitle({
			id: "tool-4",
			toolName: "jira.read",
			state: "running",
			input: { key: "RFP-101" },
		}),
		"Reading RFP-101",
	);

	assert.equal(
		getThinkingToolTitle({
			id: "tool-5",
			toolName: "jira.scan",
			state: "running",
		}),
		"Scanning attachments",
	);

	assert.equal(
		getThinkingToolTitle({
			id: "tool-6",
			toolName: "rfp.map",
			state: "running",
		}),
		"Mapping requirements",
	);

	assert.equal(
		getThinkingToolTitle({
			id: "tool-7",
			toolName: "rfp.check",
			state: "running",
		}),
		"Checking open work",
	);
});

test("thinking tool titles replace persisted raw tool fallback labels", () => {
	const titles = [
		getThinkingToolTitle({
			id: "tool-1",
			toolName: "jira.read_work_item",
			label: "Using jira.read work item",
			state: "running",
			input: { key: "RFP-101" },
		}),
		getThinkingToolTitle({
			id: "tool-2",
			toolName: "jira.scan_attachments",
			label: "Using jira.scan attachments",
			state: "running",
		}),
		getThinkingToolTitle({
			id: "tool-3",
			toolName: "rfp.map_requirements",
			label: "Using rfp.map requirements",
			state: "running",
		}),
		getThinkingToolTitle({
			id: "tool-4",
			toolName: "rfp.check_unfinished_work",
			label: "Using rfp.check unfinished work",
			state: "running",
		}),
		getThinkingToolTitle({
			id: "tool-5",
			toolName: "system.encrypt_result",
			label: "Using system.encrypt result",
			state: "running",
		}),
	];

	assert.deepEqual(titles, [
		"Reading RFP-101",
		"Scanning attachments",
		"Mapping requirements",
		"Checking open work",
		"Running tool",
	]);

	for (const title of titles) {
		assert.doesNotMatch(title, /\b(?:jira|rfp|system)\./u);
		assert.doesNotMatch(title, /^Using\b/u);
	}
});

test("tool icon resolver maps agents thinking tools to specific icons", () => {
	assert.match(
		resolveToolIcon({ toolName: "mcp__web_search__search", mcpServer: "web-search" }).iconComponent?.name,
		/^SearchIcon/u
	);
	assert.match(
		resolveToolIcon({ toolName: "jira.scan_attachments" }).iconComponent?.name,
		/^AttachmentIcon/u
	);
	assert.match(
		resolveToolIcon({ toolName: "teamwork_graph.search" }).iconComponent?.name,
		/^TeamworkGraphIcon/u
	);
	assert.match(resolveToolIcon({ toolName: "twg.lookup_work_item_delivery_context" }).iconComponent?.name, /^TeamworkGraphIcon/u);
	assert.match(
		resolveToolIcon({ toolName: "rfp.map_requirements" }).iconComponent?.name,
		/^ListChecklistIcon/u
	);
	assert.match(
		resolveToolIcon({ toolName: "jira.read" }).iconComponent?.name,
		/^WorkItemIcon/u
	);
	assert.match(
		resolveToolIcon({ toolName: "rfp.check" }).iconComponent?.name,
		/^TaskToDoIcon/u
	);
	for (const skill of ["generate-pdf", "create-agent", "create-automation"]) {
		const resolvedIcon = resolveToolIcon({
			toolName: "agent_skill.load",
			input: { skill },
			title: `Using ${skill} skill`,
		});
		assert.match(resolvedIcon.iconComponent?.name, /^SkillIcon/u);
	}
	assert.match(
		resolveToolIcon({ toolName: "generate_pdf.render_document" }).iconComponent?.name,
		/^TemplateIcon/u
	);
	assert.match(
		resolveToolIcon({ toolName: "studio.read_brief" }).iconComponent?.name,
		/^FileIcon/u
	);
	assert.match(
		resolveToolIcon({ toolName: "studio.review_answers" }).iconComponent?.name,
		/^QuestionCircleIcon/u
	);
	assert.match(
		resolveToolIcon({ toolName: "studio.select_tools" }).iconComponent?.name,
		/^ToolsIcon/u
	);
	assert.match(
		resolveToolIcon({ toolName: "studio.draft_instructions" }).iconComponent?.name,
		/^PencilIcon/u
	);
	assert.match(
		resolveToolIcon({ toolName: "studio.name_agent" }).iconComponent?.name,
		/^AiAgentIcon/u
	);
	assert.match(
		resolveToolIcon({ toolName: "studio.save_profile" }).iconComponent?.name,
		/^SaveIcon/u
	);
});

test("collectAssistantThinkingTraceData preserves status content", () => {
	const data = collectAssistantThinkingTraceData({
		parts: [
			{
				type: "data-thinking-status",
				data: {
					label: "Inspecting files",
					content: "Reading the current implementation",
				},
			},
		],
	});

	assert.equal(data.hasThinkingStatusPart, true);
	assert.deepEqual(data.thinkingNarrationMap.unassociated, [
		"Reading the current implementation",
	]);
	assert.equal(data.lastThinkingStatusPart.data.label, "Inspecting files");
});

test("collectAssistantThinkingTraceData associates narration with tool calls", () => {
	const data = collectAssistantThinkingTraceData({
		parts: [
			{
				type: "data-thinking-status",
				data: {
					label: "Searching",
					content: "Checking the repository",
				},
			},
			{
				type: "data-thinking-event",
				data: {
					eventId: "event-1",
					phase: "start",
					toolName: "rg",
					toolCallId: "tool-1",
					input: { pattern: "thinking" },
				},
			},
			{
				type: "data-thinking-event",
				data: {
					eventId: "event-2",
					phase: "result",
					toolName: "rg",
					toolCallId: "tool-1",
					output: "match",
					outputPreview: "match",
				},
			},
		],
	});

	assert.equal(data.thinkingToolCalls.length, 1);
	assert.equal(data.thinkingToolCalls[0].state, "completed");
	assert.deepEqual(data.thinkingNarrationMap.byToolCallId.get("tool-1"), [
		"Checking the repository",
	]);
});

test("collectAssistantThinkingTraceData groups stacked rows by explicit toolCallId without bleeding across steps", () => {
	const data = collectAssistantThinkingTraceData({
		parts: [
			// Step 1: lead row (before its start) + an extra row (after its start),
			// both stamped with tool-1.
			{ type: "data-thinking-status", data: { label: "A", content: "A lead", toolCallId: "tool-1" } },
			{ type: "data-thinking-event", data: { eventId: "e1", phase: "start", toolName: "a", toolCallId: "tool-1" } },
			{ type: "data-thinking-status", data: { label: "A", content: "A extra", toolCallId: "tool-1" } },
			{ type: "data-thinking-event", data: { eventId: "e2", phase: "result", toolName: "a", toolCallId: "tool-1", outputPreview: "ok" } },
			// Step 2: its own lead row stamped with tool-2 must NOT attach to tool-1.
			{ type: "data-thinking-status", data: { label: "B", content: "B lead", toolCallId: "tool-2" } },
			{ type: "data-thinking-event", data: { eventId: "e3", phase: "start", toolName: "b", toolCallId: "tool-2" } },
		],
	});

	assert.deepEqual(data.thinkingNarrationMap.byToolCallId.get("tool-1"), ["A lead", "A extra"]);
	assert.deepEqual(data.thinkingNarrationMap.byToolCallId.get("tool-2"), ["B lead"]);
	assert.deepEqual(data.thinkingNarrationMap.unassociated, []);
});

test("collectAssistantThinkingTraceData builds per-row detail rows with their own input/output", () => {
	const data = collectAssistantThinkingTraceData({
		parts: [
			// Row 1 carries its own Parameters + Result.
			{
				type: "data-thinking-status",
				data: {
					label: "A",
					content: "Reading the brief",
					toolCallId: "tool-1",
					input: { step: "read" },
					output: "Brief loaded",
				},
			},
			{ type: "data-thinking-event", data: { eventId: "e1", phase: "start", toolName: "a", toolCallId: "tool-1" } },
			// Row 2 carries different detail; it must be its own row, not merged.
			{
				type: "data-thinking-status",
				data: {
					label: "A",
					content: "Checking missing details",
					toolCallId: "tool-1",
					input: { step: "check" },
					output: "2 gaps found",
				},
			},
			// A plain progression row with no detail stays detail-free.
			{
				type: "data-thinking-status",
				data: { label: "A", content: "Shaping the agent", toolCallId: "tool-1" },
			},
		],
	});

	const rows = data.thinkingNarrationDetailMap.byToolCallId.get("tool-1");
	assert.equal(rows.length, 3);
	assert.deepEqual(rows[0], { content: "Reading the brief", input: { step: "read" }, output: "Brief loaded" });
	assert.deepEqual(rows[1], { content: "Checking missing details", input: { step: "check" }, output: "2 gaps found" });
	assert.deepEqual(rows[2], { content: "Shaping the agent" });
});

test("collectAssistantThinkingTraceData accepts filtered thinking tool calls", () => {
	const data = collectAssistantThinkingTraceData(
		{
			parts: [
				{
					type: "data-thinking-event",
					data: {
						eventId: "event-1",
						phase: "start",
						toolName: "request_user_input",
						toolCallId: "tool-1",
					},
				},
			],
		},
		{
			thinkingToolCalls: [],
		},
	);

	assert.equal(data.hasThinkingToolCalls, false);
	assert.equal(data.hasAwaitingInputToolCalls, false);
	assert.deepEqual(data.thinkingToolCalls, []);
});

test("collectAssistantThinkingTraceData marks answered question tools complete", () => {
	const data = collectAssistantThinkingTraceData(
		{
			parts: [
				{
					type: "data-thinking-event",
					data: {
						eventId: "event-1",
						phase: "start",
						toolName: "ask_user_questions",
						toolCallId: "tool-1",
						timestamp: "2026-03-22T00:00:00.000Z",
					},
				},
				{
					type: "data-turn-complete",
					data: {
						timestamp: "2026-03-22T00:01:00.000Z",
					},
				},
			],
		},
		{
			treatQuestionToolCallsAsAnswered: true,
		},
	);

	assert.equal(data.hasAnsweredQuestionToolCalls, true);
	assert.equal(data.hasAwaitingInputToolCalls, false);
	assert.equal(data.thinkingToolCalls[0].state, "completed");
	assert.equal(data.thinkingToolCalls[0].outputPreview, "Questions answered.");
	assert.equal(data.visibleThinkingToolCalls.length, 0);
});

test("collectAssistantThinkingTraceData keeps unanswered question tools visible", () => {
	const data = collectAssistantThinkingTraceData({
		parts: [
			{
				type: "data-thinking-event",
				data: {
					eventId: "tool-1:start:1",
					phase: "start",
					toolName: "ask_user_questions",
					toolCallId: "tool-1",
					timestamp: "2026-03-22T00:00:00.000Z",
				},
			},
			{
				type: "data-turn-complete",
				data: {
					timestamp: "2026-03-22T00:01:00.000Z",
				},
			},
		],
	});

	assert.equal(data.hasAnsweredQuestionToolCalls, false);
	assert.equal(data.hasAwaitingInputToolCalls, true);
	assert.equal(data.thinkingToolCalls[0].state, "awaiting-input");
	assert.equal(data.visibleThinkingToolCalls.length, 1);
});

test("collectAssistantThinkingTraceData extracts update_todo progress", () => {
	const data = collectAssistantThinkingTraceData({
		parts: [
			{
				type: "data-thinking-event",
				data: {
					eventId: "event-1",
					phase: "result",
					toolName: "update_todo",
					toolCallId: "tool-1",
					output:
						'<todo>\n{"id":1,"content":"Unify trace","active_form":"Unifying trace","status":"in_progress"}\n</todo>',
				},
			},
		],
	});

	assert.equal(data.hasTodoProgressItems, true);
	assert.equal(data.hasLegacyTodoQueueItems, false);
	assert.equal(data.todoProgressItems[0].label, "Unify trace");
});

test("resolveThinkingToolCallStepOpen collapses every tool call unless manually expanded", () => {
	const manuallyOpenedToolCallIds = new Set(["call:manual"]);

	// Earlier (non-latest) tool calls stay collapsed.
	assert.equal(
		resolveThinkingToolCallStepOpen({
			toolCallId: "call:previous",
			manuallyOpenedToolCallIds,
			isLatestToolCall: false,
		}),
		false,
	);
	// The latest tool call also stays collapsed by default now.
	assert.equal(
		resolveThinkingToolCallStepOpen({
			toolCallId: "call:latest",
			manuallyOpenedToolCallIds,
			isLatestToolCall: true,
		}),
		false,
	);
	// A manually opened tool call stays expanded regardless of latest status.
	assert.equal(
		resolveThinkingToolCallStepOpen({
			toolCallId: "call:manual",
			manuallyOpenedToolCallIds,
			isLatestToolCall: false,
		}),
		true,
	);
	// A manually opened tool call stays expanded even when it is the latest.
	assert.equal(
		resolveThinkingToolCallStepOpen({
			toolCallId: "call:manual",
			manuallyOpenedToolCallIds,
			isLatestToolCall: true,
		}),
		true,
	);
	// Defaults to collapsed when isLatestToolCall is omitted.
	assert.equal(
		resolveThinkingToolCallStepOpen({
			toolCallId: "call:no-flag",
			manuallyOpenedToolCallIds,
		}),
		false,
	);
});

test("resolveAssistantThinkingTraceOpen expands by default for active tool-backed thinking", () => {
	assert.equal(
		resolveAssistantThinkingTraceOpen({
			hasThinkingToolCalls: true,
			reasoningPhase: "thinking",
			userOpenOverride: null,
		}),
		true,
	);
	assert.equal(
		resolveAssistantThinkingTraceOpen({
			hasThinkingToolCalls: true,
			reasoningPhase: "preload",
			userOpenOverride: null,
		}),
		true,
	);
	assert.equal(
		resolveAssistantThinkingTraceOpen({
			hasThinkingToolCalls: true,
			reasoningPhase: "completed",
			userOpenOverride: null,
		}),
		false,
	);
	assert.equal(
		resolveAssistantThinkingTraceOpen({
			hasThinkingToolCalls: false,
			reasoningPhase: "thinking",
			userOpenOverride: null,
		}),
		false,
	);
});

test("resolveAssistantThinkingTraceOpen can suppress auto expansion for question-card waits", () => {
	assert.equal(
		resolveAssistantThinkingTraceOpen({
			allowAutoOpen: false,
			hasThinkingToolCalls: true,
			reasoningPhase: "thinking",
			userOpenOverride: null,
		}),
		false,
	);
	assert.equal(
		resolveAssistantThinkingTraceOpen({
			allowAutoOpen: false,
			hasThinkingToolCalls: true,
			reasoningPhase: "thinking",
			userOpenOverride: true,
		}),
		true,
	);
});

test("resolveAssistantThinkingTraceOpen respects manual user toggles", () => {
	assert.equal(
		resolveAssistantThinkingTraceOpen({
			hasThinkingToolCalls: true,
			reasoningPhase: "thinking",
			userOpenOverride: false,
		}),
		false,
	);
	assert.equal(
		resolveAssistantThinkingTraceOpen({
			hasThinkingToolCalls: true,
			reasoningPhase: "completed",
			userOpenOverride: true,
		}),
		true,
	);
});

test("shouldCollapseAssistantThinkingTraceOnPhaseChange collapses when thinking completes", () => {
	assert.equal(
		shouldCollapseAssistantThinkingTraceOnPhaseChange({
			previousReasoningPhase: "thinking",
			reasoningPhase: "completed",
		}),
		true,
	);
	assert.equal(
		shouldCollapseAssistantThinkingTraceOnPhaseChange({
			previousReasoningPhase: "completed",
			reasoningPhase: "completed",
		}),
		false,
	);
	assert.equal(
		shouldCollapseAssistantThinkingTraceOnPhaseChange({
			previousReasoningPhase: "thinking",
			reasoningPhase: "thinking",
		}),
		false,
	);
});

test("collectAssistantThinkingTraceData includes legacy queues and agent executions", () => {
	const data = collectAssistantThinkingTraceData({
		parts: [
			{
				type: "data-todo-queue",
				data: {
					items: [
						{
							id: "task-1",
							text: "Review",
							blockedBy: [],
						},
					],
				},
			},
			{
				type: "data-agent-execution",
				data: {
					agentId: "agent-1",
					agentName: "Explorer",
					taskId: "task-1",
					taskLabel: "Inspect trace",
					status: "working",
					content: "Reading files",
				},
			},
		],
	});

	assert.equal(data.hasLegacyTodoQueueItems, true);
	assert.equal(data.hasAgentExecutions, true);
	assert.equal(data.todoQueueItems[0].text, "Review");
	assert.equal(data.agentExecutions[0].agentName, "Explorer");
});

test("resolveAssistantThinkingTracePhase handles awaiting and completed turns", () => {
	assert.equal(
		resolveAssistantThinkingTracePhase({
			isThinkingActive: true,
			hasTurnComplete: false,
			isThinkingLifecycleStreaming: true,
			hasBackendThinkingActivity: true,
			hasAwaitingInputToolCalls: true,
			lifecyclePhase: "completed",
		}),
		"thinking"
	);

	assert.equal(
		resolveAssistantThinkingTracePhase({
			isThinkingActive: true,
			hasTurnComplete: true,
			isThinkingLifecycleStreaming: false,
			hasBackendThinkingActivity: true,
			hasAwaitingInputToolCalls: false,
			lifecyclePhase: "idle",
		}),
		"completed"
	);
});

test("resolveAssistantThinkingTracePhase keeps shimmer active while post-tool widget generation is pending", () => {
	assert.equal(
		resolveAssistantThinkingTracePhase({
			isThinkingActive: true,
			hasTurnComplete: true,
			isThinkingLifecycleStreaming: false,
			hasBackendThinkingActivity: true,
			hasAwaitingInputToolCalls: false,
			isPostToolsGeneration: true,
			hasWidgetOutput: false,
			lifecyclePhase: "completed",
		}),
		"thinking"
	);

	assert.equal(
		resolveAssistantThinkingTracePhase({
			isThinkingActive: true,
			hasTurnComplete: true,
			isThinkingLifecycleStreaming: false,
			hasBackendThinkingActivity: true,
			hasAwaitingInputToolCalls: false,
			isPostToolsGeneration: true,
			hasWidgetOutput: true,
			lifecyclePhase: "thinking",
		}),
		"completed"
	);
});

test("resolveAssistantThinkingTracePhase keeps shimmer active while post-tool result cards are pending", () => {
	assert.equal(
		resolveAssistantThinkingTracePhase({
			isThinkingActive: true,
			hasTurnComplete: false,
			isThinkingLifecycleStreaming: false,
			hasBackendThinkingActivity: true,
			hasAwaitingInputToolCalls: false,
			isPostToolsResultPending: true,
			lifecyclePhase: "completed",
		}),
		"thinking"
	);
});

test("resolveAssistantThinkingTraceResponseGenerationStep shows a final active step after tools finish", () => {
	assert.equal(
		resolveAssistantThinkingTraceResponseGenerationStep({
			hasAwaitingInputToolCalls: false,
			hasThinkingToolCalls: true,
			isPostToolsResultPending: true,
		}),
		true
	);

	assert.equal(
		resolveAssistantThinkingTraceResponseGenerationStep({
			hasAwaitingInputToolCalls: false,
			hasThinkingToolCalls: true,
			isPostToolsGeneration: true,
		}),
		true
	);
});

test("isSettledThinkingToolState treats only terminal states as settled", () => {
	assert.equal(isSettledThinkingToolState("completed"), true);
	assert.equal(isSettledThinkingToolState("error"), true);
	assert.equal(isSettledThinkingToolState("denied"), true);
	for (const active of ["running", "pending", "awaiting-input", "approval-requested"]) {
		assert.equal(isSettledThinkingToolState(active), false, `${active} should not be settled`);
	}
});

test("areAllThinkingToolCallsSettled requires at least one tool and all terminal", () => {
	assert.equal(areAllThinkingToolCallsSettled([]), false);
	assert.equal(
		areAllThinkingToolCallsSettled([{ state: "completed" }, { state: "completed" }]),
		true
	);
	assert.equal(
		areAllThinkingToolCallsSettled([{ state: "completed" }, { state: "running" }]),
		false
	);
});

test("treatSettledToolsAsPostResultPending derives the step from settled tools + in-flight response", () => {
	// All scripted steps settled while the answer is still streaming → show it.
	assert.equal(
		resolveAssistantThinkingTraceResponseGenerationStep({
			hasAwaitingInputToolCalls: false,
			hasThinkingToolCalls: true,
			treatSettledToolsAsPostResultPending: true,
			allToolsSettled: true,
			isResponseInFlight: true,
			hasTurnComplete: false,
		}),
		true
	);

	// Turn complete → hide it (the answer has landed).
	assert.equal(
		resolveAssistantThinkingTraceResponseGenerationStep({
			hasAwaitingInputToolCalls: false,
			hasThinkingToolCalls: true,
			treatSettledToolsAsPostResultPending: true,
			allToolsSettled: true,
			isResponseInFlight: true,
			hasTurnComplete: true,
		}),
		false
	);

	// A tool is still running (not all settled) → hide it.
	assert.equal(
		resolveAssistantThinkingTraceResponseGenerationStep({
			hasAwaitingInputToolCalls: false,
			hasThinkingToolCalls: true,
			treatSettledToolsAsPostResultPending: true,
			allToolsSettled: false,
			isResponseInFlight: true,
			hasTurnComplete: false,
		}),
		false
	);

	// Awaiting the user (turn-1 ask) → hide it even if settled-derivation is on.
	assert.equal(
		resolveAssistantThinkingTraceResponseGenerationStep({
			hasAwaitingInputToolCalls: true,
			hasThinkingToolCalls: true,
			treatSettledToolsAsPostResultPending: true,
			allToolsSettled: true,
			isResponseInFlight: true,
			hasTurnComplete: false,
		}),
		false
	);

	// Derivation off → settled tools alone don't surface the step.
	assert.equal(
		resolveAssistantThinkingTraceResponseGenerationStep({
			hasAwaitingInputToolCalls: false,
			hasThinkingToolCalls: true,
			allToolsSettled: true,
			isResponseInFlight: true,
			hasTurnComplete: false,
		}),
		false
	);
});

test("resolveAssistantThinkingTraceResponseGenerationStep stays hidden outside post-tool response work", () => {
	assert.equal(
		resolveAssistantThinkingTraceResponseGenerationStep({
			hasAwaitingInputToolCalls: false,
			hasThinkingToolCalls: false,
			isPostToolsResultPending: true,
		}),
		false
	);

	assert.equal(
		resolveAssistantThinkingTraceResponseGenerationStep({
			hasAwaitingInputToolCalls: true,
			hasThinkingToolCalls: true,
			isPostToolsResultPending: true,
		}),
		false
	);

	assert.equal(
		resolveAssistantThinkingTraceResponseGenerationStep({
			hasAwaitingInputToolCalls: false,
			hasThinkingToolCalls: true,
			hasWidgetOutput: true,
			isPostToolsGeneration: true,
		}),
		false
	);
});

test("completed thinking tool calls suppress the collapsed byline", () => {
	const chainOfThoughtSource = fs.readFileSync(
		path.join(__dirname, "../../../ui-custom/chain-of-thought.tsx"),
		"utf8",
	);
	const assistantTraceSource = fs.readFileSync(
		path.join(__dirname, "../components/assistant-thinking-trace.tsx"),
		"utf8",
	);

	assert.match(
		chainOfThoughtSource,
		/const shouldShowDescription = description !== null;/u,
	);
	assert.match(
		chainOfThoughtSource,
		/const shouldShowHeaderDescription = shouldShowDescription && \(!hasExpandableContent \|\| !isOpen\);/u,
	);
	assert.match(
		chainOfThoughtSource,
		/<CyclingByline>\{shouldShowHeaderDescription \? resolvedDescription : null\}<\/CyclingByline>/u,
	);
	assert.match(
		assistantTraceSource,
		/description=\{\s*tracePresentation\?\.headerRender \|\| toolCall\.state === "completed"\s*\?\s*null\s*:\s*getThinkingToolByline\(toolCall, narration\)\s*\}/u,
	);
});

test("resolveAssistantThinkingTraceVisibility latches during transient empty frames", () => {
	assert.deepEqual(
		resolveAssistantThinkingTraceVisibility({
			isThinkingActive: false,
			isResponseInFlight: true,
			wasLatched: true,
		}),
		{
			effectiveIsThinkingActive: true,
			nextLatched: true,
		}
	);
});
