"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, type CSSProperties, type Ref } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import { useJiraActivityComposerDictation } from "@/components/blocks/jira-activity/use-jira-activity-composer-dictation";
import { EDITOR_PALETTE_MENTION_SOURCES, mapAgentToMentionItem } from "@/components/blocks/editor-palette/data/mention-sources";
import type { AgentBrowserAgent } from "@/components/blocks/agent-browser";
import { FloatingComposer } from "@/components/projects/shared/components/floating-composer";
import { RovoComposerActionButton } from "@/components/projects/shared/components/rovo-composer-send-controls";
import { PromptInputButton } from "@/components/ui-custom/prompt-input";
import AddIcon from "@atlaskit/icon/core/add";
import { createRichTextEditorExtensions, getMentionNodeAttrs, type RichTextMentionItem } from "@/components/ui-custom/rich-text-editor";
import "@/components/ui-custom/rich-text-editor/rich-text-editor.css";

const COMMENT_PLACEHOLDER = "Give an instruction, leave a comment or ask for an update";

export interface ProjectButterCommentEditorHandle {
	getDraftWithoutAgentMention: (name: string) => string;
	isAtAgentMentionBoundary: (name: string) => boolean;
	revertAgentMention: (name: string) => void;
}

/**
 * The work item's comment box: the compact Prompt Input floating composer
 * (`Microphone + text send — compact`) around the rich-text editor, so agent
 * mentions, dictation, and Enter-to-send keep working in one compact row.
 * Thread replies reuse it unchanged apart from their placeholder and label.
 */
export function ProjectButterCommentEditor({ agents, ariaLabel = "Comment editor", elevation = "floating", focusRequest, instructionPlaceholderForAgent, onCancel, onMentionChange, onSave, onValueChange, placeholder = COMMENT_PLACEHOLDER, prefillMention, ref, textboxLabel = ariaLabel, value }: Readonly<{
	agents: readonly AgentBrowserAgent[];
	ariaLabel?: string;
	/** `flat` drops the floating shadow for boxes that sit inline in the feed, such as thread replies. */
	elevation?: "floating" | "flat";
	focusRequest: number;
	instructionPlaceholderForAgent?: string;
	/** Escape closes the box when the host supports it. */
	onCancel?: () => void;
	onMentionChange?: (agentNames: string[], hasMentions: boolean) => void;
	placeholder?: string;
	/** The textbox's own name, when it should differ from the form's (replies keep "Leave a reply..."). */
	textboxLabel?: string;
	/** Leads a fresh draft with a mention chip, e.g. the author being replied to. */
	prefillMention?: Readonly<{ mention: RichTextMentionItem; textAfter: string }>;
	onSave: (body: string, plainText: string) => void;
	onValueChange: (body: string) => void;
	ref?: Ref<ProjectButterCommentEditorHandle>;
	value: string;
}>) {
	const lastEditorValue = useRef(value);
	const voice = useJiraActivityComposerDictation({ value, onValueChange });
	const extensions = useMemo(() => createRichTextEditorExtensions({ getMentionSources: () => ({ ...EDITOR_PALETTE_MENTION_SOURCES, subagent: agents.map(mapAgentToMentionItem).filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index) }), suggestionVariant: { mention: "flat", command: "flat" }, mentionSectionLabels: { subagent: "Agents" }, anchorToInput: true }), [agents]);
	const editor = useEditor({
		extensions, content: value, contentType: "markdown", immediatelyRender: false,
		editorProps: {
			attributes: { role: "textbox", "aria-label": textboxLabel, "aria-multiline": "true", class: "tiptap-editor min-h-6! py-0! text-sm leading-6 outline-none" },
			handleKeyDown: (_view, event) => {
				if (event.isComposing) return false;
				if (onCancel && event.key === "Escape" && !document.querySelector("[data-suggestion-option]")) { event.preventDefault(); event.stopPropagation(); onCancel(); return true; }
				if (event.key === "Enter" && !event.shiftKey && !document.querySelector("[data-suggestion-option]")) { event.preventDefault(); event.stopPropagation(); save(); return true; }
				return false;
			},
		},
		onCreate: ({ editor: activeEditor }) => reportMentions(activeEditor),
		onUpdate: ({ editor: activeEditor }) => {
			const markdown = activeEditor.getMarkdown();
			lastEditorValue.current = markdown;
			onValueChange(markdown);
			reportMentions(activeEditor);
		},
	});
	function reportMentions(activeEditor: Editor) {
		const names: string[] = [];
		let hasMentions = false;
		activeEditor.state.doc.descendants((node) => {
			if (node.type.name !== "mention") return;
			hasMentions = true;
			if (node.attrs.category === "subagent" && typeof node.attrs.label === "string") names.push(node.attrs.label);
		});
		onMentionChange?.(names, hasMentions);
	}
	useImperativeHandle(ref, () => ({
		getDraftWithoutAgentMention(name) {
			return editor?.getText({ textSerializers: { mention: ({ node }) => node.attrs.category === "subagent" && node.attrs.label === name ? "" : `@${node.attrs.label ?? node.attrs.id}` } }).trim() ?? "";
		},
		isAtAgentMentionBoundary(name) {
			if (!editor || !editor.state.selection.empty) return false;
			const { $from } = editor.state.selection;
			const before = $from.nodeBefore;
			const mention = before?.isText && !before.text?.trim()
				? editor.state.doc.resolve($from.pos - before.nodeSize).nodeBefore
				: before;
			return mention?.type.name === "mention" && mention.attrs.category === "subagent" && mention.attrs.label === name;
		},
		revertAgentMention(name) {
			if (!editor) return;
			let position: number | null = null;
			editor.state.doc.descendants((node, pos) => {
				if (node.type.name === "mention" && node.attrs.category === "subagent" && node.attrs.label === name) position = pos;
			});
			if (position === null) return;
			const node = editor.state.doc.nodeAt(position);
			if (!node) return;
			const transaction = editor.state.tr.replaceWith(position, position + node.nodeSize, editor.state.schema.text(`@${name}`));
			editor.view.dispatch(transaction);
			editor.commands.focus(undefined, { scrollIntoView: false });
		},
	}), [editor]);
	useEffect(() => { if (editor && lastEditorValue.current !== value) { editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false }); lastEditorValue.current = value; } }, [editor, value]);
	useEffect(() => {
		if (!editor || !focusRequest) return;
		const frame = requestAnimationFrame(() => editor.commands.focus("end", { scrollIntoView: false }));
		return () => cancelAnimationFrame(frame);
	}, [editor, focusRequest]);
	// Prefill once per editor. Hosts rebuild the mention object every render, so it is read
	// from a ref; re-running on identity would re-insert it over the user's typing.
	const prefillRef = useRef(prefillMention);
	const prefilled = useRef(false);
	useEffect(() => {
		const request = prefillRef.current;
		if (!editor || !request || prefilled.current) return;
		// A frame later, like PromptInput: the mention's React node view can't flush mid-commit.
		const frame = requestAnimationFrame(() => {
			prefilled.current = true;
			editor.chain().focus().selectAll().insertContent([{ type: "mention", attrs: getMentionNodeAttrs(request.mention) }, { type: "text", text: request.textAfter }]).run();
			// Inserting over select-all leaves everything selected; park the caret after the mention so typing extends it.
			editor.commands.focus("end");
		});
		return () => cancelAnimationFrame(frame);
	}, [editor]);
	const placeholderStyle = useMemo<CSSProperties & { "--rich-text-placeholder": string }>(() => ({ "--rich-text-placeholder": JSON.stringify(placeholder) }), [placeholder]);
	const showInstructionPlaceholder = Boolean(editor && instructionPlaceholderForAgent && !editor.getText({ textSerializers: { mention: ({ node }) => node.attrs.category === "subagent" && node.attrs.label === instructionPlaceholderForAgent ? "" : `@${node.attrs.label ?? node.attrs.id}` } }).trim());
	function save() { if (editor?.getText().trim()) onSave(editor.getMarkdown(), editor.getText()); }
	return (
		<FloatingComposer
			actions={<RovoComposerActionButton canSubmit={Boolean(editor?.getText().trim())} composerStatus="ready" dictationState={voice.dictationState} dictationTranscriptPreview={voice.dictationTranscriptPreview} micStream={voice.micStream} onStartDictation={voice.onStartDictation} onStop={voice.onStopDictation} onStopDictation={voice.onStopDictation} showSubmitWhenEmpty size="icon-sm" />}
			addButton={
				<PromptInputButton aria-label="Mention an agent or person" disabled={!editor} onClick={() => editor?.chain().focus().insertContent("@").run()} size="icon-sm" variant="ghost">
					<AddIcon label="" />
				</PromptInputButton>
			}
			aria-label={ariaLabel}
			className={elevation === "flat" ? "shadow-none" : undefined}
			data-project-butter-comment-editor
			onSubmit={() => save()}
		>
			<EditorContent className="rich-text-editor-content max-h-48 min-h-6 w-full min-w-0 overflow-y-auto [&_.react-renderer.node-mention]:inline-flex [&_.react-renderer.node-mention]:h-lh [&_.react-renderer.node-mention]:items-center [&_.react-renderer.node-mention]:align-middle [&_.rich-text-mention-node]:h-lh [&_.rich-text-mention-node]:items-center [&_.rich-text-mention-chip]:text-[length:inherit]" data-empty={editor?.isEmpty ? "true" : undefined} data-instruction-placeholder={showInstructionPlaceholder || undefined} editor={editor} style={placeholderStyle} />
		</FloatingComposer>
	);
}
