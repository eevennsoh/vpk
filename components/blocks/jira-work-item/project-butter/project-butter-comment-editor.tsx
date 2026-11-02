"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { motion, useReducedMotion } from "motion/react";
import CloseIcon from "@atlaskit/icon/core/close";
import MicrophoneIcon from "@atlaskit/icon/core/microphone";
import SendIcon from "@atlaskit/icon/core/send";
import StopIcon from "@atlaskit/icon/core/video-stop";
import { EditorToolbar } from "@/components/blocks/editor-toolbar";
import { JiraCommentEditorToolbarLeading } from "@/components/blocks/jira-activity/jira-activity-composer";
import { useJiraActivityComposerDictation } from "@/components/blocks/jira-activity/use-jira-activity-composer-dictation";
import { useCommentEditorResize } from "@/components/blocks/jira-work-item/project-butter/use-comment-editor-resize";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { createRichTextEditorExtensions } from "@/components/ui-custom/rich-text-editor";
import "@/components/ui-custom/rich-text-editor/rich-text-editor.css";
import { motionDuration, motionEase } from "@/lib/motion";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

const placeholderStyle: CSSProperties & { "--rich-text-placeholder": string } = { "--rich-text-placeholder": JSON.stringify("Type /ai to ask Rovo or @ to mention someone…") };

export function ProjectButterCommentEditor({ onCancel, onSave, onValueChange, value }: Readonly<{
	onCancel: () => void;
	onSave: (body: string) => void;
	onValueChange: (body: string) => void;
	value: string;
}>) {
	const { editorRef, height, maximumHeight, resizeProps, resizing } = useCommentEditorResize();
	const reducedMotion = useReducedMotion();
	const cueShown = useRef(false);
	const [cue, setCue] = useState(false);
	const voice = useJiraActivityComposerDictation({ value, onValueChange });
	const editor = useEditor({
		extensions: createRichTextEditorExtensions(), content: value, contentType: "markdown", immediatelyRender: false,
		editorProps: {
			attributes: { role: "textbox", "aria-label": "Comment editor", class: "tiptap-editor min-h-8! py-0! text-sm leading-6 outline-none" },
			handleKeyDown: (_view, event) => {
				if (event.isComposing) return false;
				if (event.key === "Escape" && !document.querySelector("[data-suggestion-option]")) { event.preventDefault(); event.stopPropagation(); onCancel(); return true; }
				if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); event.stopPropagation(); save(); return true; }
				return false;
			},
		},
		onCreate: ({ editor: activeEditor }) => activeEditor.commands.focus("end", { scrollIntoView: false }),
		onUpdate: ({ editor: activeEditor }) => {
			onValueChange(activeEditor.getMarkdown());
			const lineHeight = Number.parseFloat(getComputedStyle(activeEditor.view.dom).lineHeight) || 24;
			if (!cueShown.current && activeEditor.view.dom.scrollHeight >= lineHeight * 5) { cueShown.current = true; setCue(true); }
		},
	});
	useEffect(() => { if (editor && editor.getMarkdown() !== value) editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false }); }, [editor, value]);
	function save() { if (editor?.getText().trim()) onSave(editor.getMarkdown()); }
	return (
		<form aria-label="Comment editor" className="relative flex min-h-36 max-h-[min(60vh,480px)] flex-col rounded-xl bg-surface" data-project-butter-comment-editor onKeyDownCapture={(event) => { if (event.key === "Escape" && !event.defaultPrevented && event.target instanceof Element && !event.target.closest("[role=textbox], [role=menu], [role=listbox]")) { event.preventDefault(); event.stopPropagation(); onCancel(); } }} onSubmit={(event) => { event.preventDefault(); save(); }} ref={editorRef} style={{ height, userSelect: resizing ? "none" : undefined, boxShadow: token("elevation.shadow.raised") }}>
			<div {...resizeProps} aria-label="Resize comment editor" aria-orientation="horizontal" aria-valuemin={144} aria-valuemax={maximumHeight} aria-valuenow={Math.round(height ?? 144)} className="group/resize absolute inset-x-0 top-0 z-20 flex h-4 cursor-row-resize touch-none justify-center outline-none" role="separator" tabIndex={0}>
				<motion.span animate={{ opacity: cue && !reducedMotion ? [0, 1, 1, 0] : 0 }} className={cn("pointer-events-none h-0.5 w-2/5 -translate-y-full bg-border-focused group-hover/resize:opacity-100! group-focus-visible/resize:opacity-100!", resizing && "opacity-100!")} onAnimationComplete={() => setCue(false)} transition={{ duration: motionDuration.slower * 5, ease: motionEase.out, times: [0, 0.2, 0.8, 1] }} />
			</div>
			{editor ? <EditorToolbar className="min-h-12 shrink-0 rounded-t-xl border-b border-border bg-surface-raised" controlsOverflow="responsive" editor={editor} endSlot={<Button aria-label="Close comment editor" onClick={onCancel} size="icon-compact" type="button" variant="ghost"><CloseIcon label="" size="small" /></Button>} leadingSlot={<JiraCommentEditorToolbarLeading editor={editor} />} /> : <div className="h-12 shrink-0" />}
			<EditorContent className="rich-text-editor-content min-h-0 flex-1 overflow-y-auto px-4 py-3" data-empty={editor?.isEmpty ? "true" : undefined} editor={editor} style={placeholderStyle} />
			<div className="flex shrink-0 items-center justify-end gap-1 px-4 pb-3">
				<Button aria-label={voice.dictationState === "recording" ? "Stop recording" : "Start voice input"} disabled={voice.dictationState === "processing"} onClick={voice.dictationState === "recording" ? voice.onStopDictation : voice.onStartDictation} size="icon-compact" type="button" variant="ghost">{voice.dictationState === "processing" ? <Spinner size="sm" /> : voice.dictationState === "recording" ? <StopIcon label="" size="small" /> : <MicrophoneIcon label="" size="small" />}</Button>
				<Button aria-label="Save comment" disabled={!editor?.getText().trim() || voice.dictationState !== "idle"} size="icon-compact" type="submit"><SendIcon label="" size="small" /></Button>
			</div>
		</form>
	);
}
