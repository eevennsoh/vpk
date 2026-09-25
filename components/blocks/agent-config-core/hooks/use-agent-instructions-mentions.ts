"use client";

import { useCallback, useMemo } from "react";

import { EDITOR_PALETTE_MENTION_SOURCES } from "@/components/blocks/editor-palette/data/mention-sources";
import type {
	RichTextMentionItem,
	RichTextMentionSources,
	RichTextReferenceCategory,
	RichTextSlashCategory,
} from "@/components/ui-custom/rich-text-editor";
import { isRichTextReferenceCategory } from "@/components/ui-custom/rich-text-editor";
import { useLazyRef } from "@/lib/use-lazy-ref";

import type {
	AgentConfigFormValue,
	AgentConfigReferenceListFieldName,
	AgentDirectoryKind,
} from "@/components/blocks/agent-config-core/lib/agent-config-model";
import {
	AGENT_CONFIG_FIELD_BY_REFERENCE_CATEGORY,
	AGENT_DIRECTORY_BY_SLASH_CATEGORY,
	getAgentReferenceKey,
	hasAgentReferenceValue,
	mapConfigValuesToMentionItems,
	mapSubagentConfigValuesToMentionItems,
	mergeMentionItems,
} from "@/components/blocks/agent-config-core/lib/agent-reference-mapping";

export interface UseAgentInstructionsMentionsProps {
	config: AgentConfigFormValue;
	onAddListValues?: (field: AgentConfigReferenceListFieldName, values: readonly string[]) => void;
	onOpenDirectory?: (directory: AgentDirectoryKind, selectedItem?: string) => void;
	onRemoveReferenceValue?: (field: AgentConfigReferenceListFieldName, value: string) => void;
}

export function useAgentInstructionsMentions({
	config,
	onAddListValues,
	onOpenDirectory,
	onRemoveReferenceValue,
}: Readonly<UseAgentInstructionsMentionsProps>) {
	const inlineManagedReferenceKeysRef = useLazyRef(() => new Set<string>());
	const mentionInventoryCountsRef = useLazyRef(() => new Map<string, {
		count: number;
		field: AgentConfigReferenceListFieldName;
		label: string;
	}>());
	const inlineManagedReferenceKeys = inlineManagedReferenceKeysRef.current;
	const mentionInventoryCounts = mentionInventoryCountsRef.current;
	const mentionSources = useMemo<RichTextMentionSources>(() => ({
		subagent: mapSubagentConfigValuesToMentionItems(config.subagents),
		skill: mergeMentionItems(
			mapConfigValuesToMentionItems("skill", config.skills),
			EDITOR_PALETTE_MENTION_SOURCES.skill,
		),
		tool: mergeMentionItems(
			mapConfigValuesToMentionItems("tool", config.tools),
			EDITOR_PALETTE_MENTION_SOURCES.tool,
		),
		knowledge: mergeMentionItems(
			mapConfigValuesToMentionItems("knowledge", config.knowledge),
			EDITOR_PALETTE_MENTION_SOURCES.knowledge,
		),
	}), [config.knowledge, config.skills, config.subagents, config.tools]);
	const handleInsertReferenceOption = useCallback((category: RichTextReferenceCategory, label: string): false => {
		const field = AGENT_CONFIG_FIELD_BY_REFERENCE_CATEGORY[category];
		const key = getAgentReferenceKey(field, label);

		inlineManagedReferenceKeys.add(key);
		if (!hasAgentReferenceValue(config, field, label)) {
			onAddListValues?.(field, [label]);
		}

		return false;
	}, [config, inlineManagedReferenceKeys, onAddListValues]);
	const handleOpenDirectory = useCallback((category: RichTextSlashCategory): void => {
		if (category === "format") {
			return;
		}
		onOpenDirectory?.(AGENT_DIRECTORY_BY_SLASH_CATEGORY[category]);
	}, [onOpenDirectory]);
	const handleMentionInventoryChange = useCallback((mentions: readonly RichTextMentionItem[]): void => {
		const nextCounts = new Map<string, {
			count: number;
			field: AgentConfigReferenceListFieldName;
			label: string;
		}>();

		for (const mention of mentions) {
			if (!isRichTextReferenceCategory(mention.category)) {
				continue;
			}

			const field = AGENT_CONFIG_FIELD_BY_REFERENCE_CATEGORY[mention.category];
			const key = getAgentReferenceKey(field, mention.label);
			const current = nextCounts.get(key);
			nextCounts.set(key, {
				count: (current?.count ?? 0) + 1,
				field,
				label: mention.label,
			});
		}

		for (const [key, next] of nextCounts) {
			const previousCount = mentionInventoryCounts.get(key)?.count ?? 0;
			if (next.count <= previousCount) {
				continue;
			}

			inlineManagedReferenceKeys.add(key);
			if (!hasAgentReferenceValue(config, next.field, next.label)) {
				onAddListValues?.(next.field, [next.label]);
			}
		}

		for (const [key, previous] of mentionInventoryCounts) {
			if (nextCounts.has(key) || !inlineManagedReferenceKeys.has(key)) {
				continue;
			}

			inlineManagedReferenceKeys.delete(key);
			onRemoveReferenceValue?.(previous.field, previous.label);
		}

		mentionInventoryCounts.clear();
		for (const [key, next] of nextCounts) {
			mentionInventoryCounts.set(key, next);
		}
	}, [config, inlineManagedReferenceKeys, mentionInventoryCounts, onAddListValues, onRemoveReferenceValue]);
	const clearMentionInventory = useCallback(() => {
		handleMentionInventoryChange([]);
	}, [handleMentionInventoryChange]);



	return {
		clearMentionInventory,
		handleInsertReferenceOption,
		handleMentionInventoryChange,
		handleOpenDirectory,
		mentionSources,
	};
}
