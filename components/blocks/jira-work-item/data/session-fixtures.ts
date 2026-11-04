/**
 * Deterministic seed content + fixed epoch for the experimental Jira Work Item
 * presets. Imports from the state model are **type-only** (erased at build), so
 * there is no runtime cycle: the model imports these fixtures for values; the
 * fixtures only borrow the model's types.
 */

import type { WorkItemAttachment, WorkItemChildItem } from "@/app/contexts/context-work-item-modal";
import type {
	AgentSessionAgent,
	AgentSessionComment,
	JiraWorkItemContextResources,
	ContextLinkedItem,
	NextStep,
	StaticTimelineEvent,
} from "@/components/blocks/jira-work-item/data/session-state";
import { STOREFRONT_PLATFORM_PROJECT } from "@/components/blocks/jira-work-item/data/metadata-fixtures";

/**
 * Fixed base epoch for deterministic display timestamps. Never derive time from
 * `Date.now()` / `new Date()` (breaks reproducibility + SSR hydration). All
 * `createdAtMs` values are `SESSION_EPOCH_MS + <deterministic offset>`.
 */
export const SESSION_EPOCH_MS = Date.UTC(2026, 5, 8, 16, 0, 0); // Jun 8 2026, 16:00 UTC

const FILLED_TITLE = "Acmecorp: Prepare for bid recommendation for ESM RFP";
const FILLED_DESCRIPTION = [
	"Acmecorp is evaluating Atlassian as a replacement for its current service-management and work-management stack. We need a bid/no-bid recommendation before committing to a full ESM RFP response.",
	"",
	"#### Opportunity",
	"Acmecorp wants to consolidate fragmented regional tools into one enterprise service-management operating model. Deal size is multi-thousand users; budget qualification is still pending before a full bid.",
	"",
	"#### Scope",
	"- Clarify CMDB and procurement requirements into must-haves, differentiators, and owners.",
	"- Map requirements to Atlassian strengths across JSM, Assets/CMDB, Rovo, and security/compliance.",
	"- Flag product, legal, security, deal desk, or partner reviews before drafting a customer-facing package.",
	"",
	"#### Qualification flow",
	"```mermaid",
	"flowchart TD",
	'\tintake["RFP intake"] --> qualify{"Budget and stakeholder access?"}',
	'\tqualify -->|yes| matrix["Requirement compliance matrix"]',
	'\tqualify -->|no| nobid["No-bid recommendation"]',
	'\tmatrix --> validate["Assets, CMDB, and security answers"]',
	'\tvalidate --> recommend["Bid / no-bid recommendation"]',
	"```",
	"",
	"#### Acceptance criteria",
	"1. Every mandatory Acmecorp response section has a named owner on the compliance matrix.",
	"2. Budget, stakeholder access, and campaign fit are confirmed before a full response is committed.",
	"3. Assets, CMDB, HAM/SAM, GRC, and data residency answers are validated with product and legal owners.",
	"",
	"#### Delivery breakdown",
	"- [RFP-110 Collect Acmecorp RFP source documents](#rfp-110) — gathers the inbound packet this qualification is derived from.",
	"- [RFP-111 Confirm Acmecorp mandatory response sections](#rfp-111) — scopes must-haves, differentiators, and owners.",
	"- [RFP-112 Map Acmecorp reviewers and decision owners](#rfp-112) — names the bid/no-bid reviewers before drafting.",
	"",
	"#### Related work",
	"- [RFP-100 Enterprise RFP Response](#rfp-100) — parent epic for this qualification.",
	"- [RFP-102 Northstar Bank supplier packet review](#rfp-102) — related supplier-packet review on the same response program.",
].join("\n");
export const FILLED_ATLASSIAN_PROJECT = STOREFRONT_PLATFORM_PROJECT.id;

const FILLED_TLDR = [
	"Acmecorp wants to consolidate fragmented regional tools into one enterprise service-management operating model.",
	"The response hinges on Assets/CMDB depth, a credible AI story via Rovo, and security/compliance readiness.",
	"Deal size is multi-thousand users; budget qualification is still pending before a full bid.",
];

const FILLED_NEXT_STEPS: NextStep[] = [
	{ id: "next-compliance", label: "Finish the requirement compliance matrix", command: "Build the Acmecorp requirement compliance matrix and mark every mandatory owner." },
	{ id: "next-qualify", label: "Confirm budget and stakeholder access", command: "Assess whether Acmecorp budget, stakeholder access, and campaign fit justify a full response." },
	{ id: "next-validate", label: "Validate Assets, CMDB, and security answers", command: "Validate Acmecorp Assets, CMDB, HAM/SAM, GRC, and data residency responses with product and legal owners." },
	{ id: "next-recommend", label: "Draft the bid/no-bid recommendation", command: "Prepare a concise Acmecorp bid/no-bid recommendation with strengths, gaps, and follow-up questions." },
];

const FILLED_ATTACHMENTS: WorkItemAttachment[] = [
	{
		id: "att-intake-notes",
		name: "rfp-intake-notes",
		displayName: "RFP intake notes",
		ext: "page",
		date: "12 May 2026, 09:12 AM",
		thumbnailKind: "document",
		sourceLabel: "Confluence page",
		sourceProduct: "confluence",
	},
	{
		id: "att-requirements",
		name: "acmecorp-requirements",
		displayName: "Acmecorp requirements export",
		ext: "xlsx",
		date: "12 May 2026, 09:40 AM",
		thumbnailKind: "document",
		sourceLabel: "Spreadsheet",
	},
];

const FILLED_SUBTASKS: WorkItemChildItem[] = [
	{ type: "Subtask", key: "RFP-110", summary: "Collect Acmecorp RFP source documents", priority: "medium", assignee: "Jordan Lee", assigneeAvatarUrl: "/avatar-user/andrew-park/color/asow-dev-lime.png", status: "done" },
	{ type: "Subtask", key: "RFP-111", summary: "Confirm Acmecorp mandatory response sections", priority: "high", assignee: "Maya Chen", assigneeAvatarUrl: "/avatar-user/andrea-wilson/color/asow-service-yellow.png", status: "inprogress" },
	{ type: "Subtask", key: "RFP-112", summary: "Map Acmecorp reviewers and decision owners", priority: "medium", assignee: "Jordan Lee", assigneeAvatarUrl: "/avatar-user/andrew-park/color/asow-dev-lime.png", status: "todo" },
];

const FILLED_LINKED_ITEMS: ContextLinkedItem[] = [
	{ id: "link-rfp-100", key: "RFP-100", summary: "Enterprise RFP Response", type: "Epic", relationship: "relates to" },
	{ id: "link-rfp-102", key: "RFP-102", summary: "Northstar Bank supplier packet review", type: "Task", relationship: "relates to" },
];

export const FILLED_COMMENTS: AgentSessionComment[] = [
	{
		id: "comment-seed-1",
		authorName: "Jordan Lee",
		authorAvatarSrc: "/avatar-user/andrew-park/color/asow-dev-lime.png",
		content: "Flagging that Acmecorp budget qualification is still open — let's confirm before committing to a full response.",
		createdAtMs: SESSION_EPOCH_MS - 3_600_000,
	},
];

const MAYA: StaticTimelineEvent["actor"] = {
	id: "static-maya-chen",
	name: "Maya Chen",
	kind: "person",
	avatarSrc: "/avatar-user/andrea-wilson/color/asow-service-yellow.png",
};

const JORDAN: StaticTimelineEvent["actor"] = {
	id: "static-jordan-lee",
	name: "Jordan Lee",
	kind: "person",
	avatarSrc: "/avatar-user/andrew-park/color/asow-dev-lime.png",
};

const TRIAGE_AGENT: StaticTimelineEvent["actor"] = {
	id: "static-triage-assistant",
	name: "Triage assistant",
	kind: "agent",
	avatarSrc: "/avatar-agent-new/blue/auto-fix.svg",
};

const READINESS_AGENT: StaticTimelineEvent["actor"] = {
	id: "static-readiness-checker",
	name: "Readiness Checker",
	kind: "agent",
	avatarSrc: "/avatar-agent-new/blue/backlog-buddy.svg",
};

const AUTOMATION_TAG = { text: "Automation" } as const;

/**
 * Seeded timeline scaffolding for the filled preset. Mirrors the states the
 * standalone Jira Activity block shows (created, labels, SLA, status moves,
 * self-assign, self-delegate, changed files, pull-request creation) but themed to
 * the Acmecorp RFP demo actors. All offsets precede the seeded human comment
 * (−60min) and completed session (−30min) so the feed reads chronologically.
 */
export const FILLED_STATIC_EVENTS: StaticTimelineEvent[] = [
	{
		id: "static-created",
		kind: "event",
		actor: MAYA,
		segments: [{ type: "text", text: "created the issue" }],
		createdAtMs: SESSION_EPOCH_MS - 5_400_000, // −90min
	},
	{
		id: "static-labelled",
		kind: "event",
		actor: TRIAGE_AGENT,
		icon: "label",
		segments: [
			{ type: "text", text: "added " },
			{ type: "label", text: "RFP", color: "blue" },
			{ type: "text", text: " and " },
			{ type: "label", text: "Enterprise", color: "purple" },
		],
		createdAtMs: SESSION_EPOCH_MS - 5_280_000, // −88min
	},
	{
		id: "static-sla",
		kind: "event",
		actor: READINESS_AGENT,
		icon: "sla",
		segments: [
			{ type: "text", text: "set the SLA to 2w " },
			{ type: "tag", ...AUTOMATION_TAG },
		],
		createdAtMs: SESSION_EPOCH_MS - 5_160_000, // −86min
	},
	{
		id: "static-moved-intake",
		kind: "event",
		actor: MAYA,
		icon: "status",
		segments: [
			{ type: "text", text: "moved from " },
			{ type: "lozenge", text: "Triage" },
			{ type: "transition-arrow" },
			{ type: "lozenge", text: "RFP Intake" },
		],
		createdAtMs: SESSION_EPOCH_MS - 4_800_000, // −80min
	},
	{
		id: "static-assigned",
		kind: "event",
		actor: JORDAN,
		icon: "assigned",
		segments: [
			{ type: "text", text: "self-assigned the issue and set priority to " },
			{ type: "priority", text: "High" },
		],
		createdAtMs: SESSION_EPOCH_MS - 4_680_000, // −78min
	},
	{
		id: "static-delegated",
		kind: "event",
		actor: READINESS_AGENT,
		icon: "delegated",
		segments: [
			{ type: "text", text: "delegated the risk review " },
			{ type: "tag", ...AUTOMATION_TAG },
		],
		createdAtMs: SESSION_EPOCH_MS - 2_400_000, // −40min
	},
	{
		id: "static-changed-files",
		kind: "changed-files",
		actor: READINESS_AGENT,
		summary: "Updated 3 resources",
		description:
			"Refreshed the Acmecorp compliance matrix, requirement owners, and the security response draft ahead of the bid decision.",
		branch: "#RFP-101",
		sessionItem: {
			id: "static-readiness-outputs",
			title: "Refresh Acmecorp compliance resources",
			state: "complete",
			agent: {
				name: READINESS_AGENT.name,
				avatarSrc: READINESS_AGENT.avatarSrc ?? "/avatar-agent-new/blue/backlog-buddy.svg",
			},
			branch: "rovo/rfp-101-risk-review",
			elapsedSeconds: 300,
		},
		outputs: [
			{
				id: "acmecorp-compliance-matrix",
				title: "Acmecorp compliance matrix",
				source: "Confluence page",
				owner: "Readiness Checker",
				iconName: "globe",
			},
			{
				id: "acmecorp-security-response",
				title: "Acmecorp security response draft",
				source: "Agent output",
				iconName: "ai-chat",
			},
		],
		createdAtMs: SESSION_EPOCH_MS - 1_500_000, // −25min
	},
	{
		id: "static-linked",
		kind: "event",
		actor: MAYA,
		segments: [],
		pullRequest: {
			number: 1847,
			title: "Add Acmecorp ESM RFP response workspace",
			status: "Open",
			additions: 148,
			deletions: 37,
			authorName: "Maya Chen",
			repository: "acme/storefront",
			branch: "rovo/rfp-103-response-validation",
			targetBranch: "main",
			createdAtMs: SESSION_EPOCH_MS - 1_200_000,
			updatedAtMs: SESSION_EPOCH_MS - 1_200_000,
		},
		createdAtMs: SESSION_EPOCH_MS - 1_200_000, // −20min
	},
];

/** Reseed the generated TL;DR from the current context (deterministic rotation). */
export function reseedGeneratedTldr(context: Readonly<JiraWorkItemContextResources>): string[] {
	if (context.tldr.length === 0) return FILLED_TLDR.slice(0, 2);
	const [first, ...rest] = context.tldr;
	return [...rest, first];
}

export function reseedGeneratedNextSteps(context: Readonly<JiraWorkItemContextResources>): NextStep[] {
	if (context.nextSteps.length === 0) return FILLED_NEXT_STEPS.slice(0, 3);
	const [first, ...rest] = context.nextSteps;
	return [...rest, first];
}

export function emptyContextResources(): JiraWorkItemContextResources {
	return {
		title: FILLED_TITLE,
		description: "",
		tldr: [],
		nextSteps: [],
		attachments: [],
		subtasks: [],
		linkedItems: [],
	};
}

export function filledContextResources(): JiraWorkItemContextResources {
	return {
		title: FILLED_TITLE,
		description: FILLED_DESCRIPTION,
		tldr: [...FILLED_TLDR],
		nextSteps: FILLED_NEXT_STEPS.map((step) => ({ ...step })),
		attachments: FILLED_ATTACHMENTS.map((item) => ({ ...item })),
		subtasks: FILLED_SUBTASKS.map((item) => ({ ...item })),
		linkedItems: FILLED_LINKED_ITEMS.map((item) => ({ ...item })),
	};
}

/** Seeded agents for preset sessions. */
export const PRESET_AGENTS: Record<string, AgentSessionAgent> = {
	readiness: { id: "readiness-checker", name: "Readiness Checker", avatarSrc: "/avatar-agent-new/blue/backlog-buddy.svg" },
	requirements: { id: "response-reviewer", name: "Response Reviewer", avatarSrc: "/avatar-agent-new/lime/auto-review.svg" },
	feedback: { id: "feedback-analyzer", name: "Feedback Analyzer", avatarSrc: "/avatar-agent-new/purple/customer-insight.svg" },
	meeting: { id: "meeting-insights-reporter", name: "Meeting Insights Reporter", avatarSrc: "/avatar-agent-new/blue/comms-drafter.svg" },
};
