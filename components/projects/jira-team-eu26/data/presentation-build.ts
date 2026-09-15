import type { WorkItemData } from "@/app/contexts/context-work-item-modal";
import type {
	AgentSession,
	JiraWorkItemState,
	StaticTimelineEvent,
} from "@/components/blocks/jira-work-item/data/session-state";
import { hydratePreset } from "@/components/blocks/jira-work-item/data/session-state";
import { SESSION_EPOCH_MS } from "@/components/blocks/jira-work-item/data/session-fixtures";
import type { ArtifactListItem } from "@/components/ui-custom/artifact-list";

import { PAY_STORY_PEOPLE } from "./presentation-people";

export const JIRA_TEAM_EU26_PAY_101_SESSION_ID = "pay-101-inventory-claude-session";
export const JIRA_TEAM_EU26_PAY_101_UNCAPTURED_SESSION_ID = "lw-scope-thread";
export const JIRA_TEAM_EU26_PAY_101_PULL_REQUEST_NUMBER = 1839;
export const JIRA_TEAM_EU26_PAY_101_COMMIT_SHA = "8c2f4e1";

const PAY_STORY_EPOCH_MS = Date.UTC(2026, 7, 17, 8, 12, 0);
const PAY_REPOSITORY = "payments-platform/payments";

export const PAY_101_INVENTORY_PR_ARTIFACT: ArtifactListItem = {
	id: "pay-101-inventory-pr-1839",
	title: "Map v1 call sites",
	source: "Pull request",
	owner: "Maya Ferreira",
	logoName: "github",
	href: `https://github.com/${PAY_REPOSITORY}/pull/1839`,
	pullRequest: {
		number: JIRA_TEAM_EU26_PAY_101_PULL_REQUEST_NUMBER,
		status: "Merged",
		additions: 312,
		deletions: 8,
	},
};

export const PAY_101_INVENTORY_COMMIT_ARTIFACT: ArtifactListItem = {
	id: "pay-101-inventory-commit-8c2f4e1",
	title: "8c2f4e1 map 61 v1 call sites and owners",
	source: "Commit · payments-platform/payments",
	owner: "Maya Ferreira",
	logoName: "github",
	href: `https://github.com/${PAY_REPOSITORY}/commit/${JIRA_TEAM_EU26_PAY_101_COMMIT_SHA}`,
};

const PAY_101_DESCRIPTION = [
	"#### Outcome",
	"Build a verified inventory of every LegacyGatewayAdapter call site before the Payments SDK v2 migration begins.",
	"",
	"#### Captured agent evidence",
	"The inventory coding-agent run is attached to this work item with its transcript, commit, and merged pull request.",
	"",
	"#### Still uncaptured",
	"The keep-or-delete rationale remains in a separate local Claude session surfaced by Insights. Resume that session in Terminal before its worktree is removed.",
	"",
	"#### Evidence",
	"- 61 call sites found across checkout-web, payments-api, ledger-sync, and merchant-admin.",
	"- Every call site has a human owner and a target migration lane.",
	"- PR #1839 merged the inventory; commit 8c2f4e1 is the durable source for the counts in Insights.",
	"- PAY-102 must still prove the adapter can be deleted before the first port lands.",
].join("\n");

export const JIRA_TEAM_EU26_PAY_101_WORK_ITEM: WorkItemData = {
	code: "PAY-101",
	title: "Inventory every v1 call site across services and name an owner for each",
	description: PAY_101_DESCRIPTION,
	status: "Done",
	priority: "High",
	createdAtMs: PAY_STORY_EPOCH_MS - 7_200_000,
	assignee: {
		name: PAY_STORY_PEOPLE.jordan.name,
		avatarUrl: PAY_STORY_PEOPLE.jordan.avatarSrc,
	},
	reporter: {
		name: PAY_STORY_PEOPLE.priya.name,
		avatarUrl: PAY_STORY_PEOPLE.priya.avatarSrc,
	},
	parent: {
		code: "PAY-100",
		title: "Payments SDK v2 migration",
	},
	labels: ["payments-sdk-v2", "discovery", "migration"],
	startDate: "Aug 17, 2026",
	dueDate: "Aug 17, 2026",
};

const PAY_CLAUDE_ACTOR: StaticTimelineEvent["actor"] = {
	id: "pay-claude-code",
	name: "Claude",
	kind: "agent",
	brandName: "claude",
};

const PAY_GITHUB_ACTOR: StaticTimelineEvent["actor"] = {
	id: "pay-github",
	name: "GitHub",
	kind: "app",
	brandName: "github",
};

const PAY_MAYA_ACTOR: StaticTimelineEvent["actor"] = {
	id: "pay-maya-ferreira",
	name: PAY_STORY_PEOPLE.maya.name,
	kind: "person",
	avatarSrc: PAY_STORY_PEOPLE.maya.avatarSrc,
};

const PAY_PRIYA_ACTOR: StaticTimelineEvent["actor"] = {
	id: "pay-priya-raman",
	name: PAY_STORY_PEOPLE.priya.name,
	kind: "person",
	avatarSrc: PAY_STORY_PEOPLE.priya.avatarSrc,
};

function cloneArtifact(artifact: ArtifactListItem): ArtifactListItem {
	return {
		...artifact,
		pullRequest: artifact.pullRequest ? { ...artifact.pullRequest } : undefined,
	};
}

function createPay101ClaudeSession(): AgentSession {
	const startedAtMs = PAY_STORY_EPOCH_MS - 2_880_000;
	const steps = [
		"Trace LegacyGatewayAdapter usage across four services",
		"Match each call site to a human owner and migration lane",
		"Publish the 61-call-site count and ownership evidence to Jira",
		"Merge the durable inventory in PR #1839",
	] as const;
	const outputs = [
		cloneArtifact(PAY_101_INVENTORY_PR_ARTIFACT),
		cloneArtifact(PAY_101_INVENTORY_COMMIT_ARTIFACT),
	];

	return {
		id: JIRA_TEAM_EU26_PAY_101_SESSION_ID,
		agentId: "claude-code",
		agentName: "Claude",
		agentBrandName: "claude",
		title: "Inventory v1 adapter call sites and owners",
		status: "completed",
		activityVisibility: "public",
		command: "Trace every v1 adapter call site, name an owner and migration lane, and publish the verified inventory to PAY-101.",
		previewText: "Mapped 61 call sites across four services, named each owner and migration lane, and linked commit 8c2f4e1 with merged PR #1839.",
		steps: steps.map((label, index) => ({
			id: `pay-101-claude-step-${index + 1}`,
			label,
			status: "complete" as const,
		})),
		progress: 1,
		messages: [
			{
				id: "pay-101-claude-prompt",
				role: "human",
				authorName: "Maya Ferreira",
				authorAvatarSrc: PAY_STORY_PEOPLE.maya.avatarSrc,
				content: "Trace every v1 adapter call site, name an owner and migration lane, and publish the verified inventory to PAY-101.",
				createdAtMs: startedAtMs,
			},
			{
				id: "pay-101-claude-inventory",
				role: "agent",
				authorName: "Claude",
				content: "I found 61 call sites across checkout-web, payments-api, ledger-sync, and merchant-admin. Every call site now has an owner and migration lane in commit 8c2f4e1.",
				createdAtMs: startedAtMs + 720_000,
			},
			{
				id: "pay-101-claude-evidence",
				role: "agent",
				authorName: "Claude",
				content: "Published the inventory evidence to PAY-101. Commit 8c2f4e1 records all 61 call sites and owners, and PR #1839 is merged and linked. The separate keep-or-delete rationale session remains uncaptured.",
				createdAtMs: startedAtMs + 1_440_000,
			},
		],
		startedAtMs,
		scriptId: "pay-101-local-inventory-capture",
		scriptCursor: steps.length,
		stepElapsedMs: 0,
		resumedFromWait: true,
		order: 1,
		progressChecklist: steps.map((label, index) => ({
			id: `pay-101-claude-progress-${index + 1}`,
			label,
			completed: true,
		})),
		outputs,
	};
}

function createPay101StaticEvents(): StaticTimelineEvent[] {
	return [
		{
			id: "pay-101-reported",
			kind: "event",
			actor: PAY_PRIYA_ACTOR,
			icon: "created",
			segments: [{ type: "text", text: "created the migration inventory task" }],
			createdAtMs: PAY_STORY_EPOCH_MS - 7_200_000,
		},
		{
			id: "pay-101-inventory-session-captured",
			kind: "event",
			actor: PAY_CLAUDE_ACTOR,
			icon: "delegated",
			showActor: false,
			segments: [
				{ type: "agent-mention", text: "Claude", brandName: "claude" },
				{ type: "text", text: " Published the completed inventory agent run to PAY-101" },
			],
			createdAtMs: PAY_STORY_EPOCH_MS - 2_820_000,
		},
		{
			id: "pay-101-inventory-commit",
			kind: "changed-files",
			actor: PAY_CLAUDE_ACTOR,
			summary: "Mapped 61 v1 call sites and owners",
			description: "Commit 8c2f4e1 records every LegacyGatewayAdapter call site across checkout-web, payments-api, ledger-sync, and merchant-admin, plus the person and lane responsible for each port.",
			branch: "pay-101/inventory-v1-call-sites",
			tag: { text: "61 call sites", color: "blue" },
			sessionItem: {
				id: JIRA_TEAM_EU26_PAY_101_SESSION_ID,
				title: "Inventory v1 adapter call sites and owners",
				state: "complete",
				agent: {
					id: "claude-code",
					name: "Claude",
					brandName: "claude",
				},
				branch: "pay-101/inventory-v1-call-sites",
				completedAtMs: PAY_STORY_EPOCH_MS - 1_260_000,
				elapsedSeconds: 1_560,
				host: "local",
				machineName: "Maya's MacBook",
				prStatus: "merged",
			},
			outputs: [cloneArtifact(PAY_101_INVENTORY_COMMIT_ARTIFACT)],
			createdAtMs: PAY_STORY_EPOCH_MS - 1_260_000,
		},
		{
			id: "pay-101-inventory-pr-merged",
			kind: "event",
			actor: PAY_GITHUB_ACTOR,
			icon: "pull-request",
			segments: [],
			pullRequest: {
				number: JIRA_TEAM_EU26_PAY_101_PULL_REQUEST_NUMBER,
				title: PAY_101_INVENTORY_PR_ARTIFACT.title,
				status: "Merged",
				additions: 312,
				deletions: 8,
				repository: PAY_REPOSITORY,
				branch: "pay-101/inventory-v1-call-sites",
				targetBranch: "main",
				url: PAY_101_INVENTORY_PR_ARTIFACT.href ?? "",
				authorName: PAY_MAYA_ACTOR.name,
				authorAvatarSrc: PAY_MAYA_ACTOR.avatarSrc,
				createdAtMs: PAY_STORY_EPOCH_MS - 1_680_000,
				updatedAtMs: PAY_STORY_EPOCH_MS - 900_000,
				reviewDecision: "approved",
				mergeState: "merged",
			},
			createdAtMs: PAY_STORY_EPOCH_MS - 900_000,
		},
		{
			id: "pay-101-moved-done",
			kind: "event",
			actor: PAY_MAYA_ACTOR,
			icon: "status",
			segments: [
				{ type: "text", text: "moved from " },
				{ type: "lozenge", text: "In progress" },
				{ type: "transition-arrow" },
				{ type: "lozenge", text: "Done", variant: "success" },
			],
			createdAtMs: PAY_STORY_EPOCH_MS - 840_000,
		},
	];
}

function createPay101ContextResources(): JiraWorkItemState["contextResources"] {
	return {
		title: JIRA_TEAM_EU26_PAY_101_WORK_ITEM.title,
		description: PAY_101_DESCRIPTION,
		tldr: [
			"61 LegacyGatewayAdapter call sites are mapped across four services and every port has an owner.",
			"The keep-or-delete rationale remains uncaptured in a separate local Claude session surfaced by Insights and restored in Terminal.",
			"Merged PR #1839 and commit 8c2f4e1 are the durable evidence behind the first Insights summary.",
		],
		nextSteps: [
			{
				id: "pay-101-next-link-spike",
				label: "Link the deletion spike",
				command: "Link PR #1847 and the proof branch to PAY-102, then record whether the adapter can be deleted outright.",
			},
			{
				id: "pay-101-next-start-first-port",
				label: "Start the first owned port",
				command: "Start PAY-104 only after PAY-102 proves deletion and PAY-121 has a per-account kill switch.",
			},
		],
		attachments: [
			{
				id: "pay-101-migration-scope",
				name: "payments-sdk-v2-migration-scope",
				displayName: "Payments SDK v2 migration scope",
				ext: "md",
				date: "17 Aug 2026, 8:05 AM",
				thumbnailKind: "document",
				sourceLabel: "Confluence page",
			},
		],
		subtasks: [
			{
				type: "Task",
				key: "PAY-102",
				summary: "Prove LegacyGatewayAdapter can be deleted outright",
				priority: "high",
				assignee: PAY_STORY_PEOPLE.maya.name,
				assigneeAvatarUrl: PAY_STORY_PEOPLE.maya.avatarSrc,
				status: "inprogress",
			},
			{
				type: "Task",
				key: "PAY-104",
				summary: "Port createPaymentIntent onto the v2 client",
				priority: "high",
				assignee: PAY_STORY_PEOPLE.jordan.name,
				assigneeAvatarUrl: PAY_STORY_PEOPLE.jordan.avatarSrc,
				status: "todo",
			},
		],
		linkedItems: [
			{
				id: "pay-101-linked-rollout-flag",
				key: "PAY-121",
				summary: "Add per-account targeting and an armed kill switch",
				type: "Task",
				relationship: "blocks",
				assignee: PAY_STORY_PEOPLE.priya.name,
				assigneeAvatarUrl: PAY_STORY_PEOPLE.priya.avatarSrc,
				priority: "high",
				status: "inprogress",
			},
		],
	};
}

export function createJiraTeamEu26Pay101BuildState(): JiraWorkItemState {
	const base = hydratePreset("filled", JIRA_TEAM_EU26_PAY_101_WORK_ITEM);
	const session = createPay101ClaudeSession();

	return {
		...base,
		preset: "filled",
		contextResources: createPay101ContextResources(),
		metadata: {
			...base.metadata,
			status: "Done",
			atlassianProject: "payments-platform",
			parent: "PAY-100",
			crew: [
				{
					id: "claude-code",
					kind: "agent",
					name: "Claude",
					brandName: "claude",
				},
			],
		},
		comments: [
			{
				id: "pay-101-captured-session-comment",
				authorName: PAY_STORY_PEOPLE.maya.name,
				authorAvatarSrc: PAY_STORY_PEOPLE.maya.avatarSrc,
				content: "The inventory coding-agent run is captured on PAY-101: PR #1839 is merged, and commit 8c2f4e1 is the source for the 61 call sites and owner assignments shown in Insights. The keep-or-delete rationale remains uncaptured in the separate local Claude session.",
				createdAtMs: PAY_STORY_EPOCH_MS - 960_000,
				progressChecklist: session.progressChecklist,
				outputs: [
					cloneArtifact(PAY_101_INVENTORY_PR_ARTIFACT),
					cloneArtifact(PAY_101_INVENTORY_COMMIT_ARTIFACT),
				],
			},
		],
		sessions: [session],
		staticEvents: createPay101StaticEvents(),
		// Build opens on the top of Activity. The user chooses the captured run
		// rather than being dropped into an already-open embedded session.
		activeSessionId: null,
		composerPrefill: null,
		elapsedMs: PAY_STORY_EPOCH_MS - SESSION_EPOCH_MS,
		nextOrder: 2,
		nextIdCounter: 500,
	};
}
