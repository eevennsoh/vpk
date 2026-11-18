import type { RovoUIMessage } from "@/lib/rovo-ui-messages";

export type ReplayMode = "normal" | "awaiting";
export type StudioReplayPhase = "playing" | "awaiting" | "generating" | "completed";
export type RovoMessagePart = RovoUIMessage["parts"][number];

export interface StudioReplayContentRow {
	content: string;
	input?: unknown;
	output?: unknown;
	outputPreview?: string;
}

export interface StudioReplayStep {
	toolName: string;
	toolCallId: string;
	label: string;
	content: string;
	input?: unknown;
	output?: unknown;
	outputPreview?: string;
	contentRows: readonly StudioReplayContentRow[];
}

export type StudioReplayTimelineEntry =
	| {
		at: number;
		part: RovoMessagePart;
	}
	| {
		at: number;
		phase: StudioReplayPhase;
		duration?: number;
	};

export const STUDIO_REPLAY_TOOL_CALL_DELAY_MS = 2300;
export const STUDIO_REPLAY_NARRATION_ROW_DELAY_MS = 550;
export const STUDIO_REPLAY_ANSWER_HOLD_MS = 1200;
export const STUDIO_REPLAY_RESPONSE_HOLD_MS = 1400;
export const STUDIO_REPLAY_MESSAGE_ID = "studio-agent-creation-replay";
export const STUDIO_REPLAY_DESIGNING_AGENT_LABEL = "Designing agent";
export const STUDIO_REPLAY_DESIGNING_AGENT_CONTENT =
	"Reviewing the brief, checking missing profile details, and shaping the Studio agent.";
export const STUDIO_REPLAY_ANSWER_RESULT = "Answers received.";

export const STUDIO_AGENT_CREATION_FIRST_TURN_STEPS = [
	{
		toolName: "studio.read_brief",
		toolCallId: "studio-agent-replay-turn-1-read-brief",
		label: "Reading agent brief",
		content: "Identifying the job, audience, and expected outcome for Rovo agent.",
		input: {
			prompt: "Build a Rovo agent named OKR Generator that creates effective OKRs in Jira Product Discovery, reviews draft OKRs in Confluence, finds similar examples, and shares guidance for str…",
		},
		outputPreview: "Agent brief captured: Build a Rovo agent named OKR Generator that creates effective OKRs in Jira Product Discovery, reviews draft OKRs in Confluence, finds similar examples, and shares guidance for str…",
		contentRows: [
			{
				content: "Identifying the job, audience, and expected outcome for Rovo agent.",
				input: {
					prompt: "Build a Rovo agent named OKR Generator that creates effective OKRs in Jira Product Discovery, reviews draft OKRs in Confluence, finds similar examples, and shares guidance for str…",
				},
				outputPreview: "Agent brief captured: Build a Rovo agent named OKR Generator that creates effective OKRs in Jira Product Discovery, reviews draft OKRs in Confluence, finds similar examples, and shares guidance for str…",
			},
			{
				content: "Parsing the brief for the core task and success criteria.",
				input: { step: "parse_task" },
				outputPreview: "Core task and success criteria extracted.",
			},
			{
				content: "Noting the intended audience and tone.",
				input: { step: "audience_tone" },
				outputPreview: "Audience and tone recorded.",
			},
			{
				content: "Flagging any constraints to respect while drafting.",
				input: { step: "constraints" },
				outputPreview: "Constraints flagged for the draft.",
			},
		],
	},
	{
		toolName: "ask_user_questions",
		toolCallId: "studio-agent-replay-turn-1-ask-questions",
		label: "Preparing clarification questions",
		content: "Asking a few targeted questions to shape Rovo agent before drafting the profile.",
		input: { round: 1 },
		contentRows: [
			{
				content: "Asking a few targeted questions to shape Rovo agent before drafting the profile.",
				input: { round: 1 },
				outputPreview: "Clarification questions ready for your input.",
			},
			{
				content: "Spotting the gaps that would change the design.",
				input: { step: "find_gaps" },
				outputPreview: "Key gaps identified.",
			},
			{
				content: "Phrasing each question to be quick to answer.",
				input: { step: "phrase_questions" },
				outputPreview: "Questions phrased concisely.",
			},
			{
				content: "Ordering questions from most to least impactful.",
				input: { step: "order_questions" },
				outputPreview: "Questions ordered by impact.",
			},
		],
	},
] as const satisfies readonly StudioReplayStep[];

export const STUDIO_AGENT_CREATION_FOLLOW_UP_STEPS = [
	{
		toolName: "studio.read_brief",
		toolCallId: "studio-agent-replay-turn-2-read-brief",
		label: "Reading agent brief",
		content: "Identifying the job, audience, and expected outcome for the agent.",
		input: {
			prompt: "Here are my clarification answers for \"OKR Generator\": The audience is product teams, the agent should draft in Confluence, use Jira Product Discovery examples, and keep recommend…",
		},
		outputPreview: "Agent brief captured: Here are my clarification answers for \"OKR Generator\": The audience is product teams, the agent should draft in Confluence, use Jira Product Discovery examples, and keep recommend…",
		contentRows: [
			{
				content: "Identifying the job, audience, and expected outcome for the agent.",
				input: {
					prompt: "Here are my clarification answers for \"OKR Generator\": The audience is product teams, the agent should draft in Confluence, use Jira Product Discovery examples, and keep recommend…",
				},
				outputPreview: "Agent brief captured: Here are my clarification answers for \"OKR Generator\": The audience is product teams, the agent should draft in Confluence, use Jira Product Discovery examples, and keep recommend…",
			},
			{
				content: "Parsing the brief for the core task and success criteria.",
				input: { step: "parse_task" },
				outputPreview: "Core task and success criteria extracted.",
			},
			{
				content: "Noting the intended audience and tone.",
				input: { step: "audience_tone" },
				outputPreview: "Audience and tone recorded.",
			},
			{
				content: "Flagging any constraints to respect while drafting.",
				input: { step: "constraints" },
				outputPreview: "Constraints flagged for the draft.",
			},
		],
	},
	{
		toolName: "studio.review_answers",
		toolCallId: "studio-agent-replay-turn-2-review-answers",
		label: "Reviewing agent details",
		content: "Merging your latest answers into the agent profile draft.",
		input: {
			exchange: "Q: What team should the agent support, where should it draft, and which examples should it use? — A: Here are my clarification answers for \"OKR Generator\": The audience is product teams, the agent should draft…",
		},
		outputPreview: "Clarifications applied: Q: What team should the agent support, where should it draft, and which examples should it use? — A: Here are my clarification answers for \"OKR Generator\": The audience is product teams, the agent should draft…",
		contentRows: [
			{
				content: "Merging your latest answers into the agent profile draft.",
				input: {
					exchange: "Q: What team should the agent support, where should it draft, and which examples should it use? — A: Here are my clarification answers for \"OKR Generator\": The audience is product teams, the agent should draft…",
				},
				outputPreview: "Clarifications applied: Q: What team should the agent support, where should it draft, and which examples should it use? — A: Here are my clarification answers for \"OKR Generator\": The audience is product teams, the agent should draft…",
			},
			{
				content: "Reconciling new answers with the original brief.",
				input: { step: "reconcile" },
				outputPreview: "Answers reconciled with the brief.",
			},
			{
				content: "Resolving any conflicting preferences.",
				input: { step: "resolve_conflicts" },
				outputPreview: "Conflicting preferences resolved.",
			},
			{
				content: "Locking in the confirmed direction.",
				input: { step: "lock_direction" },
				outputPreview: "Direction confirmed.",
			},
		],
	},
	{
		toolName: "studio.select_tools",
		toolCallId: "studio-agent-replay-turn-2-select-tools",
		label: "Selecting agent tools",
		content: "Matching the requested workflow to relevant tools and skills.",
		input: { selected: ["Jira", "Confluence"] },
		outputPreview: "Agent tools matched: Jira, Confluence",
		contentRows: [
			{
				content: "Matching the requested workflow to relevant tools and skills.",
				input: { selected: ["Jira", "Confluence"] },
				outputPreview: "Agent tools matched: Jira, Confluence",
			},
			{
				content: "Scanning the brief for named integrations.",
				input: { step: "scan_integrations" },
				outputPreview: "Integrations found: Jira, Confluence.",
			},
			{
				content: "Mapping each task to a capable tool or skill.",
				input: { step: "map_tasks" },
				outputPreview: "Tasks mapped to tools and skills.",
			},
		],
	},
	{
		toolName: "studio.draft_instructions",
		toolCallId: "studio-agent-replay-turn-2-draft-instructions",
		label: "Drafting agent instructions",
		content: "Writing role, scope, and guardrails for the agent.",
		input: {
			focus: "the agent",
			hasContext: false,
		},
		outputPreview: "Instruction draft covers role, boundaries, tools, and tone.",
		contentRows: [
			{
				content: "Writing role, scope, and guardrails for the agent.",
				input: {
					focus: "the agent",
					hasContext: false,
				},
				outputPreview: "Instruction draft covers role, boundaries, tools, and tone.",
			},
			{
				content: "Defining what the agent should and shouldn't do.",
				input: { step: "define_scope" },
				outputPreview: "Scope boundaries defined.",
			},
			{
				content: "Setting the tone and response style.",
				input: { step: "set_tone" },
				outputPreview: "Tone and style set.",
			},
			{
				content: "Adding guardrails for edge cases.",
				input: { step: "add_guardrails" },
				outputPreview: "Guardrails added.",
			},
		],
	},
	{
		toolName: "studio.name_agent",
		toolCallId: "studio-agent-replay-turn-2-name-agent",
		label: "Naming agent profile",
		content: "Choosing a name, byline, and profile-card summary that match the brief.",
		input: {
			hint: "agent that draft in Confluence, use Jira Product Discovery example…",
		},
		outputPreview: "Profile naming cue: agent that draft in Confluence, use Jira Product Discovery example…",
		contentRows: [
			{
				content: "Choosing a name, byline, and profile-card summary that match the brief.",
				input: {
					hint: "agent that draft in Confluence, use Jira Product Discovery example…",
				},
				outputPreview: "Profile naming cue: agent that draft in Confluence, use Jira Product Discovery example…",
			},
			{
				content: "Brainstorming names that signal the agent's purpose.",
				input: { step: "brainstorm_names" },
				outputPreview: "Candidate names generated.",
			},
			{
				content: "Writing a one-line byline.",
				input: { step: "write_byline" },
				outputPreview: "Byline drafted.",
			},
			{
				content: "Summarizing the agent for its profile card.",
				input: { step: "summarize_card" },
				outputPreview: "Profile-card summary written.",
			},
		],
	},
	{
		toolName: "studio.save_profile",
		toolCallId: "studio-agent-replay-turn-2-save-profile",
		label: "Saving agent profile",
		content: "Persisting the agent so it shows up in your Studio library.",
		outputPreview: "Agent profile ready for Studio.",
		contentRows: [
			{
				content: "Persisting the agent so it shows up in your Studio library.",
				outputPreview: "Agent profile ready for Studio.",
			},
			{
				content: "Validating the profile before saving.",
				input: { step: "validate" },
				outputPreview: "Profile validated.",
			},
			{
				content: "Writing the agent to your Studio library.",
				input: { step: "persist" },
				outputPreview: "Agent saved to the library.",
			},
			{
				content: "Confirming it's ready to use.",
				input: { step: "confirm" },
				outputPreview: "Agent ready to use.",
			},
		],
	},
] as const satisfies readonly StudioReplayStep[];
