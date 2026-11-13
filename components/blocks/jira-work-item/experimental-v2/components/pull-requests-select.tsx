"use client";

import { useMemo } from "react";

import MergeFailureIcon from "@atlaskit/icon/core/merge-failure";
import MergeSuccessIcon from "@atlaskit/icon/core/merge-success";
import PullRequestIcon from "@atlaskit/icon/core/pull-request";

import type { JiraActivityEventEntry } from "@/components/blocks/jira-activity";
import { toPanelPullRequestProps } from "@/components/blocks/jira-work-item/experimental-v2/components/pull-requests-panel";
import {
	getPullRequestIdentity,
	JIRA_WORK_ITEM_CURRENT_USER,
} from "@/components/blocks/jira-work-item/experimental-v2/lib/jira-activity-adapter";
import {
	DEFAULT_PULL_REQUEST_SORT_MODE,
	sortPullRequestEntries,
} from "@/components/blocks/jira-work-item/experimental-v2/lib/pull-request-phases";
import {
	getPullRequestStatusPresentation,
	type PullRequestStatusIconKind,
} from "@/components/blocks/jira-work-item/experimental-v2/lib/pull-request-status-presentation";
import { PullRequest } from "@/components/blocks/pull-request";
import { Icon } from "@/components/ui/icon";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTag,
	SelectTags,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

const TRIGGER_LABEL = "Review pull request";
const SELECTED_TRIGGER_LABEL = "Review";

const PULL_REQUEST_STATUS_ICONS: Record<
	PullRequestStatusIconKind,
	typeof PullRequestIcon
> = {
	"pull-request": PullRequestIcon,
	"merge-success": MergeSuccessIcon,
	"merge-failure": MergeFailureIcon,
};

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

/**
 * ContextResources Select for pull requests. Placeholder trigger says
 * "Review pull request"; with a selection it shortens to "Review" beside the
 * PR SelectTag. Each option is a Pull Request block card. Selecting an option
 * opens PR detail in the description column.
 */
export function PullRequestsSelect({
	entries,
	selectedIdentity,
	onSelectEntry,
	onClearSelection,
}: Readonly<{
	entries: readonly JiraActivityEventEntry[];
	selectedIdentity: string | null;
	onSelectEntry: (entry: JiraActivityEventEntry) => void;
	onClearSelection: () => void;
}>) {
	const orderedEntries = useMemo(
		() => sortPullRequestEntries(entries, DEFAULT_PULL_REQUEST_SORT_MODE, JIRA_WORK_ITEM_CURRENT_USER.name),
		[entries],
	);

	if (orderedEntries.length === 0) {
		return null;
	}

	const selectedEntry = findPullRequestEntry(orderedEntries, selectedIdentity);
	const selectedPullRequest = selectedEntry?.pullRequest;
	const selectedNumber = selectedPullRequest?.number;
	const selectedTagLabel = typeof selectedNumber === "number" ? `#${selectedNumber}` : null;
	const visibleTriggerLabel = selectedTagLabel
		? SELECTED_TRIGGER_LABEL
		: TRIGGER_LABEL;
	const selectedStatusPresentation = selectedPullRequest
		? getPullRequestStatusPresentation(selectedPullRequest.status)
		: null;
	const SelectedStatusIcon = selectedStatusPresentation
		? PULL_REQUEST_STATUS_ICONS[selectedStatusPresentation.iconKind]
		: null;

	return (
		<div
			className="inline-flex min-w-0 items-center"
			data-jira-work-item-resource-pull-requests-control
		>
			<Select
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
					aria-label={TRIGGER_LABEL}
					// Empty selects get `data-placeholder` (subtlest by default). Keep
					// outline-button grey so this chrome control matches "Open in Claude".
					// Under `@container/resource-row` < 36rem the label hides; icon +
					// optional SelectTag + chevron remain (name via aria-label).
					className="gap-2 font-medium data-placeholder:text-text-subtle data-placeholder:[&_svg]:text-icon-subtle @max-[36rem]/resource-row:gap-1.5"
					data-jira-work-item-resource-pull-requests
					tags
				>
					<span
						aria-hidden
						className="inline-flex size-4 shrink-0 items-center justify-center"
						data-icon="inline-start"
					>
						<Icon render={<PullRequestIcon label="" size="small" />} />
					</span>
					<SelectValue className="min-w-0">
						{() => (
							<SelectTags>
								<span className="truncate @max-[36rem]/resource-row:hidden">
									{visibleTriggerLabel}
								</span>
								{selectedTagLabel && selectedStatusPresentation && SelectedStatusIcon ? (
									<SelectTag
										aria-label={`${selectedStatusPresentation.label} pull request ${selectedTagLabel}`}
										color={selectedStatusPresentation.tagColor}
										data-jira-work-item-resource-pull-request-filter
										elemBefore={(
											<Icon
												aria-hidden
												render={(
													<SelectedStatusIcon
														color="currentColor"
														label=""
														size="small"
													/>
												)}
											/>
										)}
										onRemove={onClearSelection}
										removeButtonLabel={`Remove ${selectedStatusPresentation.label} pull request`}
									>
										{selectedTagLabel}
									</SelectTag>
								) : null}
							</SelectTags>
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
									{/*
									 * SelectItem is an invisible activation shell — PullRequest
									 * owns borderless surface + highlight (via group). Avoids a
									 * padded “double box” around the card. Do not pass
									 * `selected` here: that paints blue selected chrome; the
									 * trigger tag already shows the open PR.
									 */}
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
