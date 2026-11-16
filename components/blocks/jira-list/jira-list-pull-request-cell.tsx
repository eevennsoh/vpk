"use client";

import type { JiraIssuePullRequestItem } from "@/components/blocks/jira-issue/types";
import { JiraIssuePullRequestStatusIcon } from "@/components/blocks/jira-issue/pull-request-cluster";
import { PullRequest, PullRequestInlineTitle } from "@/components/blocks/pull-request/components/pull-request";
import type { PullRequestStatus } from "@/components/blocks/pull-request/components/pull-request-types";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

const CARD_STATUS: Record<JiraIssuePullRequestItem["status"], PullRequestStatus> = {
	open: "Open",
	failed: "Failed",
	draft: "Draft",
	merged: "Merged",
};

export function JiraListPullRequestCell({ pullRequest }: Readonly<{
	pullRequest?: JiraIssuePullRequestItem;
}>) {
	if (!pullRequest) return null;
	const { number, preview, status } = pullRequest;

	return (
		<HoverCard>
			<HoverCardTrigger
				aria-label={`Pull request #${number}: ${preview.title}`}
				render={<span className="absolute inset-0 flex min-w-0 items-center gap-2 px-3 focus-visible:outline-2 focus-visible:outline-border-focused" tabIndex={0} />}
				role="group"
			>
				<JiraIssuePullRequestStatusIcon status={status} />
				<PullRequestInlineTitle className="truncate whitespace-nowrap" number={number} title={preview.title} underlineOnHover={false} />
			</HoverCardTrigger>
			<HoverCardContent
				align="start"
				aria-label={`Pull request #${number} details`}
				className="w-[320px] max-w-[calc(100vw-48px)] overflow-hidden rounded-xl p-0"
				positionerClassName="z-[575]"
				role="region"
				sideOffset={8}
			>
				<PullRequest
					{...preview}
					checksExpandable={false}
					className="border-none bg-transparent shadow-none"
					href={undefined}
					number={number}
					showFix={false}
					status={CARD_STATUS[status]}
					variant="flyout"
				/>
			</HoverCardContent>
		</HoverCard>
	);
}
