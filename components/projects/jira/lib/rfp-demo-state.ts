import type {
	JiraKanbanAgentData,
	JiraKanbanColumnData,
} from "@/components/blocks/jira-kanban";
import { BOARD_COLUMNS } from "../data/board-data";

export const AGENTS_RFP_DEMO_VERSION = 1;
export const RFP_DRAFTING_AGENT_ID = "rfp-drafting-agent";
export const RFP_DRAFTING_AGENT_NAME = "RFP Drafter";
export const RFP_DRAFTING_AGENT_DESCRIPTION =
	"Drafts first-pass RFP response packages for Enterprise RFP Response";
export const RFP_DRAFTING_AGENT_CONVERSATION_STARTERS = [
	"Draft the response package for the next Drafting ticket.",
	"Summarize blockers before this RFP can move to Review.",
	"Create reusable answer snippets from the attached RFP packet.",
] as const;
export const RFP_DRAFTING_TRIGGER_PROMPT = [
	"When a ticket enters Drafting, inspect the RFP packet, customer context, and required response sections.",
	"Draft the first-pass response package, flag blockers or missing inputs, attach the draft to the ticket, and move ready tickets to Review.",
].join(" ");
export const RFP_DRAFTING_SCHEDULE_ID = "rfp-drafting-weekday-0900";
export const RFP_DRAFTING_BOARD_NAME = "Enterprise RFP Response";
export const RFP_DRAFTING_COLUMN_NAME = "Drafting";
export const RFP_DRAFTING_EVENT_TRIGGER_LABEL = "On event: ticket enters Drafting";
export const GENERATED_RFP_REPORT_ATTACHMENT_ID = "generated-rfp-response-strategy-pdf";
export const RFP_DRAFTING_AGENT_AVATAR_SRC = "/avatar-agent-new/lime/feature-flag.svg";
export const RFP_DRAFTING_AGENT_AVATAR_SRCS = [
	"/avatar-agent-new/lime/feature-flag.svg",
	"/avatar-agent-new/lime/ops-agent.svg",
	"/avatar-agent-new/lime/auto-review.svg",
	"/avatar-agent-new/lime/auto-review.svg",
	"/avatar-agent-new/lime/auto-dev.svg",
	"/avatar-agent-new/lime/comms-drafter.svg",
	"/avatar-agent-new/lime/auto-dev.svg",
	"/avatar-agent-new/lime/auto-fix.svg",
	"/avatar-agent-new/lime/release-notes.svg",
	"/avatar-agent-new/lime/auto-review.svg",
	"/avatar-agent-new/lime/auto-dev.svg",
	"/avatar-agent-new/lime/auto-fix.svg",
	"/avatar-agent-new/lime/ops-agent.svg",
	"/avatar-agent-new/yellow/ops-agent.svg",
	"/avatar-agent-new/yellow/ops-agent.svg",
	"/avatar-agent-new/yellow/ops-agent.svg",
	"/avatar-agent-new/yellow/ops-agent.svg",
	"/avatar-agent-new/blue/marketing-message-maestro.svg",
	"/avatar-agent-new/blue/okr-oracle.svg",
	"/avatar-agent-new/blue/comms-drafter.svg",
	"/avatar-agent-new/blue/social-media-scribe.svg",
	"/avatar-agent-new/blue/my-user-manual.svg",
	"/avatar-agent-new/blue/team-connection.svg",
	"/avatar-agent-new/blue/release-notes.svg",
	"/avatar-agent-new/blue/auto-fix.svg",
	"/avatar-agent-new/blue/comms-drafter.svg",
	"/avatar-agent-new/blue/backlog-buddy.svg",
	"/avatar-agent-new/blue/team-connection.svg",
	"/avatar-agent-new/blue/backlog-buddy.svg",
	"/avatar-agent-new/blue/backlog-buddy.svg",
	"/avatar-agent-new/blue/product-requirements.svg",
	"/avatar-agent-new/blue/comms-drafter.svg",
	"/avatar-agent-new/blue/team-connection.svg",
	"/avatar-agent-new/blue/backlog-buddy.svg",
	"/avatar-agent-new/blue/culture.svg",
	"/avatar-agent-new/blue/customer-insight.svg",
	"/avatar-agent-new/blue/comms-drafter.svg",
	"/avatar-agent-new/blue/product-requirements.svg",
	"/avatar-agent-new/blue/backlog-buddy.svg",
	"/avatar-agent-new/blue/decision-director.svg",
	"/avatar-agent-new/blue/research-scout.svg",
	"/avatar-agent-new/blue/auto-dev.svg",
	"/avatar-agent-new/blue/product-requirements.svg",
	"/avatar-agent-new/purple/customer-insight.svg",
] as const;

export type AgentsRfpDemoReportStage =
	| "none"
	| "generating"
	| "generated"
	| "refined"
	| "approved"
	| "pdf-exported"
	| "attached";

const REPORT_STAGES = new Set<AgentsRfpDemoReportStage>([
	"none",
	"generating",
	"generated",
	"refined",
	"approved",
	"pdf-exported",
	"attached",
]);

export type AgentsRfpDemoCanvasViewId = "report";

export interface AgentsRfpDemoBoardColumnState {
	title: string;
	cardCodes: string[];
}

export interface AgentsRfpDemoAttachment {
	id: string;
	displayName: string;
	ext: "html" | "pdf" | string;
	source: "fixture" | "generated";
	approved?: boolean;
	previewKind?: "html-report" | "pdf-preview";
	kind?: string | null;
	previewHtml?: string | null;
}

export type AgentsRfpDemoAgentStatus = "idle" | "queued" | "running" | "completed" | "failed";

export interface AgentsRfpDemoAgentComment {
	id: string;
	authorName: string;
	authorAvatarSrc: string;
	timestampLabel: string;
	content: string;
}

export interface AgentsRfpDemoAttachmentComment {
	id: string;
	authorName: string;
	authorAvatarSrc: string;
	timestampLabel: string;
	content: string;
	attachmentId: string;
	attachmentLabel: string;
	attachmentHref: string;
}

export interface AgentsRfpDemoWorkItemState {
	status: string;
	attachments: AgentsRfpDemoAttachment[];
	agentAssignmentIds: string[];
	assignee?: string | null;
	previousAssignee?: string | null;
	agentStatus?: AgentsRfpDemoAgentStatus;
	agentStartedAt?: string | null;
	agentReadyAt?: string | null;
	agentSessionThreadId?: string | null;
	agentJobRunId?: string | null;
	generatedAttachment?: AgentsRfpDemoAttachment | null;
	agentComment?: AgentsRfpDemoAgentComment | null;
	attachmentComment?: AgentsRfpDemoAttachmentComment | null;
	completedAt?: string | null;
	lastError?: string | null;
}

export interface AgentsRfpDemoReportVersion {
	id: string;
	label: string;
	summary: string;
	createdBy: "Rovo" | "Maya";
	timestampLabel: string;
}

export interface AgentsRfpDemoAgent {
	id: typeof RFP_DRAFTING_AGENT_ID;
	name: typeof RFP_DRAFTING_AGENT_NAME;
	description: string;
	conversationStarters: readonly string[];
	selected: boolean;
	assignedColumn: "Drafting";
	createdAt: string;
	avatarSrc?: string;
	jobId?: string | null;
	trigger?: AgentsRfpDemoEventTrigger | null;
	jobRunSummaries?: AgentsRfpDemoJobRunSummary[];
}

export interface AgentsRfpDemoEventTrigger {
	type: "jira-column-entered" | string;
	board: typeof RFP_DRAFTING_BOARD_NAME | string;
	column: typeof RFP_DRAFTING_COLUMN_NAME | string;
	label: string;
	prompt?: string | null;
}

export interface AgentsRfpDemoThreadLink {
	ticketCode: string;
	threadId: string;
}

export interface AgentsRfpDemoJobRunSummary {
	id: string;
	jobId?: string | null;
	source: string;
	triggerLabel: string;
	status: "completed" | "completed-with-failures" | "failed" | "running" | "skipped";
	startedAt: string;
	finishedAt?: string | null;
	processedTicketCodes: string[];
	skippedTicketCodes: string[];
	failedTicketCodes: string[];
	threadLinks: AgentsRfpDemoThreadLink[];
	summary: string;
}

export interface AgentsRfpDemoSchedule {
	id: typeof RFP_DRAFTING_SCHEDULE_ID;
	name: "Drafting column RFP response prep";
	agentId: typeof RFP_DRAFTING_AGENT_ID;
	scheduleLabel: string;
	status: "scheduled" | "connected";
}

export type AgentsRfpDemoActivityType =
	| "agent-created"
	| "workflow-assigned"
	| "scheduled"
	| "card-assigned"
	| "draft-started"
	| "draft-completed"
	| "draft-failed";

export interface AgentsRfpDemoActivityItem {
	id: string;
	timestampLabel: string;
	message: string;
	type: AgentsRfpDemoActivityType;
}

export interface AgentsRfpDemoToast {
	id: string;
	message: string;
}

export interface AgentsRfpDemoState {
	version: 1;
	board: {
		columns: AgentsRfpDemoBoardColumnState[];
	};
	workItems: Record<string, AgentsRfpDemoWorkItemState>;
	report: {
		stage: AgentsRfpDemoReportStage;
		currentVersionId?: string;
		previewHtml?: string;
		versions: AgentsRfpDemoReportVersion[];
	};
	agent: AgentsRfpDemoAgent | null;
	schedule: AgentsRfpDemoSchedule | null;
	customAgentActivity: AgentsRfpDemoActivityItem[];
	canvas: {
		open: boolean;
		activeViewId: AgentsRfpDemoCanvasViewId;
		mode: "editable" | "read-only";
	};
	chat: {
		selectedAgentId: "rovo" | typeof RFP_DRAFTING_AGENT_ID;
		lastRfp101AnswerSummary?: string;
		selectedRfpKnowledge?: string | null;
	};
	toasts: AgentsRfpDemoToast[];
}

const RFP_101_FIXTURE_ATTACHMENTS: readonly AgentsRfpDemoAttachment[] = [
	{
		id: "fixture-rfp-intake-notes",
		displayName: "RFP intake notes",
		ext: "page",
		source: "fixture",
	},
];

const GENERATED_REPORT_ATTACHMENTS: readonly AgentsRfpDemoAttachment[] = [
	{
		id: GENERATED_RFP_REPORT_ATTACHMENT_ID,
		displayName: "Acmecorp RFP qualification DACI.pdf",
		ext: "pdf",
		source: "generated",
		approved: true,
		previewKind: "pdf-preview",
	},
];

const INITIAL_REPORT_VERSION: AgentsRfpDemoReportVersion = {
	id: "initial-generated-report",
	label: "Initial generated report",
	summary: "First offline HTML qualification DACI from RFP-101 context.",
	createdBy: "Rovo",
	timestampLabel: "Now",
};

const REFINED_REPORT_VERSION: AgentsRfpDemoReportVersion = {
	id: "refined-current-report",
	label: "Refined current report",
	summary: "Qualification DACI with stronger budget, stakeholder, and review-risk notes.",
	createdBy: "Maya",
	timestampLabel: "Now",
};

const ATLASSIAN_LOGO_REPORT_VERSION: AgentsRfpDemoReportVersion = {
	id: "atlassian-logo-report",
	label: "Added Atlassian logo",
	summary: "Updated report with Atlassian branding in the document header.",
	createdBy: "Rovo",
	timestampLabel: "Now",
};

export const RFP_DRAFTING_AGENT: JiraKanbanAgentData = {
	id: RFP_DRAFTING_AGENT_ID,
	name: RFP_DRAFTING_AGENT_NAME,
	byline: "Local demo agent by Rovo",
	avatarSrc: RFP_DRAFTING_AGENT_AVATAR_SRC,
};

function getRfpDraftingAgentDescription(description?: string | null): string {
	return description && description.trim().length > 0
		? description.trim()
		: RFP_DRAFTING_AGENT_DESCRIPTION;
}

function getRfpDraftingAgentConversationStarters(starters?: readonly string[] | null): string[] {
	const normalizedStarters = Array.isArray(starters)
		? starters.filter((starter) => starter.trim().length > 0)
		: [];

	return normalizedStarters.length > 0
		? normalizedStarters
		: [...RFP_DRAFTING_AGENT_CONVERSATION_STARTERS];
}

export function createRfpDraftingEventTrigger(prompt: string | null = RFP_DRAFTING_TRIGGER_PROMPT): AgentsRfpDemoEventTrigger {
	return {
		type: "jira-column-entered",
		board: RFP_DRAFTING_BOARD_NAME,
		column: RFP_DRAFTING_COLUMN_NAME,
		label: RFP_DRAFTING_EVENT_TRIGGER_LABEL,
		prompt: prompt?.trim() || RFP_DRAFTING_TRIGGER_PROMPT,
	};
}

function normalizeRfpDraftingAgentTrigger(trigger: AgentsRfpDemoAgent["trigger"] | undefined): AgentsRfpDemoEventTrigger | null {
	if (trigger === null) {
		return null;
	}

	if (!trigger) {
		return createRfpDraftingEventTrigger();
	}

	return {
		...createRfpDraftingEventTrigger(trigger.prompt ?? null),
		type: trigger.type,
		board: trigger.board,
		column: trigger.column,
		label: trigger.label,
	};
}

function withRfpDraftingAgentProfileMetadata(agent: AgentsRfpDemoAgent): AgentsRfpDemoAgent {
	return {
		...agent,
		name: RFP_DRAFTING_AGENT_NAME,
		description: getRfpDraftingAgentDescription(agent.description),
		conversationStarters: getRfpDraftingAgentConversationStarters(agent.conversationStarters),
		trigger: normalizeRfpDraftingAgentTrigger(agent.trigger),
	};
}

export function normalizeAgentsRfpDemoProfileMetadata(state: AgentsRfpDemoState): AgentsRfpDemoState {
	return {
		...state,
		report: normalizeAgentsRfpDemoReport(state.report),
		agent: state.agent
			? withRfpDraftingAgentProfileMetadata(state.agent)
			: state.agent,
	};
}

function getRandomRfpDraftingAgentAvatarSrc(): string {
	return RFP_DRAFTING_AGENT_AVATAR_SRC;
}

function getRfpDraftingAgentData(agent: AgentsRfpDemoAgent): JiraKanbanAgentData {
	return {
		...RFP_DRAFTING_AGENT,
		avatarSrc: agent.avatarSrc ?? RFP_DRAFTING_AGENT.avatarSrc,
	};
}

function cloneState(state: AgentsRfpDemoState): AgentsRfpDemoState {
	return structuredClone(state);
}

function createDefaultBoardState(): AgentsRfpDemoState["board"] {
	return {
		columns: BOARD_COLUMNS.map((column) => ({
			title: column.title,
			cardCodes: column.cards.map((card) => card.code),
		})),
	};
}

function createDefaultWorkItems(): Record<string, AgentsRfpDemoWorkItemState> {
	const workItems: Record<string, AgentsRfpDemoWorkItemState> = {};

	for (const column of BOARD_COLUMNS) {
		for (const card of column.cards) {
			workItems[card.code] = {
				status: column.title,
				attachments: card.code === "RFP-101"
					? RFP_101_FIXTURE_ATTACHMENTS.map((attachment) => ({ ...attachment }))
					: [],
				agentAssignmentIds: [],
				assignee: null,
				previousAssignee: null,
				agentStatus: "idle",
				agentSessionThreadId: null,
				agentJobRunId: null,
				generatedAttachment: null,
				agentComment: null,
				attachmentComment: null,
				completedAt: null,
				lastError: null,
			};
		}
	}

	return workItems;
}

export function createDefaultAgentsRfpDemoState(): AgentsRfpDemoState {
	return {
		version: AGENTS_RFP_DEMO_VERSION,
		board: createDefaultBoardState(),
		workItems: createDefaultWorkItems(),
		report: {
			stage: "none",
			versions: [],
		},
		agent: null,
		schedule: null,
		customAgentActivity: [],
		canvas: {
			open: false,
			activeViewId: "report",
			mode: "editable",
		},
		chat: {
			selectedAgentId: "rovo",
			selectedRfpKnowledge: null,
		},
		toasts: [],
	};
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasString(value: unknown): value is string {
	return typeof value === "string" && value.length > 0;
}

function getNonEmptyString(value: unknown): string | null {
	return typeof value === "string" && value.trim().length > 0
		? value.trim()
		: null;
}

function isReportStage(value: unknown): value is AgentsRfpDemoReportStage {
	return typeof value === "string" && REPORT_STAGES.has(value as AgentsRfpDemoReportStage);
}

function normalizeReportVersion(value: unknown): AgentsRfpDemoReportVersion | null {
	if (!isObject(value)) {
		return null;
	}

	const id = getNonEmptyString(value.id);
	const label = getNonEmptyString(value.label);
	if (!id || !label) {
		return null;
	}

	return {
		id,
		label,
		summary: getNonEmptyString(value.summary) ?? label,
		createdBy: value.createdBy === "Maya" ? "Maya" : "Rovo",
		timestampLabel: getNonEmptyString(value.timestampLabel) ?? "Now",
	};
}

function normalizeAgentsRfpDemoReport(value: unknown): AgentsRfpDemoState["report"] {
	if (!isObject(value)) {
		return createDefaultAgentsRfpDemoState().report;
	}

	const versions = Array.isArray(value.versions)
		? value.versions.map(normalizeReportVersion).filter((version): version is AgentsRfpDemoReportVersion => Boolean(version))
		: [];
	const currentVersionId = getNonEmptyString(value.currentVersionId);
	const selectedVersionId = currentVersionId && versions.some((version) => version.id === currentVersionId)
		? currentVersionId
		: null;
	const previewHtml = getNonEmptyString(value.previewHtml);

	return {
		stage: isReportStage(value.stage) ? value.stage : "none",
		versions,
		...(selectedVersionId ? { currentVersionId: selectedVersionId } : {}),
		...(previewHtml ? { previewHtml } : {}),
	};
}

function isValidBoard(value: unknown): value is AgentsRfpDemoState["board"] {
	if (!isObject(value) || !Array.isArray(value.columns)) {
		return false;
	}

	return value.columns.every((column) => (
		isObject(column) &&
		hasString(column.title) &&
		Array.isArray(column.cardCodes) &&
		column.cardCodes.every(hasString)
	));
}

function isValidWorkItems(value: unknown): value is AgentsRfpDemoState["workItems"] {
	if (!isObject(value)) {
		return false;
	}

	return Object.values(value).every((workItem) => (
		isObject(workItem) &&
		hasString(workItem.status) &&
		Array.isArray(workItem.attachments) &&
		Array.isArray(workItem.agentAssignmentIds)
	));
}

function isValidReport(value: unknown): value is AgentsRfpDemoState["report"] {
	if (!isObject(value) || !hasString(value.stage) || !Array.isArray(value.versions)) {
		return false;
	}

	return isReportStage(value.stage);
}

export function isValidAgentsRfpDemoState(value: unknown): value is AgentsRfpDemoState {
	if (!isObject(value) || value.version !== AGENTS_RFP_DEMO_VERSION) {
		return false;
	}

	return (
		isValidBoard(value.board) &&
		isValidWorkItems(value.workItems) &&
		isValidReport(value.report) &&
		(value.agent === null || isObject(value.agent)) &&
		(value.schedule === null || isObject(value.schedule)) &&
		Array.isArray(value.customAgentActivity) &&
		isObject(value.canvas) &&
		isObject(value.chat) &&
		Array.isArray(value.toasts)
	);
}

export function parseAgentsRfpDemoState(rawValue: string | null): AgentsRfpDemoState {
	if (!rawValue) {
		return createDefaultAgentsRfpDemoState();
	}

	try {
		const parsed = JSON.parse(rawValue) as unknown;
		if (isValidAgentsRfpDemoState(parsed)) {
			return normalizeAgentsRfpDemoProfileMetadata(parsed);
		}
	} catch {
		return createDefaultAgentsRfpDemoState();
	}

	return createDefaultAgentsRfpDemoState();
}

function appendToast(
	state: AgentsRfpDemoState,
	message: string,
	id: string,
): AgentsRfpDemoState {
	const nextToasts = [
		...state.toasts.filter((toast) => toast.id !== id),
		{ id, message },
	].slice(-3);

	return {
		...state,
		toasts: nextToasts,
	};
}

function clearReportAttachmentToasts(state: AgentsRfpDemoState): AgentsRfpDemoState {
	const reportToastIds = new Set(["report-approved", "report-pdf-exported", "report-attached"]);

	return {
		...state,
		toasts: state.toasts.filter((toast) => !reportToastIds.has(toast.id)),
	};
}

function appendUniqueActivity(
	state: AgentsRfpDemoState,
	item: AgentsRfpDemoActivityItem,
): AgentsRfpDemoState {
	if (state.customAgentActivity.some((activity) => activity.id === item.id)) {
		return state;
	}

	return {
		...state,
		customAgentActivity: [...state.customAgentActivity, item],
	};
}

function updateWorkItem(
	state: AgentsRfpDemoState,
	code: string,
	updater: (workItem: AgentsRfpDemoWorkItemState) => AgentsRfpDemoWorkItemState,
): AgentsRfpDemoState {
	const currentWorkItem = state.workItems[code] ?? {
		status: "RFP Intake",
		attachments: [],
		agentAssignmentIds: [],
	};

	return {
		...state,
		workItems: {
			...state.workItems,
			[code]: updater(currentWorkItem),
		},
	};
}

function createRfp101AttachmentComment(): AgentsRfpDemoAttachmentComment {
	const attachment = GENERATED_REPORT_ATTACHMENTS[0];

	return {
		id: "maya-comment-rfp-101-report-attached",
		authorName: "Maya Chen",
		authorAvatarSrc: "/avatar-user/andrea-wilson/color/asow-service-yellow.png",
		timestampLabel: "Now",
		content: [
			"Rovo drafted this comment",
			`Rovo prepared the Acmecorp qualification DACI, exported the approved PDF, and added ${attachment.displayName} back to RFP-101.`,
		].join("\n"),
		attachmentId: attachment.id,
		attachmentLabel: "Open attachment in Rovo Canvas",
		attachmentHref: `#rovo-canvas-${attachment.id}`,
	};
}

export function generateRfpReport(state: AgentsRfpDemoState): AgentsRfpDemoState {
	return {
		...state,
		report: {
			stage: "generated",
			currentVersionId: INITIAL_REPORT_VERSION.id,
			versions: [INITIAL_REPORT_VERSION],
		},
		canvas: {
			open: true,
			activeViewId: "report",
			mode: "editable",
		},
	};
}

export function refineRfpReport(state: AgentsRfpDemoState): AgentsRfpDemoState {
	const generatedState = state.report.versions.length > 0
		? state
		: generateRfpReport(state);

	return {
		...generatedState,
		report: {
			stage: "refined",
			currentVersionId: REFINED_REPORT_VERSION.id,
			versions: [
				INITIAL_REPORT_VERSION,
				REFINED_REPORT_VERSION,
			],
		},
		canvas: {
			open: true,
			activeViewId: "report",
			mode: "editable",
		},
	};
}

export function addRfpReportLogoVersion(state: AgentsRfpDemoState): AgentsRfpDemoState {
	const generatedState = state.report.versions.length > 0
		? state
		: generateRfpReport(state);
	const versions = [
		INITIAL_REPORT_VERSION,
		...generatedState.report.versions.filter((version) => (
			version.id !== INITIAL_REPORT_VERSION.id &&
			version.id !== ATLASSIAN_LOGO_REPORT_VERSION.id
		)),
		ATLASSIAN_LOGO_REPORT_VERSION,
	];

	return {
		...generatedState,
		report: {
			...generatedState.report,
			stage: "refined",
			currentVersionId: ATLASSIAN_LOGO_REPORT_VERSION.id,
			versions,
		},
		canvas: {
			open: true,
			activeViewId: "report",
			mode: "editable",
		},
	};
}

export function recordRfpReportArtifactUpdate(state: AgentsRfpDemoState): AgentsRfpDemoState {
	return addRfpReportLogoVersion(state);
}

export function selectRfpReportVersion(
	state: AgentsRfpDemoState,
	versionId: string,
): AgentsRfpDemoState {
	if (!state.report.versions.some((version) => version.id === versionId)) {
		return state;
	}

	return {
		...state,
		report: {
			...state.report,
			currentVersionId: versionId,
		},
	};
}

export function approveRfpReport(state: AgentsRfpDemoState): AgentsRfpDemoState {
	const reportState = state.report.stage === "none"
		? generateRfpReport(state)
		: state;

	return appendToast(
		{
			...reportState,
			report: {
				...reportState.report,
				stage: "approved",
			},
		},
		"PDF approved for RFP-101.",
		"report-approved",
	);
}

export function exportRfpReportPdf(state: AgentsRfpDemoState): AgentsRfpDemoState {
	const approvedState = state.report.stage === "approved"
		? state
		: approveRfpReport(state);

	return appendToast(
		{
			...approvedState,
			report: {
				...approvedState.report,
				stage: "pdf-exported",
			},
		},
		"Staged PDF export created for browser preview.",
		"report-pdf-exported",
	);
}

export function attachRfpReportToWorkItem(
	state: AgentsRfpDemoState,
	reportPreviewHtml?: string,
): AgentsRfpDemoState {
	const reportState = state.report.stage === "none"
		? generateRfpReport(state)
		: state;
	const exportedState = clearReportAttachmentToasts({
		...reportState,
		report: {
			...reportState.report,
			stage: reportState.report.stage === "attached" ? "attached" : "pdf-exported",
		},
	});
	const attachedState = updateWorkItem(exportedState, "RFP-101", (workItem) => {
		const preservedAttachments = workItem.attachments.filter((attachment) => attachment.source !== "generated");

		return {
			...workItem,
			attachments: [
				...preservedAttachments,
				...GENERATED_REPORT_ATTACHMENTS.map((attachment) => ({ ...attachment })),
			],
			attachmentComment: createRfp101AttachmentComment(),
		};
	});

	return appendToast(
		{
			...attachedState,
			report: {
				...attachedState.report,
				stage: "attached",
				previewHtml: reportPreviewHtml ?? attachedState.report.previewHtml,
			},
			canvas: {
				...attachedState.canvas,
				open: false,
				activeViewId: "report",
				mode: "read-only",
			},
		},
		"Added PDF to RFP-101.",
		"report-attached",
	);
}

export function createRfpDraftingAgent(state: AgentsRfpDemoState): AgentsRfpDemoState {
	const agent: AgentsRfpDemoAgent = state.agent
		? withRfpDraftingAgentProfileMetadata({
				...state.agent,
				avatarSrc: state.agent.avatarSrc ?? getRandomRfpDraftingAgentAvatarSrc(),
				trigger: createRfpDraftingEventTrigger(state.agent.trigger?.prompt ?? null),
			})
		: {
				id: RFP_DRAFTING_AGENT_ID,
				name: RFP_DRAFTING_AGENT_NAME,
				description: RFP_DRAFTING_AGENT_DESCRIPTION,
				conversationStarters: [...RFP_DRAFTING_AGENT_CONVERSATION_STARTERS],
				selected: true,
				assignedColumn: "Drafting",
				createdAt: "Now",
				avatarSrc: getRandomRfpDraftingAgentAvatarSrc(),
				jobId: null,
				trigger: createRfpDraftingEventTrigger(),
				jobRunSummaries: [],
			};
	const createdState: AgentsRfpDemoState = {
		...state,
		agent,
	};

	const withCreated = appendUniqueActivity(createdState, {
		id: "activity-agent-created",
		timestampLabel: "Now",
		message: `Rovo created ${RFP_DRAFTING_AGENT_NAME}.`,
		type: "agent-created",
	});

	return appendUniqueActivity(withCreated, {
		id: "activity-workflow-assigned",
		timestampLabel: "Now",
		message: `Rovo assigned ${RFP_DRAFTING_AGENT_NAME} to the Drafting workflow.`,
		type: "workflow-assigned",
	});
}

export function scheduleRfpDraftingAgent(state: AgentsRfpDemoState): AgentsRfpDemoState {
	const agentState = createRfpDraftingAgent(state);
	const scheduledState: AgentsRfpDemoState = {
		...agentState,
		schedule: null,
		agent: agentState.agent
			? {
					...agentState.agent,
					trigger: createRfpDraftingEventTrigger(agentState.agent.trigger?.prompt ?? null),
					jobRunSummaries: agentState.agent.jobRunSummaries ?? [],
				}
			: agentState.agent,
	};

	return appendUniqueActivity(scheduledState, {
		id: "activity-agent-scheduled",
		timestampLabel: "Now",
		message: `Maya connected ${RFP_DRAFTING_AGENT_NAME} to Drafting column events.`,
		type: "scheduled",
	});
}

export function setRfpDraftingAgentTrigger(state: AgentsRfpDemoState, prompt: string): AgentsRfpDemoState {
	if (!state.agent) {
		return state;
	}

	return {
		...state,
		agent: withRfpDraftingAgentProfileMetadata({
			...state.agent,
			trigger: createRfpDraftingEventTrigger(prompt),
		}),
	};
}

export function clearRfpDraftingAgentTrigger(state: AgentsRfpDemoState): AgentsRfpDemoState {
	if (!state.agent) {
		return state;
	}

	return {
		...state,
		agent: withRfpDraftingAgentProfileMetadata({
			...state.agent,
			trigger: null,
		}),
	};
}

export function getCommonRfpDemoCardAgentIds(
	state: AgentsRfpDemoState,
	cardCodes: ReadonlySet<string>,
): string[] {
	const selectedCodes = [...cardCodes];
	if (selectedCodes.length === 0) {
		return [];
	}

	const firstAssignments = state.workItems[selectedCodes[0]]?.agentAssignmentIds ?? [];
	return firstAssignments.filter((agentId) => selectedCodes.every((cardCode) => (
		state.workItems[cardCode]?.agentAssignmentIds.includes(agentId) ?? false
	)));
}

export function setRfpDemoCardsAgentAssignment(
	state: AgentsRfpDemoState,
	cardCodes: readonly string[],
	agentId: string,
	assigned: boolean,
): AgentsRfpDemoState {
	return cardCodes.reduce((currentState, cardCode) => updateWorkItem(
		currentState,
		cardCode,
		(workItem) => ({
			...workItem,
			agentAssignmentIds: assigned
				? Array.from(new Set([...workItem.agentAssignmentIds, agentId]))
				: workItem.agentAssignmentIds.filter((currentAgentId) => currentAgentId !== agentId),
		}),
	), state);
}

function assignRfpDraftingAgentToCard(
	state: AgentsRfpDemoState,
	cardCode: string,
): AgentsRfpDemoState {
	const assignedState = updateWorkItem(state, cardCode, (workItem) => {
		if (workItem.agentAssignmentIds.includes(RFP_DRAFTING_AGENT_ID)) {
			return workItem;
		}

		return {
			...workItem,
			agentAssignmentIds: [...workItem.agentAssignmentIds, RFP_DRAFTING_AGENT_ID],
		};
	});
	const withAssignment = appendUniqueActivity(assignedState, {
		id: `activity-${cardCode.toLowerCase()}-assigned`,
		timestampLabel: "Now",
		message: `${RFP_DRAFTING_AGENT_NAME} was assigned to ${cardCode}.`,
		type: "card-assigned",
	});
	const withPrep = appendUniqueActivity(withAssignment, {
		id: `activity-${cardCode.toLowerCase()}-draft-started`,
		timestampLabel: "Now",
		message: `${RFP_DRAFTING_AGENT_NAME} started first-pass response prep for ${cardCode}.`,
		type: "draft-started",
	});

	return appendToast(
		withPrep,
		`${RFP_DRAFTING_AGENT_NAME} assigned to ${cardCode}. Preparing first-pass response package.`,
		`${cardCode.toLowerCase()}-agent-assigned`,
	);
}

export function moveRfpDemoCard(
	state: AgentsRfpDemoState,
	cardCode: string,
	targetColumnTitle: string,
): AgentsRfpDemoState {
	const nextState = cloneState(state);
	const sourceColumn = nextState.board.columns.find((column) => column.cardCodes.includes(cardCode));
	const targetColumn = nextState.board.columns.find((column) => column.title === targetColumnTitle);

	if (!sourceColumn || !targetColumn || sourceColumn.title === targetColumn.title) {
		return state;
	}

	sourceColumn.cardCodes = sourceColumn.cardCodes.filter((code) => code !== cardCode);
	targetColumn.cardCodes = [
		cardCode,
		...targetColumn.cardCodes.filter((code) => code !== cardCode),
	];
	nextState.workItems[cardCode] = {
		...(nextState.workItems[cardCode] ?? {
			attachments: [],
			agentAssignmentIds: [],
			status: targetColumn.title,
		}),
		status: targetColumn.title,
	};

	if (cardCode === "RFP-102" && targetColumn.title === "Drafting" && nextState.agent) {
		return assignRfpDraftingAgentToCard(nextState, cardCode);
	}

	return nextState;
}

export function setRfp101AnswerSummary(
	state: AgentsRfpDemoState,
	answerSummary: string,
): AgentsRfpDemoState {
	return {
		...state,
		chat: {
			...state.chat,
			lastRfp101AnswerSummary: answerSummary,
		},
	};
}

export function setRfpDemoCanvasOpen(
	state: AgentsRfpDemoState,
	open: boolean,
	mode: "editable" | "read-only" = state.canvas.mode,
): AgentsRfpDemoState {
	return {
		...state,
		canvas: {
			...state.canvas,
			open,
			mode,
		},
	};
}

export function setRfpDemoCanvasView(
	state: AgentsRfpDemoState,
	activeViewId: AgentsRfpDemoCanvasViewId,
): AgentsRfpDemoState {
	return {
		...state,
		canvas: {
			...state.canvas,
			activeViewId,
		},
	};
}

export function dismissRfpDemoToast(
	state: AgentsRfpDemoState,
	toastId: string,
): AgentsRfpDemoState {
	return {
		...state,
		toasts: state.toasts.filter((toast) => toast.id !== toastId),
	};
}

export function getGeneratedRfpAttachments(
	state: AgentsRfpDemoState,
	workItemCode: string,
): AgentsRfpDemoAttachment[] {
	return (state.workItems[workItemCode]?.attachments ?? [])
		.filter((attachment) => attachment.source === "generated")
		.map((attachment) => ({ ...attachment }));
}

function getReviewPromotionTimestamp(workItem: AgentsRfpDemoWorkItemState | undefined): number {
	const completedAtMs = Date.parse(workItem?.completedAt ?? "");
	if (Number.isFinite(completedAtMs)) {
		return completedAtMs;
	}

	const agentStartedAtMs = Date.parse(workItem?.agentStartedAt ?? "");
	return Number.isFinite(agentStartedAtMs) ? agentStartedAtMs : 0;
}

function shouldPromoteCompletedReviewCard(workItem: AgentsRfpDemoWorkItemState | undefined): boolean {
	return Boolean(
		workItem?.status === "Review" &&
		workItem.agentStatus === "completed" &&
		!workItem.assignee,
	);
}

function getResolvedColumnCardCodes(
	column: AgentsRfpDemoBoardColumnState,
	state: AgentsRfpDemoState,
): string[] {
	if (column.title !== "Review") {
		return column.cardCodes;
	}

	const indexedCodes = column.cardCodes.map((code, index) => ({ code, index }));
	const promotedCodes = indexedCodes
		.filter(({ code }) => shouldPromoteCompletedReviewCard(state.workItems[code]))
		.sort((left, right) => {
			const timestampDelta =
				getReviewPromotionTimestamp(state.workItems[right.code]) -
				getReviewPromotionTimestamp(state.workItems[left.code]);
			return timestampDelta === 0 ? left.index - right.index : timestampDelta;
		})
		.map(({ code }) => code);
	const promotedCodeSet = new Set(promotedCodes);

	return [
		...promotedCodes,
		...column.cardCodes.filter((code) => !promotedCodeSet.has(code)),
	];
}

export function resolveRfpDemoBoardColumns(
	state: AgentsRfpDemoState,
): JiraKanbanColumnData[] {
	const baseCards = new Map(
		BOARD_COLUMNS.flatMap((column) => column.cards.map((card) => [card.code, card])),
	);

	return state.board.columns.map((column) => {
		const cards = getResolvedColumnCardCodes(column, state)
			.map((cardCode) => {
				const card = baseCards.get(cardCode);
				if (!card) {
					return null;
				}

				const workItem = state.workItems[cardCode];
				const agentAssignmentIds = workItem?.agentAssignmentIds ?? [];
				const hasRfpDraftingAgent = agentAssignmentIds.includes(RFP_DRAFTING_AGENT_ID);
				const isCompletedUnassignedReview = workItem?.agentStatus === "completed" &&
					workItem.status === "Review" &&
					!workItem.assignee;
				const agentStatusTag = workItem?.agentStatus === "running" || workItem?.agentStatus === "queued"
					? { text: "agent running", color: "blue" as const }
					: workItem?.agentStatus === "completed"
						? { text: "draft ready", color: "green" as const }
						: workItem?.agentStatus === "failed"
							? { text: "agent failed", color: "red" as const }
							: null;

				const resolvedCard = {
					...card,
					tags: hasRfpDraftingAgent
						? [
								...card.tags,
								agentStatusTag ?? { text: "agent prep", color: "green" as const },
							]
						: card.tags.map((tag) => ({ ...tag })),
				};

				if (workItem?.assignee === RFP_DRAFTING_AGENT_NAME) {
					return {
						...resolvedCard,
						avatarSrc: state.agent?.avatarSrc ?? RFP_DRAFTING_AGENT_AVATAR_SRC,
						avatarShape: "hexagon" as const,
						avatarPulse: workItem.agentStatus === "running" || workItem.agentStatus === "queued",
					};
				}

				if (isCompletedUnassignedReview) {
					return {
						...resolvedCard,
						avatarPulse: false,
						avatarSrc: undefined,
						avatarUnassignedKind: "person" as const,
					};
				}

				return resolvedCard;
			})
			.filter((card): card is JiraKanbanColumnData["cards"][number] => card !== null);

		return {
			title: column.title,
			count: cards.length,
			cards,
		};
	});
}

export function getRfpDemoColumnAgentAssignments(
	state: AgentsRfpDemoState,
): Record<string, string[]> {
	if (!state.agent) {
		return {};
	}

	return {
		[state.agent.assignedColumn]: [state.agent.id],
	};
}

export function getRfpDemoAgents(
	state: AgentsRfpDemoState,
	baseAgents: readonly JiraKanbanAgentData[],
): JiraKanbanAgentData[] {
	if (!state.agent || baseAgents.some((agent) => agent.id === RFP_DRAFTING_AGENT_ID)) {
		return [...baseAgents];
	}

	return [getRfpDraftingAgentData(state.agent), ...baseAgents];
}

export function formatRfpDemoContext(state: AgentsRfpDemoState): string {
	const rfp101 = state.workItems["RFP-101"];
	const rfp102 = state.workItems["RFP-102"];
	const generatedAttachments = getGeneratedRfpAttachments(state, "RFP-101")
		.map((attachment) => attachment.displayName)
		.join(", ");

	return [
		"[Agents RFP Demo Local State]",
		"Source: backend-persisted /jira RFP demo state.",
		`Report stage: ${state.report.stage}.`,
		generatedAttachments ? `Generated attachments on RFP-101: ${generatedAttachments}.` : "Generated attachments on RFP-101: none.",
		`RFP-101 status: ${rfp101?.status ?? "unknown"}.`,
		`RFP-102 status: ${rfp102?.status ?? "unknown"}.`,
		state.agent ? `Custom agent: ${RFP_DRAFTING_AGENT_NAME} assigned to Drafting events.` : "Custom agent: not created.",
		state.agent?.trigger ? `Trigger: ${state.agent.trigger.label}.` : "Trigger: none.",
		state.agent?.trigger?.prompt ? `Trigger prompt: ${state.agent.trigger.prompt}` : null,
		state.chat.selectedRfpKnowledge ? `Selected RFP agent knowledge: ${state.chat.selectedRfpKnowledge}.` : null,
		`Selected chat agent: ${state.chat.selectedAgentId === RFP_DRAFTING_AGENT_ID ? RFP_DRAFTING_AGENT_NAME : "Rovo"}.`,
		state.chat.lastRfp101AnswerSummary ? `Latest Maya qualification answer: ${state.chat.lastRfp101AnswerSummary}` : null,
		"[End Agents RFP Demo Local State]",
	]
		.filter((line): line is string => typeof line === "string" && line.length > 0)
		.join("\n");
}
