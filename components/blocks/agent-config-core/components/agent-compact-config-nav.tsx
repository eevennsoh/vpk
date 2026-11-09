"use client";

import type { ReactElement } from "react";
import { useCallback, useState } from "react";

import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import AutomationIcon from "@atlaskit/icon/core/automation";

import { TriggerProviderSearchList, type AgentAutomationRule } from "@/components/blocks/trigger/page";
import { createAgentTriggerValue } from "@/components/blocks/trigger/data/trigger-catalog";
import { getToolIdFromMentionId } from "@/components/blocks/editor-palette/data/mention-sources";
import { EditorPaletteSearchPicker, type EditorPaletteSearchCategory } from "@/components/blocks/editor-palette/page";
import { useHasHorizontalOverflow } from "@/components/hooks/use-has-horizontal-overflow";
import { AgentCompactNavMenuInitialHighlightReset, AgentCompactNavMenuList, useCompactNavMenuKeepOpen, useCompactNavMenuNoInitialHighlight } from "@/components/blocks/agent-config-core/components/agent-compact-nav-menu";
import { AgentCompactConversationStartersNavButton } from "@/components/blocks/agent-config-core/components/agent-compact-conversation-starters-nav";
import { AGENT_COMPACT_CONFIG_NAV_TRIGGER_CLASS, AgentCompactConfigNavButton, AgentCompactReferenceRow, AgentCompactTriggerRow, useDisabledLabelSet } from "@/components/blocks/agent-config-core/components/agent-compact-config-nav-rows";
import { getTagColorForAgentAvatar, tagColorToMenuIconClassName } from "@/components/blocks/agent-config-core/components/agent-config-visuals";
import { AgentMemorySelector, AgentReasoningSelector, type KnowledgeModeValue, type MemoryModeValue, type ReasoningModeValue } from "@/components/blocks/agent-config-core/components/agent-reasoning-memory-selectors";
import { createAutomationRuleFromEvent, getAgentAutomationRules, getNonEmptyConfigItems, serializeAgentAutomationRuleLabels, type AgentConfigFormValue, type AgentConfigListFieldName, type AgentConfigReferenceListFieldName, type AgentDirectoryKind, type AgentHideableConfigField } from "@/components/blocks/agent-config-core/lib/agent-config-model";
import { AGENT_REFERENCE_CATEGORY_BY_CONFIG_FIELD } from "@/components/blocks/agent-config-core/lib/agent-reference-mapping";
import { buildHorizontalScrollMaskStyle } from "@/components/visual/scroll-mask/lib";
import { DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu";
import { IconTile } from "@/components/ui/icon-tile";
import { Menubar, MenubarContent, MenubarMenu, MenubarTrigger } from "@/components/ui/menubar";
import type { TagColor } from "@/components/ui/tag";
import { PlusIcon } from "@/components/ui/vpk-icons";
import type { RichTextSuggestionMenuItem } from "@/components/ui-custom/rich-text-editor";
import { cn } from "@/lib/utils";
import {
	getAgentCompactEmptyConfigNavItems,
	getConversationStarterSummaryItems,
	isAgentConfigToolbarFieldVisible,
	openAgentDirectoryOrAppendListItem,
	type AgentCompactConfigNavItem,
	type AgentConfigToolbarFieldName,
	type AgentInlineSearchField,
} from "./agent-compact-config-nav-data";

export { MAX_AGENT_CONVERSATION_STARTERS } from "@/components/blocks/agent-config-core/components/agent-compact-conversation-starters-nav";
export {
	getAgentCompactEmptyConfigNavItems,
	getAgentFilledSummaryAddLabel,
	getConversationStarterSummaryItems,
	isAgentConfigToolbarFieldVisible,
	openAgentDirectoryOrAppendListItem,
} from "./agent-compact-config-nav-data";
export type {
	AgentCompactConfigNavItem,
	AgentConfigToolbarFieldName,
	AgentInlineSearchField,
} from "./agent-compact-config-nav-data";

// Match the shared Menubar's default `gap-0.5` (2px) so the connected config
// strip spaces items identically to the base component.
const AGENT_COMPACT_CONFIG_NAV_GAP = 2;
const AGENT_COMPACT_CONFIG_NAV_SCROLL_EDGE_THRESHOLD = 4;
const AGENT_COMPACT_CONFIG_NAV_START_MASK_STYLE = buildHorizontalScrollMaskStyle({
	edge: "start",
	fadeSize: "var(--ds-space-300)",
});
const AGENT_COMPACT_CONFIG_NAV_END_MASK_STYLE = buildHorizontalScrollMaskStyle({
	edge: "end",
	fadeSize: "var(--ds-space-300)",
});
const AGENT_COMPACT_CONFIG_NAV_BOTH_MASK_STYLE = buildHorizontalScrollMaskStyle({
	edge: "both",
	fadeSize: "var(--ds-space-300)",
});
const AGENT_INLINE_SEARCH_CATEGORY_BY_FIELD: Record<AgentInlineSearchField, EditorPaletteSearchCategory> = {
	apps: "app",
	knowledge: "knowledge",
	skills: "skill",
	tools: "tool",
};

function getAgentCompactConfigNavItemOnClick(
	item: AgentCompactConfigNavItem,
	onAppendListItem?: (field: AgentConfigListFieldName) => void,
	onOpenDirectory?: (directory: AgentDirectoryKind, selectedItem?: string) => void,
	onEditTriggers?: (seed?: AgentAutomationRule) => void,
): (() => void) | undefined {
	if (item.agentFieldName === "trigger") {
		return () => onEditTriggers?.();
	}

	if (item.agentFieldName === "skills") {
		return () => openAgentDirectoryOrAppendListItem("skills", "skills", onOpenDirectory, onAppendListItem);
	}

	if (item.agentFieldName === "conversationStarters") {
		return () => openAgentDirectoryOrAppendListItem("conversationStarters", "conversationStarters", onOpenDirectory, onAppendListItem);
	}

	if ("listFieldName" in item) {
		return () => onAppendListItem?.(item.listFieldName);
	}
	return undefined;
}

export function AgentCompactSubagentsNavButton({
	disabledItems,
	item,
	onCreateSubagent,
	onManageSubagents,
	onRemoveSubagent,
	onSelectSubagent,
	onToggleItem,
	renderTrigger,
	screenAssistantTargetId,
	selectedIndex,
	subagents,
	tagColor,
}: Readonly<{
	disabledItems?: readonly string[];
	item: AgentCompactConfigNavItem;
	onCreateSubagent?: () => void;
	onManageSubagents?: () => void;
	onRemoveSubagent?: (index: number) => void;
	onSelectSubagent?: (index: number) => void;
	onToggleItem?: (index: number, enabled: boolean) => void;
	// Overrides the default collapsed-nav trigger so the expanded Subagents row
	// can open this same dropdown from its inline "Add" button.
	renderTrigger?: ReactElement;
	screenAssistantTargetId?: string;
	selectedIndex?: number;
	subagents: readonly string[];
	tagColor?: TagColor;
}>) {
	const isEmpty = item.count === 0;
	const disabledSet = useDisabledLabelSet(disabledItems);
	const compactNavMenu = useCompactNavMenuNoInitialHighlight();

	return (
		<MenubarMenu onOpenChange={compactNavMenu.onOpenChange}>
			{renderTrigger ? (
				<MenubarTrigger render={renderTrigger} />
			) : (
				<MenubarTrigger
					className={AGENT_COMPACT_CONFIG_NAV_TRIGGER_CLASS}
					render={(
						<AgentCompactConfigNavButton
							aria-label="Subagents"
							item={item}
							screenAssistantTargetId={screenAssistantTargetId}
						/>
					)}
				/>
			)}
			<MenubarContent align="start" className="w-64">
				<AgentCompactNavMenuInitialHighlightReset
					enabled={compactNavMenu.resetInitialHighlight}
					resetToken={compactNavMenu.resetToken}
				/>
				<DropdownMenuItem
					elemBefore={
						<span className="inline-flex size-6 shrink-0 items-center justify-center [&_svg]:size-4">
							<PlusIcon />
						</span>
					}
					onClick={onCreateSubagent}
				>
					Add subagent
				</DropdownMenuItem>
				<DropdownMenuItem
					elemBefore={
						<span className="inline-flex size-6 shrink-0 items-center justify-center [&_svg]:size-4">
							<AiAgentIcon label="" />
						</span>
					}
					onClick={onManageSubagents ?? onCreateSubagent}
				>
					Manage subagents
				</DropdownMenuItem>
				{isEmpty ? null : <DropdownMenuSeparator />}
				{isEmpty ? null : (
					<AgentCompactNavMenuList>
						<DropdownMenuGroup className="p-0">
							{subagents.map((subagent, index) => (
								<AgentCompactReferenceRow
									key={`${subagent}-${index}`}
									category="subagent"
									enabled={!disabledSet.has(subagent.trim())}
									label={subagent}
									onClick={() => onSelectSubagent?.(index)}
									onRemove={onRemoveSubagent ? () => onRemoveSubagent(index) : undefined}
									onToggle={onToggleItem ? (enabled) => onToggleItem(index, enabled) : undefined}
									selected={selectedIndex === index}
									tagColor={tagColor}
								/>
							))}
						</DropdownMenuGroup>
					</AgentCompactNavMenuList>
				)}
			</MenubarContent>
		</MenubarMenu>
	);
}

// Automations dropdown: the automation list (when any) scrolls in the popup body,
// and the "Add automation ›" flyout + "Manage automations" live in a permanent
// sticky footer pinned to the bottom — so adding automations grows the list at the top
// while the footer stays anchored. The flyout reuses the full TriggerPicker
// provider/event content so behavior matches the expanded summary row exactly.
export function AgentCompactTriggersNavButton({
	automationRules,
	item,
	triggers,
	onSelectEvent,
	onEditTriggers,
	onManageTriggers,
	onAutomationRulesChange,
	renderTrigger,
	screenAssistantTargetId,
	tagColor,
}: Readonly<{
	automationRules?: readonly AgentAutomationRule[];
	item: AgentCompactConfigNavItem;
	triggers: readonly string[];
	onSelectEvent: (providerId: Parameters<typeof createAgentTriggerValue>[0], eventId: string) => void;
	onEditTriggers?: (seed?: AgentAutomationRule) => void;
	onAutomationRulesChange?: (automationRules: readonly AgentAutomationRule[]) => void;
	// Opens the list-management dialog (reorder / toggle / delete / add), mirroring
	// "Manage subagents". Falls back to the rule-builder (`onEditTriggers`) when
	// not provided.
	onManageTriggers?: () => void;
	// Overrides the default collapsed-nav trigger button. The expanded Triggers
	// summary row passes its inline chips / "Edit" button here so they open this
	// same dropdown.
	renderTrigger?: ReactElement;
	screenAssistantTargetId?: string;
	// Agent collection color (derived from the avatar family). Tints each automation
	// row's leading glyph so the list mirrors the automation summary chip and
	// the subagent rows instead of the first trigger's provider logo.
	tagColor?: TagColor;
}>) {
	const isEmpty = triggers.length === 0;
	// Local enable/disable state keyed by row, mirroring the subagent switcher.
	// Disabled rows read as muted but stay listed until removed via "Manage".
	const [disabledTriggers, setDisabledTriggers] = useState<ReadonlySet<number>>(() => new Set());
	const setTriggerEnabled = useCallback((index: number, enabled: boolean) => {
		if (automationRules && onAutomationRulesChange) {
			onAutomationRulesChange(
				automationRules.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, enabled } : rule)),
			);
			return;
		}
		setDisabledTriggers((prev) => {
			const next = new Set(prev);
			if (enabled) {
				next.delete(index);
			} else {
				next.add(index);
			}
			return next;
		});
	}, [automationRules, onAutomationRulesChange]);
	// Controlled open for the "Add trigger ›" flyout so typing in its search input
	// (which blurs the submenu trigger) doesn't collapse the flyout: Base UI
	// reports that as a `focus-out` close, which we ignore. All explicit closes
	// (item press, escape, pointer leave, trigger toggle) still pass through.
	const [addTriggerOpen, setAddTriggerOpen] = useState(false);
	const handleAddTriggerOpenChange = useCallback(
		(nextOpen: boolean, eventDetails: { reason?: string }) => {
			if (!nextOpen && eventDetails.reason === "focus-out") {
				return;
			}
			setAddTriggerOpen(nextOpen);
		},
		[],
	);
	const compactNavMenu = useCompactNavMenuNoInitialHighlight();
	// "Add automation ›" reuses the picker's full searchable provider list (the
	// editor-palette "search" variant), so the flyout shows the same sticky search
	// input over the provider→event submenus as the expanded summary row's picker.
	const addTriggerFlyout = (
		<DropdownMenuSub open={addTriggerOpen} onOpenChange={handleAddTriggerOpenChange}>
			<DropdownMenuSubTrigger>
				<span className="flex items-center gap-3">
					<span className="inline-flex size-6 shrink-0 items-center justify-center text-icon-subtle [&_svg]:size-4 [&_svg]:text-icon-subtle">
						<PlusIcon />
					</span>
					Add automation
				</span>
			</DropdownMenuSubTrigger>
			<DropdownMenuSubContent className="w-80 p-0">
				<TriggerProviderSearchList autoFocus onSelectEvent={onSelectEvent} />
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	);

	return (
		<MenubarMenu onOpenChange={compactNavMenu.onOpenChange}>
			{renderTrigger ? (
				<MenubarTrigger render={renderTrigger} />
			) : (
				<MenubarTrigger
					className={AGENT_COMPACT_CONFIG_NAV_TRIGGER_CLASS}
					render={(
						<AgentCompactConfigNavButton
							aria-label="Automations"
							item={item}
							screenAssistantTargetId={screenAssistantTargetId}
						/>
					)}
				/>
			)}
			<MenubarContent align="start" className="w-64">
				<AgentCompactNavMenuInitialHighlightReset
					enabled={compactNavMenu.resetInitialHighlight}
					resetToken={compactNavMenu.resetToken}
				/>
				{addTriggerFlyout}
				<DropdownMenuItem
					elemBefore={
						<span className="inline-flex size-6 shrink-0 items-center justify-center [&_svg]:size-4">
							<AutomationIcon label="" />
						</span>
					}
					onClick={() => (onManageTriggers ?? onEditTriggers)?.()}
				>
					Manage automations
				</DropdownMenuItem>
				{isEmpty ? null : <DropdownMenuSeparator />}
				{isEmpty ? null : (
					<AgentCompactNavMenuList>
						<DropdownMenuGroup className="p-0">
							{triggers.map((trigger, index) => {
								const rule = automationRules?.[index];
								// Every automation row leads with the same glyph in a
								// bordered tile, tinted by the agent's collection color — NOT
								// the first trigger's provider logo. An automation can own multiple
								// triggers, so a single provider mark would misrepresent it.
								// This mirrors the automation summary chip and the subagent rows
								// (see `renderAgentReferenceRowVisual`).
								const automationIcon = (
									<IconTile
										aria-hidden
										className={cn(
											"border border-border bg-surface",
											tagColor ? tagColorToMenuIconClassName[tagColor] : "text-icon-subtlest",
										)}
										icon={<AutomationIcon label="" size="small" />}
										label=""
										size="small"
									/>
								);
								return (
									<AgentCompactTriggerRow
										key={`trigger-${trigger}-${index}`}
										icon={automationIcon}
										label={trigger}
										enabled={(rule?.enabled !== false) && !disabledTriggers.has(index)}
										onToggle={(enabled) => setTriggerEnabled(index, enabled)}
										onEdit={onEditTriggers ? () => onEditTriggers(rule) : undefined}
									/>
								);
							})}
						</DropdownMenuGroup>
					</AgentCompactNavMenuList>
				)}
			</MenubarContent>
		</MenubarMenu>
	);
}

// Tools/Skills share one shape: configured items scroll in the body, while
// "Add {label} ›" and "Browse {label}" stay pinned in a permanent footer.
// Knowledge layers its mode options above the list (handled by
// AgentKnowledgeSelector instead).
export function AgentCompactDirectoryNavButton({
	item,
	directory,
	items,
	browseLabel,
	onBrowse,
	disabledItems,
	onAddSearchItem,
	onPickTool,
	onRemoveItem,
	onSelectItem,
	onToggleItem,
	renderTrigger,
	screenAssistantTargetId,
}: Readonly<{
	item: AgentCompactConfigNavItem;
	directory: AgentInlineSearchField;
	items: readonly string[];
	browseLabel: string;
	onBrowse: () => void;
	disabledItems?: readonly string[];
	// Skills: picking a result adds it immediately. Tools: handled by
	// `onPickTool` instead (opens the tools directory on that tool's detail).
	onAddSearchItem?: (item: RichTextSuggestionMenuItem) => void;
	onPickTool?: (toolId: string) => void;
	onRemoveItem?: (index: number) => void;
	onSelectItem?: (item: string) => void;
	onToggleItem?: (index: number, enabled: boolean) => void;
	// Overrides the default collapsed-nav trigger button. The expanded summary
	// rows pass their inline "Add" button here so it opens this same dropdown.
	renderTrigger?: ReactElement;
	screenAssistantTargetId?: string;
}>) {
	const isEmpty = items.length === 0;
	const disabledSet = useDisabledLabelSet(disabledItems);
	const addLabel = `Add ${item.label.toLowerCase()}`;
	// Multi-select (skills): keep the menu open after each pick so several skills
	// can be added in a row. Both the picker submenu and (for the controllable row
	// "Edit" instances) the root menu ignore the focus-out close a pick triggers.
	// Tools are excluded — picking a tool intentionally closes to open the
	// directory dialog on that tool's detail.
	const nav = useCompactNavMenuKeepOpen(Boolean(renderTrigger));
	const [addOpen, setAddOpen] = useState(false);
	const handleAddOpenChange = useCallback(
		(nextOpen: boolean) => {
			if (!nextOpen && nav.keepOpenRef.current) {
				return;
			}
			setAddOpen(nextOpen);
		},
		[nav.keepOpenRef],
	);
	const browseItem = (
		<DropdownMenuItem
			elemBefore={
				<span className="inline-flex size-6 shrink-0 items-center justify-center [&_svg]:size-4">
					<item.Icon label="" />
				</span>
			}
			onClick={onBrowse}
		>
			{browseLabel}
		</DropdownMenuItem>
	);
	// Tools open the directory dialog on the chosen tool's detail; skills add
	// the picked result immediately and keep the picker open for the next add.
	const handlePickerSelect = directory === "tools"
		? (onPickTool ? (picked: RichTextSuggestionMenuItem) => onPickTool(getToolIdFromMentionId(picked.id)) : undefined)
		: (onAddSearchItem
			? (picked: RichTextSuggestionMenuItem) => {
					nav.suppressNextClose();
					onAddSearchItem(picked);
				}
			: undefined);
	const addSearchFlyout = (
		<DropdownMenuSub open={addOpen} onOpenChange={handleAddOpenChange}>
			<DropdownMenuSubTrigger>
				<span className="flex items-center gap-3">
					<span className="inline-flex size-6 shrink-0 items-center justify-center text-icon-subtle [&_svg]:size-4 [&_svg]:text-icon-subtle">
						<PlusIcon />
					</span>
					{addLabel}
				</span>
			</DropdownMenuSubTrigger>
			<DropdownMenuSubContent className="w-auto min-w-0 overflow-visible border-0 bg-transparent p-0 shadow-none">
				<EditorPaletteSearchPicker
					autoFocus
					category={AGENT_INLINE_SEARCH_CATEGORY_BY_FIELD[directory]}
					className="rich-text-command-menu-borderless"
					excludeLabels={items}
					keepOpenOnSelect={directory !== "tools"}
					onBrowseAll={onBrowse}
					onSelectItem={handlePickerSelect}
				/>
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	);

	return (
		<MenubarMenu {...nav.rootProps}>
			{renderTrigger ? (
				<MenubarTrigger render={renderTrigger} />
			) : (
				<MenubarTrigger
					className={AGENT_COMPACT_CONFIG_NAV_TRIGGER_CLASS}
					render={(
						<AgentCompactConfigNavButton
							aria-label={item.label}
							item={item}
							screenAssistantTargetId={screenAssistantTargetId}
						/>
					)}
				/>
			)}
			<MenubarContent align="start" className="w-64">
				<AgentCompactNavMenuInitialHighlightReset
					enabled={nav.resetInitialHighlight}
					resetToken={nav.resetToken}
				/>
				{addSearchFlyout}
				{browseItem}
				{isEmpty ? null : <DropdownMenuSeparator />}
				{isEmpty ? null : (
					<AgentCompactNavMenuList>
						<DropdownMenuGroup className="p-0">
							{items.map((value, index) => (
								<AgentCompactReferenceRow
									key={`${directory}-${value}-${index}`}
									category={AGENT_REFERENCE_CATEGORY_BY_CONFIG_FIELD[directory]}
									enabled={!disabledSet.has(value.trim())}
									label={value}
									onClick={onSelectItem ? () => onSelectItem(value) : undefined}
									onRemove={onRemoveItem ? () => onRemoveItem(index) : undefined}
									onToggle={onToggleItem ? (enabled) => onToggleItem(index, enabled) : undefined}
								/>
							))}
						</DropdownMenuGroup>
					</AgentCompactNavMenuList>
				)}
			</MenubarContent>
		</MenubarMenu>
	);
}

// Apps mirror the Skills/Tools directory dropdown shell exactly: configured
// rows scroll above a pinned footer that holds an inline "Add app ›" search
// flyout and a "Browse apps" item. Picking a flyout result adds the app by
// label (via `onAddSearchItem`); "Browse apps" opens the full directory for
// connection/detail. Clicking the collapsed-nav trigger opens this menu.
export function AgentCompactAppsNavButton({
	item,
	apps,
	disabledItems,
	onAddSearchItem,
	onBrowse,
	onRemoveItem,
	onSelectItem,
	onToggleItem,
	renderTrigger,
	screenAssistantTargetId,
}: Readonly<{
	item: AgentCompactConfigNavItem;
	apps: readonly string[];
	disabledItems?: readonly string[];
	// Picking a flyout result adds it immediately (mirrors Skills).
	onAddSearchItem?: (item: RichTextSuggestionMenuItem) => void;
	onBrowse: () => void;
	onRemoveItem?: (index: number) => void;
	onSelectItem?: (item: string) => void;
	onToggleItem?: (index: number, enabled: boolean) => void;
	// Overrides the default collapsed-nav trigger button so other surfaces can
	// open this same dropdown from their own inline control.
	renderTrigger?: ReactElement;
	screenAssistantTargetId?: string;
}>) {
	const isEmpty = apps.length === 0;
	const disabledSet = useDisabledLabelSet(disabledItems);
	const addLabel = `Add ${item.label.toLowerCase()}`;
	// Multi-select: keep the menu open after each pick so several apps can be added
	// in a row. Both the picker submenu and (for the controllable row "Edit"
	// instances) the root menu ignore the focus-out close that a pick triggers.
	const nav = useCompactNavMenuKeepOpen(Boolean(renderTrigger));
	const [addOpen, setAddOpen] = useState(false);
	const handleAddOpenChange = useCallback(
		(nextOpen: boolean) => {
			if (!nextOpen && nav.keepOpenRef.current) {
				return;
			}
			setAddOpen(nextOpen);
		},
		[nav.keepOpenRef],
	);
	const handleAddItem = useCallback(
		(picked: RichTextSuggestionMenuItem) => {
			nav.suppressNextClose();
			onAddSearchItem?.(picked);
		},
		[nav, onAddSearchItem],
	);
	const addSearchFlyout = (
		<DropdownMenuSub open={addOpen} onOpenChange={handleAddOpenChange}>
			<DropdownMenuSubTrigger>
				<span className="flex items-center gap-3">
					<span className="inline-flex size-6 shrink-0 items-center justify-center text-icon-subtle [&_svg]:size-4 [&_svg]:text-icon-subtle">
						<PlusIcon />
					</span>
					{addLabel}
				</span>
			</DropdownMenuSubTrigger>
			<DropdownMenuSubContent className="w-auto min-w-0 overflow-visible border-0 bg-transparent p-0 shadow-none">
				<EditorPaletteSearchPicker
					autoFocus
					category={AGENT_INLINE_SEARCH_CATEGORY_BY_FIELD.apps}
					className="rich-text-command-menu-borderless"
					excludeLabels={apps}
					keepOpenOnSelect
					onBrowseAll={onBrowse}
					onSelectItem={handleAddItem}
				/>
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	);

	return (
		<MenubarMenu {...nav.rootProps}>
			{renderTrigger ? (
				<MenubarTrigger render={renderTrigger} />
			) : (
				<MenubarTrigger
					className={AGENT_COMPACT_CONFIG_NAV_TRIGGER_CLASS}
					render={(
						<AgentCompactConfigNavButton
							aria-label={item.label}
							item={item}
							screenAssistantTargetId={screenAssistantTargetId}
						/>
					)}
				/>
			)}
			<MenubarContent align="start" className="w-64">
				<AgentCompactNavMenuInitialHighlightReset
					enabled={nav.resetInitialHighlight}
					resetToken={nav.resetToken}
				/>
				{addSearchFlyout}
				<DropdownMenuItem
					elemBefore={
						<span className="inline-flex size-6 shrink-0 items-center justify-center [&_svg]:size-4">
							<item.Icon label="" />
						</span>
					}
					onClick={onBrowse}
				>
					Browse {item.label.toLowerCase()}
				</DropdownMenuItem>
				{isEmpty ? null : <DropdownMenuSeparator />}
				{isEmpty ? null : (
					<AgentCompactNavMenuList>
						<DropdownMenuGroup className="p-0">
							{apps.map((value, index) => (
								<AgentCompactReferenceRow
									key={`apps-${value}-${index}`}
									category="app"
									enabled={!disabledSet.has(value.trim())}
									label={value}
									onClick={onSelectItem ? () => onSelectItem(value) : undefined}
									onRemove={onRemoveItem ? () => onRemoveItem(index) : undefined}
									onToggle={onToggleItem ? (enabled) => onToggleItem(index, enabled) : undefined}
								/>
							))}
						</DropdownMenuGroup>
					</AgentCompactNavMenuList>
				)}
			</MenubarContent>
		</MenubarMenu>
	);
}

export function AgentCompactEmptyConfigNav({
	avatarSrc,
	config,
	hiddenConfigFields,
	hiddenFieldNames,
	visibleFieldNames,
	onManageSubagents,
	onAddListValues,
	onAppendListItem,
	onEditTriggers,
	onManageTriggers,
	onAutomationRulesChange,
	onListItemChange,
	onOpenDirectory,
	onRemoveListItem,
	onSelectListItem,
	onToggleListItem,
	reasoningValue,
	onReasoningValueChange,
	memoryMode,
	onMemoryModeChange,
	screenAssistantTargetPrefix,
	selectedListItemIndexByField,
}: Readonly<{
	avatarSrc?: string;
	config?: AgentConfigFormValue;
	hiddenConfigFields?: ReadonlySet<AgentHideableConfigField>;
	visibleFieldNames?: ReadonlySet<AgentConfigToolbarFieldName>;
	// Field names (any `agentFieldName`) to omit from the chip strip — used to
	// hide fields that are already promoted to summary rows in the hybrid panel.
	hiddenFieldNames?: ReadonlySet<string>;
	onManageSubagents?: () => void;
	onAddListValues?: (field: AgentConfigReferenceListFieldName, values: readonly string[]) => void;
	onAppendListItem?: (field: AgentConfigListFieldName) => void;
	onEditTriggers?: (seed?: AgentAutomationRule) => void;
	onManageTriggers?: () => void;
	onAutomationRulesChange?: (automationRules: readonly AgentAutomationRule[]) => void;
	onListItemChange?: (field: AgentConfigListFieldName, index: number, value: string) => void;
	onOpenDirectory?: (directory: AgentDirectoryKind, selectedItem?: string) => void;
	onRemoveListItem?: (field: AgentConfigListFieldName, index: number) => void;
	onSelectListItem?: (field: AgentConfigListFieldName, index: number) => void;
	onToggleListItem?: (field: AgentConfigListFieldName, index: number, enabled: boolean) => void;
	reasoningValue: ReasoningModeValue;
	onReasoningValueChange: (next: ReasoningModeValue) => void;
	knowledgeMode: KnowledgeModeValue;
	onKnowledgeModeChange: (next: KnowledgeModeValue) => void;
	memoryMode: MemoryModeValue;
	onMemoryModeChange: (next: MemoryModeValue) => void;
	screenAssistantTargetPrefix?: string;
	selectedListItemIndexByField?: Partial<Record<AgentConfigListFieldName, number>>;
}>) {
	// `agentFieldName` doubles as a hideable-field key for trigger/subagents/
	// conversationStarters; other field names never appear in the hidden set.
	const items = getAgentCompactEmptyConfigNavItems(config).filter(
		(item) =>
			isAgentConfigToolbarFieldVisible(item.agentFieldName, hiddenConfigFields, visibleFieldNames)
			&& !hiddenFieldNames?.has(item.agentFieldName),
	);
	const navOverflow = useHasHorizontalOverflow<HTMLDivElement>({
		edgeThreshold: AGENT_COMPACT_CONFIG_NAV_SCROLL_EDGE_THRESHOLD,
	});
	const scrollMaskStyle = navOverflow.canScrollLeft && navOverflow.canScrollRight
		? AGENT_COMPACT_CONFIG_NAV_BOTH_MASK_STYLE
		: navOverflow.canScrollLeft
			? AGENT_COMPACT_CONFIG_NAV_START_MASK_STYLE
			: navOverflow.canScrollRight
				? AGENT_COMPACT_CONFIG_NAV_END_MASK_STYLE
				: {};
	const subagentTagColor = getTagColorForAgentAvatar(avatarSrc);

	if (items.length === 0) {
		return null;
	}

	return (
		// `-ml-4` cancels the Menubar's `pl-2` (8px) + the first chip's `px-2` (8px)
		// so the leading chip's content left-aligns with the summary row labels above.
		// The `pl-2` (not `pl-1`) keeps the first item's rounded/hover/expanded
		// background and 3px focus ring clear of the `overflow-x-auto` clip edge,
		// which would otherwise shear the leading button's left side flat. (The
		// sibling header nav fixes the same clip with `overflow-clip-margin`, but
		// that only applies to `overflow: clip`, not the `auto` this scrolling strip
		// needs.)
		<div className="relative -ml-4 flex min-h-8 min-w-0 items-center">
			<Menubar
				// Override the shared Menubar's bordered/elevated chrome so the strip
				// reads as one flat, connected surface (matching the prior loose-button
				// look) while still giving us roving focus + arrow-key nav across items.
				// When the container is too tight, the row scrolls horizontally and the
				// shared scroll-mask fades whichever edge has more content.
				className="relative -my-1 flex h-auto min-w-0 flex-1 items-center overflow-x-auto overflow-y-visible overscroll-x-contain rounded-none border-0 bg-transparent p-0 py-1 pl-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
				ref={navOverflow.ref}
				style={{
					gap: AGENT_COMPACT_CONFIG_NAV_GAP,
					...scrollMaskStyle,
				}}
			>
				{items.map((item) => {
					if (item.agentFieldName === "reasoning") {
						return (
							<AgentReasoningSelector
								key={item.agentFieldName}
								render="nav-button"
								triggerClassName={AGENT_COMPACT_CONFIG_NAV_TRIGGER_CLASS}
								value={reasoningValue}
								onValueChange={onReasoningValueChange}
								screenAssistantTargetId={screenAssistantTargetPrefix ? `${screenAssistantTargetPrefix}:reasoning` : undefined}
							/>
						);
					}
					if (item.agentFieldName === "memory") {
						return (
							<AgentMemorySelector
								key={item.agentFieldName}
								render="nav-button"
								triggerClassName={AGENT_COMPACT_CONFIG_NAV_TRIGGER_CLASS}
								value={memoryMode}
								onValueChange={onMemoryModeChange}
								onManage={() => onOpenDirectory?.("memory")}
								screenAssistantTargetId={screenAssistantTargetPrefix ? `${screenAssistantTargetPrefix}:memory` : undefined}
							/>
						);
					}
					if (item.agentFieldName === "subagents") {
						return (
							<AgentCompactSubagentsNavButton
								item={item}
								key={item.agentFieldName}
								onCreateSubagent={() => onAppendListItem?.("subagents")}
								onManageSubagents={onManageSubagents}
								disabledItems={config?.disabledItems?.subagents}
								onRemoveSubagent={onRemoveListItem ? (index) => onRemoveListItem("subagents", index) : undefined}
								onSelectSubagent={(index) => onSelectListItem?.("subagents", index)}
								onToggleItem={onToggleListItem ? (index, enabled) => onToggleListItem("subagents", index, enabled) : undefined}
								screenAssistantTargetId={screenAssistantTargetPrefix ? `${screenAssistantTargetPrefix}:subagents` : undefined}
								selectedIndex={selectedListItemIndexByField?.subagents}
								subagents={getNonEmptyConfigItems(config?.subagents)}
								tagColor={subagentTagColor}
							/>
						);
					}
					if (item.agentFieldName === "trigger") {
						const automationRules = config ? getAgentAutomationRules(config) : [];
						return (
							<AgentCompactTriggersNavButton
								automationRules={automationRules}
								item={item}
								key={item.agentFieldName}
								onAutomationRulesChange={onAutomationRulesChange}
								onEditTriggers={onEditTriggers}
								onManageTriggers={onManageTriggers}
								onSelectEvent={(providerId, eventId) => {
									const next = createAutomationRuleFromEvent(providerId, eventId, automationRules);
									onEditTriggers?.(next ?? undefined);
								}}
								screenAssistantTargetId={screenAssistantTargetPrefix ? `${screenAssistantTargetPrefix}:trigger` : undefined}
								tagColor={subagentTagColor}
								triggers={serializeAgentAutomationRuleLabels(automationRules)}
							/>
						);
					}
					if (item.agentFieldName === "apps") {
						return (
							<AgentCompactAppsNavButton
								apps={getNonEmptyConfigItems(config?.apps)}
								disabledItems={config?.disabledItems?.apps}
								item={item}
								key={item.agentFieldName}
								onAddSearchItem={(searchItem) => {
									if (searchItem.disabled) {
										return;
									}
									onAddListValues?.("apps", [searchItem.label]);
								}}
								onBrowse={() => openAgentDirectoryOrAppendListItem("apps", "apps", onOpenDirectory, onAppendListItem)}
								onRemoveItem={onRemoveListItem ? (index) => onRemoveListItem("apps", index) : undefined}
								onSelectItem={onOpenDirectory ? (value) => onOpenDirectory("apps", value) : undefined}
								onToggleItem={onToggleListItem ? (index, enabled) => onToggleListItem("apps", index, enabled) : undefined}
								screenAssistantTargetId={screenAssistantTargetPrefix ? `${screenAssistantTargetPrefix}:apps` : undefined}
							/>
						);
					}
					if (item.agentFieldName === "skills") {
						const directory = "skills" as const;
						return (
							<AgentCompactDirectoryNavButton
								browseLabel={`Browse ${item.label.toLowerCase()}`}
								directory={directory}
								item={item}
								items={getNonEmptyConfigItems(config?.skills)}
								key={item.agentFieldName}
								onAddSearchItem={(searchItem) => {
									if (searchItem.disabled) {
										return;
									}
									onAddListValues?.(directory, [searchItem.label]);
								}}
								disabledItems={config?.disabledItems?.[directory]}
								onPickTool={undefined}
								onBrowse={() => openAgentDirectoryOrAppendListItem(directory, directory, onOpenDirectory, onAppendListItem)}
								onRemoveItem={onRemoveListItem ? (index) => onRemoveListItem(directory, index) : undefined}
								onToggleItem={onToggleListItem ? (index, enabled) => onToggleListItem(directory, index, enabled) : undefined}
								onSelectItem={onOpenDirectory ? (value) => onOpenDirectory(directory, value) : undefined}
								screenAssistantTargetId={screenAssistantTargetPrefix ? `${screenAssistantTargetPrefix}:${item.agentFieldName}` : undefined}
							/>
						);
					}
					if (item.agentFieldName === "conversationStarters") {
						return (
							<AgentCompactConversationStartersNavButton
								item={item}
								key={item.agentFieldName}
								onManage={() => openAgentDirectoryOrAppendListItem("conversationStarters", "conversationStarters", onOpenDirectory, onAppendListItem)}
								onStarterChange={onListItemChange ? (index, value) => onListItemChange("conversationStarters", index, value) : undefined}
								screenAssistantTargetId={screenAssistantTargetPrefix ? `${screenAssistantTargetPrefix}:conversation-starters` : undefined}
								starters={config ? getConversationStarterSummaryItems(config) : []}
							/>
						);
					}
					// Every nav field is handled above; this guards future additions to
					// AGENT_COMPACT_EMPTY_CONFIG_NAV_ITEMS by falling back to a plain
					// click button rather than silently rendering nothing.
					const fallbackItem = item as AgentCompactConfigNavItem;
					return (
						<AgentCompactConfigNavButton
							item={fallbackItem}
							key={fallbackItem.agentFieldName}
							onClick={getAgentCompactConfigNavItemOnClick(fallbackItem, onAppendListItem, onOpenDirectory, onEditTriggers)}
							screenAssistantTargetId={screenAssistantTargetPrefix ? `${screenAssistantTargetPrefix}:${fallbackItem.agentFieldName}` : undefined}
						/>
					);
				})}
			</Menubar>
		</div>
	);
}
