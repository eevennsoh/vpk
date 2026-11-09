import directoryAgentsData from "@/app/data/directory/agents.json";
import directorySkillsData from "@/app/data/directory/skills.json";
import type {
	JiraIssueAgentActivity,
	JiraIssueCompletedAgentRun,
	JiraIssueGenerativeActionRequest,
} from "@/components/blocks/jira-issue";
import type { QuestionCardQuestion } from "@/components/blocks/question-card/types";
import type { JiraKanbanAgentData, JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import { BOARD_AGENTS } from "@/components/projects/jira/data/board-agents";
import { BOARD_COLUMNS } from "@/components/projects/jira/data/board-data";
import { ROVO_LOGO_DATA_URI } from "@/components/ui/data/rovo-logo";
import { getDeterministicAgentAvatarSrc } from "@/lib/agent-avatars";

export const ASX_KANBAN_INTAKE_COLUMN = "RFP Intake";
export const ASX_KANBAN_DRAFTING_COLUMN = "Drafting";
export const ASX_KANBAN_REVIEW_COLUMN = "Review";
export const ASX_KANBAN_SUBMITTED_COLUMN = "Submitted";
export const ASX_KANBAN_DEFAULT_AGENT_ID = "rfp-drafter";
const ASX_ROVO_AGENT_ID = "rovo-dev";

interface AsxDirectoryAgentRecord {
	id: string;
	name: string;
	avatarSrc?: string;
}

interface AsxDirectorySkillRecord {
	id: string;
	name: string;
}

export interface AsxKanbanAgentSelection {
	id: string;
	name?: string;
	avatarSrc?: string;
}

interface AsxKanbanActivityScenario {
	awaitingInputMessage: string;
	completedSummary: string;
	cycleIntervalMs: number;
	labels: readonly string[];
	question: QuestionCardQuestion;
	workingMessage: string;
}

const ASX_DIRECTORY_AGENTS = directoryAgentsData as readonly AsxDirectoryAgentRecord[];
const ASX_DIRECTORY_SKILLS = directorySkillsData as readonly AsxDirectorySkillRecord[];

export const ASX_KANBAN_AGENTS: readonly JiraKanbanAgentData[] = [
	{
		id: ASX_KANBAN_DEFAULT_AGENT_ID,
		name: "RFP Drafter",
		byline: "Sales agent by Atlassian",
		avatarSrc: getDeterministicAgentAvatarSrc(ASX_KANBAN_DEFAULT_AGENT_ID),
	},
	{
		id: "service-impact-agent",
		name: "Service impact agent",
		byline: "Service agent by Atlassian",
		avatarSrc: "/avatar-agent-new/yellow/ops-agent.svg",
	},
	{
		id: "dependency-mapper",
		name: "Dependency mapper",
		byline: "Planning agent by Atlassian",
		avatarSrc: "/avatar-agent-new/blue/backlog-buddy.svg",
	},
	{
		id: "ai-insights-agent",
		name: "AI Insights Agent",
		byline: "Custom agent by Atlassian",
		avatarSrc: "/avatar-agent-new/purple/default.svg",
	},
	...BOARD_AGENTS,
] as const;

export const ASX_RFP_QUESTION: QuestionCardQuestion = {
	id: "rfp-response-strategy",
	label: "Which response strategy should we lead with?",
	description: "Choose the narrative the RFP drafter should prioritize in the recommendation.",
	kind: "single-select",
	options: [
		{
			id: "platform-consolidation",
			label: "Platform consolidation",
			description: "Lead with lower tool sprawl and one connected system of work.",
		},
		{
			id: "service-experience",
			label: "Service experience",
			description: "Lead with faster employee support and self-service outcomes.",
		},
	],
};

/** ASX owns a fresh, non-persisted board. Drafting intentionally starts empty. */
export function createAsxKanbanColumns(): JiraKanbanColumnData[] {
	return BOARD_COLUMNS.map((column) => {
		const cards = column.title === ASX_KANBAN_DRAFTING_COLUMN
			? []
			: column.cards.map((card) => ({
				...card,
				tags: card.tags.map((tag) => ({ ...tag })),
			}));

		return { ...column, cards, count: cards.length };
	});
}

const ASX_KANBAN_ACTIVITY_SCENARIOS: Readonly<Record<string, AsxKanbanActivityScenario>> = {
	[ASX_KANBAN_DEFAULT_AGENT_ID]: {
		labels: [
			"Reading the RFP requirements",
			"Outlining the response structure",
			"Drafting the response narrative",
			"Pulling in supporting proof points",
			"Tightening the executive summary",
			"Checking response coverage",
		],
		cycleIntervalMs: 2400,
		workingMessage: "I’m reviewing the requirements and shaping a concise response narrative for this RFP.",
		awaitingInputMessage: "I found two credible response strategies. Choose the narrative I should prioritize before I finish the recommendation.",
		completedSummary: "Prepared the bid recommendation and response narrative for review.",
		question: ASX_RFP_QUESTION,
	},
	"feedback-analyzer": {
		labels: [
			"Clustering customer evidence",
			"Tagging recurring pain points",
			"Comparing themes and sentiment",
			"Weighing signal strength",
			"Turning signals into win themes",
		],
		cycleIntervalMs: 2100,
		workingMessage: "I’m grouping the customer evidence into themes and looking for the strongest signal to anchor the response.",
		awaitingInputMessage: "Two customer signals are equally strong. Choose which one should shape the response narrative.",
		completedSummary: "Clustered the customer evidence into themes and identified the lead win signal.",
		question: {
			id: "feedback-signal",
			label: "Which customer signal should shape the response?",
			description: "Choose the evidence the Feedback Analyzer should elevate into the lead win theme.",
			kind: "single-select",
			options: [
				{ id: "operational-friction", label: "Operational friction", description: "Lead with the cost and complexity customers experience today." },
				{ id: "executive-confidence", label: "Executive confidence", description: "Lead with visibility, governance, and measurable outcomes." },
			],
		},
	},
	"ai-insights-agent": {
		labels: [
			"Scanning current AI shifts",
			"Mapping trends to customer priorities",
			"Comparing market signals",
			"Pressure-testing the angle",
			"Drafting an innovation angle",
		],
		cycleIntervalMs: 1900,
		workingMessage: "I’m comparing current AI trends with the customer’s priorities to find a credible innovation angle.",
		awaitingInputMessage: "I found two viable AI narratives. Choose how ambitious the response should sound.",
		completedSummary: "Added a current, credible AI innovation angle to the response.",
		question: {
			id: "ai-narrative",
			label: "Which AI narrative should lead the response?",
			description: "Choose the innovation angle the AI Insights Agent should develop.",
			kind: "single-select",
			options: [
				{ id: "practical-adoption", label: "Practical AI adoption", description: "Emphasize near-term productivity and responsible rollout." },
				{ id: "strategic-differentiation", label: "Strategic differentiation", description: "Emphasize long-term advantage and new operating models." },
			],
		},
	},
	"readiness-checker": {
		labels: [
			"Checking requirement coverage",
			"Verifying evidence and attachments",
			"Flagging ownership gaps",
			"Confirming approval handoffs",
			"Scoring response readiness",
		],
		cycleIntervalMs: 2300,
		workingMessage: "I’m checking evidence, ownership, and mandatory requirements before this response moves to Review.",
		awaitingInputMessage: "The response has two readiness gaps. Choose which one I should resolve first.",
		completedSummary: "Checked mandatory coverage, evidence, and response ownership for review.",
		question: {
			id: "readiness-gap",
			label: "Which readiness gap should we resolve first?",
			description: "Choose the blocker the Readiness Checker should prioritize.",
			kind: "single-select",
			options: [
				{ id: "evidence-gaps", label: "Evidence gaps", description: "Confirm proof points, references, and required attachments." },
				{ id: "owner-alignment", label: "Owner alignment", description: "Confirm accountable reviewers and approval handoffs." },
			],
		},
	},
	"service-impact-agent": {
		labels: [
			"Mapping affected services",
			"Tracing downstream dependencies",
			"Checking operational outcomes",
			"Estimating customer impact",
			"Writing the service summary",
		],
		cycleIntervalMs: 2200,
		workingMessage: "I’m tracing the affected services and translating operational impact into customer outcomes.",
		awaitingInputMessage: "I found two ways to frame service impact. Choose the outcome I should emphasize.",
		completedSummary: "Mapped the affected services and added a customer-facing impact summary.",
		question: {
			id: "service-outcome",
			label: "Which service outcome matters most?",
			kind: "single-select",
			options: [
				{ id: "employee-experience", label: "Employee experience", description: "Prioritize faster support and self-service." },
				{ id: "operational-resilience", label: "Operational resilience", description: "Prioritize reliability, visibility, and faster recovery." },
			],
		},
	},
	"dependency-mapper": {
		labels: [
			"Following linked requirements",
			"Mapping owners and dependencies",
			"Spotting blocked handoffs",
			"Sequencing the critical path",
			"Checking response handoffs",
		],
		cycleIntervalMs: 2500,
		workingMessage: "I’m following linked requirements and mapping the owners and handoffs that could block the response.",
		awaitingInputMessage: "I found two dependency clusters. Choose which handoff I should untangle first.",
		completedSummary: "Documented dependent requirements, owners, and blocked handoffs.",
		question: {
			id: "dependency-focus",
			label: "Which dependency cluster should we resolve first?",
			kind: "single-select",
			options: [
				{ id: "technical", label: "Technical dependencies", description: "Resolve integrations, data, and platform constraints." },
				{ id: "approval", label: "Approval dependencies", description: "Resolve legal, security, and executive review handoffs." },
			],
		},
	},
	"skill:create-skill": {
		labels: ["Interpreting the skill brief", "Drafting reusable instructions", "Checking trigger language"],
		cycleIntervalMs: 1800,
		workingMessage: "I’m turning this work pattern into reusable skill instructions with a clear trigger and output contract.",
		awaitingInputMessage: "The skill can be broad or tightly scoped. Choose how it should be triggered.",
		completedSummary: "Created reusable skill instructions with a clear trigger and output contract.",
		question: {
			id: "skill-trigger",
			label: "How specific should the skill trigger be?",
			kind: "single-select",
			options: [
				{ id: "narrow", label: "Narrow and explicit", description: "Trigger only for enterprise RFP response work." },
				{ id: "broad", label: "Broad and reusable", description: "Trigger for related proposal and bid-response work." },
			],
		},
	},
	"skill:design-landing-page": {
		labels: ["Auditing message hierarchy", "Shaping the conversion story", "Sketching page sections"],
		cycleIntervalMs: 2000,
		workingMessage: "I’m translating the RFP value proposition into a focused landing-page narrative and section hierarchy.",
		awaitingInputMessage: "The page can optimize for two different outcomes. Choose the primary conversion goal.",
		completedSummary: "Designed the landing-page narrative, conversion goal, and section hierarchy.",
		question: {
			id: "landing-page-goal",
			label: "What should the landing page optimize for?",
			kind: "single-select",
			options: [
				{ id: "qualified-leads", label: "Qualified leads", description: "Drive visitors toward a consultation or demo request." },
				{ id: "executive-confidence", label: "Executive confidence", description: "Build trust with proof, outcomes, and differentiation." },
			],
		},
	},
	"skill:develop-mobile-app-interface": {
		labels: ["Mapping core mobile journeys", "Defining navigation patterns", "Checking platform conventions"],
		cycleIntervalMs: 2600,
		workingMessage: "I’m turning the service requirements into focused mobile journeys and platform-appropriate interaction patterns.",
		awaitingInputMessage: "Two mobile journeys compete for the first prototype. Choose the one I should prioritize.",
		completedSummary: "Defined the priority mobile journey, navigation pattern, and platform conventions.",
		question: {
			id: "mobile-journey",
			label: "Which mobile journey should we prototype first?",
			kind: "single-select",
			options: [
				{ id: "employee-self-service", label: "Employee self-service", description: "Focus on finding help and resolving common requests." },
				{ id: "service-team-triage", label: "Service-team triage", description: "Focus on prioritizing and resolving incoming work." },
			],
		},
	},
};

function getAsxKanbanActivityScenario(agentId: string): AsxKanbanActivityScenario {
	const scenario = ASX_KANBAN_ACTIVITY_SCENARIOS[agentId];
	if (scenario) return scenario;

	return {
		labels: [
			"Reviewing the RFP",
			"Applying the selected expertise",
			"Gathering supporting context",
			"Drafting the next update",
			"Preparing the next update",
		],
		cycleIntervalMs: 2400,
		workingMessage: "I’m applying the selected expertise to this issue and preparing a focused update.",
		awaitingInputMessage: "I found a decision point that needs your input before I can finish the update.",
		completedSummary: "Applied the selected expertise and prepared the issue update for review.",
		question: ASX_RFP_QUESTION,
	};
}

export function getAsxGenerativeActivityId(request: JiraIssueGenerativeActionRequest): string {
	if (request.kind === "skill") {
		const skillId = request.selectedItem?.id ?? "skill:selected-skill";
		return skillId.startsWith("skill:") ? skillId : `skill:${skillId}`;
	}

	if (request.kind === "agent") {
		return request.selectedItem?.id.replace(/^subagent:/u, "") ?? ASX_KANBAN_DEFAULT_AGENT_ID;
	}

	return ASX_ROVO_AGENT_ID;
}

export function getAsxGenerativeAgentSelection(
	request: JiraIssueGenerativeActionRequest,
): AsxKanbanAgentSelection {
	return {
		id: getAsxGenerativeActivityId(request),
		name: request.kind === "agent" ? request.selectedItem?.label : undefined,
		avatarSrc: request.kind === "agent" ? request.selectedItem?.avatarSrc : undefined,
	};
}

/**
 * Small deterministic string hash (FNV-1a-ish). Used to derive per-card
 * variation from a stable seed (the card/issue key) so the demo reads
 * dynamically without `Math.random` — which would break SSR/client hydration
 * and make the story non-reproducible between renders.
 */
function hashAsxSeed(seed: string): number {
	let hash = 2166136261;
	for (let index = 0; index < seed.length; index += 1) {
		hash ^= seed.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

/** Rotates a label pool so different cards start on — and cycle through — a
 * different phrase, breaking the lockstep uniformity when the same agent is
 * assigned to several cards at once. */
function rotateAsxLabels(labels: readonly string[], offset: number): readonly string[] {
	if (labels.length <= 1) return labels;
	const start = offset % labels.length;
	return [...labels.slice(start), ...labels.slice(0, start)];
}

/**
 * Derives per-card working-label variation from a stable seed. Returns the
 * scenario labels rotated to a card-specific starting phrase plus a jittered
 * cycle cadence, so a bulk assignment of one agent to many cards reads as
 * distinct, concurrent work instead of a uniform placeholder.
 */
function getAsxSeededLabelVariation(
	scenario: AsxKanbanActivityScenario,
	seed: string | undefined,
): { labels: readonly string[]; cycleIntervalMs: number; cycleIntervalJitterMs: number } {
	if (!seed) {
		return {
			labels: scenario.labels,
			cycleIntervalMs: scenario.cycleIntervalMs,
			cycleIntervalJitterMs: 0,
		};
	}
	const hash = hashAsxSeed(seed);
	// Start each card on a different phrase in the pool.
	const labels = rotateAsxLabels(scenario.labels, hash);
	// Spread the base cadence by ±400ms per card and add real jitter so cards
	// started at the same instant drift out of sync instead of advancing together.
	const cadenceOffset = (hash % 9) * 100 - 400; // -400 … +400ms
	return {
		labels,
		cycleIntervalMs: Math.max(1200, scenario.cycleIntervalMs + cadenceOffset),
		cycleIntervalJitterMs: 500 + (hash % 6) * 100, // 500 … 1000ms
	};
}

export function createAsxKanbanActivity(
	agentId: string,
	awaitingInput = false,
	selection?: AsxKanbanAgentSelection,
	seed?: string,
): JiraIssueAgentActivity {
	if (agentId.startsWith("skill:")) {
		const skillId = agentId.replace(/^skill:/u, "");
		const skillName = ASX_DIRECTORY_SKILLS.find((skill) => skill.id === skillId)?.name ?? "selected skill";
		const scenario = getAsxKanbanActivityScenario(agentId);
		const variation = getAsxSeededLabelVariation(scenario, seed);

		return {
			id: agentId,
			name: "Rovo",
			avatarSrc: ROVO_LOGO_DATA_URI,
			label: awaitingInput ? "Awaiting user input" : variation.labels[0] ?? `Running ${skillName}`,
			labels: variation.labels,
			message: awaitingInput ? scenario.awaitingInputMessage : scenario.workingMessage,
			question: awaitingInput ? scenario.question : undefined,
			cycleIntervalMs: variation.cycleIntervalMs,
			cycleIntervalJitterMs: variation.cycleIntervalJitterMs,
			state: awaitingInput ? "awaiting-input" : "working",
		};
	}

	const asxAgent = ASX_KANBAN_AGENTS.find((candidate) => candidate.id === agentId);
	const directoryAgent = ASX_DIRECTORY_AGENTS.find((candidate) => candidate.id === agentId);
	const scenario = getAsxKanbanActivityScenario(agentId);
	const variation = getAsxSeededLabelVariation(scenario, seed);

	return {
		id: agentId,
		name: selection?.name ?? asxAgent?.name ?? directoryAgent?.name ?? "RFP agent",
		avatarSrc: selection?.avatarSrc ?? asxAgent?.avatarSrc ?? directoryAgent?.avatarSrc,
		label: awaitingInput ? "Awaiting user input" : variation.labels[0] ?? "Reviewing the RFP",
		labels: variation.labels,
		message: awaitingInput ? scenario.awaitingInputMessage : scenario.workingMessage,
		question: awaitingInput ? scenario.question : undefined,
		cycleIntervalMs: variation.cycleIntervalMs,
		cycleIntervalJitterMs: variation.cycleIntervalJitterMs,
		state: awaitingInput ? "awaiting-input" : "working",
	};
}

export function createAsxKanbanCompletedRun(
	agentId: string,
	issue: Readonly<{ issueKey: string; issueSummary: string }>,
	selection?: AsxKanbanAgentSelection,
	summary?: string,
	state: JiraIssueCompletedAgentRun["state"] = "done",
): JiraIssueCompletedAgentRun {
	const activity = createAsxKanbanActivity(agentId, false, selection);
	const scenario = getAsxKanbanActivityScenario(agentId);

	return {
		id: `${issue.issueKey}:${agentId}`,
		summary: summary ?? scenario.completedSummary,
		agentName: activity.name,
		agentAvatarSrc: activity.avatarSrc,
		issueKey: issue.issueKey,
		issueSummary: issue.issueSummary,
		relativeTime: "Just now",
		state,
	};
}
