"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, useState, type CSSProperties, type Ref } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { motion, useReducedMotion } from "motion/react";
import CloseIcon from "@atlaskit/icon/core/close";
import { EditorToolbar } from "@/components/blocks/editor-toolbar";
import { JiraCommentEditorToolbarLeading } from "@/components/blocks/jira-activity/jira-activity-composer";
import { useJiraActivityComposerDictation } from "@/components/blocks/jira-activity/use-jira-activity-composer-dictation";
import { EDITOR_PALETTE_MENTION_SOURCES, mapAgentToMentionItem } from "@/components/blocks/editor-palette/data/mention-sources";
import type { AgentBrowserAgent } from "@/components/blocks/agent-browser";
import { useCommentEditorResize } from "@/components/blocks/jira-work-item/project-butter/use-comment-editor-resize";
import { RovoComposerActionButton } from "@/components/projects/shared/components/rovo-composer-send-controls";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { createRichTextEditorExtensions } from "@/components/ui-custom/rich-text-editor";
import "@/components/ui-custom/rich-text-editor/rich-text-editor.css";
import { motionDuration, motionEase } from "@/lib/motion";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

const placeholderStyle: CSSProperties & { "--rich-text-placeholder": string } = { "--rich-text-placeholder": JSON.stringify("Type /ai to ask Rovo or @ to mention someone…") };

export interface ProjectButterCommentEditorHandle {
	getDraftWithoutAgentMention: (name: string) => string;
	revertAgentMention: (name: string) => void;
}

export function ProjectButterCommentEditor({ agents, focusRequest, newSession, onCancel, onMentionChange, onResetSessionTarget, onSave, onValueChange, ref, value }: Readonly<{
	agents: readonly AgentBrowserAgent[];
	focusRequest: number;
	newSession: boolean;
	onCancel: () => void;
	onMentionChange: (agentNames: string[], hasMentions: boolean) => void;
	onResetSessionTarget: () => void;
	onSave: (body: string, plainText: string) => void;
	onValueChange: (body: string) => void;
	ref?: Ref<ProjectButterCommentEditorHandle>;
	value: string;
}>) {
	const { editorRef, height, maximumHeight, resizeProps, resizing } = useCommentEditorResize();
	const lastEditorValue = useRef(value);
	const reducedMotion = useReducedMotion();
	const cueShown = useRef(false);
	const [cue, setCue] = useState(false);
	const voice = useJiraActivityComposerDictation({ value, onValueChange });
	const extensions = useMemo(() => createRichTextEditorExtensions({ getMentionSources: () => ({ ...EDITOR_PALETTE_MENTION_SOURCES, subagent: agents.map(mapAgentToMentionItem) }), suggestionVariant: { mention: "flat", command: "flat" }, mentionSectionLabels: { subagent: "Agents" }, anchorToInput: true }), [agents]);
	const editor = useEditor({
		extensions, content: value, contentType: "markdown", immediatelyRender: false,
		editorProps: {
			attributes: { role: "textbox", "aria-label": "Comment editor", class: "tiptap-editor min-h-8! py-0! text-sm leading-6 outline-none" },
			handleKeyDown: (_view, event) => {
				if (event.isComposing) return false;
				if (event.key === "Escape" && !document.querySelector("[data-suggestion-option]")) { event.preventDefault(); event.stopPropagation(); onCancel(); return true; }
				if (event.key === "Enter" && !event.shiftKey && !document.querySelector("[data-suggestion-option]")) { event.preventDefault(); event.stopPropagation(); save(); return true; }
				return false;
			},
		},
		onCreate: ({ editor: activeEditor }) => activeEditor.commands.focus("end", { scrollIntoView: false }),
		onUpdate: ({ editor: activeEditor }) => {
			const markdown = activeEditor.getMarkdown();
			lastEditorValue.current = markdown;
			onValueChange(markdown);
			const names: string[] = [];
			let hasMentions = false;
			activeEditor.state.doc.descendants((node) => {
				if (node.type.name !== "mention") return;
				hasMentions = true;
				if (node.attrs.category === "subagent" && typeof node.attrs.label === "string") names.push(node.attrs.label);
			});
			onMentionChange(names, hasMentions);
			const lineHeight = Number.parseFloat(getComputedStyle(activeEditor.view.dom).lineHeight) || 24;
			if (!cueShown.current && activeEditor.view.dom.scrollHeight >= lineHeight * 5) { cueShown.current = true; setCue(true); }
		},
	});
	useImperativeHandle(ref, () => ({
		getDraftWithoutAgentMention(name) {
			return editor?.getText({ textSerializers: { mention: ({ node }) => node.attrs.category === "subagent" && node.attrs.label === name ? "" : `@${node.attrs.label ?? node.attrs.id}` } }).trim() ?? "";
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
	function save() { if (editor?.getText().trim()) onSave(editor.getMarkdown(), editor.getText()); }
	return (
		<form aria-label="Comment editor" className="relative flex min-h-36 max-h-[min(60vh,480px)] flex-col rounded-xl bg-surface" data-project-butter-comment-editor onKeyDownCapture={(event) => { if (event.key === "Escape" && !event.defaultPrevented && event.target instanceof Element && !event.target.closest("[role=textbox], [role=menu], [role=listbox]")) { event.preventDefault(); event.stopPropagation(); onCancel(); } }} onSubmit={(event) => { event.preventDefault(); save(); }} ref={editorRef} style={{ height, userSelect: resizing ? "none" : undefined, boxShadow: token("elevation.shadow.raised") }}>
			<div {...resizeProps} aria-label="Resize comment editor" aria-orientation="horizontal" aria-valuemin={144} aria-valuemax={maximumHeight} aria-valuenow={Math.round(height ?? 144)} className="group/resize absolute inset-x-0 top-0 z-20 flex h-4 cursor-row-resize touch-none justify-center outline-none" role="separator" tabIndex={0}>
				<motion.span animate={{ opacity: cue && !reducedMotion ? [0, 1, 1, 0] : 0 }} className={cn("pointer-events-none h-0.5 w-2/5 -translate-y-full bg-border-focused group-hover/resize:opacity-100! group-focus-visible/resize:opacity-100!", resizing && "opacity-100!")} onAnimationComplete={() => setCue(false)} transition={{ duration: motionDuration.slower * 5, ease: motionEase.out, times: [0, 0.2, 0.8, 1] }} />
			</div>
			{editor ? <EditorToolbar className="min-h-12 shrink-0 rounded-t-xl border-b border-border bg-surface-raised px-3" controlsOverflow="responsive" editor={editor} endSlot={<Button aria-label="Close comment editor" onClick={onCancel} size="icon-compact" type="button" variant="ghost"><CloseIcon label="" size="small" /></Button>} leadingSlot={<JiraCommentEditorToolbarLeading editor={editor} />} /> : <div className="h-12 shrink-0" />}
			<EditorContent className="rich-text-editor-content min-h-0 flex-1 overflow-y-auto px-4 py-3 [&_.react-renderer.node-mention]:inline-flex [&_.react-renderer.node-mention]:h-lh [&_.react-renderer.node-mention]:items-center [&_.react-renderer.node-mention]:align-middle [&_.rich-text-mention-node]:h-lh [&_.rich-text-mention-node]:items-center [&_.rich-text-mention-chip]:text-[length:inherit]" data-empty={editor?.isEmpty ? "true" : undefined} editor={editor} style={placeholderStyle} />
			<div className="flex shrink-0 items-center justify-end gap-1 px-4 pb-3">
				{newSession ? <Tag color="gray" onRemove={onResetSessionTarget} removeButtonLabel="Choose agent session" shape="rounded">New session</Tag> : null}
				<RovoComposerActionButton canSubmit={Boolean(editor?.getText().trim())} composerStatus="ready" dictationState={voice.dictationState} dictationTranscriptPreview={voice.dictationTranscriptPreview} micStream={voice.micStream} onStartDictation={voice.onStartDictation} onStop={voice.onStopDictation} onStopDictation={voice.onStopDictation} showSubmitWhenEmpty />
			</div>
		</form>
	);
}
