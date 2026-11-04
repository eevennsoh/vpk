"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

const AGENTS_RFP_DEMO_VERSION = 1;
const RFP_DRAFTING_AGENT_ID = "rfp-drafting-agent";
const RFP_DRAFTING_AGENT_NAME = "RFP Drafter";
const RFP_DRAFTING_AGENT_DESCRIPTION =
	"Drafts first-pass RFP response packages for Enterprise RFP Response";
const RFP_DRAFTING_AGENT_CONVERSATION_STARTERS = [
	"Draft the response package for the next Drafting ticket.",
	"Summarize blockers before this RFP can move to Review.",
	"Create reusable answer snippets from the attached RFP packet.",
];
const RFP_DRAFTING_TRIGGER_PROMPT = [
	"When a ticket enters Drafting, inspect the RFP packet, customer context, and required response sections.",
	"Draft the first-pass response package, flag blockers or missing inputs, attach the draft to the ticket, and move ready tickets to Review.",
].join(" ");
const RFP_DRAFTING_AGENT_AVATAR_SRC = "/avatar-agent-new/lime/feature-flag.svg";
const RFP_DRAFTING_BOARD_NAME = "Enterprise RFP Response";
const RFP_DRAFTING_COLUMN_NAME = "Drafting";
const RFP_REVIEW_COLUMN_NAME = "Review";
const RFP_DRAFTING_EVENT_TRIGGER_LABEL = "On event: ticket enters Drafting";
const AGENTS_RFP_DEMO_SURFACE = "agents-rfp-demo";
const AGENTS_RFP_DEMO_JOB_NAME = `${RFP_DRAFTING_AGENT_NAME} - Enterprise RFP Response`;
const AGENTS_RFP_DEMO_JOB_PROMPT = [
	"Process RFP tickets when they enter Drafting on the Enterprise RFP Response board.",
	"Use deterministic demo outputs, create a visible Rovo thread per ticket, attach the response draft, comment with completion status, move successful tickets to Review, and leave them unassigned.",
].join(" ");
const GENERATED_RFP_REPORT_ATTACHMENT_ID = "generated-rfp-response-strategy-pdf";
const RFP_TICKET_DRAFT_ATTACHMENT_KIND = "rfp-draft-html";
const DEMO_RUN_BASE_TIME = Date.parse("2026-06-03T15:00:00.000Z");
const DEMO_ACTIVITY_STEP_MS = 2 * 60_000;
const RFP_DRAFTING_PROCESSING_DELAYS_MS = [15_000, 24_000, 34_000, 19_000, 29_000];
const RFP_DRAFTING_NO_WORK_TOAST_MESSAGE = `${RFP_DRAFTING_AGENT_NAME} found no new Drafting tickets to process.`;
const REPORT_STAGES = new Set([
	"none",
	"generating",
	"generated",
	"refined",
	"approved",
	"pdf-exported",
	"attached",
]);

const RFP_DRAFTING_EVENT_TRIGGER = {
	type: "jira-column-entered",
	board: RFP_DRAFTING_BOARD_NAME,
	column: RFP_DRAFTING_COLUMN_NAME,
	label: RFP_DRAFTING_EVENT_TRIGGER_LABEL,
	prompt: RFP_DRAFTING_TRIGGER_PROMPT,
};

const BOARD_SEED = [
	{
		title: "RFP Intake",
		cardCodes: ["RFP-101", "RFP-102", "RFP-103", "RFP-104", "RFP-105", "RFP-106", "RFP-107"],
	},
	{
		title: RFP_DRAFTING_COLUMN_NAME,
		cardCodes: ["RFP-141", "RFP-142", "RFP-143"],
	},
	{
		title: RFP_REVIEW_COLUMN_NAME,
		cardCodes: ["RFP-161", "RFP-162", "RFP-163", "RFP-164"],
	},
	{
		title: "Submitted",
		cardCodes: ["RFP-181", "RFP-182"],
	},
];

const CLIENT_NAMES_BY_TICKET = {
	"RFP-101": "Acmecorp",
	"RFP-102": "Northstar Bank",
	"RFP-103": "Meridian Health",
	"RFP-104": "HelioWorks Energy",
	"RFP-105": "BluePeak Telecom",
	"RFP-106": "Redwood Retail Group",
	"RFP-107": "Summit Grove Insurance",
	"RFP-141": "Orion Motors",
	"RFP-142": "NimbusCare",
	"RFP-143": "Copperline Logistics",
	"RFP-161": "VertexRail",
	"RFP-162": "Greenfield BioSystems",
	"RFP-163": "HarborPoint Finance",
	"RFP-164": "Silverline Manufacturing",
	"RFP-181": "TidalWorks Utilities",
	"RFP-182": "Novacore University",
};

const WORK_ITEM_TITLES = {
	"RFP-101": `${CLIENT_NAMES_BY_TICKET["RFP-101"]}: Prepare for bid recommendation for ESM RFP`,
	"RFP-102": `${CLIENT_NAMES_BY_TICKET["RFP-102"]}: Parse supplier questionnaire and requested files`,
	"RFP-103": `${CLIENT_NAMES_BY_TICKET["RFP-103"]}: Build DACI and response-owner matrix`,
	"RFP-104": `${CLIENT_NAMES_BY_TICKET["RFP-104"]}: Inventory ITSM, asset, portal, and reporting requirements`,
	"RFP-105": `${CLIENT_NAMES_BY_TICKET["RFP-105"]}: Confirm bid/no-bid risks and mandatory gaps`,
	"RFP-106": `${CLIENT_NAMES_BY_TICKET["RFP-106"]}: Create RFP timeline with checkpoints and demos`,
	"RFP-107": `${CLIENT_NAMES_BY_TICKET["RFP-107"]}: Collect customer context, current tools, and success metrics`,
	"RFP-141": `${CLIENT_NAMES_BY_TICKET["RFP-141"]}: Draft Atlassian System of Work executive narrative`,
	"RFP-142": `${CLIENT_NAMES_BY_TICKET["RFP-142"]}: Write JSM service desk, portal, and knowledge answers`,
	"RFP-143": `${CLIENT_NAMES_BY_TICKET["RFP-143"]}: Prepare pricing, implementation, and TCO response`,
	"RFP-161": `${CLIENT_NAMES_BY_TICKET["RFP-161"]}: Review Assets, CMDB, HAM, and SAM positioning`,
	"RFP-162": `${CLIENT_NAMES_BY_TICKET["RFP-162"]}: Legal review for data residency, DPA, and terms`,
	"RFP-163": `${CLIENT_NAMES_BY_TICKET["RFP-163"]}: Security review for Guard, audit, GRC, and vulnerabilities`,
	"RFP-164": `${CLIENT_NAMES_BY_TICKET["RFP-164"]}: Executive review of win themes and final pitch`,
	"RFP-181": `${CLIENT_NAMES_BY_TICKET["RFP-181"]}: Submit supplier clarification responses`,
	"RFP-182": `${CLIENT_NAMES_BY_TICKET["RFP-182"]}: Archive final response, exhibits, and demo deck`,
};

const WORK_ITEM_DESCRIPTIONS = {
	"RFP-101": "Acmecorp is evaluating Atlassian as a replacement for its current service-management and work-management stack.\n\n• Consolidate regional IT, asset, knowledge, reporting, and business workflows.\n• Clarify CMDB and procurement requirements into must-haves, differentiators, and owners.\n• Map requirements to Atlassian strengths and flag product, legal, security, deal desk, or partner reviews.",
	"RFP-102": "Review the Northstar Bank supplier packet, procurement portal exports, and requested file list to identify every response artifact the team must produce if the opportunity qualifies. Split requirements into functional answers, legal or security exhibits, pricing files, implementation plans, customer-reference requests, and demo follow-ups.",
	"RFP-103": "Create a DACI-style ownership map for the Meridian Health RFP qualification and possible response across account leadership, proposal management, sales engineering, product specialists, legal, security, deal desk, support, and partner teams.",
	"RFP-104": "Inventory HelioWorks Energy requirement areas and translate them into response tracks covering ITSM, incident, problem, change, request, Assets and CMDB, asset management, knowledge, reporting, AI, data residency, legal compliance, implementation services, and pricing.",
	"RFP-105": "Run the BluePeak Telecom bid/no-bid risk assessment by checking mandatory requirements, certification asks, residency constraints, asset-management depth, migration timelines, pricing guardrails, reference requirements, and executive-demo readiness.",
	"RFP-106": "Build a Redwood Retail Group response calendar with supplier questions, internal draft checkpoints, qualification reviews, legal and security approvals, pricing sign-off, final executive review, submission packaging, and post-submission follow-ups.",
	"RFP-107": "Collect Summit Grove Insurance context for current tools, known pain points, business outcomes, executive priorities, implementation constraints, success metrics, user populations, regional differences, support model, and competitor strengths.",
	"RFP-141": "Draft the executive narrative for why Atlassian is the right platform for Orion Motors' enterprise work transformation if the RFP clears qualification. Connect Jira Service Management, Jira, Confluence, Assets, Rovo, Teamwork Graph, Guard, analytics, automation, and marketplace extensibility into one coherent system-of-work story.",
	"RFP-142": "Prepare the NimbusCare functional response for service desk, request management, portals, knowledge, and reporting. Include demo moments, configuration assumptions, known limitations, and reusable answer snippets the proposal team can paste into the formal response matrix.",
	"RFP-143": "Build the Copperline Logistics commercial and implementation response covering licensing assumptions, phased rollout options, implementation services, migration support, training, success planning, total cost of ownership, renewal considerations, and discount or approval dependencies.",
	"RFP-161": "Review the VertexRail Assets, CMDB, hardware asset, and software asset management positioning before the response goes to final review.",
	"RFP-162": "Review Greenfield BioSystems data residency, DPA, legal terms, procurement conditions, privacy requirements, and contract language for the response.",
	"RFP-163": "Review HarborPoint Finance security, Guard, audit logging, compliance, GRC, risk, and vulnerability-management answers.",
	"RFP-164": "Prepare the Silverline Manufacturing executive review package for the final pitch.",
	"RFP-181": "Package and submit the TidalWorks Utilities clarification responses that unblock the proposal team.",
	"RFP-182": "Archive the Novacore University final response package, exhibits, pricing files, demo deck, approved legal language, security artifacts, and reusable answer snippets.",
};

const HUMAN_ASSIGNEES_BY_TICKET = {
	"RFP-101": "Maya Chen",
	"RFP-102": "Jordan Lee",
	"RFP-103": "Priya Shah",
	"RFP-104": "Elena Ruiz",
	"RFP-105": "Maya Chen",
	"RFP-106": "Jordan Lee",
	"RFP-107": "Priya Shah",
	"RFP-141": "David Hsieh",
	"RFP-142": "Florence Garcia",
	"RFP-143": "Jordan Lee",
};

const TICKET_RESPONSE_FOCUS = {
	"RFP-101": "qualification strategy and bid posture",
	"RFP-102": "supplier questionnaire parsing and response artifact planning",
	"RFP-103": "DACI ownership and review routing",
	"RFP-104": "requirement inventory and response track staffing",
	"RFP-105": "bid risk mitigation and leadership decision support",
	"RFP-106": "response timeline checkpoints and approval buffers",
	"RFP-107": "customer context and reusable win themes",
	"RFP-141": "executive System of Work narrative",
	"RFP-142": "JSM service desk, portal, knowledge, and reporting answers",
	"RFP-143": "commercial, implementation, and TCO response",
};

const RFP_101_FIXTURE_ATTACHMENTS = [
	{
		id: "fixture-rfp-intake-notes",
		displayName: "RFP intake notes",
		ext: "page",
		source: "fixture",
	},
];

function cloneJson(value) {
	return structuredClone(value);
}

function isObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getNonEmptyString(value) {
	return typeof value === "string" && value.trim().length > 0
		? value.trim()
		: null;
}

function normalizeStringArray(value) {
	return Array.isArray(value)
		? value.filter((item) => typeof item === "string" && item.trim().length > 0)
		: [];
}

function normalizeConversationStarters(value) {
	const starters = normalizeStringArray(value);
	return starters.length > 0
		? starters
		: [...RFP_DRAFTING_AGENT_CONVERSATION_STARTERS];
}

function createThreadIdForTicket(ticketCode) {
	return `agents-rfp-demo-${ticketCode.toLowerCase()}`;
}

function createRunId() {
	return `rfp-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDemoTimestamp(index = 0) {
	return new Date(DEMO_RUN_BASE_TIME + index * DEMO_ACTIVITY_STEP_MS).toISOString();
}

function formatDemoTimestampLabel(index = 0) {
	return index === 0 ? "Jun 3, 2026, 10:00 AM" : `Jun 3, 2026, 10:${String(index * 2).padStart(2, "0")} AM`;
}

function createDefaultBoardState() {
	return {
		columns: BOARD_SEED.map((column) => ({
			title: column.title,
			cardCodes: [...column.cardCodes],
		})),
	};
}

function createDefaultWorkItemState(code, status) {
	return {
		status,
		attachments: code === "RFP-101" ? RFP_101_FIXTURE_ATTACHMENTS.map((attachment) => ({ ...attachment })) : [],
		agentAssignmentIds: [],
		assignee: null,
		previousAssignee: null,
		agentStatus: "idle",
		agentStartedAt: null,
		agentReadyAt: null,
		agentSessionThreadId: null,
		agentJobRunId: null,
		generatedAttachment: null,
		agentComment: null,
		attachmentComment: null,
		completedAt: null,
		lastError: null,
	};
}

function createDefaultWorkItems() {
	const workItems = {};
	for (const column of BOARD_SEED) {
		for (const cardCode of column.cardCodes) {
			workItems[cardCode] = createDefaultWorkItemState(cardCode, column.title);
		}
	}
	return workItems;
}

function createDefaultAgentsRfpDemoState() {
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

function normalizeAttachment(rawAttachment) {
	if (!isObject(rawAttachment)) {
		return null;
	}

	const id = getNonEmptyString(rawAttachment.id);
	const displayName = getNonEmptyString(rawAttachment.displayName);
	const ext = getNonEmptyString(rawAttachment.ext);
	const source = rawAttachment.source === "generated" || rawAttachment.source === "fixture"
		? rawAttachment.source
		: null;
	if (!id || !displayName || !ext || !source) {
		return null;
	}

	return {
		id,
		displayName,
		ext,
		source,
		approved: rawAttachment.approved === true,
		previewKind:
			rawAttachment.previewKind === "html-report" || rawAttachment.previewKind === "pdf-preview"
				? rawAttachment.previewKind
				: undefined,
		kind: getNonEmptyString(rawAttachment.kind),
		previewHtml: getNonEmptyString(rawAttachment.previewHtml),
	};
}

function normalizeAgentComment(rawComment) {
	if (!isObject(rawComment)) {
		return null;
	}

	const id = getNonEmptyString(rawComment.id);
	const content = getNonEmptyString(rawComment.content);
	if (!id || !content) {
		return null;
	}

	return {
		id,
		authorName: getNonEmptyString(rawComment.authorName) ?? RFP_DRAFTING_AGENT_NAME,
		authorAvatarSrc: getNonEmptyString(rawComment.authorAvatarSrc) ?? RFP_DRAFTING_AGENT_AVATAR_SRC,
		timestampLabel: getNonEmptyString(rawComment.timestampLabel) ?? "Jun 3, 2026, 10:00 AM",
		content,
	};
}

function normalizeAttachmentComment(rawComment) {
	if (!isObject(rawComment)) {
		return null;
	}

	const id = getNonEmptyString(rawComment.id);
	const content = getNonEmptyString(rawComment.content);
	const attachmentId = getNonEmptyString(rawComment.attachmentId);
	if (!id || !content || !attachmentId) {
		return null;
	}

	return {
		id,
		authorName: getNonEmptyString(rawComment.authorName) ?? "Maya Chen",
		authorAvatarSrc: getNonEmptyString(rawComment.authorAvatarSrc) ?? "/avatar-user/andrea-wilson/color/asow-service-yellow.png",
		timestampLabel: getNonEmptyString(rawComment.timestampLabel) ?? "Now",
		content,
		attachmentId,
		attachmentLabel: getNonEmptyString(rawComment.attachmentLabel) ?? "Open attachment in Rovo Canvas",
		attachmentHref: getNonEmptyString(rawComment.attachmentHref) ?? `#rovo-canvas-${attachmentId}`,
	};
}

function normalizeWorkItemState(rawWorkItem, code, fallbackStatus) {
	const base = createDefaultWorkItemState(code, fallbackStatus);
	if (!isObject(rawWorkItem)) {
		return base;
	}

	const agentStatus = ["idle", "queued", "running", "completed", "failed"].includes(rawWorkItem.agentStatus)
		? rawWorkItem.agentStatus
		: base.agentStatus;
	const attachments = Array.isArray(rawWorkItem.attachments)
		? rawWorkItem.attachments.map(normalizeAttachment).filter(Boolean)
		: base.attachments;

	return {
		...base,
		status: getNonEmptyString(rawWorkItem.status) ?? base.status,
		attachments,
		agentAssignmentIds: normalizeStringArray(rawWorkItem.agentAssignmentIds),
		assignee: getNonEmptyString(rawWorkItem.assignee),
		previousAssignee: getNonEmptyString(rawWorkItem.previousAssignee),
		agentStatus,
		agentStartedAt: getNonEmptyString(rawWorkItem.agentStartedAt),
		agentReadyAt: getNonEmptyString(rawWorkItem.agentReadyAt),
		agentSessionThreadId: getNonEmptyString(rawWorkItem.agentSessionThreadId),
		agentJobRunId: getNonEmptyString(rawWorkItem.agentJobRunId),
		generatedAttachment: normalizeAttachment(rawWorkItem.generatedAttachment),
		agentComment: normalizeAgentComment(rawWorkItem.agentComment),
		attachmentComment: normalizeAttachmentComment(rawWorkItem.attachmentComment),
		completedAt: getNonEmptyString(rawWorkItem.completedAt),
		lastError: getNonEmptyString(rawWorkItem.lastError),
	};
}

function normalizeBoard(rawBoard) {
	const defaultBoard = createDefaultBoardState();
	if (!isObject(rawBoard) || !Array.isArray(rawBoard.columns)) {
		return defaultBoard;
	}

	const columns = rawBoard.columns
		.map((column) => {
			if (!isObject(column)) {
				return null;
			}
			const title = getNonEmptyString(column.title);
			if (!title) {
				return null;
			}
			return {
				title,
				cardCodes: normalizeStringArray(column.cardCodes),
			};
		})
		.filter(Boolean);

	return columns.length > 0 ? { columns } : defaultBoard;
}

function createRfpDraftingEventTrigger(prompt = RFP_DRAFTING_TRIGGER_PROMPT) {
	return {
		...RFP_DRAFTING_EVENT_TRIGGER,
		prompt: getNonEmptyString(prompt) ?? RFP_DRAFTING_TRIGGER_PROMPT,
	};
}

function normalizeTrigger(rawTrigger) {
	if (rawTrigger === null) {
		return null;
	}
	if (!isObject(rawTrigger)) {
		return createRfpDraftingEventTrigger();
	}

	return {
		type: getNonEmptyString(rawTrigger.type) ?? RFP_DRAFTING_EVENT_TRIGGER.type,
		board: getNonEmptyString(rawTrigger.board) ?? RFP_DRAFTING_EVENT_TRIGGER.board,
		column: getNonEmptyString(rawTrigger.column) ?? RFP_DRAFTING_EVENT_TRIGGER.column,
		label: getNonEmptyString(rawTrigger.label) ?? RFP_DRAFTING_EVENT_TRIGGER.label,
		prompt: getNonEmptyString(rawTrigger.prompt),
	};
}

function normalizeJobRunSummary(rawRun) {
	if (!isObject(rawRun)) {
		return null;
	}

	const id = getNonEmptyString(rawRun.id);
	if (!id) {
		return null;
	}

	const status = ["completed", "completed-with-failures", "failed", "running", "skipped"].includes(rawRun.status)
		? rawRun.status
		: "completed";

	return {
		id,
		jobId: getNonEmptyString(rawRun.jobId),
		source: getNonEmptyString(rawRun.source) ?? "manual",
		triggerLabel: getNonEmptyString(rawRun.triggerLabel) ?? RFP_DRAFTING_EVENT_TRIGGER_LABEL,
		status,
		startedAt: getNonEmptyString(rawRun.startedAt) ?? formatDemoTimestamp(0),
		finishedAt: getNonEmptyString(rawRun.finishedAt),
		processedTicketCodes: normalizeStringArray(rawRun.processedTicketCodes),
		skippedTicketCodes: normalizeStringArray(rawRun.skippedTicketCodes),
		failedTicketCodes: normalizeStringArray(rawRun.failedTicketCodes),
		threadLinks: Array.isArray(rawRun.threadLinks)
			? rawRun.threadLinks
					.map((link) => {
						if (!isObject(link)) {
							return null;
						}
						const ticketCode = getNonEmptyString(link.ticketCode);
						const threadId = getNonEmptyString(link.threadId);
						if (!ticketCode || !threadId) {
							return null;
						}
						return { ticketCode, threadId };
					})
					.filter(Boolean)
			: [],
		summary: getNonEmptyString(rawRun.summary) ?? "",
	};
}

function repairRunningEventRunTimeline(jobRunSummaries) {
	let latestSettledTimestamp = Math.max(
		DEMO_RUN_BASE_TIME - DEMO_ACTIVITY_STEP_MS,
		...jobRunSummaries
			.filter((runSummary) => runSummary.status !== "running")
			.map(getRunTimelineTimestampMs)
			.filter((timestamp) => Number.isFinite(timestamp)),
	);

	return jobRunSummaries.map((runSummary) => {
		const runTimestamp = getRunTimelineTimestampMs(runSummary);
		if (
			runSummary.status === "running" &&
			runSummary.source === "jira-column-entered" &&
			Number.isFinite(runTimestamp) &&
			runTimestamp <= latestSettledTimestamp
		) {
			latestSettledTimestamp += DEMO_ACTIVITY_STEP_MS;
			return {
				...runSummary,
				startedAt: new Date(latestSettledTimestamp).toISOString(),
			};
		}

		if (Number.isFinite(runTimestamp)) {
			latestSettledTimestamp = Math.max(latestSettledTimestamp, runTimestamp);
		}

		return runSummary;
	});
}

function normalizeAgent(rawAgent) {
	if (!isObject(rawAgent)) {
		return null;
	}

	const jobRunSummaries = Array.isArray(rawAgent.jobRunSummaries)
		? repairRunningEventRunTimeline(rawAgent.jobRunSummaries.map(normalizeJobRunSummary).filter(Boolean))
		: [];

	return {
		id: RFP_DRAFTING_AGENT_ID,
		name: RFP_DRAFTING_AGENT_NAME,
		description: getNonEmptyString(rawAgent.description) ?? RFP_DRAFTING_AGENT_DESCRIPTION,
		conversationStarters: normalizeConversationStarters(rawAgent.conversationStarters),
		selected: rawAgent.selected !== false,
		assignedColumn: RFP_DRAFTING_COLUMN_NAME,
		createdAt: getNonEmptyString(rawAgent.createdAt) ?? "Jun 3, 2026, 10:00 AM",
		avatarSrc: getNonEmptyString(rawAgent.avatarSrc) ?? RFP_DRAFTING_AGENT_AVATAR_SRC,
		jobId: getNonEmptyString(rawAgent.jobId),
		trigger: normalizeTrigger(rawAgent.trigger),
		jobRunSummaries,
	};
}

function normalizeToasts(rawToasts) {
	if (!Array.isArray(rawToasts)) {
		return [];
	}

	return rawToasts
		.map((rawToast) => {
			if (!isObject(rawToast)) {
				return null;
			}

			const id = getNonEmptyString(rawToast.id);
			const message = getNonEmptyString(rawToast.message);
			if (!id || !message || message === RFP_DRAFTING_NO_WORK_TOAST_MESSAGE) {
				return null;
			}

			return { id, message };
		})
		.filter(Boolean);
}

function normalizeReportVersion(rawVersion) {
	if (!isObject(rawVersion)) {
		return null;
	}

	const id = getNonEmptyString(rawVersion.id);
	const label = getNonEmptyString(rawVersion.label);
	if (!id || !label) {
		return null;
	}

	return {
		id,
		label,
		summary: getNonEmptyString(rawVersion.summary) ?? label,
		createdBy: rawVersion.createdBy === "Maya" ? "Maya" : "Rovo",
		timestampLabel: getNonEmptyString(rawVersion.timestampLabel) ?? "Now",
	};
}

function normalizeReport(rawReport, defaultReport) {
	if (!isObject(rawReport)) {
		return defaultReport;
	}

	const versions = Array.isArray(rawReport.versions)
		? rawReport.versions.map(normalizeReportVersion).filter(Boolean)
		: [];
	const currentVersionId = getNonEmptyString(rawReport.currentVersionId);
	const selectedVersionId = currentVersionId &&
		versions.some((version) => version.id === currentVersionId)
		? currentVersionId
		: null;
	const previewHtml = getNonEmptyString(rawReport.previewHtml);

	return {
		...defaultReport,
		stage: REPORT_STAGES.has(rawReport.stage) ? rawReport.stage : defaultReport.stage,
		versions,
		...(selectedVersionId ? { currentVersionId: selectedVersionId } : {}),
		...(previewHtml ? { previewHtml } : {}),
	};
}

function getReviewPromotionTimestamp(workItem) {
	const completedAtMs = Date.parse(workItem?.completedAt);
	if (Number.isFinite(completedAtMs)) {
		return completedAtMs;
	}

	const agentStartedAtMs = Date.parse(workItem?.agentStartedAt);
	return Number.isFinite(agentStartedAtMs) ? agentStartedAtMs : 0;
}

function shouldPromoteCompletedReviewTicket(workItem) {
	return (
		workItem?.status === RFP_REVIEW_COLUMN_NAME &&
		workItem.agentStatus === "completed" &&
		!workItem.assignee
	);
}

function normalizeReviewColumnOrder(board, workItems) {
	return {
		columns: board.columns.map((column) => {
			if (column.title !== RFP_REVIEW_COLUMN_NAME) {
				return column;
			}

			const indexedCodes = column.cardCodes.map((code, index) => ({ code, index }));
			const promotedCodes = indexedCodes
				.filter(({ code }) => shouldPromoteCompletedReviewTicket(workItems[code]))
				.sort((left, right) => {
					const timestampDelta =
						getReviewPromotionTimestamp(workItems[right.code]) -
						getReviewPromotionTimestamp(workItems[left.code]);
					return timestampDelta === 0 ? left.index - right.index : timestampDelta;
				})
				.map(({ code }) => code);
			const promotedCodeSet = new Set(promotedCodes);

			return {
				...column,
				cardCodes: [
					...promotedCodes,
					...column.cardCodes.filter((code) => !promotedCodeSet.has(code)),
				],
			};
		}),
	};
}

function normalizeAgentsRfpDemoState(rawState) {
	const defaultState = createDefaultAgentsRfpDemoState();
	if (!isObject(rawState) || rawState.version !== AGENTS_RFP_DEMO_VERSION) {
		return defaultState;
	}

	const board = normalizeBoard(rawState.board);
	const defaultStatuses = new Map(
		board.columns.flatMap((column) => column.cardCodes.map((code) => [code, column.title])),
	);
	const workItems = {};
	for (const code of new Set([...Object.keys(defaultState.workItems), ...defaultStatuses.keys(), ...Object.keys(isObject(rawState.workItems) ? rawState.workItems : {})])) {
		workItems[code] = normalizeWorkItemState(
			isObject(rawState.workItems) ? rawState.workItems[code] : null,
			code,
			defaultStatuses.get(code) ?? defaultState.workItems[code]?.status ?? "RFP Intake",
		);
	}
	const normalizedBoard = normalizeReviewColumnOrder(board, workItems);

	return {
		...defaultState,
		board: normalizedBoard,
		workItems,
		report: normalizeReport(rawState.report, defaultState.report),
		agent: normalizeAgent(rawState.agent),
		schedule: null,
		customAgentActivity: Array.isArray(rawState.customAgentActivity) ? rawState.customAgentActivity : [],
		canvas: isObject(rawState.canvas) ? { ...defaultState.canvas, ...rawState.canvas } : defaultState.canvas,
		chat: isObject(rawState.chat)
			? {
					...defaultState.chat,
					...rawState.chat,
					selectedRfpKnowledge: getNonEmptyString(rawState.chat.selectedRfpKnowledge),
				}
			: defaultState.chat,
		toasts: normalizeToasts(rawState.toasts),
	};
}

function appendUniqueActivity(state, item) {
	if (state.customAgentActivity.some((activity) => activity.id === item.id)) {
		return state;
	}

	return {
		...state,
		customAgentActivity: [...state.customAgentActivity, item],
	};
}

function appendToast(state, message, id) {
	return {
		...state,
		toasts: [
			...state.toasts.filter((toast) => toast.id !== id),
			{ id, message },
		].slice(-3),
	};
}

function ensureRfpDraftingAgent(state, { jobId, createdAtLabel = "Jun 3, 2026, 10:00 AM" } = {}) {
	const agent = normalizeAgent({
		...(state.agent ?? {}),
		id: RFP_DRAFTING_AGENT_ID,
		name: RFP_DRAFTING_AGENT_NAME,
		selected: true,
		assignedColumn: RFP_DRAFTING_COLUMN_NAME,
		createdAt: state.agent?.createdAt ?? createdAtLabel,
		avatarSrc: state.agent?.avatarSrc ?? RFP_DRAFTING_AGENT_AVATAR_SRC,
		jobId: jobId ?? state.agent?.jobId,
		trigger: createRfpDraftingEventTrigger(state.agent?.trigger?.prompt),
		jobRunSummaries: state.agent?.jobRunSummaries ?? [],
	});
	const nextState = {
		...state,
		agent,
		schedule: null,
		chat: {
			...state.chat,
			selectedAgentId: RFP_DRAFTING_AGENT_ID,
		},
	};

	return appendUniqueActivity(appendUniqueActivity(nextState, {
		id: "activity-agent-created",
		timestampLabel: createdAtLabel,
		message: `Rovo created ${RFP_DRAFTING_AGENT_NAME}.`,
		type: "agent-created",
	}), {
		id: "activity-workflow-assigned",
		timestampLabel: createdAtLabel,
		message: `Rovo assigned ${RFP_DRAFTING_AGENT_NAME} to the Drafting column event.`,
		type: "workflow-assigned",
	});
}

function findColumnForTicket(state, ticketCode) {
	return state.board.columns.find((column) => column.cardCodes.includes(ticketCode)) ?? null;
}

function moveTicketToColumn(state, ticketCode, targetColumnTitle, { append = false } = {}) {
	const targetColumn = state.board.columns.find((column) => column.title === targetColumnTitle);
	if (!targetColumn) {
		return state;
	}

	const columns = state.board.columns.map((column) => {
		const filteredCodes = column.cardCodes.filter((code) => code !== ticketCode);
		if (column.title !== targetColumnTitle) {
			return {
				...column,
				cardCodes: filteredCodes,
			};
		}

		return {
			...column,
			cardCodes: append
				? [...filteredCodes, ticketCode]
				: [ticketCode, ...filteredCodes],
		};
	});

	return {
		...state,
		board: { columns },
		workItems: {
			...state.workItems,
			[ticketCode]: {
				...(state.workItems[ticketCode] ?? createDefaultWorkItemState(ticketCode, targetColumnTitle)),
				status: targetColumnTitle,
			},
		},
	};
}

function isCompletedByAgent(workItem) {
	return (
		workItem?.agentStatus === "completed" &&
		Boolean(workItem.generatedAttachment) &&
		Boolean(workItem.agentComment)
	);
}

function getCurrentDraftingTicketCodes(state) {
	return state.board.columns.find((column) => column.title === RFP_DRAFTING_COLUMN_NAME)?.cardCodes ?? [];
}

function getHumanAssigneeForTicket(ticketCode) {
	return HUMAN_ASSIGNEES_BY_TICKET[ticketCode] ?? "Maya Chen";
}

function getClientNameForTicket(ticketCode) {
	return CLIENT_NAMES_BY_TICKET[ticketCode] ?? "the client";
}

function getProcessingDelayMs(index) {
	return RFP_DRAFTING_PROCESSING_DELAYS_MS[index % RFP_DRAFTING_PROCESSING_DELAYS_MS.length];
}

function getRunTimelineTimestampMs(runSummary) {
	const finishedAtMs = Date.parse(runSummary?.finishedAt);
	if (Number.isFinite(finishedAtMs)) {
		return finishedAtMs;
	}

	const startedAtMs = Date.parse(runSummary?.startedAt);
	return Number.isFinite(startedAtMs) ? startedAtMs : null;
}

function getNextRunTimelineTimestamp(state) {
	const timestamps = (state.agent?.jobRunSummaries ?? [])
		.map(getRunTimelineTimestampMs)
		.filter((timestamp) => Number.isFinite(timestamp));

	if (timestamps.length === 0) {
		return formatDemoTimestamp(0);
	}

	return new Date(Math.max(...timestamps) + DEMO_ACTIVITY_STEP_MS).toISOString();
}

function getRunCompletionTimestamp(runSummary) {
	const startedAtMs = Date.parse(runSummary?.startedAt);
	if (!Number.isFinite(startedAtMs)) {
		return runSummary?.finishedAt ?? formatDemoTimestamp(runSummary?.processedTicketCodes?.length ?? 0);
	}

	return new Date(startedAtMs + (runSummary.processedTicketCodes.length + 1) * DEMO_ACTIVITY_STEP_MS).toISOString();
}

function getTicketCompletionTimestamp(state, ticketCode, workItem, fallbackIndex) {
	const runSummary = state.agent?.jobRunSummaries?.find((run) => run.id === workItem.agentJobRunId);
	if (!runSummary) {
		return formatDemoTimestamp(fallbackIndex + 1);
	}

	const processedIndex = runSummary.processedTicketCodes.indexOf(ticketCode);
	const completionIndex = processedIndex >= 0 ? processedIndex + 1 : fallbackIndex + 1;
	const startedAtMs = Date.parse(runSummary.startedAt);
	if (!Number.isFinite(startedAtMs)) {
		return formatDemoTimestamp(completionIndex);
	}

	return new Date(startedAtMs + completionIndex * DEMO_ACTIVITY_STEP_MS).toISOString();
}

function createGeneratedAttachment(ticketCode, previewHtml) {
	return {
		id: `generated-${ticketCode.toLowerCase()}-response-draft-html`,
		displayName: `${ticketCode} response draft.html`,
		ext: "html",
		source: "generated",
		approved: true,
		previewKind: "html-report",
		kind: RFP_TICKET_DRAFT_ATTACHMENT_KIND,
		previewHtml: getNonEmptyString(previewHtml),
	};
}

function createAgentComment(ticketCode, ticketTitle, index) {
	const focus = TICKET_RESPONSE_FOCUS[ticketCode] ?? "RFP response drafting";
	return {
		id: `agent-comment-${ticketCode.toLowerCase()}-draft-ready`,
		authorName: RFP_DRAFTING_AGENT_NAME,
		authorAvatarSrc: RFP_DRAFTING_AGENT_AVATAR_SRC,
		timestampLabel: formatDemoTimestampLabel(index),
		content: `${RFP_DRAFTING_AGENT_NAME} finished the first-pass HTML response for ${ticketCode} (${ticketTitle}). Status: draft complete. I focused on ${focus}, attached the vpk-html artifact, moved the ticket to Review, and left it unassigned for the response team to pick up.`,
	};
}

function buildActiveJiraWorkItemContextForTicket(ticketCode, status = RFP_DRAFTING_COLUMN_NAME) {
	const ticketTitle = WORK_ITEM_TITLES[ticketCode] ?? ticketCode;
	const assignee = getHumanAssigneeForTicket(ticketCode);
	const clientName = getClientNameForTicket(ticketCode);
	const description = WORK_ITEM_DESCRIPTIONS[ticketCode] ?? `Prepare a first-pass RFP response draft for ${ticketCode}.`;
	const focus = TICKET_RESPONSE_FOCUS[ticketCode] ?? "RFP response drafting";

	return [
		"[Active Jira Work Item Context]",
		"Source: /jira Jira work item.",
		`Key: ${ticketCode}`,
		`Title: ${ticketTitle}`,
		`Status: ${status}`,
		"Priority: High",
		`Assignee: ${assignee} (Proposal response owner)`,
		"Reporter: Jordan Lee (Account executive)",
		"Parent: RFP-100 - Enterprise RFP Response",
		`Customer: ${clientName}`,
		`Opportunity: ${clientName} enterprise service-management transformation`,
		"Procurement stage: RFP qualification and draft response package",
		"Response due date: Jun 8, 2026",
		"Deal size: multi-thousand users; budget qualification pending",
		`Description: ${description}`,
		"Buyer priorities:",
		`- ${clientName} wants to reduce tool sprawl across IT, service, and business teams.`,
		`- ${clientName} wants better service delivery visibility for executives.`,
		`- ${clientName} needs a practical migration path with governed AI assistance.`,
		"Win themes:",
		"- Atlassian System of Work connects service, software, knowledge, and business teams.",
		"- Teamwork Graph and Rovo make response knowledge reusable and contextual.",
		"- Jira Service Management, Assets, Confluence, Guard, and automation create a governed operating model.",
		"Known risks:",
		`- ${clientName} legal, security, and deal desk language still needs final human review.`,
		`- ${clientName} commercial assumptions must not overstate approved pricing or implementation commitments.`,
		"Next actions:",
		`- Draft ${focus} for the ${clientName} qualification and response handoff.`,
		`- Attach the generated ${clientName} response for proposal review.`,
		"- Move the ticket to Review and leave it unassigned for a human reviewer to pick up.",
		"Attachments:",
		`- ${clientName} Enterprise RFP packet.pdf (15 May 2026, 11:05 AM)`,
		"- Compliance matrix.xlsx (12 May 2026, 09:24 AM)",
		"Recent activity:",
		`- Jun 3, 2026, 09:58 AM: ${assignee} - Ready for agent-assisted ${clientName} first-pass drafting.`,
		"[End Active Jira Work Item Context]",
	].join("\n");
}

function buildTicketSpecificReportFields(ticketCode) {
	const ticketTitle = WORK_ITEM_TITLES[ticketCode] ?? ticketCode;
	const clientName = getClientNameForTicket(ticketCode);
	const focus = TICKET_RESPONSE_FOCUS[ticketCode] ?? "RFP response drafting";

	return {
		summary: `${ticketCode} ${clientName} draft response for ${focus}.`,
		whatChangedText: `${RFP_DRAFTING_AGENT_NAME} converted ${ticketTitle} into a reviewable ${clientName} response draft focused on ${focus}.`,
		confidenceText: "Medium confidence: the work item has enough context for a first-pass response, while legal, security, commercial, and product commitments remain marked for human review.",
		progressText: `A vpk-html draft artifact has been prepared for the ${clientName} response team with reusable Atlassian System of Work language and ticket-specific next actions.`,
		blockersText: `Final approval still depends on human validation of legal language, commercial assumptions, and ${clientName}-specific implementation commitments.`,
		nextWindowText: `The response team should pick up the unassigned Review ticket, inspect the attached HTML draft, tighten any ${clientName}-specific claims, and either approve the response text or route gaps to the appropriate specialist.`,
		milestonesText: "Drafting is complete for agent handoff; Review is the next workflow milestone before final proposal packaging.",
		informationGaps: [
			"Final approved pricing and legal exceptions are not recorded in the Work Item context.",
			`${clientName}-specific evidence exhibits still need human verification before submission.`,
		],
	};
}

function buildFallbackHtmlReport(ticketCode) {
	const title = `${ticketCode} response draft`;
	const clientName = getClientNameForTicket(ticketCode);
	const focus = TICKET_RESPONSE_FOCUS[ticketCode] ?? "RFP response drafting";
	return [
		"<!doctype html>",
		'<html lang="en">',
		"<head>",
		'\t<meta charset="utf-8">',
		'\t<meta name="generator" content="vpk-html">',
		`\t<title>${title}</title>`,
		"</head>",
		"<body>",
		`\t<h1>${title}</h1>`,
		`\t<p>Deterministic vpk-html draft for ${clientName}, focused on ${focus}.</p>`,
		"</body>",
		"</html>",
	].join("\n");
}

function buildThreadMessagesForTicket({ attachmentName, focus, runId, status = "completed", ticketCode, ticketTitle, timestamp }) {
	const resultText = status === "running"
		? [
				`Started deterministic RFP drafting for ${ticketCode}.`,
				`Focus: ${focus}.`,
				"Status: the agent is reading the work item, gathering reusable Teamwork Graph context, and preparing a vpk-html response artifact.",
			].join("\n")
		: [
				`Prepared deterministic RFP draft output for ${ticketCode}.`,
				`Attachment: ${attachmentName}.`,
				`Focus: ${focus}.`,
				"Summary: mapped the ticket to Atlassian System of Work win themes, reusable answer language, review notes, and implementation assumptions.",
				"Next step: review the generated HTML draft in Jira before final submission.",
			].join("\n");

	return [
		{
			id: `${ticketCode.toLowerCase()}-draft-request`,
			role: "user",
			parts: [
				{
					type: "text",
					text: `Event received: ${ticketCode} entered Drafting on the ${RFP_DRAFTING_BOARD_NAME} board. Draft the response package for "${ticketTitle}".`,
				},
			],
			metadata: {
				source: AGENTS_RFP_DEMO_SURFACE,
				runId,
			},
			createdAt: timestamp,
		},
		{
			id: status === "running" ? `${ticketCode.toLowerCase()}-draft-started` : `${ticketCode.toLowerCase()}-draft-result`,
			role: "assistant",
			parts: [
				{
					type: "text",
					text: resultText,
				},
			],
			metadata: {
				source: AGENTS_RFP_DEMO_SURFACE,
				runId,
			},
			createdAt: timestamp,
		},
	];
}

function buildThreadForTicket({ attachmentName, status = "completed", ticketCode, runId, timestamp }) {
	const ticketTitle = WORK_ITEM_TITLES[ticketCode] ?? ticketCode;
	const threadId = createThreadIdForTicket(ticketCode);
	const focus = TICKET_RESPONSE_FOCUS[ticketCode] ?? "RFP response drafting";

	return {
		id: threadId,
		title: `${ticketCode} RFP draft response`,
		messages: buildThreadMessagesForTicket({
			attachmentName: attachmentName ?? `${ticketCode} response draft.html`,
			focus,
			status,
			ticketCode,
			ticketTitle,
			runId,
			timestamp,
		}),
		realtimeMessages: [],
		visibility: "private",
		modelId: null,
		provider: "agents-rfp-demo",
		createdAt: timestamp,
		updatedAt: timestamp,
	};
}

function buildFailureThreadForTicket({ ticketCode, runId, timestamp }) {
	const ticketTitle = WORK_ITEM_TITLES[ticketCode] ?? ticketCode;
	const threadId = createThreadIdForTicket(ticketCode);

	return {
		id: threadId,
		title: `${ticketCode} RFP draft response`,
		messages: [
			{
				id: `${ticketCode.toLowerCase()}-draft-request`,
				role: "user",
				parts: [
					{
						type: "text",
						text: `Event received: ${ticketCode} entered Drafting on the ${RFP_DRAFTING_BOARD_NAME} board. Draft the response package for "${ticketTitle}".`,
					},
				],
				metadata: {
					source: AGENTS_RFP_DEMO_SURFACE,
					runId,
				},
				createdAt: timestamp,
			},
			{
				id: `${ticketCode.toLowerCase()}-draft-failed`,
				role: "assistant",
				parts: [
					{
						type: "text",
						text: `The deterministic demo run failed while preparing ${ticketCode}. The ticket stayed in Drafting and can be retried by rerunning the event job.`,
					},
				],
				metadata: {
					source: AGENTS_RFP_DEMO_SURFACE,
					runId,
				},
				createdAt: timestamp,
			},
		],
		realtimeMessages: [],
		visibility: "private",
		modelId: null,
		provider: "agents-rfp-demo",
		createdAt: timestamp,
		updatedAt: timestamp,
	};
}

function buildRunSummary({
	failedTicketCodes,
	finishedAt,
	jobId,
	processedTicketCodes,
	runId,
	skippedTicketCodes,
	source,
	startedAt,
	status: statusOverride,
	threadLinks,
}) {
	const status = statusOverride ?? (failedTicketCodes.length > 0
		? processedTicketCodes.length > 0
			? "completed-with-failures"
			: "failed"
		: processedTicketCodes.length > 0
			? "completed"
			: "skipped");
	const action = status === "running" ? "Queued" : "Processed";
	const summary = [
		`${action} ${processedTicketCodes.length} ticket${processedTicketCodes.length === 1 ? "" : "s"}`,
		`skipped ${skippedTicketCodes.length}`,
		`failed ${failedTicketCodes.length}`,
	].join(", ");

	return {
		id: runId,
		jobId,
		source,
		triggerLabel: RFP_DRAFTING_EVENT_TRIGGER_LABEL,
		status,
		startedAt,
		finishedAt,
		processedTicketCodes,
		skippedTicketCodes,
		failedTicketCodes,
		threadLinks,
		summary: `${summary}.`,
	};
}

function runRfpDraftingAgent(state, {
	failTicketCodes = [],
	jobId = state.agent?.jobId ?? null,
	now = Date.now(),
	runId = createRunId(),
	source = "manual",
	ticketCodes,
} = {}) {
	let nextState = ensureRfpDraftingAgent(state, { jobId });
	const failSet = new Set(failTicketCodes);
	const startedAtIso = new Date(now).toISOString();
	const requestedTicketCodes = Array.isArray(ticketCodes) && ticketCodes.length > 0
		? ticketCodes
		: getCurrentDraftingTicketCodes(nextState);
	const completedTicketCodes = Object.entries(nextState.workItems)
		.filter(([, workItem]) => isCompletedByAgent(workItem))
		.map(([ticketCode]) => ticketCode);
	const ticketCodesToEvaluate = Array.from(new Set(
		Array.isArray(ticketCodes) && ticketCodes.length > 0
			? requestedTicketCodes
			: [...requestedTicketCodes, ...completedTicketCodes],
	));
	const processedTicketCodes = [];
	const skippedTicketCodes = [];
	const failedTicketCodes = [];
	const threadLinks = [];
	const threadRecords = [];
	const startedAt = getNextRunTimelineTimestamp(nextState);
	const startedAtMs = Date.parse(startedAt);

	for (const [index, ticketCode] of ticketCodesToEvaluate.entries()) {
		const currentWorkItem = nextState.workItems[ticketCode] ?? createDefaultWorkItemState(ticketCode, findColumnForTicket(nextState, ticketCode)?.title ?? RFP_DRAFTING_COLUMN_NAME);
		const isRequested = requestedTicketCodes.includes(ticketCode);
		if (isCompletedByAgent(currentWorkItem)) {
			skippedTicketCodes.push(ticketCode);
			continue;
		}
		if (currentWorkItem.agentStatus === "running" || currentWorkItem.agentStatus === "queued") {
			skippedTicketCodes.push(ticketCode);
			continue;
		}
		if (!isRequested || currentWorkItem.status !== RFP_DRAFTING_COLUMN_NAME) {
			continue;
		}

		const threadId = currentWorkItem.agentSessionThreadId ?? createThreadIdForTicket(ticketCode);
		const runningWorkItem = {
			...currentWorkItem,
			previousAssignee: currentWorkItem.previousAssignee ?? currentWorkItem.assignee ?? getHumanAssigneeForTicket(ticketCode),
			assignee: RFP_DRAFTING_AGENT_NAME,
			agentAssignmentIds: Array.from(new Set([...currentWorkItem.agentAssignmentIds, RFP_DRAFTING_AGENT_ID])),
			agentStatus: index === 0 ? "running" : "queued",
			agentStartedAt: currentWorkItem.agentStartedAt ?? startedAtIso,
			agentReadyAt: new Date(now + getProcessingDelayMs(index)).toISOString(),
			agentSessionThreadId: threadId,
			agentJobRunId: runId,
			lastError: null,
		};

		if (failSet.has(ticketCode)) {
			const failedAt = Number.isFinite(startedAtMs)
				? new Date(startedAtMs + (index + 1) * DEMO_ACTIVITY_STEP_MS).toISOString()
				: formatDemoTimestamp(index + 1);
			nextState = {
				...nextState,
				workItems: {
					...nextState.workItems,
					[ticketCode]: {
						...runningWorkItem,
						agentStatus: "failed",
						agentReadyAt: null,
						lastError: `Deterministic demo failure for ${ticketCode}.`,
					},
				},
			};
			failedTicketCodes.push(ticketCode);
			threadLinks.push({ ticketCode, threadId });
			threadRecords.push({
				...buildFailureThreadForTicket({ ticketCode, runId, timestamp: failedAt }),
				id: threadId,
			});
			continue;
		}

		nextState = {
			...nextState,
			workItems: {
				...nextState.workItems,
				[ticketCode]: {
					...runningWorkItem,
				},
			},
		};
		processedTicketCodes.push(ticketCode);
		threadLinks.push({ ticketCode, threadId });
		threadRecords.push({
			...buildThreadForTicket({ status: "running", ticketCode, runId, timestamp: startedAtIso }),
			id: threadId,
		});
	}

	const hasRunningTickets = processedTicketCodes.some((ticketCode) => (
		nextState.workItems[ticketCode]?.agentStatus === "running" ||
		nextState.workItems[ticketCode]?.agentStatus === "queued"
	));
	const finishedAt = hasRunningTickets
		? null
		: Number.isFinite(startedAtMs)
			? new Date(startedAtMs + (ticketCodesToEvaluate.length + 1) * DEMO_ACTIVITY_STEP_MS).toISOString()
			: formatDemoTimestamp(ticketCodesToEvaluate.length + 1);
	const runSummary = buildRunSummary({
		failedTicketCodes,
		finishedAt,
		jobId,
		processedTicketCodes,
		runId,
		skippedTicketCodes,
		source,
		startedAt,
		status: hasRunningTickets ? "running" : undefined,
		threadLinks,
	});
	const agent = normalizeAgent({
		...nextState.agent,
		jobId,
		jobRunSummaries: [runSummary, ...(nextState.agent?.jobRunSummaries ?? [])].slice(0, 10),
	});
	nextState = {
		...nextState,
		agent,
	};

	if (runSummary.status !== "skipped") {
		const toastMessage = runSummary.status === "running"
			? `${RFP_DRAFTING_AGENT_NAME} queued ${processedTicketCodes.length} Drafting ticket${processedTicketCodes.length === 1 ? "" : "s"}.`
			: `${RFP_DRAFTING_AGENT_NAME} ${runSummary.summary}`;
		nextState = appendToast(nextState, toastMessage, `rfp-agent-run-${runId}`);
	}

	return {
		state: nextState,
		runSummary,
		threadRecords,
	};
}

function getDueAgentWorkItems(state, now) {
	const nowMs = typeof now === "number" ? now : Date.parse(now);
	if (!Number.isFinite(nowMs)) {
		return [];
	}

	return Object.entries(state.workItems ?? {})
		.filter(([, workItem]) => (
			(workItem?.agentStatus === "running" || workItem?.agentStatus === "queued") &&
			getNonEmptyString(workItem.agentReadyAt) &&
			Date.parse(workItem.agentReadyAt) <= nowMs &&
			workItem.status === RFP_DRAFTING_COLUMN_NAME
		))
		.map(([ticketCode, workItem]) => ({ ticketCode, workItem }));
}

function getRunSummaryFinishedAt(state, runSummary) {
	return getRunCompletionTimestamp(runSummary) ?? runSummary.startedAt;
}

function refreshRunSummaries(state) {
	if (!state.agent?.jobRunSummaries?.length) {
		return state;
	}

	let changed = false;
	const jobRunSummaries = state.agent.jobRunSummaries.map((runSummary) => {
		if (runSummary.status !== "running" || runSummary.processedTicketCodes.length === 0) {
			return runSummary;
		}

		const processedWorkItems = runSummary.processedTicketCodes
			.map((ticketCode) => state.workItems[ticketCode])
			.filter(Boolean);
		const allSettled = processedWorkItems.length > 0 && processedWorkItems.every((workItem) => (
			workItem.agentStatus === "completed" || workItem.agentStatus === "failed"
		));
		if (!allSettled) {
			return runSummary;
		}

		const failedTicketCodes = Array.from(new Set([
			...runSummary.failedTicketCodes,
			...runSummary.processedTicketCodes.filter((ticketCode) => state.workItems[ticketCode]?.agentStatus === "failed"),
		]));
		const status = failedTicketCodes.length > 0
			? runSummary.processedTicketCodes.some((ticketCode) => state.workItems[ticketCode]?.agentStatus === "completed")
				? "completed-with-failures"
				: "failed"
			: "completed";
		changed = true;
		return {
			...runSummary,
			status,
			failedTicketCodes,
			finishedAt: getRunSummaryFinishedAt(state, runSummary),
			summary: [
				`Processed ${runSummary.processedTicketCodes.length} ticket${runSummary.processedTicketCodes.length === 1 ? "" : "s"}`,
				`skipped ${runSummary.skippedTicketCodes.length}`,
				`failed ${failedTicketCodes.length}`,
			].join(", ") + ".",
		};
	});

	if (!changed) {
		return state;
	}

	return {
		...state,
		agent: normalizeAgent({
			...state.agent,
			jobRunSummaries,
		}),
	};
}

async function advanceRfpDraftingAgentProcessing(state, {
	createHtmlReport,
	now = Date.now(),
} = {}) {
	let nextState = normalizeAgentsRfpDemoState(state);
	const dueItems = getDueAgentWorkItems(nextState, now);
	const completedTicketCodes = [];
	const failedTicketCodes = [];
	const threadRecords = [];

	for (const [index, { ticketCode, workItem }] of dueItems.entries()) {
		const ticketTitle = WORK_ITEM_TITLES[ticketCode] ?? ticketCode;
		const threadId = workItem.agentSessionThreadId ?? createThreadIdForTicket(ticketCode);
		const completedAt = getTicketCompletionTimestamp(nextState, ticketCode, workItem, index);

		try {
			const contextDescription = buildActiveJiraWorkItemContextForTicket(ticketCode, workItem.status);
			const report = typeof createHtmlReport === "function"
				? await createHtmlReport({
						contextDescription,
						fields: buildTicketSpecificReportFields(ticketCode),
						ticketCode,
						ticketTitle,
					})
				: { html: buildFallbackHtmlReport(ticketCode) };
			const generatedAttachment = createGeneratedAttachment(ticketCode, report?.html);
			const agentComment = createAgentComment(ticketCode, ticketTitle, index + 1);
			const preservedAttachments = workItem.attachments.filter((attachment) => (
				attachment.source !== "generated" ||
				attachment.kind !== RFP_TICKET_DRAFT_ATTACHMENT_KIND
			));

			nextState = {
				...moveTicketToColumn(nextState, ticketCode, RFP_REVIEW_COLUMN_NAME),
				workItems: {
					...nextState.workItems,
					[ticketCode]: {
						...workItem,
						status: RFP_REVIEW_COLUMN_NAME,
						attachments: [...preservedAttachments, generatedAttachment],
						assignee: null,
						agentStatus: "completed",
						agentReadyAt: null,
						agentSessionThreadId: threadId,
						generatedAttachment,
						agentComment,
						completedAt,
						lastError: null,
					},
				},
			};
			completedTicketCodes.push(ticketCode);
			threadRecords.push({
				...buildThreadForTicket({
					attachmentName: generatedAttachment.displayName,
					ticketCode,
					runId: workItem.agentJobRunId,
					timestamp: completedAt,
				}),
				id: threadId,
			});
		} catch (error) {
			nextState = {
				...nextState,
				workItems: {
					...nextState.workItems,
					[ticketCode]: {
						...workItem,
						agentStatus: "failed",
						agentReadyAt: null,
						lastError: error instanceof Error ? error.message : String(error),
					},
				},
			};
			failedTicketCodes.push(ticketCode);
			threadRecords.push({
				...buildFailureThreadForTicket({ ticketCode, runId: workItem.agentJobRunId, timestamp: completedAt }),
				id: threadId,
			});
		}
	}

	const withSummaries = refreshRunSummaries(nextState);
	return {
		changed: dueItems.length > 0 || withSummaries !== nextState,
		completedTicketCodes,
		failedTicketCodes,
		state: withSummaries,
		threadRecords,
	};
}

function moveTicketEnteredColumn(state, {
	jobId = state.agent?.jobId ?? null,
	runId,
	source = "jira-column-entered",
	targetColumn,
	ticketCode,
} = {}) {
	const normalizedTicketCode = getNonEmptyString(ticketCode);
	const normalizedTargetColumn = getNonEmptyString(targetColumn);
	if (!normalizedTicketCode || !normalizedTargetColumn) {
		const error = new Error("ticketCode and targetColumn are required.");
		error.code = "INVALID_INPUT";
		throw error;
	}

	let nextState = moveTicketToColumn(state, normalizedTicketCode, normalizedTargetColumn);
	if (normalizedTargetColumn !== RFP_DRAFTING_COLUMN_NAME || !nextState.agent?.trigger) {
		return {
			state: nextState,
			runSummary: null,
			threadRecords: [],
		};
	}

	return runRfpDraftingAgent(nextState, {
		jobId,
		runId,
		source,
		ticketCodes: [normalizedTicketCode],
	});
}

function getDemoCreatedThreadIds(state) {
	const threadIds = new Set();
	for (const [ticketCode, workItem] of Object.entries(state.workItems ?? {})) {
		const threadId = getNonEmptyString(workItem?.agentSessionThreadId);
		if (threadId) {
			threadIds.add(threadId);
		}
		if (ticketCode.startsWith("RFP-")) {
			threadIds.add(createThreadIdForTicket(ticketCode));
		}
	}
	return [...threadIds];
}

function createAgentsRfpDemoStateManager({ baseDir }) {
	const filePath = path.join(baseDir, "agents-rfp-demo", "state.json");
	let mutationQueue = Promise.resolve();
	let tempWriteCounter = 0;

	async function readStateFromDisk() {
		try {
			const rawText = await fs.readFile(filePath, "utf8");
			return normalizeAgentsRfpDemoState(JSON.parse(rawText));
		} catch (error) {
			if (error?.code === "ENOENT") {
				return createDefaultAgentsRfpDemoState();
			}
			throw error;
		}
	}

	async function writeStateToDisk(state) {
		const normalizedState = normalizeAgentsRfpDemoState(state);
		await fs.mkdir(path.dirname(filePath), { recursive: true });
		const tempFilePath = `${filePath}.${process.pid}.${Date.now()}.${tempWriteCounter++}.tmp`;
		try {
			await fs.writeFile(tempFilePath, `${JSON.stringify(normalizedState, null, 2)}\n`, "utf8");
			await fs.rename(tempFilePath, filePath);
		} catch (error) {
			await fs.rm(tempFilePath, { force: true }).catch(() => {});
			throw error;
		}
		return cloneJson(normalizedState);
	}

	function enqueueMutation(task) {
		const result = mutationQueue.then(task, task);
		mutationQueue = result.then(
			() => undefined,
			() => undefined,
		);
		return result;
	}

	async function readState() {
		await mutationQueue;
		return readStateFromDisk();
	}

	async function writeState(state) {
		return enqueueMutation(() => writeStateToDisk(state));
	}

	async function resetState() {
		return writeState(createDefaultAgentsRfpDemoState());
	}

	async function updateState(updater) {
		return enqueueMutation(async () => {
			const currentState = await readStateFromDisk();
			const nextState = await updater(currentState);
			return writeStateToDisk(nextState);
		});
	}

	return {
		filePath,
		readState,
		resetState,
		updateState,
		writeState,
	};
}

module.exports = {
	AGENTS_RFP_DEMO_JOB_NAME,
	AGENTS_RFP_DEMO_JOB_PROMPT,
	AGENTS_RFP_DEMO_SURFACE,
	AGENTS_RFP_DEMO_VERSION,
	GENERATED_RFP_REPORT_ATTACHMENT_ID,
	RFP_DRAFTING_AGENT_AVATAR_SRC,
	RFP_DRAFTING_AGENT_CONVERSATION_STARTERS,
	RFP_DRAFTING_AGENT_DESCRIPTION,
	RFP_DRAFTING_AGENT_ID,
	RFP_DRAFTING_AGENT_NAME,
	RFP_DRAFTING_BOARD_NAME,
	RFP_DRAFTING_COLUMN_NAME,
	RFP_DRAFTING_EVENT_TRIGGER,
	RFP_DRAFTING_EVENT_TRIGGER_LABEL,
	RFP_DRAFTING_TRIGGER_PROMPT,
	RFP_REVIEW_COLUMN_NAME,
	advanceRfpDraftingAgentProcessing,
	buildActiveJiraWorkItemContextForTicket,
	buildTicketSpecificReportFields,
	buildThreadForTicket,
	buildFailureThreadForTicket,
	createAgentsRfpDemoStateManager,
	createDefaultAgentsRfpDemoState,
	createGeneratedAttachment,
	createThreadIdForTicket,
	getDemoCreatedThreadIds,
	moveTicketEnteredColumn,
	moveTicketToColumn,
	normalizeAgentsRfpDemoState,
	runRfpDraftingAgent,
};
