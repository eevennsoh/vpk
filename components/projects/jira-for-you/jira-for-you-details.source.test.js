const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const DATA_SOURCE = readFileSync(join(__dirname, "data.ts"), "utf8");
const DETAIL_PANEL_SOURCE = readFileSync(join(__dirname, "jira-for-you-detail-panel.tsx"), "utf8");
const WORKSPACE_DATA_SOURCE = readFileSync(join(__dirname, "jira-for-you-workspace-data.ts"), "utf8");
const WORKSPACE_TYPES_SOURCE = readFileSync(join(__dirname, "jira-for-you-workspace-types.ts"), "utf8");
const STATUS_SOURCE = readFileSync(join(__dirname, "jira-for-you-status.tsx"), "utf8");
const TYPES_SOURCE = readFileSync(join(__dirname, "jira-for-you-types.ts"), "utf8");
const SESSION_FLYOUT_SOURCE = readFileSync(
	join(process.cwd(), "components/blocks/product-sidebar/variants/jira-session-flyout.tsx"),
	"utf8",
);
const DIRECTORY_AGENTS = JSON.parse(
	readFileSync(join(process.cwd(), "app/data/directory/agents.json"), "utf8"),
);

test("Jira For You agent identities come from the canonical directory", () => {
	const expectedIds = [
		"readiness-checker",
		"progress-tracker",
		"code-reviewer",
		"code-planner",
		"feedback-analyzer",
	];
	const directoryById = new Map(DIRECTORY_AGENTS.map((agent) => [agent.id, agent]));

	for (const agentId of expectedIds) {
		const directoryAgent = directoryById.get(agentId);
		assert.ok(directoryAgent, `missing directory profile for ${agentId}`);
		assert.ok(directoryAgent.avatarSrc, `missing directory avatar for ${agentId}`);
		assert.match(DATA_SOURCE, new RegExp(`createJiraForYouAgent\\("${agentId}"\\)`, "u"));
	}

	assert.doesNotMatch(DATA_SOURCE, /name: "(?:Readiness|Progress|Code|Feedback)/u);
	assert.doesNotMatch(DATA_SOURCE, /avatarSrc: "\/avatar-agent\//u);
	assert.match(
		WORKSPACE_DATA_SOURCE,
		/const profile = getRovoAgentProfile\(agent\.id\);[\s\S]*return profile;/u,
	);
	assert.doesNotMatch(WORKSPACE_DATA_SOURCE, /avatarSrc: agent\.avatarSrc/u);
	assert.doesNotMatch(WORKSPACE_DATA_SOURCE, /name: agent\.name/u);
});

test("work-item details are stable and agent sessions contain only agent-scoped state", () => {
	const agentSessionType = WORKSPACE_TYPES_SOURCE.match(
		/interface JiraForYouWorkspaceAgentSession \{[^}]+\}/u,
	)?.[0];
	assert.ok(agentSessionType);
	assert.match(
		agentSessionType,
		/profile: RovoAgentProfile;[\s\S]*status: JiraSidebarSessionStatus;/u,
	);
	assert.doesNotMatch(
		agentSessionType,
		/\b(?:outputs|sources|workItem|development|session):/u,
	);
	assert.match(
		WORKSPACE_DATA_SOURCE,
		/interface WorkspaceAgentSeed \{\s*assistant: string;\s*activityTitle\?: string;\s*awaitingQuestions\?: readonly QuestionCardQuestion\[\];\s*composerPlaceholder\?: string;\s*messages\?: readonly RovoUIMessage\[\];\s*status\?: JiraSidebarSessionStatus;\s*\}/u,
	);
	assert.match(
		WORKSPACE_DATA_SOURCE,
		/details: createWorkspaceItemDetails\([\s\S]*item,[\s\S]*itemSeed,[\s\S]*primaryAgentSession\.profile,[\s\S]*\)/u,
	);
	assert.doesNotMatch(WORKSPACE_DATA_SOURCE, /primaryAgentSeed/u);
});

test("details place Agents directly after Development and keep shared flyouts unchanged by default", () => {
	assert.match(DETAIL_PANEL_SOURCE, /<JiraSessionFlyoutBody[\s\S]*hideAgentRow/u);
	assert.match(SESSION_FLYOUT_SOURCE, /hideAgentRow = false/u);
	assert.match(SESSION_FLYOUT_SOURCE, /\{hideAgentRow \? null : \(/u);

	const developmentIndex = DETAIL_PANEL_SOURCE.indexOf("<JiraSessionFlyoutBody");
	const agentIndex = DETAIL_PANEL_SOURCE.indexOf("<AgentSection");
	const sourcesIndex = DETAIL_PANEL_SOURCE.indexOf("<DetailArtifacts");
	assert.ok(developmentIndex >= 0 && developmentIndex < agentIndex);
	assert.ok(agentIndex < sourcesIndex);
});

test("the Agents section directly reuses Agent List with native states and selection", () => {
	assert.match(
		DETAIL_PANEL_SOURCE,
		/import \{[\s\S]*AgentList,[\s\S]*type AgentListItem,[\s\S]*\} from "@\/components\/blocks\/agent-list";/u,
	);
	assert.match(DETAIL_PANEL_SOURCE, /<AgentList/u);
	assert.match(DETAIL_PANEL_SOURCE, /aria-labelledby="jira-for-you-agents-heading"/u);
	assert.match(
		DETAIL_PANEL_SOURCE,
		/<JiraSessionSectionHeading id="jira-for-you-agents-heading">Agents<\/JiraSessionSectionHeading>/u,
	);
	assert.match(DETAIL_PANEL_SOURCE, /<AgentList[\s\S]*className="w-full"/u);
	assert.doesNotMatch(DETAIL_PANEL_SOURCE, /className="flex w-full flex-col gap-1 divide-y-0"/u);
	assert.doesNotMatch(DETAIL_PANEL_SOURCE, /divide-y-0/u);
	assert.match(DETAIL_PANEL_SOURCE, /items=\{sessionItems\}/u);
	assert.match(
		DETAIL_PANEL_SOURCE,
		/onSubmitPrompt=\{\(sessionItem, prompt\) => onAgentPrompt\(sessionItem\.id, prompt\)\}/u,
	);
	assert.match(DETAIL_PANEL_SOURCE, /onView=\{\(sessionItem\) => onAgentSelect\(sessionItem\.id\)\}/u);
	assert.match(DETAIL_PANEL_SOURCE, /selectedItemId=\{selectedAgentId\}/u);
	assert.match(DETAIL_PANEL_SOURCE, /variant="compact"/u);
	assert.match(DETAIL_PANEL_SOURCE, /title: agentSession\.activityTitle/u);
	assert.doesNotMatch(DETAIL_PANEL_SOURCE, /title: itemTitle/u);
	assert.match(
		DETAIL_PANEL_SOURCE,
		/agent: \{[\s\S]*avatarSrc: agentSession\.profile\.avatarSrc,[\s\S]*name: agentSession\.profile\.name,[\s\S]*\}/u,
	);
	assert.match(
		DETAIL_PANEL_SOURCE,
		/case "awaiting-input":[\s\S]*return "needs-input";[\s\S]*case "running":[\s\S]*return "running";[\s\S]*case "pr-open":[\s\S]*case "merged":[\s\S]*case "stopped":[\s\S]*return "complete";/u,
	);
	assert.doesNotMatch(DETAIL_PANEL_SOURCE, /<Tag|type="agent"|data-tag-text|data-slot=tag-before/u);
	assert.doesNotMatch(DETAIL_PANEL_SOURCE, /Shimmer|JiraSessionLifecycle|TileAvatar/u);
	assert.doesNotMatch(DETAIL_PANEL_SOURCE, /onStop/u);
});

test("CRM agent rows use distinct activity titles", () => {
	assert.match(
		WORKSPACE_DATA_SOURCE,
		/"crm-analytics-dashboard":[\s\S]*activityTitle: "Checking launch readiness"[\s\S]*activityTitle: "Reviewing aggregation logic"[\s\S]*activityTitle: "Analyzing launch feedback"/u,
	);
	assert.match(WORKSPACE_DATA_SOURCE, /activityTitle: agentSeed\?\.activityTitle \?\? item\.title/u);
});

test("Review is the sole warning review status", () => {
	assert.match(TYPES_SOURCE, /export type JiraForYouStatus = "Review"/u);
	assert.match(STATUS_SOURCE, /Review: "warning"/u);
	assert.doesNotMatch(`${DATA_SOURCE}\n${STATUS_SOURCE}\n${TYPES_SOURCE}`, /Human review/u);
});
