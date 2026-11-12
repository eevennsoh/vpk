"use client";

import CrossIcon from "@atlaskit/icon/core/cross";
import FileIcon from "@atlaskit/icon/core/file";
import SubtasksIcon from "@atlaskit/icon/core/subtasks";
import WorkItemsIcon from "@atlaskit/icon/core/work-items";
import AiSparkleIcon from "@atlaskit/icon/core/ai-sparkle";
import { Button } from "@/components/ui/button";
import type { ProjectButterRelatedKind } from "@/components/blocks/jira-work-item/project-butter-v1/related-model";
import { cn } from "@/lib/utils";

const EMPTY_STATES = {
	attachments: { action: "Add attachment", Icon: FileIcon, circle: "bg-bg-accent-purple-subtle", hover: "group-hover/empty-state:-rotate-[18.761deg]" },
	children: { action: "Create subitems", Icon: SubtasksIcon, circle: "bg-bg-accent-lime-subtle", hover: "group-hover/empty-state:rotate-0" },
	linked: { action: "Link work items", Icon: WorkItemsIcon, circle: "bg-bg-accent-lime-subtle", hover: "group-hover/empty-state:rotate-30" },
} as const;

/**
 * Empty state row for a related group when nothing is related yet (the reference SectionEmptyState).
 * `onAdd` opens the group's inline composer; `onDismiss`, when supplied, hides the group for the session.
 */
export function RelatedEmptyState({ kind, onAdd, onDismiss }: Readonly<{
	kind: ProjectButterRelatedKind;
	onAdd: () => void;
	onDismiss?: () => void;
}>) {
	const { action, Icon, circle, hover } = EMPTY_STATES[kind];
	return (
		<div className="group/empty-state relative flex min-h-20 items-center justify-center rounded-xl border border-dashed border-border py-2" data-related-empty={kind}>
			{onDismiss ? <div className="absolute top-2 right-2"><Button aria-label="Dismiss" onClick={onDismiss} size="icon-compact" type="button" variant="ghost"><span className="text-icon-subtlest"><CrossIcon label="" size="small" /></span></Button></div> : null}
			<div aria-hidden className="relative flex size-12 shrink-0 items-center justify-center">
				<span className="absolute top-1 left-1 scale-0 text-icon-subtlest opacity-0 transition-[opacity,scale] duration-slow ease-spring group-hover/empty-state:scale-100 group-hover/empty-state:opacity-100"><AiSparkleIcon label="" size="small" /></span>
				<span className={cn("flex size-6 rotate-[20.761deg] items-center justify-center rounded-full text-icon transition-[rotate] duration-medium ease-spring", circle, hover)}><Icon label="" size="small" /></span>
			</div>
			<Button data-related-add onClick={onAdd} type="button" variant="ghost">{action}</Button>
		</div>
	);
}
