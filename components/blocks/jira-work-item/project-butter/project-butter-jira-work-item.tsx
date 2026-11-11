"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import { isLocalAgentListItem } from "@/components/blocks/agent-list";
import type { WorkItemData, WorkItemPerson } from "@/app/contexts/context-work-item-modal";
import type { ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";

import type { JiraWorkItemPreset } from "@/components/blocks/jira-work-item/data/session-state";

import { AttachmentDropZone } from "@/components/blocks/jira-work-item/project-butter/attachment-drop-overlay";
import { MERCHANT_ACKNOWLEDGMENT_DELAY_MS, merchantJourneyAuthoredActivity, merchantJourneyAuthoredUpdate, projectMerchantJourney, type ProjectButterJourneyPhase, type ProjectButterJourneyAuthoredField } from "@/components/blocks/jira-work-item/project-butter/merchant-journey-activity";
import { PROJECT_BUTTER_SUGGESTION_FIELDS } from "@/components/blocks/jira-work-item/project-butter/suggestion-model";
import { ProjectButterEmptyActions } from "@/components/blocks/jira-work-item/project-butter/project-butter-empty-actions";
import { ProjectButterSessionChat } from "@/components/blocks/jira-work-item/project-butter/project-butter-session-chat";
import { ProjectButterShell } from "@/components/blocks/jira-work-item/project-butter/project-butter-shell";
import type { ProjectButterPresentation, ProjectButterShellContext } from "@/components/blocks/jira-work-item/project-butter/presentation";
import { useProjectButterSessions } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-sessions";
import { cn } from "@/lib/utils";
import { ProjectButterBody } from "@/components/blocks/jira-work-item/project-butter/project-butter-body";
import { ProjectButterDetails } from "@/components/blocks/jira-work-item/project-butter/project-butter-details";
import { ProjectButterDetailsRail } from "@/components/blocks/jira-work-item/project-butter/project-butter-details-rail";
import { ProjectButterHeader } from "@/components/blocks/jira-work-item/project-butter/project-butter-header";
import { useHasVerticalOverflow } from "@/components/hooks/use-has-vertical-overflow";
import { ProjectButterCrew } from "@/components/blocks/jira-work-item/project-butter/project-butter-crew";
import { ProjectButterSession } from "@/components/blocks/jira-work-item/project-butter/project-butter-session";
import type { ProjectButterPlaceholderMap } from "@/components/blocks/jira-work-item/project-butter/placeholder-fill";
import type { ProjectButterRelatedScope, RelatedItemOpener } from "@/components/blocks/jira-work-item/project-butter/related-model";
import { useProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import { PROJECT_BUTTER_PANEL_ORDER } from "@/components/blocks/jira-work-item/project-butter/panel-order";
import type { ProjectButterDevelopmentJourneyProps } from "@/components/blocks/jira-work-item/project-butter/project-butter-development-journey";

export interface ProjectButterJiraWorkItemProps {
	open: boolean;
	onClose: () => void;
	initialPreset: JiraWorkItemPreset;
	initialRelatedSectionOpen?: boolean;
	compact?: boolean;
	initialSuggestion?: boolean;
	defaultReporter?: WorkItemPerson;
	defaultAssignee?: WorkItemPerson;
	currentUser?: WorkItemPerson;
	cloudAgentSelector?: boolean;
	showAuditInActivity?: boolean;
	autoAssignClaudeToCurrentUser?: boolean;
	journeyPhase?: ProjectButterJourneyPhase;
	journeySession?: ProjectButterSessionItem;
	journeyControls?: ReactNode;
	developmentJourney?: ProjectButterDevelopmentJourneyProps;
	suggestionProfile?: "default" | "payments";
	initialPresentation?: ProjectButterPresentation;
	shell?: ProjectButterShellContext;
	workItem?: WorkItemData;
	initialSessions?: readonly ProjectButterSessionItem[];
	placeholders?: ProjectButterPlaceholderMap;
	onBrowseAgents?: () => void;
	onCreateAgent?: () => void;
	onAgentSessionStart?: (session: ProjectButterSessionItem) => void;
	onOpenCloudSession?: (session: ProjectButterSessionItem, draft: string | undefined, workItem: { code: string; summary: string }) => boolean | void | Promise<boolean | void>;
	/** Standalone only: the host's sidebar chat, mounted beside the work item. Pair with `onOpenCloudSession`. */
	chatPanel?: ReactNode;
	overlayContainerRef?: (element: HTMLDivElement | null) => void;
	onStoryPointsChange?: (storyPoints: number | undefined) => void;
	onAssigneeChange?: (assignee: WorkItemPerson) => void;
	/** Resolves a related work key to an opener when the host has that work item (Butter board). */
	openRelatedItem?: RelatedItemOpener;
	/** Host project scope for related work: composer match pool and this work item's type. */
	relatedScope?: ProjectButterRelatedScope;
}

export function ProjectButterJiraWorkItem({
	open,
	onClose,
	initialPreset,
	initialRelatedSectionOpen,
	compact,
	initialSuggestion = false,
	defaultReporter,
	defaultAssignee,
	currentUser,
	cloudAgentSelector = false,
	showAuditInActivity,
	autoAssignClaudeToCurrentUser,
	journeyPhase,
	journeySession,
	journeyControls,
	developmentJourney,
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
	chatPanel,
	overlayContainerRef,
	onStoryPointsChange,
	onAssigneeChange,
	openRelatedItem,
	relatedScope,
}: Readonly<ProjectButterJiraWorkItemProps>) {
	const [presentation, setPresentation] = useState(initialPresentation);
	/** The scrolling left column: the whole of it (gutters included) accepts file drops. */
	const columnRef = useRef<HTMLDivElement>(null);
	const [layoutElement, setLayoutElement] = useState<HTMLDivElement | null>(null);
	const { ref: layoutScrollRef, showTopScrollMask: showLayoutFade } = useHasVerticalOverflow<HTMLDivElement>();
	const { ref: columnScrollRef, showTopScrollMask: showColumnFade } = useHasVerticalOverflow<HTMLDivElement>();
	const setLayoutRef = useCallback((element: HTMLDivElement | null) => {
		setLayoutElement(element);
		layoutScrollRef(element);
	}, [layoutScrollRef]);
	const setColumnRef = useCallback((element: HTMLDivElement | null) => {
		columnRef.current = element;
		columnScrollRef(element);
	}, [columnScrollRef]);
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
		{ currentUser, showAuditInActivity, defaultAssignee, initialRelatedSectionOpen },
	);
	const emptyContent = useProjectButterContent("empty", workItem, undefined, placeholders, defaultReporter, { currentUser, showAuditInActivity });
	const suggestionContent = useProjectButterContent("empty", workItem, undefined, placeholders, defaultReporter, { currentUser, showAuditInActivity });
	const filledSessions = useProjectButterSessions(
		initialPreset === "running" ? "running" : "filled",
		workItem?.code,
		initialSessions,
		currentUser,
	);
	const emptySessions = useProjectButterSessions("empty", workItem?.code, undefined, currentUser);
	const sparse = empty || suggestion;
	const currentContent = suggestion ? suggestionContent : empty ? emptyContent : filledContent;
	const model = sparse ? emptySessions : filledSessions;
	const [journeyEdits, setJourneyEdits] = useState<ReadonlyMap<string, ReadonlySet<ProjectButterJourneyAuthoredField>>>(() => new Map());
	const itemKey = workItem?.code ?? "reference";
	const authoredFields = journeyEdits.get(itemKey) ?? new Set<ProjectButterJourneyAuthoredField>();
	const autoAssignTo = autoAssignClaudeToCurrentUser ? currentUser : undefined;
	const [acknowledgmentTime, setAcknowledgmentTime] = useState(() => Date.now());
	const invokedAtMs = journeySession?.invokedAtMs;
	const showAcknowledgment = journeyPhase !== "working" || invokedAtMs == null || acknowledgmentTime >= invokedAtMs + MERCHANT_ACKNOWLEDGMENT_DELAY_MS;
	useEffect(() => {
		if (journeyPhase !== "working" || invokedAtMs == null) return;
		const remaining = Math.max(0, invokedAtMs + MERCHANT_ACKNOWLEDGMENT_DELAY_MS - Date.now());
		const timer = window.setTimeout(() => setAcknowledgmentTime(Date.now()), remaining);
		return () => window.clearTimeout(timer);
	}, [invokedAtMs, journeyPhase]);
	const projection = projectMerchantJourney({ content: currentContent, sessions: model.sessions, phase: journeyPhase, session: journeySession, autoAssignTo, authoredFields, showAcknowledgment });
	function markJourneyAuthored(field: ProjectButterJourneyAuthoredField) {
		if (!journeyPhase && !journeySession) return;
		setJourneyEdits((items) => new Map(items).set(itemKey, new Set([...(items.get(itemKey) ?? []), field])));
	}
	const [previewSessionId, setPreviewSessionId] = useState<string | null>(null);
	const [startedSessionId, setStartedSessionId] = useState<string | null>(null);
	const clearStartedSession = useCallback(() => setStartedSessionId(null), []);
	const { setActivityView } = currentContent;
	const previewSession = useCallback((id: string | null) => {
		setPreviewSessionId(id);
		if (id) setActivityView("Activity");
	}, [setActivityView]);
	const { syncStoryPoints } = currentContent;
	useEffect(() => {
		if (!open || !workItem) return;
		syncStoryPoints(workItem.storyPoints?.toString() ?? "");
	}, [open, syncStoryPoints, workItem]);
	const content = {
		...projection.content,
		setDescription: (update: React.SetStateAction<string>) => {
			markJourneyAuthored("description");
			currentContent.setDescription(update);
		},
		setDueDate: (update: React.SetStateAction<Date | undefined>) => {
			markJourneyAuthored("dueDate");
			currentContent.setDueDate(update);
		},
		setReporter: (update: React.SetStateAction<WorkItemPerson | null>) => {
			markJourneyAuthored("reporter");
			currentContent.setReporter(update);
		},
		setStatus: (update: React.SetStateAction<string>) => {
			markJourneyAuthored("status");
			currentContent.setStatus(update);
		},
		setActivityEntries: (update: React.SetStateAction<typeof currentContent.activityEntries>) => {
			currentContent.setActivityEntries((stored) => {
				const shown = projectMerchantJourney({ content: { ...currentContent, activityEntries: stored }, sessions: model.sessions, phase: journeyPhase, session: journeySession, autoAssignTo, authoredFields, showAcknowledgment }).content.activityEntries;
				const next = typeof update === "function" ? update(shown) : update;
				return merchantJourneyAuthoredActivity(stored, shown, next, journeySession);
			});
		},
		setAssignee: (update: React.SetStateAction<WorkItemPerson>) => {
			const next = typeof update === "function" ? update(projection.content.assignee) : update;
			markJourneyAuthored("assignee");
			currentContent.setAssignee(next);
			onAssigneeChange?.(next);
		},
		setDetailFields: (update: React.SetStateAction<typeof currentContent.detailFields>) => {
			const shown = projection.content.detailFields;
			const next = typeof update === "function" ? update(shown) : update;
			for (const field of PROJECT_BUTTER_SUGGESTION_FIELDS) {
				if (field === "description" || field === "dueDate" || field === "reporter") continue;
				if (JSON.stringify(shown[field]) !== JSON.stringify(next[field])) markJourneyAuthored(field);
			}
			currentContent.setDetailFields((stored) => merchantJourneyAuthoredUpdate(stored, shown, next));
			if (next.storyPoints !== shown.storyPoints) {
				onStoryPointsChange?.(next.storyPoints === "" ? undefined : Number(next.storyPoints));
			}
		},
	};
	const {
		drafts,
		replies,
		replyToSession,
		setActiveSessionId,
		setDrafts,
	} = model;
	const sessions = projection.sessions;
	const activeSession = sessions.find((session) => session.id === model.activeSessionId);
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
		content.recordSessionInvocation(session, !journeyControls && session.agent.name === "Claude" ? autoAssignTo : undefined);
	}
	function startAgent(agent: AgentSessionItem["agent"]) {
		const started = model.startAgent(agent, content.summary);
		const session = agent.name === "Claude" && autoAssignTo ? { ...started, selfAssignedOnStart: currentContent.assignee.name === "Unassigned" || currentContent.assignee.name === "Automatic" } : started;
		addInvocation(session);
		content.setActivityFilters((filters) => ({ ...filters, agents: true }));
		setStartedSessionId(session.id);
		onAgentSessionStart?.(session);
		setActiveSessionId(null);
	}
	function startAgentFromComment(agent: AgentSessionItem["agent"], prompt: string) {
		const session = model.startAgent(agent, content.summary, prompt);
		addInvocation(session);
		onAgentSessionStart?.(session);
		setActiveSessionId(null);
	}
	function openSession(id: string, draft?: string): boolean | void | Promise<boolean | void> {
		const session = sessions.find((item) => item.id === id);
		if (!session || isLocalAgentListItem(session)) return false;
		if (onOpenCloudSession) {
			setActiveSessionId(null);
			return onOpenCloudSession(session, draft, { code: workItem?.code ?? "VITA-1", summary: content.summary });
		} else {
			if (draft) setDrafts((current) => ({ ...current, [id]: current[id]?.trim() ? `${current[id].trimEnd()}\n\n${draft}` : draft }));
			setActiveSessionId(id);
			return true;
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
			agentField={<ProjectButterCrew field showFieldLabel={false} cloudAgentSelector={cloudAgentSelector} onBrowseAgents={onBrowseAgents} onCreateAgent={onCreateAgent} onOpenSession={(session) => openSession(session.id)} onPreviewSession={previewSession} onStartAgent={startAgent} sessions={sessions} />}
			agentFieldHasSessions={sessions.length > 0}
			key={workItem?.code ?? "reference"}
			code={workItem?.code ?? "VITA-1"}
			content={content}
			developmentJourney={developmentJourney}
			empty={sparse}
			onDescriptionSuggested={(text) => setDescriptionReveal((current) => ({ id: (current?.id ?? 0) + 1, text }))}
			onPanelOrderChange={setPanelOrder}
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
			chatPanel={chatPanel}
			shell={shell}
		>
			<ProjectButterHeader
				key={workItem?.code ?? "reference"}
				content={content}
				onClose={onClose}
				onPresentationChange={setPresentation}
				showFullScreenClose={shell === "project"}
				secondaryActions={
					sparse && !sidePanel ? <ProjectButterEmptyActions content={content} /> : null
				}
				presentation={presentation}
				workItem={workItem}
			/>
			<div
				className={cn(
					"grid min-h-0 flex-1",
					sidePanel
						? "grid-cols-1 overflow-y-auto"
						: "grid-cols-1 overflow-y-auto @[860px]/butter:grid-cols-[minmax(0,1fr)_auto] @[860px]/butter:overflow-clip",
					showLayoutFade && "scroll-mask-top [--scroll-mask-fade-size:3rem] has-[[data-project-butter-activity-header][data-stuck]]:mask-none",
				)}
				data-project-butter-state={suggestion ? "suggestion" : empty ? "empty" : "filled"}
				data-project-butter-work-item
				ref={setLayoutRef}
			>
				<div
					className={cn(
						"min-w-0 px-6 pb-6",
						!sidePanel && "@[860px]/butter:overflow-y-auto",
						showColumnFade && "scroll-mask-top [--scroll-mask-fade-size:3rem] has-[[data-project-butter-activity-header][data-stuck]]:mask-none",
					)}
					ref={setColumnRef}
				>
					<AttachmentDropZone content={content} targetRef={columnRef} />
					<ProjectButterBody
						compact={compact}
						key={workItem?.code ?? "reference"}
						active={open}
						singleActivityView={shell !== "standalone"}
						sidePanel={sidePanel}
						content={content}
						descriptionReveal={suggestion ? descriptionReveal : null}
						onDescriptionRevealComplete={finishDescriptionReveal}
						detailsSlotRef={setInlineDetailsSlot}
						empty={sparse}
						onOpenSession={openSession}
						onPreviewSession={previewSession}
						onStartAgent={startAgentFromComment}
						onStartedSessionRevealed={clearStartedSession}
						openRelatedItem={openRelatedItem}
						previewSessionId={previewSessionId}
						startedSessionId={startedSessionId}
						relatedScope={relatedScope}
						sessions={sessions}
						workItemKey={workItem?.code}
					/>
				</div>
				{sidePanel ? null : (
					<ProjectButterDetailsRail ref={railDetailsRef} />
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
