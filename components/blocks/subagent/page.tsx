"use client";

import { startTransition, useMemo, useRef, useState } from "react";
import {
	Agent,
	AgentConfigFields,
	type AgentConfigFormValue,
	type AgentConfigListFieldName,
	type AgentConfigTextFieldName,
	AgentContent,
	toggleAgentConfigDisabledItem,
} from "@/components/blocks/agent";
import { SubagentNavigator } from "@/components/blocks/subagent/subagent-navigator";
import { useSubagentNavigatorTop } from "@/components/blocks/subagent/hooks/use-subagent-navigator-top";
import { ManageSubagentsDialog } from "@/components/blocks/subagent/components/manage-subagents-dialog";
import {
	cloneConfig,
	createDraftSubagentPrompt,
	getBaseConfigWithSubagents,
	getListItems,
	normalizeBaseAgent,
	normalizeSubagentPrompts,
	updateConfigListItem,
} from "@/components/blocks/subagent/lib/subagent-prompts";
import {
	type SubagentPrompt,
	type SubagentBaseAgent,
} from "@/components/blocks/subagent/data/demo-agents";
import { cn } from "@/lib/utils";

export interface SubagentProps {
	className?: string;
	initialActiveSubagentId?: string;
	initialBaseAgent?: SubagentBaseAgent;
	initialSubagents?: ReadonlyArray<SubagentPrompt>;
}

export default function Subagent({
	className,
	initialActiveSubagentId,
	initialBaseAgent,
	initialSubagents,
}: Readonly<SubagentProps>) {
	// Keep the floating navigator top-aligned with the first line of the
	// instructions editor (measured relative to this positioned root) instead
	// of a fixed `top` that drifts as the profile/content above reflows.
	const containerRef = useRef<HTMLDivElement | null>(null);
	const navigatorTop = useSubagentNavigatorTop(containerRef);
	const initialBaseAgentState = useMemo(() => normalizeBaseAgent(initialBaseAgent), [initialBaseAgent]);
	const initialSubagentPromptState = useMemo(() => normalizeSubagentPrompts(initialSubagents), [initialSubagents]);
	const [baseAgent, setBaseAgent] = useState<SubagentBaseAgent>(() => initialBaseAgentState);
	const [subagentPrompts, setSubagentPrompts] = useState<SubagentPrompt[]>(() => initialSubagentPromptState);
	const [activeSubagentId, setActiveSubagentId] = useState<string | null>(() => {
		const initialActivePrompt = initialActiveSubagentId
			? initialSubagentPromptState.find((prompt) => prompt.id === initialActiveSubagentId)
			: null;
		return initialActivePrompt?.id ?? null;
	});
	const [isManageSubagentsOpen, setIsManageSubagentsOpen] = useState(false);

	const activePrompt = activeSubagentId
		? subagentPrompts.find((prompt) => prompt.id === activeSubagentId) ?? null
		: null;
	// The derived subagents chip list (getDerivedSubagentNames) mirrors the prompt
	// list 1:1 — including unnamed drafts shown as "Untitled subagent" — so the
	// index reported by the summary row maps straight back to the owning prompt.
	const derivedSubagentPrompts = subagentPrompts;
	const baseConfig = useMemo(
		() => getBaseConfigWithSubagents(baseAgent.config, subagentPrompts),
		[baseAgent.config, subagentPrompts],
	);
	const activeConfig = activePrompt ? activePrompt.config : baseConfig;
	const activeConfigId = activePrompt ? `prompt-${activePrompt.id}` : "base";
	const activeSubagentListIndex = activePrompt
		? derivedSubagentPrompts.findIndex((prompt) => prompt.id === activePrompt.id)
		: -1;

	function handleSelectBaseAgent() {
		startTransition(() => {
			setActiveSubagentId(null);
		});
	}

	function handleSelectSubagent(promptId: string) {
		startTransition(() => {
			setActiveSubagentId(promptId);
		});
	}

	function handleCreateSubagent() {
		const prompt = createDraftSubagentPrompt(subagentPrompts);
		startTransition(() => {
			setSubagentPrompts((currentPrompts) => [...currentPrompts, prompt]);
			setActiveSubagentId(prompt.id);
		});
	}

	function handleDeleteSubagent(id: string) {
		setSubagentPrompts((currentPrompts) => currentPrompts.filter((prompt) => prompt.id !== id));
		setActiveSubagentId((currentId) => (currentId === id ? null : currentId));
	}

	function handleReorderSubagents(activeId: string, overId: string) {
		setSubagentPrompts((currentPrompts) => {
			const fromIndex = currentPrompts.findIndex((prompt) => prompt.id === activeId);
			const toIndex = currentPrompts.findIndex((prompt) => prompt.id === overId);
			if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
				return currentPrompts;
			}

			const nextPrompts = [...currentPrompts];
			const [moved] = nextPrompts.splice(fromIndex, 1);
			nextPrompts.splice(toIndex, 0, moved);
			return nextPrompts;
		});
	}

	function handleToggleSubagent(id: string, enabled: boolean) {
		setSubagentPrompts((currentPrompts) =>
			currentPrompts.map((prompt) => (prompt.id === id ? { ...prompt, enabled } : prompt)),
		);
	}

	function updateBaseConfig(updateConfig: (config: AgentConfigFormValue) => AgentConfigFormValue) {
		setBaseAgent((currentAgent) => ({
			...currentAgent,
			config: updateConfig(cloneConfig(currentAgent.config)),
		}));
	}

	function updateActivePromptConfig(updateConfig: (config: AgentConfigFormValue) => AgentConfigFormValue) {
		if (!activePrompt) {
			updateBaseConfig(updateConfig);
			return;
		}

		setSubagentPrompts((currentPrompts) =>
			currentPrompts.map((prompt) =>
				prompt.id === activePrompt.id
					? {
						...prompt,
						config: updateConfig(cloneConfig(prompt.config)),
					}
					: prompt
			),
		);
	}

	function handleBaseTextChange(field: AgentConfigTextFieldName, value: string) {
		updateBaseConfig((config) => ({
			...config,
			[field]: value,
			...(field === "description" ? { summary: value } : {}),
		}));
	}

	function handleActiveTextChange(field: AgentConfigTextFieldName, value: string) {
		updateActivePromptConfig((config) => ({
			...config,
			[field]: value,
			...(field === "description" ? { summary: value } : {}),
		}));
	}

	function handleListItemChange(field: AgentConfigListFieldName, index: number, value: string) {
		if (!activePrompt && field === "subagents") {
			return;
		}

		updateActivePromptConfig((config) => updateConfigListItem(config, field, index, value));
	}

	function handleRemoveListItem(field: AgentConfigListFieldName, index: number) {
		if (!activePrompt && field === "subagents") {
			const promptToRemove = derivedSubagentPrompts[index];
			if (!promptToRemove) {
				return;
			}

			setSubagentPrompts((currentPrompts) => currentPrompts.filter((prompt) => prompt.id !== promptToRemove.id));
			return;
		}

		updateActivePromptConfig((config) => ({
			...config,
			[field]: getListItems(config, field).filter((_, itemIndex) => itemIndex !== index),
		}));
	}

	function handleToggleListItem(field: AgentConfigListFieldName, index: number, enabled: boolean) {
		updateActivePromptConfig((config) => {
			const label = getListItems(config, field)[index];
			return label ? toggleAgentConfigDisabledItem(config, field, label, enabled) : config;
		});
	}

	function handleAppendListItem(field: AgentConfigListFieldName) {
		if (field === "subagents") {
			handleCreateSubagent();
			return;
		}

		updateActivePromptConfig((config) => ({
			...config,
			[field]: [...getListItems(config, field), ""],
		}));
	}

	function handleSelectConfigListItem(field: AgentConfigListFieldName, index: number) {
		if (field !== "subagents") {
			return;
		}

		const prompt = derivedSubagentPrompts[index];
		if (!prompt) {
			return;
		}

		handleSelectSubagent(prompt.id);
	}

	function handleTriggerNameChange(value: string) {
		if (!activePrompt) {
			return;
		}

		setSubagentPrompts((currentPrompts) =>
			currentPrompts.map((prompt) =>
				prompt.id === activePrompt.id
					? { ...prompt, triggerName: value }
					: prompt
			),
		);
	}

	function handleConditionChange(value: string) {
		if (!activePrompt) {
			return;
		}

		setSubagentPrompts((currentPrompts) =>
			currentPrompts.map((prompt) =>
				prompt.id === activePrompt.id
					? { ...prompt, condition: value }
					: prompt
			),
		);
	}

	return (
		<div
			ref={containerRef}
			className={cn(
				"relative flex h-full min-h-[852px] overflow-hidden rounded-xl bg-background",
				className,
			)}
		>
			{/* The wrapper carries the measured `top` so the switcher top-aligns
			    with the first line of the instructions editor. */}
			<div
				className="absolute right-4 z-20 hidden md:block"
				style={{ top: navigatorTop }}
			>
				<SubagentNavigator
					activeSubagentId={activeSubagentId}
					baseAgent={baseAgent}
					onCreateSubagent={handleCreateSubagent}
					onDeleteSubagent={handleDeleteSubagent}
					onManageSubagents={() => setIsManageSubagentsOpen(true)}
					onSelectBaseAgent={handleSelectBaseAgent}
					onSelectSubagent={handleSelectSubagent}
					onToggleSubagent={handleToggleSubagent}
					subagents={subagentPrompts}
				/>
			</div>
			<div className="flex-1 overflow-y-auto px-6 py-6 pr-20">
				<Agent className="mx-auto flex min-h-[852px] w-full max-w-[720px] flex-col">
					<AgentContent className="flex min-h-0 flex-1 flex-col">
						<AgentConfigFields
							avatarSrc={baseAgent.avatarSrc}
							baseAgentName={baseConfig.name}
							className="min-h-0 flex-1"
							config={activeConfig}
							isSubagent={Boolean(activePrompt)}
							onSelectBaseAgent={handleSelectBaseAgent}
							onSubagentNameChange={handleTriggerNameChange}
							subagentName={activePrompt?.triggerName}
							subagentCondition={activePrompt?.condition}
							onSubagentConditionChange={handleConditionChange}
							idPrefix={`subagent-${activeConfigId}`}
							onAppendListItem={handleAppendListItem}
							onListItemChange={handleListItemChange}
							onManageSubagents={() => setIsManageSubagentsOpen(true)}
							onProfileTextChange={handleBaseTextChange}
							onRemoveListItem={handleRemoveListItem}
							onToggleListItem={handleToggleListItem}
							onSelectListItem={handleSelectConfigListItem}
							onTextChange={handleActiveTextChange}
							profileAvatarSrc={baseAgent.avatarSrc}
							profileConfig={baseConfig}
							screenAssistantTargetPrefix={`subagents:${activeConfigId}`}
							selectedListItemIndexByField={{
								subagents: activeSubagentListIndex >= 0 ? activeSubagentListIndex : undefined,
							}}
						/>
					</AgentContent>
				</Agent>
			</div>
			<ManageSubagentsDialog
				open={isManageSubagentsOpen}
				onOpenChange={setIsManageSubagentsOpen}
				onCreateSubagent={() => {
					setIsManageSubagentsOpen(false);
					handleCreateSubagent();
				}}
				onDeleteSubagent={handleDeleteSubagent}
				onReorderSubagents={handleReorderSubagents}
				onToggleSubagent={handleToggleSubagent}
				subagents={subagentPrompts}
			/>
		</div>
	);
}

export type { SubagentPrompt, SubagentBaseAgent } from "@/components/blocks/subagent/data/demo-agents";
