const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const AGENT_ACTIVITY_SOURCE = readFileSync(join(__dirname, "agent-activity.tsx"), "utf8");
const AGENT_ACTIVITY_PRESENTATION_SOURCE = readFileSync(
	join(__dirname, "agent-activity-row-presentation.tsx"),
	"utf8",
);
const AGENT_ACTIVITY_STARTUP_SOURCE = readFileSync(join(__dirname, "agent-activity-startup.tsx"), "utf8");
const TEXT_EFFECTS_SOURCE = readFileSync(join(__dirname, "../../visual/text-effects/index.tsx"), "utf8");
const GENERATIVE_ACTIONS_SOURCE = readFileSync(
	join(__dirname, "../../projects/jira-golden-journeys-v4/hooks/use-jira-golden-journeys-v4-generative-actions.ts"),
	"utf8",
);

test("assignment flyout access is independent of the session lifecycle", () => {
	const assignmentHandle = AGENT_ACTIVITY_PRESENTATION_SOURCE.slice(
		AGENT_ACTIVITY_PRESENTATION_SOURCE.indexOf("export function JiraIssueAgentAssignmentHandle"),
		AGENT_ACTIVITY_PRESENTATION_SOURCE.indexOf("export function JiraIssueAgentRowSurface"),
	);
	assert.match(assignmentHandle, /if \(!showAssignmentFlyout\) \{\s*return rowHandle;/u);
	assert.match(assignmentHandle, /<AgentAssignment[\s\S]*openMode="click"[\s\S]*side="right"[\s\S]*trigger=\{rowHandle\}/u);
	assert.doesNotMatch(assignmentHandle, /isCompletedRow|\.state\s*===|\.state\s*!==/u);
});

test("chin rows keep lifecycle copy stable while flyout rows retain detailed status sequences", () => {
	assert.match(
		AGENT_ACTIVITY_PRESENTATION_SOURCE,
		/if \(isAwaitingInput\) \{[\s\S]*<span[\s\S]*\{rowLabel\}[\s\S]*<AnimatedDots/u,
	);
	assert.doesNotMatch(
		AGENT_ACTIVITY_PRESENTATION_SOURCE,
		/isAwaitingInput \? \([\s\S]*?<Shimmer[\s\S]*?\{rowLabel\}/u,
	);
	assert.match(AGENT_ACTIVITY_PRESENTATION_SOURCE, /className="block min-w-0 flex-1 truncate text-sm leading-5 text-text"[\s\S]*\{rowLabel\}/u);
	assert.doesNotMatch(AGENT_ACTIVITY_PRESENTATION_SOURCE, /JiraIssueCyclingAgentLabel|JIRA_ISSUE_AGENT_SHIMMER/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /statusSequence: activity\.state === "working" \? getJiraIssueAgentWorkingLabels\(activity\) : undefined/u);
});

test("new Jira agent and skill sessions use the staged startup presentation", () => {
	assert.match(GENERATIVE_ACTIONS_SOURCE, /startupSequence: "jira-work-item-start"/u);
	assert.match(GENERATIVE_ACTIONS_SOURCE, /startedAtMs: Date\.now\(\)/u);
	assert.match(
		GENERATIVE_ACTIONS_SOURCE,
		/progressJiraGoldenJourneysV4WorkItemOnStart\(\s*linkJiraKanbanAgentSession\(columns, card\.code, activity\),\s*card\.code,\s*\)/u,
	);
	assert.match(AGENT_ACTIVITY_STARTUP_SOURCE, /import TextEffects from "@\/components\/visual\/text-effects";/u);
	assert.match(
		AGENT_ACTIVITY_STARTUP_SOURCE,
		/import \{ configForEffect \} from "@\/components\/visual\/text-effects\/data";/u,
	);
	assert.match(AGENT_ACTIVITY_STARTUP_SOURCE, /text="Let's get started"/u);
	assert.match(AGENT_ACTIVITY_STARTUP_SOURCE, /presentation="inline"/u);
	assert.match(AGENT_ACTIVITY_STARTUP_SOURCE, /splitBy: "word"/u);
	assert.match(
		AGENT_ACTIVITY_STARTUP_SOURCE,
		/flex min-w-0 flex-1 items-baseline gap-1 overflow-hidden text-sm leading-5 text-text/u,
	);
	assert.match(AGENT_ACTIVITY_STARTUP_SOURCE, /baseColor="var\(--color-text\)"/u);
	assert.match(AGENT_ACTIVITY_STARTUP_SOURCE, /block min-w-0 truncate text-sm leading-5/u);
	assert.doesNotMatch(AGENT_ACTIVITY_STARTUP_SOURCE, /text-text-subtlest|text-xs leading-4/u);
	assert.match(AGENT_ACTIVITY_STARTUP_SOURCE, /jira-agent-wave-motion/u);
	assert.match(AGENT_ACTIVITY_PRESENTATION_SOURCE, /Gathering context/u);
	assert.match(AGENT_ACTIVITY_PRESENTATION_SOURCE, /<TWGLoader label="" size="small" \/>/u);
	assert.match(AGENT_ACTIVITY_STARTUP_SOURCE, /<Shimmer[\s\S]*>\s*\{label\}\s*<\/Shimmer>/u);
	assert.match(AGENT_ACTIVITY_STARTUP_SOURCE, /className="block min-w-0 truncate text-sm leading-5"/u);
	assert.match(AGENT_ACTIVITY_STARTUP_SOURCE, /shouldReduceMotion \? "working"/u);
	assert.match(AGENT_ACTIVITY_STARTUP_SOURCE, /Date\.now\(\) - startedAtMs/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /featuredActivity\?\.startedAtMs/u);
	assert.match(TEXT_EFFECTS_SOURCE, /import \{ AnimatePresence, motion,/u);
	assert.match(
		TEXT_EFFECTS_SOURCE,
		/presentation === "inline"[\s\S]*<AnimatePresence initial>\s*<span className=\{cn\("inline-block", className\)\} lang="en">\s*\{renderedText\}[\s\S]*<\/AnimatePresence>/u,
	);
	assert.doesNotMatch(TEXT_EFFECTS_SOURCE, /<AnimatePresence initial>\s*<span key=\{animationKey\}/u);
});
