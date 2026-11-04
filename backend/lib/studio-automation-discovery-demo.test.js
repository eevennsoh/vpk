const assert = require("node:assert/strict");
const test = require("node:test");

const {
	DEMO_WIDGET_TYPE,
	buildStudioAutomationDiscoveryFinalText,
	buildStudioAutomationDiscoveryFollowupQuestionCardPayload,
	buildStudioAutomationDiscoveryQuestionCardPayload,
	buildStudioAutomationDiscoveryTrace,
	buildStudioAutomationDiscoveryWidgetPayload,
	isStudioAutomationDiscoveryDismissalPrompt,
	isStudioAutomationDiscoveryFollowupDismissalPrompt,
	isStudioAutomationDiscoveryFollowupSession,
	isStudioAutomationDiscoveryInitialDismissalPrompt,
	isStudioAutomationDiscoveryInitialSession,
	isStudioAutomationDiscoveryPrompt,
	isStudioAutomationDiscoverySession,
	resolveStudioAutomationDiscoveryAnswers,
	resolveStudioAutomationDiscoveryFollowupAnswers,
} = require("./studio-automation-discovery-demo");

const CANONICAL_PROMPT = [
	"Look back over my recent work from the last 30 days and identify repeated manual workflows",
	"worth creating an agentic automation for. Look at my work history from slack jira confluence loom figma github.",
].join(" ");

test("detects the Studio automation discovery prompt and dictation-tolerant variants", () => {
	assert.equal(isStudioAutomationDiscoveryPrompt(CANONICAL_PROMPT), true);
	assert.equal(
		isStudioAutomationDiscoveryPrompt(
			"Look at my work history for the last thirty days across Slack, Jira, Confluence, Loom, Figma, and GitHub. Find repeated manual workflows we can create agents for.",
		),
		true,
	);
	assert.equal(
		isStudioAutomationDiscoveryPrompt(
			"Review my recent work across Slack Jira Confluence Loom Figma GitHub and find repetitive workflows for agent automation.",
		),
		true,
	);
});

test("rejects prompts without the full recent-work automation-source intent", () => {
	assert.equal(isStudioAutomationDiscoveryPrompt("Summarize Slack and Jira from this week."), false);
	assert.equal(
		isStudioAutomationDiscoveryPrompt(
			"Look back over the last 30 days across Slack, Jira, Confluence, Loom, Figma, and GitHub.",
		),
		false,
	);
	assert.equal(
		isStudioAutomationDiscoveryPrompt(
			"Create an agent for repeated manual workflows from my recent work.",
		),
		false,
	);
});

test("detects dismissed clarification card prompts for the default-answer continuation", () => {
	assert.equal(
		isStudioAutomationDiscoveryDismissalPrompt(
			'The user dismissed the clarification questions for "Shape the automation discovery".',
		),
		true,
	);
	assert.equal(
		isStudioAutomationDiscoveryInitialDismissalPrompt(
			'The user dismissed the clarification questions for "Shape the automation discovery".',
		),
		true,
	);
	assert.equal(
		isStudioAutomationDiscoveryFollowupDismissalPrompt(
			'The user dismissed the clarification questions for "Confirm draft boundaries".',
		),
		true,
	);
	assert.equal(
		isStudioAutomationDiscoveryDismissalPrompt("The user dismissed an unrelated clarification card."),
		false,
	);
});

test("builds the initial clarification card with a unique demo session", () => {
	const payload = buildStudioAutomationDiscoveryQuestionCardPayload({
		toolCallId: "tool-initial",
	});
	const nextPayload = buildStudioAutomationDiscoveryQuestionCardPayload({
		toolCallId: "tool-initial-next",
	});

	assert.equal(payload.type, "question-card");
	assert.equal(isStudioAutomationDiscoverySession(payload.sessionId), true);
	assert.equal(isStudioAutomationDiscoveryInitialSession(payload.sessionId), true);
	assert.equal(isStudioAutomationDiscoveryInitialSession(nextPayload.sessionId), true);
	assert.notEqual(payload.sessionId, nextPayload.sessionId);
	assert.equal(payload.maxRounds, 2);
	assert.equal(payload.requiredCount, 3);
	assert.deepEqual(payload.questions.map((question) => question.id), [
		"priority",
		"source-weighting",
		"conservatism",
	]);
	assert.equal(payload.toolCallId, "tool-initial");
	assert.equal(payload.deferredToolCallId, "tool-initial");
});

test("builds the follow-up clarification card with a unique demo session", () => {
	const payload = buildStudioAutomationDiscoveryFollowupQuestionCardPayload({
		toolCallId: "tool-followup",
	});
	const nextPayload = buildStudioAutomationDiscoveryFollowupQuestionCardPayload({
		toolCallId: "tool-followup-next",
	});

	assert.equal(payload.type, "question-card");
	assert.equal(isStudioAutomationDiscoverySession(payload.sessionId), true);
	assert.equal(isStudioAutomationDiscoveryFollowupSession(payload.sessionId), true);
	assert.equal(isStudioAutomationDiscoveryFollowupSession(nextPayload.sessionId), true);
	assert.notEqual(payload.sessionId, nextPayload.sessionId);
	assert.equal(payload.round, 2);
	assert.equal(payload.maxRounds, 2);
	assert.deepEqual(payload.questions.map((question) => question.id), [
		"creation-boundary",
		"approval-boundary",
		"hero-moment",
	]);
	assert.equal(payload.toolCallId, "tool-followup");
	assert.equal(payload.deferredToolCallId, "tool-followup");
});

test("uses recommended clarification defaults when skipped or answered oddly", () => {
	assert.deepEqual(resolveStudioAutomationDiscoveryAnswers(null), {
		priority: "Operational impact",
		sourceWeighting: "TWG plus Confluence, Jira, Slack",
		conservatism: "Conservative create, defer weak signals",
	});
	assert.deepEqual(
		resolveStudioAutomationDiscoveryAnswers({
			answers: {
				priority: "moonshot everything",
				"source-weighting": ["not a source"],
				conservatism: "surprise me",
			},
		}),
		{
			priority: "Operational impact",
			sourceWeighting: "TWG plus Confluence, Jira, Slack",
			conservatism: "Conservative create, defer weak signals",
		},
	);
	assert.deepEqual(
		resolveStudioAutomationDiscoveryAnswers({
			answers: {
				priority: "presentation-clarity",
				"source-weighting": "loom-first",
				conservatism: "balanced",
			},
		}),
		{
			priority: "Presentation clarity",
			sourceWeighting: "Loom and design artifacts first",
			conservatism: "Balanced",
		},
	);
});

test("uses recommended follow-up defaults when skipped or answered oddly", () => {
	assert.deepEqual(resolveStudioAutomationDiscoveryFollowupAnswers(null), {
		creationBoundary: "Create the high-confidence three",
		approvalBoundary: "Draft for approval only",
		heroMoment: "Generated agent drafts",
	});
	assert.deepEqual(
		resolveStudioAutomationDiscoveryFollowupAnswers({
			answers: {
				"creation-boundary": "anything possible",
				"approval-boundary": "surprise me",
				"hero-moment": "all details",
			},
		}),
		{
			creationBoundary: "Create the high-confidence three",
			approvalBoundary: "Draft for approval only",
			heroMoment: "Generated agent drafts",
		},
	);
	assert.deepEqual(
		resolveStudioAutomationDiscoveryFollowupAnswers({
			answers: {
				"creation-boundary": "loom-and-lifecycle-first",
				"approval-boundary": "low-risk-autoclose",
				"hero-moment": "evidence-and-skips",
			},
		}),
		{
			creationBoundary: "Create Loom and lifecycle first",
			approvalBoundary: "Allow low-risk auto-close",
			heroMoment: "Evidence, skips, and deferrals",
		},
	);
});

test("scripted trace keeps TWG as the central correlation step before ranking", () => {
	const trace = buildStudioAutomationDiscoveryTrace();
	const toolNames = trace.map((step) => step.toolName);

	assert.ok(trace.length >= 9);
	assert.equal(toolNames[0], "identity.resolve_user");
	assert.ok(toolNames.includes("parallel.source_scan"));
	assert.ok(toolNames.includes("twg.search_work_patterns"));
	assert.ok(toolNames.indexOf("twg.search_work_patterns") > toolNames.indexOf("confluence.atlas_update_scan"));
	assert.ok(toolNames.indexOf("twg.search_work_patterns") < toolNames.indexOf("studio.rank_automation_candidates"));

	const twgStep = trace.find((step) => step.toolName === "twg.search_work_patterns");
	assert.match(twgStep.outputPreview, /Three high-confidence automation candidates/u);
	assert.equal(twgStep.contentRows.length, 3);
});

test("scripted trace can pause after discovery before creating agents", () => {
	const trace = buildStudioAutomationDiscoveryTrace({ phase: "discovery" });
	const toolNames = trace.map((step) => step.toolName);

	assert.ok(toolNames.includes("twg.search_work_patterns"));
	assert.ok(toolNames.includes("studio.rank_automation_candidates"));
	assert.equal(toolNames.includes("studio.create_agent_drafts"), false);
	assert.match(
		trace.at(-1).outputPreview,
		/pending your boundary check/u,
	);
});

test("scripted generation trace resumes after the follow-up questions", () => {
	const trace = buildStudioAutomationDiscoveryTrace({
		followupSubmission: {
			answers: {
				"creation-boundary": "create-high-confidence-three",
				"approval-boundary": "draft-for-approval",
				"hero-moment": "generated-agent-drafts",
			},
		},
		phase: "generation",
	});
	const toolNames = trace.map((step) => step.toolName);

	assert.deepEqual(toolNames, [
		"studio.resolve_creation_boundaries",
		"studio.create_agent_drafts",
	]);
	assert.match(trace[0].outputPreview, /Draft boundaries resolved/u);
});

test("scripted trace slows down rich draft creation for the three generated agents", () => {
	const trace = buildStudioAutomationDiscoveryTrace();
	const createStep = trace.find((step) => step.toolName === "studio.create_agent_drafts");

	assert.ok(createStep);
	assert.equal(createStep.contentRows.length, 3);
	assert.ok(createStep.delayMs >= 9000);
	assert.deepEqual(
		createStep.contentRows.map((row) => row.input.primitive),
		["multi-channel distribution", "lifecycle triage", "weekly synthesis"],
	);
});

test("widget payload carries three distinct generated agent results", () => {
	const payload = buildStudioAutomationDiscoveryWidgetPayload();

	assert.equal(payload.type, DEMO_WIDGET_TYPE);
	assert.equal(payload.title, "Generated agents");
	assert.equal(payload.agents.length, 3);
	assert.deepEqual(payload.agents.map((agent) => agent.agentResult.name), [
		"Loom Distribution Agent",
		"Inactive Agent Triage Agent",
		"Weekly Sprint/Atlas Digest Agent",
	]);
	assert.deepEqual(payload.agents.map((agent) => agent.agentResult.byline), [
		"Multi-channel distribution",
		"Lifecycle triage",
		"Weekly synthesis and update drafting",
	]);
	assert.deepEqual(payload.agents.map((agent) => agent.agentResult.automationRules[0].name), [
		"Distribute new design Looms",
		"Triage agent-reaper-bot tickets",
		"Draft weekly Studio digest",
	]);
	assert.deepEqual(payload.agents.map((agent) => agent.agentResult.automationRules[0].triggers.length), [2, 2, 2]);
	assert.ok(payload.agents.every((agent) => agent.agentResult.automationRules[0].prompt.length > 180));
	assert.deepEqual(payload.agents.map((agent) => agent.item.logoSrc), [
		"/avatar-agent-new/purple/customer-insight.svg",
		"/avatar-agent-new/yellow/ops-agent.svg",
		"/avatar-agent-new/orange/research-scout.svg",
	]);
	assert.deepEqual(payload.agents.map((agent) => agent.agentResult.avatarSrc), [
		"/avatar-agent-new/purple/customer-insight.svg",
		"/avatar-agent-new/yellow/ops-agent.svg",
		"/avatar-agent-new/orange/research-scout.svg",
	]);
	assert.ok(payload.agents[0].agentResult.apps.includes("loom"));
	assert.ok(payload.agents[1].agentResult.apps.includes("jira"));
	assert.ok(payload.agents[2].agentResult.apps.includes("calendar"));
	assert.ok(payload.agents[0].agentResult.summary.includes("approve"));
	assert.ok(payload.agents[1].agentResult.summary.includes("keep-list"));
	assert.ok(payload.agents[2].agentResult.summary.includes("end of the week"));
	assert.ok(payload.agents.every((agent) => agent.agentResult.conversationStarters.every((starter) => starter.length > 35)));
	assert.ok(payload.agents.every((agent) => agent.agentResult.instructions.includes("## Output shape")));
	assert.deepEqual(
		payload.agents.map((agent) => agent.agentResult.sourceLabel),
		[
			"Generated from recent work patterns",
			"Generated from recent work patterns",
			"Generated from recent work patterns",
		],
	);
	assert.ok(payload.skipped.some((item) => item.includes("Design support auto-replies")));
	assert.ok(payload.needsEvidence.some((item) => item.includes("Design crit prep")));
});

test("visible demo copy uses second person instead of naming the current user", () => {
	const visiblePayloads = [
		buildStudioAutomationDiscoveryQuestionCardPayload({ toolCallId: "tool-initial" }),
		buildStudioAutomationDiscoveryFollowupQuestionCardPayload({ toolCallId: "tool-followup" }),
		buildStudioAutomationDiscoveryTrace(),
		buildStudioAutomationDiscoveryWidgetPayload(),
		buildStudioAutomationDiscoveryFinalText(),
	];

	assert.doesNotMatch(JSON.stringify(visiblePayloads), /\bVenn\b|Venn's/u);
	assert.doesNotMatch(JSON.stringify(visiblePayloads), /\bdemo\b/iu);
	assert.match(buildStudioAutomationDiscoveryFinalText(), /your recent work patterns/u);
	assert.match(buildStudioAutomationDiscoveryWidgetPayload().summary, /your recent work patterns/u);
});
