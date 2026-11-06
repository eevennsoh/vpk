"use client";

import StatusWorkflowInProgressIcon from "@atlaskit/icon-lab/core/status-workflow-in-progress";
import StatusSuccessIcon from "@atlaskit/icon/core/status-success";
import TaskToDoIcon from "@atlaskit/icon/core/task-to-do";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ProjectButterStatusGlyph } from "@/components/blocks/jira-work-item/project-butter/project-butter-status";
import { RelatedTooltip } from "@/components/blocks/jira-work-item/project-butter/related-tooltip";
import { RELATED_STATUSES, type ProjectButterRelatedStatus } from "@/components/blocks/jira-work-item/project-butter/related-model";

/** Static menu icon for a related status (reference renderProgressStatusIcon). */
export function RelatedStatusIcon({ status }: Readonly<{ status: ProjectButterRelatedStatus }>) {
	if (status === "Done") return <span className="flex shrink-0 text-icon-success"><StatusSuccessIcon color="currentColor" label="" size="small" /></span>;
	if (status === "In progress") return <span className="flex shrink-0 text-icon-information"><StatusWorkflowInProgressIcon color="currentColor" label="" size="small" /></span>;
	return <span className="flex shrink-0 text-icon-subtle"><TaskToDoIcon color="currentColor" label="" size="small" /></span>;
}

/** Icon-only status picker for a related row with a three-item menu. */
export function RelatedStatusField({ itemKey, onChange, status }: Readonly<{ itemKey: string; onChange: (status: ProjectButterRelatedStatus) => void; status: ProjectButterRelatedStatus }>) {
	return (
		<RelatedTooltip label={status} side="bottom">
			<DropdownMenu>
				<DropdownMenuTrigger render={<Button aria-label={`Edit status for ${itemKey}, ${status}`} className="-mx-1.5" size="icon-compact" type="button" variant="ghost" />}>
					<ProjectButterStatusGlyph animated={false} status={status} />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }} positionerClassName="z-[650]">
					{RELATED_STATUSES.map((option) => (
						<DropdownMenuItem key={option} onSelect={() => onChange(option)} selected={option === status}>
							<span className="flex items-center gap-2"><RelatedStatusIcon status={option} />{option}</span>
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
		</RelatedTooltip>
	);
}
