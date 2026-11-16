"use client";

import { useEffect, useImperativeHandle, useLayoutEffect, useState, type ComponentProps, type Ref } from "react";

import type { AgentSessionItem } from "@/components/blocks/agent-session";
import type { JiraKanbanCardData } from "@/components/blocks/jira-kanban";
import type { ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";
import type { ProjectButterDevelopmentJourneyProps } from "@/components/blocks/jira-work-item/project-butter/project-butter-development-journey";
import { ProjectButterJiraWorkItem } from "@/components/blocks/jira-work-item/project-butter/project-butter-jira-work-item";
import type { ProjectButterRelatedSearchItem, RelatedItemOpener } from "@/components/blocks/jira-work-item/project-butter/related-model";
import { BUTTER_SUGGESTION_DEMO_KEY } from "@/components/projects/butter-v1/data/presentation-board";
import { BUTTER_WORK_ITEM_PLACEHOLDERS } from "@/components/projects/butter-v1/data/work-item-placeholders";
import { useButterWorkItem } from "@/components/projects/butter-v1/hooks/use-butter-work-item";
import { agentAddedSuggestion } from "@/components/projects/butter-v1/lib/agent-added-suggestion";
import { JgpRovoOverlay } from "@/components/projects/jira-golden-journey-v1/components/jira-golden-journey-v1-rovo-overlay";

export type ButterWorkItemHandle = {
	open: (card: JiraKanbanCardData, columnTitle: string) => void;
	close: () => void;
};

function ButterWorkItemDialog(props: ComponentProps<typeof ProjectButterJiraWorkItem>) {
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		const frame = window.requestAnimationFrame(() => setMounted(true));
		return () => window.cancelAnimationFrame(frame);
	}, []);
	return <ProjectButterJiraWorkItem {...props} inlineSessionReplies open={mounted && props.open} />;
}

function getMerchantWorkItemProps(issueKey: string, journey: Pick<ComponentProps<typeof ProjectButterJiraWorkItem>, "journeyPhase" | "journeySession" | "journeyControls" | "developmentJourney">) {
	const isMerchant = issueKey === BUTTER_SUGGESTION_DEMO_KEY;
	return {
		initialSuggestion: isMerchant && !journey.journeyPhase,
		suggestionProfile: isMerchant ? "payments" as const : "default" as const,
		showAuditInActivity: isMerchant,
		autoAssignClaudeToCurrentUser: isMerchant,
		...(isMerchant ? journey : {}),
	};
}

export function ButterWorkItemSurface({ ref, defaultReporter, journeyPhase, journeySession, journeyControls, developmentJourney, onBrowseAgents, onCreateAgent, onAgentSessionStart, onOpenCloudSession, onStoryPointsChange, onAssigneeChange, onWorkItemClose, openRelatedItem, relatedCatalog, suggestion, ...overlayProps }: ComponentProps<typeof JgpRovoOverlay> & {
	/** Board lookup from a related work key to an opener; keys that are not on the board render as plain text. */
	openRelatedItem: RelatedItemOpener;
	/** Board cards as related-work matches, so composers offer this project's items. */
	relatedCatalog: readonly ProjectButterRelatedSearchItem[];
	ref: Ref<ButterWorkItemHandle>;
	defaultReporter: ComponentProps<typeof ProjectButterJiraWorkItem>["defaultReporter"];
	journeyPhase?: ComponentProps<typeof ProjectButterJiraWorkItem>["journeyPhase"];
	journeySession?: ProjectButterSessionItem;
	journeyControls?: React.ReactNode;
	developmentJourney?: ProjectButterDevelopmentJourneyProps;
	onBrowseAgents: () => void;
	onCreateAgent: () => void;
	onAgentSessionStart: (issueKey: string, session: ProjectButterSessionItem) => void;
	onOpenCloudSession: (issueKey: string, issueSummary: string, session: AgentSessionItem & { message: string; prompt?: string }, draft?: string) => Promise<boolean>;
	onStoryPointsChange: (issueKey: string, storyPoints: number | undefined) => void;
	onAssigneeChange: (issueKey: string, assignee: NonNullable<ComponentProps<typeof ProjectButterJiraWorkItem>["currentUser"]>) => void;
	onWorkItemClose: () => void;
}) {
	const workItem = useButterWorkItem();
	const [overlayContainer, setOverlayContainer] = useState<HTMLDivElement | null>(null);
	const [overlayHost, setOverlayHost] = useState<HTMLDivElement | null>(null);
	const [addedSession, setAddedSession] = useState<ProjectButterSessionItem | null>(null);
	useLayoutEffect(() => {
		const host = document.createElement("div");
		host.style.display = "contents";
		document.body.appendChild(host);
		const frame = window.requestAnimationFrame(() => setOverlayHost(host));
		return () => { window.cancelAnimationFrame(frame); host.remove(); };
	}, []);
	useLayoutEffect(() => {
		if (overlayHost) (workItem.open && overlayContainer ? overlayContainer : document.body).appendChild(overlayHost);
	}, [overlayContainer, overlayHost, workItem.open]);
	const { openWorkItem, closeWorkItem } = workItem;
	const selection = workItem.selection;
	useImperativeHandle(ref, () => ({ open: (card, column) => { setAddedSession(null); openWorkItem(card, column); }, close: () => { setAddedSession(null); closeWorkItem(); onWorkItemClose(); } }), [closeWorkItem, onWorkItemClose, openWorkItem]);
	return (
		<>
			<span className="sr-only" role="status">{addedSession ? `${addedSession.agent.name} added` : ""}</span>
			{workItem.selection ? (
				<ButterWorkItemDialog
					cloudAgentSelector
					initialPresentation="full-screen"
					shell="project"
					initialPreset="filled"
					{...getMerchantWorkItemProps(workItem.selection.workItem.code, { journeyPhase, journeySession, journeyControls, developmentJourney })}
					defaultReporter={defaultReporter}
					currentUser={defaultReporter}
					initialSessions={workItem.selection.initialSessions}
					overlayContainerRef={setOverlayContainer}
					onOpenCloudSession={(session, draft) => workItem.selection ? onOpenCloudSession(workItem.selection.workItem.code, workItem.selection.workItem.title, session, draft) : Promise.resolve(false)}
					onBrowseAgents={onBrowseAgents}
					onCreateAgent={onCreateAgent}
					onAgentSessionStart={(session) => { if (workItem.selection) onAgentSessionStart(workItem.selection.workItem.code, session); }}
					onAgentAdded={setAddedSession}
					onStoryPointsChange={(points) => { if (workItem.selection) onStoryPointsChange(workItem.selection.workItem.code, points); }}
					onAssigneeChange={(assignee) => { if (workItem.selection) onAssigneeChange(workItem.selection.workItem.code, assignee); }}
					onClose={() => { setAddedSession(null); workItem.closeWorkItem(); onWorkItemClose(); }}
					open={workItem.open}
					openRelatedItem={openRelatedItem}
					relatedScope={{ catalog: relatedCatalog, parentType: workItem.selection.workType }}
					placeholders={BUTTER_WORK_ITEM_PLACEHOLDERS}
					workItem={workItem.selection.workItem}
				/>
			) : null}
			{overlayHost ? <JgpRovoOverlay {...overlayProps} portalContainer={overlayHost} contained={workItem.open && Boolean(overlayContainer)} suggestion={addedSession && selection ? agentAddedSuggestion(addedSession, async () => {
					if (await onOpenCloudSession(selection.workItem.code, selection.workItem.title, addedSession)) setAddedSession(null);
				}, () => setAddedSession(null)) : suggestion} /> : null}
		</>
	);
}
