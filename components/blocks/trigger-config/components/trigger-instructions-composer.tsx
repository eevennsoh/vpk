"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import GenerativeIndicatorIcon from "@atlaskit/icon-lab/core/generative-indicator";

import {
	AgentInstructionsComposer,
} from "@/components/blocks/agent-config-core/components/agent-instructions-composer";
import type {
	AgentConfigFormValue,
	AgentConfigReferenceListFieldName,
	AgentDirectoryKind,
} from "@/components/blocks/agent-config-core/lib/agent-config-model";
import { getAgentAutomationRules } from "@/components/blocks/agent-config-core/lib/agent-config-model";
import {
	TriggerConditionsPanel,
	TriggerPicker,
	type AgentAutomationRule,
	type AgentTriggerProviderId,
	type AgentTriggerValue,
} from "@/components/blocks/trigger/page";
import {
	createAgentAutomationRule,
	createAgentTriggerValue,
	getAgentTriggerReadableLabel,
} from "@/components/blocks/trigger/data/trigger-catalog";
import type { EditorToolbarViewMode } from "@/components/blocks/editor-toolbar";
import type { RichTextMentionRemovalRequest } from "@/components/ui-custom/rich-text-editor";
import { cn } from "@/lib/utils";
import { token } from "@/lib/tokens";

type AgentRunPromptMode = "run-agent" | "custom-prompt";

const AGENT_RUN_PROMPT_CONNECTOR_LEFT = "0px";
const AGENT_RUN_PROMPT_CONNECTOR_TOP = `calc(-1 * ${token("space.200")})`;
const AGENT_RUN_PROMPT_CONNECTOR_WIDTH = token("space.200");
const AGENT_RUN_PROMPT_CONNECTOR_HEIGHT = "33px";
const AGENT_RUN_PROMPT_ROW_PADDING_LEFT = token("space.300");

function TriggerConfigAddBlock({
	className,
	config,
	onAutomationRulesChange,
	onConnectTrigger,
}: Readonly<{
	className?: string;
	config: AgentConfigFormValue;
	onAutomationRulesChange?: (automationRules: readonly AgentAutomationRule[]) => void;
	onConnectTrigger?: (trigger: AgentTriggerValue) => void;
}>) {
	const automationRules = getAgentAutomationRules(config);
	const primaryRule = automationRules[0];
	const triggers = useMemo<readonly AgentTriggerValue[]>(
		() => primaryRule?.triggers ?? [],
		[primaryRule],
	);
	const updatePrimaryTriggers = useCallback(
		(nextTriggers: readonly AgentTriggerValue[]) => {
			if (!onAutomationRulesChange) {
				return;
			}
			if (primaryRule) {
				onAutomationRulesChange(
					automationRules.map((rule, index) =>
						index === 0 ? { ...rule, triggers: nextTriggers } : rule,
					),
				);
				return;
			}
			onAutomationRulesChange([
				createAgentAutomationRule({
					id: "automation-1",
					name: "",
					prompt: config.instructions ?? "",
					triggers: nextTriggers,
				}),
				...automationRules,
			]);
		},
		[automationRules, config.instructions, onAutomationRulesChange, primaryRule],
	);
	const handleAddTrigger = useCallback(
		(providerId: AgentTriggerProviderId, eventId: string) => {
			const nextTrigger = createAgentTriggerValue(providerId, eventId, triggers.length + 1);
			if (nextTrigger) {
				updatePrimaryTriggers([...triggers, nextTrigger]);
			}
		},
		[triggers, updatePrimaryTriggers],
	);
	const handleParamChange = useCallback(
		(triggerId: string, paramId: string, value: string) => {
			updatePrimaryTriggers(
				triggers.map((trigger) => {
					if (trigger.id !== triggerId) {
						return trigger;
					}
					const nextTrigger = {
						...trigger,
						params: { ...(trigger.params ?? {}), [paramId]: value },
					};
					return { ...nextTrigger, label: getAgentTriggerReadableLabel(nextTrigger) };
				}),
			);
		},
		[triggers, updatePrimaryTriggers],
	);
	const handleRemoveTrigger = useCallback(
		(triggerId: string) => {
			updatePrimaryTriggers(triggers.filter((trigger) => trigger.id !== triggerId));
		},
		[triggers, updatePrimaryTriggers],
	);

	if (triggers.length === 0) {
		return (
			<div className={cn("rounded-xl border border-border bg-bg-input p-2", className)}>
				<TriggerPicker label="Add Trigger" onSelectEvent={handleAddTrigger} />
			</div>
		);
	}
	return (
		<div className={className}>
			<TriggerConditionsPanel
				onAddTrigger={handleAddTrigger}
				onConnectTrigger={onConnectTrigger}
				onParamChange={handleParamChange}
				onRemoveTrigger={handleRemoveTrigger}
				triggers={triggers}
			/>
		</div>
	);
}

export interface TriggerInstructionsComposerProps {
	className?: string;
	config: AgentConfigFormValue;
	contentClassName?: string;
	editorClassName?: string;
	instructions?: string;
	mentionRemovalRequest?: RichTextMentionRemovalRequest | null;
	onAddListValues?: (field: AgentConfigReferenceListFieldName, values: readonly string[]) => void;
	onAutomationRulesChange?: (automationRules: readonly AgentAutomationRule[]) => void;
	onConnectTrigger?: (trigger: AgentTriggerValue) => void;
	onMentionRemovalRequestHandled?: (key: string) => void;
	onInstructionsChange?: (value: string) => void;
	onOpenDirectory?: (directory: AgentDirectoryKind, selectedItem?: string) => void;
	onRemoveReferenceValue?: (field: AgentConfigReferenceListFieldName, value: string) => void;
	onViewModeChange?: (mode: EditorToolbarViewMode) => void;
	screenAssistantTargetId?: string;
	showSectionLabel?: boolean;
}

export function TriggerInstructionsComposer({
	className,
	config,
	contentClassName,
	editorClassName,
	instructions,
	mentionRemovalRequest,
	onAddListValues,
	onAutomationRulesChange,
	onConnectTrigger,
	onMentionRemovalRequestHandled,
	onInstructionsChange,
	onOpenDirectory,
	onRemoveReferenceValue,
	onViewModeChange,
	screenAssistantTargetId,
	showSectionLabel = true,
}: Readonly<TriggerInstructionsComposerProps>) {
	const [runPromptMode, setRunPromptMode] = useState<AgentRunPromptMode>(() =>
		instructions?.trim() ? "custom-prompt" : "run-agent",
	);
	const resolvedRunPromptMode = instructions?.trim() ? "custom-prompt" : runPromptMode;
	const [mentionInventoryResetKey, setMentionInventoryResetKey] = useState(0);
	const stashedCustomPromptRef = useRef("");
	const handleRunPromptModeChange = useCallback((value: AgentRunPromptMode): void => {
		setRunPromptMode(value);
		if (value === "run-agent") {
			stashedCustomPromptRef.current = instructions ?? "";
			setMentionInventoryResetKey((current) => current + 1);
			onInstructionsChange?.("");
		} else if (stashedCustomPromptRef.current.trim()) {
			onInstructionsChange?.(stashedCustomPromptRef.current);
		}
	}, [instructions, onInstructionsChange]);

	const beforeEditorSlot = (
		<div className="relative mb-3">
			<TriggerConfigAddBlock
				className="mb-6"
				config={config}
				onAutomationRulesChange={onAutomationRulesChange}
				onConnectTrigger={onConnectTrigger}
			/>
			<div className="relative" style={{ paddingLeft: AGENT_RUN_PROMPT_ROW_PADDING_LEFT }}>
				<span
					aria-hidden="true"
					className="pointer-events-none absolute border-b border-l border-border"
					style={{
						borderBottomLeftRadius: token("radius.large"),
						height: AGENT_RUN_PROMPT_CONNECTOR_HEIGHT,
						left: AGENT_RUN_PROMPT_CONNECTOR_LEFT,
						top: AGENT_RUN_PROMPT_CONNECTOR_TOP,
						width: AGENT_RUN_PROMPT_CONNECTOR_WIDTH,
					}}
				/>
				<div
					aria-label="Agent run prompt mode"
					className="relative inline-flex h-8 w-fit items-center justify-center rounded-lg bg-muted p-[3px] text-text-subtle"
					role="radiogroup"
				>
					<button
						aria-checked={resolvedRunPromptMode === "run-agent"}
						className={cn(
							"relative inline-flex h-[25px] items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-3 py-0.5 text-sm font-medium transition-all hover:bg-bg-neutral-subtle-hovered focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
							resolvedRunPromptMode === "run-agent" && "bg-surface text-text shadow-sm",
						)}
						onClick={() => handleRunPromptModeChange("run-agent")}
						role="radio"
						type="button"
					>
						<GenerativeIndicatorIcon label="" size="small" />
						Run agent
					</button>
					<button
						aria-checked={resolvedRunPromptMode === "custom-prompt"}
						className={cn(
							"relative inline-flex h-[25px] items-center justify-center whitespace-nowrap rounded-md border border-transparent px-3 py-0.5 text-sm font-medium transition-all hover:bg-bg-neutral-subtle-hovered focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
							resolvedRunPromptMode === "custom-prompt" && "bg-surface text-text shadow-sm",
						)}
						onClick={() => handleRunPromptModeChange("custom-prompt")}
						role="radio"
						type="button"
					>
						Pass a custom prompt
					</button>
				</div>
			</div>
		</div>
	);

	return (
		<AgentInstructionsComposer
			beforeEditorSlot={beforeEditorSlot}
			className={className}
			config={config}
			contentClassName={contentClassName}
			editorClassName={editorClassName}
			editorRootClassName="space-y-2"
			instructions={instructions}
			mentionInventoryResetKey={mentionInventoryResetKey}
			mentionRemovalRequest={mentionRemovalRequest}
			onAddListValues={onAddListValues}
			onInstructionsChange={onInstructionsChange}
			onMentionRemovalRequestHandled={onMentionRemovalRequestHandled}
			onOpenDirectory={onOpenDirectory}
			onRemoveReferenceValue={onRemoveReferenceValue}
			onViewModeChange={onViewModeChange}
			placeholder="Press / to help me create the automation"
			placeholderSlot={(
				<p className="tiptap-editor text-sm leading-[1.55] text-text-subtlest">
					Press <code>/</code> to help me create the automation
				</p>
			)}
			screenAssistantTargetId={screenAssistantTargetId}
			showEditor={resolvedRunPromptMode === "custom-prompt"}
			showSectionLabel={showSectionLabel}
		/>
	);
}
