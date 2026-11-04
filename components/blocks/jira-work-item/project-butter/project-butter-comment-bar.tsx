"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { DEMO_AGENT_BROWSER_AGENTS } from "@/app/data/directory";
import { AGENT_LANYARD_AGENTS } from "@/components/blocks/agent-lanyard/data";
import { AGENT_LANYARD_FIRST_PARTY_AGENTS } from "@/components/blocks/agent-lanyard/first-party-data";
import { AgentSessionTargetMenu } from "@/components/blocks/agent-assignment/components/agent-session-target-menu";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import { createCommentEntry } from "@/components/blocks/jira-activity/lib/jira-activity-reducer";
import { PROJECT_BUTTER_CURRENT_USER } from "@/components/blocks/jira-work-item/project-butter/activity-data";
import { ProjectButterCommentEditor } from "@/components/blocks/jira-work-item/project-butter/project-butter-comment-editor";
import { useCommentBarVisibility } from "@/components/blocks/jira-work-item/project-butter/use-comment-bar-visibility";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import type { ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";
import { Kbd } from "@/components/ui/kbd";
import { motionDuration, referenceEase } from "@/lib/motion";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

export function ProjectButterCommentBar({ active, compact, content, empty, onOpenSession, onStartAgent, sessions, sidePanel }: Readonly<{ active: boolean; compact: boolean; content: ProjectButterContent; empty: boolean; onOpenSession: (id: string) => void; onStartAgent: (agent: AgentSessionItem["agent"], prompt: string) => void; sessions: readonly ProjectButterSessionItem[]; sidePanel: boolean }>) {
	const [expanded, setExpanded] = useState(false);
	const [mentions, setMentions] = useState<string[]>([]);
	const [hasMentions, setHasMentions] = useState(false);
	const [focusRequest, setFocusRequest] = useState(0);
	const [target, setTarget] = useState<{ sessionId: string; choice: "new" | "continue" | "dismissed" } | null>(null);
	const agents = useMemo(() => [...sessions.map((session) => ({ ...session.agent, id: session.agent.id ?? session.id, byline: "Agent on this work item" })), ...[...AGENT_LANYARD_AGENTS, ...AGENT_LANYARD_FIRST_PARTY_AGENTS].map((agent) => ({ ...agent, byline: agent.publisher })), ...DEMO_AGENT_BROWSER_AGENTS].filter((agent, index, all) => all.findIndex((candidate) => candidate.name.toLowerCase() === agent.name.toLowerCase()) === index), [sessions]);
	const mentionedAgent = mentions.length === 1 ? agents.find((agent) => agent.name === mentions[0]) : undefined;
	const existingSession = mentionedAgent ? [...sessions].reverse().find((session) => session.host !== "local" && (session.state === "running" || session.state === "needs-input") && session.agent.name === mentionedAgent.name) : undefined;
	const showTargetMenu = Boolean(existingSession && target?.sessionId !== existingSession.id);
	const { setCommentDraft } = content;
	const reducedMotion = useReducedMotion();
	const { barRef, elevated, inActivity, revealActivity } = useCommentBarVisibility(active, empty, sidePanel);
	const visible = active && (empty || expanded || inActivity);
	function cancel() { setExpanded(false); content.setCommentDraft(""); setMentions([]); setHasMentions(false); setTarget(null); }
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
			setExpanded(false); setCommentDraft(""); setMentions([]); setHasMentions(false); setTarget(null);
		}
		document.addEventListener("pointerdown", onOutside);
		return () => document.removeEventListener("pointerdown", onOutside);
	}, [barRef, setCommentDraft, expanded]);
	function submit(body: string, plainText: string) {
		if (showTargetMenu) return;
		if (existingSession && target?.sessionId === existingSession.id && target.choice === "dismissed") {
			setTarget(null);
			return;
		}
		if (existingSession && target?.sessionId === existingSession.id && target.choice === "continue") {
			onOpenSession(existingSession.id);
			return;
		}
		if (mentionedAgent) {
			onStartAgent(mentionedAgent, plainText);
			cancel();
			return;
		}
		const entry = { ...createCommentEntry({ id: crypto.randomUUID(), actor: PROJECT_BUTTER_CURRENT_USER, body: hasMentions ? plainText : body, timestamp: "Just now" }), createdAtMs: Date.now() };
		content.setActivityEntries((entries) => [...entries, entry]); content.setActivityView("Activity"); content.setActivityFocusId(entry.id); cancel();
	}
	return (
		<motion.div animate={{ opacity: visible ? 1 : 0, transform: visible || sidePanel || empty ? "translateY(0%)" : "translateY(100%)" }} aria-hidden={!visible} aria-label="Comment editor" className={cn("sticky bottom-6 z-30 rounded-xl bg-surface", !sidePanel && "@[860px]/butter:bottom-0", compact ? "-mt-4" : "mt-4")} data-elevated={elevated} data-project-butter-comment-bar data-visible={visible} inert={!visible} initial={false} ref={barRef} role="group" style={{ pointerEvents: visible ? "auto" : "none" }} transition={{ duration: reducedMotion ? 0 : motionDuration.fast, ease: referenceEase.workItemCommentReveal }}>
			{visible && elevated ? <span aria-hidden="true" className="absolute -inset-x-6 -bottom-6 top-0 -z-10 bg-surface" data-project-butter-comment-backdrop /> : null}
			{expanded ? <>
				{showTargetMenu && existingSession ? <div className="absolute inset-x-0 bottom-full z-20 mb-2 rounded-xl bg-surface-raised p-1" style={{ boxShadow: token("elevation.shadow.overlay") }}><AgentSessionTargetMenu onBack={() => { setTarget({ sessionId: existingSession.id, choice: "dismissed" }); setFocusRequest((value) => value + 1); }} onChoose={(choice) => { setTarget({ sessionId: existingSession.id, choice }); if (choice === "continue") onOpenSession(existingSession.id); else setFocusRequest((value) => value + 1); }} /></div> : null}
				<ProjectButterCommentEditor agents={agents} focusRequest={focusRequest} newSession={Boolean(existingSession && target?.sessionId === existingSession.id && target.choice === "new")} onCancel={cancel} onMentionChange={(names, hasAny) => { setMentions(names); setHasMentions(hasAny); if (!names.includes(mentionedAgent?.name ?? "")) setTarget(null); }} onResetSessionTarget={() => setTarget(null)} onSave={submit} onValueChange={content.setCommentDraft} value={content.commentDraft} />
			</> : <button aria-label="Add a comment" className={cn("relative flex min-h-12 w-full items-center gap-2 rounded-xl px-4 text-left text-sm text-text-subtle outline-none focus-visible:ring-2 focus-visible:ring-ring", empty ? "bg-bg-input inset-ring inset-ring-border hover:bg-bg-input-hovered" : sidePanel && !elevated ? "bg-bg-input hover:bg-bg-input-hovered" : "bg-surface")} onClick={() => setExpanded(true)} style={{ boxShadow: empty || (sidePanel && !elevated) ? undefined : token("elevation.shadow.overlay") }} type="button"><span>Add a comment or press</span><Kbd>M</Kbd></button>}
		</motion.div>
	);
}
