"use client";

import { useId, useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import MergeFailureIcon from "@atlaskit/icon/core/merge-failure";
import MergeSuccessIcon from "@atlaskit/icon/core/merge-success";
import PullRequestIcon from "@atlaskit/icon/core/pull-request";

import { resolveJiraIssueIconMetrics } from "@/components/blocks/jira-issue/lib";
import type {
	JiraIssueIconScale,
	JiraIssuePullRequestItem,
	JiraIssuePullRequestPreview,
	JiraIssuePullRequestStatus,
} from "@/components/blocks/jira-issue/types";
import { PullRequest, PullRequestInlineTitle, PullRequestStatusLozenge } from "@/components/blocks/pull-request/components/pull-request";
import type { PullRequestStatus } from "@/components/blocks/pull-request/components/pull-request-types";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Icon } from "@/components/ui/icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MenuBackButton } from "@/components/ui-custom/menu-back-button";
import { cn } from "@/lib/utils";
import { motionDuration } from "@/lib/motion";
import { token } from "@/lib/tokens";

const PULL_REQUEST_STATUS_ORDER: Record<JiraIssuePullRequestStatus, number> = {
	open: 0,
	failed: 1,
	draft: 2,
	merged: 3,
};

function getJiraIssuePullRequestPresentation(status: JiraIssuePullRequestStatus | undefined): {
	StatusIcon: typeof PullRequestIcon;
	colorClass: string;
	hoverColorClass: string;
	label: string;
} {
	switch (status) {
		case "failed":
			return {
				StatusIcon: MergeFailureIcon,
				colorClass: "text-icon-danger",
				hoverColorClass: "group-hover/jira-issue:text-icon-danger group-focus-within/jira-issue:text-icon-danger",
				label: "Pull request failed",
			};
		case "merged":
			return {
				StatusIcon: MergeSuccessIcon,
				colorClass: "text-icon-accent-purple",
				hoverColorClass: "group-hover/jira-issue:text-icon-accent-purple group-focus-within/jira-issue:text-icon-accent-purple",
				label: "Pull request merged",
			};
		case "draft":
			return {
				StatusIcon: PullRequestIcon,
				colorClass: "text-icon-subtle",
				hoverColorClass: "group-hover/jira-issue:text-icon-subtle group-focus-within/jira-issue:text-icon-subtle",
				label: "Draft pull request",
			};
		case "open":
		case undefined:
			return {
				StatusIcon: PullRequestIcon,
				colorClass: "text-icon-accent-lime",
				hoverColorClass: "group-hover/jira-issue:text-icon-accent-lime group-focus-within/jira-issue:text-icon-accent-lime",
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
		case "draft":
			return "Draft";
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
	issueKey,
	pullRequestNumber,
	pullRequests,
	pullRequestPreview,
	pullRequestStatus,
	pullRequestTitle,
	usesStrokeChrome,
	tone = "status",
}: Readonly<{
	animateIcon?: boolean;
	iconScale?: JiraIssueIconScale;
	issueKey: string;
	pullRequestNumber: number;
	pullRequests?: readonly JiraIssuePullRequestItem[];
	pullRequestPreview?: JiraIssuePullRequestPreview;
	pullRequestStatus?: JiraIssuePullRequestStatus;
	pullRequestTitle: string;
	usesStrokeChrome: boolean;
	tone?: "status" | "subtle";
}>) {
	const hasMultiple = (pullRequests?.length ?? 0) > 1;
	const { StatusIcon, colorClass, hoverColorClass, label } = getJiraIssuePullRequestPresentation(hasMultiple ? "draft" : pullRequestStatus);
	const [selected, setSelected] = useState<JiraIssuePullRequestItem | null>(null);
	const [popoverOpen, setPopoverOpen] = useState(false);
	const [tooltipOpen, setTooltipOpen] = useState(false);
	const tooltipId = useId();
	const listRef = useRef<HTMLUListElement>(null);
	const returnFocusNumber = useRef<number | null>(null);
	const preview = selected?.preview ?? pullRequestPreview;
	const number = selected?.number ?? pullRequestNumber;
	const status = selected?.status ?? pullRequestStatus;
	const overlayTitle = preview?.title ?? pullRequestTitle;
	const accessibleName = hasMultiple ? `Pull requests for ${issueKey}` : `${label} #${pullRequestNumber}: ${overlayTitle}`;
	const tooltip = hasMultiple ? `${pullRequests?.length} pull requests` : `#${pullRequestNumber} ${pullRequestPreview?.title ?? pullRequestTitle}`;
	const iconMetrics = resolveJiraIssueIconMetrics(iconScale);
	const iconRef = useRef<HTMLSpanElement>(null);
	useLayoutEffect(() => {
		if (!selected && returnFocusNumber.current !== null) {
			listRef.current?.querySelector<HTMLButtonElement>(`[data-pr-number="${returnFocusNumber.current}"]`)?.focus();
			returnFocusNumber.current = null;
		}
	}, [selected]);
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
		<Popover open={popoverOpen} onOpenChange={(open) => { setPopoverOpen(open); if (open) setTooltipOpen(false); else { returnFocusNumber.current = null; setSelected(null); } }}>
			<Tooltip open={tooltipOpen && !popoverOpen} onOpenChange={setTooltipOpen}>
			<TooltipTrigger render={<PopoverTrigger
				render={(
					<Button
						aria-label={accessibleName}
						aria-describedby={tooltipOpen && !popoverOpen ? tooltipId : undefined}
						className={cn(tone === "subtle" ? "text-icon-subtle" : colorClass, tone === "subtle" && hoverColorClass, "[&_svg]:text-current aria-expanded:bg-bg-selected aria-expanded:text-icon-selected aria-expanded:hover:bg-bg-selected-hovered", iconMetrics.compactIconClassName)}
						onClick={stopNestedActivation}
						onPointerDown={stopNestedActivation}
						size="icon-compact"
						type="button"
						variant="ghost"
					/>
				)}
			/>}>
				<span className="inline-flex" ref={iconRef}>
					<Icon render={<StatusIcon label="" size="small" color="currentColor" />} />
				</span>
			</TooltipTrigger>
			<TooltipContent id={tooltipId} positionerClassName="z-[576]" role="tooltip" side="top" sideOffset={8}>{tooltip}</TooltipContent>
			</Tooltip>
			<PopoverContent
				align="end"
				aria-label={hasMultiple && !selected ? `Pull requests for ${issueKey}` : `Pull request #${number} details`}
				className={cn("w-[320px] max-w-[calc(100vw-48px)] overflow-hidden rounded-xl border-none bg-surface-overlay p-0 text-text shadow-none", selected && "gap-0")}
				initialFocus={false}
				onClick={stopNestedActivation}
				onPointerDown={stopNestedActivation}
				positionerClassName="z-[575] after:pointer-events-auto after:absolute after:-inset-y-2 after:inset-x-0 after:-z-10 after:content-['']"
				side="bottom"
				sideOffset={8}
				style={{ boxShadow: token("elevation.shadow.overlay") }}
			>
				{hasMultiple && !selected ? (
					<ul aria-label="Pull requests" className="p-1" ref={listRef}>
						{pullRequests?.toSorted((a, b) => PULL_REQUEST_STATUS_ORDER[a.status] - PULL_REQUEST_STATUS_ORDER[b.status]).map((item) => (
							<li key={item.number}>
								<Button className="flex h-auto w-full items-start justify-start gap-3 rounded-md px-2 py-2 text-left whitespace-normal" data-pr-number={item.number} onClick={() => setSelected(item)} variant="ghost">
									<PullRequestInlineTitle className="flex-1" number={item.number} title={item.preview.title} />
									<PullRequestStatusLozenge status={toPullRequestCardStatus(item.status)} />
								</Button>
							</li>
						))}
					</ul>
				) : (
					<>
					{selected ? <MenuBackButton autoFocus onClick={() => { returnFocusNumber.current = selected.number; setSelected(null); }} /> : null}
				<PullRequest
					additions={preview?.additions ?? 0}
					author={preview?.author}
					branch={preview?.branch}
					checks={preview?.checks}
					checksExpandable={false}
					className="border-none bg-transparent shadow-none"
					deletions={preview?.deletions ?? 0}
					filesChanged={preview?.filesChanged}
					href={preview?.href}
					number={number}
					relativeTime={preview?.relativeTime}
					repository={preview?.repository}
					status={toPullRequestCardStatus(status)}
					targetBranch={preview?.targetBranch}
					title={overlayTitle}
					variant="flyout"
				/>
					</>
				)}
			</PopoverContent>
		</Popover>
	);
}
