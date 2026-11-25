import type { RovoAgentProfile } from "@/app/data/directory/agents";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import type { QuestionCardQuestion } from "@/components/blocks/question-card/types";
import type { RovoUIMessage } from "@/lib/rovo-ui-messages";

export function agentSessionDemoProfiles(base: readonly RovoAgentProfile[], items: readonly AgentSessionItem[]): readonly RovoAgentProfile[] {
	return [
		...base,
		...items.filter((item) => !base.some((profile) => profile.name.toLowerCase() === item.agent.name.toLowerCase())).map(({ agent }) => ({
			id: agent.id ?? agent.name,
			name: agent.name,
			avatarSrc: agent.avatarSrc,
			brandName: agent.brandName,
			vpkLogo: agent.vpkLogo,
			byline: "Cloud agent",
			description: "A cloud agent session.",
			starters: [],
			contextDescription: `Answer as ${agent.name}.`,
		})),
	];
}

function sessionChatSnapshot(item: AgentSessionItem): { messages: RovoUIMessage[]; thinkingMessageId: string | null } {
	const id = item.id;
	if (item.state === "complete" || item.state === "ready-for-review") {
		const summary = item.state === "ready-for-review"
			? "The work is ready for your review."
			: "The work is complete. The relevant details are ready for the team to review.";
		return {
			thinkingMessageId: null,
			messages: [
				{ id: `${id}-user`, role: "user", parts: [{ type: "text", text: item.title, state: "done" }] },
				{ id: `${id}-${item.state}`, role: "assistant", parts: [{ type: "text", text: summary, state: "done" }] },
				...(item.state === "complete" && id === "cloud-figma-with-austin" ? [{ id: `${id}-handoff`, role: "assistant" as const, parts: [
					{ type: "text" as const, text: "I’ve prepared the off-road suspension controls for engineering, including the design, handoff notes, and acceptance criteria.", state: "done" as const },
					{ type: "data-widget-data" as const, data: { type: "agent-session-demo-artifacts", payload: "off-road-handoff" } },
				] }] : []),
			],
		};
	}
	const thinkingMessageId = `${id}-thinking`;
	const timestamp = "2026-11-12T00:00:00.000Z";
	return {
		thinkingMessageId,
		messages: [
			{ id: `${id}-user`, role: "user", parts: [{ type: "text", text: item.title, state: "done" }] },
			{ id: `${id}-update`, role: "assistant", parts: [{ type: "text", text: `I’m reviewing the context for ${item.title}. I’ll check the relevant details and prepare the next steps.`, state: "done" }] },
			{ id: thinkingMessageId, role: "assistant", parts: [
				{ type: "data-thinking-status", data: { label: "Working", content: "Checking the related work and context.", toolCallId: `${id}-check`, activity: "data", source: "fallback", timestamp } },
				{ type: "data-thinking-event", id: `${id}-read-start`, data: { eventId: `${id}-read-start`, phase: "start", toolName: "jira.read_work_item_context", label: "Reading the work item and linked context", toolCallId: `${id}-read`, timestamp } },
				{ type: "data-thinking-event", id: `${id}-read-result`, data: { eventId: `${id}-read-result`, phase: "result", toolName: "jira.read_work_item_context", label: "Reading the work item and linked context", toolCallId: `${id}-read`, outputPreview: "Reviewed the related context.", timestamp } },
				{ type: "data-thinking-event", id: `${id}-check-start`, data: { eventId: `${id}-check-start`, phase: "start", toolName: "workspace.review_files", label: "Checking the related work", toolCallId: `${id}-check`, timestamp } },
			] },
		],
	};
}

const ROADMAP_QUESTION: QuestionCardQuestion = {
	id: "suspension-roadmap-priority",
	kind: "single-select",
	label: "What should the suspension roadmap prioritize?",
	options: [
		{ id: "off-road", label: "Prioritize off-road performance", description: "Focus the first phase on damping and rough terrain." },
		{ id: "comfort", label: "Prioritize ride comfort", description: "Start with on-road comfort and everyday driving." },
		{ id: "balanced", label: "Balance both goals", description: "Plan off-road performance and ride comfort together." },
	],
};

export function agentSessionDemoScenario(session: AgentSessionItem, profiles: readonly RovoAgentProfile[], needsInput: boolean) {
	return {
		sessionId: session.id,
		agentId: profiles.find((profile) => profile.name.toLowerCase() === session.agent.name.toLowerCase())?.id ?? session.agent.id ?? session.id,
		agentName: session.agent.name,
		issueKey: session.sessionDetails?.issueKey ?? session.id,
		issueSummary: session.sessionDetails?.issueSummary ?? session.title,
		...(needsInput ? {
			intro: "I’m putting together the active air suspension roadmap, but I need your direction before I continue.",
			question: ROADMAP_QUESTION,
		} : { recordedSession: sessionChatSnapshot(session) }),
	};
}
