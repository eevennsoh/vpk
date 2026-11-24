"use client";

import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type Ref } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { NodeSelection, TextSelection, type Transaction } from "@tiptap/pm/state";
import { useJiraActivityComposerDictation } from "@/components/blocks/jira-activity/use-jira-activity-composer-dictation";
import { EDITOR_PALETTE_MENTION_SOURCES, mapAgentToMentionItem } from "@/components/blocks/editor-palette/data/mention-sources";
import type { AgentBrowserAgent } from "@/components/blocks/agent-browser";
import { FloatingComposer } from "@/components/projects/shared/components/floating-composer";
import { RovoComposerActionButton } from "@/components/projects/shared/components/rovo-composer-send-controls";
import { PromptInputButton } from "@/components/ui-custom/prompt-input";
import AddIcon from "@atlaskit/icon/core/add";
import { createRichTextEditorExtensions, getMentionNodeAttrs, type RichTextMentionItem } from "@/components/ui-custom/rich-text-editor";
import "@/components/ui-custom/rich-text-editor/rich-text-editor.css";
import { cn } from "@/lib/utils";

const COMMENT_PLACEHOLDER = "Give an instruction, leave a comment or ask for an update";

type InsertedReplyMention = Readonly<{ node: ProseMirrorNode; standalone: boolean }>;

function getTextWithoutAgentMention(editor: Editor, name: string): string {
	return editor.getText({
		textSerializers: { mention: ({ node }) => node.attrs.category === "subagent" && node.attrs.label === name ? "" : `@${node.attrs.label ?? node.attrs.id}` },
	}).trim();
}

function removeReplyMention(tr: Transaction, previous: InsertedReplyMention) {
	tr.doc.descendants((node, position) => {
		if (node !== previous.node) return;
		const end = tr.doc.resolve(position + node.nodeSize);
		const separator = end.nodeAfter?.text?.startsWith(" ") ? 1 : 0;
		if (previous.standalone && end.parent.content.size === node.nodeSize + separator) {
			tr.delete(end.before(), end.after());
		} else {
			tr.delete(position, end.pos + separator);
		}
	});
	return tr;
}

function updateReplyMention(editor: Editor, previous: InsertedReplyMention | undefined, agent: AgentBrowserAgent | undefined) {
	const { tr, schema } = editor.state;
	if (previous) removeReplyMention(tr, previous);

	let inserted: InsertedReplyMention | undefined;
	if (agent) {
		const mention = mapAgentToMentionItem(agent);
		let alreadyMentioned = false;
		tr.doc.descendants((node) => {
			if (node.type.name === "mention" && node.attrs.id === mention.id) alreadyMentioned = true;
		});
		if (!alreadyMentioned) {
			const node = schema.nodes.mention.create(getMentionNodeAttrs(mention));
			const trailingSpace = schema.text(" ");
			const standalone = tr.doc.firstChild?.type.name !== "paragraph";
			if (standalone) tr.insert(0, schema.nodes.paragraph.create(null, [node, trailingSpace]));
			else tr.insert(1, [node, trailingSpace]);
			inserted = { node, standalone };
		}
	}
	return { tr, inserted };
}

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
export function ProjectButterCommentEditor({ agents, ariaLabel = "Comment editor", elevation = "floating", focusRequest, handoffMentionId, inputContext, instructionPlaceholderForAgent, mentionHandoffPending = false, onCancel, onHandoffInterrupt, onMentionChange, onReplyMentionRemove, onSave, onValueChange, placeholder = COMMENT_PLACEHOLDER, prefillMention, ref, replyMention, textboxLabel = ariaLabel, value }: Readonly<{
	agents: readonly AgentBrowserAgent[];
	ariaLabel?: string;
	/** `flat` drops the floating shadow for boxes that sit inline in the feed, such as thread replies. */
	elevation?: "floating" | "flat";
	focusRequest: number;
	handoffMentionId?: string;
	inputContext?: ReactNode;
	instructionPlaceholderForAgent?: string;
	mentionHandoffPending?: boolean;
	/** Escape closes the box when the host supports it. */
	onCancel?: () => void;
	onHandoffInterrupt?: () => void;
	onMentionChange?: (agentNames: string[], hasMentions: boolean) => void;
	onReplyMentionRemove?: () => void;
	placeholder?: string;
	/** The textbox's own name, when it should differ from the form's (replies keep "Leave a reply..."). */
	textboxLabel?: string;
	/** Leads a fresh draft with a mention chip, e.g. the author being replied to. */
	prefillMention?: Readonly<{ mention: RichTextMentionItem; textAfter: string; preserveContent?: boolean }>;
	replyMention?: Readonly<{ agent: AgentBrowserAgent; requestKey: number }>;
	onSave: (body: string, plainText: string, mentionedAgentIds: readonly string[]) => void;
	onValueChange: (body: string) => void;
	ref?: Ref<ProjectButterCommentEditorHandle>;
	value: string;
}>) {
	const lastEditorValue = useRef(value);
	const replyMentionState = useRef<Readonly<{ requestKey: number; inserted?: InsertedReplyMention }> | null>(null);
	const replyAgent = replyMention?.agent;
	const replyMentionRequestKey = replyMention?.requestKey;
	const placeholderAgent = replyAgent?.name ?? instructionPlaceholderForAgent;
	const [dismissedInstructionPlaceholder, setDismissedInstructionPlaceholder] = useState(false);
	const voice = useJiraActivityComposerDictation({ value, onValueChange });
	const extensions = useMemo(() => createRichTextEditorExtensions({ getMentionSources: () => ({ ...EDITOR_PALETTE_MENTION_SOURCES, subagent: agents.map(mapAgentToMentionItem).filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index) }), suggestionVariant: { mention: "flat", command: "flat" }, mentionSectionLabels: { subagent: "Agents" }, anchorToInput: true }), [agents]);
	const editor = useEditor({
		extensions, content: value, contentType: "markdown", immediatelyRender: false,
		editorProps: {
			attributes: { role: "textbox", "aria-label": textboxLabel, "aria-multiline": "true", class: "tiptap-editor min-h-6! py-0! text-sm leading-6 outline-none" },
			handleKeyDown: (view, event) => {
				if (mentionHandoffPending && !["Shift", "Control", "Alt", "Meta"].includes(event.key)) onHandoffInterrupt?.();
				if (event.isComposing) return false;
				const { doc, selection } = view.state;
				const leading = doc.firstChild?.type.name === "paragraph" ? doc.firstChild.firstChild : null;
				const replyMentionId = replyAgent ? mapAgentToMentionItem(replyAgent).id : undefined;
				const isLeadingReply = leading?.type.name === "mention" && leading.attrs.id === replyMentionId;
				if (isLeadingReply && event.key === "Home" && !event.shiftKey && !event.altKey && (event.metaKey || event.ctrlKey || selection.$from.start() === 1)) {
					event.preventDefault();
					view.dispatch(view.state.tr.setSelection(NodeSelection.create(doc, 1)));
					return true;
				}
				if (isLeadingReply && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
					const nodeSelected = selection instanceof NodeSelection && selection.from === 1;
					const separator = doc.resolve(2).nodeAfter?.text?.startsWith(" ") ? 1 : 0;
					if ((event.key === "ArrowLeft" || event.key === "Backspace") && (nodeSelected ? event.key === "ArrowLeft" : selection.empty && selection.from <= 2 + separator)) {
						event.preventDefault();
						if (!nodeSelected) view.dispatch(view.state.tr.setSelection(NodeSelection.create(doc, 1)));
						return true;
					}
					if (event.key === "ArrowRight" && nodeSelected) {
						event.preventDefault();
						view.dispatch(view.state.tr.setSelection(TextSelection.create(doc, 2 + separator)));
						return true;
					}
					if ((event.key === "Backspace" || event.key === "Delete") && nodeSelected) {
						event.preventDefault();
						view.dispatch(view.state.tr.delete(1, 2 + separator));
						return true;
					}
				}
				if (onCancel && event.key === "Escape" && !document.querySelector("[data-suggestion-option]")) { event.preventDefault(); event.stopPropagation(); onCancel(); return true; }
				if (event.key === "Enter" && !event.shiftKey && !document.querySelector("[data-suggestion-option]")) { event.preventDefault(); event.stopPropagation(); setDismissedInstructionPlaceholder(true); save(); return true; }
				return false;
			},
			handleDOMEvents: {
				beforeinput: () => { if (mentionHandoffPending) onHandoffInterrupt?.(); return false; },
				paste: () => { if (mentionHandoffPending) onHandoffInterrupt?.(); return false; },
				compositionstart: () => { if (mentionHandoffPending) onHandoffInterrupt?.(); return false; },
			},
		},
		onCreate: ({ editor: activeEditor }) => reportMentions(activeEditor),
		onUpdate: ({ editor: activeEditor }) => {
			setDismissedInstructionPlaceholder(false);
			const inserted = replyMentionState.current?.inserted;
			const markdown = inserted && activeEditor.markdown
				? activeEditor.markdown.serialize(removeReplyMention(activeEditor.state.tr, inserted).doc.toJSON())
				: activeEditor.getMarkdown();
			lastEditorValue.current = markdown;
			onValueChange(markdown);
			reportMentions(activeEditor);
			if (replyAgent && replyMentionState.current) {
				let found = false;
				activeEditor.state.doc.descendants((node) => { if (node.type.name === "mention" && node.attrs.id === mapAgentToMentionItem(replyAgent).id) found = true; });
				if (!found) onReplyMentionRemove?.();
			}
		},
		onSelectionUpdate: ({ editor: activeEditor }) => {
			const { doc, selection } = activeEditor.state;
			const leading = doc.firstChild?.type.name === "paragraph" ? doc.firstChild.firstChild : null;
			if (activeEditor.isFocused && replyAgent && replyMentionState.current && selection.empty && selection.from === 1 && leading?.type.name === "mention" && leading.attrs.id === mapAgentToMentionItem(replyAgent).id) {
				activeEditor.view.dispatch(activeEditor.state.tr.setSelection(NodeSelection.create(doc, 1)));
			}
		},
	});
	const contentState = useEditorState({
		editor,
		selector: ({ editor }) => ({
			isEmpty: editor?.isEmpty ?? true,
			canSubmit: Boolean(editor && (replyAgent ? getTextWithoutAgentMention(editor, replyAgent.name) : editor.getText().trim())),
			showInstructionPlaceholder: Boolean(editor && !editor.isEmpty && placeholderAgent && !getTextWithoutAgentMention(editor, placeholderAgent) && editor.state.doc.childCount === 1 && !editor.state.doc.firstChild?.content.content.some((node) => node.type.name === "hardBreak")),
		}),
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
			return editor ? getTextWithoutAgentMention(editor, name) : "";
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
	useEffect(() => {
		if (!editor || lastEditorValue.current === value) return;
		editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false });
		lastEditorValue.current = value;
		replyMentionState.current = null;
	}, [editor, value]);
	useEffect(() => {
		if (!editor || !focusRequest) return;
		const frame = requestAnimationFrame(() => editor.commands.focus("end", { scrollIntoView: false }));
		return () => cancelAnimationFrame(frame);
	}, [editor, focusRequest]);
	useEffect(() => {
		if (!editor || replyMentionState.current?.requestKey === replyMentionRequestKey) return;
		const frame = requestAnimationFrame(() => {
			const { tr, inserted } = updateReplyMention(editor, replyMentionState.current?.inserted, replyAgent);
			replyMentionState.current = replyMentionRequestKey === undefined ? null : { requestKey: replyMentionRequestKey, inserted };
			if (tr.docChanged) editor.view.dispatch(tr.setMeta("addToHistory", false));
		});
		return () => cancelAnimationFrame(frame);
	}, [editor, replyAgent, replyMentionRequestKey, value]);
	useLayoutEffect(() => {
		if (!editor || !mentionHandoffPending || !handoffMentionId) return;
		let target: HTMLElement | undefined;
		let opacity = "";
		const hideTarget = () => {
			target = [...editor.view.dom.querySelectorAll<HTMLElement>("[data-mention-id]")].find((node) => node.dataset.mentionId === handoffMentionId);
			if (!target) return;
			opacity = target.style.opacity;
			target.style.opacity = "0";
			observer.disconnect();
		};
		const observer = new MutationObserver(hideTarget);
		observer.observe(editor.view.dom, { childList: true, subtree: true });
		hideTarget();
		return () => { observer.disconnect(); if (target) target.style.opacity = opacity; };
	}, [editor, handoffMentionId, mentionHandoffPending]);
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
			const insertion = [{ type: "mention", attrs: getMentionNodeAttrs(request.mention) }, { type: "text", text: request.textAfter }];
			if (request.preserveContent) editor.chain().insertContentAt(1, insertion).run();
			else editor.chain().selectAll().insertContent(insertion).run();
			// Inserting over select-all leaves everything selected; park the caret after the mention so typing extends it.
			if (focusRequest) editor.commands.focus("end", { scrollIntoView: false });
		});
		return () => cancelAnimationFrame(frame);
	}, [editor, focusRequest]);
	const placeholderStyle = useMemo<CSSProperties & { "--rich-text-placeholder": string }>(() => ({ "--rich-text-placeholder": JSON.stringify(placeholder) }), [placeholder]);
	function save() {
		if (!editor || !(replyAgent ? getTextWithoutAgentMention(editor, replyAgent.name) : editor.getText().trim())) return;
		const mentionedAgentIds: string[] = [];
		editor.state.doc.descendants((node) => {
			if (node.type.name === "mention" && node.attrs.category === "subagent" && typeof node.attrs.id === "string") mentionedAgentIds.push(node.attrs.id);
		});
		onSave(editor.getMarkdown(), editor.getText(), mentionedAgentIds);
	}
	return (
		<FloatingComposer
			animateInputContext
			actions={<RovoComposerActionButton canSubmit={contentState?.canSubmit ?? false} composerStatus="ready" dictationState={voice.dictationState} dictationTranscriptPreview={voice.dictationTranscriptPreview} micStream={voice.micStream} onStartDictation={voice.onStartDictation} onStop={voice.onStopDictation} onStopDictation={voice.onStopDictation} showSubmitWhenEmpty size="icon-sm" />}
			addButton={
				<PromptInputButton aria-label="Mention an agent or person" disabled={!editor} onClick={() => editor?.chain().focus().insertContent("@").run()} size="icon-sm" variant="ghost">
					<AddIcon label="" />
				</PromptInputButton>
			}
			aria-label={ariaLabel}
			className={cn(elevation === "flat" ? "shadow-none" : undefined, mentionHandoffPending && "[&_[contenteditable]]:caret-transparent")}
			data-project-butter-comment-editor
			data-mention-handoff={mentionHandoffPending ? "pending" : "settled"}
			inputContext={inputContext}
			onSubmit={() => save()}
		>
			<EditorContent className="rich-text-editor-content rich-text-mention-caret max-h-48 min-h-6 w-full min-w-0 overflow-y-auto [&_.rich-text-mention-chip]:text-[length:inherit]" data-empty={contentState?.isEmpty ? "true" : undefined} data-instruction-placeholder={contentState?.showInstructionPlaceholder && !dismissedInstructionPlaceholder || undefined} editor={editor} style={placeholderStyle} />
		</FloatingComposer>
	);
}
