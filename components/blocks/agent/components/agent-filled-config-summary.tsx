"use client";

import type { ReactNode } from "react";
import { Fragment } from "react";

import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import AutomationIcon from "@atlaskit/icon/core/automation";

import { DEFAULT_STARTER_ICON, getStarterIcon } from "@/components/blocks/conversation-starter";
import { TriggerPicker, type AgentAutomationRule, type AgentTriggerValue } from "@/components/blocks/trigger/page";
import { createAgentTriggerValue } from "@/components/blocks/trigger/data/trigger-catalog";
import { AgentCompactAppsNavButton, AgentCompactDirectoryNavButton, type AgentCompactConfigNavItem, AgentCompactSubagentsNavButton, AgentCompactTriggersNavButton, type AgentInlineSearchField, MAX_AGENT_CONVERSATION_STARTERS, getAgentCompactEmptyConfigNavItems, getAgentFilledSummaryAddLabel, getConversationStarterSummaryItems, openAgentDirectoryOrAppendListItem } from "@/components/blocks/agent/components/agent-compact-config-nav";
import { getAgentCollectionIconClassName, getSkillForConfigLabel, getSkillTagPropsForLabel, getTagColorForAgentAvatar } from "@/components/blocks/agent/components/agent-config-visuals";
import { AgentMemoryRow, AgentReasoningRow, type KnowledgeModeValue, type MemoryModeValue, type ReasoningModeValue } from "@/components/blocks/agent/components/agent-reasoning-memory-selectors";
import { AgentAddValueButton, AgentFilledSummaryRow, AgentReferenceChip, AgentSectionLabel } from "@/components/blocks/agent/components/agent-summary-row";
import { createAutomationRuleFromEvent, getAgentAutomationRules, getNonEmptyConfigItems, getSkillConfigItems, isAgentListItemDisabled, serializeAgentAutomationRuleLabels, type AgentConfigFormValue, type AgentConfigListFieldName, type AgentConfigReferenceListFieldName, type AgentConfigTextFieldName, type AgentDirectoryKind, type AgentHideableConfigField } from "@/components/blocks/agent/lib/agent-config-model";
import { HoverCard, HoverCardTrigger } from "@/components/ui/hover-card";
import { Icon } from "@/components/ui/icon";
import { IconTile } from "@/components/ui/icon-tile";
import type { TagColor } from "@/components/ui/tag";
import { SkillTag } from "@/components/ui-custom/skill-tag";
import { getRichTextReferencePreview, RichTextReferencePreviewContent } from "@/components/ui-custom/rich-text-editor/reference-preview";
import { cn } from "@/lib/utils";

export { hasFilledAgentConfig } from "./agent-filled-config-summary-data";

interface AgentTriggerSummaryRowProps {
	items: readonly string[];
	addLabel?: string;
	hideWhenEmpty?: boolean;
	screenAssistantTargetId?: string;
	onEditTriggers?: (seed?: AgentAutomationRule) => void;
	/**
	 * The structured automation rules backing `items`. Required for inline
	 * removal and for opening each rule in the editor because `items` is only
	 * the label projection.
	 */
	automationRules?: readonly AgentAutomationRule[];
	onAutomationRulesChange?: (automationRules: readonly AgentAutomationRule[]) => void;
	/**
	 * The collapsed-nav catalog entry for Triggers. When present, the filled-row
	 * "Edit" control opens the SAME flyout as the collapsed strip (list of
	 * triggers + "Add trigger ›" + "Manage triggers") via
	 * `AgentCompactTriggersNavButton`, keeping the two layouts consistent. Mirrors
	 * how `appsNavItem` / `skillsNavItem` / `subagentsNavItem` back the other
	 * summary rows' inline controls.
	 */
	triggerNavItem?: AgentCompactConfigNavItem;
	onManageTriggers?: () => void;
	/**
	 * Collection-derived Tag color (from the base agent's avatar family, via
	 * `getTagColorForAgentAvatar`). Drives the automation chips' Tag color and the
	 * leading automation icon so a lime (dev-agents) agent shows lime automation
	 * chips — mirroring the subagent chip treatment.
	 */
	tagColor?: TagColor;
}

/**
 * Automations row. Unlike the generic `AgentFilledSummaryRow`, the automation entry
 * launches the automation modal instead of inline editing:
 * - empty → the add affordance opens the modal with no triggers;
 * - non-empty → each chip opens the full automation modal and (when removal is wired)
 *   carries an overlay remove control, matching the other summary rows so a
 *   trigger can be removed inline without opening the modal. The trailing "Edit"
 *   control opens the same collapsed-nav management flyout as the compact strip
 *   (via `AgentCompactTriggersNavButton`) when `triggerNavItem` is supplied.
 */
function AgentTriggerSummaryRow({
	items,
	addLabel,
	hideWhenEmpty = false,
	screenAssistantTargetId,
	onEditTriggers,
	automationRules,
	onAutomationRulesChange,
	triggerNavItem,
	onManageTriggers,
	tagColor,
}: Readonly<AgentTriggerSummaryRowProps>) {
	const isEmpty = items.length === 0;

	const rulesAlignItems =
		automationRules !== undefined && automationRules.length === items.length;
	const canRemoveInline = rulesAlignItems && Boolean(onAutomationRulesChange);
	const handleRemoveAutomation = (index: number) => {
		if (!automationRules) {
			return;
		}
		onAutomationRulesChange?.(automationRules.filter((_, i) => i !== index));
	};

	// Picking a provider event starts a brand-new automation rule seeded only
	// with that event, so previous automations never appear in the new draft.
	const handleSelectEvent = (
		providerId: Parameters<typeof createAgentTriggerValue>[0],
		eventId: string,
	) => {
		const next = createAutomationRuleFromEvent(providerId, eventId, automationRules);
		onEditTriggers?.(next ?? undefined);
	};

	if (isEmpty && (hideWhenEmpty || !addLabel)) {
		return null;
	}

	return (
		<div
			className="group/agent-row -mx-2 flex flex-col gap-y-1 rounded-md px-2 py-1 transition-colors hover:bg-bg-neutral-subtle-hovered sm:flex-row sm:items-center sm:gap-x-6"
			data-agent-field="trigger"
			data-screen-assistant-target={screenAssistantTargetId}
		>
			<div className="sm:w-20 sm:shrink-0">
				<AgentSectionLabel>Flows</AgentSectionLabel>
			</div>
			<div className="flex min-h-5 min-w-0 flex-1 flex-wrap items-center gap-1.5">
				{isEmpty ? (
					<AgentAddValueButton
						icon="add"
						label={addLabel ?? "Add"}
						onClick={() => onEditTriggers?.()}
					/>
				) : (
					<div className="group/trigger-edit flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
						{items.map((item, index) => {
							const rule = rulesAlignItems ? automationRules?.[index] : undefined;
							// Every automation chip leads with the same automation glyph,
							// tinted by the agent's collection color — NOT the first
							// trigger's provider mark. An automation can now own multiple
							// triggers, so a single provider icon would misrepresent it.
							// The chip frame itself stays neutral gray (matching the Apps
							// row); only the leading glyph carries the collection color, so
							// we color the icon explicitly via `tagColorToMenuIconClassName`
							// (the `[&_svg]:…!` override beats the neutral leading-slot
							// color) instead of `text-inherit`, which would now resolve to
							// gray. Falls back to inheriting the neutral chip color when the
							// agent has no collection family. The `IconTile`
							// xxsmall/transparent wrap centers the glyph like the latest Tag
							// standard's other leading icons.
							const automationIcon = (
								<IconTile
									aria-hidden
									className={getAgentCollectionIconClassName(tagColor)}
									icon={<Icon aria-hidden render={<AutomationIcon label="" size="small" />} />}
									label=""
									size="xxsmall"
									variant="transparent"
								/>
							);
							// Clicking any configured automation chip opens that rule's editor;
							// event triggers remain nested inside the automation.
							return (
								<AgentReferenceChip
									key={`trigger-${item}-${index}`}
									elemBefore={automationIcon}
									label={item}
									onClick={
										onEditTriggers
											? () => onEditTriggers(rule)
											: undefined
									}
									onRemove={canRemoveInline ? () => handleRemoveAutomation(index) : undefined}
									tagColor="gray"
								/>
							);
						})}
						{onEditTriggers ? (
							// The trailing "Edit" control opens the SAME management flyout
							// as the collapsed nav strip (automation list + "Add automation ›"
							// + "Manage automations") by reusing `AgentCompactTriggersNavButton`
							// with the edit-styled button as its trigger — mirroring how the
							// Apps/Skills/Subagents rows back their inline controls with the
							// collapsed-nav dropdown so both layouts share one experience.
							triggerNavItem ? (
								<AgentCompactTriggersNavButton
									automationRules={automationRules}
									item={triggerNavItem}
									onEditTriggers={onEditTriggers}
									onManageTriggers={onManageTriggers}
									onSelectEvent={handleSelectEvent}
									renderTrigger={
										<AgentAddValueButton
											className="opacity-0 group-hover/agent-row:opacity-100"
											icon="edit"
											label={addLabel ?? "Edit"}
										/>
									}
									tagColor={tagColor}
									triggers={items}
								/>
							) : (
								<TriggerPicker
									label={addLabel ?? "Edit"}
									onSelectEvent={handleSelectEvent}
									trigger={
										<AgentAddValueButton
											className="opacity-0 group-hover/agent-row:opacity-100"
											icon="edit"
											label={addLabel ?? "Edit"}
										/>
									}
								/>
							)
						) : null}
					</div>
				)}
			</div>
		</div>
	);
}

export interface AgentFilledConfigSummaryProps {
	config: AgentConfigFormValue;
	// Drives the subagent chips' Tag color so they match the base agent's custom
	// brand color (derived from the avatar family). When omitted the chips fall
	// back to their category default.
	avatarSrc?: string;
	hiddenConfigFields?: ReadonlySet<AgentHideableConfigField>;
	hideEmptyRows?: boolean;
	// Drops the always-on Memory and Reasoning rows so they can be surfaced as
	// chips instead (used by the hybrid panel where modes live in the chip strip).
	hideModeRows?: boolean;
	knowledgeMode?: KnowledgeModeValue;
	memoryMode: MemoryModeValue;
	onAddListValues?: (field: AgentConfigReferenceListFieldName, values: readonly string[]) => void;
	onAppendListItem?: (field: AgentConfigListFieldName) => void;
	onConnectTrigger?: (trigger: AgentTriggerValue) => void;
	onEditTriggers?: (seed?: AgentAutomationRule) => void;
	onKnowledgeModeChange?: (next: KnowledgeModeValue) => void;
	onListItemChange?: (field: AgentConfigListFieldName, index: number, value: string) => void;
	onManageSubagents?: () => void;
	onManageTriggers?: () => void;
	onMemoryModeChange: (next: MemoryModeValue) => void;
	onOpenDirectory?: (directory: AgentDirectoryKind, selectedItem?: string) => void;
	onReasoningModeChange: (next: ReasoningModeValue) => void;
	onRemoveListItem?: (field: AgentConfigListFieldName, index: number) => void;
	onSelectListItem?: (field: AgentConfigListFieldName, index: number) => void;
	onTextChange?: (field: AgentConfigTextFieldName, value: string) => void;
	onToggleListItem?: (field: AgentConfigListFieldName, index: number, enabled: boolean) => void;
	onAutomationRulesChange?: (automationRules: readonly AgentAutomationRule[]) => void;
	reasoningMode: ReasoningModeValue;
	screenAssistantTargetPrefix?: string;
	selectedListItemIndexByField?: Partial<Record<AgentConfigListFieldName, number>>;
	showAddButtons?: boolean;
}

export function AgentFilledConfigSummary({
	config,
	avatarSrc,
	hiddenConfigFields,
	hideEmptyRows = false,
	hideModeRows = false,
	memoryMode,
	onAppendListItem,
	onAddListValues,
	onEditTriggers,
	onManageSubagents,
	onManageTriggers,
	onMemoryModeChange,
	onOpenDirectory,
	onReasoningModeChange,
	onRemoveListItem,
	onSelectListItem,
	onToggleListItem,
	onAutomationRulesChange,
	reasoningMode,
	screenAssistantTargetPrefix,
	selectedListItemIndexByField,
	showAddButtons = true,
}: Readonly<AgentFilledConfigSummaryProps>) {
	const automationRules = getAgentAutomationRules(config);
	const triggerItems = serializeAgentAutomationRuleLabels(automationRules);
	const skillItems = getSkillConfigItems(config.skills);
	const appItems = getNonEmptyConfigItems(config.apps);
	const subagentItems = getNonEmptyConfigItems(config.subagents);
	// Subagent chips inherit the base agent's custom brand color (from its avatar
	// family) so a lime agent shows lime subagent chips, etc.
	const subagentTagColor = getTagColorForAgentAvatar(avatarSrc);
	const starterSummaryItems = getConversationStarterSummaryItems(config).slice(0, MAX_AGENT_CONVERSATION_STARTERS);
	const starterItems = starterSummaryItems.map((item) => item.label);

	// Each summary row's inline "Add" opens the SAME dropdown as the collapsed
	// nav (list + "Add ›" search flyout + "Browse"), so the two layouts share one
	// experience. We reuse the collapsed nav components directly, passing the
	// inline "Add" button as their trigger. Look the catalog items up by field so
	// the dropdowns inherit the same label/icon the collapsed strip uses.
	const navItems = getAgentCompactEmptyConfigNavItems(config);
	const appsNavItem = navItems.find((entry) => entry.agentFieldName === "apps");
	const skillsNavItem = navItems.find((entry) => entry.agentFieldName === "skills");
	const subagentsNavItem = navItems.find((entry) => entry.agentFieldName === "subagents");
	const triggerNavItem = navItems.find((entry) => entry.agentFieldName === "trigger");
	const renderDirectoryAddControl = (
		field: Extract<AgentInlineSearchField, "skills" | "tools">,
		navItem: AgentCompactConfigNavItem | undefined,
		items: readonly string[],
	) =>
		navItem
			? ({ icon, label, className }: { icon?: "add" | "edit"; label: string; className?: string }) => (
					<AgentCompactDirectoryNavButton
						browseLabel={`Browse ${navItem.label.toLowerCase()}`}
						directory={field}
						item={navItem}
						items={items}
						onAddSearchItem={(searchItem) => {
							if (searchItem.disabled) {
								return;
							}
							onAddListValues?.(field, [searchItem.label]);
						}}
						disabledItems={config.disabledItems?.[field]}
						onPickTool={field === "tools" && onOpenDirectory ? (toolId) => onOpenDirectory("tools", toolId) : undefined}
						onBrowse={() => openAgentDirectoryOrAppendListItem(field, field, onOpenDirectory, onAppendListItem)}
						onRemoveItem={onRemoveListItem ? (index) => onRemoveListItem(field, index) : undefined}
						onToggleItem={onToggleListItem ? (index, enabled) => onToggleListItem(field, index, enabled) : undefined}
						onSelectItem={onOpenDirectory ? (value) => onOpenDirectory(field, value) : undefined}
						renderTrigger={<AgentAddValueButton className={className} icon={icon} label={label} />}
					/>
				)
			: undefined;
	// Rows declare their canonical order, whether they currently hold any user
	// content, and whether they are pinned to the absolute bottom. Memory and
	// Reasoning are `alwaysLast` so they sink below every other row (filled or
	// empty), keeping the two always-on system rows grouped at the very bottom.
	// Among the remaining rows, empty ones sort below filled ones (preserving the
	// canonical order within each group) so configured fields stay grouped at the
	// top. Source order IS the canonical display order: Triggers › Knowledge ›
	// Tools › Skills › Subagents › Conversation starters › Memory › Reasoning.
	// `orderedRows` below applies this in the sort, so the array order is the
	// single source of truth. Reorder here, not in the sort.
	const rows: ReadonlyArray<{ key: string; isEmpty: boolean; alwaysLast?: boolean; node: ReactNode }> = [
		{
			key: "trigger",
			isEmpty: triggerItems.length === 0,
			node: (
				<AgentTriggerSummaryRow
					addLabel={getAgentFilledSummaryAddLabel("triggers", triggerItems.length === 0, showAddButtons)}
					hideWhenEmpty={hideEmptyRows}
					items={triggerItems}
					onEditTriggers={onEditTriggers}
					onManageTriggers={onManageTriggers}
					onAutomationRulesChange={onAutomationRulesChange}
					screenAssistantTargetId={screenAssistantTargetPrefix ? `${screenAssistantTargetPrefix}:trigger` : undefined}
					automationRules={automationRules}
					triggerNavItem={triggerNavItem}
					tagColor={subagentTagColor}
				/>
			),
		},
		{
			key: "apps",
			isEmpty: appItems.length === 0,
			node: (
				<AgentFilledSummaryRow
					addLabel={getAgentFilledSummaryAddLabel("apps", appItems.length === 0, showAddButtons)}
					hideWhenEmpty={hideEmptyRows}
					agentFieldName="apps"
					isItemDisabled={(item) => isAgentListItemDisabled(config, "apps", item)}
					items={appItems}
					label="Apps"
					// The inline "Add apps" opens the SAME dropdown (list + "Add apps ›"
					// search flyout + "Browse apps") as the collapsed nav, matching how
					// Skills/Tools back their inline "Add" with the shared dropdown.
					renderAddControl={appsNavItem ? ({ icon, label, className }) => (
						<AgentCompactAppsNavButton
							apps={appItems}
							disabledItems={config.disabledItems?.apps}
							item={appsNavItem}
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
							renderTrigger={<AgentAddValueButton className={className} icon={icon} label={label} />}
						/>
					) : undefined}
					// Clicking an app chip opens the apps directory focused on that app.
					onItemClick={onOpenDirectory ? (item) => onOpenDirectory("apps", item) : undefined}
					onRemoveItem={onRemoveListItem ? (index) => onRemoveListItem("apps", index) : undefined}
					referenceCategory="app"
					// App chips are brand-logo tags; without an explicit color they fall back
					// to AgentReferenceChip's "blue" default (a blue chip border). Pin them to
					// neutral gray so the logo carries the brand and the chip frame stays neutral.
					tagColor="gray"
					screenAssistantTargetId={screenAssistantTargetPrefix ? `${screenAssistantTargetPrefix}:apps` : undefined}
				/>
			),
		},
		{
			key: "skills",
			isEmpty: skillItems.length === 0,
			node: (
				<AgentFilledSummaryRow
					addLabel={getAgentFilledSummaryAddLabel("skills", skillItems.length === 0, showAddButtons)}
					hideWhenEmpty={hideEmptyRows}
					isItemDisabled={(item) => isAgentListItemDisabled(config, "skills", item)}
					items={skillItems}
					label="Skills"
					renderAddControl={renderDirectoryAddControl("skills", skillsNavItem, skillItems)}
					// The Skills row renders its configured items as SkillTag chips
					// (slanted, collection-colored slash + icon) instead of the generic
					// reference chip used by every other row.
					renderItem={({ item, disabled, onClick, onRemove }) => {
						const { color, icon } = getSkillTagPropsForLabel(item);
						const skill = getSkillForConfigLabel(item);
						const preview = getRichTextReferencePreview("skill", skill?.name ?? item);
						const skillTag = (
							<SkillTag
								aria-disabled={disabled || undefined}
								className={cn(disabled && "opacity-(--opacity-disabled)")}
								color={color}
								icon={icon}
								onClick={disabled ? undefined : onClick}
								onRemove={onRemove}
								removeButtonLabel={`Remove ${item}`}
								removeVariant="overlay"
							>
								{item}
							</SkillTag>
						);
						// Hovering a skill chip shows its entity card (icon, name,
						// publisher, stats) — mirroring the app/knowledge reference
						// chips — when the label resolves to a directory skill.
						return preview ? (
							<HoverCard>
								<HoverCardTrigger closeDelay={80} delay={120} render={<span className="inline-flex max-w-full" />}>
									{skillTag}
								</HoverCardTrigger>
								<RichTextReferencePreviewContent preview={preview} />
							</HoverCard>
						) : skillTag;
					}}
					// Clicking a skill chip opens the skills directory on that skill's
					// detail/config view (its SKILL.md editor), mirroring the Apps row.
					onItemClick={onOpenDirectory ? (item) => onOpenDirectory("skills", item) : undefined}
					onRemoveItem={onRemoveListItem ? (index) => onRemoveListItem("skills", index) : undefined}
					referenceCategory="skill"
					screenAssistantTargetId={screenAssistantTargetPrefix ? `${screenAssistantTargetPrefix}:skills` : undefined}
				/>
			),
		},
		{
			key: "subagents",
			isEmpty: subagentItems.length === 0,
			node: (
				<AgentFilledSummaryRow
					addLabel={getAgentFilledSummaryAddLabel("subagents", subagentItems.length === 0, showAddButtons)}
					hideWhenEmpty={hideEmptyRows}
					isItemDisabled={(item) => isAgentListItemDisabled(config, "subagents", item)}
					items={subagentItems}
					// Mirror the Apps/Flows treatment: the chip frame stays neutral gray
					// (see `tagColor="gray"` below) while only the leading agent glyph
					// carries the collection color, resolved through the shared
					// `getAgentCollectionIconClassName` (the `[&_svg]:…!` override beats the
					// neutral leading-slot color). The glyph always follows the agent
					// collection color, falling back to the neutral gray collection when the
					// agent has no family.
					itemElemBefore={() => (
						<IconTile
							aria-hidden
							className={getAgentCollectionIconClassName(subagentTagColor)}
							icon={<Icon aria-hidden render={<AiAgentIcon label="" size="small" />} />}
							label=""
							size="xxsmall"
							variant="transparent"
						/>
					)}
					label="Subagents"
					renderAddControl={subagentsNavItem ? ({ label, className }) => (
						<AgentCompactSubagentsNavButton
							item={subagentsNavItem}
							onCreateSubagent={() => onAppendListItem?.("subagents")}
							onManageSubagents={onManageSubagents}
							disabledItems={config.disabledItems?.subagents}
							onRemoveSubagent={onRemoveListItem ? (index) => onRemoveListItem("subagents", index) : undefined}
							onSelectSubagent={onSelectListItem ? (index) => onSelectListItem("subagents", index) : undefined}
							onToggleItem={onToggleListItem ? (index, enabled) => onToggleListItem("subagents", index, enabled) : undefined}
							selectedIndex={selectedListItemIndexByField?.subagents}
							subagents={subagentItems}
							tagColor={subagentTagColor}
							renderTrigger={<AgentAddValueButton className={className} icon="add" label={label} />}
						/>
					) : undefined}
					// Clicking a subagent chip opens that subagent (same select path as
					// the collapsed-nav menu's onSelectSubagent), rather than a directory.
					onItemClick={onSelectListItem ? (_item, index) => onSelectListItem("subagents", index) : undefined}
					onRemoveItem={onRemoveListItem ? (index) => onRemoveListItem("subagents", index) : undefined}
					referenceCategory="subagent"
					screenAssistantTargetId={screenAssistantTargetPrefix ? `${screenAssistantTargetPrefix}:subagents` : undefined}
					tagColor="gray"
				/>
			),
		},
		{
			key: "conversationStarters",
			isEmpty: starterItems.length === 0,
			node: (
				<AgentFilledSummaryRow
					addLabel={getAgentFilledSummaryAddLabel("conversationStarters", starterItems.length === 0, showAddButtons)}
					addIcon={starterItems.length > 0 ? "edit" : undefined}
					hideWhenEmpty={hideEmptyRows}
					agentFieldName="conversationStarters"
					itemElemBefore={(_, index) => {
						const StarterIcon = getStarterIcon(starterSummaryItems[index]?.icon ?? DEFAULT_STARTER_ICON);
						// Match the latest Tag standard: normalize the leading glyph to a
						// centered 16px slot via the `IconTile` xxsmall/transparent
						// treatment instead of dropping a raw left-aligned icon in.
						return (
							<IconTile
								aria-hidden
								icon={<Icon aria-hidden render={<StarterIcon label="" size="small" color="currentColor" />} className="text-icon-subtle" />}
								label=""
								size="xxsmall"
								variant="transparent"
							/>
						);
					}}
					items={starterItems}
					label="Conversation starters"
					onAdd={() => openAgentDirectoryOrAppendListItem("conversationStarters", "conversationStarters", onOpenDirectory, onAppendListItem)}
					onRemoveItem={onRemoveListItem ? (index) => onRemoveListItem("conversationStarters", index) : undefined}
					screenAssistantTargetId={screenAssistantTargetPrefix ? `${screenAssistantTargetPrefix}:conversation-starters` : undefined}
					tagColor="standard"
				/>
			),
		},
		{
			key: "memory",
			// Memory is a default, always-on knowledge source, so this row is never
			// empty. It is `alwaysLast` so it pins to the bottom (above Reasoning)
			// regardless of how many other rows are empty.
			isEmpty: false,
			alwaysLast: true,
			node: (
				<AgentMemoryRow
					onManage={() => onOpenDirectory?.("memory")}
					onValueChange={onMemoryModeChange}
					screenAssistantTargetId={screenAssistantTargetPrefix ? `${screenAssistantTargetPrefix}:memory` : undefined}
					sectionLabel={<AgentSectionLabel>Memory</AgentSectionLabel>}
					value={memoryMode}
				/>
			),
		},
		{
			key: "reasoning",
			// Reasoning is always a single selected mode, so this row is never empty.
			// It is `alwaysLast` and declared last, so it sits at the very bottom of
			// the list regardless of how many other rows are empty.
			isEmpty: false,
			alwaysLast: true,
			node: (
				<AgentReasoningRow
					onValueChange={onReasoningModeChange}
					screenAssistantTargetId={screenAssistantTargetPrefix ? `${screenAssistantTargetPrefix}:reasoning` : undefined}
					sectionLabel={<AgentSectionLabel>Reasoning</AgentSectionLabel>}
					value={reasoningMode}
				/>
			),
		},
	];
	// Map then sort by index to keep the sort stable across runtimes (Array#sort
	// only became stable in V8 in 2018, but other engines may differ). Row keys
	// (`trigger`, `subagents`, `conversationStarters`) double as hideable-field
	// keys, so suppressed rows are dropped before ordering.
	const orderedRows = rows
		.filter((row) => !hiddenConfigFields?.has(row.key as AgentHideableConfigField))
		// In the hybrid panel, Memory and Reasoning live in the chip strip, not as rows.
		.filter((row) => !hideModeRows || (row.key !== "memory" && row.key !== "reasoning"))
		.map((row, index) => ({ ...row, index }))
		.sort((a, b) => {
			// `alwaysLast` rows (Memory, Reasoning) sink below every other row,
			// filled or empty, so they stay pinned to the very bottom of the list.
			if (a.alwaysLast !== b.alwaysLast) return a.alwaysLast ? 1 : -1;
			if (a.isEmpty !== b.isEmpty) return a.isEmpty ? 1 : -1;
			return a.index - b.index;
		});

	return (
		<div className="flex flex-col gap-1">
			{orderedRows.map((row) => (
				<Fragment key={row.key}>{row.node}</Fragment>
			))}
		</div>
	);
}
