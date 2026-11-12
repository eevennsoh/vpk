"use client";

import type { ComponentProps, ReactNode } from "react";
import { memo, useCallback, useMemo, useState } from "react";

import type { EditorToolbarViewMode } from "@/components/blocks/editor-toolbar";
import { ManageTriggersDialog } from "@/components/blocks/trigger/components/manage-triggers-dialog";
import type { AgentAutomationRule, AgentTriggerValue } from "@/components/blocks/trigger/page";
import { createAgentAutomationRule, createAgentTriggerValue } from "@/components/blocks/trigger/data/trigger-catalog";
import { useHasVerticalOverflow } from "@/components/hooks/use-has-vertical-overflow";
import { AgentTriggersDialog } from "@/components/ui-custom/agent-triggers-dialog";
import type { RichTextMentionRemovalRequest } from "@/components/ui-custom/rich-text-editor";
import { cn } from "@/lib/utils";

import { AgentConfigProfile, type AgentConfigProfileLabels } from "@/components/blocks/agent-config-core/components/agent-config-profile";
import { hasFilledAgentConfig } from "@/components/blocks/agent-config-core/components/agent-filled-config-summary";
import {
	type AgentConfigFormValue,
	type AgentConfigListFieldName,
	type AgentConfigReferenceListFieldName,
	type AgentConfigTextFieldName,
	type AgentDirectoryKind,
	type AgentHideableConfigField,
	createAutomationRuleFromEvent,
	getAgentAutomationRules,
	getNextAutomationRuleIndex,
	getNormalizedAgentReferenceValue,
} from "@/components/blocks/agent-config-core/lib/agent-config-model";
import {
	AGENT_REFERENCE_CATEGORY_BY_CONFIG_FIELD,
	isAgentConfigReferenceListField,
} from "@/components/blocks/agent-config-core/lib/agent-reference-mapping";

export interface AgentConfigFieldsSlotContext {
	config: AgentConfigFormValue;
	currentAutomationRules: readonly AgentAutomationRule[];
	handleAddListValues: (field: AgentConfigReferenceListFieldName, values: readonly string[]) => void;
	handleAppendListItem: (field: AgentConfigListFieldName) => void;
	handleEditTriggers: (seed?: AgentAutomationRule, fromManage?: boolean, isNew?: boolean) => void;
	handleListItemChange: (field: AgentConfigListFieldName, index: number, value: string) => void;
	handleManageSubagents: (() => void) | undefined;
	handleManageTriggers: () => void;
	handleMentionRemovalRequestHandled: (key: string) => void;
	handleOpenDirectory: (directory: AgentDirectoryKind, selectedItem?: string) => void;
	handleProfileTextChange: (field: AgentConfigTextFieldName, value: string) => void;
	handleRemoveListItem: (field: AgentConfigListFieldName, index: number) => void;
	handleRemoveReferenceValue: (field: AgentConfigReferenceListFieldName, value: string) => void;
	handleSelectListItem: (field: AgentConfigListFieldName, index: number) => void;
	handleTextChange: (field: AgentConfigTextFieldName, value: string) => void;
	isFilledConfig: boolean;
	mentionRemovalRequest: RichTextMentionRemovalRequest | null;
}

export interface AgentConfigFieldsCoreProps extends ComponentProps<"div"> {
	config: AgentConfigFormValue;
	avatarSrc?: string;
	compactFooterBefore?: ReactNode;
	compactScrollAreaClassName?: string;
	hiddenConfigFields?: ReadonlySet<AgentHideableConfigField>;
	idPrefix: string;
	onInstructionsViewModeChange?: (mode: EditorToolbarViewMode) => void;
	onManageSubagents?: () => void;
	onProfileTextChange?: (field: AgentConfigTextFieldName, value: string) => void;
	onTextChange?: (field: AgentConfigTextFieldName, value: string) => void;
	onListItemChange?: (field: AgentConfigListFieldName, index: number, value: string) => void;
	onRemoveListItem?: (field: AgentConfigListFieldName, index: number) => void;
	onSelectListItem?: (field: AgentConfigListFieldName, index: number) => void;
	onToggleListItem?: (field: AgentConfigListFieldName, index: number, enabled: boolean) => void;
	onAddListValues?: (field: AgentConfigReferenceListFieldName, values: readonly string[]) => void;
	onAppendListItem?: (field: AgentConfigListFieldName) => void;
	onConnectTrigger?: (trigger: AgentTriggerValue) => void;
	onManageTriggers?: () => void;
	onOpenDirectory?: (directory: AgentDirectoryKind, selectedItem?: string) => void;
	onAutomationRulesChange?: (automationRules: readonly AgentAutomationRule[]) => void;
	profileAvatarSrc?: string;
	profileConfig?: AgentConfigFormValue;
	profileCover?: ReactNode;
	profileLabels: AgentConfigProfileLabels;
	profileMetaSlot?: ReactNode;
	renderFooter?: (context: AgentConfigFieldsSlotContext) => ReactNode;
	renderInstructions: (context: AgentConfigFieldsSlotContext) => ReactNode;
	screenAssistantTargetPrefix?: string;
	selectedListItemIndexByField?: Partial<Record<AgentConfigListFieldName, number>>;
	suppressBottomScrollMask?: boolean;
	isSubagent?: boolean;
	baseAgentName?: string;
	subagentName?: string;
	onSelectBaseAgent?: () => void;
	onSubagentNameChange?: (value: string) => void;
	subagentCondition?: string;
	onSubagentConditionChange?: (value: string) => void;
}

export const AgentConfigFieldsCore = memo(
	({
		className,
		config,
		avatarSrc: _avatarSrc,
		compactFooterBefore,
		compactScrollAreaClassName,
		hiddenConfigFields: _hiddenConfigFields,
		idPrefix,
		onListItemChange,
		onAddListValues,
		onAppendListItem,
		onConnectTrigger: _onConnectTrigger,
		onInstructionsViewModeChange: _onInstructionsViewModeChange,
		onManageTriggers,
		onManageSubagents,
		onOpenDirectory,
		onProfileTextChange,
		onRemoveListItem,
		onSelectListItem,
		onTextChange,
		onToggleListItem: _onToggleListItem,
		onAutomationRulesChange,
		profileAvatarSrc: _profileAvatarSrc,
		profileConfig,
		profileCover,
		profileLabels,
		profileMetaSlot,
		renderFooter,
		renderInstructions,
		screenAssistantTargetPrefix,
		suppressBottomScrollMask = false,
		isSubagent,
		baseAgentName,
		subagentName,
		onSelectBaseAgent,
		onSubagentNameChange,
		subagentCondition,
		onSubagentConditionChange,
		...props
	}: Readonly<AgentConfigFieldsCoreProps>) => {
		void _avatarSrc;
		void _hiddenConfigFields;
		void _onConnectTrigger;
		void _onInstructionsViewModeChange;
		void _onToggleListItem;
		void _profileAvatarSrc;

		const isFilledConfig = hasFilledAgentConfig(config);
		const compactScrollOverflow = useHasVerticalOverflow<HTMLDivElement>();
		const [mentionRemovalRequest, setMentionRemovalRequest] = useState<RichTextMentionRemovalRequest | null>(null);
		const handleTextChange = useCallback((field: AgentConfigTextFieldName, value: string) => {
			onTextChange?.(field, value);
		}, [onTextChange]);
		const handleProfileTextChange = useCallback((field: AgentConfigTextFieldName, value: string) => {
			(onProfileTextChange ?? onTextChange)?.(field, value);
		}, [onProfileTextChange, onTextChange]);
		const handleListItemChange = useCallback((field: AgentConfigListFieldName, index: number, value: string) => {
			onListItemChange?.(field, index, value);
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
			onAddListValues?.(field, values);
		}, [onAddListValues]);
		const handleRemoveReferenceValue = useCallback((field: AgentConfigReferenceListFieldName, value: string) => {
			const normalizedValue = getNormalizedAgentReferenceValue(value);
			const index = (config[field] ?? []).findIndex(
				(item) => getNormalizedAgentReferenceValue(item) === normalizedValue,
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
		const currentAutomationRules = useMemo(
			() => getAgentAutomationRules(config),
			[config],
		);
		const [triggersEditor, setTriggersEditor] = useState<{ open: boolean; fromManage: boolean; seed: AgentAutomationRule; title: string }>({
			open: false,
			fromManage: false,
			title: "New automation",
			seed: createAgentAutomationRule({
				id: "automation-1",
				name: "",
				prompt: "",
				triggers: [],
			}),
		});
		const handleEditTriggers = useCallback((seed?: AgentAutomationRule, fromManage = false, isNew = false) => {
			setTriggersEditor({
				open: true,
				fromManage,
				title: !seed || isNew ? "Add automation" : "Edit automation",
				seed: seed ?? createAgentAutomationRule({
					id: `automation-${getNextAutomationRuleIndex(currentAutomationRules)}`,
					name: "",
					prompt: "",
					triggers: [],
				}),
			});
		}, [currentAutomationRules]);
		const handleTriggersEditorOpenChange = useCallback((open: boolean) => {
			setTriggersEditor((prev) => ({ ...prev, open }));
		}, []);
		const handleTriggersSave = useCallback((automationRule: AgentAutomationRule) => {
			const current = currentAutomationRules;
			const existingIndex = current.findIndex((rule) => rule.id === automationRule.id);
			onAutomationRulesChange?.(
				existingIndex >= 0
					? current.map((rule, index) => (index === existingIndex ? automationRule : rule))
					: [...current, automationRule],
			);
		}, [currentAutomationRules, onAutomationRulesChange]);

		const [manageTriggersOpen, setManageTriggersOpen] = useState(false);
		const handleManageTriggers = useCallback(() => {
			if (onManageTriggers) {
				onManageTriggers();
				return;
			}

			setManageTriggersOpen(true);
		}, [onManageTriggers]);
		const handleAddAutomationFromManage = useCallback(
			(providerId: Parameters<typeof createAgentTriggerValue>[0], eventId: string) => {
				const next = createAutomationRuleFromEvent(providerId, eventId, currentAutomationRules);
				if (!next) {
					return;
				}
				setManageTriggersOpen(false);
				handleEditTriggers(next, false, true);
			},
			[currentAutomationRules, handleEditTriggers],
		);
		const handleReorderAutomations = useCallback(
			(activeId: string, overId: string) => {
				const current = currentAutomationRules;
				const from = current.findIndex((rule) => rule.id === activeId);
				const to = current.findIndex((rule) => rule.id === overId);
				if (from === -1 || to === -1) {
					return;
				}
				const next = current.slice();
				const [moved] = next.splice(from, 1);
				next.splice(to, 0, moved);
				onAutomationRulesChange?.(next);
			},
			[currentAutomationRules, onAutomationRulesChange],
		);
		const handleToggleAutomation = useCallback(
			(id: string, enabled: boolean) => {
				const current = currentAutomationRules;
				onAutomationRulesChange?.(
					current.map((rule) => (rule.id === id ? { ...rule, enabled } : rule)),
				);
			},
			[currentAutomationRules, onAutomationRulesChange],
		);
		const handleDeleteAutomation = useCallback(
			(id: string) => {
				const current = currentAutomationRules;
				onAutomationRulesChange?.(current.filter((rule) => rule.id !== id));
			},
			[currentAutomationRules, onAutomationRulesChange],
		);
		const handleEditAutomationFromManage = useCallback(
			(automationRule: AgentAutomationRule) => {
				setManageTriggersOpen(false);
				handleEditTriggers(automationRule, true);
			},
			[handleEditTriggers],
		);
		const slotContext: AgentConfigFieldsSlotContext = {
			config,
			currentAutomationRules,
			handleAddListValues,
			handleAppendListItem,
			handleEditTriggers,
			handleListItemChange,
			handleManageSubagents: onManageSubagents ? handleManageSubagents : undefined,
			handleManageTriggers,
			handleMentionRemovalRequestHandled,
			handleOpenDirectory,
			handleProfileTextChange,
			handleRemoveListItem,
			handleRemoveReferenceValue,
			handleSelectListItem,
			handleTextChange,
			isFilledConfig,
			mentionRemovalRequest,
		};

		return (
			<div
				className={cn("flex min-h-0 flex-1 flex-col gap-6", className)}
				data-agent-config-id={idPrefix}
				data-screen-assistant-target={screenAssistantTargetPrefix}
				{...props}
			>
				<div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
					<div
						ref={compactScrollOverflow.ref}
						className={cn(
							"flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto",
							compactScrollOverflow.showBottomScrollMask && !suppressBottomScrollMask && "scroll-mask-bottom",
							compactScrollAreaClassName,
						)}
					>
						<div className="flex flex-col gap-4">
							<AgentConfigProfile
								config={profileConfig ?? config}
								labels={profileLabels}
								profileCover={profileCover}
								profileMetaSlot={profileMetaSlot}
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
						{renderInstructions(slotContext)}
					</div>
					{compactFooterBefore}
					{renderFooter ? (
						<div className="shrink-0">
							{renderFooter(slotContext)}
						</div>
					) : null}
				</div>
				<AgentTriggersDialog
					showBack={triggersEditor.fromManage}
					open={triggersEditor.open}
					onOpenChange={handleTriggersEditorOpenChange}
					automationRule={triggersEditor.seed}
					onSave={handleTriggersSave}
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
	},
);

AgentConfigFieldsCore.displayName = "AgentConfigFieldsCore";
