"use client";

import AttachmentIcon from "@atlaskit/icon/core/attachment";
import SubtasksIcon from "@atlaskit/icon/core/subtasks";
import WorkItemIcon from "@atlaskit/icon/core/work-item";
import type { RelatedSummaryItem } from "@/components/blocks/jira-work-item/project-butter-v1/related-work-model";

const ICONS = { attachments: AttachmentIcon, children: SubtasksIcon, linked: WorkItemIcon } as const;

/** Icon + count chips shown beside the Related work title while it is collapsed. Not interactive. */
export function RelatedWorkCollapsedSummary({ items }: Readonly<{ items: readonly RelatedSummaryItem[] }>) {
	if (items.length === 0) return null;
	return (
		<ul aria-label={items.map((item) => item.label).join(", ")} className="flex h-6 list-none items-center gap-3" data-component="RelatedWorkCollapsedSummary">
			{items.map(({ count, kind }) => {
				const Icon = ICONS[kind];
				return (
					<li className="inline-flex h-6 items-center gap-1 text-icon-subtlest" key={kind}>
						<Icon label="" size="small" />
						<span className="text-sm leading-5 text-text-subtlest tabular-nums">{count}</span>
					</li>
				);
			})}
		</ul>
	);
}
