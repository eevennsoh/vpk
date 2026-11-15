"use client";

import { useState } from "react";
import { ProjectButterStatusGlyph } from "@/components/blocks/jira-work-item/project-butter/project-butter-status";
import { Avatar, AvatarFallback, AvatarImage, AvatarUnassigned } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FOCUS_RING_VISIBLE } from "@/components/ui/focus-ring";
import { Tag } from "@/components/ui/tag";
import { ProgressCircle } from "@/components/ui-custom/progress-circle";
import { cn } from "@/lib/utils";
import type { JiraIssueSubtask } from "./index";
import { ButterPriorityIcon } from "./priority";
import { getButterSubtaskProgress } from "./project-butter-model";

export function ProjectButterSubtaskRowContent({ subtask }: Readonly<{ subtask: JiraIssueSubtask }>) {
	return (
		<span className="flex w-full min-w-0 flex-1 items-center gap-2 [&_[data-slot=subtask-status]_svg]:size-3 [&_[data-slot=subtask-status]_svg]:text-inherit" data-slot="subtask-row-content">
			<span className="flex min-w-0 flex-1 items-center gap-3">
				<span className="inline-flex size-4 shrink-0 items-center justify-center" data-slot="subtask-status">
					<ProjectButterStatusGlyph animated={false} size="xs" status={subtask.status ?? "To do"} />
				</span>
				<span className="flex min-w-0 flex-1 items-center gap-2">
					<span className="shrink-0 text-sm text-text-subtlest" data-slot="subtask-key">{subtask.issueKey}</span>
					<span className="min-w-0 truncate text-sm text-text" data-slot="subtask-summary">{subtask.summary}</span>
				</span>
			</span>
			<span className="ml-auto inline-flex shrink-0 items-center gap-2 [&_[data-slot=subtask-priority]_svg]:size-3 [&_[data-slot=subtask-priority]_svg]:text-inherit">
				<span className="inline-flex size-4 shrink-0 items-center justify-center" data-slot="subtask-priority"><ButterPriorityIcon priority={subtask.priority ?? "medium"} /></span>
				{subtask.assigneeAvatarSrc ? (
					<Avatar label={subtask.assigneeAvatarLabel ?? subtask.issueKey} size="xs">
						<AvatarImage src={subtask.assigneeAvatarSrc} alt="" />
						<AvatarFallback>{subtask.assigneeAvatarLabel?.slice(0, 1)}</AvatarFallback>
					</Avatar>
				) : subtask.assigneeAvatarLabel ? (
					<Avatar label={subtask.assigneeAvatarLabel} size="xs"><AvatarFallback>{subtask.assigneeAvatarLabel.slice(0, 1)}</AvatarFallback></Avatar>
				) : <AvatarUnassigned size="xs" kind={subtask.assigneeUnassignedKind ?? "person"} />}
			</span>
		</span>
	);
}

export function ProjectButterSubtasks({
	subtasks,
	onSubtaskOpen,
}: Readonly<{
	subtasks: readonly JiraIssueSubtask[];
	onSubtaskOpen?: (subtask: JiraIssueSubtask) => void;
}>) {
	const [open, setOpen] = useState(false);
	const progress = getButterSubtaskProgress(subtasks);
	if (progress.total === 0) return null;
	return (
		<DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger
				aria-haspopup="dialog"
				render={
					<button
						type="button"
						aria-label={`${progress.completed} of ${progress.total} subtasks complete`}
						className={cn("inline-flex items-center rounded-sm", FOCUS_RING_VISIBLE)}
						onClick={(event) => event.stopPropagation()}
						onPointerDown={(event) => event.stopPropagation()}
					/>
				}
			>
				<Tag
					elemBefore={
						<span className="flex items-center justify-center">
							<ProgressCircle
								aria-hidden
								animated={false}
								segmented
								segments={progress.segments}
								size="xs"
							/>
						</span>
					}
				>
					{progress.completed}/{progress.total}
				</Tag>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				aria-label="Subtasks"
				role="dialog"
				className="w-[300px] max-w-[calc(100vw-32px)]"
				onClick={(event) => event.stopPropagation()}
				onPointerDown={(event) => event.stopPropagation()}
			>
				<DropdownMenuGroup aria-label="Subtasks" role="menu">
					<DropdownMenuLabel>Subtasks</DropdownMenuLabel>
					{subtasks.map((subtask) => (
							<DropdownMenuItem
								key={subtask.issueKey}
								disabled={!onSubtaskOpen}
								aria-label={`Open ${subtask.issueKey}: ${subtask.summary}`}
								onSelect={() => {
									setOpen(false);
									onSubtaskOpen?.(subtask);
								}}
							>
								<ProjectButterSubtaskRowContent subtask={subtask} />
							</DropdownMenuItem>
					))}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
