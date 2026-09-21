"use client";

import { useCallback, useMemo, useState } from "react";

import { RovoChatProvider } from "@/app/contexts";
import { JiraEpic } from "@/components/blocks/jira-epic";
import { JIRA_EPIC_DEMO_EPICS } from "@/components/blocks/jira-epic/data/demo-epics";
import {
	JiraIssue,
	type JiraIssueAgentActivity,
	type JiraIssueAgentActivityLayout,
	type JiraIssueAgentActivityMode,
	type JiraIssueAgentSessionTransferConfig,
	type JiraIssueChrome,
	type JiraIssueCompletedAgentRun,
	type JiraIssueGenerativeActionRequest,
	type JiraIssueIconScale,
	type JiraIssuePullRequestPreview,
	type JiraIssuePullRequestStatus,
} from "@/components/blocks/jira-issue";
import { AGENT_SESSION_ITEMS, AgentSession, type AgentSessionItem } from "@/components/blocks/agent-session";
import { toAgentAssignmentAgent } from "@/components/blocks/jira-issue/agent-activity";
import {
	nextJiraIssueDemoLinkedIds,
	splitJiraIssueDemoSessionsById,
	toJiraIssueDemoAttachedActivity,
} from "@/components/blocks/jira-issue/agent-session-demo-attach";
import {
	GITHUB_BRANCH_SMART_LINK_ICON,
	GITHUB_COMMIT_SMART_LINK_ICON,
	toPullRequestSmartLink,
	type SmartLinkItem,
} from "@/components/blocks/smart-link";
import { QUESTION_CARD_SINGLE_SELECT_DEMO } from "@/components/blocks/question-card/data/questions";
import { ASX_CHAT_AGENT_PROFILES } from "@/components/projects/jira-golden-journeys-v0/data/agent-chat-data";
import { AsxRovoOverlay } from "@/components/projects/jira-golden-journeys-v0/components/jira-golden-journeys-v0-rovo-overlay";
import { useAsxAgentChatDemo } from "@/components/projects/jira-golden-journeys-v0/hooks/use-jira-golden-journeys-v0-agent-chat-demo";
import { Button } from "@/components/ui/button";
import { getDeterministicAgentAvatarSrc } from "@/lib/agent-avatars";
import { token } from "@/lib/tokens";

const JIRA_ISSUE_DEMO_TAGS = [
	{ text: "Acmecorp", color: "discovery" },
	{ text: "qualification", color: "blue" },
	{ text: "enterprise", color: "discovery" },
] as const;

const JIRA_ISSUE_UNCAPTURED_WORK_PARTICIPANTS = [
	{
		id: "andrea-wilson",
		name: "Andrea Wilson",
		avatarSrc: "/avatar-user/andrea-wilson/color/asow-service-yellow.png",
		avatarShape: "circle",
	},
	{
		id: "andrew-park",
		name: "Andrew Park",
		avatarSrc: "/avatar-user/andrew-park/color/asow-dev-lime.png",
		avatarShape: "circle",
	},
	{
		id: "priya-hansra",
		name: "Priya Hansra",
		avatarSrc: "/avatar-user/priya-hansra/color/asow-service-yellow.png",
		avatarShape: "circle",
	},
] as const;

const JIRA_ISSUE_UNCAPTURED_GITHUB_VISUAL = { kind: "third-party", name: "github" } as const;
const JIRA_ISSUE_UNCAPTURED_GITHUB_AVATARS = JIRA_ISSUE_UNCAPTURED_WORK_PARTICIPANTS.map((participant) => ({
	name: participant.name,
	src: participant.avatarSrc,
}));

const JIRA_ISSUE_UNCAPTURED_WORK_EXAMPLES = [
	{
		id: "uncaptured-pr-1840",
		suggestedWorkItemKey: "PAY-101",
		summary: "Fourteen extra call sites, inventoried in an unlinked pull request",
		sourceLink: {
			...toPullRequestSmartLink({
				id: "uncaptured-pr-1840",
				number: 1840,
				title: "Fourteen extra call sites, inventoried in an unlinked pull request",
				status: "Open",
				files: 14,
				additions: 312,
				deletions: 0,
				repository: "acme/storefront",
				branch: "inventory/forgotten-harnesses",
				targetBranch: "main",
				description: "acme/storefront · PR #1840 · 14 files · no linked work item",
			}),
			title: "PR #1840",
			avatars: JIRA_ISSUE_UNCAPTURED_GITHUB_AVATARS,
		},
	},
	{
		id: "uncaptured-pr-1862",
		suggestedWorkItemKey: "PAY-113",
		summary: "Overnight contract suite merged without a work item to land on",
		sourceLink: {
			...toPullRequestSmartLink({
				id: "uncaptured-pr-1862",
				number: 1862,
				title: "Overnight contract suite merged without a work item to land on",
				status: "Merged",
				files: 18,
				additions: 1240,
				deletions: 86,
				repository: "acme/storefront",
				branch: "agent/night-shift-contract-suite",
				targetBranch: "main",
				description: "acme/storefront · PR #1862 · merged · no linked work item",
			}),
			title: "PR #1862",
			avatars: JIRA_ISSUE_UNCAPTURED_GITHUB_AVATARS,
		},
	},
	{
		id: "uncaptured-pr-1890",
		suggestedWorkItemKey: "PAY-102",
		summary: "Checks failed on the adapter-delete proof, still unlinked",
		sourceLink: {
			...toPullRequestSmartLink({
				id: "uncaptured-pr-1890",
				number: 1890,
				title: "Checks failed on the adapter-delete proof, still unlinked",
				status: "Failed",
				files: 41,
				additions: 0,
				deletions: 4180,
				repository: "acme/storefront",
				branch: "proof/delete-legacy-gateway-adapter",
				targetBranch: "main",
				description: "acme/storefront · PR #1890 · checks failed · no linked work item",
			}),
			title: "PR #1890",
			avatars: JIRA_ISSUE_UNCAPTURED_GITHUB_AVATARS,
		},
	},
	{
		id: "uncaptured-branch-spike",
		suggestedWorkItemKey: "PAY-102",
		summary: "Spike branch that proves the adapter can go, still unlinked",
		sourceLink: {
			id: "uncaptured-branch-spike",
			href: "https://github.com/acme/storefront/tree/spike/delete-legacy-adapter",
			title: "spike/delete-legacy-adapter",
			variant: "generic",
			provider: { name: "GitHub", logo: JIRA_ISSUE_UNCAPTURED_GITHUB_VISUAL },
			icon: GITHUB_BRANCH_SMART_LINK_ICON,
			description: "acme/storefront · unlinked spike branch",
			avatars: JIRA_ISSUE_UNCAPTURED_GITHUB_AVATARS,
		},
	},
	{
		id: "uncaptured-commit-b4c19e8",
		suggestedWorkItemKey: "PAY-101",
		summary: "The adapter-delete vote is recorded only as an unlinked commit",
		sourceLink: {
			id: "uncaptured-commit-b4c19e8",
			href: "https://github.com/acme/storefront/commit/b4c19e8",
			title: "b4c19e8",
			variant: "generic",
			provider: { name: "GitHub", logo: JIRA_ISSUE_UNCAPTURED_GITHUB_VISUAL },
			icon: GITHUB_COMMIT_SMART_LINK_ICON,
			description: "acme/storefront · b4c19e8 · never attached to a work item",
			avatars: JIRA_ISSUE_UNCAPTURED_GITHUB_AVATARS,
		},
	},
] as const satisfies readonly { id: string; suggestedWorkItemKey: string; summary: string; sourceLink: SmartLinkItem }[];

const JIRA_ISSUE_DEMO_SUBTASKS = [
	{
		summary: "Review Venn's test design pattern proposal",
		issueKey: "JDSN-230",
		status: "To Do",
		assigneeUnassignedKind: "person",
	},
] as const;

const SERVICE_IMPACT_AGENT_LABELS = [
	"Figuring out which services are affected",
	"Reading linked design notes",
	"Checking release ownership",
	"Mapping customer-facing impact",
	"Drafting the service impact summary",
] as const;

const DEPENDENCY_MAPPER_LABELS = [
	"Checking dependent components",
	"Following linked work items",
	"Comparing API usage",
	"Finding blocked handoffs",
	"Updating dependency notes",
] as const;

const JIRA_ISSUE_AGENT_ACTIVITIES = [
	{
		id: "service-impact-agent",
		name: "Service impact agent",
		avatarSrc: getDeterministicAgentAvatarSrc("service-impact-agent"),
		label: "Figuring out which services are affected",
		labels: SERVICE_IMPACT_AGENT_LABELS,
		cycleIntervalMs: 5200,
		cycleIntervalJitterMs: 1600,
		state: "working",
	},
	{
		id: "dependency-mapper",
		name: "Dependency mapper",
		avatarSrc: getDeterministicAgentAvatarSrc("dependency-mapper"),
		label: "Checking dependent components",
		labels: DEPENDENCY_MAPPER_LABELS,
		cycleIntervalMs: 6800,
		cycleIntervalJitterMs: 2200,
		state: "working",
	},
] as const satisfies readonly JiraIssueAgentActivity[];

const JIRA_ISSUE_AWAITING_INPUT_QUESTION = {
	...QUESTION_CARD_SINGLE_SELECT_DEMO[0],
	options: QUESTION_CARD_SINGLE_SELECT_DEMO[0].options.slice(0, 2),
};

const JIRA_ISSUE_AWAITING_INPUT_ACTIVITIES = [
	{
		...JIRA_ISSUE_AGENT_ACTIVITIES[0],
		label: "Needs input",
		question: JIRA_ISSUE_AWAITING_INPUT_QUESTION,
		state: "awaiting-input",
	},
	JIRA_ISSUE_AGENT_ACTIVITIES[1],
] as const satisfies readonly JiraIssueAgentActivity[];

const JIRA_ISSUE_COMPLETED_AGENT_RUNS = [
	{
		id: "PD-40:service-impact-agent",
		summary: "Map affected services and implementation impact",
		description: "Mapped affected services and added the implementation impact summary.",
		agentName: JIRA_ISSUE_AGENT_ACTIVITIES[0].name,
		agentAvatarSrc: JIRA_ISSUE_AGENT_ACTIVITIES[0].avatarSrc,
		issueKey: "PD-40",
		issueSummary: "Implement advanced date-range filter",
		completedSecondsAgo: 5 * 60,
		elapsedSeconds: 300,
		outputs: [
			{
				id: "service-impact-summary",
				title: "Service impact summary",
				source: "Jira work item",
				owner: "PD-40",
				iconName: "ai-chat",
			},
			{
				id: "implementation-notes",
				title: "Implementation notes",
				source: "Confluence page",
				owner: "Platform team",
				iconName: "globe",
			},
		],
		state: "done",
	},
	{
		id: "PD-40:dependency-mapper",
		summary: "Document dependent components and handoffs",
		description: "Documented dependent components, owners, and blocked handoffs.",
		agentName: JIRA_ISSUE_AGENT_ACTIVITIES[1].name,
		agentAvatarSrc: JIRA_ISSUE_AGENT_ACTIVITIES[1].avatarSrc,
		issueKey: "PD-40",
		issueSummary: "Implement advanced date-range filter",
		completedSecondsAgo: 68 * 60,
		elapsedSeconds: 64,
		state: "failed",
	},
] as const satisfies readonly JiraIssueCompletedAgentRun[];

type JiraIssueAgentActivityDemoState =
	| "default"
	| "single-agent-working"
	| "multiple-agents-working"
	| "single-agent-working-viewer"
	| "multiple-agents-working-viewer"
	| "agent-session-expired"
	| "awaiting-user-input"
	| "agent-completed-work"
	| "agent-dismissed-work"
	| "agent-session-unlink"
	| "agent-session-running-unlink"
	| "agent-session-link";

const JIRA_ISSUE_AGENT_ACTIVITY_DEMO_STATES = [
	{ value: "default", label: "Default" },
	{ value: "single-agent-working", label: "1 agent" },
	{ value: "multiple-agents-working", label: "1-n agents" },
	{ value: "awaiting-user-input", label: "Needs input" },
	{ value: "agent-completed-work", label: "Review" },
	{ value: "agent-dismissed-work", label: "Done" },
] as const satisfies readonly { value: JiraIssueAgentActivityDemoState; label: string }[];

/** Only concatenated onto the tab list for the experimental (stroke) demo. */
const JIRA_ISSUE_AGENT_SESSION_TRANSFER_DEMO_STATES = [
	{ value: "agent-session-unlink", label: "Unlink" },
	{ value: "agent-session-running-unlink", label: "1 running + 2 unlink" },
	{ value: "agent-session-link", label: "Link" },
] as const satisfies readonly { value: JiraIssueAgentActivityDemoState; label: string }[];

const JIRA_ISSUE_AGENT_ACTIVITY_V2_DEMO_STATES = [
	...JIRA_ISSUE_AGENT_ACTIVITY_DEMO_STATES.slice(0, 3).map((state) => ({
		...state,
		label: state.value === "default" ? state.label : `${state.label} as owner`,
	})),
	{ value: "single-agent-working-viewer", label: "1 agent, not owner" },
	{ value: "multiple-agents-working-viewer", label: "1-n agents, not owner" },
	...JIRA_ISSUE_AGENT_ACTIVITY_DEMO_STATES.slice(3),
	{ value: "agent-session-expired", label: "Expired" },
] as const satisfies readonly { value: JiraIssueAgentActivityDemoState; label: string }[];

function isSessionTransferDemoState(state: JiraIssueAgentActivityDemoState): boolean {
	return state === "agent-session-unlink"
		|| state === "agent-session-running-unlink"
		|| state === "agent-session-link";
}

const UNLINKED_SESSION_INVOKER = {
	avatarSrc: "/avatar-user/andrew-park/color/asow-dev-lime.png",
	name: "person A",
} as const;

/** Claude + Cursor sample rows used by Unlink / 1 running + 2 unlink. */
const DETACHABLE_DEMO_SESSION_IDS = new Set(
	AGENT_SESSION_ITEMS.slice(0, 2).map((item) => item.id),
);

/** Chin activity → medium-detached card after a drop or minus unlink. */
function toUnlinkedAgentSession(activity: JiraIssueAgentActivity): AgentSessionItem {
	return {
		id: activity.id,
		title: activity.name,
		state: "complete",
		agent: {
			avatarSrc: activity.avatarSrc,
			brandName: activity.agentBrandName,
			id: activity.id,
			kind: "agent",
			name: activity.name,
		},
		host: "local",
		// A session that arrived from a card already knows its human; only a
		// demo row with no attribution falls back to the sample invoker.
		invokedBy: activity.invokedBy ?? UNLINKED_SESSION_INVOKER,
		machineName: "Local",
		timeLabel: "Just now",
	};
}

function getDemoAgentActivities(
	state: JiraIssueAgentActivityDemoState,
): readonly JiraIssueAgentActivity[] | undefined {
	switch (state) {
		case "agent-session-expired":
			return [
				{
					...JIRA_ISSUE_AWAITING_INPUT_ACTIVITIES[0],
					name: "Claude",
					avatarSrc: undefined,
					agentBrandName: "claude",
					host: "cloud",
					role: "owner",
					timeLabel: "2m",
					invokedBy: { name: "Venn", avatarSrc: "/avatar-user/venn/venn.png" },
				},
				{
					...JIRA_ISSUE_AGENT_ACTIVITIES[1],
					name: "Claude",
					avatarSrc: undefined,
					agentBrandName: "claude",
					host: "local",
					role: "owner",
					timeLabel: "2m",
					invokedBy: { name: "Venn", avatarSrc: "/avatar-user/venn/venn.png" },
				},
				{
					id: "cursor-viewer-session",
					name: "Cursor",
					agentBrandName: "cursor",
					label: "Working",
					state: "working",
					host: "local",
					role: "viewer",
					timeLabel: "2m",
					invokedBy: JIRA_ISSUE_UNCAPTURED_WORK_PARTICIPANTS[1],
				},
				{
					id: "claude-expired-session",
					name: "Claude",
					agentBrandName: "claude",
					label: "Expired",
					state: "completed",
					host: "cloud",
					role: "expired",
					timeLabel: "29d",
					invokedBy: { name: "Venn", avatarSrc: "/avatar-user/venn/venn.png" },
				},
			];
		case "single-agent-working-viewer":
		case "single-agent-working":
		case "agent-session-link":
		case "agent-session-running-unlink":
			return JIRA_ISSUE_AGENT_ACTIVITIES.slice(0, 1);
		case "multiple-agents-working-viewer":
		case "multiple-agents-working":
			return JIRA_ISSUE_AGENT_ACTIVITIES.slice(0, 2);
		case "awaiting-user-input":
			return JIRA_ISSUE_AWAITING_INPUT_ACTIVITIES;
		default:
			return undefined;
	}
}

function getDemoAgentActivityMode(
	state: JiraIssueAgentActivityDemoState,
	activities: readonly JiraIssueAgentActivity[] | undefined,
): JiraIssueAgentActivityMode {
	if (state === "agent-completed-work") {
		return "completed";
	}

	// Unlink keeps the grey agent-activity backdrop around the issue without
	// mounting a chin row. `working` is what lights `hasActiveAgentActivityShell`.
	if (state === "agent-session-unlink") {
		return "working";
	}

	if (!activities?.length) {
		return "none";
	}

	return state === "awaiting-user-input" || state === "agent-session-expired" ? "awaiting-input" : "working";
}

function getExperimentalDemoPullRequest(
	agentActivityState: JiraIssueAgentActivityDemoState,
): { pullRequestNumber?: number; pullRequestStatus?: JiraIssuePullRequestStatus } {
	switch (agentActivityState) {
		case "awaiting-user-input":
			return { pullRequestNumber: 812, pullRequestStatus: "open" };
		case "agent-completed-work":
			return { pullRequestNumber: 812, pullRequestStatus: "failed" };
		case "agent-dismissed-work":
			return { pullRequestNumber: 812, pullRequestStatus: "merged" };
		case "default":
		case "single-agent-working":
		case "multiple-agents-working":
		case "single-agent-working-viewer":
		case "multiple-agents-working-viewer":
		case "agent-session-expired":
		case "agent-session-unlink":
		case "agent-session-running-unlink":
		case "agent-session-link":
			return {};
		default: {
			const exhaustive: never = agentActivityState;
			throw new Error(`Unhandled agent activity demo state: ${String(exhaustive)}`);
		}
	}
}

interface JiraIssuePageProps {
	variant?: "default" | "experimental" | "uncaptured-work" | "subtasks-collapsed" | "subtasks-expanded" | "parent-epic" | "agent-activity-states" | "agent-activity-states-experimental" | "agent-activity-states-experimental-v2";
}

function JiraIssueUncapturedWorkDemo() {
	const [capturedIds, setCapturedIds] = useState<ReadonlySet<string>>(() => new Set());

	return (
		<div
			className="flex h-full min-h-[360px] w-full flex-col items-center justify-center gap-2 bg-surface p-6"
			id="uncaptured-work"
		>
			{JIRA_ISSUE_UNCAPTURED_WORK_EXAMPLES.map((example) => (
				<JiraIssue
					captured={capturedIds.has(example.id)}
					className="w-[320px]"
					key={example.id}
					onCreateWorkItem={() => {
						setCapturedIds((current) => new Set(current).add(example.id));
					}}
					onLinkWorkItem={() => {
						setCapturedIds((current) => new Set(current).add(example.id));
					}}
					participants={JIRA_ISSUE_UNCAPTURED_WORK_PARTICIPANTS}
					sourceLink={example.sourceLink}
					suggestedWorkItemKey={example.suggestedWorkItemKey}
					summary={example.summary}
					variant="uncaptured-work"
				/>
			))}
		</div>
	);
}

export default function JiraIssuePage({ variant = "default" }: Readonly<JiraIssuePageProps> = {}): React.ReactElement {
	const [selectedEpicId, setSelectedEpicId] = useState("agentic-jira");
	const isExperimentalVariant = variant === "experimental";
	const isUncapturedWorkVariant = variant === "uncaptured-work";
	const isSubtasksVariant = variant === "subtasks-collapsed" || variant === "subtasks-expanded";
	const isParentEpicVariant = variant === "parent-epic";
	const hasCompactIssueContext = isSubtasksVariant || isParentEpicVariant;
	const issueKey = isParentEpicVariant ? "JDSN-157" : isSubtasksVariant ? "JDSN-229" : "RFP-101";
	const summary = isParentEpicVariant
		? "Next best action"
		: isSubtasksVariant
			? "Venn's test"
			: "Acmecorp: Prepare for bid recommendation for ESM RFP";

	if (variant === "agent-activity-states-experimental-v2") {
		return <JiraIssueExperimentalAgentActivityStatesPage iconScale="comfortable" />;
	}

	if (variant === "agent-activity-states-experimental") {
		return <JiraIssueExperimentalAgentActivityStatesPage />;
	}

	if (variant === "agent-activity-states") {
		return (
			<RovoChatProvider agentProfiles={ASX_CHAT_AGENT_PROFILES}>
				<JiraIssueAgentActivityStatesDemo
					agentActivityLayout="merged"
					chrome="raised"
				/>
			</RovoChatProvider>
		);
	}

	if (isUncapturedWorkVariant) {
		return <JiraIssueUncapturedWorkDemo />;
	}

	return (
		<div className="flex h-full min-h-[360px] w-full items-center justify-center bg-surface p-6">
			<JiraIssue
				assigneeAvatarSrc="/avatar-user/andrea-wilson/color/asow-service-yellow.png"
				assigneeUnassignedKind={hasCompactIssueContext ? "person" : undefined}
				chrome={isExperimentalVariant ? "stroke" : undefined}
				className="w-[320px]"
				defaultSubtasksExpanded={variant === "subtasks-expanded"}
				issueKey={issueKey}
				parentEpicControl={
					isParentEpicVariant ? (
						<JiraEpic
							epics={JIRA_EPIC_DEMO_EPICS}
							onAddParent={() => undefined}
							onEpicSelect={setSelectedEpicId}
							onRemoveParent={() => undefined}
							onViewParent={() => undefined}
							selectedEpicId={selectedEpicId}
							showLabel={false}
						/>
					) : undefined
				}
				priority="major"
				showAutomationIndicator={isSubtasksVariant}
				showPriorityIndicator={!isParentEpicVariant}
				subtasks={hasCompactIssueContext ? JIRA_ISSUE_DEMO_SUBTASKS : undefined}
				subtasksCompleted={0}
				summary={summary}
				tags={hasCompactIssueContext ? undefined : JIRA_ISSUE_DEMO_TAGS}
			/>
		</div>
	);
}

const JIRA_ISSUE_CHAT_ISSUE_KEY = "PD-40";
const JIRA_ISSUE_CHAT_ISSUE_SUMMARY = "Implement advanced date-range filter";

const EXPERIMENTAL_DEMO_PULL_REQUEST_PREVIEW: JiraIssuePullRequestPreview = {
	additions: 86,
	author: {
		avatarUrl: "/avatar-user/andrea-wilson/color/asow-service-yellow.png",
		name: "Andrea Wilson",
	},
	branch: "feat/pd-40-date-range-filter",
	deletions: 21,
	filesChanged: 6,
	relativeTime: "1h",
	repository: "acme/storefront",
	targetBranch: "main",
	title: "Add date-range filter query params",
};

interface JiraIssueAgentActivityStatesDemoProps {
	agentActivityLayout?: JiraIssueAgentActivityLayout;
	chrome?: JiraIssueChrome;
	/** Keeps experimental compact internals when chrome toggles to raised. */
	compact?: boolean;
	iconScale?: JiraIssueIconScale;
	onChromeChange?: (chrome: JiraIssueChrome) => void;
	subtaskChrome?: JiraIssueChrome;
	/** Adds the Unlink / Move / Link session-transfer phases to the tab list. */
	showSessionTransferStates?: boolean;
}

function JiraIssueExperimentalAgentActivityStatesPage({
	iconScale,
}: Readonly<{
	iconScale?: JiraIssueIconScale;
}> = {}): React.ReactElement {
	const [chrome, setChrome] = useState<JiraIssueChrome>("stroke");

	return (
		<RovoChatProvider agentProfiles={ASX_CHAT_AGENT_PROFILES}>
			<JiraIssueAgentActivityStatesDemo
				agentActivityLayout="merged"
				chrome={chrome}
				compact
				iconScale={iconScale}
				onChromeChange={setChrome}
				showSessionTransferStates={iconScale !== "comfortable"}
				subtaskChrome="stroke"
			/>
		</RovoChatProvider>
	);
}

function JiraIssueAgentActivityStatesDemo({
	agentActivityLayout = "merged",
	chrome = "raised",
	compact = false,
	iconScale,
	onChromeChange,
	showSessionTransferStates = false,
	subtaskChrome,
}: Readonly<JiraIssueAgentActivityStatesDemoProps> = {}): React.ReactElement {
	const [agentActivityState, setAgentActivityState] = useState<JiraIssueAgentActivityDemoState>("default");
	// View chat / question submit / generative actions all drop into the shared
	// Rovo floating chat with the activity's agent already selected — matching the
	// ASX Kanban "View chat" behavior instead of a blank vanilla Rovo chat.
	const { chatContextBar, externalThinkingMessageId, openAgentChat } = useAsxAgentChatDemo();
	const [pendingChatQuestion, setPendingChatQuestion] = useState<Readonly<{ submit: () => void }> | null>(null);
	const experimentalPullRequest = compact
		? getExperimentalDemoPullRequest(agentActivityState)
		: {};
	const [unlinkedSessionIds, setUnlinkedSessionIds] = useState<readonly string[]>([]);
	const [linkedDetachedIds, setLinkedDetachedIds] = useState<readonly string[]>([]);
	const [assignedDemoActivities, setAssignedDemoActivities] = useState<readonly JiraIssueAgentActivity[] | null>(null);
	const isTransferPhase = showSessionTransferStates && isSessionTransferDemoState(agentActivityState);
	const isUnlinkPhase = isTransferPhase && agentActivityState === "agent-session-unlink";
	const isRunningUnlinkPhase = isTransferPhase && agentActivityState === "agent-session-running-unlink";
	const demoSessionRole = iconScale === "comfortable"
		? agentActivityState === "single-agent-working-viewer" || agentActivityState === "multiple-agents-working-viewer"
			? "viewer"
			: "owner"
		: undefined;
	const fixtureActivities = assignedDemoActivities ?? getDemoAgentActivities(agentActivityState)?.map<JiraIssueAgentActivity>((activity, index) => (
		demoSessionRole && agentActivityState !== "agent-session-expired" ? {
			...activity,
			name: index === 0 ? "Claude" : "Cursor",
			avatarSrc: undefined,
			agentBrandName: index === 0 ? "claude" : "cursor",
			role: demoSessionRole,
			host: index === 0 ? "cloud" : "local",
			timeLabel: "12m",
			invokedBy: demoSessionRole === "owner"
				? { name: "Venn", avatarSrc: "/avatar-user/venn/venn.png" }
				: JIRA_ISSUE_UNCAPTURED_WORK_PARTICIPANTS[index % JIRA_ISSUE_UNCAPTURED_WORK_PARTICIPANTS.length],
		} : activity
	));
	const remainingFixtureActivities = fixtureActivities?.filter((activity) => !unlinkedSessionIds.includes(activity.id));
	const unlinkedSessions = (fixtureActivities ?? [])
		.filter((activity) => unlinkedSessionIds.includes(activity.id))
		.map(toUnlinkedAgentSession);
	// Same sample sessions as `#medium-detached` so the person avatar is present.
	const fixtureDetachedSessions = isRunningUnlinkPhase
		? AGENT_SESSION_ITEMS.slice(0, 2)
		: isUnlinkPhase
			? AGENT_SESSION_ITEMS.slice(0, 1)
			: [];
	const { linked: linkedDetachedSessions, remaining: remainingFixtureDetached } = splitJiraIssueDemoSessionsById(
		fixtureDetachedSessions,
		linkedDetachedIds,
	);
	const linkedDetachedActivities = linkedDetachedSessions.map(toJiraIssueDemoAttachedActivity);
	const agentActivities = remainingFixtureActivities === undefined && linkedDetachedActivities.length === 0
		? undefined
		: [...(remainingFixtureActivities ?? []), ...linkedDetachedActivities];
	const detachedSessions = [...unlinkedSessions, ...remainingFixtureDetached];
	const demoStates = showSessionTransferStates
		? [...JIRA_ISSUE_AGENT_ACTIVITY_DEMO_STATES, ...JIRA_ISSUE_AGENT_SESSION_TRANSFER_DEMO_STATES]
		: iconScale === "comfortable"
			? JIRA_ISSUE_AGENT_ACTIVITY_V2_DEMO_STATES
			: JIRA_ISSUE_AGENT_ACTIVITY_DEMO_STATES;
	const hasChinToUnlink = Boolean(agentActivities?.length);
	const showDetachedSessions = detachedSessions.length > 0;
	// Tabs pick the fixture. A drop or chin-minus unlink keeps that fixture and
	// moves the session into the detached list — hopping Unlink/Link remounted
	// the card (`key={agentActivityState}`) and tore the playground down.
	const handleSessionUnlink = useCallback((session?: { id: string }) => {
		if (!session?.id) {
			return;
		}
		setUnlinkedSessionIds((current) => (
			current.includes(session.id) ? current : [...current, session.id]
		));
		setLinkedDetachedIds((current) => nextJiraIssueDemoLinkedIds(current, session.id, false));
	}, []);
	const handleSessionLink = useCallback((session?: { id: string }) => {
		if (!session?.id) {
			return;
		}
		setUnlinkedSessionIds((current) => current.filter((id) => id !== session.id));
		if (DETACHABLE_DEMO_SESSION_IDS.has(session.id)) {
			setLinkedDetachedIds((current) => nextJiraIssueDemoLinkedIds(current, session.id, true));
		}
	}, []);
	const agentSessionTransfer: JiraIssueAgentSessionTransferConfig | undefined = useMemo(() => {
		if (!showSessionTransferStates || (!hasChinToUnlink && !showDetachedSessions)) {
			return undefined;
		}
		return {
			onLink: handleSessionLink,
			onUnlink: hasChinToUnlink ? handleSessionUnlink : undefined,
		};
	}, [
		handleSessionLink,
		handleSessionUnlink,
		hasChinToUnlink,
		showDetachedSessions,
		showSessionTransferStates,
	]);
	// Opens the floating chat for the activity's agent. When the activity is
	// awaiting input, the chat replays its question card; answering it there is
	// intercepted (via `pendingChatQuestion`) so the agent acknowledges and
	// continues, mirroring the ASX Kanban "View chat" flow.
	const openActivityChat = useCallback((activity: JiraIssueAgentActivity) => {
		setPendingChatQuestion(activity.question ? { submit: () => undefined } : null);
		openAgentChat({
			agentId: activity.id,
			agentName: activity.name,
			issueKey: JIRA_ISSUE_CHAT_ISSUE_KEY,
			issueSummary: JIRA_ISSUE_CHAT_ISSUE_SUMMARY,
			intro: activity.message,
			question: activity.question,
		});
	}, [openAgentChat]);
	const handleAgentActivityViewChat = openActivityChat;
	const handleAgentDoneRunView = useCallback((run: JiraIssueCompletedAgentRun) => {
		setPendingChatQuestion(null);
		const agentId = run.id.includes(":") ? run.id.slice(run.id.indexOf(":") + 1) : run.id;
		openAgentChat({
			agentId,
			agentName: run.agentName,
			issueKey: run.issueKey,
			issueSummary: run.issueSummary,
			intro: run.description ?? run.summary,
		});
	}, [openAgentChat]);
	const handleAgentDoneRunSubmit = useCallback((run: JiraIssueCompletedAgentRun, prompt: string) => {
		setPendingChatQuestion(null);
		const agentId = run.id.includes(":") ? run.id.slice(run.id.indexOf(":") + 1) : run.id;
		openAgentChat({
			agentId,
			agentName: run.agentName,
			issueKey: run.issueKey,
			issueSummary: run.issueSummary,
			request: prompt,
		});
	}, [openAgentChat]);
	const handleGenerativeActionSubmit = useCallback((request: JiraIssueGenerativeActionRequest) => {
		setPendingChatQuestion(null);
		openAgentChat({
			agentId: JIRA_ISSUE_AGENT_ACTIVITIES[0].id,
			agentName: JIRA_ISSUE_AGENT_ACTIVITIES[0].name,
			issueKey: JIRA_ISSUE_CHAT_ISSUE_KEY,
			issueSummary: JIRA_ISSUE_CHAT_ISSUE_SUMMARY,
			request: request.prompt,
		});
	}, [openAgentChat]);
	const handleChatQuestionAnswer = useCallback(() => {
		setPendingChatQuestion(null);
	}, []);

	return (
		<div className="relative flex h-full min-h-[480px] w-full flex-col bg-surface">
			<div className="sticky top-0 z-10 w-full bg-surface pb-4 pt-6">
				<div className="flex w-full flex-wrap items-center justify-center gap-2">
					{demoStates.map((state) => (
						<Button
							key={state.value}
							aria-pressed={agentActivityState === state.value}
							onClick={() => {
								setUnlinkedSessionIds([]);
								setLinkedDetachedIds([]);
								setAssignedDemoActivities(null);
								setAgentActivityState(state.value);
							}}
							size="compact"
							variant={agentActivityState === state.value ? "default" : "outline"}
						>
							{state.label}
						</Button>
					))}
				</div>
				{onChromeChange ? (
					<div className="mt-2 flex w-full flex-wrap items-center justify-center gap-2">
						<Button
							aria-pressed={chrome === "raised"}
							onClick={() => onChromeChange("raised")}
							size="compact"
							variant={chrome === "raised" ? "default" : "outline"}
						>
							Raised
						</Button>
						<Button
							aria-pressed={chrome === "stroke"}
							onClick={() => onChromeChange("stroke")}
							size="compact"
							variant={chrome === "stroke" ? "default" : "outline"}
						>
							Stroke
						</Button>
					</div>
				) : null}
			</div>
			<div className="flex flex-1 items-start justify-center overflow-visible px-6 pb-10 pt-6">
				<div className="flex w-[276px] flex-col gap-2">
					<JiraIssue
						key={isTransferPhase ? agentActivityState : "base"}
						agentActivities={agentActivities}
						assignment={demoSessionRole ? {
							assignedAgents: agentActivityState === "agent-session-expired" ? agentActivities?.map(toAgentAssignmentAgent) : undefined,
							addAgentLabel: demoSessionRole === "viewer" || agentActivityState === "agent-session-expired" ? "New session" : "Add agent",
							onDeleteAssignedAgent: (agent) => {
								setAssignedDemoActivities((current) => (current ?? agentActivities ?? []).filter((activity) => activity.id !== agent.id));
							},
							onAgentAssign: (agent) => {
								const activity = toJiraIssueDemoAttachedActivity({
									id: agent.id,
									title: "Working",
									state: "running",
									agent,
									host: "cloud",
									role: "owner",
									invokedBy: { name: "Venn", avatarSrc: "/avatar-user/venn/venn.png" },
								});
								setAssignedDemoActivities((current) => [...(current ?? agentActivities ?? []), activity]);
							},
							onAssignedAgentIdsChange: (ids) => {
								setAssignedDemoActivities((current) => (current ?? agentActivities ?? []).filter((activity) => ids.includes(activity.id)));
							},
						} : undefined}
						agentActivityLayout={agentActivityLayout}
						agentActivityMode={getDemoAgentActivityMode(agentActivityState, agentActivities)}
						agentDoneRuns={agentActivityState === "agent-completed-work" ? JIRA_ISSUE_COMPLETED_AGENT_RUNS : undefined}
						agentSessionTransfer={agentSessionTransfer}
						assigneeAvatarSrc="/avatar-user/andrea-wilson/color/asow-service-yellow.png"
						chrome={chrome}
						className="w-full"
						compact={compact}
						iconScale={iconScale}
						subtaskChrome={subtaskChrome}
						generativeAction={{
							onSubmit: handleGenerativeActionSubmit,
						}}
						generativeActionPresentation={iconScale === "comfortable" ? "more-actions" : undefined}
						issueKey="PD-40"
						onAgentActivityViewChat={handleAgentActivityViewChat}
						onAgentDoneRunSubmit={handleAgentDoneRunSubmit}
						onAgentDoneRunView={handleAgentDoneRunView}
						priority="major"
						pullRequestNumber={experimentalPullRequest.pullRequestNumber}
						pullRequestPreview={experimentalPullRequest.pullRequestNumber ? EXPERIMENTAL_DEMO_PULL_REQUEST_PREVIEW : undefined}
						pullRequestStatus={experimentalPullRequest.pullRequestStatus}
						pullRequestTitle={experimentalPullRequest.pullRequestNumber ? JIRA_ISSUE_CHAT_ISSUE_SUMMARY : undefined}
						sessionTransferAfter={showDetachedSessions
							? (sessionDrag) => (
								<AgentSession
									issueKey="PD-40"
									items={detachedSessions}
									onCreateWorkItem={(item) => handleSessionLink(item)}
									onLinkWorkItem={(item) => handleSessionLink(item)}
									onSubtasks={(item) => handleSessionLink(item)}
									sessionDrag={sessionDrag}
									style={{ marginTop: token("space.025") }}
									variant="medium-detached"
								/>
							)
							: undefined}
						subtasks={JIRA_ISSUE_DEMO_SUBTASKS}
						subtasksCompleted={0}
						summary="Implement advanced date-range filter"
						tags={[{ text: "FE Development", color: "purple" }]}
					/>
				</div>
			</div>
			<AsxRovoOverlay
				chatContextBar={chatContextBar}
				externalThinkingMessageId={externalThinkingMessageId}
				onQuestionAnswer={pendingChatQuestion ? handleChatQuestionAnswer : undefined}
			/>
		</div>
	);
}

export { JiraIssue } from "@/components/blocks/jira-issue";
export type {
	JiraIssueAgentActivity,
	JiraIssueAgentActivityLayout,
	JiraIssueAgentActivityMode,
	JiraIssueAgentActivityState,
	JiraIssueParticipant,
	JiraIssuePriority,
	JiraIssueProps,
	JiraIssueSubtask,
	JiraIssueTag,
	JiraIssueUncapturedWorkProps,
	JiraIssueVariant,
} from "@/components/blocks/jira-issue";
