const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

const SUBAGENT_PAGE_SOURCE = readFileSync(join(__dirname, "page.tsx"), "utf8");
const SUBAGENT_NAVIGATOR_SOURCE = readFileSync(join(__dirname, "subagent-navigator.tsx"), "utf8");
const SUBAGENT_INDEX_SOURCE = readFileSync(join(__dirname, "index.ts"), "utf8");
const SUBAGENT_DATA_SOURCE = readFileSync(join(__dirname, "data", "demo-agents.ts"), "utf8");
const SUBAGENT_PROMPTS_LIB_SOURCE = readFileSync(
	join(__dirname, "lib", "subagent-prompts.ts"),
	"utf8",
);
const AGENT_SOURCE = readFileSync(join(__dirname, "..", "agent", "components", "agent.tsx"), "utf8");
const SUBAGENT_DEMO_SOURCE = readFileSync(
	join(__dirname, "..", "..", "website", "demos", "blocks", "subagent-demo.tsx"),
	"utf8",
);
const WEBSITE_REGISTRY_SOURCE = readWebsiteRegistrySource();
const BLOCK_DETAILS_SOURCE = readDetailCategorySource("blocks");

test("Subagent models one base agent with conditional prompt copies", () => {
	assert.match(SUBAGENT_PAGE_SOURCE, /initialBaseAgent\?: SubagentBaseAgent/u);
	assert.match(SUBAGENT_PAGE_SOURCE, /initialSubagents\?: ReadonlyArray<SubagentPrompt>/u);
	assert.match(SUBAGENT_PAGE_SOURCE, /initialActiveSubagentId\?: string/u);
	assert.match(SUBAGENT_PAGE_SOURCE, /getBaseConfigWithSubagents/u);
	assert.match(SUBAGENT_PAGE_SOURCE, /profileConfig=\{baseConfig\}/u);
	assert.match(SUBAGENT_PAGE_SOURCE, /onProfileTextChange=\{handleBaseTextChange\}/u);
	assert.doesNotMatch(SUBAGENT_PAGE_SOURCE, /SubagentActiveAgentField/u);
	assert.doesNotMatch(SUBAGENT_PAGE_SOURCE, /SubagentAgentAvatar/u);
	assert.doesNotMatch(SUBAGENT_PAGE_SOURCE, /SubagentAgent/u);
	assert.doesNotMatch(SUBAGENT_INDEX_SOURCE, /SubagentAgent/u);
});

test("Subagent prompt data has trigger metadata and no separate agent identity", () => {
	const promptInterfaceStart = SUBAGENT_DATA_SOURCE.indexOf("export interface SubagentPrompt");
	const baseFixtureStart = SUBAGENT_DATA_SOURCE.indexOf("export const DEFAULT_SUBAGENT_BASE_AGENT", promptInterfaceStart);
	const promptInterface = SUBAGENT_DATA_SOURCE.slice(promptInterfaceStart, baseFixtureStart);
	const promptFixturesStart = SUBAGENT_DATA_SOURCE.indexOf("export const SUBAGENT_DEMO_PROMPTS");
	const promptFixtures = SUBAGENT_DATA_SOURCE.slice(promptFixturesStart);

	assert.match(SUBAGENT_DATA_SOURCE, /export interface SubagentBaseAgent/u);
	assert.match(promptInterface, /export interface SubagentPrompt/u);
	assert.match(promptInterface, /triggerName: string/u);
	assert.match(promptInterface, /condition: string/u);
	assert.match(SUBAGENT_DATA_SOURCE, /subagents: \[\]/u);
	assert.doesNotMatch(SUBAGENT_DATA_SOURCE, /SubagentAgentKind|kind: "master"|kind: "subagent"/u);
	assert.doesNotMatch(promptInterface, /avatarSrc|name\?|agentId/u);
	assert.doesNotMatch(promptFixtures, /avatarSrc|agentId: "policy-source-needed"|agentId: "benefits-question"/u);
});

test("Subagent name and trigger condition are edited in the profile header", () => {
	// The header title edits the subagent name; the description slot becomes the
	// trigger condition. The old lower SubagentPromptFields rows are removed so
	// the same fields never appear in two places.
	assert.match(AGENT_SOURCE, /placeholder=\{isSubagent \? UNTITLED_SUBAGENT_NAME : "Untitled agent"\}/u);
	assert.match(AGENT_SOURCE, /placeholder=\{isSubagent \? "Describe the situation that should trigger this subagent" : "Add a description"\}/u);
	assert.match(AGENT_SOURCE, /isSubagent \? onSubagentConditionChange\?\.\(value\) : onTextChange\?\.\("description", value\)/u);
	assert.doesNotMatch(SUBAGENT_PAGE_SOURCE, /SubagentPromptFields|compactFooterBefore/u);
	assert.doesNotMatch(SUBAGENT_INDEX_SOURCE, /SubagentPromptFields/u);
	// Both surfaces feed the subagent condition into the header.
	assert.match(SUBAGENT_PAGE_SOURCE, /subagentCondition=\{activePrompt\?\.condition\}/u);
	assert.match(SUBAGENT_PAGE_SOURCE, /onSubagentConditionChange=\{handleConditionChange\}/u);
});

test("Subagent switcher uses base agent header and trigger-name prompt rows", () => {
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /baseAgent: SubagentBaseAgent/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /subagents: ReadonlyArray<SubagentPrompt>/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /getSubagentDisplayName\(prompt/u);
	// The fallback label lives in the shared lib (single source of truth) so the
	// navigator, manage dialog, and profile header can never drift apart.
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /import \{ getSubagentDisplayName \} from "@\/components\/blocks\/subagent\/lib\/subagent-prompts"/u);
	assert.doesNotMatch(SUBAGENT_NAVIGATOR_SOURCE, /Untitled trigger/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /MINIMAP_BASE_BAR_WIDTH_PX = 26/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /MINIMAP_PROMPT_BAR_WIDTH_PX = 16/u);
	assert.doesNotMatch(SUBAGENT_NAVIGATOR_SOURCE, /getAgentDescription|toSnippet|config\.name\?\.trim\(\) \|\| \(agent\.kind/u);
	assert.doesNotMatch(SUBAGENT_NAVIGATOR_SOURCE, /variant ===|rounded-b-lg|rounded-t"/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /SWITCHER_PANEL_PADDING_Y_PX = 16/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /SWITCHER_BASE_ROW_HEIGHT_PX = 36/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /SWITCHER_DIVIDER_BLOCK_HEIGHT_PX = 17/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /SWITCHER_ROW_HEIGHT_PX = 36/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /subagents\.length \* SWITCHER_ROW_HEIGHT_PX/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /SWITCHER_LIST_FOOTER_GAP_PX = 8/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /<div className="shrink-0 pb-2">/u);
	assert.doesNotMatch(SUBAGENT_NAVIGATOR_SOURCE, /SWITCHER_OPEN_MAX_HEIGHT_PX|Math\.min\(|overflow-y-auto/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /SWITCHER_FOOTER_CHROME_PX = 9/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /SWITCHER_FOOTER_ACTION_HEIGHT_PX = 32/u);
	assert.doesNotMatch(SUBAGENT_NAVIGATOR_SOURCE, /SWITCHER_HEADER_HEIGHT_PX|footerActionCount/u);
	assert.doesNotMatch(SUBAGENT_NAVIGATOR_SOURCE, /sticky top-0/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /data-slot="dropdown-menu-item"[\s\S]*data-variant="default"/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /group\/dropdown-menu-item data-\[highlighted\]:bg-bg-neutral-subtle-hovered[\s\S]*relative flex min-h-8 w-full[\s\S]*gap-3 rounded-lg px-2 py-1\.5/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /data-selected:bg-bg-selected data-selected:text-text-selected/u);
	assert.doesNotMatch(SUBAGENT_NAVIGATOR_SOURCE, /CheckMarkIcon|check-mark/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /height: isSwitcherOpen \? openHeight : closedHeight/u);
	assert.doesNotMatch(SUBAGENT_NAVIGATOR_SOURCE, /const switcherHeight = isSwitcherOpen \? openHeight : closedHeight/u);
	assert.doesNotMatch(SUBAGENT_NAVIGATOR_SOURCE, /minHeight: switcherHeight/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /className="relative origin-top-right overflow-hidden text-left"/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /<span className="block min-w-0 truncate">\{label\}<\/span>/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /"absolute inset-0 flex flex-col p-2 text-left transition-opacity duration-normal ease-out"/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /isSwitcherOpen\s*\?\s*"pointer-events-auto opacity-100"\s*:\s*"pointer-events-none opacity-0"/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /sticky bottom-0 z-10 shrink-0 border-t border-border bg-surface-overlay pt-2/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /data-slot="subagent-switcher-avatar"[\s\S]*className="flex size-6 shrink-0 items-center justify-center/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /className="size-5 object-contain"[\s\S]*height=\{20\}[\s\S]*width=\{20\}/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /"dev-agents": "lime"/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /lime: "text-lime-400 \[&_svg\]:text-lime-400!"/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /"border border-border bg-surface"[\s\S]*tagColor \? subagentTagColorIconClassName\[tagColor\] : "text-icon-subtlest"/u);
	assert.doesNotMatch(SUBAGENT_NAVIGATOR_SOURCE, /variant="transparent"/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /frontSlot=\{renderSubagentSwitcherVisual\(subagentTagColor\)\}/u);
	assert.doesNotMatch(SUBAGENT_NAVIGATOR_SOURCE, /getDirectoryMentionItemOrFallback\("subagent"|RichTextMentionVisualMark/u);
});

test("Subagent navigator exposes create and manage actions", () => {
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /onManageSubagents\?: \(\) => void/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /function SubagentActionButton/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /label="Create subagent"/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /label="Manage subagents"/u);
	// The manage action only renders when wired.
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /onManageSubagents \? \(/u);
});

test("Manage subagents dialog is connected to the navigator manage action", () => {
	assert.match(SUBAGENT_INDEX_SOURCE, /ManageSubagentsDialog/u);
	assert.match(SUBAGENT_PAGE_SOURCE, /import \{ ManageSubagentsDialog \}/u);
	assert.match(SUBAGENT_PAGE_SOURCE, /onManageSubagents=\{\(\) => setIsManageSubagentsOpen\(true\)\}/u);
	assert.match(SUBAGENT_PAGE_SOURCE, /<ManageSubagentsDialog/u);
	assert.match(SUBAGENT_PAGE_SOURCE, /onDeleteSubagent=\{handleDeleteSubagent\}/u);
	assert.match(SUBAGENT_PAGE_SOURCE, /onReorderSubagents=\{handleReorderSubagents\}/u);
	assert.match(SUBAGENT_PAGE_SOURCE, /onToggleSubagent=\{handleToggleSubagent\}/u);
});

test("Create subagent adds and selects an empty prompt copy", () => {
	assert.match(SUBAGENT_PROMPTS_LIB_SOURCE, /function createDraftSubagentPrompt/u);
	assert.match(SUBAGENT_PROMPTS_LIB_SOURCE, /triggerName: ""/u);
	assert.match(SUBAGENT_PROMPTS_LIB_SOURCE, /condition: ""/u);
	assert.match(SUBAGENT_PAGE_SOURCE, /setSubagentPrompts\(\(currentPrompts\) => \[\.\.\.currentPrompts, prompt\]\)/u);
	assert.match(SUBAGENT_PAGE_SOURCE, /setActiveSubagentId\(prompt\.id\)/u);
});

test("Subagent creation is routed through the compact control panel", () => {
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /if \(subagents\.length === 0\) \{\s*return null;\s*\}/u);
	assert.doesNotMatch(SUBAGENT_NAVIGATOR_SOURCE, /h-7 rounded-full px-3|variant="outline"/u);
	assert.match(AGENT_SOURCE, /function AgentCompactSubagentsNavButton/u);
	assert.match(AGENT_SOURCE, /Manage subagents/u);
	assert.match(AGENT_SOURCE, /const isEmpty = item\.count === 0;[\s\S]*<AgentCompactNavMenuPinnedFooter bordered=\{!isEmpty\}>[\s\S]*onClick=\{onCreateSubagent\}[\s\S]*Add subagent/u);
	assert.match(AGENT_SOURCE, /onSelectListItem\?\.\("subagents", index\)/u);
	assert.match(SUBAGENT_PAGE_SOURCE, /function handleSelectConfigListItem/u);
	assert.match(SUBAGENT_PAGE_SOURCE, /onManageSubagents=\{\(\) => setIsManageSubagentsOpen\(true\)\}/u);
	assert.match(SUBAGENT_PAGE_SOURCE, /onSelectListItem=\{handleSelectConfigListItem\}/u);
});

test("Subagent compact removal uses prompt id instead of trigger-name identity", () => {
	assert.match(SUBAGENT_PROMPTS_LIB_SOURCE, /stable identity is its id/u);
	assert.match(SUBAGENT_PAGE_SOURCE, /const promptToRemove = derivedSubagentPrompts\[index\];[\s\S]*setSubagentPrompts\(\(currentPrompts\) => currentPrompts\.filter\(\(prompt\) => prompt\.id !== promptToRemove\.id\)\)/u);
	assert.doesNotMatch(SUBAGENT_PAGE_SOURCE, /const triggerNames = getDerivedSubagentNames\(subagentPrompts\)/u);
	assert.doesNotMatch(SUBAGENT_PAGE_SOURCE, /prompt\.triggerName\.trim\(\) === triggerName/u);
});

test("Subagent docs describe prompt copies instead of agent-directory links", () => {
	const subagentDetailsStart = BLOCK_DETAILS_SOURCE.indexOf("subagent: {");
	const terminalSwitchStart = BLOCK_DETAILS_SOURCE.indexOf('"terminal-switch"', subagentDetailsStart);
	const subagentDetails = BLOCK_DETAILS_SOURCE.slice(subagentDetailsStart, terminalSwitchStart);

	assert.match(subagentDetails, /SubagentBaseAgent/u);
	assert.match(subagentDetails, /SubagentPrompt/u);
	assert.match(subagentDetails, /triggerName/u);
	assert.match(subagentDetails, /initialBaseAgent/u);
	assert.match(subagentDetails, /initialSubagents/u);
	assert.match(subagentDetails, /No subagents/u);
	assert.match(subagentDetails, /subagent-demo-empty/u);
	assert.doesNotMatch(subagentDetails, /SubagentAgent|initialAgents|master orchestrator|agent directory|Chat transcript/u);
});

test("Subagent exposes a no-subagents demo variant with an empty prompt list", () => {
	assert.match(SUBAGENT_DEMO_SOURCE, /SubagentDemoEmpty/u);
	assert.match(SUBAGENT_DEMO_SOURCE, /initialSubagents=\{\[\]\}/u);
	assert.match(WEBSITE_REGISTRY_SOURCE, /"subagent-demo-empty"/u);
	assert.match(WEBSITE_REGISTRY_SOURCE, /SubagentDemoEmpty/u);
});

test("Agent profile header renders an inline back-to-parent icon button beside the subagent name", () => {
	// While editing a subagent the name field is preceded by a back-arrow icon
	// button (no extra row that pushes content down), wired to onSelectBaseAgent.
	// It only renders for subagents.
	assert.match(AGENT_SOURCE, /import ArrowLeftIcon from "@atlaskit\/icon\/core\/arrow-left"/u);
	assert.match(AGENT_SOURCE, /isSubagent \? \([\s\S]*?<Button/u);
	assert.match(AGENT_SOURCE, /data-agent-field="back-to-parent"/u);
	assert.match(AGENT_SOURCE, /aria-label="Back to parent agent"/u);
	assert.match(AGENT_SOURCE, /onClick=\{onSelectBaseAgent\}/u);
	assert.match(AGENT_SOURCE, /<ArrowLeftIcon label="" \/>/u);
	// The button matches the name field's ~40px height so the icon row aligns,
	// and forces the icon to 16px via the svg utility (no ADS size prop).
	// `rounded-md` matches the InlineEdit name field's read-view radius beside it.
	assert.match(AGENT_SOURCE, /className="size-10 shrink-0 rounded-md text-icon-subtle hover:text-icon \[&_svg\]:size-4"/u);
	// The old full-width "Back to parent" text row is gone.
	assert.doesNotMatch(AGENT_SOURCE, /Back to parent</u);
	// The big editable title switches to the subagent name with the restored
	// "Untitled subagent" placeholder, and edits route to onSubagentNameChange.
	assert.match(AGENT_SOURCE, /placeholder=\{isSubagent \? UNTITLED_SUBAGENT_NAME : "Untitled agent"\}/u);
	assert.match(AGENT_SOURCE, /isSubagent \? onSubagentNameChange\?\.\(value\) : onTextChange\?\.\("name", value\)/u);
});

test("Parent ⇄ subagent swap animates the profile header with a direction-aware transition", () => {
	// The header (back-link + name + description) crossfades and slides when
	// toggling between base agent and subagent, keyed on the view so AnimatePresence
	// runs enter/exit. popLayout avoids a layout jump while both copies are mounted.
	assert.match(AGENT_SOURCE, /<AnimatePresence custom=\{direction\} initial=\{false\} mode="popLayout">/u);
	assert.match(AGENT_SOURCE, /key=\{isSubagent \? "subagent" : "base"\}/u);
	// Direction is +1 entering a subagent, -1 returning to the parent, and 0
	// (pure crossfade, no slide) when the user prefers reduced motion.
	assert.match(AGENT_SOURCE, /const shouldReduceMotion = useReducedMotion\(\)/u);
	assert.match(AGENT_SOURCE, /const direction = shouldReduceMotion \? 0 : isSubagent \? 1 : -1/u);
	// Only opacity + transform animate, hinted via willChange for compositor.
	assert.match(AGENT_SOURCE, /willChange: "transform, opacity"/u);
	assert.match(AGENT_SOURCE, /AGENT_PROFILE_SWAP_TRANSITION = \{ type: "spring"/u);
});

test("Subagent page wires the subagent back link and name editing into AgentConfigFields", () => {
	assert.match(SUBAGENT_PAGE_SOURCE, /isSubagent=\{Boolean\(activePrompt\)\}/u);
	assert.match(SUBAGENT_PAGE_SOURCE, /subagentName=\{activePrompt\?\.triggerName\}/u);
	assert.match(SUBAGENT_PAGE_SOURCE, /onSelectBaseAgent=\{handleSelectBaseAgent\}/u);
	assert.match(SUBAGENT_PAGE_SOURCE, /onSubagentNameChange=\{handleTriggerNameChange\}/u);
});

test("Untitled subagent label is a single shared constant across all surfaces", () => {
	const MANAGE_DIALOG_SOURCE = readFileSync(
		join(__dirname, "components", "manage-subagents-dialog.tsx"),
		"utf8",
	);
	// Source of truth: the lib exports the constant and the shared helper.
	assert.match(SUBAGENT_PROMPTS_LIB_SOURCE, /export const UNTITLED_SUBAGENT_NAME = "Untitled subagent"/u);
	assert.match(SUBAGENT_PROMPTS_LIB_SOURCE, /export function getSubagentDisplayName/u);
	assert.match(SUBAGENT_PROMPTS_LIB_SOURCE, /prompt\.triggerName\.trim\(\) \|\| UNTITLED_SUBAGENT_NAME/u);
	// Every consumer resolves the label through the shared lib — no local copies.
	assert.match(AGENT_SOURCE, /import \{ UNTITLED_SUBAGENT_NAME \} from "@\/components\/blocks\/subagent\/lib\/subagent-prompts"/u);
	assert.match(MANAGE_DIALOG_SOURCE, /import \{ getSubagentDisplayName \} from "@\/components\/blocks\/subagent\/lib\/subagent-prompts"/u);
	assert.doesNotMatch(MANAGE_DIALOG_SOURCE, /Untitled trigger/u);
	assert.doesNotMatch(MANAGE_DIALOG_SOURCE, /function getSubagentDisplayName/u);
	// The old, drifting "Untitled trigger" fallback is gone everywhere.
	assert.doesNotMatch(SUBAGENT_PROMPTS_LIB_SOURCE, /Untitled trigger/u);
});

test("Subagent switcher rows expose a hover-reveal delete button", () => {
	// The switcher button gains an optional delete action, fed to the shared
	// hover-reveal actions overlay (hidden until the row is hovered/focused).
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /onDelete\?: \(\) => void;/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /aria-label=\{`Delete \$\{label\}`\}/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /<DeleteIcon size="small" \/>/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /<HoverRevealActions/u);
	// Only subagent rows get a delete handler (the base agent row must not).
	assert.match(
		SUBAGENT_NAVIGATOR_SOURCE,
		/onDelete=\{onDeleteSubagent \? \(\) => onDeleteSubagent\(prompt\.id\) : undefined\}/u,
	);
	// Both surfaces feed their delete handler into the navigator.
	assert.match(SUBAGENT_PAGE_SOURCE, /onDeleteSubagent=\{handleDeleteSubagent\}/u);
});

test("Subagent switcher composes the shared hover-reveal row interaction", () => {
	// Positioning/reveal/truncation now live in the reusable primitive; the
	// navigator just composes it (see hover-reveal-row.test.js for the markup).
	assert.match(
		SUBAGENT_NAVIGATOR_SOURCE,
		/from "@\/components\/ui-custom\/hover-reveal-row"/u,
	);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /className=\{hoverRevealRowClassName\}/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /function handleSwitchMouseDown\(event: MouseEvent<HTMLElement>\)/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /onMouseDown=\{handleSwitchMouseDown\}/u);
	// The switch is parked (kept visible) only while the subagent is off.
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /toggleParked=\{!enabled\}/u);
	// The label only reserves room for controls when they reveal (full at rest),
	// keeping a parked single-slot reserve when off.
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /<HoverRevealLabel/u);
	assert.match(SUBAGENT_NAVIGATOR_SOURCE, /reserveAtRest=\{!enabled && onToggle \? 1 : 0\}/u);
});
