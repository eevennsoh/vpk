const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

function readComponentSource(fileName) {
	return fs.readFileSync(path.join(__dirname, fileName), "utf8");
}

function readModalHeaderSource() {
	return fs.readFileSync(
		path.join(__dirname, "../../../../blocks/jira-work-item/components/work-item-modal/modal-header.tsx"),
		"utf8",
	);
}

test("work item modal accordion buttons expose expanded state", () => {
	assert.match(
		readComponentSource("details-accordion.tsx"),
		/<Button[\s\S]*aria-label=\{state\.isDetailsOpen \? "Collapse" : "Expand"\}[\s\S]*aria-expanded=\{state\.isDetailsOpen\}/,
	);
	assert.match(
		readComponentSource("more-fields-accordion.tsx"),
		/<Button[\s\S]*aria-label=\{state\.isMoreFieldsOpen \? "Collapse" : "Expand"\}[\s\S]*aria-expanded=\{state\.isMoreFieldsOpen\}/,
	);
	assert.match(
		readComponentSource("automation-accordion.tsx"),
		/<Button[\s\S]*aria-label=\{state\.isAutomationOpen \? "Collapse" : "Expand"\}[\s\S]*aria-expanded=\{state\.isAutomationOpen\}/,
	);
});

test("work item modal accordion toggles are leading chevrons", () => {
	const detailsSource = readComponentSource("details-accordion.tsx");
	const moreFieldsSource = readComponentSource("more-fields-accordion.tsx");
	const automationSource = readComponentSource("automation-accordion.tsx");

	assert.match(detailsSource, /className="aria-expanded:!border-transparent aria-expanded:!bg-transparent aria-expanded:!text-text-subtle"/);
	assert.match(moreFieldsSource, /className="aria-expanded:!border-transparent aria-expanded:!bg-transparent aria-expanded:!text-text-subtle"/);
	assert.match(automationSource, /className="aria-expanded:!border-transparent aria-expanded:!bg-transparent aria-expanded:!text-text-subtle"/);
	assert.match(detailsSource, /<div className="min-w-0 overflow-hidden" style=\{\{ border:/);
	assert.match(moreFieldsSource, /<div className="min-w-0 overflow-hidden" style=\{\{ border:/);
	assert.match(automationSource, /<div className="min-w-0 overflow-hidden" style=\{\{ border:/);
	assert.match(detailsSource, /<Button[\s\S]*<ChevronDownIcon label="" size="small" \/> : <ChevronRightIcon label="" size="small" \/>[\s\S]*<\/Button>\s*<div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">[\s\S]*<Heading size="small" className="shrink-0 whitespace-nowrap">Details<\/Heading>/);
	assert.match(moreFieldsSource, /<Button[\s\S]*<ChevronDownIcon label="" size="small" \/> : <ChevronRightIcon label="" size="small" \/>[\s\S]*<\/Button>\s*<div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">[\s\S]*<Heading size="small" className="shrink-0 whitespace-nowrap">More fields<\/Heading>/);
	assert.match(automationSource, /<Button[\s\S]*<ChevronDownIcon label="" size="small" \/> : <ChevronRightIcon label="" size="small" \/>[\s\S]*<\/Button>\s*<div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">[\s\S]*<Heading size="small" className="shrink-0 whitespace-nowrap">Automation<\/Heading>/);
	assert.match(detailsSource, /const detailsSummary = "Assignee, Reporter, Priority, Start date, Due date, Parent, Labels";/);
	assert.match(detailsSource, /const assignee = workItem\.assignee \?\? \{\s*name: "Unassigned",\s*\};/);
	assert.match(moreFieldsSource, /"Approvers"[\s\S]*"Effort estimate"[\s\S]*workItem\.account \? \["Account"\][\s\S]*workItem\.dealSize \? \["Deal size"\]/);
	assert.match(detailsSource, /className="block min-w-0 flex-1 truncate text-xs text-text-subtlest" title=\{detailsSummary\}/);
	assert.match(moreFieldsSource, /className="block min-w-0 flex-1 truncate text-xs text-text-subtlest" title=\{moreFieldsSummary\}/);
	assert.match(automationSource, /className="block min-w-0 flex-1 truncate text-xs text-text-subtlest" title="Rule executions"/);
	assert.match(automationSource, /state\.isAutomationOpen \? null : \([\s\S]*Rule executions[\s\S]*\)/);
	assert.match(automationSource, /<span className="text-sm font-medium text-text-subtlest">Rule executions<\/span>/);
});

test("work item modal status header shows the agents action next to status", () => {
	const source = readComponentSource("sidebar-stack.tsx");

	assert.match(source, /import AiAgentIcon from "@atlaskit\/icon\/core\/ai-agent";/);
	assert.match(source, /LozengeDropdownTrigger/);
	assert.match(source, /type LozengeProps/);
	assert.match(source, /import \{ BOARD_COLUMNS \} from "@\/components\/projects\/jira\/data\/board-data";/);
	assert.match(source, /<div className="flex min-w-0 flex-col gap-2">/);
	assert.match(source, /const STATUS_PHASES = BOARD_COLUMNS\.map\(\(column\) => column\.title\);/);
	assert.match(source, /const phaseToneVariants: Record<PhaseTone, LozengeProps\["variant"\]>/);
	assert.match(source, /const selectedStatusTone = getPhaseTone\(/);
	assert.match(
		source,
		/<DropdownMenu>[\s\S]*<DropdownMenuTrigger[\s\S]*<LozengeDropdownTrigger[\s\S]*aria-label=\{`Change status\. Current status: \$\{selectedStatus\}`\}[\s\S]*size="spacious"[\s\S]*variant=\{phaseToneVariants\[selectedStatusTone\]\}[\s\S]*\{selectedStatus\}[\s\S]*<DropdownMenuContent[\s\S]*positionerClassName="z-\[502\]"[\s\S]*STATUS_PHASES\.map/,
	);
	assert.match(source, /<DropdownMenuGroup className="p-0 py-2">/);
	assert.match(
		source,
		/<DropdownMenuItem[\s\S]*aria-current=\{isSelected \? "true" : undefined\}[\s\S]*onSelect=\{\(\) => handlePhaseSelect\(phaseTitle\)\}[\s\S]*<StatusPhaseLozenge/,
	);
	assert.match(source, /"rounded-none border-l-2 border-l-transparent px-0 py-2\.5 pl-2\.5"/);
	assert.doesNotMatch(source, /px-6|pl-\[22px\]/);
	assert.match(source, /<Lozenge variant=\{phaseToneVariants\[tone\]\}>/);
	assert.match(
		source,
		/<DropdownMenu open=\{isAgentSelectorOpen\} onOpenChange=\{handleAgentSelectorOpenChange\}>[\s\S]*<DropdownMenuTrigger[\s\S]*<Button[\s\S]*aria-label=\{`Open agent selector for \$\{workItem\.code\}`\}[\s\S]*className="gap-2"[\s\S]*variant="outline"[\s\S]*\/>[\s\S]*<AiAgentIcon label="" \/>[\s\S]*Agents[\s\S]*<\/DropdownMenuTrigger>[\s\S]*<Button aria-label="Automation"/,
	);
});

test("work item modal exposes the agent panel under child work items", () => {
	const modalSource = fs.readFileSync(path.join(__dirname, "../jira-work-item-modal.tsx"), "utf8");
	const inlineSource = fs.readFileSync(path.join(__dirname, "../agents-work-item-inline-page.tsx"), "utf8");
	const indexSource = readComponentSource("index.tsx");
	const panelSource = readComponentSource("agent-panel.tsx");

	assert.match(indexSource, /import \{ AgentPanel \} from "\.\/agent-panel";/);
	assert.match(indexSource, /ChildItems: ChildItemsSection,[\s\S]*AgentPanel,/);
	assert.match(modalSource, /<WorkItemModal\.ChildItems \/>[\s\S]*<WorkItemModal\.AgentPanel \/>[\s\S]*<WorkItemModal\.Attachments \/>/);
	assert.match(inlineSource, /<WorkItemModal\.ChildItems \/>[\s\S]*<WorkItemModal\.AgentPanel \/>[\s\S]*<WorkItemModal\.Attachments \/>/);
	assert.match(panelSource, /<Heading as="h3" id="work-item-agent-panel-title" size="small">[\s\S]*Agents/);
	assert.doesNotMatch(panelSource, /Uses AI\. Verify results\./);
	assert.doesNotMatch(panelSource, /Agent settings/);
	assert.match(panelSource, /Start work/);
	assert.doesNotMatch(panelSource, /className="h-12/);
	assert.match(panelSource, /variant="outline"/);
	assert.doesNotMatch(panelSource, /variant="ghost"/);
	assert.match(panelSource, /Start work[\s\S]*<ChevronDownIcon label="" size="small" \/>/);
	assert.doesNotMatch(panelSource, /<ChevronDownIcon label="" size="medium" \/>/);
	assert.doesNotMatch(panelSource, /basic-coding-agent-template/);
	assert.doesNotMatch(panelSource, /next\/image/);
	assert.match(panelSource, /function AgentPanelIllustration\(\{ isSparkleVisible \}: AgentPanelIllustrationProps\)/);
	assert.match(panelSource, /data-testid="ai-agent-sessions\.agent-panel-empty-state"/);
	assert.match(panelSource, /className="flex min-h-14 items-center justify-center rounded-lg border border-dashed border-border"/);
	assert.match(panelSource, /onMouseEnter=\{\(\) => handleAgentPanelHover\("enter"\)\}/);
	assert.match(panelSource, /onMouseLeave=\{\(\) => handleAgentPanelHover\("leave"\)\}/);
	assert.match(panelSource, /paddingBlock: "20px"/);
	assert.match(panelSource, /paddingInline: token\("space\.200"\)/);
	assert.match(panelSource, /className="flex items-center justify-center gap-2"/);
	assert.match(panelSource, /data-slot="icon-tile"[\s\S]*aria-label="Agent"/);
	assert.match(panelSource, /className="relative inline-flex size-6 shrink-0 items-center justify-center"/);
	assert.match(panelSource, /"pointer-events-none absolute -left-3 -top-3 z-10 text-text motion-safe:transition-opacity motion-safe:duration-normal"/);
	assert.match(panelSource, /isSparkleVisible \? "opacity-100" : "opacity-0"/);
	assert.match(panelSource, /className="flex size-6 items-center justify-center rounded-full text-text"/);
	assert.match(panelSource, /const AGENT_ICON_ROTATION_VARIANTS = \{[\s\S]*hovered: \{[\s\S]*transform: "rotate\(45deg\)"/);
	assert.match(panelSource, /const AGENT_ICON_ROTATION_REDUCED_VARIANTS = \{[\s\S]*hovered: \{[\s\S]*transform: "rotate\(0deg\)"/);
	assert.match(panelSource, /const AGENT_ICON_ROTATION_TRANSITION = \{[\s\S]*duration: 0\.42,[\s\S]*ease: \[0, 0\.4, 0, 1\]/);
	assert.match(panelSource, /<motion\.svg[\s\S]*animate=\{isSparkleVisible \? "hovered" : "rest"\}[\s\S]*transition=\{AGENT_ICON_ROTATION_TRANSITION\}[\s\S]*variants=\{shouldReduceMotion \? AGENT_ICON_ROTATION_REDUCED_VARIANTS : AGENT_ICON_ROTATION_VARIANTS\}/);
	assert.match(panelSource, /<AgentPanelIllustration[\s\S]*isSparkleVisible=\{isAgentPanelHovered\}[\s\S]*\/>/);
	assert.match(panelSource, /viewBox="0 0 15 15"/);
	assert.match(panelSource, /viewBox="0 0 13 13"/);
	assert.match(panelSource, /fillRule="evenodd" clipRule="evenodd"/);
	assert.match(panelSource, /const \[isAgentPanelHovered, setIsAgentPanelHovered\] = useState\(false\);/);
	assert.match(panelSource, /setIsAgentPanelHovered\(direction === "enter"\);/);
	assert.match(panelSource, /backgroundColor: token\("color\.background\.accent\.green\.subtle"\)/);
	assert.doesNotMatch(panelSource, /bg-bg-accent-green-subtle/);
	assert.doesNotMatch(panelSource, /bg-bg-accent-green-subtler/);
	assert.doesNotMatch(panelSource, /group-hover\/agent-action/);
	assert.doesNotMatch(panelSource, /group-hover\/agent-panel/);
	assert.doesNotMatch(panelSource, /prefers-reduced-motion: reduce/);
	assert.doesNotMatch(panelSource, /\.animate/);
	assert.match(panelSource, /import \{ AgentSelector \} from "@\/components\/blocks\/agent-selector";/);
	assert.match(panelSource, /import \{ BOARD_AGENTS \} from "@\/components\/projects\/jira\/data\/board-agents";/);
	assert.match(panelSource, /DropdownMenu open=\{isSelectorOpen\} onOpenChange=\{handleSelectorOpenChange\}/);
	assert.match(panelSource, /<DropdownMenuTrigger[\s\S]*aria-label=\{`Open agent selector for \$\{workItem\.code\}`\}[\s\S]*Start work/);
	assert.match(panelSource, /<DropdownMenuContent[\s\S]*className="max-h-none w-\[360px\] overflow-hidden p-0"[\s\S]*positionerClassName="z-\[502\]"/);
	assert.match(panelSource, /<AgentSelector[\s\S]*agents=\{BOARD_AGENTS\}[\s\S]*onAgentToggle=\{handleAgentToggle\}[\s\S]*onBrowseAgents=\{handleFooterAction\}[\s\S]*onCreateAgent=\{handleFooterAction\}/);
	assert.match(panelSource, /const \[isSelectorOpen, setIsSelectorOpen\] = useState\(false\);/);
	assert.match(panelSource, /const \[selectedAgentIds, setSelectedAgentIds\] = useState<readonly string\[\]>\(\[\]\);/);
	assert.doesNotMatch(panelSource, /import \{ useRouter \} from "next\/navigation";/);
	assert.doesNotMatch(panelSource, /router\.push/);
	assert.doesNotMatch(panelSource, /"\/components\/blocks\/agent-selector"/);
	assert.doesNotMatch(panelSource, /openChat\("floating"\)/);
	assert.doesNotMatch(panelSource, /formatActiveJiraWorkItemContext\(workItem\)/);
});

test("work item modal title heading matches the 32px status button height", () => {
	const source = readModalHeaderSource();

	assert.match(source, /<Heading size="large" style=\{\{ paddingBlock: token\("space\.025"\) \}\}>/);
});

test("work item modal shell uses grid rows and independent scrolling columns", () => {
	const source = readComponentSource("modal-container.tsx");

	assert.match(source, /gridTemplateRows: "auto minmax\(0, 1fr\)"/);
	assert.match(source, /gridTemplateColumns: "minmax\(0, 1fr\) clamp\(320px, 34vw, 408px\)"/);
	assert.match(source, /paddingBlockStart: token\("space\.050"\)/);
	assert.match(source, /minHeight: 0/);
	assert.match(source, /minWidth: 0/);
	assert.match(source, /const scrollColumnStyle/);
	assert.match(source, /const columnStackBaseStyle/);
	assert.match(source, /\.\.\.scrollColumnStyle/);
	assert.match(source, /\.\.\.columnStackBaseStyle/);
	assert.match(source, /gridAutoRows: "max-content"/);
	assert.match(source, /overflowY: "auto"/);
	assert.doesNotMatch(source, /flexDirection: "column"/);
});

test("work item modal header keeps breadcrumbs shrinkable and actions fixed", () => {
	const source = readModalHeaderSource();

	assert.match(source, /gridTemplateColumns: "minmax\(0, 1fr\) max-content"/);
	assert.match(source, /<Breadcrumb className="min-w-0 overflow-visible" size="small">/);
	assert.match(source, /<BreadcrumbList className="-m-1 min-w-0 flex-nowrap overflow-hidden p-1">/);
	assert.match(source, /className="min-w-0 max-w-\[240px\] shrink"/);
	assert.match(source, /className=\{cn\("flex shrink-0 items-center gap-2", actionsClassName\)\}/);
	assert.match(source, /\[&_\[data-slot=breadcrumb-label-text\]\]:truncate/);
	assert.doesNotMatch(source, /height: "32px"/);
	assert.doesNotMatch(source, /marginTop: token\("space\.300"\)/);
	assert.doesNotMatch(source, /marginBottom: token\("space\.200"\)/);
});

test("work item modal breadcrumb identifies its parent with the Jira Epic glyph", () => {
	const source = readModalHeaderSource();

	assert.match(source, /import EpicIcon from "@atlaskit\/icon\/core\/epic";/);
	assert.match(source, /className="text-icon-accent-purple"[\s\S]*render=\{<EpicIcon color="currentColor" label="" \/>\}/);
	assert.doesNotMatch(source, /avatar-project\/rocket\.svg/);
});

test("work item modal child-items table uses shared grid columns", () => {
	const headerSource = readComponentSource("child-items-table-header.tsx");
	const rowSource = readComponentSource("child-item-row.tsx");

	assert.match(headerSource, /export const CHILD_ITEMS_GRID_COLUMNS = "[^"]+";/);
	assert.match(headerSource, /display: "grid"[\s\S]*gridTemplateColumns: CHILD_ITEMS_GRID_COLUMNS/);
	assert.match(rowSource, /import \{ CHILD_ITEMS_GRID_COLUMNS \} from "\.\/child-items-table-header";/);
	assert.match(rowSource, /display: "grid"[\s\S]*gridTemplateColumns: CHILD_ITEMS_GRID_COLUMNS/);
});

test("work item modal child item rows do not render internal column separators", () => {
	const rowSource = readComponentSource("child-item-row.tsx");

	assert.doesNotMatch(rowSource, /borderLeft/);
	assert.doesNotMatch(rowSource, /borderRight/);
	assert.doesNotMatch(rowSource, /borderInline/);
});

test("work item modal child item status uses jira lozenge dropdown tones", () => {
	const rowSource = readComponentSource("child-item-row.tsx");

	assert.match(rowSource, /import \{[\s\S]*DropdownMenu[\s\S]*DropdownMenuTrigger[\s\S]*\} from "@\/components\/ui\/dropdown-menu";/);
	assert.match(rowSource, /import \{[\s\S]*Lozenge[\s\S]*LozengeDropdownTrigger[\s\S]*type LozengeProps[\s\S]*\} from "@\/components\/ui\/lozenge";/);
	assert.match(rowSource, /type LozengeProps/);
	assert.match(rowSource, /\{ value: "todo", label: "To Do", variant: "neutral" \}/);
	assert.match(rowSource, /\{ value: "inprogress", label: "In Progress", variant: "information" \}/);
	assert.match(rowSource, /\{ value: "done", label: "Done", variant: "success" \}/);
	assert.match(rowSource, /variant=\{statusOption\.variant\}/);
	assert.match(rowSource, /<LozengeDropdownTrigger[\s\S]*aria-label=\{`Status for \$\{item\.key\}: \$\{statusOption\.label\}`\}[\s\S]*variant=\{statusOption\.variant\}/);
	assert.match(rowSource, /<Lozenge variant=\{option\.variant\}>/);
	assert.doesNotMatch(rowSource, /size="spacious"/);
	assert.doesNotMatch(rowSource, /SelectTrigger/);
});

test("work item modal child-items table renders full priority and assignee headers", () => {
	const source = readComponentSource("child-items-table-header.tsx");

	assert.match(source, /CHILD_ITEMS_GRID_COLUMNS = "minmax\(0, 1fr\) 76px 88px 148px";/);
	assert.match(source, /\{ label: "Priority" \}/);
	assert.match(source, /\{ label: "Assignee" \}/);
	assert.doesNotMatch(source, /displayLabel/);
	assert.doesNotMatch(source, /Pri\.\.\./);
	assert.doesNotMatch(source, /As\.\.\./);
});

test("work item modal child item rows render assignee avatars when provided", () => {
	const rowSource = readComponentSource("child-item-row.tsx");
	const dataSource = fs.readFileSync(path.join(__dirname, "../../data/rfp-work-items.ts"), "utf8");

	assert.match(rowSource, /import \{ Avatar, AvatarFallback, AvatarImage \} from "@\/components\/ui\/avatar";/);
	assert.match(rowSource, /item\.assigneeAvatarUrl \? <AvatarImage src=\{item\.assigneeAvatarUrl\} alt=\{item\.assignee \?\? "Assignee"\} \/> : null/);
	assert.match(dataSource, /assigneeAvatarUrl: assignee\.avatarUrl/);
	assert.match(dataSource, /avatarUrl: "\/avatar-user\/andrea-wilson\/color\/asow-service-yellow\.png"/);
	assert.match(dataSource, /avatarUrl: "\/avatar-user\/annie-clare\/color\/asow-strategy-orange\.png"/);
	assert.match(dataSource, /avatarUrl: "\/avatar-user\/andrew-park\/color\/asow-dev-lime\.png"/);
	assert.match(dataSource, /avatarUrl: "\/avatar-user\/aoife-burke\/color\/asow-service-yellow\.png"/);
});

test("work item modal description uses field layout and subtle inline edit styling", () => {
	const source = readComponentSource("description-section.tsx");

	assert.match(source, /import \{ Field, FieldLabel \} from "@\/components\/ui\/field";/);
	assert.match(source, /<Field className="min-w-0">/);
	assert.match(source, /<FieldLabel[\s\S]*htmlFor="agents-description"/);
	assert.match(source, /inputProps=\{\{ id: "agents-description" \}\}/);
	assert.match(source, /textareaProps=\{\{ variant: "subtle", className: "-ml-1\.5" \}\}/);
	assert.match(source, /multiline/);
	assert.match(
		source,
		/readViewClassName="-ml-1\.5 border-transparent bg-transparent hover:bg-bg-input-hovered active:bg-bg-input-pressed"/,
	);
	assert.doesNotMatch(source, /\[data-slot=inline-edit-read-view\]/);
	assert.doesNotMatch(source, /-ml-2/);
});
