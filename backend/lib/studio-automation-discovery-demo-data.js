const STUDIO_AUTOMATION_DISCOVERY_DEMO_USER = {
	accountId: "557058:47cd8d5d-89de-445e-9e6a-875cd3c36974",
	ari: "ari:cloud:identity::user/557058:47cd8d5d-89de-445e-9e6a-875cd3c36974",
	email: "esoh@atlassian.com",
	name: "Ee Venn Soh",
	preferredName: "Venn",
	role: "Principal Product Designer, Design-Rovo & AI",
};

const GENERATED_AGENT_FIXTURES = [
	{
		action: "create",
		agentId: "venn-loom-distribution-agent",
		name: "Loom Distribution Agent",
		byline: "Multi-channel distribution",
		sourceLabel: "Generated from recent work patterns",
		description: "Turns every new Studio design Loom into a reviewed distribution pack: sprint-channel announcement, stakeholder FYIs, Atlas update draft, and follow-up tracker.",
		summary: "Watches for new design Looms, reads the title, transcript, links, and recent Studio context, then drafts tailored shareback copy for Slack, stakeholder FYIs, and Atlas updates without posting until you approve.",
		avatarSrc: "/avatar-agent-new/purple/customer-insight.svg",
		conversationStarters: [
			"Draft the full shareback pack for my latest Agent builder Loom.",
			"Identify the right Slack channels and stakeholders for this Loom.",
			"Turn the Loom transcript into an Atlas update and approval checklist.",
		],
		conversationStarterIcons: ["page", "people-group", "edit-bulk"],
		triggers: [
			"A Loom publish webhook fires for a Studio or Rovo design video",
			"A Slack channel asks for a shareback on the latest Studio Loom",
		],
		automationRules: [
			{
				id: "loom-distribution-shareback",
				name: "Distribute new design Looms",
				description: "Build a review-ready shareback pack whenever a Studio design Loom is published.",
				enabled: true,
				prompt: [
					"When the Loom publish webhook fires, inspect the Loom title, description, transcript, linked Jira/Confluence context, and recent Studio work.",
					"Draft a Slack channel announcement, stakeholder-specific FYIs, an Atlas update, and a short approval checklist.",
					"Keep every message in draft state until I explicitly approve publishing.",
				].join(" "),
				triggers: [
					{
						id: "loom-publish-webhook",
						providerId: "webhook",
						eventId: "incoming-webhook",
						label: "Loom publish webhook",
						connectionState: "connected",
					},
					{
						id: "loom-shareback-slack-request",
						providerId: "slack",
						eventId: "new-message",
						label: "New message in #studio-design",
						params: { channel: "select-channels" },
						connectionState: "needs-connection",
					},
				],
			},
		],
		tools: ["loom", "slack", "confluence", "atlassian-home"],
		apps: ["loom", "slack", "confluence", "atlassian-home"],
		skills: ["summarize-thread", "capture-insights", "build-report", "automation-rule-builder"],
		knowledge: ["Agents creation experience vision", "Studio v2 strategy check-in", "Rovo Skills launch narrative", "Agent builder Loom archive"],
		guardrail: "Never post externally or DM stakeholders without your approval.",
		memoryMode: "on",
		reasoningMode: "balanced",
		knowledgeMode: "custom",
		instructions: [
			"You are my Loom distribution assistant for Rovo Studio design work.",
			"",
			"## Apps",
			"Use @[app:loom] to understand the new shareback, @[app:slack] to prepare sprint-channel and stakeholder messages, and @[app:confluence] plus @[app:atlassian-home] to draft Atlas or strategy updates.",
			"",
			"## Workflow",
			"1. Read the Loom title, description, transcript, linked docs, and any related Slack/Jira context.",
			"2. Extract the decision, shipped capability, open questions, and audience-specific implications.",
			"3. Pick the distribution surfaces: sprint channel, design review channel, named stakeholders, and Atlas project.",
			"4. Draft the full shareback pack with channel post, stakeholder FYI variants, Atlas update, and follow-up owner list.",
			"5. Show the drafts with evidence links and wait for approval before anything is posted.",
			"",
			"## Output shape",
			"- **Summary** One paragraph that explains what changed and why it matters.",
			"- **Distribution plan** Channels, stakeholders, and why each audience should receive it.",
			"- **Drafts** Slack post, stakeholder FYIs, and Atlas update ready to review.",
			"- **Approval checklist** Any claims, links, or audience rules that need confirmation.",
			"",
			"## Guardrails",
			"Never auto-send a DM, channel post, or Atlas update unless I explicitly approve it.",
		].join("\n"),
	},
	{
		action: "create",
		agentId: "venn-inactive-agent-triage-agent",
		name: "Inactive Agent Triage Agent",
		byline: "Lifecycle triage",
		sourceLabel: "Generated from recent work patterns",
		description: "Reviews agent-reaper-bot Jira tickets, checks each agent against live Studio work, and produces a keep, close, or needs-review recommendation with evidence.",
		summary: "Triage inactive-agent cleanup batches by comparing Jira tickets against active projects, recent Looms, Confluence specs, Slack mentions, and keep-list signals; it drafts closure actions only when the evidence is unambiguous.",
		avatarSrc: "/avatar-agent-new/yellow/ops-agent.svg",
		conversationStarters: [
			"Review today's agent-reaper-bot tickets and classify each one.",
			"Find inactive agents that are still tied to active Studio work.",
			"Draft a cleanup summary with keep, close, and needs-review buckets.",
		],
		conversationStarterIcons: ["task", "search", "list-bulleted"],
		triggers: [
			"A new Jira issue from agent-reaper-bot is assigned to you",
			"More than five inactive-agent cleanup issues are open",
		],
		automationRules: [
			{
				id: "inactive-agent-reaper-triage",
				name: "Triage agent-reaper-bot tickets",
				description: "Classify inactive-agent cleanup tickets and draft the safe next action with evidence.",
				enabled: true,
				prompt: [
					"When a Jira cleanup ticket from agent-reaper-bot appears, inspect the agent name, owner, age, linked project, and recent activity.",
					"Cross-check Confluence specs, Slack mentions, and active Studio project context before recommending keep, close, or needs-review.",
					"Draft ticket comments and closure actions, but leave uncertain or active-project agents for my approval.",
				].join(" "),
				triggers: [
					{
						id: "agent-reaper-ticket-created",
						providerId: "jira",
						eventId: "work-item-created",
						label: "agent-reaper-bot cleanup ticket created",
						params: { project: "any-project", actor: "anyone" },
						connectionState: "connected",
					},
					{
						id: "agent-reaper-ticket-updated",
						providerId: "jira",
						eventId: "work-item-updated",
						label: "agent-reaper-bot cleanup ticket updated",
						params: { project: "any-project", actor: "anyone" },
						connectionState: "connected",
					},
				],
			},
		],
		tools: ["jira", "slack", "confluence"],
		apps: ["jira", "slack", "confluence"],
		skills: ["jql-query-builder", "bulk-issue-editor", "capture-insights", "automation-rule-builder"],
		knowledge: ["Active Rovo Studio projects", "Agent creation prototypes", "Agent keep-list criteria", "Customer-facing showcase agents"],
		guardrail: "Only auto-close tickets that match known prototype or test-agent patterns; escalate anything linked to active projects.",
		memoryMode: "on",
		reasoningMode: "high",
		knowledgeMode: "custom",
		instructions: [
			"You are my inactive-agent lifecycle triage assistant.",
			"",
			"## Apps",
			"Use @[app:jira] for agent-reaper-bot cleanup tickets, @[app:confluence] for active project context, and @[app:slack] for the approval summary.",
			"",
			"## Workflow",
			"1. Find new agent-reaper-bot issues assigned to me.",
			"2. Pull the agent name, owner, last activity, linked project, and reason the bot flagged it.",
			"3. Compare each agent against active Studio, Rovo Skills, showcase, customer-facing, and stakeholder-request signals.",
			"4. Place each item in **keep**, **safe to close**, or **needs review** with the evidence that drove the call.",
			"5. Draft ticket comments, bulk-action suggestions, and a Slack summary for approval.",
			"",
			"## Output shape",
			"- **Decision table** Agent, Jira issue, recommendation, confidence, and evidence.",
			"- **Safe actions** Draft close/comment actions only for obvious prototype or test agents.",
			"- **Escalations** Anything linked to active work, a named stakeholder, a template, or a showcase.",
			"- **Follow-up** Suggested keep-list updates so the same agent is not flagged again.",
			"",
			"## Guardrails",
			"Never close an agent linked to an active project, template, customer-facing showcase, or named stakeholder request.",
		].join("\n"),
	},
	{
		action: "create",
		agentId: "venn-weekly-sprint-atlas-digest-agent",
		name: "Weekly Sprint/Atlas Digest Agent",
		byline: "Weekly synthesis and update drafting",
		sourceLabel: "Generated from recent work patterns",
		description: "Creates a weekly Studio digest from Looms, Confluence edits, Slack feedback, Jira movement, Atlas milestones, and calendar context.",
		summary: "Runs at the end of the week to assemble shipped work, decisions, feedback, blockers, risks, and next focus into review-ready sprint and Atlas update drafts.",
		avatarSrc: "/avatar-agent-new/orange/research-scout.svg",
		conversationStarters: [
			"Draft this week's Studio sprint and Atlas digest.",
			"Pull together this week's Looms, Confluence edits, Jira movement, and Slack feedback.",
			"Summarize shipped work, decisions, risks, and next focus for leadership review.",
		],
		conversationStarterIcons: ["calendar", "page", "chart-bar"],
		triggers: [
			"Every Friday at 9am Sydney time",
			"You ask for a sprint or Atlas digest",
		],
		automationRules: [
			{
				id: "weekly-studio-digest",
				name: "Draft weekly Studio digest",
				description: "Prepare sprint-channel and Atlas update drafts every Friday with source-backed highlights.",
				enabled: true,
				prompt: [
					"Every Friday at 9am Sydney time, gather this week's Looms, Confluence edits, Jira movement, Slack feedback, Atlas changes, and recurring meeting context.",
					"Draft a concise sprint update and Atlas-ready variants with sections for shipped work, decisions, feedback, blockers, risks, and next focus.",
					"Flag project status language and stakeholder-sensitive claims for my approval before publishing.",
				].join(" "),
				triggers: [
					{
						id: "weekly-friday-studio-digest",
						providerId: "scheduled",
						eventId: "custom-schedule",
						label: "Every Friday at 9:00 AM Sydney time",
						params: {},
						connectionState: "connected",
					},
					{
						id: "atlas-page-updated",
						providerId: "confluence",
						eventId: "page-updated",
						label: "Atlas or Studio page updated",
						params: { space: "any-space", actor: "anyone" },
						connectionState: "connected",
					},
				],
			},
		],
		tools: ["loom", "confluence", "slack", "jira", "calendar", "atlassian-home"],
		apps: ["loom", "confluence", "slack", "jira", "calendar", "atlassian-home"],
		skills: ["standup-summarizer", "capture-insights", "build-report", "milestone-tracker"],
		knowledge: ["Studio v2", "Rovo powered by Skills", "Agents creation experience vision", "Atlas project update style guide", "Weekly sprint update archive"],
		guardrail: "Draft updates for review; never mark Atlas projects on track or off track without your confirmation.",
		memoryMode: "on",
		reasoningMode: "balanced",
		knowledgeMode: "custom",
		instructions: [
			"You are my weekly Studio update synthesis assistant.",
			"",
			"## Apps",
			"Use @[app:loom], @[app:confluence], @[app:slack], @[app:jira], @[app:calendar], and @[app:atlassian-home] to prepare weekly sprint and Atlas update drafts.",
			"",
			"## Workflow",
			"1. Gather the week's Loom sharebacks, Confluence edits, Slack feedback, Atlas changes, Jira signals, and recurring meeting context.",
			"2. Cluster the raw signals into shipped work, decisions, customer/team feedback, blockers, risks, and next focus.",
			"3. Link each claim back to the strongest source so the update is easy to audit.",
			"4. Draft sprint-channel copy, Atlas project update variants, and a leadership-ready summary.",
			"5. Ask me to approve project status language and sensitive stakeholder claims before publishing.",
			"",
			"## Output shape",
			"- **Sprint update** Short Slack-ready summary with links and owners.",
			"- **Atlas update** Status narrative, risks, and next milestone copy for each relevant project.",
			"- **Decision log** What changed, who decided it, and where the source lives.",
			"- **Review flags** Claims that need approval before publishing.",
			"",
			"## Guardrails",
			"Keep the update concise, evidence-backed, and reviewable. Do not invent project status or stakeholder decisions.",
		].join("\n"),
	},
];

function cloneJson(value) {
	return structuredClone(value);
}

function buildStudioAutomationDiscoveryGeneratedAgentResults() {
	return GENERATED_AGENT_FIXTURES.map((agentResult) => cloneJson(agentResult));
}

function buildStudioAutomationDiscoveryArtifactAgent(agentResult) {
	return {
		item: {
			id: agentResult.agentId,
			title: agentResult.name,
			source: "Studio draft",
			owner: agentResult.byline,
			logoSrc: agentResult.avatarSrc,
		},
		agentResult,
	};
}

function buildStudioAutomationDiscoveryArtifactAgents() {
	return buildStudioAutomationDiscoveryGeneratedAgentResults()
		.map((agentResult) => buildStudioAutomationDiscoveryArtifactAgent(agentResult));
}

function buildStudioAutomationDiscoveryWidgetPayload({ widgetType }) {
	return {
		type: widgetType,
		title: "Generated agents",
		summary: "Three evidence-backed Studio drafts from your recent work patterns.",
		agents: buildStudioAutomationDiscoveryArtifactAgents(),
		created: [
			"Loom Distribution Agent for shareback routing and Atlas update drafts.",
			"Inactive Agent Triage Agent for agent-reaper-bot Jira lifecycle cleanup.",
			"Weekly Sprint/Atlas Digest Agent for weekly synthesis and update drafting.",
		],
		skipped: [
			"Design support auto-replies: useful, but too judgment-heavy to post without your review.",
			"Broad stakeholder broadcasts: high reach, but needs tighter audience rules before automation.",
		],
		needsEvidence: [
			"Design crit prep: recurring, but the source evidence needs a clearer trigger and agenda owner.",
			"Atlas project sync variants: promising, but needs stronger project-to-update mapping confidence.",
		],
	};
}

module.exports = {
	STUDIO_AUTOMATION_DISCOVERY_DEMO_USER,
	buildStudioAutomationDiscoveryArtifactAgent,
	buildStudioAutomationDiscoveryArtifactAgents,
	buildStudioAutomationDiscoveryGeneratedAgentResults,
	buildStudioAutomationDiscoveryWidgetPayload,
};
