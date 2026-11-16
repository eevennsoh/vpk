"use client";

import AttachmentIcon from "@atlaskit/icon/core/attachment";
import SubtasksIcon from "@atlaskit/icon/core/subtasks";
import WorkItemIcon from "@atlaskit/icon/core/work-item";
import type { RelatedSummaryItem } from "@/components/blocks/jira-work-item/project-butter/related-work-model";
import type { ProjectButterRelatedKind } from "@/components/blocks/jira-work-item/project-butter/related-model";
import { Toggle } from "@/components/ui/toggle";
import { RelatedTooltip } from "@/components/blocks/jira-work-item/project-butter/related-tooltip";

const ICONS = { attachments: AttachmentIcon, children: SubtasksIcon, linked: WorkItemIcon } as const;

export function RelatedWorkToggles({ items, open, onOpenChange }: Readonly<{
	items: readonly RelatedSummaryItem[];
	open: Readonly<Record<ProjectButterRelatedKind, boolean>>;
	onOpenChange: (kind: ProjectButterRelatedKind, open: boolean) => void;
}>) {
	if (items.length === 0) return null;
	return (
		<div aria-label="Work item sections" className="-ml-2 flex flex-wrap items-center gap-1" role="group">
			{items.map(({ count, kind, label }) => {
				const Icon = ICONS[kind];
				return (
					<RelatedTooltip key={kind} label={label}>
						<Toggle aria-controls={kind === "attachments" ? "section-attachments" : kind === "children" ? "section-subitems" : "section-linked-items"} aria-expanded={open[kind]} aria-label={label} className="font-normal" onPressedChange={(value) => onOpenChange(kind, value)} pressed={open[kind]} variant="subtle">
							<Icon label="" size="small" />
							<span className="tabular-nums">{open[kind] ? label : count}</span>
						</Toggle>
					</RelatedTooltip>
				);
			})}
		</div>
	);
}
