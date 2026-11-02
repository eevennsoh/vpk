"use client";

import { useId } from "react";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";

import { ContextDescriptionEditor } from "@/components/blocks/jira-work-item/team-eu26/components/context-description-editor";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export function ProjectButterDescription({ content, empty }: Readonly<{ content: ProjectButterContent; empty: boolean }>) {
	const id = useId();
	const save = () => {
		content.setDescription(content.descriptionDraft);
		content.setEditingDescription(false);
	};
	return (
		<Collapsible defaultOpen onOpenChange={(open) => { if (!open) save(); }}>
			<section aria-labelledby={`${id}-description`}>
				<h2 id={`${id}-description`}>
					<CollapsibleTrigger className="group flex items-center gap-2 rounded-sm text-left text-sm font-medium text-text outline-none focus-visible:ring-2 focus-visible:ring-ring">
						Description<span className="text-icon-subtle group-data-[panel-open]:rotate-90"><ChevronRightIcon label="" size="small" /></span>
					</CollapsibleTrigger>
				</h2>
				<CollapsibleContent className="-mx-1 px-1 pb-1 pt-2" hiddenUntilFound={false} keepMounted>
					<div
						aria-label="Description editor"
						className="min-w-0 rounded-sm focus-within:ring-2 focus-within:ring-ring"
						onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) save(); }}
						onFocusCapture={() => content.setEditingDescription(true)}
						role="group"
					>
						<ContextDescriptionEditor
							aria-label="Work item description"
							hugContent={empty}
							onMarkdownChange={content.setDescriptionDraft}
							placeholder="Add a description"
							placeholderSlot={null}
							value={content.descriptionDraft}
						/>
					</div>
				</CollapsibleContent>
			</section>
		</Collapsible>
	);
}
