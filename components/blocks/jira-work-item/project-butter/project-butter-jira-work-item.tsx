"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import { isLocalAgentListItem } from "@/components/blocks/agent-list";
import type { WorkItemData, WorkItemPerson } from "@/app/contexts/context-work-item-modal";
import type { ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";

import type { JiraWorkItemPreset } from "@/components/blocks/jira-work-item/data/session-state";

import { AttachmentDropZone } from "@/components/blocks/jira-work-item/project-butter/attachment-drop-overlay";
import { projectButterSessionInvocation } from "@/components/blocks/jira-work-item/project-butter/activity-feed-model";
import { ProjectButterEmptyActions } from "@/components/blocks/jira-work-item/project-butter/project-butter-empty-actions";
import { ProjectButterSessionChat } from "@/components/blocks/jira-work-item/project-butter/project-butter-session-chat";
import { ProjectButterShell } from "@/components/blocks/jira-work-item/project-butter/project-butter-shell";
import type { ProjectButterPresentation, ProjectButterShellContext } from "@/components/blocks/jira-work-item/project-butter/presentation";
import { useProjectButterSessions } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-sessions";
import { cn } from "@/lib/utils";
import { ProjectButterBody } from "@/components/blocks/jira-work-item/project-butter/project-butter-body";
import { ProjectButterDetails } from "@/components/blocks/jira-work-item/project-butter/project-butter-details";
import { ProjectButterHeader } from "@/components/blocks/jira-work-item/project-butter/project-butter-header";
import { ProjectButterSession } from "@/components/blocks/jira-work-item/project-butter/project-butter-session";
import type { ProjectButterPlaceholderMap } from "@/components/blocks/jira-work-item/project-butter/placeholder-fill";
import type { ProjectButterRelatedScope, RelatedItemOpener } from "@/components/blocks/jira-work-item/project-butter/related-model";
import { useProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import { PROJECT_BUTTER_PANEL_ORDER } from "@/components/blocks/jira-work-item/project-butter/panel-order";

export interface ProjectButterJiraWorkItemProps {
	open: boolean;
	onClose: () => void;
	initialPreset: JiraWorkItemPreset;
	initialSuggestion?: boolean;
	defaultReporter?: WorkItemPerson;
	suggestionProfile?: "default" | "payments";
	initialPresentation?: ProjectButterPresentation;
	shell?: ProjectButterShellContext;
	workItem?: WorkItemData;
	initialSessions?: readonly ProjectButterSessionItem[];
	placeholders?: ProjectButterPlaceholderMap;
	onBrowseAgents?: () => void;
	onCreateAgent?: () => void;
	onAgentSessionStart?: (session: ProjectButterSessionItem) => void;
	onOpenCloudSession?: (session: ProjectButterSessionItem) => void;
	overlayContainerRef?: (element: HTMLDivElement | null) => void;
	onStoryPointsChange?: (storyPoints: number | undefined) => void;
	/** Resolves a related work key to an opener when the host has that work item (Butter board). */
	openRelatedItem?: RelatedItemOpener;
	/** Host project scope for related work: composer match pool and this work item's type. */
	relatedScope?: ProjectButterRelatedScope;
}

export function ProjectButterJiraWorkItem({
	open,
	onClose,
	initialPreset,
	initialSuggestion = false,
	defaultReporter,
	suggestionProfile = "default",
	initialPresentation = "full-screen",
	shell = "standalone",
	workItem,
	initialSessions,
	placeholders,
	onBrowseAgents,
	onCreateAgent,
	onAgentSessionStart,
	onOpenCloudSession,
	overlayContainerRef,
	onStoryPointsChange,
	openRelatedItem,
	relatedScope,
}: Readonly<ProjectButterJiraWorkItemProps>) {
	const [presentation, setPresentation] = useState(initialPresentation);
	/** The scrolling left column: the whole of it (gutters included) accepts file drops. */
	const columnRef = useRef<HTMLDivElement>(null);
	const [layoutElement, setLayoutElement] = useState<HTMLDivElement | null>(null);
	const inlineDetailsRef = useRef<HTMLDivElement>(null);
	const railDetailsRef = useRef<HTMLDivElement>(null);
	const detailsHostRef = useRef<HTMLDivElement | null>(null);
	const [detailsHost, setDetailsHost] = useState<HTMLDivElement | null>(null);
	const setInlineDetailsSlot = useCallback((slot: HTMLDivElement | null) => {
		inlineDetailsRef.current = slot;
		if (slot && !detailsHostRef.current) {
			const host = document.createElement("div");
			detailsHostRef.current = host;
			setDetailsHost(host);
		}
	}, []);
	const [suggestion, setSuggestion] = useState(initialSuggestion);
	const [descriptionReveal, setDescriptionReveal] = useState<{ id: number; text: string } | null>(null);
	const [revealOpen, setRevealOpen] = useState(open);
	if (revealOpen !== open) {
		setRevealOpen(open);
		if (!open) setDescriptionReveal(null);
	}
	const [suggestionItemKey, setSuggestionItemKey] = useState(workItem?.code);
	if (suggestionItemKey !== workItem?.code) {
		setSuggestionItemKey(workItem?.code);
		setSuggestion(initialSuggestion);
		setDescriptionReveal(null);
	}
	const finishDescriptionReveal = useCallback(() => setDescriptionReveal(null), []);
	const [empty, setEmpty] = useState(!initialSuggestion && (initialPreset === "empty" || initialPreset === "blank"));
	const [panelOrder, setPanelOrder] = useState(PROJECT_BUTTER_PANEL_ORDER);
	const filledContent = useProjectButterContent(
		initialPreset === "running" ? "running" : "filled",
		workItem,
		initialSessions,
		placeholders,
		defaultReporter,
	);
	const emptyContent = useProjectButterContent("empty", workItem, undefined, placeholders, defaultReporter);
	const suggestionContent = useProjectButterContent("empty", workItem, undefined, placeholders, defaultReporter);
	const filledSessions = useProjectButterSessions(
		initialPreset === "running" ? "running" : "filled",
		workItem?.code,
		initialSessions,
	);
	const emptySessions = useProjectButterSessions("empty", workItem?.code);
	const sparse = empty || suggestion;
	const currentContent = suggestion ? suggestionContent : empty ? emptyContent : filledContent;
	const setDetailFields = currentContent.setDetailFields;
	useEffect(() => {
		if (!open || !workItem) return;
		const storyPoints = workItem.storyPoints?.toString() ?? "";
		setDetailFields((fields) => fields.storyPoints === storyPoints ? fields : { ...fields, storyPoints });
	}, [open, setDetailFields, workItem]);
	const content = {
		...currentContent,
		setDetailFields: (update: React.SetStateAction<typeof currentContent.detailFields>) => {
			const next = typeof update === "function" ? update(currentContent.detailFields) : update;
			currentContent.setDetailFields(update);
			if (next.storyPoints !== currentContent.detailFields.storyPoints) {
				onStoryPointsChange?.(next.storyPoints === "" ? undefined : Number(next.storyPoints));
			}
		},
	};
	const model = sparse ? emptySessions : filledSessions;
	const {
		activeSession,
		drafts,
		replies,
		replyToSession,
		sessions,
		setActiveSessionId,
		setDrafts,
	} = model;
	function changeEmpty(next: boolean) {
		setDescriptionReveal(null);
		setEmpty(next);
		if (next) setSuggestion(false);
	}
	function changeSuggestion(next: boolean) {
		setDescriptionReveal(null);
		setSuggestion(next);
		if (next) setEmpty(false);
	}
	function addInvocation(session: ProjectButterSessionItem) {
		const entry = projectButterSessionInvocation(session);
		content.setActivityEntries((entries) =>
			entries.some((item) => item.id === entry.id) ? entries : [...entries, entry],
		);
		content.setActivityView("Activity");
	}
	function startAgent(agent: AgentSessionItem["agent"]) {
		const session = model.startAgent(agent, content.summary);
		addInvocation(session);
		onAgentSessionStart?.(session);
		if (onOpenCloudSession) { setActiveSessionId(null); onOpenCloudSession(session); }
	}
	function startAgentFromComment(agent: AgentSessionItem["agent"], prompt: string) {
		const session = model.startAgent(agent, content.summary, prompt);
		addInvocation(session);
		onAgentSessionStart?.(session);
		setActiveSessionId(null);
	}
	function startCoding() {
		const session = model.startCoding();
		addInvocation(session);
		onAgentSessionStart?.(session);
		if (onOpenCloudSession) { setActiveSessionId(null); onOpenCloudSession(session); }
	}
	function openSession(id: string) {
		const session = sessions.find((item) => item.id === id);
		if (!session || isLocalAgentListItem(session)) return;
		if (onOpenCloudSession) {
			setActiveSessionId(null);
			onOpenCloudSession(session);
		} else {
			setActiveSessionId(id);
		}
	}
	function reply() {
		if (!activeSession || !drafts[activeSession.id]?.trim()) return;
		replyToSession(activeSession);
		addInvocation({ ...activeSession, state: "running" });
	}
	const sidePanel = presentation === "side-panel";
	useLayoutEffect(() => {
		const layout = layoutElement;
		if (!layout || !detailsHost) return;
		const placeDetails = () => {
			const slot = sidePanel || layout.getBoundingClientRect().width < 860 ? inlineDetailsRef.current : railDetailsRef.current;
			if (!slot || detailsHost.parentElement === slot) return;
			const focused = document.activeElement instanceof HTMLElement && detailsHost.contains(document.activeElement) ? document.activeElement : null;
			slot.appendChild(detailsHost);
			focused?.focus({ preventScroll: true });
		};
		placeDetails();
		const observer = new ResizeObserver(placeDetails);
		observer.observe(layout);
		return () => observer.disconnect();
	}, [detailsHost, layoutElement, sidePanel, workItem?.code]);
	const details = (
		<ProjectButterDetails
			key={workItem?.code ?? "reference"}
			code={workItem?.code ?? "VITA-1"}
			content={content}
			empty={sparse}
			onDescriptionSuggested={(text) => setDescriptionReveal((current) => ({ id: (current?.id ?? 0) + 1, text }))}
			onPanelOrderChange={setPanelOrder}
			onStartCoding={startCoding}
			panelOrder={panelOrder}
			sidePanel={sidePanel}
			suggestion={suggestion}
			suggestionProfile={suggestionProfile}
		/>
	);
	return (
		<ProjectButterShell
			overlayContainerRef={overlayContainerRef}
			empty={empty}
			onClose={onClose}
			onEmptyChange={changeEmpty}
			onPresentationChange={setPresentation}
			onSuggestionChange={changeSuggestion}
			suggestion={suggestion}
			open={open}
			presentation={presentation}
			shell={shell}
		>
			<ProjectButterHeader
				key={workItem?.code ?? "reference"}
				content={content}
				empty={sparse}
				onClose={onClose}
				onBrowseAgents={onBrowseAgents}
				onCreateAgent={onCreateAgent}
				onOpenSession={(session) => openSession(session.id)}
				onPresentationChange={setPresentation}
				onStartAgent={startAgent}
				onStartCoding={startCoding}
				secondaryActions={
					sparse && !sidePanel ? <ProjectButterEmptyActions content={content} /> : null
				}
				presentation={presentation}
				sessions={sessions}
				workItem={workItem}
			/>
			<div
				className={cn(
					"grid min-h-0 flex-1",
					sidePanel
						? "grid-cols-1 overflow-y-auto"
						: "grid-cols-1 overflow-y-auto @[860px]/butter:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] @[860px]/butter:overflow-clip",
				)}
				data-project-butter-state={suggestion ? "suggestion" : empty ? "empty" : "filled"}
				data-project-butter-work-item
				ref={setLayoutElement}
			>
				<div
					className={cn(
						"min-w-0 px-6 pb-6",
						!sidePanel && "@[860px]/butter:overflow-y-auto",
					)}
					ref={columnRef}
				>
					<AttachmentDropZone content={content} targetRef={columnRef} />
					<ProjectButterBody
						key={workItem?.code ?? "reference"}
						active={open}
						sidePanel={sidePanel}
						content={content}
						descriptionReveal={suggestion ? descriptionReveal : null}
						onDescriptionRevealComplete={finishDescriptionReveal}
						detailsSlotRef={setInlineDetailsSlot}
						empty={sparse}
						onOpenSession={openSession}
						onStartAgent={startAgentFromComment}
						openRelatedItem={openRelatedItem}
						relatedScope={relatedScope}
						sessions={sessions}
						workItemKey={workItem?.code}
					/>
				</div>
				{sidePanel ? null : (
					<div className="hidden min-w-0 px-6 pb-8 @[860px]/butter:block @[860px]/butter:overflow-y-auto" ref={railDetailsRef} />
				)}
			</div>
			{detailsHost ? createPortal(details, detailsHost) : null}
			<ProjectButterSessionChat
				onClose={() => setActiveSessionId(null)}
				open={open && Boolean(activeSession && !isLocalAgentListItem(activeSession))}
				title={activeSession?.title}
			>
				{activeSession ? (
					<ProjectButterSession
						draft={drafts[activeSession.id] ?? ""}
						onClose={() => setActiveSessionId(null)}
						onDraftChange={(value) =>
							setDrafts((current) => ({ ...current, [activeSession.id]: value }))
						}
						onReply={reply}
						replies={replies[activeSession.id] ?? []}
						session={activeSession}
					/>
				) : null}
			</ProjectButterSessionChat>
		</ProjectButterShell>
	);
}
