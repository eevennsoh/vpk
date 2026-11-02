"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { createCommentEntry } from "@/components/blocks/jira-activity/lib/jira-activity-reducer";
import { PROJECT_BUTTER_CURRENT_USER } from "@/components/blocks/jira-work-item/project-butter/activity-data";
import { ProjectButterCommentEditor } from "@/components/blocks/jira-work-item/project-butter/project-butter-comment-editor";
import { useCommentBarVisibility } from "@/components/blocks/jira-work-item/project-butter/use-comment-bar-visibility";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import { Kbd } from "@/components/ui/kbd";
import { motionDuration, referenceEase } from "@/lib/motion";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

export function ProjectButterCommentBar({ active, content, empty, sidePanel }: Readonly<{ active: boolean; content: ProjectButterContent; empty: boolean; sidePanel: boolean }>) {
	const [expanded, setExpanded] = useState(false);
	const { setCommentDraft } = content;
	const reducedMotion = useReducedMotion();
	const { barRef, elevated, inActivity, revealActivity } = useCommentBarVisibility(active, empty, sidePanel);
	const visible = active && (empty || expanded || inActivity);
	function cancel() { setExpanded(false); content.setCommentDraft(""); }
	useEffect(() => {
		if (!active) return;
		function onKeyDown(event: KeyboardEvent) {
			if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.key.toLowerCase() !== "m") return;
			if (event.target instanceof Element && (
				event.target.closest<HTMLElement>("[contenteditable]")?.isContentEditable ||
				event.target.closest("input, textarea, select, [role=combobox], [role=menuitem], [role=option], [role=slider]")
			)) return;
			event.preventDefault(); revealActivity(); setExpanded(true);
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [active, revealActivity]);
	useEffect(() => {
		if (!expanded) return;
		function onOutside(event: PointerEvent) {
			if (!(event.target instanceof Element) || barRef.current?.contains(event.target) || event.target.closest("[data-suggestion-option], [role=listbox], [role=menu], [data-slot=popover-content]")) return;
			setExpanded(false); setCommentDraft("");
		}
		document.addEventListener("pointerdown", onOutside);
		return () => document.removeEventListener("pointerdown", onOutside);
	}, [barRef, setCommentDraft, expanded]);
	function submit(body: string) {
		const entry = { ...createCommentEntry({ id: crypto.randomUUID(), actor: PROJECT_BUTTER_CURRENT_USER, body, timestamp: "Just now" }), createdAtMs: Date.now() };
		content.setActivityEntries((entries) => [...entries, entry]); content.setActivityView("Activity"); content.setActivityFocusId(entry.id); cancel();
	}
	return (
		<motion.div animate={{ opacity: visible ? 1 : 0, transform: visible || sidePanel || empty ? "translateY(0%)" : "translateY(100%)" }} aria-hidden={!visible} aria-label="Comment editor" className="sticky bottom-4 z-30 mt-4 rounded-xl bg-surface" data-elevated={elevated} data-project-butter-comment-bar data-visible={visible} inert={!visible} initial={false} ref={barRef} role="group" style={{ pointerEvents: visible ? "auto" : "none", boxShadow: expanded || empty || (sidePanel && !elevated) ? undefined : token("elevation.shadow.overlay") }} transition={{ duration: reducedMotion ? 0 : motionDuration.normal * 2, ease: referenceEase.workItemCommentReveal }}>
			{expanded ? <ProjectButterCommentEditor onCancel={cancel} onSave={submit} onValueChange={content.setCommentDraft} value={content.commentDraft} /> : <button aria-label="Add a comment" className={cn("flex min-h-12 w-full items-center gap-2 rounded-xl px-4 text-left text-sm text-text-subtle outline-none focus-visible:ring-2 focus-visible:ring-ring", empty || (sidePanel && !elevated) ? "bg-bg-input hover:bg-bg-input-hovered" : "bg-surface")} onClick={() => setExpanded(true)} type="button"><span>Add a comment or press</span><Kbd>M</Kbd></button>}
		</motion.div>
	);
}
