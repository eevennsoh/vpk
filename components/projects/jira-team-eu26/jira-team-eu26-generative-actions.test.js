const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readProjectFile(relativePath) {
	return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const PAGE_SOURCE = readProjectFile("components/projects/jira-team-eu26/page.tsx");
const GENERATIVE_ACTIONS_HOOK_SOURCE = readProjectFile(
	"components/projects/jira-team-eu26/hooks/use-jira-team-eu26-generative-actions.ts",
);
const EXPERIMENTAL_PAGE_SOURCE = [
	readProjectFile("components/blocks/jira-kanban/experimental/page.tsx"),
	readProjectFile("components/blocks/jira-kanban/experimental/experimental-page-types.ts"),
].join("\n");
const JGP_ROVO_OVERLAY_SOURCE = readProjectFile(
	"components/projects/jira-golden-journeys-v1/components/jira-golden-journeys-v1-rovo-overlay.tsx",
);
const ROVO_FLOATING_CHAT_SOURCE = readProjectFile(
	"components/projects/rovo-floating-chat/components/rovo-floating-chat.tsx",
);

test("card agent and skill actions start a coding-agent session and stage the selected skill in floating chat", () => {
	assert.match(
		GENERATIVE_ACTIONS_HOOK_SOURCE,
		/createAssignedActivity\([\s\S]*createJgpKanbanActivity[\s\S]*request\.kind === "agent" \|\| request\.kind === "skill"[\s\S]*linkJiraKanbanAgentSession\(columns, card\.code, activity\)/u,
	);
	assert.match(
		GENERATIVE_ACTIONS_HOOK_SOURCE,
		/request\.kind !== "skill"[\s\S]*openAgentChat\(\{[\s\S]*agentId: JGP_KANBAN_DEFAULT_AGENT_ID,[\s\S]*agentName: "Claude",[\s\S]*issueKey: card\.code,[\s\S]*request: request\.prompt,[\s\S]*skillInvocation: \{[\s\S]*id: getSkillMentionId\(request\.selectedItem\.id\),[\s\S]*label: request\.selectedItem\.label/u,
	);
	assert.match(GENERATIVE_ACTIONS_HOOK_SOURCE, /message: `Claude is applying \$\{skillName\} to \$\{card\.code\}\.`/u);
	assert.match(
		GENERATIVE_ACTIONS_HOOK_SOURCE,
		/setComposerPrefillRequest\(\{[\s\S]*category: "skill",[\s\S]*id: getSkillMentionId\(request\.selectedItem\.id\),[\s\S]*label: request\.selectedItem\.label,[\s\S]*requestKey:/u,
	);
	assert.match(PAGE_SOURCE, /useJiraTeamEu26GenerativeActions\(\{[\s\S]*openAgentChat,[\s\S]*setBoardColumns,[\s\S]*\}\)/u);
	assert.match(PAGE_SOURCE, /onCardGenerativeActionSubmit=\{handleCardGenerativeActionSubmit\}/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /onCardGenerativeActionSubmit\?: JiraKanbanProps\["onCardGenerativeActionSubmit"\]/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /<ExperimentalJiraKanban[\s\S]*onCardGenerativeActionSubmit=\{onCardGenerativeActionSubmit\}/u);
	assert.match(PAGE_SOURCE, /<JgpRovoOverlay[\s\S]*composerPrefillRequest=\{composerPrefillRequest\}/u);
	assert.match(
		GENERATIVE_ACTIONS_HOOK_SOURCE,
		/handleComposerPrefillConsumed = useCallback\(\(requestKey: number\)[\s\S]*current\?\.requestKey === requestKey \? undefined : current/u,
	);
	assert.match(PAGE_SOURCE, /onComposerPrefillConsumed=\{handleComposerPrefillConsumed\}/u);
	assert.match(JGP_ROVO_OVERLAY_SOURCE, /<RovoFloatingChat[\s\S]*composerPrefillRequest=\{composerPrefillRequest\}/u);
	assert.match(JGP_ROVO_OVERLAY_SOURCE, /<RovoFloatingChat[\s\S]*onComposerPrefillConsumed=\{onComposerPrefillConsumed\}/u);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /<ChatPanel[\s\S]*composerPrefillRequest=\{composerPrefillRequest\}[\s\S]*onComposerPrefillConsumed=\{onComposerPrefillConsumed\}/u);
});
