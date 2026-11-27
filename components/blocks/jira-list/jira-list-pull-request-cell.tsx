"use client";

import type { JiraIssuePullRequestItem } from "@/components/blocks/jira-issue/types";
import { JiraIssuePullRequestStatusIcon, PullRequestList } from "@/components/blocks/jira-issue/pull-request-cluster";
import { PullRequest, PullRequestInlineTitle } from "@/components/blocks/pull-request/components/pull-request";
import type { PullRequestStatus } from "@/components/blocks/pull-request/components/pull-request-types";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const CARD_STATUS: Record<JiraIssuePullRequestItem["status"], PullRequestStatus> = {
	open: "Open",
	failed: "Failed",
	draft: "Draft",
	merged: "Merged",
};

const PR_OVERLAY_PLACEMENT = {
	align: "start",
	alignOffset: 0,
	collisionAvoidance: { side: "flip", align: "shift", fallbackAxisSide: "none" },
	positionerClassName: "z-[575]",
	side: "right",
	sideOffset: 8,
} as const;

export function JiraListPullRequestCell({ issueKey, pullRequests = [] }: Readonly<{
	issueKey: string;
	pullRequests?: readonly JiraIssuePullRequestItem[];
}>) {
	const [pullRequest] = pullRequests;
	if (!pullRequest) return null;
	if (pullRequests.length > 1) {
		const label = `${pullRequests.length} pull requests`;
		return (
			<Popover>
				<PopoverTrigger
					render={<Button aria-label={`${label} for ${issueKey}`} className="absolute inset-0 size-full justify-start gap-2 px-3 font-normal hover:bg-transparent active:bg-transparent aria-expanded:border-transparent aria-expanded:bg-transparent aria-expanded:text-text-subtle aria-expanded:hover:bg-transparent aria-expanded:active:bg-transparent aria-expanded:focus-visible:border-ring aria-expanded:[&_svg]:text-icon-subtle" type="button" variant="ghost" />}
				>
					<JiraIssuePullRequestStatusIcon status="draft" />
					{label}
				</PopoverTrigger>
				<PopoverContent
					{...PR_OVERLAY_PLACEMENT}
					aria-label={`Pull requests for ${issueKey}`}
					className="max-h-(--available-height) w-[320px] max-w-(--available-width) overflow-y-auto rounded-xl p-0"
				>
					<PullRequestList pullRequests={pullRequests} />
				</PopoverContent>
			</Popover>
		);
	}

	const { number, preview, status } = pullRequest;

	return (
		<Popover>
			<PopoverTrigger
				aria-label={`Pull request #${number}: ${preview.title}`}
				render={<button className="absolute inset-0 flex min-w-0 cursor-pointer items-center gap-2 px-3 text-left focus-visible:outline-2 focus-visible:outline-border-focused" type="button" />}
			>
				<JiraIssuePullRequestStatusIcon status={status} />
				<PullRequestInlineTitle className="truncate whitespace-nowrap" number={number} title={preview.title} underlineOnHover={false} />
			</PopoverTrigger>
			<PopoverContent
				{...PR_OVERLAY_PLACEMENT}
				aria-label={`Pull request #${number} details`}
				className="w-[320px] max-w-(--available-width) overflow-hidden rounded-xl p-0 transition-none"
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
			</PopoverContent>
		</Popover>
	);
}
