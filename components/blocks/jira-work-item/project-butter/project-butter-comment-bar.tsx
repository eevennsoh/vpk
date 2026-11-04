"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import AddIcon from "@atlaskit/icon/core/add";
import AiChatIcon from "@atlaskit/icon/core/ai-chat";
import { DEMO_AGENT_BROWSER_AGENTS } from "@/app/data/directory";
import { AGENT_LANYARD_AGENTS } from "@/components/blocks/agent-lanyard/data";
import { AGENT_LANYARD_FIRST_PARTY_AGENTS } from "@/components/blocks/agent-lanyard/first-party-data";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import { matchingAgentSessions, sessionChoiceItems } from "@/components/blocks/agent-assignment/components/session-choice-items";
import { BUTTER_PRIMARY_BOARD_AGENTS } from "@/components/blocks/jira-issue/project-butter-agent-catalog";
import { createCommentEntry } from "@/components/blocks/jira-activity/lib/jira-activity-reducer";
import { ProjectButterCommentEditor, type ProjectButterCommentEditorHandle } from "@/components/blocks/jira-work-item/project-butter/project-butter-comment-editor";
import { useCommentBarVisibility } from "@/components/blocks/jira-work-item/project-butter/use-comment-bar-visibility";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import type { ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";
import { Kbd } from "@/components/ui/kbd";
import { RichTextSuggestionMenu, type RichTextSuggestionMenuItem } from "@/components/ui-custom/rich-text-editor";
import { motionDuration, referenceEase } from "@/lib/motion";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

const SESSION_TARGET_MENU_ITEMS = [
	{ id: "continue", label: "Continue in existing session", icon: <AiChatIcon label="" size="small" /> },
	{ id: "new", label: "Start a new session", icon: <AddIcon label="" size="small" /> },
] satisfies readonly RichTextSuggestionMenuItem[];

export function ProjectButterCommentBar({ active, compact, content, empty, onOpenSession, onPreviewSession, onStartAgent, sessions, sidePanel }: Readonly<{ active: boolean; compact: boolean; content: ProjectButterContent; empty: boolean; onOpenSession: (id: string, draft?: string) => boolean | void | Promise<boolean | void>; onPreviewSession: (id: string | null) => void; onStartAgent: (agent: AgentSessionItem["agent"], prompt: string) => void; sessions: readonly ProjectButterSessionItem[]; sidePanel: boolean }>) {
	const [expanded, setExpanded] = useState(false);
	const [mentions, setMentions] = useState<string[]>([]);
	const [hasMentions, setHasMentions] = useState(false);
	const [focusRequest, setFocusRequest] = useState(0);
	const [newSessionAgentName, setNewSessionAgentName] = useState<string | null>(null);
	const [selectedTargetIndex, setSelectedTargetIndex] = useState(0);
	const [choosingSession, setChoosingSession] = useState(false);
	const editorRef = useRef<ProjectButterCommentEditorHandle>(null);
	const openingSession = useRef(false);
	const currentDraft = useRef(content.commentDraft);
	const agents = useMemo(() => [...BUTTER_PRIMARY_BOARD_AGENTS, ...sessions.map((session) => ({ ...session.agent, id: session.agent.id ?? session.id, byline: "Agent on this work item" })), ...[...AGENT_LANYARD_AGENTS, ...AGENT_LANYARD_FIRST_PARTY_AGENTS].map((agent) => ({ ...agent, byline: agent.publisher })), ...DEMO_AGENT_BROWSER_AGENTS].filter((agent, index, all) => all.findIndex((candidate) => candidate.name.toLowerCase() === agent.name.toLowerCase()) === index), [sessions]);
	const mentionedAgent = mentions.length === 1 ? agents.find((agent) => agent.name === mentions[0]) : undefined;
	const matchingSessions = mentionedAgent ? matchingAgentSessions(mentionedAgent, sessions) : [];
	const existingSession = matchingSessions[0];
	const showTargetMenu = Boolean(existingSession && newSessionAgentName !== mentionedAgent?.name);
	const sessionItems = sessionChoiceItems(matchingSessions);
	const menuItems = choosingSession ? sessionItems : SESSION_TARGET_MENU_ITEMS;
	const selectedIndex = Math.min(selectedTargetIndex, Math.max(0, menuItems.length - 1));
	const reducedMotion = useReducedMotion();
	const { barRef, elevated, inActivity, revealActivity } = useCommentBarVisibility(active, empty, sidePanel);
	const visible = active && (empty || expanded || inActivity);
	function cancel() { currentDraft.current = ""; setExpanded(false); content.setCommentDraft(""); setMentions([]); setHasMentions(false); setNewSessionAgentName(null); setSelectedTargetIndex(0); setChoosingSession(false); onPreviewSession(null); }
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
			setExpanded(false); setMentions([]); setHasMentions(false); setNewSessionAgentName(null); setChoosingSession(false); onPreviewSession(null);
		}
		document.addEventListener("pointerdown", onOutside);
		return () => document.removeEventListener("pointerdown", onOutside);
	}, [barRef, expanded, onPreviewSession]);
	function submit(body: string, plainText: string) {
		if (showTargetMenu) return;
		if (mentionedAgent) {
			onStartAgent(mentionedAgent, plainText);
			cancel();
			return;
		}
		const entry = { ...createCommentEntry({ id: crypto.randomUUID(), actor: content.currentUser, body: hasMentions ? plainText : body, timestamp: "Just now" }), createdAtMs: Date.now() };
		content.setActivityEntries((entries) => [...entries, entry]); content.setActivityView("Activity"); content.setActivityFocusId(entry.id); cancel();
	}
	function chooseTarget(choice: "continue" | "new") {
		if (!existingSession) return;
		if (choice === "continue") {
			if (matchingSessions.length > 1) { setChoosingSession(true); setSelectedTargetIndex(0); }
			else openSelectedSession(existingSession);
		} else {
			setNewSessionAgentName(mentionedAgent?.name ?? null);
			setFocusRequest((value) => value + 1);
		}
	}
	async function openSelectedSession(session: ProjectButterSessionItem) {
		if (openingSession.current) return;
		openingSession.current = true;
		const previousDraft = currentDraft.current;
		const draft = mentionedAgent ? editorRef.current?.getDraftWithoutAgentMention(mentionedAgent.name) : undefined;
		try {
			const opened = await onOpenSession(session.id, draft || undefined);
			if (opened === false) toast.error("Could not open the session. Your comment is still here.");
			else if (currentDraft.current === previousDraft) cancel();
		} catch {
			toast.error("Could not open the session. Your comment is still here.");
		} finally {
			openingSession.current = false;
		}
	}
	function handleTargetKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
		if (!showTargetMenu || event.nativeEvent.isComposing) return;
		switch (event.key) {
			case "ArrowDown":
			case "ArrowUp":
				event.preventDefault(); event.stopPropagation();
				{
					const next = (selectedIndex + (event.key === "ArrowDown" ? 1 : -1) + menuItems.length) % menuItems.length;
					setSelectedTargetIndex(next);
					if (choosingSession && menuItems[next]) onPreviewSession(menuItems[next].id);
				}
				break;
			case "Enter":
			case "Tab":
				event.preventDefault(); event.stopPropagation();
				if (choosingSession) {
					const session = matchingSessions.find((item) => item.id === menuItems[selectedIndex]?.id);
					if (session) openSelectedSession(session);
				} else chooseTarget(menuItems[selectedIndex]?.id === "new" ? "new" : "continue");
				break;
			case "Escape":
				event.preventDefault(); event.stopPropagation();
				if (mentionedAgent) editorRef.current?.revertAgentMention(mentionedAgent.name);
				setNewSessionAgentName(null); setSelectedTargetIndex(0); setChoosingSession(false); onPreviewSession(null);
				break;
			default:
				break;
		}
	}
	return (
		<motion.div animate={{ opacity: visible ? 1 : 0, transform: visible || sidePanel || empty ? "translateY(0%)" : "translateY(100%)" }} aria-hidden={!visible} aria-label="Comment editor" className={cn("sticky bottom-6 z-30 rounded-xl bg-surface", !sidePanel && "@[860px]/butter:bottom-0", compact ? "-mt-4" : "mt-4")} data-elevated={elevated} data-project-butter-comment-bar data-visible={visible} inert={!visible} initial={false} onKeyDownCapture={handleTargetKeyDown} ref={barRef} role="group" style={{ pointerEvents: visible ? "auto" : "none" }} transition={{ duration: reducedMotion ? 0 : motionDuration.fast, ease: referenceEase.workItemCommentReveal }}>
			{visible && elevated ? <span aria-hidden="true" className="absolute -inset-x-6 -bottom-6 top-0 -z-10 bg-surface" data-project-butter-comment-backdrop /> : null}
			{expanded ? <>
				{showTargetMenu && existingSession ? <div className="absolute inset-x-0 bottom-full z-20 mb-2" data-project-butter-session-target-menu><RichTextSuggestionMenu className="rich-text-command-menu-borderless w-full!" emptyLabel="" items={menuItems} onHover={(index) => { setSelectedTargetIndex(index); if (choosingSession && menuItems[index]) onPreviewSession(menuItems[index].id); }} onHoverEnd={() => { if (choosingSession) onPreviewSession(null); }} onSelect={(item) => { if (choosingSession) { const session = matchingSessions.find((candidate) => candidate.id === item.id); if (session) openSelectedSession(session); } else chooseTarget(item.id === "new" ? "new" : "continue"); }} selectedIndex={selectedIndex} title={choosingSession ? "Choose a session" : "Choose agent session"} /></div> : null}
				<ProjectButterCommentEditor agents={agents} focusRequest={focusRequest} onCancel={cancel} onMentionChange={(names, hasAny) => { setMentions(names); setHasMentions(hasAny); if (!names.includes(mentionedAgent?.name ?? "")) { setNewSessionAgentName(null); setSelectedTargetIndex(0); setChoosingSession(false); onPreviewSession(null); } }} onSave={submit} onValueChange={(value) => { currentDraft.current = value; content.setCommentDraft(value); }} ref={editorRef} value={content.commentDraft} />
			</> : <button aria-label="Add a comment" className={cn("relative flex min-h-12 w-full items-center gap-2 rounded-xl px-4 text-left text-sm text-text-subtle outline-none focus-visible:ring-2 focus-visible:ring-ring", empty ? "bg-bg-input inset-ring inset-ring-border hover:bg-bg-input-hovered" : sidePanel && !elevated ? "bg-bg-input hover:bg-bg-input-hovered" : "bg-surface")} onClick={() => setExpanded(true)} style={{ boxShadow: empty || (sidePanel && !elevated) ? undefined : token("elevation.shadow.overlay") }} type="button"><span>Add a comment or press</span><Kbd>M</Kbd></button>}
		</motion.div>
	);
}
