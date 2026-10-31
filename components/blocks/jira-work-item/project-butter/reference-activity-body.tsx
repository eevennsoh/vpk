"use client";

import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import { MessageResponse } from "@/components/ui-custom/message";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { ProjectButterReferenceChange } from "@/components/blocks/jira-work-item/project-butter/reference-model";

export function ProjectButterHistoryChange({ item, timestamp }: Readonly<{ item: ProjectButterReferenceChange; timestamp: string }>) {
	return (
		<Collapsible className="min-w-0 py-1">
			<CollapsibleTrigger className="group flex w-full min-w-0 items-start gap-1 rounded-sm py-1 text-left text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-ring"><strong className="shrink-0 font-medium">{item.actor}</strong><span className="min-w-0">{item.action}</span><span className="shrink-0 text-xs text-text-subtlest">{timestamp}</span><ChevronRightIcon label="" size="small" /></CollapsibleTrigger>
			<CollapsibleContent className="pt-2">
				<dl className="space-y-3 rounded-lg bg-surface-sunken p-3 text-sm text-text">{item.changes.map((change, index) => <div className="space-y-1" key={`${change.label}-${index}`}><dt className="font-medium text-text-subtle">{change.label}</dt><dd className="whitespace-pre-wrap">{change.before ? <span className="mr-2 bg-bg-danger text-text-danger line-through">{change.before}</span> : null}{change.after ? <span className="bg-bg-success text-text-success">{change.after}</span> : <span className="text-text-subtlest">Removed</span>}</dd></div>)}</dl>
			</CollapsibleContent>
		</Collapsible>
	);
}

export function ProjectButterReferenceCommentBody({ markdown }: Readonly<{ markdown: string }>) {
	return <MessageResponse>{markdown}</MessageResponse>;
}
