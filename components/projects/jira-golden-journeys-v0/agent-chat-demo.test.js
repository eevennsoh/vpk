const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

const HOOK_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/jira-golden-journeys-v0/hooks/use-jira-golden-journeys-v0-agent-chat-demo.ts"),
	"utf8",
);

async function loadHarness() {
	const result = await esbuild.build({
		stdin: {
			contents: `
				export {
					ASX_CHAT_AGENT_PROFILES,
					buildAsxAgentChatPlayback,
					buildAsxAgentChatContextBar,
				} from "./components/projects/jira-golden-journeys-v0/data/agent-chat-data";
			`,
			loader: "ts",
			resolveDir: process.cwd(),
			sourcefile: "asx-agent-chat-data-harness.ts",
		},
		bundle: true,
		format: "cjs",
		loader: { ".css": "text" },
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	});

	return loadCjsModuleFromText(result.outputFiles[0].text);
}

test("ASX chat profiles include every lifecycle-specific agent", async () => {
	const { ASX_CHAT_AGENT_PROFILES } = await loadHarness();
	const profileIds = new Set(ASX_CHAT_AGENT_PROFILES.map((profile) => profile.id));
	const serviceImpactAgent = ASX_CHAT_AGENT_PROFILES.find((profile) => profile.id === "service-impact-agent");
	const dependencyMapper = ASX_CHAT_AGENT_PROFILES.find((profile) => profile.id === "dependency-mapper");

	assert.equal(profileIds.has("rfp-drafter"), true);
	assert.equal(profileIds.has("service-impact-agent"), true);
	assert.equal(profileIds.has("dependency-mapper"), true);
	assert.equal(serviceImpactAgent.avatarSrc, "/avatar-agent/service-agents/rca-agent.svg");
	assert.equal(dependencyMapper.avatarSrc, "/avatar-agent/teamwork-agents/work-item-planner.svg");
	assert.notEqual(serviceImpactAgent.avatarSrc, dependencyMapper.avatarSrc);
});

test("ASX agent chat playback deterministically advances from thinking to final output", async () => {
	const { buildAsxAgentChatPlayback } = await loadHarness();
	const playback = buildAsxAgentChatPlayback({
		agentId: "rfp-drafter",
		agentName: "RFP Drafter",
		issueKey: "RFP-101",
		issueSummary: "Prepare bid recommendation",
	}, "test-run", 0);

	assert.deepEqual(playback.frames.map((frame) => frame.delayMs), [0, 700, 900, 800]);
	assert.equal(playback.frames[0].parts[0].type, "data-thinking-status");
	assert.equal(playback.frames[1].parts.some((part) => part.type === "data-thinking-event"), true);
	assert.equal(playback.frames[2].parts.at(-1).state, "streaming");
	assert.equal(playback.frames[3].parts.at(-1).state, "done");
});

test("ASX awaiting-input chat playback exposes the same question as a chat question card", async () => {
	const { buildAsxAgentChatPlayback } = await loadHarness();
	const playback = buildAsxAgentChatPlayback({
		agentId: "rfp-drafter",
		agentName: "RFP Drafter",
		issueKey: "RFP-101",
		issueSummary: "Prepare bid recommendation",
		intro: "I found two viable AI narratives. Choose how ambitious the response should sound.",
		question: {
			id: "rfp-response-strategy",
			label: "Which response strategy should we lead with?",
			kind: "single-select",
			options: [{ id: "platform", label: "Platform consolidation" }],
		},
	}, "question-run", 0);

	assert.equal(playback.frames.length, 1);
	assert.equal(playback.frames[0].delayMs, 0);
	assert.equal(playback.frames[0].parts[0].text, "I found two viable AI narratives. Choose how ambitious the response should sound.");
	const widget = playback.frames[0].parts.find((part) => part.type === "data-widget-data");
	assert.equal(widget.data.type, "question-card");
	assert.equal(widget.data.payload.questions[0].label, "Which response strategy should we lead with?");
	assert.equal(widget.data.payload.questions[0].required, true);
});

test("static result playback renders a completed transcript without replaying tools", async () => {
	const { buildAsxAgentChatPlayback } = await loadHarness();
	const playback = buildAsxAgentChatPlayback({
		agentId: "rovo",
		agentName: "Rovo",
		issueKey: "SHOP-4821",
		issueSummary: "Add guest checkout to the storefront",
		playbackVariant: "static-result",
		result: "Done — I added the approved description to SHOP-4821.",
	}, "jira-description-complete", 0);

	assert.equal(playback.frames.length, 1);
	assert.equal(playback.frames[0].delayMs, 0);
	assert.deepEqual(playback.frames[0].parts, [{
		type: "text",
		text: "Done — I added the approved description to SHOP-4821.",
		state: "done",
	}]);
});

test("Jira description playback uses a substantial tool trace and one Teamwork Graph call before awaiting input", async () => {
	const { buildAsxAgentChatPlayback } = await loadHarness();
	const playback = buildAsxAgentChatPlayback({
		agentId: "rovo",
		agentName: "Rovo",
		issueKey: "SHOP-4821",
		issueSummary: "Add guest checkout to the storefront",
		playbackVariant: "jira-description-improvement",
		question: {
			id: "apply-improved-description",
			label: "Would you like me to add this suggested output to the work item description?",
			kind: "single-select",
			options: [{ id: "apply", label: "Add suggested description" }],
		},
	}, "jira-description", 0);

	assert.equal(playback.frames.length, 1);
	const finalParts = playback.frames[0].parts;
	const starts = finalParts.filter((part) => part.type === "data-thinking-event" && part.data.phase === "start");
	const twgCalls = starts.filter((part) => part.data.toolName.startsWith("twg."));
	const awaitingCall = starts.find((part) => part.data.toolName === "ask_user_questions");

	assert.equal(starts.length, 5);
	assert.equal(twgCalls.length, 1);
	assert.equal(awaitingCall.data.label, "Confirming the description update");
	assert.equal(finalParts.some((part) => part.type === "data-turn-complete"), true);
	assert.equal(finalParts.some((part) => part.type === "data-widget-data" && part.data.type === "question-card"), true);
});

test("Jira description generation replays multiple tools before the confirmation question arrives", async () => {
	const { buildAsxAgentChatPlayback } = await loadHarness();
	const playback = buildAsxAgentChatPlayback({
		agentId: "rovo",
		agentName: "Rovo",
		issueKey: "SHOP-4821",
		issueSummary: "Add guest checkout to the storefront",
		playbackVariant: "jira-description-improvement",
	}, "jira-description-running", 0);

	assert.equal(playback.frames.length >= 8, true);
	assert.equal(playback.keepThinkingActiveAfterLastFrame, true);
	const finalStarts = playback.frames.at(-1).parts.filter(
		(part) => part.type === "data-thinking-event" && part.data.phase === "start",
	);
	assert.deepEqual(
		finalStarts.map((part) => part.data.toolName),
		[
			"jira.read_work_item_context",
			"twg.lookup_work_item_delivery_context",
			"confluence.search_checkout_requirements",
			"jira.draft_work_item_description",
		],
	);
});

test("CI repair playback inspects, patches, validates, and pushes the failed check", async () => {
	const { buildAsxAgentChatPlayback } = await loadHarness();
	const playback = buildAsxAgentChatPlayback({
		agentId: "codex",
		agentName: "Codex",
		issueKey: "SHOP-4821",
		issueSummary: "Add guest checkout to the storefront",
		playbackVariant: "ci-fix",
		request: "Use gh to inspect and fix failing check \"Lint and typecheck\".",
	}, "ci-fix", 0);

	assert.equal(playback.frames.length, 10);
	const finalParts = playback.frames.at(-1).parts;
	const starts = finalParts.filter(
		(part) => part.type === "data-thinking-event" && part.data.phase === "start",
	);
	const results = finalParts.filter(
		(part) => part.type === "data-thinking-event" && part.data.phase === "result",
	);

	assert.deepEqual(
		starts.map((part) => part.data.toolName),
		["bash", "expand_code_chunks", "find_and_replace_code", "bash", "bash"],
	);
	assert.equal(results.length, starts.length);
	assert.match(starts[0].data.input.command, /gh pr checks 1847/u);
	assert.equal(starts[1].data.input.annotation, "deliveryAddress may be null");
	assert.match(results.at(-1).data.outputPreview, /GitHub is rerunning lint and typecheck/u);
});

test("Claude Code Build playback puts agent text before tools and stays mid-work", async () => {
	const { buildAsxAgentChatPlayback } = await loadHarness();
	const playback = buildAsxAgentChatPlayback({
		agentId: "claude-code",
		agentName: "Claude Code",
		issueKey: "SHOP-4821",
		issueSummary: "Add guest checkout to the storefront",
		playbackVariant: "claude-code-build",
		request: "Take the lead on implementing guest checkout. Consult Code Planner on the secure API and validation contract first, then implement and verify the work.",
		result: "Guest checkout is implemented and verified.",
	}, "claude-build", 0);

	assert.equal(playback.frames.length >= 30, true);
	assert.equal(playback.keepThinkingActiveAfterLastFrame, true);
	assert.match(playback.userMessage.parts[0].text, /Take the lead on implementing guest checkout/u);

	const finalParts = playback.frames.at(-1).parts;
	assert.equal(finalParts[0].type, "text");
	assert.match(finalParts[0].text, /taking the lead on \*\*SHOP-4821\*\*/iu);
	assert.equal(
		finalParts.findIndex((part) => part.type === "data-thinking-event")
			> finalParts.findIndex((part) => part.type === "text"),
		true,
	);

	const starts = finalParts.filter((part) => part.type === "data-thinking-event" && part.data.phase === "start");
	const results = finalParts.filter((part) => part.type === "data-thinking-event" && part.data.phase === "result");
	const openValidation = starts.find((part) => part.data.toolName === "bash");
	const progressCheckpoint = starts.find((part) => part.data.toolName === "update_todo");
	const doneTexts = finalParts.filter((part) => part.type === "text" && part.state === "done");
	const statusesForValidation = finalParts.filter(
		(part) => part.type === "data-thinking-status" && part.data.toolCallId === openValidation.data.toolCallId,
	);
	const statusesPerCompletedTool = starts
		.filter((part) => part.data.toolCallId !== openValidation.data.toolCallId
			&& part.data.toolCallId !== progressCheckpoint.data.toolCallId)
		.map((part) => finalParts.filter(
			(status) => status.type === "data-thinking-status" && status.data.toolCallId === part.data.toolCallId,
		).length);

	assert.equal(starts.length, results.length + 2);
	assert.equal(openValidation.data.label, "Running a command");
	assert.equal(progressCheckpoint.data.permissionScenario, "progress-checkpoint");
	assert.equal(results.some((part) => part.data.toolCallId === openValidation.data.toolCallId), false);
	assert.equal(results.some((part) => part.data.toolCallId === progressCheckpoint.data.toolCallId), false);
	assert.equal(finalParts.some((part) => part.type === "data-turn-complete"), false);
	assert.equal(
		doneTexts.some((part) => /implemented and verified|PR #1847|prepared PR/iu.test(part.text)),
		false,
	);
	assert.equal(statusesForValidation.length >= 3, true);
	assert.equal(statusesPerCompletedTool.every((count) => count >= 3), true);
	assert.match(
		statusesForValidation.at(-1).data.content,
		/still in progress|holding before verify/iu,
	);
	assert.deepEqual(
		starts.map((part) => part.data.toolName),
		[
			"jira.read_work_item",
			"twg.lookup_work_item_delivery_context",
			"open_files",
			"create_file",
			"find_and_replace_code",
			"expand_code_chunks",
			"create_file",
			"update_todo",
			"bash",
		],
	);
	// Parent labels stay generic; specific work detail lives in status bylines.
	assert.deepEqual(
		starts.map((part) => part.data.label),
		[
			"Reading the work item",
			"Connecting delivery context",
			"Opening files",
			"Creating files",
			"Editing code",
			"Inspecting code",
			"Creating files",
			"Updating todos",
			"Running a command",
		],
	);
	assert.match(
		statusesForValidation[0].data.content,
		/lint|typecheck|guest-checkout/iu,
	);
	// Distinct native tool names → distinct icons in tool-icon-resolver (not all wrenches).
	assert.equal(new Set(starts.map((part) => part.data.toolName)).size >= 7, true);

	// Tool entrances use varied delays (not a uniform tick); byline cycles stay shorter.
	const delays = playback.frames.map((frame) => frame.delayMs);
	assert.equal(delays[0], 0);
	const nonZeroDelays = delays.slice(1);
	assert.equal(new Set(nonZeroDelays).size >= 6, true);
	assert.equal(Math.min(...nonZeroDelays) >= 400, true);
	assert.equal(Math.max(...nonZeroDelays) >= 1_900, true);
	const toolEntranceDelays = playback.frames
		.map((frame, index) => ({ frame, index }))
		.filter(({ frame, index }) => {
			if (index === 0) {
				return false;
			}
			const previousStarts = playback.frames[index - 1].parts.filter(
				(part) => part.type === "data-thinking-event" && part.data.phase === "start",
			).length;
			const currentStarts = frame.parts.filter(
				(part) => part.type === "data-thinking-event" && part.data.phase === "start",
			).length;
			return currentStarts > previousStarts;
		})
		.map(({ frame }) => frame.delayMs);
	assert.equal(toolEntranceDelays.length, 9);
	assert.equal(new Set(toolEntranceDelays).size >= 7, true);
	assert.equal(toolEntranceDelays.some((delay) => delay <= 600), true);
	assert.equal(toolEntranceDelays.some((delay) => delay >= 1_900), true);
});

test("ASX agent chat exposes persistent work-item context for the floating composer", async () => {
	const { buildAsxAgentChatContextBar } = await loadHarness();
	const contextBar = buildAsxAgentChatContextBar({
		agentId: "dependency-mapper",
		agentName: "Dependency mapper",
		issueKey: "PD-40",
		issueSummary: "Implement advanced date-range filter",
	});

	assert.deepEqual(contextBar, {
		iconName: "work-item",
		label: "PD-40: Implement advanced date-range filter",
		showDismissPlaceholder: false,
		signature: "asx-work-item:PD-40",
	});
	assert.equal(contextBar.collapsible, undefined);
});

test("ASX chat hook selects the agent before opening and cancels stale playback timers", () => {
	assert.match(HOOK_SOURCE, /selectAgent\(scenario\.agentId, \{ preserveCurrentThread: true \}\);[\s\S]*openChat\("floating"\);/u);
	assert.match(HOOK_SOURCE, /useEffect\(\(\) => cancelPlayback, \[cancelPlayback\]\);/u);
	assert.match(HOOK_SOURCE, /setChatContextBar\(buildAsxAgentChatContextBar\(scenario\)\);/u);
	assert.match(HOOK_SOURCE, /setExternalThinkingMessageId\(playback\.assistantMessageId\);/u);
	assert.match(HOOK_SOURCE, /!playback\.keepThinkingActiveAfterLastFrame/u);
});
