"use client";

import { useState } from "react";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import type { WorkItemData } from "@/app/contexts/context-work-item-modal";
import type { ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";

import type { JiraWorkItemPreset } from "@/components/blocks/jira-work-item/data/session-state";

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
import { useProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import { PROJECT_BUTTER_PANEL_ORDER } from "@/components/blocks/jira-work-item/project-butter/panel-order";

export interface ProjectButterJiraWorkItemProps {
	open: boolean;
	onClose: () => void;
	initialPreset: JiraWorkItemPreset;
	initialSuggestion?: boolean;
	initialPresentation?: ProjectButterPresentation;
	shell?: ProjectButterShellContext;
	workItem?: WorkItemData;
	initialSessions?: readonly ProjectButterSessionItem[];
	placeholders?: ProjectButterPlaceholderMap;
}

export function ProjectButterJiraWorkItem({
	open,
	onClose,
	initialPreset,
	initialSuggestion = false,
	initialPresentation = "full-screen",
	shell = "standalone",
	workItem,
	initialSessions,
	placeholders,
}: Readonly<ProjectButterJiraWorkItemProps>) {
	const [presentation, setPresentation] = useState(initialPresentation);
	const [suggestion, setSuggestion] = useState(initialSuggestion);
	const [empty, setEmpty] = useState(!initialSuggestion && (initialPreset === "empty" || initialPreset === "blank"));
	const [panelOrder, setPanelOrder] = useState(PROJECT_BUTTER_PANEL_ORDER);
	const filledContent = useProjectButterContent(
		initialPreset === "running" ? "running" : "filled",
		workItem,
		initialSessions,
		placeholders,
	);
	const emptyContent = useProjectButterContent("empty", workItem, undefined, placeholders);
	const suggestionContent = useProjectButterContent("empty", workItem, undefined, placeholders, true);
	const filledSessions = useProjectButterSessions(
		initialPreset === "running" ? "running" : "filled",
		workItem?.code,
		initialSessions,
	);
	const emptySessions = useProjectButterSessions("empty", workItem?.code);
	const sparse = empty || suggestion;
	const content = suggestion ? suggestionContent : empty ? emptyContent : filledContent;
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
		setEmpty(next);
		if (next) setSuggestion(false);
	}
	function changeSuggestion(next: boolean) {
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
		addInvocation(model.startAgent(agent, content.summary));
	}
	function startCoding() {
		addInvocation(model.startCoding());
	}
	function reply() {
		if (!activeSession || !drafts[activeSession.id]?.trim()) return;
		replyToSession(activeSession);
		addInvocation({ ...activeSession, state: "running" });
	}
	const sidePanel = presentation === "side-panel";
	const details = (
		<ProjectButterDetails
			code={workItem?.code ?? "VITA-1"}
			content={content}
			empty={sparse}
			onPanelOrderChange={setPanelOrder}
			onStartCoding={startCoding}
			panelOrder={panelOrder}
			sidePanel={sidePanel}
			suggestion={suggestion}
		/>
	);
	return (
		<ProjectButterShell
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
				onOpenSession={(session) => setActiveSessionId(session.id)}
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
			>
				<div
					className={cn(
						"min-w-0 px-6 pb-8",
						!sidePanel && "@[860px]/butter:overflow-y-auto",
					)}
				>
					<ProjectButterBody
						key={workItem?.code ?? "reference"}
						active={open}
						sidePanel={sidePanel}
						content={content}
						details={sidePanel ? details : null}
						empty={sparse}
						onOpenSession={setActiveSessionId}
						sessions={sessions}
					/>
				</div>
				{sidePanel ? null : (
					<div className="min-w-0 px-6 pb-8 @[860px]/butter:overflow-y-auto">{details}</div>
				)}
			</div>
			<ProjectButterSessionChat
				onClose={() => setActiveSessionId(null)}
				open={open && Boolean(activeSession)}
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
