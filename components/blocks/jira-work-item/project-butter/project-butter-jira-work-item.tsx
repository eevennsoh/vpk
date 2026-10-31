"use client";

import { useState } from "react";
import type { WorkItemData } from "@/app/contexts/context-work-item-modal";
import type { ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";

import type { JiraWorkItemPreset } from "@/components/blocks/jira-work-item/data/session-state";

import { ProjectButterShell } from "@/components/blocks/jira-work-item/project-butter/project-butter-shell";
import type { ProjectButterPresentation } from "@/components/blocks/jira-work-item/project-butter/presentation";
import { useProjectButterSessions } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-sessions";
import { cn } from "@/lib/utils";
import { ProjectButterBody } from "@/components/blocks/jira-work-item/project-butter/project-butter-body";
import { ProjectButterDetails } from "@/components/blocks/jira-work-item/project-butter/project-butter-details";
import { ProjectButterHeader } from "@/components/blocks/jira-work-item/project-butter/project-butter-header";
import { ProjectButterSession } from "@/components/blocks/jira-work-item/project-butter/project-butter-session";
import { useProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import { PROJECT_BUTTER_PANEL_ORDER } from "@/components/blocks/jira-work-item/project-butter/panel-order";

export interface ProjectButterJiraWorkItemProps {
	open: boolean;
	onClose: () => void;
	initialPreset: JiraWorkItemPreset;
	initialPresentation?: ProjectButterPresentation;
	workItem?: WorkItemData;
	initialSessions?: readonly ProjectButterSessionItem[];
}

export function ProjectButterJiraWorkItem({ open, onClose, initialPreset, initialPresentation = "full-screen", workItem, initialSessions }: Readonly<ProjectButterJiraWorkItemProps>) {
	const [presentation, setPresentation] = useState(initialPresentation);
	const [empty, setEmpty] = useState(initialPreset === "empty" || initialPreset === "blank");
	const [panelOrder, setPanelOrder] = useState(PROJECT_BUTTER_PANEL_ORDER);
	const filledContent = useProjectButterContent("filled", workItem);
	const emptyContent = useProjectButterContent("empty", workItem);
	const filledSessions = useProjectButterSessions(initialPreset === "running" ? "running" : "filled", workItem?.code, initialSessions);
	const emptySessions = useProjectButterSessions("empty", workItem?.code);
	const content = empty ? emptyContent : filledContent;
	const model = empty ? emptySessions : filledSessions;
	const { activeSession, activeSessionId, drafts, replies, replyToSession, sessions, setActiveSessionId, setDrafts, startCoding } = model;
	const sidePanel = presentation === "side-panel";
	const details = <ProjectButterDetails content={content} empty={empty} onPanelOrderChange={setPanelOrder} onStartCoding={startCoding} panelOrder={panelOrder} sidePanel={sidePanel} />;
	return (
		<ProjectButterShell empty={empty} onClose={onClose} onEmptyChange={setEmpty} onPresentationChange={setPresentation} open={open} presentation={presentation}>
				<ProjectButterHeader key={workItem?.code ?? "reference"} content={content} empty={empty} onClose={onClose} onExpand={() => setPresentation("full-screen")} onOpenSession={(session) => setActiveSessionId(session.id)} onStartCoding={startCoding} presentation={presentation} sessions={sessions} workItem={workItem} />
				<div className={cn("grid min-h-0 flex-1", sidePanel ? "grid-cols-1 overflow-y-auto" : "grid-cols-1 overflow-y-auto @[860px]/butter:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] @[860px]/butter:overflow-clip")} data-project-butter-work-item>
					<div className={cn("min-w-0 px-6 pb-8", !sidePanel && "@[860px]/butter:overflow-y-auto @[860px]/butter:px-9")}>
						<ProjectButterBody
							key={workItem?.code ?? "reference"}
							active={open}
							sidePanel={sidePanel}
							content={content}
							details={sidePanel ? details : null}
							empty={empty}
							onOpenSession={setActiveSessionId}
							onStartCoding={startCoding}
							selectedSessionId={activeSessionId}
							sessionDetail={activeSession ? (
								<ProjectButterSession
									draft={drafts[activeSession.id] ?? ""}
									onClose={() => setActiveSessionId(null)}
									onDraftChange={(value) => setDrafts((current) => ({ ...current, [activeSession.id]: value }))}
									onReply={() => replyToSession(activeSession)}
									replies={replies[activeSession.id] ?? []}
									session={activeSession}
								/>
							) : null}
							sessions={sessions}
						/>
					</div>
					{sidePanel ? null : <div className="min-w-0 px-6 pb-8 @[860px]/butter:overflow-y-auto">{details}</div>}
				</div>
		</ProjectButterShell>
	);
}
