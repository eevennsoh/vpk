"use client";

import { useCallback, useMemo, useState, type RefObject } from "react";

import type { JiraActivityEventEntry } from "@/components/blocks/jira-activity";
import type { InlineReviewComment } from "@/components/blocks/code-review/lib/inline-comments";
import type { PullRequestHeaderSubmitReviewAction } from "@/components/blocks/pull-request-header";
import { WorkItemSection } from "@/components/blocks/jira-work-item/experimental-v5/components/work-item-section";
import {
	usePublishSections,
	useSectionNavigation,
} from "@/components/blocks/jira-work-item/experimental-v5/context-section-navigation";
import {
	buildWorkItemSectionTabs,
	type WorkItemSectionTab,
} from "@/components/blocks/jira-work-item/experimental-v5/lib/work-item-section-tabs";

import {
	resolvePullRequestDetailData,
	type PullRequestActivity,
} from "@/components/blocks/jira-work-item/experimental-v5/lib/pull-request-detail-data";
import { resolveInitialReviewedChapterIds } from "@/components/blocks/jira-work-item/experimental-v5/lib/resolve-initial-reviewed-chapter-ids";
import { PullRequestActivityPanel } from "./pull-request-activity-panel";
import { PullRequestDetailHeader } from "./pull-request-detail-header";
import { PullRequestFiles } from "./pull-request-files";
import { PullRequestGuide } from "./pull-request-guide";
import { PullRequestOverview } from "./pull-request-overview";
import { PullRequestStickyHeaderShell } from "./pull-request-sticky-header-shell";

const NO_SECTIONS: readonly WorkItemSectionTab[] = [];

interface PullRequestDetailViewProps {
	approvalState?: "available" | "approved";
	entry: JiraActivityEventEntry;
	initialInlineComments?: readonly InlineReviewComment[];
	onChapterReviewedChange?: (identity: string, chapterId: string, reviewed: boolean) => void;
	onInlineCommentsChange?: (identity: string, comments: readonly InlineReviewComment[]) => void;
	reviewedChapterIds?: ReadonlySet<string>;
	scrollContainerRef: RefObject<HTMLElement | null>;
	/** Reviews submitted this session, appended to the fixture feed. */
	submittedReviewActivity?: readonly PullRequestActivity[];
	submitReviewAction?: PullRequestHeaderSubmitReviewAction;
}

/**
 * Pull-request body as one continuous scroll, sharing the work item's section
 * nav rather than owning a second tab strip.
 *
 * Description (the PR overview) and Activity (the review conversation) are the
 * same scroll sections a work item has; Insights is a body swap on the shared
 * nav, not a stacked PR section. Guide and Files are appended only when the
 * review is guided.
 */
export function PullRequestDetailView({
	approvalState,
	entry,
	initialInlineComments,
	onChapterReviewedChange,
	onInlineCommentsChange,
	reviewedChapterIds,
	scrollContainerRef,
	submittedReviewActivity,
	submitReviewAction,
}: Readonly<PullRequestDetailViewProps>) {
	const { selectSection } = useSectionNavigation();
	const data = useMemo(() => resolvePullRequestDetailData(entry), [entry]);
	const review = data?.guidedReview;
	const [localReviewedChapterIds, setLocalReviewedChapterIds] = useState<ReadonlySet<string>>(
		() => resolveInitialReviewedChapterIds(review, approvalState),
	);
	const effectiveReviewedChapterIds = reviewedChapterIds ?? localReviewedChapterIds;
	const sections = useMemo(() => {
		if (!data) return NO_SECTIONS;
		return buildWorkItemSectionTabs({
			guidedReview: review
				? {
					additions: data.additions,
					deletions: data.deletions,
					fileCount: review.files.length,
				}
				: null,
		});
	}, [data, review]);
	usePublishSections(sections);
	const activity = useMemo(() => {
		if (!data) return [];
		return submittedReviewActivity?.length
			? [...data.activity, ...submittedReviewActivity]
			: data.activity;
	}, [data, submittedReviewActivity]);
	const handleChapterReviewedChange = useCallback((chapterId: string, reviewed: boolean) => {
		if (data && onChapterReviewedChange) {
			onChapterReviewedChange(data.identity, chapterId, reviewed);
			return;
		}
		setLocalReviewedChapterIds((current) => {
			if (current.has(chapterId) === reviewed) return current;
			const next = new Set(current);
			if (reviewed) {
				next.add(chapterId);
			} else {
				next.delete(chapterId);
			}
			return next;
		});
	}, [data, onChapterReviewedChange]);
	const handleInlineCommentsChange = useCallback((comments: readonly InlineReviewComment[]) => {
		if (!data || !onInlineCommentsChange) return;
		onInlineCommentsChange(data.identity, comments);
	}, [data, onInlineCommentsChange]);

	if (!data) {
		return (
			<div
				className="grid min-h-48 place-items-center p-6 text-sm text-text-subtle"
				data-jira-work-item-pull-request-detail
			>
				Pull request details are unavailable.
			</div>
		);
	}

	return (
		<section
			aria-label={`Pull request #${data.number}: ${data.title}`}
			className="flex min-h-0 min-w-0 flex-1 flex-col"
			data-jira-work-item-pull-request-detail
		>
			{/*
			 * Sticky inside the body-only left-column scrollport. The section nav
			 * sits above in the column chrome, so the two pin as one stack and the
			 * spy measures its activation line below whichever bands are present.
			 */}
			<PullRequestStickyHeaderShell scrollContainerRef={scrollContainerRef}>
				<PullRequestDetailHeader
					data={data}
					onGuideOpen={review ? () => selectSection("guide") : undefined}
					scrollContainerRef={scrollContainerRef}
					submitReviewAction={submitReviewAction}
				/>
			</PullRequestStickyHeaderShell>
			<div className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 pt-6 pb-6">
				<WorkItemSection id="description" label="Description">
					<PullRequestOverview data={data} />
				</WorkItemSection>
				<PullRequestActivityPanel activity={activity} />
				{review ? (
					<>
						<WorkItemSection id="guide" label="Guide">
							<PullRequestGuide
								onChapterReviewedChange={handleChapterReviewedChange}
								review={review}
								reviewedChapterIds={effectiveReviewedChapterIds}
							/>
						</WorkItemSection>
						<WorkItemSection id="files" label="Files">
							<PullRequestFiles
								commits={data.commits}
								initialInlineComments={initialInlineComments}
								onInlineCommentsChange={handleInlineCommentsChange}
								review={review}
							/>
						</WorkItemSection>
					</>
				) : null}
			</div>
		</section>
	);
}
