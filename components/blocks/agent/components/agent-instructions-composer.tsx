"use client";

import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";

import { AgentTemplatesDialog } from "@/components/blocks/agent-templates";
import { DEMO_AGENT_TEMPLATES } from "@/components/blocks/agent-templates/data/demo-template-agents";
import { EDITOR_PALETTE_MENTION_SOURCES } from "@/components/blocks/editor-palette/data/mention-sources";
import type { EditorToolbarViewMode } from "@/components/blocks/editor-toolbar";
import {
	AgentSectionLabel,
} from "@/components/blocks/agent/components/agent-summary-row";
import type {
	AgentConfigFormValue,
	AgentConfigReferenceListFieldName,
	AgentDirectoryKind,
} from "@/components/blocks/agent/lib/agent-config-model";
import {
	AGENT_CONFIG_FIELD_BY_REFERENCE_CATEGORY,
	getAgentReferenceKey,
	hasAgentReferenceValue,
	mapConfigValuesToMentionItems,
	mapSubagentConfigValuesToMentionItems,
	mergeMentionItems,
} from "@/components/blocks/agent/lib/agent-reference-mapping";
import {
	type RichTextMentionItem,
	type RichTextMentionRemovalRequest,
	type RichTextMentionSources,
	type RichTextReferenceCategory,
	type RichTextSlashCategory,
	type RichTextSuggestionVariantConfig,
	RichTextEditor,
	isRichTextReferenceCategory,
} from "@/components/ui-custom/rich-text-editor";
import "@/components/ui-custom/rich-text-editor/rich-text-editor.css";
import { useLazyRef } from "@/lib/use-lazy-ref";
import { cn } from "@/lib/utils";

const AGENT_INSTRUCTIONS_SUGGESTION_VARIANT: RichTextSuggestionVariantConfig = "nested";

const AGENT_DIRECTORY_BY_SLASH_CATEGORY: Record<
	Exclude<RichTextSlashCategory, "format">,
	AgentDirectoryKind
> = {
	skill: "skills",
	tool: "tools",
	knowledge: "knowledge",
	app: "apps",
};

export const AGENT_KNOWLEDGE_UPLOAD_TARGET = "__upload__";

export interface AgentInstructionsComposerProps {
	bottomSlot?: ReactNode;
	bottomSlotClassName?: string;
	className?: string;
	config: AgentConfigFormValue;
	contentClassName?: string;
	editorClassName?: string;
	instructions?: string;
	mentionRemovalRequest?: RichTextMentionRemovalRequest | null;
	onAddListValues?: (field: AgentConfigReferenceListFieldName, values: readonly string[]) => void;
	onMentionRemovalRequestHandled?: (key: string) => void;
	onInstructionsChange?: (value: string) => void;
	onOpenDirectory?: (directory: AgentDirectoryKind, selectedItem?: string) => void;
	onRemoveReferenceValue?: (field: AgentConfigReferenceListFieldName, value: string) => void;
	onStartWithTemplate?: () => void;
	onViewModeChange?: (mode: EditorToolbarViewMode) => void;
	screenAssistantTargetId?: string;
	showSectionLabel?: boolean;
	toolbarBelowSlot?: ReactNode;
}

export function AgentInstructionsComposer({
	bottomSlot,
	bottomSlotClassName,
	className,
	config,
	contentClassName,
	editorClassName,
	instructions,
	mentionRemovalRequest,
	onAddListValues,
	onMentionRemovalRequestHandled,
	onInstructionsChange,
	onOpenDirectory,
	onRemoveReferenceValue,
	onStartWithTemplate,
	onViewModeChange,
	screenAssistantTargetId,
	showSectionLabel = true,
	toolbarBelowSlot,
}: Readonly<AgentInstructionsComposerProps>) {
	const [templatesOpen, setTemplatesOpen] = useState(false);
	const inlineManagedReferenceKeysRef = useLazyRef(() => new Set<string>());
	const mentionInventoryCountsRef = useLazyRef(() => new Map<string, {
		count: number;
		field: AgentConfigReferenceListFieldName;
		label: string;
	}>());
	const mentionSources = useMemo<RichTextMentionSources>(() => ({
		// Subagents are NESTED agents owned by THIS agent — not globally
		// at-mentionable top-level agents. So the `@subagent` list comes ONLY from
		// this agent's own subagents (empty/0 until it generates some); the global
		// parent-agent palette is intentionally NOT merged in here.
		// Prompt references deliberately carry no directory visual/avatar: subagents
		// are prompt copies under the parent agent, not nested parent-agent profiles.
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

		inlineManagedReferenceKeysRef.current.add(key);
		if (!hasAgentReferenceValue(config, field, label)) {
			onAddListValues?.(field, [label]);
		}

		return false;
	}, [config, inlineManagedReferenceKeysRef, onAddListValues]);
	// "Browse all" in a nested "/" category's empty state opens that category's
	// directory. Map the slash category to the config-panel directory kind; the
	// renderer only fires this for directory-backed categories (not "format").
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
			const previousCount = mentionInventoryCountsRef.current.get(key)?.count ?? 0;
			if (next.count <= previousCount) {
				continue;
			}

			inlineManagedReferenceKeysRef.current.add(key);
			if (!hasAgentReferenceValue(config, next.field, next.label)) {
				onAddListValues?.(next.field, [next.label]);
			}
		}

		for (const [key, previous] of mentionInventoryCountsRef.current) {
			if (nextCounts.has(key) || !inlineManagedReferenceKeysRef.current.has(key)) {
				continue;
			}

			inlineManagedReferenceKeysRef.current.delete(key);
			onRemoveReferenceValue?.(previous.field, previous.label);
		}

		mentionInventoryCountsRef.current = nextCounts;
	}, [config, inlineManagedReferenceKeysRef, mentionInventoryCountsRef, onAddListValues, onRemoveReferenceValue]);



	return (
		<section
			className={cn("space-y-0", className)}
			data-agent-field="instructions"
			data-screen-assistant-target={screenAssistantTargetId}
		>
			{showSectionLabel ? (
				<AgentSectionLabel>Instructions</AgentSectionLabel>
			) : null}
			<RichTextEditor
				aria-label="Agent instructions"
				className="space-y-0"
				contentClassName={contentClassName}
				editorClassName={cn("agent-instructions-tiptap-editor text-text", editorClassName)}
				enableDirectoryAutocomplete
				placeholder="Press / to help me create the agent, or start with a template"
				placeholderSlot={(
					<p className="tiptap-editor text-sm leading-[1.55] text-text-subtlest">
						Press <code>/</code> to help me create the agent, or{" "}
						<button
							type="button"
							className="pointer-events-auto cursor-pointer rounded-sm text-link no-underline underline-offset-2 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
							onClick={() => {
								// Choosing a template means the user is already mindful of
								// templates — animate the onboarding tiles away.
								if (onStartWithTemplate) {
									// A host (e.g. the Studio shell) owns the agents
									// directory and takes over: don't also open the local
									// templates dialog.
									onStartWithTemplate();
									return;
								}
								setTemplatesOpen(true);
							}}
						>
							start with a template
						</button>
					</p>
				)}
				onInsertReferenceOption={handleInsertReferenceOption}
				onOpenDirectory={handleOpenDirectory}
				onViewModeChange={onViewModeChange}
				suggestionVariant={AGENT_INSTRUCTIONS_SUGGESTION_VARIANT}
				toolbarBelowSlot={toolbarBelowSlot}
				toolbarReveal="hover"
				padStuckToolbar
				value={instructions}
				mentionSources={mentionSources}
				mentionRemovalRequest={mentionRemovalRequest}
				onMarkdownChange={onInstructionsChange}
				onMentionInventoryChange={handleMentionInventoryChange}
				onMentionRemovalRequestHandled={onMentionRemovalRequestHandled}
			/>
			{bottomSlot ? (
				<div className={bottomSlotClassName}>
					{bottomSlot}
				</div>
			) : null}
			<AgentTemplatesDialog
				agents={DEMO_AGENT_TEMPLATES}
				open={templatesOpen}
				onOpenChange={setTemplatesOpen}
				onSelectAgent={() => setTemplatesOpen(false)}
			/>
		</section>
	);
}
