"use client";

import { useLayoutEffect, useRef, type MouseEvent, type PointerEvent } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { motionDuration } from "@/lib/motion";
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
			return "Failed";
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
	animateIcon = false,
	iconScale = "compact",
	pullRequestNumber,
	pullRequestPreview,
	pullRequestStatus,
	pullRequestTitle,
	usesStrokeChrome,
	tone = "status",
}: Readonly<{
	animateIcon?: boolean;
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
	const iconRef = useRef<HTMLSpanElement>(null);
	useLayoutEffect(() => {
		const icon = iconRef.current;
		if (!animateIcon || !icon) return;
		const animation = icon.animate([
			{ opacity: 0, transform: "scale(0.65)" },
			{ opacity: 1, transform: "scale(1)" },
		], { duration: motionDuration.slow * 1000, easing: getComputedStyle(icon).getPropertyValue("--ease-out-practical").trim(), fill: "backwards" });
		return () => animation.cancel();
	}, [animateIcon]);

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
		<Popover>
			<PopoverTrigger
				render={(
					<Button
						aria-label={accessibleName}
						className={cn(tone === "subtle" ? "text-icon-subtle" : colorClass, "[&_svg]:text-current aria-expanded:bg-bg-selected aria-expanded:text-icon-selected aria-expanded:hover:bg-bg-selected-hovered", iconMetrics.compactIconClassName)}
						onClick={stopNestedActivation}
						onPointerDown={stopNestedActivation}
						size="icon-compact"
						type="button"
						variant="ghost"
					/>
				)}
			>
				<span className="inline-flex" ref={iconRef}>
					<Icon render={<StatusIcon label="" size="small" color="currentColor" />} />
				</span>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				aria-label={`Pull request #${pullRequestNumber} details`}
				className="w-[320px] max-w-[calc(100vw-48px)] overflow-hidden rounded-xl border-none bg-surface-overlay p-0 text-text shadow-none"
				initialFocus={false}
				onClick={stopNestedActivation}
				onPointerDown={stopNestedActivation}
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
					checksExpandable={false}
					className="border-none bg-transparent shadow-none"
					deletions={pullRequestPreview?.deletions ?? 0}
					filesChanged={pullRequestPreview?.filesChanged}
					href={pullRequestPreview?.href}
					number={pullRequestNumber}
					relativeTime={pullRequestPreview?.relativeTime}
					repository={pullRequestPreview?.repository}
					status={toPullRequestCardStatus(pullRequestStatus)}
					targetBranch={pullRequestPreview?.targetBranch}
					title={overlayTitle}
					variant="flyout"
				/>
			</PopoverContent>
		</Popover>
	);
}
