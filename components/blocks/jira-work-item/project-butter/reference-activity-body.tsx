"use client";

import { useMemo, type ComponentProps } from "react";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import { MessageResponse, streamdownComponents } from "@/components/ui-custom/message";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SmartLink } from "@/components/blocks/smart-link/components/smart-link";
import { toPullRequestSmartLink, type PullRequestSmartLinkStatus } from "@/components/blocks/smart-link/lib/pull-request-smart-link";
import { mentionSegmentForActor } from "@/components/blocks/jira-activity/jira-activity-actor-mention";
import { JiraActivitySegments } from "@/components/blocks/jira-activity/jira-activity-segments";
import type { JiraActivityActor } from "@/components/blocks/jira-activity";
import type { ProjectButterReferenceChange } from "@/components/blocks/jira-work-item/project-butter/reference-model";
import { PROJECT_BUTTER_JOURNEY_PULL_REQUEST } from "@/components/blocks/jira-work-item/project-butter/development-journey-model";

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

export function ProjectButterReferenceCommentBody({ markdown, pullRequestStatus }: Readonly<{ markdown: string; pullRequestStatus?: PullRequestSmartLinkStatus }>) {
	const components = useMemo(() => {
		if (!pullRequestStatus) return streamdownComponents;
		const request = PROJECT_BUTTER_JOURNEY_PULL_REQUEST;
		const item = toPullRequestSmartLink({ id: "butter-pr-284", number: request.number, title: request.title, status: pullRequestStatus, additions: request.additions, deletions: request.deletions, files: request.filesChanged, branch: request.branch, targetBranch: request.targetBranch, repository: "payments-platform/payments", href: "#pull-request-284", author: { name: "Venn", src: "/avatar-user/venn/venn.png" } });
		const DefaultAnchor = streamdownComponents.a;
		return { ...streamdownComponents, a: ({ href, ...props }: ComponentProps<"a"> & { node?: unknown }) => href === "#pull-request-284" ? <SmartLink className="text-[length:inherit] leading-[inherit] [&_[data-smart-link-text]]:[text-box:trim-both_cap_alphabetic]" item={item} positionerClassName="z-[700]" showStatus /> : <DefaultAnchor href={href} {...props} /> };
	}, [pullRequestStatus]);
	const body = pullRequestStatus ? markdown.replace(/\bPR #284\b/gu, "[PR #284](#pull-request-284)") : markdown;
	return <MessageResponse components={components}>{body}</MessageResponse>;
}
