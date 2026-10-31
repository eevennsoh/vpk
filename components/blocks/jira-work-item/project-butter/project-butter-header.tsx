"use client";

import AddIcon from "@atlaskit/icon/core/add";
import CloseIcon from "@atlaskit/icon/core/close";
import StoryIcon from "@atlaskit/icon/core/story";
import TaskIcon from "@atlaskit/icon/core/task";
import type { WorkItemData } from "@/app/contexts/context-work-item-modal";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import { ProjectButterCrew } from "@/components/blocks/jira-work-item/project-butter/project-butter-crew";
import { Button } from "@/components/ui/button";
import { ProjectButterStatus } from "@/components/blocks/jira-work-item/project-butter/project-butter-status";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import type { ProjectButterPresentation } from "@/components/blocks/jira-work-item/project-butter/presentation";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

export function ProjectButterHeader({ content, empty, onClose, onExpand, onOpenSession, onStartCoding, presentation, sessions, workItem }: Readonly<{
	content: ProjectButterContent;
	empty: boolean;
	onClose: () => void;
	onExpand: () => void;
	onOpenSession: (session: AgentSessionItem) => void;
	onStartCoding: () => void;
	presentation: ProjectButterPresentation;
	sessions: readonly AgentSessionItem[];
	workItem?: WorkItemData;
}>) {
	const sidePanel = presentation === "side-panel";
	return (
		<header className="relative shrink-0">
			{sidePanel ? null : <Button aria-label="Close Project butter work item" className="absolute right-1 top-1" onClick={onClose} size="icon" type="button" variant="ghost"><CloseIcon label="" size="small" /></Button>}
			{sidePanel ? (
				<div className="flex items-center justify-between border-b border-border px-4 py-3">
					<span className="flex items-center gap-2 text-sm font-semibold"><TaskIcon label="" size="small" />Jira work item</span>
					<div className="flex items-center gap-1">
						<Button onClick={onExpand} size="compact" type="button" variant="ghost">Full screen</Button>
						<Button aria-label="Close Project butter work item" onClick={onClose} size="icon" type="button" variant="ghost"><CloseIcon label="" size="small" /></Button>
					</div>
				</div>
			) : null}
			<div className={cn("flex min-w-0 gap-6 px-6 pb-6 pt-6", sidePanel ? "flex-col" : "@[860px]/butter:px-9")}>
				<div className="min-w-0 flex-1">
					<div className="mb-3 flex items-center gap-2 text-xs text-text-subtle"><span className="text-icon-success"><StoryIcon label="Story" size="small" /></span>{workItem?.code ?? "VITA-1"}</div>
					<h1 className="text-text" style={{ font: token("font.heading.medium") }}>{workItem?.title ?? "Redesign onboarding flow for new users"}</h1>
				</div>
				<div className={cn("flex shrink-0 flex-col items-end gap-3", sidePanel ? "w-full" : "w-[min(420px,45%)]")}>
					<div className="w-full"><ProjectButterStatus content={content} /></div>
					<div aria-label="Work item agents" className="flex items-center -space-x-1" role="group">
						{empty && sessions.length === 0 ? null : <ProjectButterCrew assignee={workItem ? content.assignee : undefined} onOpenSession={onOpenSession} sessions={sessions} useReferenceCrew={!workItem} />}
						{(empty || workItem) && sessions.length === 0 ? <Button aria-label="Add agent" onClick={onStartCoding} size="icon" type="button" variant="ghost"><AddIcon label="" size="small" /></Button> : null}
					</div>
				</div>
			</div>
		</header>
	);
}
