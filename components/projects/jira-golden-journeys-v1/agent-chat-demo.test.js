const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

const HOOK_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/jira-golden-journeys-v1/hooks/use-jira-golden-journeys-v1-agent-chat-demo.ts"),
	"utf8",
);
const ROVO_STAGE_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/jira-golden-journeys-v1/components/rovo-stage.tsx"),
	"utf8",
);

async function loadHarness() {
	const result = await esbuild.build({
		stdin: {
			contents: `
				export {
					JGP_CLAUDE_CODE_AGENT_PROFILE,
					JGP_CHAT_AGENT_PROFILES,
					JGP_ROVO_COMPLETED_SESSION_PATCH,
					JGP_ROVO_SESSION_SEEDS,
					buildJgpAgentChatPlayback,
					buildJgpAgentChatContextBar,
					buildJgpRovoContinuationPlayback,
				} from "./components/projects/jira-golden-journeys-v1/data/agent-chat-data";
			`,
			loader: "ts",
			resolveDir: process.cwd(),
			sourcefile: "jira-golden-journeys-v1-agent-chat-data-harness.ts",
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

test("JGP chat profiles include every lifecycle-specific agent", async () => {
	const { JGP_CHAT_AGENT_PROFILES, JGP_CLAUDE_CODE_AGENT_PROFILE } = await loadHarness();
	const profileIds = new Set(JGP_CHAT_AGENT_PROFILES.map((profile) => profile.id));
	const serviceImpactAgent = JGP_CHAT_AGENT_PROFILES.find((profile) => profile.id === "service-impact-agent");
	const dependencyMapper = JGP_CHAT_AGENT_PROFILES.find((profile) => profile.id === "dependency-mapper");
	const unitTestCreator = JGP_CHAT_AGENT_PROFILES.find((profile) => profile.id === "unit-test-creator");
	const cursor = JGP_CHAT_AGENT_PROFILES.find((profile) => profile.id === "cursor");
	const codex = JGP_CHAT_AGENT_PROFILES.find((profile) => profile.id === "review-agent");

	assert.equal(profileIds.has("rfp-drafter"), true);
	assert.equal(profileIds.has("service-impact-agent"), true);
	assert.equal(profileIds.has("dependency-mapper"), true);
	assert.equal(profileIds.has("unit-test-creator"), true);
	assert.equal(profileIds.has("cursor"), true);
	assert.equal(cursor.name, "Cursor");
	assert.equal(cursor.brandName, "cursor");
	assert.equal(cursor.avatarSrc, undefined);
	assert.equal(JGP_CLAUDE_CODE_AGENT_PROFILE.id, "claude-code");
	assert.equal(JGP_CLAUDE_CODE_AGENT_PROFILE.name, "Claude");
	assert.equal(JGP_CLAUDE_CODE_AGENT_PROFILE.brandName, "claude");
	assert.equal(
		JGP_CLAUDE_CODE_AGENT_PROFILE.description,
		"Claude Code is an agentic coding tool that reads your codebase, edits files, runs commands, and integrates with your development tools.",
	);
	assert.deepEqual(JGP_CLAUDE_CODE_AGENT_PROFILE.starters, []);
	assert.equal(serviceImpactAgent.avatarSrc, "/avatar-agent/service-agents/rca-agent.svg");
	assert.equal(dependencyMapper.avatarSrc, "/avatar-agent/teamwork-agents/work-item-planner.svg");
	assert.equal(unitTestCreator.avatarSrc, "/avatar-agent/dev-agents/unit-test-creator.svg");
	assert.equal(profileIds.has("review-agent"), true);
	assert.equal(codex.name, "Codex");
	assert.equal(codex.brandName, "openai-codex");
	assert.notEqual(serviceImpactAgent.avatarSrc, dependencyMapper.avatarSrc);
});

test("JGP agent chat playback deterministically advances from thinking to final output", async () => {
	const { buildJgpAgentChatPlayback } = await loadHarness();
	const playback = buildJgpAgentChatPlayback({
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

test("JGP skill playback preserves structured invocation metadata for the user bubble", async () => {
	const { buildJgpAgentChatPlayback } = await loadHarness();
	const playback = buildJgpAgentChatPlayback({
		agentId: "rovo-dev",
		agentName: "Rovo",
		issueKey: "PAY-124",
		issueSummary: "Confirm the English-only account allow-list",
		request: "Use the Design landing page skill for Jira issue PAY-124.",
		skillInvocation: {
			id: "skill:design-landing-page",
			label: "Design landing page",
			instruction: "for Jira issue PAY-124: Confirm the English-only account allow-list.",
		},
	}, "skill-run", 0);

	assert.deepEqual(playback.userMessage.metadata, {
		source: "jira-issue-generative-action",
		skillInvocation: {
			id: "skill:design-landing-page",
			label: "Design landing page",
			instruction: "for Jira issue PAY-124: Confirm the English-only account allow-list.",
		},
	});
});

test("JGP awaiting-input chat playback exposes the same question as a chat question card", async () => {
	const { buildJgpAgentChatPlayback } = await loadHarness();
	const playback = buildJgpAgentChatPlayback({
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

test("JGP agent chat exposes persistent work-item context for the floating composer", async () => {
	const { buildJgpAgentChatContextBar } = await loadHarness();
	const contextBar = buildJgpAgentChatContextBar({
		agentId: "dependency-mapper",
		agentName: "Dependency mapper",
		issueKey: "PD-40",
		issueSummary: "Implement advanced date-range filter",
	});

	assert.deepEqual(contextBar, {
		iconName: "work-item",
		label: "PD-40: Implement advanced date-range filter",
		showDismissPlaceholder: false,
		signature: "jira-golden-journeys-v1-work-item:PD-40",
	});
	assert.equal(contextBar.collapsible, undefined);
});

test("JGP chat hook selects the agent before opening and cancels stale playback timers", () => {
	assert.match(HOOK_SOURCE, /selectAgent\(scenario\.agentId, \{ preserveCurrentThread: true \}\);[\s\S]*openChat\("floating"\);/u);
	assert.match(HOOK_SOURCE, /for \(const timer of timersRef\.current\)[\s\S]*window\.clearTimeout\(timer\);/u);
	assert.match(HOOK_SOURCE, /useEffect\(\(\) => cancelPlayback, \[cancelPlayback\]\);/u);
	assert.match(HOOK_SOURCE, /setChatContextBar\(buildJgpAgentChatContextBar\(scenario\)\);/u);
	assert.match(HOOK_SOURCE, /setExternalThinkingMessageId\(scenario\.question \? null : playback\.assistantMessageId\);/u);
});

test("JGP global Rovo uses one input-required session that continues to PR completion", async () => {
	const data = await loadHarness();
	assert.equal(data.JGP_ROVO_SESSION_SEEDS.length, 1);
	const blocked = data.JGP_ROVO_SESSION_SEEDS.find((session) => session.issueKey === "JGP-251");
	assert.equal(blocked.status, "awaiting-input");
	assert.equal(blocked.question.questions[0].options[0].label, "Remember per board");
});

test("submitted Rovo answer advances through thinking frames to a CodeList result", async () => {
	const { buildJgpRovoContinuationPlayback } = await loadHarness();
	const playback = buildJgpRovoContinuationPlayback("answer-run", 0);

	assert.deepEqual(playback.frames.map((frame) => frame.delayMs), [0, 700, 900, 800]);
	assert.equal(playback.frames[0].parts[0].type, "data-thinking-status");
	assert.equal(playback.frames[1].parts.some((part) => part.type === "data-thinking-event"), true);
	assert.equal(playback.frames[2].parts.at(-1).state, "streaming");
	const finalParts = playback.frames.at(-1).parts;
	assert.equal(finalParts.some((part) => part.type === "data-thinking-event"), true);
	const codeListPart = finalParts.find(
		(part) => part.type === "data-widget-data" && part.data.type === "jgp-code-list",
	);
	assert.ok(codeListPart);
	assert.deepEqual(codeListPart.data.payload.items.map((item) => item.path), [
		"src/boards/assignee-focus/assignee-focus-toolbar.tsx",
		"src/boards/assignee-focus/assignee-focus-toolbar.test.tsx",
	]);
	assert.match(codeListPart.data.payload.items[0].code, /Clear focus/u);
});

test("submitted Rovo answer makes the completed changes ready for review", async () => {
	const { JGP_ROVO_COMPLETED_SESSION_PATCH } = await loadHarness();

	assert.deepEqual(JGP_ROVO_COMPLETED_SESSION_PATCH, {
		status: "pr-open",
		jiraColumn: "Done",
		repository: "atlassian/jira-cloud",
		branch: "cursor/jgp-252-clear-focus-action",
		commit: "6f4c2ab",
		checks: { passed: 5, failed: 0 },
		fileChanges: {
			additions: 42,
			deletions: 8,
			files: [
				"src/boards/assignee-focus/assignee-focus-toolbar.tsx",
				"src/boards/assignee-focus/assignee-focus-toolbar.test.tsx",
			],
			isDismissed: false,
		},
		question: undefined,
	});
	assert.match(
		ROVO_STAGE_SOURCE,
		/if \(activeHistorySession\?\.status !== "awaiting-input"\) return \{ handled: false \};[\s\S]*onApply: \(\) => updateActiveSession\(JGP_ROVO_COMPLETED_SESSION_PATCH\),/u,
	);
});
