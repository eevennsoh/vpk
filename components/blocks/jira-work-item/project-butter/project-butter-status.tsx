"use client";

import EyeOpenIcon from "@atlaskit/icon/core/eye-open";
import StatusInProgressIcon from "@atlaskit/icon-lab/core/status-workflow-in-progress";
import StatusSuccessIcon from "@atlaskit/icon/core/status-success";
import TaskToDoIcon from "@atlaskit/icon/core/task-to-do";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LozengeDropdownTrigger } from "@/components/ui/lozenge";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import { cn } from "@/lib/utils";

const PHASES = ["To do", "In progress", "In review", "Done"] as const;

export function ProjectButterStatus({ content }: Readonly<{ content: ProjectButterContent }>) {
	const status = content.status;
	const StatusIcon = status === "Done" ? StatusSuccessIcon : status === "To do" ? TaskToDoIcon : StatusInProgressIcon;
	const variant = status === "Done" ? "success" : status === "To do" ? "neutral" : "information";
	return (
		<div className={cn("flex min-h-14 min-w-0 items-center justify-between gap-3 rounded-lg p-3", status === "Done" ? "bg-bg-success" : status === "To do" ? "bg-surface-sunken" : "bg-bg-selected")} data-project-butter-status>
			<DropdownMenu>
				<DropdownMenuTrigger render={<LozengeDropdownTrigger aria-label={`Change status, ${status}`} icon={<StatusIcon color="currentColor" label="" size="small" />} size="spacious" variant={variant} />}>{status}</DropdownMenuTrigger>
				<DropdownMenuContent align="start" positionerClassName="z-[650]">{PHASES.map((phase) => <DropdownMenuItem key={phase} onSelect={() => content.setStatus(phase)} selected={status === phase}>{phase}</DropdownMenuItem>)}</DropdownMenuContent>
			</DropdownMenu>
			<div className="flex shrink-0 items-center gap-1">
				<Button aria-label={`${content.watching ? "Stop watching" : "Watch"} work item. ${4 + Number(content.watching)} watchers`} aria-pressed={content.watching} onClick={() => content.setWatching((value) => !value)} size="compact" type="button" variant="ghost"><EyeOpenIcon label="" size="small" />{4 + Number(content.watching)}</Button>
				<DropdownMenu><DropdownMenuTrigger render={<Button aria-label="More work item actions" size="icon-compact" type="button" variant="ghost" />}><ShowMoreHorizontalIcon label="" size="small" /></DropdownMenuTrigger><DropdownMenuContent align="end" positionerClassName="z-[650]"><DropdownMenuItem onSelect={() => navigator.clipboard.writeText(`${location.origin}${location.pathname}#project-butter`)}>Copy link</DropdownMenuItem><DropdownMenuCheckboxItem checked={content.watching} onCheckedChange={content.setWatching}>Watch work item</DropdownMenuCheckboxItem><DropdownMenuCheckboxItem checked={content.flagged} onCheckedChange={content.setFlagged}>Flag work item</DropdownMenuCheckboxItem></DropdownMenuContent></DropdownMenu>
			</div>
		</div>
	);
}
