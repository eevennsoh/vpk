"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import AddIcon from "@atlaskit/icon/core/add";
import AiChatIcon from "@atlaskit/icon/core/ai-chat";
import ArrowLeftIcon from "@atlaskit/icon/core/arrow-left";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import { AgentSessionCard } from "@/components/blocks/agent-session/agent-session-card";
import { matchingAgentSessions } from "@/components/blocks/agent-assignment/components/session-choice-items";
import { createCommentEntry } from "@/components/blocks/jira-activity/lib/jira-activity-reducer";
import { ProjectButterCommentEditor, type ProjectButterCommentEditorHandle } from "@/components/blocks/jira-work-item/project-butter/project-butter-comment-editor";
import { useProjectButterMentionAgents } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-mention-agents";
import { useCommentBarVisibility } from "@/components/blocks/jira-work-item/project-butter/use-comment-bar-visibility";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import type { ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";
import { RichTextSuggestionMenu, type RichTextSuggestionMenuItem } from "@/components/ui-custom/rich-text-editor";
import { motionDuration, referenceEase } from "@/lib/motion";
import { cn } from "@/lib/utils";

const SESSION_TARGET_MENU_ITEMS = [
	{ id: "continue", label: "Continue in existing session", icon: <AiChatIcon label="" size="small" /> },
	{ id: "new", label: "Start a new session", icon: <AddIcon label="" size="small" /> },
] satisfies readonly RichTextSuggestionMenuItem[];

function createTimedComment(args: Parameters<typeof createCommentEntry>[0]) {
	return { ...createCommentEntry(args), createdAtMs: Date.now() };
}

export function ProjectButterCommentBar({ active, activityRows, content, empty, onOpenSession, onPreviewSession, onStartAgent, sessions, sidePanel }: Readonly<{ active: boolean; activityRows: "none" | "origin" | "feed"; content: ProjectButterContent; empty: boolean; onOpenSession: (id: string, draft?: string) => boolean | void | Promise<boolean | void>; onPreviewSession: (id: string | null) => void; onStartAgent: (agent: AgentSessionItem["agent"], prompt: string) => void; sessions: readonly ProjectButterSessionItem[]; sidePanel: boolean }>) {
	const [expanded, setExpanded] = useState(false);
	const [mentions, setMentions] = useState<string[]>([]);
	const [hasMentions, setHasMentions] = useState(false);
	const [focusRequest, setFocusRequest] = useState(0);
	const [newSessionAgentName, setNewSessionAgentName] = useState<string | null>(null);
	const [selectedTargetIndex, setSelectedTargetIndex] = useState(0);
	const [choosingSession, setChoosingSession] = useState(false);
	const editorRef = useRef<ProjectButterCommentEditorHandle>(null);
	const backRef = useRef<HTMLButtonElement>(null);
	const openingSession = useRef(false);
	const currentDraft = useRef(content.commentDraft);
	const agents = useProjectButterMentionAgents(sessions);
	const mentionedAgent = mentions.length === 1 ? agents.find((agent) => agent.name === mentions[0]) : undefined;
	const matchingSessions = mentionedAgent ? matchingAgentSessions(mentionedAgent, sessions, { includeCompleted: true }) : [];
	const existingSession = matchingSessions[0];
	const showTargetMenu = Boolean(existingSession && newSessionAgentName !== mentionedAgent?.name);
	const menuLength = choosingSession ? matchingSessions.length : SESSION_TARGET_MENU_ITEMS.length;
	const selectedIndex = Math.max(choosingSession ? -1 : 0, Math.min(selectedTargetIndex, menuLength - 1));
	const reducedMotion = useReducedMotion();
	const { barRef, elevated, inActivity, revealActivity } = useCommentBarVisibility(active, empty, sidePanel);
	const visible = active && (empty || expanded || inActivity);
	// The composer stays mounted, so tucking it away must also release focus; otherwise the next M would type into it.
	function releaseFocus() { if (document.activeElement instanceof HTMLElement && barRef.current?.contains(document.activeElement)) document.activeElement.blur(); }
	function cancel() { releaseFocus(); currentDraft.current = ""; setExpanded(false); content.setCommentDraft(""); setMentions([]); setHasMentions(false); setNewSessionAgentName(null); setSelectedTargetIndex(0); setChoosingSession(false); onPreviewSession(null); }
	useEffect(() => {
		if (!active) return;
		function onKeyDown(event: KeyboardEvent) {
			if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.key.toLowerCase() !== "m") return;
			if (event.target instanceof Element && (
				event.target.closest<HTMLElement>("[contenteditable]")?.isContentEditable ||
				event.target.closest("input, textarea, select, [role=combobox], [role=menuitem], [role=option], [role=slider]")
			)) return;
			event.preventDefault(); revealActivity(); setExpanded(true); setFocusRequest((value) => value + 1);
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
		const entry = createTimedComment({ id: crypto.randomUUID(), actor: content.currentUser, body: hasMentions ? plainText : body, timestamp: "Just now" });
		content.setActivityEntries((entries) => [...entries, entry]); content.setActivityView("Activity"); content.setActivityFocusId(entry.id); cancel();
	}
	function chooseTarget(choice: "continue" | "new") {
		if (!existingSession) return;
		if (choice === "continue") {
			setChoosingSession(true); setSelectedTargetIndex(0);
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
	function backToTargets() {
		setChoosingSession(false); setSelectedTargetIndex(0); onPreviewSession(null); setFocusRequest((value) => value + 1);
	}
	function handleTargetKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
		if (!showTargetMenu || event.nativeEvent.isComposing) return;
		if ((event.key === "Enter" || event.key === "Tab") && event.target instanceof HTMLButtonElement && !event.target.hasAttribute("data-suggestion-option")) return;
		switch (event.key) {
			case "ArrowDown":
			case "ArrowUp":
				event.preventDefault(); event.stopPropagation();
				{
					const direction = event.key === "ArrowDown" ? 1 : -1;
					const next = choosingSession
						? (selectedIndex + 1 + direction + menuLength + 1) % (menuLength + 1) - 1
						: (selectedIndex + direction + menuLength) % menuLength;
					setSelectedTargetIndex(next);
					if (choosingSession) {
						onPreviewSession(matchingSessions[next]?.id ?? null);
						if (next === -1) backRef.current?.focus({ preventScroll: true });
						else if (event.target === backRef.current) setFocusRequest((value) => value + 1);
					}
				}
				break;
			case "Enter":
			case "Tab":
				if (event.key === "Tab" && event.shiftKey) return;
				event.preventDefault(); event.stopPropagation();
				if (choosingSession) {
					if (selectedIndex === -1) { backToTargets(); break; }
					const session = matchingSessions[selectedIndex];
					if (session) openSelectedSession(session);
				} else chooseTarget(SESSION_TARGET_MENU_ITEMS[selectedIndex]?.id === "new" ? "new" : "continue");
				break;
			case "ArrowLeft":
				if (!choosingSession) return;
				event.preventDefault(); event.stopPropagation(); backToTargets();
				break;
			case "Escape":
				event.preventDefault(); event.stopPropagation();
				if (choosingSession) { backToTargets(); break; }
				if (mentionedAgent) editorRef.current?.revertAgentMention(mentionedAgent.name);
				setNewSessionAgentName(null); setSelectedTargetIndex(0); setChoosingSession(false); onPreviewSession(null);
				break;
			default:
				break;
		}
	}
	return (
		<motion.div animate={{ opacity: visible ? 1 : 0, transform: visible || sidePanel || empty ? "translateY(0%)" : "translateY(100%)" }} aria-hidden={!visible} aria-label="Comment editor" className={cn("sticky bottom-6 z-30 rounded-xl bg-surface [&_[data-project-butter-comment-editor]]:relative [&_[data-project-butter-comment-editor]]:z-10 [&_[data-project-butter-comment-editor]]:shadow-none", !sidePanel && "@[860px]/butter:bottom-0", activityRows === "none" ? "-mt-4" : activityRows === "origin" ? "mt-0" : "mt-4")} data-elevated={elevated} data-project-butter-comment-bar data-visible={visible} inert={!visible} initial={false} onKeyDownCapture={handleTargetKeyDown} ref={barRef} role="group" style={{ pointerEvents: visible ? "auto" : "none" }} transition={{ duration: reducedMotion ? 0 : motionDuration.fast, ease: referenceEase.workItemCommentReveal }}>
			{visible && elevated ? <span aria-hidden="true" className="pointer-events-none absolute -inset-x-6 -bottom-6 -top-20 -z-10 bg-linear-to-b from-transparent via-surface to-surface" data-project-butter-comment-backdrop /> : null}
			<span aria-hidden="true" className="pointer-events-none absolute inset-x-6 inset-y-0 rounded-xl shadow-[0px_-2px_50px_8px_rgba(30,31,33,0.08)]" data-project-butter-comment-shadow />
			{showTargetMenu && existingSession ? <div className="absolute inset-x-0 bottom-full z-20 mb-2" data-project-butter-session-target-menu>
				{choosingSession ? <div className="rich-text-command-menu rich-text-command-menu-borderless w-full!" data-nested="true">
					<button className={cn("rich-text-command-menu-item rich-text-command-menu-back", selectedIndex === -1 && "rich-text-command-menu-item-selected")} onClick={backToTargets} onFocus={() => { setSelectedTargetIndex(-1); onPreviewSession(null); }} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => { setSelectedTargetIndex(-1); onPreviewSession(null); }} ref={backRef} type="button"><span className="inline-flex size-6 items-center justify-center"><ArrowLeftIcon label="" size="small" /></span><span className="menu-row-title">Back</span></button>
					<ul aria-label="Choose a session" className="rich-text-command-menu-list p-1">
						{matchingSessions.map((session, index) => <AgentSessionCard animateLayout={false} density="long" hoverTone="menu" isSelected={index === selectedIndex} item={{ ...session, title: session.prompt?.replace(`@${session.agent.name}`, "").trim() || session.title }} key={session.id} onItemHover={(item) => { if (item) setSelectedTargetIndex(index); onPreviewSession(item?.id ?? null); }} onView={() => openSelectedSession(session)} padding="compact" showMoreMenu={false} />)}
					</ul>
				</div> : <RichTextSuggestionMenu className="rich-text-command-menu-borderless w-full!" emptyLabel="" items={SESSION_TARGET_MENU_ITEMS} onHover={setSelectedTargetIndex} onSelect={(item) => chooseTarget(item.id === "new" ? "new" : "continue")} selectedIndex={selectedIndex} title="Choose agent session" />}
			</div> : null}
			<div className="contents" onFocusCapture={() => setExpanded(true)}>
				<ProjectButterCommentEditor agents={agents} focusRequest={focusRequest} onCancel={cancel} onMentionChange={(names, hasAny) => { setMentions(names); setHasMentions(hasAny); if (!names.includes(mentionedAgent?.name ?? "")) { setNewSessionAgentName(null); setSelectedTargetIndex(0); setChoosingSession(false); onPreviewSession(null); } }} onSave={submit} onValueChange={(value) => { currentDraft.current = value; content.setCommentDraft(value); }} ref={editorRef} value={content.commentDraft} />
			</div>
		</motion.div>
	);
}
