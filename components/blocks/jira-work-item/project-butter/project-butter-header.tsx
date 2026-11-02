"use client";

import type { ReactNode } from "react";
import CloseIcon from "@atlaskit/icon/core/close";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import TaskIcon from "@atlaskit/icon/core/task";
import type { WorkItemData } from "@/app/contexts/context-work-item-modal";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import { ProjectButterBreadcrumb } from "@/components/blocks/jira-work-item/project-butter/project-butter-breadcrumb";
import { ProjectButterCrew } from "@/components/blocks/jira-work-item/project-butter/project-butter-crew";
import { ProjectButterSummary } from "@/components/blocks/jira-work-item/project-butter/project-butter-summary";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ProjectButterStatus } from "@/components/blocks/jira-work-item/project-butter/project-butter-status";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import type { ProjectButterPresentation } from "@/components/blocks/jira-work-item/project-butter/presentation";
import { cn } from "@/lib/utils";

export function ProjectButterHeader({ content, empty, onClose, onExpand, onOpenSession, onStartAgent, onStartCoding, presentation, secondaryActions, sessions, workItem }: Readonly<{
	content: ProjectButterContent;
	empty: boolean;
	onClose: () => void;
	onExpand: () => void;
	onOpenSession: (session: AgentSessionItem) => void;
	onStartAgent?: (agent: AgentSessionItem["agent"]) => void;
	onStartCoding: () => void;
	presentation: ProjectButterPresentation;
	secondaryActions?: ReactNode;
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
			<div className={cn("min-w-0 px-6 pb-6 pt-6", sidePanel ? null : "@[860px]/butter:px-9")}>
				<ProjectButterBreadcrumb code={workItem?.code ?? "VITA-1"} parent={content.detailFields.parent} summary={content.summary} />
				<div className={cn("flex min-w-0 items-start gap-2", sidePanel ? "flex-col gap-3" : null)}>
					<div className="min-w-0 flex-1">
						<div className="flex min-h-10 min-w-0 items-center gap-2.5 py-1">
							<ProjectButterStatus content={content} />
							<ProjectButterSummary content={content} key={workItem?.code ?? "reference"} />
						</div>
						{secondaryActions}
					</div>
					<div className="flex shrink-0 items-center gap-2 py-1">
						<div aria-label="Work item agents" className="flex items-center" role="group"><ProjectButterCrew assignee={workItem ? content.assignee : undefined} onOpenSession={onOpenSession} onStartAgent={onStartAgent ?? onStartCoding} sessions={sessions} useReferenceCrew={!empty && !workItem} /></div>
						<DropdownMenu>
							<DropdownMenuTrigger render={<Button aria-label="More work item actions" size="icon" type="button" variant="ghost" />}><ShowMoreHorizontalIcon label="" size="small" /></DropdownMenuTrigger>
							<DropdownMenuContent align="end" positionerClassName="z-[650]">
								<DropdownMenuItem onSelect={() => navigator.clipboard.writeText(`${location.origin}${location.pathname}#project-butter`)}>Copy link</DropdownMenuItem>
								<DropdownMenuCheckboxItem checked={content.watching} onCheckedChange={content.setWatching}>Watch work item</DropdownMenuCheckboxItem>
								<DropdownMenuCheckboxItem checked={content.flagged} onCheckedChange={content.setFlagged}>Flag work item</DropdownMenuCheckboxItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			</div>
		</header>
	);
}
