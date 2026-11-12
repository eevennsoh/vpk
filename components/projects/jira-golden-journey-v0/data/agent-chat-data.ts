import {
	ROVO_AGENT_ID,
	ROVO_AGENT_PROFILES,
	type RovoAgentProfile,
} from "@/app/data/directory/agents";
import type { JiraForYouItem } from "@/components/projects/jira-for-you";
import { getDeterministicAgentAvatarSrc } from "@/lib/agent-avatars";
import type { RovoUIMessage } from "@/lib/rovo-ui-messages";
import type { ChatContextBarDescriptor } from "@/components/projects/shared/lib/chat-context-bar";
import type { QuestionCardQuestion } from "@/components/blocks/question-card/types";

export interface AsxAgentChatScenario {
	agentId: string;
	agentName: string;
	issueKey: string;
	issueSummary: string;
	intro?: string;
	playbackVariant?: "claude-code-build" | "jira-description-improvement" | "ci-fix" | "static-result";
	question?: QuestionCardQuestion;
	request?: string;
	result?: string;
}

export interface AsxAgentChatPlaybackFrame {
	delayMs: number;
	parts: RovoUIMessage["parts"];
}

export interface AsxAgentChatPlayback {
	assistantMessageId: string;
	frames: readonly AsxAgentChatPlaybackFrame[];
	keepThinkingActiveAfterLastFrame?: boolean;
	userMessage: RovoUIMessage;
}

const ASX_AGENT_PROFILES = [
	{
		id: "rfp-drafter",
		name: "RFP Drafter",
		byline: "ASX demo agent by Rovo",
		avatarSrc: getDeterministicAgentAvatarSrc("rfp-drafter"),
		description: "Drafts response narratives and prepares concise RFP handoffs for review.",
		starters: [],
		contextDescription: "Answer as RFP Drafter for the selected ASX Jira issue.",
	},
	{
		id: "service-impact-agent",
		name: "Service impact agent",
		byline: "ASX demo agent by Rovo",
		avatarSrc: "/avatar-agent-new/yellow/ops-agent.svg",
		description: "Maps affected services, owners, and customer-facing impact for Jira work items.",
		starters: [],
		contextDescription: "Answer as Service impact agent for the selected ASX Jira issue.",
	},
	{
		id: "dependency-mapper",
		name: "Dependency mapper",
		byline: "ASX demo agent by Rovo",
		avatarSrc: "/avatar-agent-new/blue/backlog-buddy.svg",
		description: "Finds dependent components, linked work, and blocked handoffs.",
		starters: [],
		contextDescription: "Answer as Dependency mapper for the selected ASX Jira issue.",
	},
] as const satisfies readonly RovoAgentProfile[];

/** Static profiles supplied to the ASX-local provider so chat can select demo agents. */
export const ASX_CHAT_AGENT_PROFILES: readonly RovoAgentProfile[] = [
	...ROVO_AGENT_PROFILES,
	...ASX_AGENT_PROFILES,
];

const ASX_FOR_YOU_AGENT_BY_ITEM_ID: Readonly<Record<string, {
	agentId: string;
	agentName: string;
}>> = {
	"vitafleet-presentation": { agentId: "readiness-checker", agentName: "Readiness checker" },
	"crm-analytics-dashboard": { agentId: "feedback-analyzer", agentName: "Feedback analyzer" },
	"performance-benchmarking": { agentId: "progress-tracker", agentName: "Progress tracker" },
	"refactor-readability": { agentId: "code-planner", agentName: "Code planner" },
	"payment-suite-failures": { agentId: "code-reviewer", agentName: "Code reviewer" },
	"onboarding-e2e-coverage": { agentId: "code-planner", agentName: "Code planner" },
	"critical-component-testing": { agentId: "code-reviewer", agentName: "Code reviewer" },
	"ci-pipeline": { agentId: "progress-tracker", agentName: "Progress tracker" },
	"enhance-accessibility": { agentId: "feedback-analyzer", agentName: "Feedback analyzer" },
	"third-party-apis": { agentId: "readiness-checker", agentName: "Readiness checker" },
};

/** Maps each For You fixture to a deterministic selected-agent chat playback. */
export function buildAsxForYouAgentChatScenario(item: JiraForYouItem): AsxAgentChatScenario {
	const agent = ASX_FOR_YOU_AGENT_BY_ITEM_ID[item.id] ?? {
		agentId: ROVO_AGENT_ID,
		agentName: "Rovo",
	};

	return {
		...agent,
		issueKey: item.issueKey,
		issueSummary: item.title,
		request: `Show me the latest update on ${item.issueKey}.`,
		result: [
			`${agent.agentName} checked **${item.issueKey}** and confirmed its current Jira status is **${item.jiraStatus}**.`,
			`I reviewed the available ${item.spaceName} context and prepared the next useful handoff for this work item.`,
		].join("\n\n"),
	};
}

/** Builds the persistent, non-dismissible work-item context shown in ASX chat. */
export function buildAsxAgentChatContextBar(
	scenario: AsxAgentChatScenario,
): ChatContextBarDescriptor {
	return {
		iconName: "work-item",
		label: `${scenario.issueKey}: ${scenario.issueSummary}`,
		showDismissPlaceholder: false,
		signature: `asx-work-item:${scenario.issueKey}`,
	};
}

function getScenarioRequest(scenario: AsxAgentChatScenario): string {
	return scenario.request ?? `Continue working on ${scenario.issueKey}: ${scenario.issueSummary}.`;
}

function getScenarioResult(scenario: AsxAgentChatScenario): string {
	if (scenario.result) return scenario.result;

	return [
		`I finished a first pass for **${scenario.issueKey}** with the context available on the work item.`,
		"I mapped the relevant requirements, checked the linked evidence, and prepared a concise handoff for Review.",
	].join("\n\n");
}

function buildAsxQuestionCardParts(
	scenario: AsxAgentChatScenario,
	runId: string,
): RovoUIMessage["parts"] | null {
	if (!scenario.question) return null;

	const toolCallId = `asx-agent-question-${runId}`;
	return [
		{
			type: "text",
			text: scenario.intro ?? "I found a decision point that needs your input before I can continue with the implementation notes.",
			state: "done",
		},
		{
			type: "data-widget-data",
			data: {
				type: "question-card",
				payload: {
					type: "question-card",
					sessionId: toolCallId,
					round: 1,
					maxRounds: 1,
					title: "Answer to continue",
					requiredCount: 1,
					toolCallId,
					questions: [{ ...scenario.question, required: true }],
				},
			},
		},
	];
}

function createThinkingStatus({
	content,
	label,
	timestamp,
	toolCallId,
}: Readonly<{
	content: string;
	label: string;
	timestamp: string;
	toolCallId: string;
}>): RovoUIMessage["parts"][number] {
	return {
		type: "data-thinking-status",
		data: {
			activity: "data",
			content,
			label,
			source: "fallback",
			timestamp,
			toolCallId,
		},
	};
}

function createThinkingEvent({
	input,
	label,
	output,
	outputPreview,
	permissionScenario,
	phase,
	timestamp,
	toolCallId,
	toolName,
}: Readonly<{
	input?: unknown;
	label: string;
	output?: unknown;
	outputPreview?: string;
	permissionScenario?: string;
	phase: "start" | "result";
	timestamp: string;
	toolCallId: string;
	toolName: string;
}>): RovoUIMessage["parts"][number] {
	return {
		type: "data-thinking-event",
		id: `${toolCallId}-${phase}`,
		data: {
			eventId: `${toolCallId}-${phase}`,
			phase,
			toolName,
			label,
			toolCallId,
			...(input !== undefined ? { input } : {}),
			...(output !== undefined ? { output } : {}),
			...(outputPreview ? { outputPreview } : {}),
			...(permissionScenario ? { permissionScenario } : {}),
			timestamp,
		},
	};
}

function buildJiraDescriptionTraceParts(
	scenario: AsxAgentChatScenario,
	runId: string,
	now: number,
): ReadonlyArray<RovoUIMessage["parts"]> {
	const parts: RovoUIMessage["parts"] = [];
	const snapshots: RovoUIMessage["parts"][] = [];
	const timestamp = (offsetMs: number) => new Date(now + offsetMs).toISOString();
	const appendSnapshot = (...nextParts: RovoUIMessage["parts"]) => {
		parts.push(...nextParts.flat());
		snapshots.push([...parts]);
	};
	const tools = [
		{
			id: `jira-context-${runId}`,
			toolName: "jira.read_work_item_context",
			label: "Reading the current work item",
			content: "Reviewing the existing outcome, known constraints, and initial acceptance criteria without changing the description.",
			input: { issueKey: scenario.issueKey, fields: ["description", "comments", "attachments"] },
			output: { issueKey: scenario.issueKey, descriptionState: "initial-draft", attachmentCount: 2 },
			outputPreview: "Current description and supporting product evidence reviewed.",
		},
		{
			id: `twg-context-${runId}`,
			toolName: "twg.lookup_work_item_delivery_context",
			label: "Connecting related delivery context",
			content: "Using Teamwork Graph to correlate the reporter, checkout research, design brief, and storefront ownership signals.",
			input: { issueKey: scenario.issueKey, relationshipDepth: 2 },
			output: { sources: ["Jira", "Confluence", "Figma"], relatedSignals: 4 },
			outputPreview: "Found 4 relevant delivery signals across Jira, Confluence, and Figma.",
		},
		{
			id: `requirements-${runId}`,
			toolName: "confluence.search_checkout_requirements",
			label: "Checking product requirements",
			content: "Comparing the draft against checkout-funnel research and the guest-checkout product brief.",
			input: { query: "guest checkout safeguards recovery accessibility", issueKey: scenario.issueKey },
			output: { matchedRequirements: 6, missingFromDraft: ["server validation", "recoverable errors", "mobile web"] },
			outputPreview: "Identified three implementation-critical details missing from the initial draft.",
		},
		{
			id: `draft-${runId}`,
			toolName: "jira.draft_work_item_description",
			label: "Drafting the improved description",
			content: "Structuring a clearer user outcome, delivery scope, proposed flow, and testable acceptance criteria.",
			input: { issueKey: scenario.issueKey, mode: "suggestion-only", preserveOriginal: true },
			output: { status: "drafted", workItemUpdated: false },
			outputPreview: "Improved description drafted; the work item remains unchanged.",
		},
	] as const;

	tools.forEach((tool, index) => {
		const offset = index * 800;
		appendSnapshot(
			createThinkingStatus({
				content: tool.content,
				label: tool.label,
				timestamp: timestamp(offset),
				toolCallId: tool.id,
			}),
			createThinkingEvent({
				input: tool.input,
				label: tool.label,
				phase: "start",
				timestamp: timestamp(offset),
				toolCallId: tool.id,
				toolName: tool.toolName,
			}),
		);
		appendSnapshot(createThinkingEvent({
			label: tool.label,
			output: tool.output,
			outputPreview: tool.outputPreview,
			phase: "result",
			timestamp: timestamp(offset + 500),
			toolCallId: tool.id,
			toolName: tool.toolName,
		}));
	});

	return snapshots;
}

function buildJiraDescriptionPlayback(
	scenario: AsxAgentChatScenario,
	runId: string,
	now: number,
): Pick<AsxAgentChatPlayback, "frames" | "keepThinkingActiveAfterLastFrame"> {
	const traceSnapshots = buildJiraDescriptionTraceParts(scenario, runId, now);
	const finalTrace = traceSnapshots.at(-1) ?? [];
	const questionCardParts = buildAsxQuestionCardParts(scenario, runId);

	if (questionCardParts) {
		const askToolCallId = `ask-user-${runId}`;
		const timestamp = new Date(now + 3_400).toISOString();
		return {
			frames: [{
				delayMs: 0,
				parts: [
					...finalTrace,
					createThinkingStatus({
						content: "The suggestion is ready. Waiting for Venn to decide whether Jira should apply it.",
						label: "Awaiting user response",
						timestamp,
						toolCallId: askToolCallId,
					}),
					createThinkingEvent({
						input: { questions: [scenario.question?.label] },
						label: "Confirming the description update",
						phase: "start",
						timestamp,
						toolCallId: askToolCallId,
						toolName: "ask_user_questions",
					}),
					{ type: "data-turn-complete", data: { timestamp } },
					...questionCardParts,
				],
			}],
		};
	}

	return {
		frames: traceSnapshots.map((parts, index) => ({
			delayMs: index === 0 ? 0 : 400,
			parts,
		})),
		keepThinkingActiveAfterLastFrame: true,
	};
}

function buildCiFixPlayback(
	_scenario: AsxAgentChatScenario,
	runId: string,
	now: number,
): Pick<AsxAgentChatPlayback, "frames"> {
	const parts: RovoUIMessage["parts"] = [];
	const frames: AsxAgentChatPlaybackFrame[] = [];
	const timestamp = (offsetMs: number) => new Date(now + offsetMs).toISOString();
	const tools = [
		{
			id: `inspect-pr-${runId}`,
			toolName: "bash",
			label: "Inspecting the pull request",
			content: "Using gh to inspect PR #1847 and its failed lint and typecheck check.",
			input: { command: "gh pr checks 1847 && gh run view --log-failed" },
			output: { failedCheck: "Lint and typecheck", status: "failed" },
			outputPreview: "Found the failed lint and typecheck check on PR #1847.",
		},
		{
			id: `read-annotation-${runId}`,
			toolName: "expand_code_chunks",
			label: "Reading the lint annotation",
			content: "Reading the failing annotation and the order-creation call site.",
			input: { path: "packages/orders/src/guest-order-service.ts", annotation: "deliveryAddress may be null" },
			output: { line: 118, diagnostic: "deliveryAddress may be null" },
			outputPreview: "The order path accepts a nullable deliveryAddress without narrowing it.",
		},
		{
			id: `patch-address-${runId}`,
			toolName: "find_and_replace_code",
			label: "Repairing address validation",
			content: "Narrowing deliveryAddress before order creation while preserving the existing validation response.",
			input: { path: "packages/orders/src/guest-order-service.ts", symbol: "deliveryAddress" },
			output: { status: "updated", filesChanged: 1 },
			outputPreview: "deliveryAddress is now narrowed before the order is created.",
		},
		{
			id: `validate-fix-${runId}`,
			toolName: "bash",
			label: "Running focused validation",
			content: "Running the narrow lint and typecheck validation for the repaired order path.",
			input: { command: "pnpm lint --filter guest-orders && pnpm typecheck" },
			output: { lint: "passed", typecheck: "passed" },
			outputPreview: "Focused lint and typecheck validation passed.",
		},
		{
			id: `push-fix-${runId}`,
			toolName: "bash",
			label: "Pushing the repair",
			content: "Committing the nullability repair, pushing it, and confirming GitHub started the check rerun.",
			input: { command: "git commit -m 'fix guest delivery address narrowing' && git push && gh pr checks 1847" },
			output: { pushed: true, checkStatus: "running" },
			outputPreview: "Repair pushed; GitHub is rerunning lint and typecheck.",
		},
	] as const;

	tools.forEach((tool, index) => {
		const offsetMs = index * 600;
		parts.push(
			createThinkingStatus({
				content: tool.content,
				label: tool.label,
				timestamp: timestamp(offsetMs),
				toolCallId: tool.id,
			}),
			createThinkingEvent({
				input: tool.input,
				label: tool.label,
				phase: "start",
				timestamp: timestamp(offsetMs),
				toolCallId: tool.id,
				toolName: tool.toolName,
			}),
		);
		frames.push({ delayMs: index === 0 ? 0 : 300, parts: [...parts] });
		parts.push(createThinkingEvent({
			label: tool.label,
			output: tool.output,
			outputPreview: tool.outputPreview,
			phase: "result",
			timestamp: timestamp(offsetMs + 300),
			toolCallId: tool.id,
			toolName: tool.toolName,
		}));
		frames.push({ delayMs: 300, parts: [...parts] });
	});

	return { frames };
}

/**
 * Deterministic, uneven tool-entrance delays for the Build Claude Code CoT demo.
 * Mix of short beats and longer pauses so reveals do not tick on a uniform cadence.
 */
const CLAUDE_BUILD_TOOL_ENTRANCE_DELAYS_MS = [
	1_100,
	1_650,
	480,
	1_900,
	720,
	1_450,
	540,
	2_050,
	860,
] as const;

/** Delays between stacked byline/status updates while a tool stays active. */
const CLAUDE_BUILD_BYLINE_CYCLE_DELAYS_MS = [420, 680, 510, 760] as const;

const CLAUDE_BUILD_RESULT_DELAY_MS = 580;

/**
 * Build-chapter Claude Code demo: agent text first, then a long tool trace that
 * never settles. Tool names map to distinct icons in `tool-icon-resolver`; the
 * final frame mixes completed steps with an open in-progress validation call.
 * Each tool entrance uses a varied delay, and active tools cycle multiple
 * `data-thinking-status` bylines so ChainOfThought's CyclingByline animates.
 */
function buildClaudeCodeBuildTraceFrames(
	scenario: AsxAgentChatScenario,
	runId: string,
	now: number,
): readonly AsxAgentChatPlaybackFrame[] {
	const parts: RovoUIMessage["parts"] = [];
	const frames: AsxAgentChatPlaybackFrame[] = [];
	let clockMs = 0;
	const timestampAt = (offsetMs: number) => new Date(now + offsetMs).toISOString();
	/** Advance the demo clock, then append a cumulative parts snapshot. */
	const pushFrame = (
		delayMs: number,
		buildParts: (stamp: string) => RovoUIMessage["parts"],
	) => {
		clockMs += delayMs;
		parts.push(...buildParts(timestampAt(clockMs)).flat());
		frames.push({ delayMs, parts: [...parts] });
	};

	const openingText = [
		`I'm taking the lead on **${scenario.issueKey}** after Code Planner's secure API handoff.`,
		"",
		"I'll implement guest checkout end to end from the contract:",
		"1. Confirm the server-owned guest-order endpoint and validation matrix",
		"2. Replace the registration gate with an email-first storefront flow",
		"3. Add recoverable address, inventory, and payment errors",
		"4. Cover the critical paths, then validate before design evidence and PR handoff",
		"",
		"Starting with the planner contract and current checkout paths — this work is still in progress.",
	].join("\n");

	// Text first so ConversationContent renders user → agent text → CoT/tools.
	pushFrame(0, () => [{
		type: "text",
		text: openingText,
		state: "done",
	}]);

	type BuildTool = {
		id: string;
		toolName: string;
		label: string;
		bylines: readonly string[];
		input: unknown;
		output: unknown;
		outputPreview: string;
		/** When true, the tool stays open (running) in the final paused frame. */
		leaveRunning?: boolean;
		/** Optional approval pause for status variety in the paused demo frame. */
		permissionScenario?: string;
	};

	// Native tool names resolve to different icons (work item, TWG, folder, file,
	// code, checklist, terminal) instead of falling back to the generic wrench.
	// Parent `label` stays generic (tool-category phrasing). Specific narrative
	// lives in cycling `bylines` so CoT headings don't parrot the work detail.
	const tools: readonly BuildTool[] = [
		{
			id: `consult-contract-${runId}`,
			toolName: "jira.read_work_item",
			label: "Reading the work item",
			bylines: [
				"Opening the planner handoff for the guest-order endpoint shape.",
				"Pulling server-owned pricing, tax, and shipping rules from the contract.",
				"Checking idempotency and recoverable-error requirements before coding.",
			],
			input: {
				issueKey: scenario.issueKey,
				fields: ["description", "comments", "linkedWork"],
				handoffFrom: "code-planner",
			},
			output: {
				status: "ready",
				endpoint: "POST /api/guest-orders",
				requiresIdempotencyKey: true,
				serverOwned: ["pricing", "tax", "shipping", "inventory"],
			},
			outputPreview: "Contract accepted: server-owned totals, required idempotency key, recoverable errors.",
		},
		{
			id: `delivery-context-${runId}`,
			toolName: "twg.lookup_work_item_delivery_context",
			label: "Connecting delivery context",
			bylines: [
				"Asking Teamwork Graph for checkout research and ownership signals.",
				"Correlating the design brief with storefront delivery context.",
				"Ranking related Jira, Confluence, and Figma signals before edits.",
			],
			input: { issueKey: scenario.issueKey, relationshipDepth: 2 },
			output: { sources: ["Jira", "Confluence", "Figma"], relatedSignals: 5 },
			outputPreview: "Found delivery signals across Jira, Confluence, and Figma.",
		},
		{
			id: `explore-checkout-${runId}`,
			toolName: "open_files",
			label: "Opening files",
			bylines: [
				"Opening CheckoutGate, OrderSummary, and the create-order entry points.",
				"Tracing where anonymous shoppers hit the registration gate.",
				"Mapping payment-adapter seams that still assume a signed-in account.",
			],
			input: {
				paths: [
					"apps/storefront/checkout/CheckoutGate.tsx",
					"apps/storefront/checkout/OrderSummary.tsx",
					"packages/orders/src/create-order.ts",
				],
			},
			output: {
				opened: 3,
				risk: "CheckoutGate redirects anonymous shoppers to /signup before payment.",
			},
			outputPreview: "Registration gate still assumes a signed-in account before payment.",
		},
		{
			id: `guest-order-service-${runId}`,
			toolName: "create_file",
			label: "Creating files",
			bylines: [
				"Scaffolding guest-order-service with server-owned totals.",
				"Adding the idempotency helper and guest-orders route.",
				"Wiring pricing, tax, shipping, and inventory recalculation before payment.",
			],
			input: {
				path: "packages/orders/src/guest-order-service.ts",
				alsoCreating: ["packages/orders/src/idempotency.ts", "apps/api/routes/guest-orders.ts"],
			},
			output: { status: "written", filesChanged: 3, additions: 246, deletions: 12 },
			outputPreview: "Guest-order endpoint and idempotency helper written with server-owned totals.",
		},
		{
			id: `storefront-flow-${runId}`,
			toolName: "find_and_replace_code",
			label: "Editing code",
			bylines: [
				"Replacing the signup redirect with an email-first guest step.",
				"Keeping account linking post-purchase on the payment path.",
				"Updating OrderSummary to accept guest session tokens.",
			],
			input: {
				path: "apps/storefront/checkout/CheckoutGate.tsx",
				pattern: "redirectToSignup",
				replacement: "renderGuestEmailStep",
			},
			output: { status: "updated", filesChanged: 3, additions: 118, deletions: 47 },
			outputPreview: "Guest email step wired; signup redirect removed from the payment path.",
		},
		{
			id: `validation-errors-${runId}`,
			toolName: "expand_code_chunks",
			label: "Inspecting code",
			bylines: [
				"Defining field-safe address, inventory, and payment error codes.",
				"Mapping provider failures to checkout UI banners.",
				"Checking that error copy never leaks raw payment details.",
			],
			input: {
				paths: [
					"packages/orders/src/guest-order-errors.ts",
					"apps/storefront/checkout/CheckoutErrorBanner.tsx",
				],
			},
			output: {
				status: "written",
				errorCodes: ["ADDRESS_INVALID", "INVENTORY_UNAVAILABLE", "PAYMENT_DECLINED"],
			},
			outputPreview: "Recoverable error codes mapped to checkout UI banners.",
		},
		{
			id: `unit-tests-${runId}`,
			toolName: "create_file",
			label: "Creating files",
			bylines: [
				"Writing idempotent-retry and server-owned totals cases.",
				"Covering the three recoverable failure paths.",
				"Adding GuestEmailStep render coverage for the storefront flow.",
			],
			input: {
				path: "packages/orders/src/guest-order-service.test.ts",
				alsoCreating: ["apps/storefront/checkout/GuestEmailStep.test.tsx"],
			},
			output: { status: "written", testsAdded: 11 },
			outputPreview: "Unit coverage landed for idempotency, totals, and recoverable errors.",
		},
		{
			id: `progress-${runId}`,
			toolName: "update_todo",
			label: "Updating todos",
			bylines: [
				"Marking completed guest-checkout slices in the todo list.",
				"Keeping validation queued while lint and typecheck run.",
				"Holding the progress checkpoint until checks settle.",
			],
			input: {
				todos: [
					{ id: "contract", content: "Confirm planner contract", status: "completed" },
					{ id: "service", content: "Implement guest-order service", status: "completed" },
					{ id: "storefront", content: "Wire guest storefront flow", status: "completed" },
					{ id: "validate", content: "Validate lint, types, and unit tests", status: "in_progress" },
				],
			},
			output: {},
			outputPreview: "",
			// Stays open as approval-requested so the paused frame mixes statuses.
			leaveRunning: true,
			permissionScenario: "progress-checkpoint",
		},
		{
			id: `validate-${runId}`,
			toolName: "bash",
			label: "Running a command",
			bylines: [
				"Running lint, typecheck, and guest-checkout unit tests.",
				"Still waiting on typecheck failures in guest-order-service.",
				"Re-running unit coverage after the latest fix attempt.",
				"Validation still in progress — holding before verify and PR handoff.",
			],
			input: {
				command: "pnpm lint && pnpm typecheck && pnpm test packages/orders apps/storefront/checkout",
				cwd: "shop",
			},
			output: {},
			outputPreview: "",
			leaveRunning: true,
		},
	];

	tools.forEach((tool, index) => {
		const entranceDelay = CLAUDE_BUILD_TOOL_ENTRANCE_DELAYS_MS[index]
			?? CLAUDE_BUILD_TOOL_ENTRANCE_DELAYS_MS[CLAUDE_BUILD_TOOL_ENTRANCE_DELAYS_MS.length - 1]
			?? 900;
		const [leadByline, ...restBylines] = tool.bylines;

		pushFrame(entranceDelay, (stamp) => [
			createThinkingStatus({
				content: leadByline ?? tool.label,
				label: tool.label,
				timestamp: stamp,
				toolCallId: tool.id,
			}),
			createThinkingEvent({
				input: tool.input,
				label: tool.label,
				phase: "start",
				permissionScenario: tool.permissionScenario,
				timestamp: stamp,
				toolCallId: tool.id,
				toolName: tool.toolName,
			}),
		]);

		restBylines.forEach((byline, bylineIndex) => {
			const cycleDelay = CLAUDE_BUILD_BYLINE_CYCLE_DELAYS_MS[
				bylineIndex % CLAUDE_BUILD_BYLINE_CYCLE_DELAYS_MS.length
			] ?? 500;
			pushFrame(cycleDelay, (stamp) => [
				createThinkingStatus({
					content: byline,
					label: tool.label,
					timestamp: stamp,
					toolCallId: tool.id,
				}),
			]);
		});

		if (tool.leaveRunning) {
			return;
		}

		pushFrame(CLAUDE_BUILD_RESULT_DELAY_MS, (stamp) => [
			createThinkingEvent({
				label: tool.label,
				output: tool.output,
				outputPreview: tool.outputPreview,
				phase: "result",
				timestamp: stamp,
				toolCallId: tool.id,
				toolName: tool.toolName,
			}),
		]);
	});

	return frames;
}

function buildClaudeCodeBuildPlayback(
	scenario: AsxAgentChatScenario,
	runId: string,
	now: number,
): Pick<AsxAgentChatPlayback, "frames" | "keepThinkingActiveAfterLastFrame"> {
	return {
		frames: buildClaudeCodeBuildTraceFrames(scenario, runId, now),
		keepThinkingActiveAfterLastFrame: true,
	};
}

/**
 * Builds a deterministic local thinking -> generating -> completed transcript.
 * The ids vary per playback, while the visible content and timing stay stable.
 */
export function buildAsxAgentChatPlayback(
	scenario: AsxAgentChatScenario,
	runId: string,
	now = Date.now(),
): AsxAgentChatPlayback {
	const assistantMessageId = `asx-agent-assistant-${runId}`;
	const questionCardParts = buildAsxQuestionCardParts(scenario, runId);
	const toolCallId = `asx-agent-work-${runId}`;
	const startedAt = new Date(now).toISOString();
	const completedAt = new Date(now + 2_400).toISOString();
	const thinkingStatus = {
		type: "data-thinking-status" as const,
		data: {
			label: `Reviewing ${scenario.issueKey}`,
			content: `${scenario.agentName} is reading the issue context and connected work before preparing an update.`,
			toolCallId,
			activity: "data" as const,
			source: "fallback" as const,
			timestamp: startedAt,
		},
	};
	const toolStart = {
		type: "data-thinking-event" as const,
		id: `${toolCallId}-start`,
		data: {
			eventId: `${toolCallId}-start`,
			phase: "start" as const,
			toolName: "jira.read_work_item_context",
			label: "Reading the work item and linked context",
			toolCallId,
			input: { issueKey: scenario.issueKey, summary: scenario.issueSummary },
			timestamp: startedAt,
		},
	};
	const toolResult = {
		type: "data-thinking-event" as const,
		id: `${toolCallId}-result`,
		data: {
			eventId: `${toolCallId}-result`,
			phase: "result" as const,
			toolName: "jira.read_work_item_context",
			label: "Reading the work item and linked context",
			toolCallId,
			output: { status: "ready-for-handoff", issueKey: scenario.issueKey },
			outputPreview: "Issue context reviewed and handoff prepared.",
			timestamp: completedAt,
		},
	};
	const result = getScenarioResult(scenario);
	const jiraDescriptionPlayback = scenario.playbackVariant === "jira-description-improvement"
		? buildJiraDescriptionPlayback(scenario, runId, now)
		: null;
	const claudeCodeBuildPlayback = scenario.playbackVariant === "claude-code-build"
		? buildClaudeCodeBuildPlayback(scenario, runId, now)
		: null;
	const ciFixPlayback = scenario.playbackVariant === "ci-fix"
		? buildCiFixPlayback(scenario, runId, now)
		: null;
	const specializedPlayback = jiraDescriptionPlayback ?? claudeCodeBuildPlayback ?? ciFixPlayback;
	const staticResultParts = scenario.playbackVariant === "static-result"
		? [{ type: "text" as const, text: result, state: "done" as const }]
		: null;

	return {
		assistantMessageId,
		...(specializedPlayback ?? {}),
		userMessage: {
			id: `asx-agent-user-${runId}`,
			role: "user",
			parts: [{ type: "text", text: getScenarioRequest(scenario), state: "done" }],
		},
		frames: specializedPlayback?.frames ?? (staticResultParts
			? [{ delayMs: 0, parts: staticResultParts }]
			: questionCardParts ? [{ delayMs: 0, parts: questionCardParts }] : [
			{ delayMs: 0, parts: [thinkingStatus] },
			{ delayMs: 700, parts: [thinkingStatus, toolStart] },
			{
				delayMs: 900,
				parts: [thinkingStatus, toolStart, { type: "text", text: result.split("\n\n")[0] ?? result, state: "streaming" }],
			},
			{
				delayMs: 800,
				parts: [thinkingStatus, toolStart, toolResult, { type: "text", text: result, state: "done" }],
			},
		]),
	};
}
