"use client";

// oxlint-disable react-doctor/exhaustive-deps -- Effects in this file intentionally coordinate refs, external animation loops, timers, subscriptions, or measured DOM state; dependencies are constrained to avoid restarting those bridges.
// oxlint-disable react-doctor/no-derived-state -- These components maintain local derived display state for controlled animations, measurements, or draft editing that cannot be represented as render-only values without changing UX.
// oxlint-disable react-doctor/no-reset-all-state-on-prop-change -- These prop/key changes intentionally restart a workflow to avoid carrying stale state across runs.
// oxlint-disable react-doctor/prefer-module-scope-pure-function -- These helpers are intentionally local to the component/demo because they depend on the surrounding interaction contract.

// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- These components intentionally use slot/render-node props for icons, triggers, and adornments.

import { AnimatePresence, motion } from "motion/react";
import type { ComponentProps, ReactNode } from "react";
import { memo, useCallback, useState } from "react";

import { AgentCompactOperationsBento } from "@/components/blocks/agent-bento";
import type { AgentAutomationRule, AgentTriggerValue } from "@/components/blocks/triggers/data/trigger-catalog";
import { ManageTriggersDialog } from "@/components/blocks/triggers/components/manage-triggers-dialog";
import { AgentTriggersDialog } from "@/components/ui-custom/agent-triggers-dialog";
import type { EditorToolbarViewMode } from "@/components/blocks/editor-toolbar";
import {
	type RichTextMentionRemovalRequest,
} from "@/components/ui-custom/rich-text-editor";
import { cn } from "@/lib/utils";

import { AgentCompactConfigPanel } from "@/components/blocks/agent/components/agent-compact-config-panel";
import { AgentConfigProfile } from "@/components/blocks/agent/components/agent-config-profile";
import { hasFilledAgentConfig } from "@/components/blocks/agent/components/agent-filled-config-summary";
import { AgentInstructionsComposer } from "@/components/blocks/agent/components/agent-instructions-composer";
import { AGENT_AVATAR_SRC } from "@/components/blocks/agent/components/agent-profile-cover";
import {
	type AgentConfigFormValue,
	type AgentConfigListFieldName,
	type AgentConfigReferenceListFieldName,
	type AgentConfigTextFieldName,
	type AgentDirectoryKind,
	type AgentHideableConfigField,
	getAgentConfigListLookupValue,
	getSkillConfigLabel,
} from "@/components/blocks/agent/lib/agent-config-model";
import {
	AGENT_REFERENCE_CATEGORY_BY_CONFIG_FIELD,
} from "@/components/blocks/agent/lib/agent-reference-mapping";
import { useAgentAutomationDialogs } from "@/components/blocks/agent/hooks/use-agent-automation-dialogs";
import { motionEase } from "@/lib/motion";

export {
	AgentCompactHeaderNav,
} from "@/components/blocks/agent/components/agent-compact-header-nav";
export {
	AGENT_COMPACT_HEADER_DEFAULT_NAV_ITEMS,
	AGENT_COMPACT_HEADER_DETAILS_NAV_ITEM,
	type AgentCompactHeaderNavItem,
	type AgentCompactHeaderSection,
} from "@/components/blocks/agent/components/agent-compact-header-nav-data";

export {
	Agent,
	AgentCompactAccessPanel,
	AgentCompactEvaluationPanel,
	AgentCompactInsightsPanel,
	AgentCompactSurfacesPanel,
	AgentCompactUsersPanel,
	AgentContent,
	AgentHeader,
	AgentInstructions,
	AgentMoreOptionsMenu,
	AgentOutput,
	AgentTool,
	AgentTools,
} from "@/components/blocks/agent/components/agent-frame";

export type {
	AgentCompactAccessPanelProps,
	AgentCompactEvaluationPanelProps,
	AgentCompactInsightsPanelProps,
	AgentCompactSurfacesPanelProps,
	AgentCompactUsersPanelProps,
	AgentContentProps,
	AgentHeaderProps,
	AgentInstructionsProps,
	AgentMoreOptionsMenuProps,
	AgentOutputProps,
	AgentProps,
	AgentToolProps,
	AgentToolsProps,
} from "@/components/blocks/agent/components/agent-frame";

export type {
	AgentConfigFormValue,
	AgentConfigListFieldName,
	AgentConfigReferenceListFieldName,
	AgentConfigTextFieldName,
	AgentDirectoryKind,
	AgentHideableConfigField,
} from "@/components/blocks/agent/lib/agent-config-model";
// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally re-exports colocated non-component API used by consumers.
export { toggleAgentConfigDisabledItem } from "@/components/blocks/agent/lib/agent-config-model";

export { AGENT_KNOWLEDGE_UPLOAD_TARGET } from "@/components/blocks/agent/components/agent-instructions-composer";

function isAgentConfigReferenceListField(
	field: AgentConfigListFieldName,
): field is AgentConfigReferenceListFieldName {
	return field in AGENT_REFERENCE_CATEGORY_BY_CONFIG_FIELD;
}

export interface AgentConfigFieldsProps extends ComponentProps<"div"> {
	config: AgentConfigFormValue;
	avatarSrc?: string;
	compactScrollAreaClassName?: string;
	compactFooterBefore?: ReactNode;
	// Config rows callers can suppress — e.g. while editing a subagent, where
	// triggers, subagents, and conversation starters can't be configured.
	hiddenConfigFields?: ReadonlySet<AgentHideableConfigField>;
	idPrefix: string;
	onInstructionsViewModeChange?: (mode: EditorToolbarViewMode) => void;
	onManageSubagents?: () => void;
	onProfileTextChange?: (field: AgentConfigTextFieldName, value: string) => void;
	onProfileAvatarChange?: (avatarSrc: string) => void;
	onTextChange?: (field: AgentConfigTextFieldName, value: string) => void;
	onListItemChange?: (field: AgentConfigListFieldName, index: number, value: string) => void;
	onRemoveListItem?: (field: AgentConfigListFieldName, index: number) => void;
	onSelectListItem?: (field: AgentConfigListFieldName, index: number) => void;
	// Toggle a configured list item's enabled state. Owners that persist the
	// config (e.g. the studio draft in localStorage) should apply
	// `toggleAgentConfigDisabledItem` to their stored value so the disabled state
	// survives a refresh. Omitting this prop hides the enable/disable switches.
	onToggleListItem?: (field: AgentConfigListFieldName, index: number, enabled: boolean) => void;
	onAddListValues?: (field: AgentConfigReferenceListFieldName, values: readonly string[]) => void;
	onAppendListItem?: (field: AgentConfigListFieldName) => void;
	onConnectTrigger?: (trigger: AgentTriggerValue) => void;
	onManageTriggers?: () => void;
	/**
	 * Registers an imperative opener for this config's automation dialog so a
	 * sibling surface (e.g. the Ask Rovo sidebar's agent-edit-summary card) can
	 * jump straight to the trigger/flow dialog. Called with the opener on mount
	 * and `null` on unmount. The dialog state stays encapsulated here.
	 */
	registerAutomationDialogOpener?: (opener: (() => void) | null) => void;
	onOpenDirectory?: (directory: AgentDirectoryKind, selectedItem?: string) => void;
	// When provided, the empty-instructions "start with a template" link defers to
	// the host (e.g. the Studio shell opens its Agent Directory on the first
	// template tab) instead of opening the composer's built-in templates dialog.
	onStartWithTemplate?: () => void;
	onAutomationRulesChange?: (automationRules: readonly AgentAutomationRule[]) => void;
	profileAvatarSrc?: string;
	profileConfig?: AgentConfigFormValue;
	screenAssistantTargetPrefix?: string;
	selectedListItemIndexByField?: Partial<Record<AgentConfigListFieldName, number>>;
	// Subagent editing context, forwarded to the profile header so it can render
	// the base-agent → subagent breadcrumb, edit the subagent's name, and treat
	// the description slot as the subagent's trigger condition.
	isSubagent?: boolean;
	baseAgentName?: string;
	subagentName?: string;
	onSelectBaseAgent?: () => void;
	onSubagentNameChange?: (value: string) => void;
	subagentCondition?: string;
	onSubagentConditionChange?: (value: string) => void;
}

export const AgentConfigFields = memo(
	({
		className,
		config,
		// Mirror AgentHeader / AgentConfigProfile, which default to the same avatar.
		// Without this, consumers that omit avatarSrc (e.g. the component demo) render
		// the default profile avatar but leave the Flows/Subagents leading glyphs on
		// the gray collection fallback — so the chip icons would mismatch the avatar's
		// collection color. Defaulting here keeps the glyph hue in sync with the avatar.
		avatarSrc = AGENT_AVATAR_SRC,
		compactFooterBefore,
		compactScrollAreaClassName,
		hiddenConfigFields,
		idPrefix,
		onListItemChange,
		onAddListValues,
		onAppendListItem,
		onConnectTrigger,
		onInstructionsViewModeChange,
		onManageTriggers,
		registerAutomationDialogOpener,
		onManageSubagents,
		onOpenDirectory,
		onProfileAvatarChange,
		onProfileTextChange,
		onRemoveListItem,
		onSelectListItem,
		onStartWithTemplate,
		onTextChange,
		onToggleListItem,
		onAutomationRulesChange,
		profileAvatarSrc,
		profileConfig,
		screenAssistantTargetPrefix,
		selectedListItemIndexByField,
		isSubagent,
		baseAgentName,
		subagentName,
		onSelectBaseAgent,
		onSubagentNameChange,
		subagentCondition,
		onSubagentConditionChange,
		...props
	}: Readonly<AgentConfigFieldsProps>) => {
		const isFilledConfig = hasFilledAgentConfig(config);
		const [mentionRemovalRequest, setMentionRemovalRequest] = useState<RichTextMentionRemovalRequest | null>(null);
		// Onboarding bento dismissal ("Not now"). Local to the editor session so the
		// tiles can be hidden without persisting a flag onto the agent config.
		const [isOnboardingBentoDismissed, setIsOnboardingBentoDismissed] = useState(false);
		const handleTextChange = useCallback((field: AgentConfigTextFieldName, value: string) => {
			onTextChange?.(field, value);
		}, [onTextChange]);
		const handleProfileTextChange = useCallback((field: AgentConfigTextFieldName, value: string) => {
			(onProfileTextChange ?? onTextChange)?.(field, value);
		}, [onProfileTextChange, onTextChange]);
		const handleListItemChange = useCallback((field: AgentConfigListFieldName, index: number, value: string) => {
			onListItemChange?.(field, index, field === "skills" ? getSkillConfigLabel(value) : value);
		}, [onListItemChange]);
		const handleRemoveListItem = useCallback((field: AgentConfigListFieldName, index: number) => {
			const removedValue = config[field]?.[index]?.trim();

			onRemoveListItem?.(field, index);
			if (removedValue && isAgentConfigReferenceListField(field)) {
				setMentionRemovalRequest({
					category: AGENT_REFERENCE_CATEGORY_BY_CONFIG_FIELD[field],
					key: `${field}:${index}:${removedValue}:${Date.now()}`,
					label: removedValue,
				});
			}
		}, [config, onRemoveListItem]);
		const handleAddListValues = useCallback((field: AgentConfigReferenceListFieldName, values: readonly string[]) => {
			onAddListValues?.(field, field === "skills" ? values.map(getSkillConfigLabel).filter(Boolean) : values);
		}, [onAddListValues]);
		const handleRemoveReferenceValue = useCallback((field: AgentConfigReferenceListFieldName, value: string) => {
			const normalizedValue = getAgentConfigListLookupValue(field, value);
			const index = (config[field] ?? []).findIndex(
				(item) => getAgentConfigListLookupValue(field, item) === normalizedValue,
			);

			if (index < 0) {
				return;
			}

			onRemoveListItem?.(field, index);
		}, [config, onRemoveListItem]);
		const handleMentionRemovalRequestHandled = useCallback((key: string) => {
			setMentionRemovalRequest((current) => current?.key === key ? null : current);
		}, []);
		const handleAppendListItem = useCallback((field: AgentConfigListFieldName) => {
			onAppendListItem?.(field);
		}, [onAppendListItem]);
		const handleManageSubagents = useCallback(() => {
			onManageSubagents?.();
		}, [onManageSubagents]);
		const handleSelectListItem = useCallback((field: AgentConfigListFieldName, index: number) => {
			onSelectListItem?.(field, index);
		}, [onSelectListItem]);
		const handleOpenDirectory = useCallback((directory: AgentDirectoryKind, selectedItem?: string) => {
			onOpenDirectory?.(directory, selectedItem);
		}, [onOpenDirectory]);
		const {
			currentAutomationRules,
			triggersEditor,
			manageTriggersOpen,
			setManageTriggersOpen,
			handleAddAutomationFromManage,
			handleDeleteAutomation,
			handleEditAutomationFromManage,
			handleEditTriggers,
			handleManageTriggers,
			handleReorderAutomations,
			handleToggleAutomation,
			handleTriggersEditorOpenChange,
			handleTriggersSave,
		} = useAgentAutomationDialogs({
			config,
			onAutomationRulesChange,
			onManageTriggers,
			registerAutomationDialogOpener,
		});

		return (
			<div
				className={cn("flex min-h-0 flex-1 flex-col gap-6", className)}
				data-agent-config-id={idPrefix}
				data-screen-assistant-target={screenAssistantTargetPrefix}
				{...props}
			>
				<div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
					{/* Scrollable region: profile + instructions grow to fill, the
					    sibling footer below stays anchored to the panel bottom. */}
					<div
						// `overflow-y-auto` forces `overflow-x` to compute to `auto`,
						// which clips the left/right edges of descendant focus-visible
						// rings. `px-1.5` insets the content 6px so full-width controls
						// (the title/description inputs, whose focus backdrop bleeds
						// `-inset-0.5` past their box) clear the scroll-clip edge. We do
						// NOT cancel this with a negative margin on the profile block,
						// because that would pull those full-width inputs back to the
						// clip edge and re-clip their rings.
						className={cn(
							"flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1.5",
							compactScrollAreaClassName,
						)}
					>
						<div className="flex flex-col gap-4">
							<AgentConfigProfile
								config={profileConfig ?? config}
								avatarSrc={profileAvatarSrc ?? avatarSrc}
								onAvatarChange={onProfileAvatarChange}
								onTextChange={handleProfileTextChange}
								screenAssistantTargetPrefix={screenAssistantTargetPrefix}
								isSubagent={isSubagent}
								baseAgentName={baseAgentName}
								subagentName={subagentName}
								onSelectBaseAgent={onSelectBaseAgent}
								onSubagentNameChange={onSubagentNameChange}
								subagentCondition={subagentCondition}
								onSubagentConditionChange={onSubagentConditionChange}
							/>
						</div>
						<AgentCompactConfigPanel
							config={config}
							avatarSrc={profileAvatarSrc ?? avatarSrc}
							hiddenConfigFields={hiddenConfigFields}
							onAddListValues={handleAddListValues}
							onAppendListItem={handleAppendListItem}
							onConnectTrigger={onConnectTrigger}
							onEditTriggers={handleEditTriggers}
							onManageTriggers={handleManageTriggers}
							onListItemChange={handleListItemChange}
							onManageSubagents={onManageSubagents ? handleManageSubagents : undefined}
							onOpenDirectory={handleOpenDirectory}
							onRemoveListItem={handleRemoveListItem}
							onSelectListItem={handleSelectListItem}
							onTextChange={handleTextChange}
							onToggleListItem={onToggleListItem}
							onAutomationRulesChange={onAutomationRulesChange}
							screenAssistantTargetPrefix={screenAssistantTargetPrefix}
							selectedListItemIndexByField={selectedListItemIndexByField}
						/>
						<AgentInstructionsComposer
							className="relative flex min-h-0 flex-1 flex-col"
							config={config}
							contentClassName={isFilledConfig ? "min-h-[240px]" : "min-h-[2rem]"}
							editorClassName={isFilledConfig ? undefined : "agent-instructions-tiptap-editor-compact-empty"}
							instructions={config.instructions}
							mentionRemovalRequest={mentionRemovalRequest}
							onAddListValues={handleAddListValues}
							onInstructionsChange={(value) => handleTextChange("instructions", value)}
							onMentionRemovalRequestHandled={handleMentionRemovalRequestHandled}
							onOpenDirectory={handleOpenDirectory}
							onRemoveReferenceValue={handleRemoveReferenceValue}
							onStartWithTemplate={onStartWithTemplate}
							onViewModeChange={onInstructionsViewModeChange}
							screenAssistantTargetId={screenAssistantTargetPrefix ? `${screenAssistantTargetPrefix}:instructions` : undefined}
							showSectionLabel={false}
						/>
						{/*
							Onboarding bento: on a brand-new, capability-empty base agent
							(not a subagent), surface the "Start with these agent templates"
							tiles pinned to the bottom of the config. The instructions
							composer above is `flex-1` and absorbs free space, so this
							`shrink-0` block lands flush at the scroll area's bottom. It
							animates away once the agent gains its first capability
							(`isFilledConfig`) or the user picks "Not now".
						*/}
						<AnimatePresence initial={false}>
							{!isFilledConfig && !isSubagent && !isOnboardingBentoDismissed ? (
								<motion.div
									key="agent-onboarding-bento"
									className="shrink-0"
									exit={{ opacity: 0 }}
									transition={{ duration: 0.2, ease: motionEase.out }}
								>
									<AgentCompactOperationsBento
										onDismiss={() => setIsOnboardingBentoDismissed(true)}
										onStartWithTemplate={onStartWithTemplate}
									/>
								</motion.div>
							) : null}
						</AnimatePresence>
					</div>
					{/* Optional caller-supplied slot rendered at the panel bottom. */}
					{compactFooterBefore}
				</div>
				<AgentTriggersDialog
					open={triggersEditor.open}
					onOpenChange={handleTriggersEditorOpenChange}
					automationRule={triggersEditor.seed}
					onSave={handleTriggersSave}
					showBack={triggersEditor.fromManage}
					title={triggersEditor.title}
				/>
				<ManageTriggersDialog
					open={manageTriggersOpen}
					onOpenChange={setManageTriggersOpen}
					automationRules={currentAutomationRules}
					onAddAutomation={handleAddAutomationFromManage}
					onReorderAutomations={handleReorderAutomations}
					onToggleAutomation={handleToggleAutomation}
					onDeleteAutomation={handleDeleteAutomation}
					onEditAutomation={handleEditAutomationFromManage}
				/>
			</div>
		);
	}
);

AgentConfigFields.displayName = "AgentConfigFields";
