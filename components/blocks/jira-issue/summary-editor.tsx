"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { motion, useIsPresent, useReducedMotion } from "motion/react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CrossIcon from "@atlaskit/icon/core/cross";

import { useHasVerticalOverflow } from "@/components/hooks/use-has-vertical-overflow";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { buildScrollMaskStyle } from "@/components/visual/scroll-mask/lib";
import { motionRecipe } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { JiraIssueAppearance, JiraIssueCardMetadata } from "./types";
import { ProjectButterIssueKey } from "./project-butter-summary";

const SUMMARY_LIMIT = 255;
const EDITOR_TEXT_CLASS = "box-border w-full whitespace-pre-wrap break-words px-0 py-0 text-sm leading-5 [overflow-wrap:anywhere]";

export function useJiraIssueSummaryEdit({ anchor, appearance, issueKey, issueType, summary, onSummaryChange, onEditingChange }: Readonly<{
	anchor: HTMLElement | null;
	appearance: JiraIssueAppearance;
	issueKey: string;
	issueType: NonNullable<JiraIssueCardMetadata["issueType"]>;
	summary: string;
	onSummaryChange?: (summary: string) => void;
	onEditingChange?: (editing: boolean) => void;
}>) {
	const [session, setSession] = useState<number | null>(null);
	const nextSessionRef = useRef(0);
	const focusParentRef = useRef<HTMLElement | null>(null);
	const editingRef = useRef(false);
	const onEditingChangeRef = useRef(onEditingChange);
	useEffect(() => { onEditingChangeRef.current = onEditingChange; }, [onEditingChange]);
	useEffect(() => () => { if (editingRef.current) onEditingChangeRef.current?.(false); }, []);

	const start = useCallback(() => {
		focusParentRef.current = anchor?.parentElement ?? null;
		editingRef.current = true;
		setSession(++nextSessionRef.current);
		onEditingChangeRef.current?.(true);
	}, [anchor]);
	const finish = useCallback((nextSummary?: string) => {
		if (nextSummary !== undefined) onSummaryChange?.(nextSummary);
		editingRef.current = false;
		setSession(null);
		onEditingChangeRef.current?.(false);
		requestAnimationFrame(() => {
			if (!editingRef.current) focusParentRef.current?.querySelector<HTMLElement>('button[aria-label^="More actions for "]')?.focus({ preventScroll: true });
		});
	}, [onSummaryChange]);

	return {
		start: onSummaryChange ? start : undefined,
		active: session !== null,
		session,
		editor: session !== null ? <JiraIssueSummaryEditor appearance={appearance} issueKey={issueKey} issueType={issueType} summary={summary} onCancel={() => finish()} onSave={finish} /> : null,
	};
}

export function JiraIssueSummaryEditor({ appearance = "project-butter", issueKey, issueType, summary, onCancel, onSave }: Readonly<{
	appearance?: JiraIssueAppearance;
	issueKey: string;
	issueType: NonNullable<JiraIssueCardMetadata["issueType"]>;
	summary: string;
	onCancel: () => void;
	onSave: (summary: string) => void;
}>) {
	const [draft, setDraft] = useState(summary);
	const editorRef = useRef<HTMLTextAreaElement>(null);
	const mirrorRef = useRef<HTMLDivElement>(null);
	const formRef = useRef<HTMLFormElement>(null);
	const { ref: overflowRef, scrollbarWidth, showBottomScrollMask } = useHasVerticalOverflow<HTMLTextAreaElement>({ bottomTolerance: 2, trackInput: true, trackScrollbarWidth: true });
	const setEditorRef = useCallback((node: HTMLTextAreaElement | null) => {
		editorRef.current = node;
		overflowRef(node);
	}, [overflowRef]);
	const isPresent = useIsPresent();
	const reduceMotion = useReducedMotion();
	const editorId = useId();
	const descriptionId = useId();
	const tooLong = draft.length > SUMMARY_LIMIT;
	const canSave = draft.trim().length > 0 && !tooLong;
	const boundary = tooLong && draft.charCodeAt(SUMMARY_LIMIT) >= 0xdc00 && draft.charCodeAt(SUMMARY_LIMIT) <= 0xdfff
		&& draft.charCodeAt(SUMMARY_LIMIT - 1) >= 0xd800 && draft.charCodeAt(SUMMARY_LIMIT - 1) <= 0xdbff
		? SUMMARY_LIMIT - 1 : SUMMARY_LIMIT;

	useEffect(() => {
		const editor = editorRef.current;
		if (!editor) return;
		editor.focus({ preventScroll: true });
		editor.setSelectionRange(editor.value.length, editor.value.length);
		editor.scrollTop = editor.scrollHeight;
		if (mirrorRef.current) mirrorRef.current.scrollTop = editor.scrollTop;
	}, []);

	useEffect(() => {
		if (!isPresent) return;
		function onOutsidePointerDown(event: PointerEvent) {
			if (event.target instanceof Node && !formRef.current?.contains(event.target)) {
				event.preventDefault();
				event.stopPropagation();
				const suppressClick = (click: MouseEvent) => { click.preventDefault(); click.stopPropagation(); };
				document.addEventListener("click", suppressClick, { capture: true, once: true });
				window.setTimeout(() => document.removeEventListener("click", suppressClick, true), 1000);
				onCancel();
			}
		}
		document.addEventListener("pointerdown", onOutsidePointerDown, true);
		return () => document.removeEventListener("pointerdown", onOutsidePointerDown, true);
	}, [isPresent, onCancel]);

	return (
		<form
			ref={formRef}
			aria-hidden={!isPresent || undefined}
			inert={!isPresent || undefined}
			className={cn("flex min-w-0 flex-1 flex-col px-3 pt-3 pb-3 text-left", isPresent ? "pointer-events-auto" : "pointer-events-none")}
			data-slot="jira-issue-summary-editor"
			onSubmit={(event) => {
				event.preventDefault();
				if (canSave) onSave(draft.trim());
			}}
		>
			<div className={cn("min-w-0", !isPresent && "invisible")}>
				{appearance === "project-butter" ? <div className="flex min-h-6 items-center"><ProjectButterIssueKey issueKey={issueKey} issueType={issueType} /></div> : null}
				<div className={cn("relative min-w-0", appearance === "project-butter" ? "mt-0.5" : "mr-8")} style={buildScrollMaskStyle({ fadeSize: "3rem", fadeTop: false, fadeBottom: showBottomScrollMask, scrollbarWidth })}>
					<label className="sr-only" htmlFor={editorId}>Summary for {issueKey}</label>
					<div ref={mirrorRef} aria-hidden="true" className={cn(EDITOR_TEXT_CLASS, "pointer-events-none absolute inset-0 overflow-y-auto text-transparent [scrollbar-color:transparent_transparent]")}>
						{draft.slice(0, boundary)}<span className="bg-bg-danger-subtler">{draft.slice(boundary)}</span>{" "}
					</div>
					<Textarea
						ref={setEditorRef}
						variant="none"
						id={editorId}
						aria-describedby={descriptionId}
						aria-invalid={tooLong || undefined}
						className={cn(EDITOR_TEXT_CLASS, "relative block h-auto min-h-5 max-h-40 resize-none overflow-y-auto bg-transparent outline-none focus-visible:outline-none focus-visible:ring-0 aria-invalid:ring-0")}
						rows={1}
						value={draft}
						onChange={(event) => setDraft(event.target.value.replace(/[\r\n]+/gu, " "))}
						onScroll={(event) => { if (mirrorRef.current) mirrorRef.current.scrollTop = event.currentTarget.scrollTop; }}
						onKeyDown={(event) => {
							if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
							if (event.key === "Enter") {
								event.preventDefault();
								event.stopPropagation();
								if (canSave) onSave(draft.trim());
							} else if (event.key === "Escape") {
								event.preventDefault();
								event.stopPropagation();
								onCancel();
							}
						}}
					/>
				</div>
			</div>
			<motion.div
				className="mt-auto flex items-center justify-between gap-2 pt-3"
				initial={reduceMotion ? false : { opacity: 0, transform: "translateY(8px)" }}
				animate={{ opacity: 1, transform: "translateY(0px)" }}
				exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, transform: "translateY(8px)", transition: motionRecipe.popup.exit }}
				transition={motionRecipe.popup.enter}
				style={{ willChange: "opacity, transform" }}
			>
				<span id={descriptionId} className="text-xs leading-4 text-text-subtle">
					{tooLong ? <span className="text-text-danger">-{draft.length - SUMMARY_LIMIT}</span> : draft.length}/{SUMMARY_LIMIT}<span className="sr-only">{tooLong ? `, ${draft.length - SUMMARY_LIMIT} characters over the limit` : " characters"}</span>
				</span>
				<span className="sr-only" role="status">{tooLong ? "Summary exceeds the 255 character limit." : ""}</span>
				<div className="flex gap-1">
					<Button aria-label="Cancel summary edit" size="icon-compact" type="button" variant="outline" onClick={onCancel}><CrossIcon label="" size="small" /></Button>
					<Button aria-label="Save summary" disabled={!canSave} size="icon-compact" type="submit" variant="outline"><CheckMarkIcon label="" size="small" /></Button>
				</div>
			</motion.div>
		</form>
	);
}
