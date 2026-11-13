const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const ITEM_SOURCE = readFileSync(join(__dirname, "jira-for-you-item.tsx"), "utf8");
const DATA_SOURCE = readFileSync(join(__dirname, "data.ts"), "utf8");
const SECTION_SOURCE = readFileSync(join(__dirname, "jira-for-you-section.tsx"), "utf8");
const STATUS_SOURCE = readFileSync(join(__dirname, "jira-for-you-status.tsx"), "utf8");
const TYPES_SOURCE = readFileSync(join(__dirname, "jira-for-you-types.ts"), "utf8");

test("CRM analytics activity summarizes each agent status", () => {
	assert.match(
		DATA_SOURCE,
		/id: "crm-analytics-dashboard"[\s\S]*agents: \[READINESS_AGENT, REVIEWER_AGENT, FEEDBACK_AGENT\][\s\S]*status: "1 Needs input, 2 In progress"/,
	);
	assert.match(
		ITEM_SOURCE,
		/return \/awaiting user\|needs input\/i\.test\(status\);/,
	);
});

test("Jira For You uses the shared elapsed-time primitive", () => {
	assert.match(TYPES_SOURCE, /elapsedSeconds\?: number;/u);
	assert.match(DATA_SOURCE, /id: "performance-benchmarking"[\s\S]*elapsedSeconds: 300,/u);
	assert.match(ITEM_SOURCE, /import \{ ElapsedTime \} from "@\/components\/ui\/elapsed-time";/u);
	assert.match(ITEM_SOURCE, /<ElapsedTime[\s\S]*elapsedSeconds=\{item\.elapsedSeconds\}[\s\S]*prefix=\{item\.status \? <MetadataDot \/> : null\}/u);
});

test("removed stop action is not advertised by the item contract", () => {
	assert.doesNotMatch(TYPES_SOURCE, /\bisRunning\??:/);
	assert.doesNotMatch(DATA_SOURCE, /\bisRunning:/);
	assert.doesNotMatch(ITEM_SOURCE, /Stop agents|VideoStopOverlayIcon/);
});

test("every row has a Jira status lozenge with a status-change dropdown", () => {
	assert.equal(DATA_SOURCE.match(/jiraStatus: /g)?.length, 10);
	// Resting state shows the read-only lozenge; hover reveals the interactive
	// status-change dropdown inside the row actions.
	assert.match(STATUS_SOURCE, /<Lozenge variant=\{STATUS_VARIANTS\[value\]\}>\{value\}<\/Lozenge>/);
	// The dropdown lives in the hover-revealed ItemActions cluster, alongside View.
	assert.match(
		ITEM_SOURCE,
		/function ItemActions\([\s\S]*<JiraForYouStatusLozengeDropdown value=\{item\.jiraStatus\} \/>[\s\S]*View[\s\S]*\n\}/,
	);
	// Standard compact outline Button trigger (matches the sibling View button's
	// 24px height) with a chevron, plus colored lozenge options with a checkmark
	// on the current status, mirroring the agent-session StatusPill dropdown.
	assert.match(STATUS_SOURCE, /<DropdownMenuTrigger[\s\S]*<Button[\s\S]*size="compact"[\s\S]*variant="outline"[\s\S]*<ChevronDownIcon/);
	assert.match(STATUS_SOURCE, /<DropdownMenuItem[\s\S]*selected=\{option === selected\}[\s\S]*<Lozenge variant=\{STATUS_VARIANTS\[option\]\}>/);
	assert.match(STATUS_SOURCE, /setSelected\(option\)/);
	assert.match(STATUS_SOURCE, /Review: "warning"/);
	assert.match(STATUS_SOURCE, /"In progress": "information"/);
	assert.match(STATUS_SOURCE, /"In review": "information"/);
	assert.match(STATUS_SOURCE, /"To do": "neutral"/);
	assert.match(STATUS_SOURCE, /Done: "success"/);
});

test("Refactor readability stays aligned with the in-progress section", () => {
	assert.match(
		DATA_SOURCE,
		/id: "refactor-readability"[\s\S]*jiraStatus: "In progress"[\s\S]*status: "In progress"/u,
	);
});

test("Jira For You rows place agent activity before issue metadata", () => {
	assert.match(
		ITEM_SOURCE,
		/\{item\.title\}[\s\S]*data-slot="jira-for-you-metadata"[\s\S]*<AgentAvatarCluster agents=\{item\.agents\} \/>[\s\S]*data-slot="jira-for-you-metadata-text"[\s\S]*\{item\.status\}[\s\S]*<MetadataDot \/>[\s\S]*\{meta\.label\}[\s\S]*\{item\.issueKey\}[\s\S]*\{item\.spaceName\}/,
	);
	assert.match(
		ITEM_SOURCE,
		/function MetadataDot\(\)[\s\S]*className="mx-1 text-text-subtlest"[\s\S]*data-slot="jira-for-you-metadata-separator"[\s\S]*·/,
		"middle-dot separators should preserve the original spacing on both sides",
	);
	assert.match(
		ITEM_SOURCE,
		/trailingComma && "mr-1"/,
		"comma-separated status segments should preserve their original four-pixel gap",
	);
	assert.match(
		ITEM_SOURCE,
		/<Spinner[\s\S]*className="ml-1 inline-block align-middle"/,
		"status spinners should preserve their original four-pixel gap",
	);
});

test("Jira For You rows collapse the resting lozenge slot in constrained containers", () => {
	assert.match(
		SECTION_SOURCE,
		/<ul className="[^"]*@container\/jira-for-you-items[^"]*">/,
		"the item list should own the inline-size query instead of relying on viewport width",
	);
	assert.match(
		ITEM_SOURCE,
		/className=\{cn\(\s*"[^"]*ml-0[^"]*w-0[^"]*group-hover:ml-3[^"]*group-hover:w-auto[^"]*group-has-\[:focus-visible\]:ml-3[^"]*group-has-\[:focus-visible\]:w-auto[^"]*@\[560px\]\/jira-for-you-items:ml-3[^"]*@\[560px\]\/jira-for-you-items:w-auto"[\s\S]*data-slot="jira-for-you-trailing"/,
		"the narrow resting trailing slot should reserve neither lozenge width nor gap",
	);
	assert.match(
		ITEM_SOURCE,
		/className=\{cn\(\s*"hidden[^"]*@\[560px\]\/jira-for-you-items:block[^"]*group-hover:hidden[^"]*group-has-\[:focus-visible\]:hidden/,
		"the resting lozenge should only appear in wide containers and yield to actions",
	);
	assert.match(
		ITEM_SOURCE,
		/className="min-w-0 flex-1 truncate"[\s\S]*data-slot="jira-for-you-metadata-text"/,
		"the aggregate metadata text should own truncation after the fixed avatar cluster",
	);
	assert.doesNotMatch(
		ITEM_SOURCE,
		/"flex min-w-0 flex-1 flex-col items-start justify-center overflow-hidden/,
		"the row content button should not hard-clip title and metadata together",
	);
	assert.match(
		ITEM_SOURCE,
		/data-slot="jira-for-you-metadata"[\s\S]*<AgentAvatarCluster agents=\{item\.agents\} \/>[\s\S]*className="min-w-0 flex-1 truncate"[\s\S]*data-slot="jira-for-you-metadata-text"/,
		"agent avatars should remain outside the shrinking metadata text owner",
	);
});

test("Jira For You sparkle action opens the shared Jira issue generative menu", () => {
	assert.match(
		ITEM_SOURCE,
		/import \{ JiraIssueGenerativeActionMenu \} from "@\/components\/blocks\/jira-issue\/generative-action-menu";/,
	);
	assert.match(
		ITEM_SOURCE,
		/import \{ RovoSparkleButton \} from "@\/components\/ui-custom\/rovo-sparkle";/,
	);
	assert.match(
		ITEM_SOURCE,
		/const generativeTrigger = \([\s\S]*<RovoSparkleButton[\s\S]*aria-label="Ask Rovo about this work item"[\s\S]*size="compact"[\s\S]*<JiraIssueGenerativeActionMenu[\s\S]*issue=\{\{ issueKey: item\.issueKey, summary: item\.title \}\}[\s\S]*triggerElement=\{generativeTrigger\}/,
	);
	assert.doesNotMatch(ITEM_SOURCE, /GenerativeIndicatorIcon/);
	assert.doesNotMatch(ITEM_SOURCE, /hideWhenSelected/);
	assert.match(ITEM_SOURCE, /onClick=\{\(event\) => event\.stopPropagation\(\)\}/);
	assert.match(
		ITEM_SOURCE,
		/has-\[button\[aria-expanded=true\]\]:pointer-events-auto[^"]*has-\[button\[aria-expanded=true\]\]:opacity-100/,
		"the For You row actions should remain visible while the generative menu is open",
	);
	assert.match(ITEM_SOURCE, /data-slot="jira-for-you-actions"/);
	assert.match(ITEM_SOURCE, /group-hover:pointer-events-auto[^"]*group-hover:opacity-100/);
	assert.match(ITEM_SOURCE, /group-has-\[:focus-visible\]:pointer-events-auto[^"]*group-has-\[:focus-visible\]:opacity-100/);
	assert.match(
		ITEM_SOURCE,
		/invisible flex w-0 items-center gap-1 overflow-hidden opacity-0[^"]*group-hover:visible group-hover:w-auto group-hover:overflow-visible group-hover:opacity-100/,
		"the hidden actions should expand in flow so the text column shrinks instead of sitting underneath them",
	);
	assert.doesNotMatch(
		ITEM_SOURCE,
		/absolute top-1\/2 right-0 flex/,
		"the action cluster must participate in row layout when visible",
	);
	assert.match(
		ITEM_SOURCE,
		/group-hover:hidden group-has-\[:focus-visible\]:hidden/,
		"the resting lozenge should make way for the expanded action cluster",
	);
	assert.doesNotMatch(ITEM_SOURCE, /bg-linear-to-l|from-bg-neutral-subtle-hovered|to-transparent/);
});
