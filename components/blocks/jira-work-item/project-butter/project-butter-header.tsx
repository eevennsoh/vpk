"use client";

import type { ReactNode } from "react";
import CloseIcon from "@atlaskit/icon/core/close";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import EyeOpenIcon from "@atlaskit/icon/core/eye-open";
import LockUnlockedIcon from "@atlaskit/icon/core/lock-unlocked";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import ShrinkDiagonalIcon from "@atlaskit/icon/core/shrink-diagonal";
import ThumbsUpIcon from "@atlaskit/icon/core/thumbs-up";
import type { WorkItemData } from "@/app/contexts/context-work-item-modal";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import { ProjectButterBreadcrumb } from "@/components/blocks/jira-work-item/project-butter/project-butter-breadcrumb";
import { ProjectButterCrew } from "@/components/blocks/jira-work-item/project-butter/project-butter-crew";
import { ProjectButterSummary } from "@/components/blocks/jira-work-item/project-butter/project-butter-summary";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ProjectButterStatus } from "@/components/blocks/jira-work-item/project-butter/project-butter-status";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import type { ProjectButterPresentation } from "@/components/blocks/jira-work-item/project-butter/presentation";
import { cn } from "@/lib/utils";

export function ProjectButterHeader({ content, empty, onBrowseAgents, onCreateAgent, onClose, onOpenSession, onPresentationChange, onStartAgent, onStartCoding, presentation, secondaryActions, sessions, workItem }: Readonly<{
	onBrowseAgents?: () => void;
	onCreateAgent?: () => void;
	content: ProjectButterContent;
	empty: boolean;
	onClose: () => void;
	onOpenSession: (session: AgentSessionItem) => void;
	onPresentationChange: (presentation: ProjectButterPresentation) => void;
	onStartAgent?: (agent: AgentSessionItem["agent"]) => void;
	onStartCoding: () => void;
	presentation: ProjectButterPresentation;
	secondaryActions?: ReactNode;
	sessions: readonly AgentSessionItem[];
	workItem?: WorkItemData;
}>) {
	const sidePanel = presentation === "side-panel";
	const code = workItem?.code ?? "VITA-1";
	return (
		<header className="relative shrink-0">
			{sidePanel ? null : (
				<div className="flex min-h-8 items-center justify-between gap-2 px-6 pt-6" data-project-butter-header-key-row>
					<ProjectButterBreadcrumb aligned code={code} parent={content.detailFields.parent} summary={content.summary} />
					{presentation === "full-screen" ? null : (
						<div className="flex shrink-0 items-center gap-1">
							<Button aria-label="Collapse work item" onClick={() => onPresentationChange("side-panel")} size="icon" type="button" variant="ghost">
								<ShrinkDiagonalIcon label="" />
							</Button>
							<Button aria-label="Close Project butter work item" onClick={onClose} size="icon" type="button" variant="ghost"><CloseIcon label="" /></Button>
						</div>
					)}
				</div>
			)}
			<div className={cn("min-w-0 px-6 pb-6", sidePanel ? "pt-6" : "pt-4")}>
				{sidePanel ? <ProjectButterBreadcrumb code={code} parent={content.detailFields.parent} summary={content.summary} /> : null}
				<div className={cn("flex min-w-0 items-start gap-2", sidePanel ? "flex-col gap-3" : null)}>
					<div className="min-w-0 flex-1">
						<div className="flex h-8 min-w-0 items-center gap-2.5">
							<ProjectButterStatus content={content} />
							<ProjectButterSummary content={content} key={workItem?.code ?? "reference"} />
						</div>
						{secondaryActions}
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<div aria-label="Work item agents" className="flex items-center" role="group"><ProjectButterCrew assignee={workItem ? content.assignee : undefined} onBrowseAgents={onBrowseAgents} onCreateAgent={onCreateAgent} onOpenSession={onOpenSession} onStartAgent={onStartAgent ?? onStartCoding} sessions={sessions} useReferenceCrew={!empty && !workItem} /></div>
						<DropdownMenu>
							<DropdownMenuTrigger render={<Button aria-label="More work item actions" size="icon" type="button" variant="ghost" />}><ShowMoreHorizontalIcon label="" size="small" /></DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="max-h-[var(--available-height)] w-72" positionerClassName="z-[650]">
								<DropdownMenuItem>Log work</DropdownMenuItem>
								<DropdownMenuItem onSelect={() => content.setFlagged(!content.flagged)}>{content.flagged ? "Remove flag" : "Add flag"}</DropdownMenuItem>
								<DropdownMenuItem elemAfter={<EyeOpenIcon label="" size="small" />} onSelect={() => content.setWatching(!content.watching)}>{content.watching ? "Stop watching (4)" : "Start watching (4)"}</DropdownMenuItem>
								<DropdownMenuItem elemAfter={<ThumbsUpIcon label="" size="small" />}>Add vote (2)</DropdownMenuItem>
								<DropdownMenuItem elemAfter={<LockUnlockedIcon label="" size="small" />}>Add restriction</DropdownMenuItem>
								<DropdownMenuItem elemAfter={<ChevronRightIcon label="" size="small" />}>Select cover</DropdownMenuItem>
								<DropdownMenuItem elemAfter={<ChevronRightIcon label="" size="small" />}>Classify work item</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem>Clone</DropdownMenuItem>
								<DropdownMenuItem>Move</DropdownMenuItem>
								<DropdownMenuItem>Convert to subtask</DropdownMenuItem>
								<DropdownMenuItem elemAfter={<DropdownMenuShortcut>⌘K</DropdownMenuShortcut>}>Open command palette</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem>Archive</DropdownMenuItem>
								<DropdownMenuItem>Delete</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem>Connect Slack channel</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem>Print</DropdownMenuItem>
								<DropdownMenuItem elemAfter={<ChevronRightIcon label="" size="small" />}>Export to</DropdownMenuItem>
								<DropdownMenuItem elemAfter={<ChevronRightIcon label="" size="small" />}>Share</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem>Give feedback</DropdownMenuItem>
								<DropdownMenuItem>Switch to classic experience</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			</div>
		</header>
	);
}
