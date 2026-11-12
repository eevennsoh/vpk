"use client";

import { startTransition, useCallback, useMemo, useState } from "react";

import type {
	AgentConfigFormValue,
	AgentConfigListFieldName,
} from "@/components/blocks/agent";
import {
	cloneConfig,
	createDraftSubagentPrompt,
	getBaseConfigWithSubagents,
	getDerivedSubagentNames,
} from "@/components/blocks/subagent/lib/subagent-prompts";
import type { SubagentPrompt } from "@/components/blocks/subagent/data/demo-agents";
import type { RovoAgentSubagentPrompt, RovoDataParts } from "@/lib/rovo-ui-messages";

type AgentResult = RovoDataParts["agent-result"];

/**
 * Backs the studio agent config panel's base-agent + subagents experience.
 *
 * The base agent IS the studio draft (`draft`); subagent prompts are persisted on
 * the draft under `subagentPrompts` (see context-rovo-chat's key-preserving
 * reducer), and the base agent's `subagents` chip list is always derived from the
 * prompt trigger names so there is a single source of truth.
 *
 * `activeSubagentId` is local view state (which subagent is being edited); the
 * data itself round-trips through `updateDraft`, so it survives panel close/reopen,
 * agent switching, and publish. Mirrors the standalone subagents demo
 * (components/blocks/subagent/page.tsx), reusing the same pure helpers.
 */
export function useAgentConfigSubagents({
	draft,
	updateDraft,
}: Readonly<{
	draft: AgentResult;
	updateDraft: (patch: Partial<AgentResult>) => void;
}>) {
	const [activeSubagentId, setActiveSubagentId] = useState<string | null>(null);

	// The persisted prompts carry a structural `config` (Record<string, unknown>);
	// treat them as the demo's SubagentPrompt (config: AgentConfigFormValue) within
	// this hook and cast back at the `updateDraft` boundary.
	const subagentPrompts = useMemo<SubagentPrompt[]>(
		() => ((draft.subagentPrompts ?? []) as unknown as SubagentPrompt[]),
		[draft.subagentPrompts],
	);

	const activePrompt = activeSubagentId
		? subagentPrompts.find((prompt) => prompt.id === activeSubagentId) ?? null
		: null;
	const isSubagentActive = activePrompt !== null;

	// The derived subagents chip list (getDerivedSubagentNames) mirrors the prompt
	// list 1:1 — including unnamed drafts shown as "Untitled subagent" — so the
	// index reported by the summary row maps straight back to the owning prompt.
	// Keep this list aligned with that derivation; filtering here would desync the
	// indexes used by select/remove-by-derived-index.
	const derivedSubagentPrompts = subagentPrompts;

	// Base config = the draft + the derived subagent chip list.
	const baseConfig = useMemo<AgentConfigFormValue>(
		() => getBaseConfigWithSubagents(draft as unknown as AgentConfigFormValue, subagentPrompts),
		[draft, subagentPrompts],
	);

	const activeConfig = activePrompt ? activePrompt.config : baseConfig;
	const activeConfigId = activePrompt ? `prompt-${activePrompt.id}` : "base";
	const derivedIndex = activePrompt
		? derivedSubagentPrompts.findIndex((prompt) => prompt.id === activePrompt.id)
		: -1;
	const selectedSubagentIndex = derivedIndex >= 0 ? derivedIndex : undefined;

	// Persist a prompt list change + keep the mirrored `subagents` chip list in sync.
	const commitPrompts = useCallback(
		(nextPrompts: SubagentPrompt[]) => {
			updateDraft({
				subagentPrompts: nextPrompts as unknown as RovoAgentSubagentPrompt[],
				subagents: getDerivedSubagentNames(nextPrompts),
			} as Partial<AgentResult>);
		},
		[updateDraft],
	);

	const selectBaseAgent = useCallback(() => {
		startTransition(() => setActiveSubagentId(null));
	}, []);

	const selectSubagent = useCallback((promptId: string) => {
		startTransition(() => setActiveSubagentId(promptId));
	}, []);

	// AgentConfigFields' subagents dropdown reports the index into the derived
	// chip list; map it back to the owning prompt id.
	const selectSubagentByDerivedIndex = useCallback(
		(index: number) => {
			const prompt = derivedSubagentPrompts[index];
			if (prompt) {
				startTransition(() => setActiveSubagentId(prompt.id));
			}
		},
		[derivedSubagentPrompts],
	);

	const createSubagent = useCallback(() => {
		const prompt = createDraftSubagentPrompt(subagentPrompts);
		commitPrompts([...subagentPrompts, prompt]);
		startTransition(() => setActiveSubagentId(prompt.id));
	}, [commitPrompts, subagentPrompts]);

	// Single write primitive: routes an editor change to either the base draft
	// fields or the active subagent prompt's config.
	const updateActiveConfig = useCallback(
		(updater: (config: AgentConfigFormValue) => AgentConfigFormValue) => {
			if (!activePrompt) {
				const next = updater(cloneConfig(baseConfig));
				updateDraft(next as unknown as Partial<AgentResult>);
				return;
			}

			const nextPrompts = subagentPrompts.map((prompt) =>
				prompt.id === activePrompt.id
					? { ...prompt, config: updater(cloneConfig(prompt.config)) }
					: prompt,
			);
			updateDraft({
				subagentPrompts: nextPrompts as unknown as RovoAgentSubagentPrompt[],
			} as Partial<AgentResult>);
		},
		[activePrompt, baseConfig, subagentPrompts, updateDraft],
	);

	const handleTriggerNameChange = useCallback(
		(value: string) => {
			if (!activePrompt) {
				return;
			}
			commitPrompts(
				subagentPrompts.map((prompt) =>
					prompt.id === activePrompt.id ? { ...prompt, triggerName: value } : prompt,
				),
			);
		},
		[activePrompt, commitPrompts, subagentPrompts],
	);

	const handleConditionChange = useCallback(
		(value: string) => {
			if (!activePrompt) {
				return;
			}
			commitPrompts(
				subagentPrompts.map((prompt) =>
					prompt.id === activePrompt.id ? { ...prompt, condition: value } : prompt,
				),
			);
		},
		[activePrompt, commitPrompts, subagentPrompts],
	);

	// Remove a subagent by its index in the derived (named) chip list. Resets the
	// active selection to the base agent in the same transition if the removed
	// prompt was being edited.
	const removeSubagentByDerivedIndex = useCallback(
		(index: number) => {
			const promptToRemove = derivedSubagentPrompts[index];
			if (!promptToRemove) {
				return;
			}

			const nextPrompts = subagentPrompts.filter((prompt) => prompt.id !== promptToRemove.id);
			commitPrompts(nextPrompts);
			if (promptToRemove.id === activeSubagentId) {
				startTransition(() => setActiveSubagentId(null));
			}
		},
		[activeSubagentId, commitPrompts, derivedSubagentPrompts, subagentPrompts],
	);

	// Remove a subagent by its prompt id (used by the Manage subagents dialog,
	// which works in prompt ids rather than derived chip indexes). Resets the
	// active selection to the base agent if the removed prompt was being edited.
	const deleteSubagentById = useCallback(
		(id: string) => {
			const nextPrompts = subagentPrompts.filter((prompt) => prompt.id !== id);
			if (nextPrompts.length === subagentPrompts.length) {
				return;
			}

			commitPrompts(nextPrompts);
			if (id === activeSubagentId) {
				startTransition(() => setActiveSubagentId(null));
			}
		},
		[activeSubagentId, commitPrompts, subagentPrompts],
	);

	// Reorder the raw prompt list by moving `activeId` to `overId`'s position.
	const reorderSubagents = useCallback(
		(activeId: string, overId: string) => {
			const fromIndex = subagentPrompts.findIndex((prompt) => prompt.id === activeId);
			const toIndex = subagentPrompts.findIndex((prompt) => prompt.id === overId);
			if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
				return;
			}

			const nextPrompts = [...subagentPrompts];
			const [moved] = nextPrompts.splice(fromIndex, 1);
			nextPrompts.splice(toIndex, 0, moved);
			commitPrompts(nextPrompts);
		},
		[commitPrompts, subagentPrompts],
	);

	// Enable/disable a subagent without removing it. The derived chip list keys
	// off trigger names, so the enabled flag is purely the prompt's own state.
	const toggleSubagent = useCallback(
		(id: string, enabled: boolean) => {
			commitPrompts(
				subagentPrompts.map((prompt) =>
					prompt.id === id ? { ...prompt, enabled } : prompt,
				),
			);
		},
		[commitPrompts, subagentPrompts],
	);

	return {
		activeConfig,
		activeConfigId,
		activePrompt,
		// Which subagent prompt is being edited (null = base agent). Used by the
		// floating SubagentNavigator to highlight the active row.
		activeSubagentId,
		baseConfig,
		createSubagent,
		deleteSubagentById,
		handleConditionChange,
		handleTriggerNameChange,
		isSubagentActive,
		removeSubagentByDerivedIndex,
		reorderSubagents,
		selectBaseAgent,
		selectSubagent,
		selectSubagentByDerivedIndex,
		selectedSubagentIndex,
		// Raw prompt list (including unnamed drafts) for the floating navigator.
		subagentPrompts,
		toggleSubagent,
		updateActiveConfig,
	} as const;
}

export type UseAgentConfigSubagentsResult = ReturnType<typeof useAgentConfigSubagents>;
export type { AgentConfigListFieldName };
