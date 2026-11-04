"use client";

import type { MouseEvent, PointerEvent } from "react";
import MergeFailureIcon from "@atlaskit/icon/core/merge-failure";
import MergeSuccessIcon from "@atlaskit/icon/core/merge-success";
import PullRequestIcon from "@atlaskit/icon/core/pull-request";

import { resolveJiraIssueIconMetrics } from "@/components/blocks/jira-issue/lib";
import type {
	JiraIssueIconScale,
	JiraIssuePullRequestPreview,
	JiraIssuePullRequestStatus,
} from "@/components/blocks/jira-issue/types";
import { PullRequest } from "@/components/blocks/pull-request/components/pull-request";
import type { PullRequestStatus } from "@/components/blocks/pull-request/components/pull-request-types";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { token } from "@/lib/tokens";

function getJiraIssuePullRequestPresentation(status: JiraIssuePullRequestStatus | undefined): {
	StatusIcon: typeof PullRequestIcon;
	colorClass: string;
	label: string;
} {
	switch (status) {
		case "failed":
			return {
				StatusIcon: MergeFailureIcon,
				colorClass: "text-icon-danger",
				label: "Pull request failed",
			};
		case "merged":
			return {
				StatusIcon: MergeSuccessIcon,
				colorClass: "text-icon-accent-purple",
				label: "Pull request merged",
			};
		case "open":
		case undefined:
			return {
				StatusIcon: PullRequestIcon,
				colorClass: "text-icon-accent-lime",
				label: "Pull request",
			};
		default: {
			const exhaustive: never = status;
			throw new Error(`Unhandled pull request status: ${String(exhaustive)}`);
		}
	}
}

function toPullRequestCardStatus(status: JiraIssuePullRequestStatus | undefined): PullRequestStatus {
	switch (status) {
		case "merged":
			return "Merged";
		case "failed":
		case "open":
		case undefined:
			return "Open";
		default: {
			const exhaustive: never = status;
			throw new Error(`Unhandled pull request status: ${String(exhaustive)}`);
		}
	}
}

function stopNestedActivation(event: MouseEvent<HTMLElement> | PointerEvent<HTMLElement>) {
	event.stopPropagation();
}

export function JiraIssuePullRequestCluster({
	iconScale = "compact",
	pullRequestNumber,
	pullRequestPreview,
	pullRequestStatus,
	pullRequestTitle,
	usesStrokeChrome,
	tone = "status",
}: Readonly<{
	iconScale?: JiraIssueIconScale;
	pullRequestNumber: number;
	pullRequestPreview?: JiraIssuePullRequestPreview;
	pullRequestStatus?: JiraIssuePullRequestStatus;
	pullRequestTitle: string;
	usesStrokeChrome: boolean;
	tone?: "status" | "subtle";
}>) {
	const { StatusIcon, colorClass, label } = getJiraIssuePullRequestPresentation(pullRequestStatus);
	const overlayTitle = pullRequestPreview?.title ?? pullRequestTitle;
	const accessibleName = `${label} #${pullRequestNumber}: ${overlayTitle}`;
	const iconMetrics = resolveJiraIssueIconMetrics(iconScale);

	if (!usesStrokeChrome) {
		return (
			<div className="flex shrink-0 items-center gap-1">
				<span className={colorClass}>
					<StatusIcon label={label} color="currentColor" />
				</span>
				<span className="text-xs font-semibold text-text-subtlest">
					#{pullRequestNumber}
				</span>
			</div>
		);
	}

	return (
		<HoverCard>
			<HoverCardTrigger
				closeDelay={80}
				delay={120}
				render={(
					<Button
						aria-label={accessibleName}
						className={cn(tone === "subtle" ? "text-icon-subtle" : colorClass, "[&_svg]:text-current", iconMetrics.compactIconClassName)}
						onClick={stopNestedActivation}
						onPointerDown={stopNestedActivation}
						size="icon-compact"
						type="button"
						variant="ghost"
					/>
				)}
			>
				<Icon render={<StatusIcon label="" size="small" color="currentColor" />} />
			</HoverCardTrigger>
			<HoverCardContent
				align="end"
				className="w-[320px] max-w-[calc(100vw-48px)] overflow-hidden rounded-xl border-none bg-surface-overlay p-0 text-text shadow-none"
				positionerClassName="z-[575] after:pointer-events-auto after:absolute after:-inset-2 after:-z-10 after:content-['']"
				side="bottom"
				sideOffset={8}
				style={{ boxShadow: token("elevation.shadow.overlay") }}
			>
				<PullRequest
					additions={pullRequestPreview?.additions ?? 0}
					author={pullRequestPreview?.author}
					branch={pullRequestPreview?.branch}
					checks={pullRequestPreview?.checks}
					className="border-none bg-transparent shadow-none"
					deletions={pullRequestPreview?.deletions ?? 0}
					filesChanged={pullRequestPreview?.filesChanged}
					number={pullRequestNumber}
					relativeTime={pullRequestPreview?.relativeTime}
					repository={pullRequestPreview?.repository}
					status={toPullRequestCardStatus(pullRequestStatus)}
					targetBranch={pullRequestPreview?.targetBranch}
					title={overlayTitle}
					variant="flyout"
				/>
			</HoverCardContent>
		</HoverCard>
	);
}
