"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { JiraActivityEventEntry } from "@/components/blocks/jira-activity";
import { toPanelPullRequestProps } from "@/components/blocks/jira-work-item/experimental-v3/components/pull-requests-panel";
import {
	getPullRequestIdentity,
	JIRA_WORK_ITEM_CURRENT_USER,
} from "@/components/blocks/jira-work-item/experimental-v3/lib/jira-activity-adapter";
import {
	DEFAULT_PULL_REQUEST_SORT_MODE,
	sortPullRequestEntries,
} from "@/components/blocks/jira-work-item/experimental-v3/lib/pull-request-phases";
import { PullRequest } from "@/components/blocks/pull-request";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { tabsExperimentalTriggerClass } from "@/components/ui/tabs-experimental";
import { cn } from "@/lib/utils";

const TRIGGER_LABEL = "Pull requests";
const HOVER_CLOSE_DELAY_MS = 100;

function findPullRequestEntry(
	entries: readonly JiraActivityEventEntry[],
	identity: string | null,
): JiraActivityEventEntry | null {
	if (!identity) {
		return null;
	}

	return entries.find((entry) => (
		entry.pullRequest
		&& getPullRequestIdentity(entry.pullRequest) === identity
	)) ?? null;
}

export function PullRequestsSelect({
	entries,
	selectedIdentity,
	onSelectEntry,
}: Readonly<{
	entries: readonly JiraActivityEventEntry[];
	selectedIdentity: string | null;
	onSelectEntry: (entry: JiraActivityEventEntry) => void;
}>) {
	const orderedEntries = useMemo(
		() => sortPullRequestEntries(entries, DEFAULT_PULL_REQUEST_SORT_MODE, JIRA_WORK_ITEM_CURRENT_USER.name),
		[entries],
	);
	const pullRequestCount = orderedEntries.length;
	const [open, setOpen] = useState(false);
	const hoverOpenedRef = useRef(false);
	const retainHoverOpenOnTriggerPressRef = useRef(false);
	const hoverCloseTimeoutRef = useRef<number | null>(null);
	const cancelHoverClose = useCallback(() => {
		if (hoverCloseTimeoutRef.current === null) return;

		window.clearTimeout(hoverCloseTimeoutRef.current);
		hoverCloseTimeoutRef.current = null;
	}, []);
	const scheduleHoverClose = useCallback(() => {
		if (!hoverOpenedRef.current) return;

		cancelHoverClose();
		hoverCloseTimeoutRef.current = window.setTimeout(() => {
			hoverCloseTimeoutRef.current = null;
			hoverOpenedRef.current = false;
			setOpen(false);
		}, HOVER_CLOSE_DELAY_MS);
	}, [cancelHoverClose]);

	useEffect(() => cancelHoverClose, [cancelHoverClose]);

	if (pullRequestCount === 0) {
		return null;
	}

	const triggerAriaLabel = selectedIdentity
		? TRIGGER_LABEL
		: `${TRIGGER_LABEL}. ${pullRequestCount}`;
	const handleOpenChange = (nextOpen: boolean) => {
		if (!nextOpen && retainHoverOpenOnTriggerPressRef.current) {
			retainHoverOpenOnTriggerPressRef.current = false;
			hoverOpenedRef.current = false;
			cancelHoverClose();
			return;
		}
		if (!nextOpen) {
			hoverOpenedRef.current = false;
			cancelHoverClose();
		}
		setOpen(nextOpen);
	};
	const handleTriggerMouseEnter = () => {
		cancelHoverClose();
		if (open) return;

		hoverOpenedRef.current = true;
		setOpen(true);
	};

	return (
		<div
			className="inline-flex h-full min-w-0 items-stretch"
			data-jira-work-item-resource-pull-requests-control
		>
			<Select
				onOpenChange={handleOpenChange}
				open={open}
				value={selectedIdentity}
				onValueChange={(nextIdentity) => {
					if (typeof nextIdentity !== "string" || nextIdentity.length === 0) {
						return;
					}
					const entry = findPullRequestEntry(orderedEntries, nextIdentity);
					if (entry) {
						onSelectEntry(entry);
					}
				}}
			>
				<SelectTrigger
					aria-current={selectedIdentity ? "location" : undefined}
					aria-label={triggerAriaLabel}
					className={cn(
						tabsExperimentalTriggerClass,
						"data-placeholder:text-text-subtle data-placeholder:hover:text-text data-[variant=none]:border-x-[6px]! data-[variant=none]:border-x-transparent! data-popup-open:rounded-md group-data-[header-variant=compact]/work-item-navigation:data-popup-open:rounded-b-none data-popup-open:text-text! [&>:last-child]:hidden",
					)}
					data-jira-work-item-resource-pull-requests
					onMouseEnter={handleTriggerMouseEnter}
					onMouseLeave={scheduleHoverClose}
					onPointerDownCapture={() => {
						retainHoverOpenOnTriggerPressRef.current = hoverOpenedRef.current;
					}}
					variant="none"
				>
					<SelectValue className="min-w-0">
						{() => (
							<>
								<span className="truncate">
									{TRIGGER_LABEL}
								</span>
								<span className="shrink-0 text-xs font-normal text-text-subtlest">
									{pullRequestCount}
								</span>
							</>
						)}
					</SelectValue>
				</SelectTrigger>
				<SelectContent
					align="start"
					alignItemWithTrigger={false}
					aria-label="Pull requests"
					className="w-[min(28rem,var(--available-width))] max-w-[var(--available-width)] p-1"
					data-jira-work-item-resource-pull-requests-menu
					positionerClassName="z-[502]"
					onMouseEnter={cancelHoverClose}
					onMouseLeave={scheduleHoverClose}
				>
					<SelectGroup className="flex flex-col gap-0.5">
						{orderedEntries.map((entry) => {
							const pullRequest = entry.pullRequest;
							const item = toPanelPullRequestProps(entry);
							if (!pullRequest || !item) return null;
							const identity = getPullRequestIdentity(pullRequest);
							return (
								<SelectItem
									key={identity}
									className="group/pr-option h-auto min-h-0 p-0 data-[highlighted]:bg-transparent data-selected:bg-transparent data-selected:data-highlighted:bg-transparent data-selected:data-[highlighted]:bg-transparent active:bg-transparent data-selected:active:bg-transparent"
									data-jira-work-item-pull-request-card={pullRequest.number}
									data-jira-work-item-pull-request-identity={identity}
									showIndicator={false}
									textClassName="w-full min-w-0 whitespace-normal"
									value={identity}
								>
									<PullRequest
										{...item}
										className="pointer-events-none min-w-0 max-w-full w-full rounded-lg border-transparent transition-[background-color] duration-normal ease-out-practical group-data-[highlighted]/pr-option:bg-surface-hovered"
									/>
								</SelectItem>
							);
						})}
					</SelectGroup>
				</SelectContent>
			</Select>
		</div>
	);
}
