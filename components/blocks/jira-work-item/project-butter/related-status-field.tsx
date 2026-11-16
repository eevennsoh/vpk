"use client";

import StatusWorkflowInProgressIcon from "@atlaskit/icon-lab/core/status-workflow-in-progress";
import StatusSuccessIcon from "@atlaskit/icon/core/status-success";
import TaskToDoIcon from "@atlaskit/icon/core/task-to-do";
import { LozengeDropdownTrigger } from "@/components/ui/lozenge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ProjectButterStatusGlyph } from "@/components/blocks/jira-work-item/project-butter/project-butter-status";
import { RELATED_STATUSES, type ProjectButterRelatedStatus } from "@/components/blocks/jira-work-item/project-butter/related-model";

/** Static menu icon for a related status (reference renderProgressStatusIcon). */
export function RelatedStatusIcon({ status }: Readonly<{ status: ProjectButterRelatedStatus }>) {
	if (status === "Done") return <span className="flex shrink-0 text-icon-success"><StatusSuccessIcon color="currentColor" label="" size="small" /></span>;
	if (status === "In progress") return <span className="flex shrink-0 text-icon-information"><StatusWorkflowInProgressIcon color="currentColor" label="" size="small" /></span>;
	return <span className="flex shrink-0 text-icon-subtle"><TaskToDoIcon color="currentColor" label="" size="small" /></span>;
}

/** Status lozenge using the Jira list trigger and the related row's three statuses. */
export function RelatedStatusField({ itemKey, onChange, status }: Readonly<{ itemKey: string; onChange: (status: ProjectButterRelatedStatus) => void; status: ProjectButterRelatedStatus }>) {
	return (
			<DropdownMenu>
				<DropdownMenuTrigger render={<LozengeDropdownTrigger aria-label={`Edit status for ${itemKey}, ${status}`} icon={<ProjectButterStatusGlyph animated={false} status={status} />} variant={status === "Done" ? "success" : status === "In progress" ? "information" : "neutral"} />}>
					{status}
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }} positionerClassName="z-[650]">
					{RELATED_STATUSES.map((option) => (
						<DropdownMenuItem key={option} onSelect={() => onChange(option)} selected={option === status}>
							<span className="flex items-center gap-2"><RelatedStatusIcon status={option} />{option}</span>
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
	);
}
