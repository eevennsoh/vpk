"use client";

import { useState } from "react";
import StatusSuccessIcon from "@atlaskit/icon/core/status-success";
import TaskToDoIcon from "@atlaskit/icon/core/task-to-do";
import StatusWorkflowInProgressIcon from "@atlaskit/icon-lab/core/status-workflow-in-progress";
import { Avatar, AvatarFallback, AvatarImage, AvatarUnassigned } from "@/components/ui/avatar";
import { dropdownStyles } from "@/components/ui/dropdown-menu";
import { FOCUS_RING_VISIBLE } from "@/components/ui/focus-ring";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Tag } from "@/components/ui/tag";
import { ProgressCircle } from "@/components/ui-custom/progress-circle";
import { cn } from "@/lib/utils";
import type { JiraIssueSubtask } from "./index";
import { ButterPriorityIcon } from "./priority";
import { getButterSubtaskProgress, getButterSubtaskState } from "./project-butter-model";

const SUBTASK_STATUS_PRESENTATIONS = {
	todo: { Icon: TaskToDoIcon, colorClassName: "shrink-0 text-icon-subtle" },
	"in-progress": { Icon: StatusWorkflowInProgressIcon, colorClassName: "shrink-0 text-icon-information" },
	done: { Icon: StatusSuccessIcon, colorClassName: "shrink-0 text-icon-success" },
};

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
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
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
			</PopoverTrigger>
			<PopoverContent
				align="start"
				aria-label="Subtasks"
				className="w-[300px] max-w-[calc(100vw-32px)] gap-0 p-1"
				onClick={(event) => event.stopPropagation()}
				onPointerDown={(event) => event.stopPropagation()}
			>
				<PopoverTitle className={dropdownStyles.label}>Subtasks</PopoverTitle>
				<ul className="-m-1 max-h-[400px] overflow-y-auto overscroll-contain p-1">
					{subtasks.map((subtask) => {
						const { Icon: StatusIcon, colorClassName } =
							SUBTASK_STATUS_PRESENTATIONS[getButterSubtaskState(subtask.status)];
						return (
							<li key={subtask.issueKey}>
								<button
									type="button"
									disabled={!onSubtaskOpen}
									aria-label={`Open ${subtask.issueKey}: ${subtask.summary}`}
									className="flex h-8 w-full items-center gap-2 rounded-md p-2 text-left outline-none hover:bg-bg-neutral-subtle-hovered focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default"
									onClick={() => {
										setOpen(false);
										onSubtaskOpen?.(subtask);
									}}
								>
									<span className="flex shrink-0 items-center gap-1">
										<span className={cn("flex size-4 shrink-0 items-center justify-center", colorClassName)}>
											<StatusIcon label={subtask.status ?? "To Do"} size="small" color="currentColor" />
										</span>
										<span className="shrink-0 text-xs text-text-subtlest">{subtask.issueKey}</span>
									</span>
									<span className="min-w-0 flex-1 truncate text-sm leading-4">{subtask.summary}</span>
									<ButterPriorityIcon priority={subtask.priority ?? "medium"} />
									{subtask.assigneeAvatarSrc ? (
										<Avatar label={subtask.assigneeAvatarLabel ?? subtask.issueKey} size="xs">
											<AvatarImage src={subtask.assigneeAvatarSrc} alt="" />
											<AvatarFallback>{subtask.assigneeAvatarLabel?.slice(0, 1)}</AvatarFallback>
										</Avatar>
									) : (
										<AvatarUnassigned size="xs" kind={subtask.assigneeUnassignedKind ?? "person"} />
									)}
								</button>
							</li>
						);
					})}
				</ul>
			</PopoverContent>
		</Popover>
	);
}
