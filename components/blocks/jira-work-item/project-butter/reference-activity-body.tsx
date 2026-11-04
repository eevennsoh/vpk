"use client";

import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import { MessageResponse } from "@/components/ui-custom/message";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { mentionSegmentForActor } from "@/components/blocks/jira-activity/jira-activity-actor-mention";
import { JiraActivitySegments } from "@/components/blocks/jira-activity/jira-activity-segments";
import type { JiraActivityActor } from "@/components/blocks/jira-activity";
import type { ProjectButterReferenceChange } from "@/components/blocks/jira-work-item/project-butter/reference-model";

export function ProjectButterHistoryChange({ actor, item, timestamp, defaultOpen = false }: Readonly<{ actor: JiraActivityActor; item: ProjectButterReferenceChange; timestamp: string; defaultOpen?: boolean }>) {
	return (
		<Collapsible className="min-w-0" defaultOpen={defaultOpen}>
			<CollapsibleTrigger className="group flex min-h-6 w-full min-w-0 items-center gap-1 rounded-sm text-left text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-ring"><JiraActivitySegments className="inline-flex shrink-0 items-center [&_[data-tag-text]]:[text-box:trim-both_cap_alphabetic]" segments={[mentionSegmentForActor(actor)]} /><span className="min-w-0 [text-box:trim-both_cap_alphabetic]">{item.action}</span><span className="ml-2 shrink-0 text-xs text-text-subtlest [text-box:trim-both_cap_alphabetic]">{timestamp}</span><ChevronRightIcon label="" size="small" /></CollapsibleTrigger>
			<CollapsibleContent>
				<div className="pt-2"><dl className="space-y-3 rounded-lg bg-surface-sunken p-3 text-sm text-text">{item.changes.map((change, index) => <div className="space-y-1" key={`${change.label}-${index}`}><dt className="font-medium text-text-subtle">{change.label}</dt><dd className="whitespace-pre-wrap">{change.before ? <span className="mr-2 line-through">{change.before}</span> : null}{change.after ? <span>{change.after}</span> : <span>Removed</span>}</dd></div>)}</dl></div>
			</CollapsibleContent>
		</Collapsible>
	);
}

export function ProjectButterReferenceCommentBody({ markdown }: Readonly<{ markdown: string }>) {
	return <MessageResponse>{markdown}</MessageResponse>;
}
