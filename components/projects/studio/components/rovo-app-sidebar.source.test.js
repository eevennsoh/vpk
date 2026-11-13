const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const SOURCE = fs.readFileSync(path.join(__dirname, "rovo-app-sidebar.tsx"), "utf8");
const RECENT_AGENTS_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "lib", "studio-sidebar-recent-agents.ts"),
	"utf8",
);

test("Studio sidebar selects Agents by default instead of Insights", () => {
	assert.match(
		SOURCE,
		/icon: <AiAgentIcon label="" \/>[\s\S]*isSelected: true,[\s\S]*label: "Agents"/u,
	);
	assert.doesNotMatch(
		SOURCE,
		/icon: <ChartTrendUpIcon label="" \/>[\s\S]*isSelected: true,[\s\S]*label: "Insights"/u,
	);
});

test("Studio sidebar recent agent children use one 12px indentation level without a section label", () => {
	assert.match(SOURCE, /<div className="flex flex-col pl-3">\s*\{recentAgents\.items\.map/u);
	assert.doesNotMatch(SOURCE, /mt-0\.5 flex flex-col gap-0\.5 pl-7/u);
	assert.doesNotMatch(SOURCE, />\s*Recent\s*<\/div>/u);
});

test("Studio sidebar recent agent avatar uses the shared snug Tile avatar", () => {
	assert.match(SOURCE, /import \{ Tile, TileAvatar \} from "@\/components\/ui\/tile";/u);
	assert.match(SOURCE, /<Tile[\s\S]*variant="transparent"[\s\S]*size="small"[\s\S]*isSnug/u);
	assert.match(SOURCE, /<TileAvatar alt=\{label\} aria-hidden=\{isDecorative \? true : undefined\} shape="hexagon" src=\{src\} \/>/u);
	assert.match(SOURCE, /leadingSize="medium"/u);
});

test("Studio sidebar creation rows use the shared VPK spinner", () => {
	assert.match(SOURCE, /import \{ Spinner \} from "@\/components\/ui\/spinner";/u);
	assert.match(SOURCE, /function StudioSidebarAgentCreationIcon\(\) \{\s*return <Spinner variant="rainbow" label="Creating agent" \/>;/u);
	assert.doesNotMatch(SOURCE, /components\/ui-custom\/morphing-rovo/u);
	assert.doesNotMatch(SOURCE, /<MorphingRovo\.Shape/u);
});

test("Studio sidebar Agents parent can collapse while a recent agent is selected", () => {
	assert.doesNotMatch(SOURCE, /isAgentsExpanded\s*\|\|\s*hasSelectedRecentAgent/u);
	assert.match(SOURCE, /const selectedRecentAgentKey = selectedRecentAgent/u);
	assert.match(SOURCE, /collapsedSelectionKey !== selectedRecentAgentKey/u);
	assert.match(SOURCE, /setCollapsedSelectionKey\(nextExpanded \? null : selectedRecentAgentKey\)/u);
	assert.match(SOURCE, /shouldShowRecentAgents && isAgentsExpanded \? \(/u);
});

test("Studio sidebar Agents accordion keeps a create action on the parent row", () => {
	assert.match(SOURCE, /import AddIcon from "@atlaskit\/icon\/core\/add";/u);
	assert.match(SOURCE, /onCreateAgent\?: \(\) => void;/u);
	assert.match(SOURCE, /function StudioSidebarAgentsCreateAction\(\{ onClick \}: Readonly<\{ onClick: \(\) => void \}>\) \{/u);
	assert.match(SOURCE, /className="size-6 text-icon-subtle opacity-0 transition-opacity duration-normal ease-out group-hover\/sidebar-nav-item:!opacity-100 focus-visible:opacity-100 hover:text-icon"/u);
	assert.match(SOURCE, /aria-label="Create agent"[\s\S]*event\.stopPropagation\(\);[\s\S]*onClick\(\);[\s\S]*<AddIcon label="" size="small" \/>/u);
	assert.match(SOURCE, /const actions = shouldShowRecentAgents && onCreateAgent \? \([\s\S]*<StudioSidebarAgentsCreateAction onClick=\{onCreateAgent\} \/>[\s\S]*\) : item\.actions;/u);
	const createActionSource = SOURCE.slice(
		SOURCE.indexOf("const actions = shouldShowRecentAgents"),
		SOURCE.indexOf("<StudioSidebarNavItem", SOURCE.indexOf("const actions = shouldShowRecentAgents")),
	);
	assert.doesNotMatch(createActionSource, /onNewChat/u);
	assert.match(SOURCE, /<StudioSidebarNavItem[\s\S]*actions=\{actions\}[\s\S]*isExpanded=\{shouldShowRecentAgents \? isAgentsExpanded : item\.isExpanded\}/u);
});

test("Studio sidebar does not select View all agents while a session agent is active", () => {
	assert.match(
		SOURCE,
		/const hasSelectedSessionAgent = selectedAgentId\s*\?\s*sessionAgentEntries\.some\(\(entry\) => entry\.profile\.id === selectedAgentId\)\s*:\s*false;/u,
	);
	assert.match(
		SOURCE,
		/isSelected=\{isAgentsHomeActive && !hasSelectedRecentAgent && !hasSelectedSessionAgent\}/u,
	);
});

test("Studio sidebar renders automation discovery generated agents as transient creating rows", () => {
	assert.match(RECENT_AGENTS_SOURCE, /export type StudioSidebarRecentAgentKind = "agent" \| "generating" \| "wip";/u);
	assert.match(SOURCE, /generatingAgents\?: ReadonlyArray<StudioSidebarGeneratingAgent>;/u);
	assert.match(SOURCE, /generatingAgents = \[\],[\s\S]*sessionAgentEntries = \[\]/u);
	assert.match(SOURCE, /kind: "generating" as const,[\s\S]*label: agent\.label,[\s\S]*lastTouchedAt: agent\.lastTouchedAt/u);
	assert.match(SOURCE, /const isGenerating = recentAgent\.kind === "generating";[\s\S]*const isCreating = recentAgent\.kind === "wip" \|\| isGenerating;/u);
	assert.match(SOURCE, /onClick=\{isGenerating \? undefined : \(\) => \{/u);
	assert.match(SOURCE, /actions=\{\s*isGenerating \? null : \(/u);
});
