"use client";

import { memo } from "react";

import { AgentAutomationFlowCover } from "@/components/blocks/trigger/components/agent-automation-flow-cover";
import {
	AgentConfigFieldsCore,
	type AgentConfigFieldsCoreProps,
} from "@/components/blocks/agent-config-core/components/agent-config-fields-core";
import { TriggerInstructionsComposer } from "@/components/blocks/trigger-config/components/trigger-instructions-composer";
import {
	getAgentAutomationRules,
	type AgentConfigFormValue,
} from "@/components/blocks/agent-config-core/lib/agent-config-model";
import { cn } from "@/lib/utils";

export {
	AGENT_COMPACT_HEADER_DEFAULT_NAV_ITEMS,
	AGENT_COMPACT_HEADER_DETAILS_NAV_ITEM,
	Agent,
	AgentCompactAccessPanel,
	AgentCompactEvaluationPanel,
	AgentCompactHeaderNav,
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
	AGENT_KNOWLEDGE_UPLOAD_TARGET,
	toggleAgentConfigDisabledItem,
	type AgentCompactAccessPanelProps,
	type AgentCompactEvaluationPanelProps,
	type AgentCompactHeaderNavItem,
	type AgentCompactHeaderSection,
	type AgentCompactInsightsPanelProps,
	type AgentCompactSurfacesPanelProps,
	type AgentCompactUsersPanelProps,
	type AgentConfigFormValue,
	type AgentConfigListFieldName,
	type AgentConfigReferenceListFieldName,
	type AgentConfigTextFieldName,
	type AgentDirectoryKind,
	type AgentHideableConfigField,
	type AgentContentProps,
	type AgentHeaderProps,
	type AgentInstructionsProps,
	type AgentMoreOptionsMenuProps,
	type AgentOutputProps,
	type AgentProps,
	type AgentToolProps,
	type AgentToolsProps,
} from "@/components/blocks/agent-config-core";

const TRIGGER_CONFIG_PROFILE_LABELS = {
	untitledName: "Untitled automation",
	editName: "Edit automation name",
	editDescription: "Edit automation description",
} as const;

function TriggerConfigProfileCover({ config }: Readonly<{ config: AgentConfigFormValue }>) {
	const primaryRule = getAgentAutomationRules(config)[0];

	return <AgentAutomationFlowCover triggers={primaryRule?.triggers ?? []} />;
}

export interface AgentConfigFieldsProps extends Omit<
	AgentConfigFieldsCoreProps,
	"profileLabels" | "profileCover" | "profileMetaSlot" | "renderInstructions" | "renderFooter" | "suppressBottomScrollMask"
> {
	/** Overrides the instructions editor's contentClassName — use to scope scroll to the editor only. */
	compactInstructionsContentClassName?: string;
}

export const AgentConfigFields = memo(
	({
		avatarSrc,
		compactFooterBefore: _compactFooterBefore,
		compactInstructionsContentClassName,
		compactScrollAreaClassName,
		config,
		hiddenConfigFields: _hiddenConfigFields,
		onAddListValues,
		onAppendListItem: _onAppendListItem,
		onAutomationRulesChange,
		onConnectTrigger,
		onInstructionsViewModeChange,
		onListItemChange: _onListItemChange,
		onManageSubagents: _onManageSubagents,
		onManageTriggers: _onManageTriggers,
		onOpenDirectory,
		onProfileTextChange,
		onRemoveListItem,
		onSelectListItem: _onSelectListItem,
		onTextChange,
		onToggleListItem: _onToggleListItem,
		profileAvatarSrc,
		profileConfig,
		screenAssistantTargetPrefix,
		selectedListItemIndexByField: _selectedListItemIndexByField,
		...props
	}: Readonly<AgentConfigFieldsProps>) => {
		void _compactFooterBefore;
		void _hiddenConfigFields;
		void _onAppendListItem;
		void _onListItemChange;
		void _onManageSubagents;
		void _onManageTriggers;
		void _onSelectListItem;
		void _onToggleListItem;
		void _selectedListItemIndexByField;

		return (
			<AgentConfigFieldsCore
				avatarSrc={avatarSrc}
				compactScrollAreaClassName={compactScrollAreaClassName}
				config={config}
				onAddListValues={onAddListValues}
				onAutomationRulesChange={onAutomationRulesChange}
				onConnectTrigger={onConnectTrigger}
				onInstructionsViewModeChange={onInstructionsViewModeChange}
				onOpenDirectory={onOpenDirectory}
				onProfileTextChange={onProfileTextChange}
				onRemoveListItem={onRemoveListItem}
				onTextChange={onTextChange}
				profileAvatarSrc={profileAvatarSrc}
				profileConfig={profileConfig}
				profileCover={<TriggerConfigProfileCover config={profileConfig ?? config} />}
				profileLabels={TRIGGER_CONFIG_PROFILE_LABELS}
				renderInstructions={(context) => (
					<TriggerInstructionsComposer
						className="relative flex min-h-0 flex-1 flex-col"
						config={config}
						contentClassName={cn("pt-0", compactInstructionsContentClassName ?? (context.isFilledConfig ? "min-h-[240px]" : "min-h-[2rem]"))}
						editorClassName={context.isFilledConfig ? undefined : "agent-instructions-tiptap-editor-compact-empty"}
						instructions={config.instructions}
						mentionRemovalRequest={context.mentionRemovalRequest}
						onAddListValues={context.handleAddListValues}
						onAutomationRulesChange={onAutomationRulesChange}
						onConnectTrigger={onConnectTrigger}
						onInstructionsChange={(value) => context.handleTextChange("instructions", value)}
						onMentionRemovalRequestHandled={context.handleMentionRemovalRequestHandled}
						onOpenDirectory={context.handleOpenDirectory}
						onRemoveReferenceValue={context.handleRemoveReferenceValue}
						onViewModeChange={onInstructionsViewModeChange}
						screenAssistantTargetId={screenAssistantTargetPrefix ? `${screenAssistantTargetPrefix}:instructions` : undefined}
						showSectionLabel={false}
					/>
				)}
				screenAssistantTargetPrefix={screenAssistantTargetPrefix}
				{...props}
			/>
		);
	},
);

AgentConfigFields.displayName = "AgentConfigFields";
