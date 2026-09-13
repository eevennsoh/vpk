const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const React = require("react");
const { parseHTML } = require("linkedom");
const { createRoot } = require("react-dom/client");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

function readProjectFile(filePath) {
	return fs.readFileSync(path.join(process.cwd(), filePath), "utf8");
}

test("Agent Assignment exposes a reusable controlled block contract", () => {
	const source = readProjectFile("components/blocks/agent-assignment/components/agent-assignment.tsx");
	const index = readProjectFile("components/blocks/agent-assignment/index.ts");
	const page = readProjectFile("components/blocks/agent-assignment/page.tsx");
	const demoAssigned = readProjectFile("components/blocks/agent-assignment/demo-assigned-agents.ts");

	assert.match(source, /export interface AgentAssignmentAgent extends AgentSelectorAgent/u);
	assert.match(source, /status\?: ReactNode;/u);
	assert.match(source, /statusSequence\?: readonly string\[\];/u);
	assert.match(source, /statusKind\?: AgentAssignmentStatusKind;/u);
	assert.match(source, /invokedBy\?: AgentListInvoker;/u);
	assert.match(source, /host\?: AgentListHost;/u);
	assert.match(source, /role\?: AgentSessionRole;/u);
	assert.match(source, /export type \{ AgentAssignmentStatusKind \} from "@\/components\/blocks\/agent-assignment\/components\/assigned-agent-status";/u);
	const statusHelper = readProjectFile("components/blocks/agent-assignment/components/assigned-agent-status.ts");
	assert.match(statusHelper, /export type AgentAssignmentStatusKind = "working" \| "needs-input" \| "finished" \| "idle";/u);
	assert.match(statusHelper, /export function resolveAssignedAgentStatusKind\(/u);
	assert.doesNotMatch(source, /export function resolveAssignedAgentStatusKind\(/u);
	assert.match(source, /statusCycleIntervalMs\?: number;/u);
	assert.match(source, /statusCycleJitterMs\?: number;/u);
	assert.match(source, /export interface AgentAssignmentProps/u);
	assert.match(source, /agents: readonly AgentSelectorAgent\[\];/u);
	assert.match(source, /assignedAgents: readonly AgentAssignmentAgent\[\];/u);
	assert.match(source, /onAssignedAgentIdsChange\?: \(agentIds: readonly string\[\]\) => void;/u);
	assert.match(source, /onAgentAssign\?: \(agent: AgentSelectorAgent\) => void;/u);
	assert.match(source, /onAssignedAgentSelect: \(agent: AgentAssignmentAgent\) => void;/u);
	assert.match(source, /onContinueExistingSession\?: \(agent: AgentSelectorAgent\) => void;/u);
	assert.match(source, /onRenameAssignedAgent\?: \(agent: AgentAssignmentAgent\) => void;/u);
	assert.match(source, /onStartNewSession\?: \(agent: AgentSelectorAgent\) => void;/u);
	assert.match(source, /usedAgentIds\?: readonly string\[\];/u);
	assert.match(index, /export \{ AgentAssignment \} from "\.\/components\/agent-assignment";/u);
	assert.match(index, /export \{ resolveAssignedAgentStatusKind \} from "\.\/components\/assigned-agent-status";/u);
	assert.match(index, /export type \{ AgentAssignmentVariant \} from "\.\/components\/assignment-session";/u);
	assert.match(index, /AgentAssignmentAgent,[\s\S]*AgentAssignmentProps,[\s\S]*AgentAssignmentStatusKind/u);
	assert.match(demoAssigned, /"github-copilot": \{[\s\S]*host: "cloud"[\s\S]*role: "owner"[\s\S]*statusKind: "working"[\s\S]*"Checking the proposed patch across every changed file in this review"/u);
	assert.match(demoAssigned, /"release-notes-drafter": \{[\s\S]*host: "cloud"[\s\S]*role: "owner"[\s\S]*statusKind: "needs-input"/u);
	assert.match(demoAssigned, /"code-reviewer": \{[\s\S]*host: "local"[\s\S]*role: "owner"[\s\S]*statusKind: "idle"/u);
	assert.match(demoAssigned, /"readiness-checker": \{[\s\S]*host: "local"[\s\S]*role: "viewer"[\s\S]*statusKind: "idle"/u);
	assert.match(demoAssigned, /statusKind: demoStatus\.statusKind,[\s\S]*statusSequence: demoStatus\.labels/u);
	assert.match(demoAssigned, /statusKind: "finished"/u);
	assert.match(page, /getAgentAssignmentDemoAssignedAgents\(assignedAgentIds, \{\s*codeReviewerFinished,/u);
	assert.match(page, /import \{ SONNER_TOAST_AUTO_DISMISS_MS \} from "@\/components\/ui\/sonner"/u);
	assert.match(page, /window\.setTimeout\(\(\) => \{\s*setCodeReviewerFinished\(true\);\s*\}, SONNER_TOAST_AUTO_DISMISS_MS \+ 400\)/u);
	assert.doesNotMatch(page, /DemoAgentActivity|setInterval|useReducedMotion/u);

	const avatar = readProjectFile("components/blocks/agent-assignment/components/assignment-avatar.tsx");
	assert.match(avatar, /function getAssignmentAvatarStatus\(kind: AgentAssignmentStatusKind\): AvatarStatus \| undefined/u);
	assert.match(avatar, /case "needs-input":\s*return "needs-input";/u);
	assert.match(avatar, /case "finished":\s*return "finished";/u);
	assert.match(avatar, /case "working":\s*case "idle":\s*return undefined;/u);
	assert.match(avatar, /status=\{avatarStatus\}/u);
	assert.match(avatar, /onOpenChange=\{handleTooltipOpenChange\}/u);
	assert.match(avatar, /open=\{tooltipOpen\}/u);
	assert.doesNotMatch(avatar, /animate=\{false\}/u);
	assert.match(avatar, /const \[hoverOpen, setHoverOpen\] = useState\(false\);/u);
	assert.match(avatar, /const tooltipOpen = !menuOpen && hoverOpen;/u);
	assert.doesNotMatch(avatar, /autoRevealAttention/u);
	assert.match(source, /statusKind=\{statusKind\}/u);
	assert.match(source, /menuOpen=\{open\}/u);
	assert.match(source, /overflow-visible px-2/u);
	assert.match(source, /stackZIndex=\{seeksAttention \? 30 - index : 10\}/u);
	assert.match(source, /attentionAcknowledged=\{attentionAcknowledged\}/u);
	assert.match(source, /useAssignedAgentAttention\(attentionAgents\)/u);
	assert.match(source, /acknowledgeAttention\(agent\.id\);/u);
	assert.match(source, /isAssignedAgentAttentionKind\(statusKind\)/u);
	assert.match(avatar, /attentionAcknowledged \? undefined : getAssignmentAvatarStatus\(statusKind\)/u);
	assert.doesNotMatch(source, /tooltipSide|attentionStackIndex|autoRevealAttention|attentionAgentId/u);
	assert.match(avatar, /side="top"/u);
	assert.match(avatar, /align="center"/u);
	assert.match(avatar, /sideOffset=\{ATTENTION_TOOLTIP_SIDE_OFFSET_PX\}/u);
	assert.doesNotMatch(avatar, /ATTENTION_TOOLTIP_STACK_STEP_PX|attentionStackIndex/u);
	assert.match(avatar, /collisionAvoidance=\{ATTENTION_TOOLTIP_COLLISION\}/u);
	assert.match(avatar, /side: "none"/u);
	assert.match(avatar, /align: "none"/u);
	assert.match(avatar, /fallbackAxisSide: "none"/u);
	assert.match(avatar, /className="pointer-events-auto relative inline-flex size-6 shrink-0 overflow-visible"/u);
	assert.doesNotMatch(avatar, /align="end"|side="bottom"|tooltipSide/u);

	const attention = readProjectFile("components/blocks/agent-assignment/components/use-assigned-agent-attention.ts");
	assert.match(attention, /export function resolveAssignedAgentAttentionChanges\(/u);
	assert.match(attention, /if \(previousKind !== undefined && previousKind !== agent\.statusKind\) \{\s*changedIds\.push\(agent\.id\);/u);
	assert.match(attention, /export function acknowledgeAssignedAgentAttention\(/u);
	assert.match(attention, /export function clearAcknowledgedAssignedAgentIds\(/u);
	assert.match(attention, /setAcknowledgedIds\(\(current\) => clearAcknowledgedAssignedAgentIds\(current, changedIds\)\);/u);
	assert.doesNotMatch(attention, /enterId|attentionAgentId|attentionEpoch|ASSIGNED_AGENT_ATTENTION_TOOLTIP_MS|SONNER_TOAST_AUTO_DISMISS_MS|setActiveId|autoReveal/u);
});

test("Agent Assignment preserves the work-item trigger and two-stage menu behavior", () => {
	const source = readProjectFile("components/blocks/agent-assignment/components/agent-assignment.tsx");
	const menu = readProjectFile("components/blocks/agent-assignment/components/assigned-agents-menu.tsx");
	const suggestionMenu = readProjectFile("components/ui-custom/rich-text-editor/suggestion-menu.tsx");
	const suggestionMenuCss = readProjectFile("components/ui-custom/rich-text-editor/suggestion-menu-actions.css");

	assert.match(source, /openMode\?: "click" \| "hover";/u);
	assert.match(source, /trigger\?: ReactElement<\{ "aria-expanded"\?: boolean \}>;/u);
	assert.match(source, /onOpenChange\?: \(open: boolean\) => void;/u);
	assert.match(source, /openMode === "hover"/u);
	assert.match(source, /<HoverCard onOpenChange=\{handleOpenChange\} open=\{open\}>/u);
	assert.match(source, /delay=\{120\}/u);
	assert.match(source, /closeDelay=\{80\}/u);
	assert.match(source, /cloneElement\(trigger, \{ "aria-expanded": open \}\)/u);
	assert.match(source, /import \{ token \} from "@\/lib\/tokens";/u);
	assert.match(source, /<PopoverContent[\s\S]*style=\{\{ boxShadow: token\("elevation\.shadow\.overlay"\) \}\}/u);
	assert.match(
		source,
		/<TooltipProvider portalContainer=\{hoverPopupRef\}>[\s\S]*<HoverCardContent[\s\S]*className="max-h-none w-\[280px\] max-w-\[280px\] gap-0 overflow-visible rounded-xl p-0 shadow-none"[\s\S]*ref=\{hoverPopupRef\}/u,
	);
	assert.match(source, /openMode === "hover" && "overflow-hidden rounded-xl"/u);
	assert.match(
		source,
		/<PopoverContent[\s\S]*className="max-h-none w-\[280px\] max-w-\[280px\] gap-0 overflow-hidden rounded-xl p-0"/u,
	);
	assert.doesNotMatch(source, /w-\[360px\]/u);
	assert.match(source, /className="absolute inset-0 z-0 rounded-md outline-none"/u);
	assert.match(source, /aria-label=\{shown\.length === 0 \? "Assign agent" : triggerLabel\}/u);
	assert.match(
		source,
		/shown\.length === 0 \? \(\s*<span className="pointer-events-none relative z-10 text-sm text-text-subtlest">\s*Assign agent\s*<\/span>/u,
	);
	assert.doesNotMatch(source, /PlusIcon/u);
	assert.match(
		source,
		/const showSessionView = view === "session" && pendingSessionAgent !== null;[\s\S]*const effectiveView = showSessionView[\s\S]*assignedAgents\.length === 0 \|\| view === "session"[\s\S]*"selector"/u,
	);
	assert.match(source, /<AssignedAgentsMenu[\s\S]*onAddAgent=\{onAssignedAgentIdsChange \? handleShowSelector : undefined\}[\s\S]*onArchiveAgent=\{allowArchive && onAssignedAgentIdsChange \? handleArchiveAgent : undefined\}/u);
	assert.match(menu, /onAddAgent\?: \(\) => void;[\s\S]*onArchiveAgent\?: \(agent: AgentAssignmentAgent\) => void;/u);
	assert.match(menu, /hoverActions: onArchiveAgent \? \{[\s\S]*secondaryLabel: "Archive",[\s\S]*\} : undefined,/u);
	assert.match(menu, /\{onAddAgent \? \([\s\S]*Assign agent[\s\S]*\) : null\}/u);
	assert.match(source, /if \(usedAgentIds\.includes\(agentId\)\) \{\s*retainPopoverOpenRef\.current = true;\s*menuRootRef\.current\?\.focus\(\);\s*setPendingSessionAgent\(agent\);\s*setView\("session"\);/u);
	assert.match(source, /<AgentSessionTargetMenu[\s\S]*onChoose=\{\(choice\) => handleSessionChoice\(pendingSessionAgent, choice\)\}/u);
	assert.match(source, /<AgentSelector[\s\S]*searchVariant="palette"[\s\S]*selectionMode="single"/u);
	assert.match(source, /<AgentSelector[\s\S]*pinningEnabled[\s\S]*selectionMode="single"/u);
	assert.match(source, /showSelectedTickInSingleSelect=\{false\}/u);
	assert.match(source, /<AgentSelector[\s\S]*submenuAgentIds=\{usedAgentIds\}/u);
	assert.match(source, /moreItemsLabel = "More agents"/u);
	assert.match(source, /pinnedItemsLabel = "Pinned by space"/u);
	assert.match(source, /moreItemsLabel=\{moreItemsLabel\}/u);
	assert.match(source, /pinnedItemsLabel=\{pinnedItemsLabel\}/u);
	assert.match(source, /onBrowseAgents=\{onBrowseAgents \? \(\) => handleFooterAction\(onBrowseAgents\) : undefined\}/u);
	assert.match(source, /onCreateAgent=\{onCreateAgent \? \(\) => handleFooterAction\(onCreateAgent\) : undefined\}/u);
	assert.doesNotMatch(source, /selectionMode="multiple"/u);
	assert.match(source, /onAssignedAgentIdsChange\(nextAssignedAgentIds\);/u);
	assert.match(source, /const isAssigned = assignedAgentIds\.includes\(agentId\);/u);
	assert.match(source, /if \(!isAssigned\) \{\s*onAgentAssign\?\.\(agent\);\s*\}/u);
	assert.match(source, /const nextAssignedAgentIds = isAssigned\s*\? assignedAgentIds\.filter\(\(id\) => id !== agentId\)\s*:\s*\[\.\.\.assignedAgentIds, agentId\];/u);

	assert.doesNotMatch(menu, /AgentList/u);
	assert.match(menu, /<RichTextSuggestionMenu[\s\S]*title="Assigned agents"/u);
	assert.match(menu, /const ASSIGNED_AGENT_STATUS_CYCLE_INTERVAL_MS = 1800;/u);
	assert.match(menu, /const ASSIGNED_AGENT_STATUS_CYCLE_JITTER_MS = 1600;/u);
	assert.match(menu, /const ASSIGNED_AGENT_STATUS_INITIAL_STAGGER_MS = 320;/u);
	assert.match(menu, /function getAssignedAgentStatusLabels\([\s\S]*agent\.statusSequence/u);
	assert.match(menu, /function getAssignedAgentStatusCycleDelay\([\s\S]*Math\.random\(\)/u);
	assert.match(menu, /function AssignedAgentStatus\([\s\S]*useReducedMotion\(\)[\s\S]*window\.setTimeout[\s\S]*window\.clearTimeout/u);
	assert.match(menu, /inlineMetadata: getAssignedAgentHoverByline\(row, statusKind, rowIndex\)/u);
	assert.match(menu, /case "working":\s*return <AssignedAgentStatus agent=\{agent\} rowIndex=\{rowIndex\} \/>;/u);
	assert.doesNotMatch(menu, /setInterval/u);
	assert.match(menu, /hoverActions: onArchiveAgent \? \{[\s\S]*primaryLabel: "View"[\s\S]*secondaryLabel: "Archive"/u);
	assert.match(menu, /function AssignedAgentTrailingStatus\(/u);
	assert.match(menu, /const statusKind = resolveAssignedAgentStatusKind\(row\);/u);
	assert.match(menu, /<Spinner label=\{`\$\{agent\.name\} running`\} size="sm" \/>/u);
	assert.doesNotMatch(menu, /<Spinner[^>]*variant="rainbow"/u);
	assert.match(menu, /<StatusInformationIcon[\s\S]*size="small"/u);
	assert.match(menu, /<StatusSuccessIcon[\s\S]*size="small"/u);
	assert.match(menu, /text-icon-information/u);
	assert.match(menu, /text-icon-success/u);
	assert.match(menu, /onHoverEnd=\{\(\) => setSelectedIndex\(-1\)\}/u);
	assert.match(suggestionMenu, /hoverActions\?: RichTextSuggestionMenuHoverActions;/u);
	assert.match(suggestionMenu, /onHoverEnd\?: \(\) => void;/u);
	assert.match(suggestionMenu, /const isHoverActionsRevealed = hasHoverActions && \(isRowPointerActive \|\| isRowFocusWithin\);/u);
	assert.match(suggestionMenu, /const isBylineRevealed = hasHoverActions \? isHoverActionsRevealed : isSelected;/u);
	assert.match(suggestionMenu, /const shouldYieldTrailingToHoverActions = isHoverActionsRevealed;/u);
	assert.match(suggestionMenu, /shouldYieldTrailingToHoverActions \? "pointer-events-none opacity-0"/u);
	assert.match(suggestionMenu, /className="rich-text-command-menu-copy rich-text-command-menu-nested-copy rich-text-command-menu-nested-copy-revealable min-w-0"/u);
	assert.match(suggestionMenu, /className="menu-row-byline min-w-0"/u);
	assert.match(suggestionMenu, /import "\.\/suggestion-menu-actions\.css";/u);
	assert.match(suggestionMenu, /data-suggestion-action-buttons=""/u);
	assert.match(suggestionMenu, /className="pointer-events-none flex w-0 items-center gap-1 overflow-hidden opacity-0"/u);
	assert.doesNotMatch(suggestionMenu, /className="hidden items-center gap-1/u);
	assert.doesNotMatch(
		suggestionMenu,
		/hasHoverActions\s*\?\s*"transition-opacity duration-fast ease-out-practical motion-reduce:transition-none"/u,
	);
	assert.match(
		suggestionMenuCss,
		/\[data-suggestion-actions\]:has\(:focus-visible\) \.rich-text-command-menu-item\[data-has-actions="true"\] \.rich-text-command-menu-shortcut,[\s\S]*transition: none;/u,
	);
	assert.match(suggestionMenuCss, /\.rich-text-command-menu:not\(:has\(\[data-suggestion-actions\] :focus-visible\)\)[\s\S]*\[data-suggestion-actions\]:hover/u);
	assert.match(suggestionMenuCss, /\[data-suggestion-actions\]:has\(:focus-visible\) > \[data-suggestion-action-buttons\]/u);
	assert.match(suggestionMenu, /className="group\/suggestion-option grid min-w-0 grid-cols-\[minmax\(0,1fr\)_auto\] items-center rounded-lg"/u);
	assert.match(
		suggestionMenu,
		/const revealedMetadata = item\.inlineMetadata \?\? \(showsPersistentDescription \? undefined : item\.description\);[\s\S]*canRevealMetadata \? \([\s\S]*className="menu-row-byline min-w-0"[\s\S]*\{revealedMetadata\}/u,
	);
	assert.doesNotMatch(suggestionMenu, /rich-text-command-menu-copy-inline/u);
	assert.doesNotMatch(
		suggestionMenu,
		/<span className="min-w-0 flex-1">\s*\{item\.inlineMetadata\}/u,
	);
	assert.match(menu, /<CyclingByline className="menu-row-byline">/u);
	assert.doesNotMatch(menu, /menu-row-title text-text-subtlest/u);
	assert.doesNotMatch(suggestionMenu, /absolute inset-y-0 right-2/u);
	assert.doesNotMatch(suggestionMenuCss, /padding-right: 104px/u);
	assert.match(menu, /className="rich-text-command-menu-embedded w-full! \[&_\.rich-text-command-menu-list\]:p-0"/u);
	assert.match(
		menu,
		/className="sticky bottom-0 z-10 flex shrink-0 flex-col border-t border-border bg-popover p-0 pt-1"/u,
	);
	assert.match(menu, /className="flex w-full flex-col gap-1 p-1 outline-none"/u);
	assert.match(menu, /containerRef\.current\?\.focus\(\);/u);
	assert.doesNotMatch(menu, /firstOption\?\.focus\(\);/u);
	assert.match(menu, /selectedIndex === -1\s*\? \(step > 0 \? 0 : items\.length - 1\)/u);
	assert.match(
		menu,
		/<Button[\s\S]*className="h-8 min-h-8 w-full justify-start gap-3 pl-2 pr-3 py-0 text-left text-sm font-normal"[\s\S]*onClick=\{onAddAgent\}[\s\S]*variant="ghost"[\s\S]*<span className="grid size-6 shrink-0 place-items-center text-icon-subtle">[\s\S]*<AiAgentAddIcon label="" \/>[\s\S]*<span className="text-text-subtle">Assign agent<\/span>/u,
	);
	assert.doesNotMatch(menu, /disabled:/u);

	const sessionMenu = readProjectFile("components/blocks/agent-assignment/components/agent-session-target-menu.tsx");
	const editorCss = readProjectFile("components/ui-custom/rich-text-editor/rich-text-editor.css");
	assert.match(sessionMenu, /title="Choose agent session"/u);
	assert.match(sessionMenu, /label: "Continue in existing session"/u);
	assert.match(sessionMenu, /label: "Start a new session"/u);
	assert.match(sessionMenu, /onBack=\{onBack\}/u);
	assert.match(sessionMenu, /showReturnShortcut=\{false\}/u);
	assert.match(sessionMenu, /useLayoutEffect\(\(\) => \{\s*containerRef\.current\?\.focus\(\);\s*\}, \[\]\);/u);
	assert.doesNotMatch(sessionMenu, /requestAnimationFrame/u);
	assert.match(source, /const menuRootRef = useRef<HTMLDivElement>\(null\);/u);
	assert.match(source, /const retainPopoverOpenRef = useRef\(false\);/u);
	assert.match(source, /eventDetails\?\.reason === "focus-out"/u);
	assert.match(
		source,
		/const menuSurface = \([\s\S]*className=\{cn\([\s\S]*"w-full outline-none"[\s\S]*ref=\{menuRootRef\}[\s\S]*tabIndex=\{-1\}/u,
	);
	assert.match(suggestionMenu, /showReturnShortcut\?: boolean;/u);
	assert.match(suggestionMenu, /showReturnShortcut = true,/u);
	assert.match(suggestionMenu, /data-hide-return-shortcut=\{showReturnShortcut \? undefined : "true"\}/u);
	assert.match(
		suggestionMenu,
		/const shouldShowReturnShortcut = showReturnShortcut && !item\.disabled && !hasHoverActions && \(isSelected \|\| isRowPointerActive \|\| isRowFocusWithin\);/u,
	);
	assert.match(
		editorCss,
		/\.rich-text-command-menu\[data-hide-return-shortcut\] \.rich-text-command-menu-item-selected:not\(\[data-has-actions="true"\]\) \.rich-text-command-menu-copy \{\s*padding-right: 0;/u,
	);
});

test("Agent Assignment filled pins follow the space pin set, not assignment or used sessions", () => {
	const source = readProjectFile("components/blocks/agent-assignment/components/agent-assignment.tsx");
	const page = readProjectFile("components/blocks/agent-assignment/page.tsx");
	const selector = readProjectFile("components/blocks/agent-selector/components/agent-selector.tsx");
	const variantPickerOptions = readProjectFile(
		"components/blocks/jira-work-item/experimental-v3/lib/work-item-picker-options.ts",
	);
	const pickerOptions = readProjectFile(
		"components/blocks/jira-work-item/lib/work-item-picker-options.ts",
	);

	assert.match(
		variantPickerOptions,
		/from "@\/components\/blocks\/jira-work-item\/lib\/work-item-picker-options";/u,
	);
	assert.match(
		pickerOptions,
		/export const DEFAULT_PINNED_SPACE_AGENT_IDS = \[\s*"rfp-drafting-agent",\s*"readiness-checker",\s*\] as const;/u,
	);
	assert.match(page, /defaultPinnedAgentIds=\{DEFAULT_PINNED_SPACE_AGENT_IDS\}/u);
	const demoAssigned = readProjectFile("components/blocks/agent-assignment/demo-assigned-agents.ts");
	assert.match(demoAssigned, /export const DEMO_USED_AGENT_IDS = \[\s*"github-copilot",\s*"release-notes-drafter",\s*\] as const;/u);
	assert.match(
		demoAssigned,
		/export const INITIAL_ASSIGNED_AGENT_IDS = \[\s*"github-copilot",\s*"code-reviewer",\s*"release-notes-drafter",\s*"readiness-checker",\s*\] as const;/u,
	);
	assert.match(page, /getAgentAssignmentDemoAssignedAgents\(assignedAgentIds/u);
	assert.doesNotMatch(page, /defaultPinnedAgentIds=\{(?:DEMO_USED_AGENT_IDS|INITIAL_ASSIGNED_AGENT_IDS)\}/u);
	assert.doesNotMatch(pickerOptions, /"github-copilot"|"release-notes-drafter"|"code-reviewer"/u);

	assert.match(source, /pinnedAgentIds=\{pinnedAgentIds\}/u);
	assert.match(source, /selectedAgentIds=\{assignedAgentIds\}/u);
	assert.match(source, /submenuAgentIds=\{usedAgentIds\}/u);
	assert.match(source, /showSelectedTickInSingleSelect=\{false\}/u);
	assert.match(source, /if \(usedAgentIds\.includes\(agentId\)\) \{\s*retainPopoverOpenRef\.current = true;\s*menuRootRef\.current\?\.focus\(\);\s*setPendingSessionAgent\(agent\);\s*setView\("session"\);/u);

	assert.match(selector, /const pinFilled = isPinned;/u);
	assert.doesNotMatch(selector, /showSelectionPin/u);
	assert.doesNotMatch(selector, /pinFilled = isPinned \|\|/u);
	assert.match(
		selector,
		/const showPinButton =\s*!isInProgress && pinningEnabled && \(isPinned \|\| \(isInteractionActive && !showSingleSelectTick\)\);/u,
	);
});

test("assigned-agent action rows truncate 8px from CTAs and idle the byline on hover-out", () => {
	const menu = readProjectFile("components/blocks/agent-assignment/components/assigned-agents-menu.tsx");
	const demoAssigned = readProjectFile("components/blocks/agent-assignment/demo-assigned-agents.ts");
	const suggestionMenu = readProjectFile("components/ui-custom/rich-text-editor/suggestion-menu.tsx");
	const suggestionMenuCss = readProjectFile("components/ui-custom/rich-text-editor/suggestion-menu-actions.css");
	const editorCss = readProjectFile("components/ui-custom/rich-text-editor/rich-text-editor.css");

	assert.match(
		editorCss,
		/\.rich-text-command-menu-item:not\(\[data-has-actions="true"\]\):hover \.rich-text-command-menu-copy,[\s\S]*\.rich-text-command-menu-item-selected:not\(\[data-has-actions="true"\]\) \.rich-text-command-menu-copy \{\s*padding-right: 28px;/u,
	);
	assert.doesNotMatch(
		editorCss,
		/\.rich-text-command-menu-item:hover \.rich-text-command-menu-copy,[\s\S]*\.rich-text-command-menu-item-selected \.rich-text-command-menu-copy \{\s*padding-right: 28px;/u,
	);
	assert.match(suggestionMenuCss, /padding-right: var\(--ds-space-100, 8px\)/u);
	assert.match(
		suggestionMenuCss,
		/\[data-suggestion-actions\]:has\(:focus-visible\) \.rich-text-command-menu-item\[data-has-actions="true"\] \.rich-text-command-menu-copy,[\s\S]*padding-right: 0;/u,
	);

	assert.match(
		demoAssigned,
		/Checking the proposed patch across every changed file in this review/u,
	);

	assert.match(menu, /<Spinner label=\{`\$\{agent\.name\} running`\} size="sm" \/>/u);
	assert.doesNotMatch(menu, /<Spinner[^>]*variant="rainbow"/u);
	assert.match(suggestionMenu, /shouldYieldTrailingToHoverActions \? "pointer-events-none opacity-0"/u);
	assert.doesNotMatch(suggestionMenu, /className="hidden items-center gap-1/u);

	assert.match(menu, /onHoverEnd=\{\(\) => setSelectedIndex\(-1\)\}/u);
	assert.match(suggestionMenu, /const isBylineRevealed = hasHoverActions \? isHoverActionsRevealed : isSelected;/u);
	assert.match(suggestionMenu, /animate=\{isBylineRevealed \? "active" : "idle"\}/u);
});

test("the Jira work-item Agents field adapts its session model to Agent Assignment", () => {
	const source = readProjectFile("components/blocks/jira-work-item/experimental-v3/components/detail-field-editors.tsx");

	assert.match(source, /import \{ AgentAssignment, type AgentAssignmentAgent \} from "@\/components\/blocks\/agent-assignment";/u);
	assert.match(source, /const assignedAgents = assignedRows\.map/u);
	assert.match(source, /<AgentAssignment[\s\S]*assignedAgents=\{assignedAgents\}[\s\S]*onAssignedAgentIdsChange=\{handleAssignedAgentIdsChange\}/u);
	assert.match(source, /onAgentAssign=\{handleAgentAssign\}/u);
	assert.match(source, /onAssignedAgentSelect=\{handleOpenAgentSession\}/u);
	assert.match(source, /onContinueExistingSession=\{handleContinueExistingSession\}/u);
	assert.match(source, /onStartNewSession=\{handleAgentAssign\}/u);
	assert.match(source, /usedAgentIds=\{resolveUsedAgentIds\(sessions\)\}/u);
	assert.match(source, /actions\.invokeAgent\(agent, "context-pill", `@\$\{agent\.name\}`\);/u);
	assert.doesNotMatch(source, /WorkItemAssignedAgentsMenu/u);
});

test("Agent Assignment is registered with a catalog demo and documentation", () => {
	const page = readProjectFile("components/blocks/agent-assignment/page.tsx");
	const demo = readProjectFile("components/website/demos/blocks/agent-assignment-demo.tsx");
	const details = readProjectFile("app/data/details/blocks/agent-assignment.ts");
	const components = readProjectFile("app/data/components.ts");
	const manifest = readProjectFile("app/data/component-manifest.ts");
	const registry = readProjectFile("components/website/registry/blocks.ts");
	const variantRegistry = readProjectFile("components/website/registry/blocks-variants.ts");

	assert.match(page, /<AgentAssignment/u);
	assert.match(page, /onBrowseAgents=\{\(\) => undefined\}/u);
	assert.match(page, /onCreateAgent=\{\(\) => undefined\}/u);
	assert.match(page, /defaultPinnedAgentIds=\{DEFAULT_PINNED_SPACE_AGENT_IDS\}/u);
	assert.match(page, /pinnedItemsLabel=\{WORK_ITEM_PINNED_ITEMS_LABEL\}/u);
	assert.match(page, /usedAgentIds=\{DEMO_USED_AGENT_IDS\}/u);
	assert.match(page, /from "@\/components\/blocks\/agent-assignment\/demo-assigned-agents"/u);
	assert.match(page, /onContinueExistingSession=\{\(\) => undefined\}/u);
	assert.match(page, /onRenameAssignedAgent=\{\(\) => undefined\}/u);
	assert.match(page, /onStartNewSession=\{\(\) => undefined\}/u);
	assert.match(demo, /AgentAssignmentPage/u);
	assert.match(demo, /export function AgentAssignmentDemoDefault/u);
	assert.match(demo, /export function AgentAssignmentDemoSimple/u);
	assert.match(demo, /variant="default"/u);
	assert.match(demo, /variant="simple"/u);
	assert.match(details, /importStatement: `import \{ AgentAssignment \} from "@\/components\/blocks\/agent-assignment";`/u);
	assert.match(details, /title: "Default"/u);
	assert.match(details, /title: "Simple"/u);
	assert.match(details, /demoSlug: "agent-assignment-demo-default"/u);
	assert.match(details, /demoSlug: "agent-assignment-demo-simple"/u);
	assert.match(details, /type: '"default" \| "simple"'/u);
	assert.match(variantRegistry, /"agent-assignment-demo-default": dynamic/u);
	assert.match(variantRegistry, /"agent-assignment-demo-simple": dynamic/u);
	assert.match(components, /blockComponent\("agent-assignment", "Agent Assignment"\)/u);
	assert.match(manifest, /blockComponent\("agent-assignment", "Agent Assignment"\)/u);
	assert.match(registry, /"agent-assignment": dynamic/u);
});

async function loadAgentAssignmentClickHarness() {
	const mockModules = new Map([
		[
			"@/components/ui/popover",
			`
				import React from "react";
				export function Popover(props) { return React.createElement("div", { "data-open": props.open }, props.children); }
				export function PopoverTrigger(props) { return props.render ?? props.children ?? null; }
				export function PopoverContent(props) { return React.createElement("div", { "data-assignment-menu": "" }, props.children); }
			`,
		],
		[
			"@/components/ui/hover-card",
			`
				import React from "react";
				export function HoverCard(props) {
					const [hoverCloseCanceled, setHoverCloseCanceled] = React.useState(false);
					return React.createElement(
						"div",
						{
							"data-hover-close-canceled": hoverCloseCanceled,
							"data-open": props.open,
						},
						React.createElement("button", {
							"data-hover-open": "",
							onClick() {
								props.onOpenChange?.(true, {
									cancel() {},
									reason: "trigger-hover",
								});
							},
							type: "button",
						}),
						React.createElement("button", {
							"data-hover-close": "",
							onClick() {
								props.onOpenChange?.(false, {
									cancel() { setHoverCloseCanceled(true); },
									reason: "trigger-hover",
								});
							},
							type: "button",
						}),
						React.createElement("button", {
							"data-outside-press": "",
							onClick() {
								props.onOpenChange?.(false, {
									cancel() { setHoverCloseCanceled(true); },
									reason: "outside-press",
								});
							},
							type: "button",
						}),
						props.children,
					);
				}
				export function HoverCardTrigger() { return null; }
				export function HoverCardContent(props) { return React.createElement("div", { "data-assignment-menu": "" }, props.children); }
			`,
		],
		["@/components/ui/tooltip", "export function TooltipProvider(props) { return props.children; }"],
		["@/components/ui/avatar", "export function Avatar(props) { return props.children ?? null; }"],
		["@/components/ui/vpk-icons", "export function PlusIcon() { return null; }"],
		["@/lib/tokens", "export function token() { return ''; }"],
		["@/lib/utils", "export function cn(...values) { return values.filter(Boolean).join(' '); }"],
		[
			"@/components/blocks/agent-selector",
			`
				import React from "react";
				export function AgentSelector(props) {
					return React.createElement(
						"div",
						{ "data-agent-selector": "" },
						(props.agents ?? []).map((agent) => React.createElement(
							"button",
							{
								"data-agent-id": agent.id,
								key: agent.id,
								onClick() { props.onAgentToggle?.(agent.id); },
								type: "button",
							},
							agent.name,
						)),
					);
				}
			`,
		],
		[
			"@/components/ui-custom/rich-text-editor",
			`
				import React from "react";
				export function RichTextSuggestionMenu(props) {
					return React.createElement(
						"div",
						{ "data-suggestion-title": props.title },
						props.onBack
							? React.createElement("button", { onClick: props.onBack, type: "button" }, "Back")
							: null,
						(props.items ?? []).map((item) => React.createElement(
							"button",
							{
								key: item.id,
								onClick() { props.onSelect?.(item); },
								type: "button",
							},
							item.label,
						)),
					);
				}
			`,
		],
		["@atlaskit/icon/core/add", "export default function Icon() { return null; }"],
		["@atlaskit/icon/core/ai-chat", "export default function Icon() { return null; }"],
	]);
	const result = await esbuild.build({
		stdin: {
			contents: `
				import React from "react";
				import { AgentAssignment } from "./components/blocks/agent-assignment/components/agent-assignment.tsx";

				const AGENTS = [
					{ id: "github-copilot", name: "GitHub Copilot", byline: "Agent by GitHub" },
					{ id: "code-reviewer", name: "Code Reviewer", byline: "Reviews code" },
				];

				export function UsedAgentAssignmentProbe() {
					const [assignedAgentIds, setAssignedAgentIds] = React.useState(["github-copilot"]);
					const assignedAgents = AGENTS
						.filter((agent) => assignedAgentIds.includes(agent.id))
						.map((agent) => ({ ...agent, statusLabel: "Assigned" }));
					return React.createElement(AgentAssignment, {
						agents: AGENTS,
						assignedAgents,
						onAssignedAgentIdsChange: setAssignedAgentIds,
						onAssignedAgentSelect() {},
						onContinueExistingSession() {},
						onStartNewSession() {},
						openMode: "hover",
						usedAgentIds: ["github-copilot"],
						variant: "simple",
					});
				}

				export function EmptyHoverAssignmentProbe() {
					return React.createElement(AgentAssignment, {
						agents: AGENTS,
						assignedAgents: [],
						onAssignedAgentIdsChange() {},
						onAssignedAgentSelect() {},
						openMode: "hover",
						variant: "simple",
					});
				}

				export function DisplayOnlyAssignmentProbe() {
					return React.createElement(AgentAssignment, {
						agents: AGENTS,
						assignedAgents: [{ ...AGENTS[0], statusLabel: "Working" }],
						onAssignedAgentSelect() {},
						openMode: "hover",
						variant: "simple",
					});
				}

				export function DefaultHoverAssignedProbe() {
					return React.createElement(AgentAssignment, {
						agents: AGENTS,
						assignedAgents: [{ ...AGENTS[0], statusLabel: "Working" }],
						onAssignedAgentIdsChange() {},
						onAssignedAgentSelect() {},
						onRenameAssignedAgent() {},
						openMode: "hover",
						variant: "default",
					});
				}
			`,
			loader: "tsx",
			resolveDir: process.cwd(),
			sourcefile: "agent-assignment-click-harness.tsx",
		},
		bundle: true,
		external: ["react", "react-dom"],
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
		plugins: [
			{
				name: "agent-assignment-click-mocks",
				setup(build) {
					build.onResolve({ filter: /.*/ }, (args) => {
						if (args.path.includes("assigned-agents-menu")) {
							return { path: "assigned-agents-menu", namespace: "agent-assignment-click-mock" };
						}
						if (args.path.includes("assigned-agents-session-menu")) {
							return { path: "assigned-agents-session-menu", namespace: "agent-assignment-click-mock" };
						}
						if (args.path.includes("agent-assignment-default-field")) {
							return { path: "agent-assignment-default-field", namespace: "agent-assignment-click-mock" };
						}
						if (args.path.includes("assignment-session")) {
							return { path: "assignment-session", namespace: "agent-assignment-click-mock" };
						}
						if (args.path.includes("assignment-avatar")) {
							return { path: "assignment-avatar", namespace: "agent-assignment-click-mock" };
						}
						if (args.path.includes("use-assigned-agent-attention")) {
							return { path: "use-assigned-agent-attention", namespace: "agent-assignment-click-mock" };
						}
						if (mockModules.has(args.path)) {
							return { path: args.path, namespace: "agent-assignment-click-mock" };
						}
						return undefined;
					});
					build.onLoad({ filter: /.*/, namespace: "agent-assignment-click-mock" }, (args) => {
						const resolveDir = process.cwd();
						if (args.path === "assigned-agents-menu") {
							return {
								contents: `
									import React from "react";
									export function AssignedAgentsMenu(props) {
										return props.onAddAgent ? React.createElement(
											"button",
											{ onClick: props.onAddAgent, type: "button" },
											"Assign agent",
										) : React.createElement("div", null, "Read only");
									}
								`,
								loader: "tsx",
								resolveDir,
							};
						}
						if (args.path === "assigned-agents-session-menu") {
							return {
								contents: `
									import React from "react";
									export function AssignedAgentsSessionMenu(props) {
										return React.createElement(
											"div",
											{ "data-assigned-session-menu": "" },
											React.createElement("button", {
												"data-more-menu-open": "",
												onClick() { props.onMoreMenuOpenChange?.(true); },
												type: "button",
											}, "Open more menu"),
											React.createElement("button", {
												"data-more-menu-close": "",
												onClick() { props.onMoreMenuOpenChange?.(false); },
												type: "button",
											}, "Close more menu"),
										);
									}
								`,
								loader: "tsx",
								resolveDir,
							};
						}
						if (args.path === "agent-assignment-default-field") {
							return {
								contents: `
									import React from "react";
									export function AgentAssignmentDefaultField() { return null; }
								`,
								loader: "tsx",
								resolveDir,
							};
						}
						if (args.path === "assignment-session") {
							return {
								contents: "export function toAssignmentSessionItem() { return {}; }",
								loader: "tsx",
								resolveDir,
							};
						}
						if (args.path === "assignment-avatar") {
							return { contents: "export function AssignmentAvatar() { return null; }", loader: "tsx", resolveDir };
						}
						if (args.path === "use-assigned-agent-attention") {
							return {
								contents: `
									export function isAssignedAgentAttentionKind(kind) {
										return kind === "needs-input" || kind === "finished";
									}
									export function useAssignedAgentAttention() {
										return {
											acknowledgeAttention() {},
											isAttentionAcknowledged() { return false; },
										};
									}
								`,
								loader: "tsx",
								resolveDir,
							};
						}
						return {
							contents: mockModules.get(args.path),
							loader: "tsx",
							resolveDir,
						};
					});
				},
			},
		],
	});

	return loadCjsModuleFromText(result.outputFiles[0].text, "agent-assignment-click-harness.cjs");
}

test("hover-open Agent Assignment only retains explicitly transitioned interactive views", async () => {
	const { window } = parseHTML("<!doctype html><html><body><div id='app'></div></body></html>");
	const originalGlobals = {
		document: globalThis.document,
		Event: globalThis.Event,
		HTMLElement: globalThis.HTMLElement,
		Node: globalThis.Node,
		window: globalThis.window,
		actEnvironment: globalThis.IS_REACT_ACT_ENVIRONMENT,
	};
	Object.assign(globalThis, {
		document: window.document,
		Event: window.Event,
		HTMLElement: window.HTMLElement,
		Node: window.Node,
		window,
		IS_REACT_ACT_ENVIRONMENT: true,
	});
	const originalFocus = window.HTMLElement.prototype.focus;
	const focusedElements = [];
	window.HTMLElement.prototype.focus = function focus() {
		focusedElements.push(this);
		return originalFocus.call(this);
	};

	const harness = await loadAgentAssignmentClickHarness();
	const root = createRoot(window.document.getElementById("app"));
	try {
		await React.act(async () => {
			root.render(React.createElement(harness.UsedAgentAssignmentProbe));
		});
		await React.act(async () => {
			window.document.querySelector("[data-hover-open]").click();
		});
		assert.equal(window.document.querySelector("[data-open]").getAttribute("data-open"), "true");
		assert.match(window.document.body.textContent, /Assign agent/u);
		assert.doesNotMatch(window.document.body.textContent, /Continue in existing session/u);

		await React.act(async () => {
			const assignButton = [...window.document.querySelectorAll("button")]
				.find((button) => button.textContent === "Assign agent");
			assignButton.focus();
			assignButton.click();
		});
		assert.match(window.document.body.textContent, /GitHub Copilot/u);
		const lastFocusedElement = focusedElements.at(-1);
		assert.equal(lastFocusedElement?.isConnected, true);
		assert.ok(lastFocusedElement?.querySelector("[data-agent-selector]"));

		await React.act(async () => {
			window.document.querySelector("[data-hover-close]").click();
		});
		assert.equal(window.document.querySelector("[data-open]").getAttribute("data-open"), "true");
		assert.equal(
			window.document.querySelector("[data-hover-close-canceled]").getAttribute("data-hover-close-canceled"),
			"true",
		);
		assert.ok(window.document.querySelector("[data-agent-selector]"));

		await React.act(async () => {
			window.document.querySelector("[data-agent-id='github-copilot']").click();
		});
		assert.match(window.document.body.textContent, /Back/u);
		assert.match(window.document.body.textContent, /Continue in existing session/u);
		assert.match(window.document.body.textContent, /Start a new session/u);
		assert.doesNotMatch(window.document.body.textContent, /GitHub Copilot/u);

		await React.act(async () => {
			root.render(React.createElement(harness.DisplayOnlyAssignmentProbe));
		});
		await React.act(async () => {
			window.document.querySelector("[data-hover-open]").click();
		});
		assert.match(window.document.body.textContent, /Read only/u);
		assert.doesNotMatch(window.document.body.textContent, /Assign agent/u);

		await React.act(async () => {
			root.render(React.createElement(harness.EmptyHoverAssignmentProbe));
		});
		await React.act(async () => {
			window.document.querySelector("[data-hover-open]").click();
		});
		await React.act(async () => {
			window.document.querySelector("[data-hover-close]").click();
		});
		assert.equal(window.document.querySelector("[data-open]").getAttribute("data-open"), "false");
		assert.equal(
			window.document.querySelector("[data-hover-close-canceled]").getAttribute("data-hover-close-canceled"),
			"false",
		);
	} finally {
		await React.act(async () => {
			root.unmount();
		});
		window.HTMLElement.prototype.focus = originalFocus;
		Object.assign(globalThis, originalGlobals);
	}
});

test("hover-open default assignment keeps the picker while the portalled more-menu is open", async () => {
	const { window } = parseHTML("<!doctype html><html><body><div id='app'></div></body></html>");
	const originalGlobals = {
		document: globalThis.document,
		Event: globalThis.Event,
		HTMLElement: globalThis.HTMLElement,
		Node: globalThis.Node,
		window: globalThis.window,
		actEnvironment: globalThis.IS_REACT_ACT_ENVIRONMENT,
	};
	Object.assign(globalThis, {
		document: window.document,
		Event: window.Event,
		HTMLElement: window.HTMLElement,
		Node: window.Node,
		window,
		IS_REACT_ACT_ENVIRONMENT: true,
	});

	const harness = await loadAgentAssignmentClickHarness();
	const root = createRoot(window.document.getElementById("app"));
	try {
		await React.act(async () => {
			root.render(React.createElement(harness.DefaultHoverAssignedProbe));
		});
		await React.act(async () => {
			window.document.querySelector("[data-hover-open]").click();
		});
		assert.equal(window.document.querySelector("[data-open]").getAttribute("data-open"), "true");
		assert.ok(window.document.querySelector("[data-assigned-session-menu]"));

		await React.act(async () => {
			window.document.querySelector("[data-hover-close]").click();
		});
		assert.equal(window.document.querySelector("[data-open]").getAttribute("data-open"), "false");

		await React.act(async () => {
			window.document.querySelector("[data-hover-open]").click();
		});
		await React.act(async () => {
			window.document.querySelector("[data-more-menu-open]").click();
		});
		await React.act(async () => {
			window.document.querySelector("[data-hover-close]").click();
		});
		assert.equal(window.document.querySelector("[data-open]").getAttribute("data-open"), "true");
		assert.equal(
			window.document.querySelector("[data-hover-close-canceled]").getAttribute("data-hover-close-canceled"),
			"true",
		);

		await React.act(async () => {
			window.document.querySelector("[data-outside-press]").click();
		});
		assert.equal(window.document.querySelector("[data-open]").getAttribute("data-open"), "true");

		await React.act(async () => {
			window.document.querySelector("[data-more-menu-close]").click();
		});
		await React.act(async () => {
			window.document.querySelector("[data-hover-close]").click();
		});
		assert.equal(window.document.querySelector("[data-open]").getAttribute("data-open"), "false");
	} finally {
		await React.act(async () => {
			root.unmount();
		});
		Object.assign(globalThis, originalGlobals);
	}
});
