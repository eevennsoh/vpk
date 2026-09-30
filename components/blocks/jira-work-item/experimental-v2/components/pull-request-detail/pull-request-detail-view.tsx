"use client";

import { useCallback, useMemo, useState, type RefObject } from "react";

import type { JiraActivityEventEntry } from "@/components/blocks/jira-activity";
import type { InlineReviewComment } from "@/components/blocks/code-review/lib/inline-comments";
import type { PullRequestHeaderSubmitReviewAction } from "@/components/blocks/pull-request-header";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/components/ui/tabs";

import { resolvePullRequestDetailData } from "@/components/blocks/jira-work-item/experimental-v2/lib/pull-request-detail-data";
import { resolveInitialReviewedChapterIds } from "@/components/blocks/jira-work-item/experimental-v2/lib/resolve-initial-reviewed-chapter-ids";
import { PullRequestDetailHeader } from "./pull-request-detail-header";
import { PullRequestFiles } from "./pull-request-files";
import { PullRequestGuide } from "./pull-request-guide";
import { PullRequestOverview } from "./pull-request-overview";
import { PullRequestStickyHeaderShell } from "./pull-request-sticky-header-shell";

type PullRequestDetailTab = "details" | "code" | "guide";

interface PullRequestDetailViewProps {
	approvalState?: "available" | "approved";
	entry: JiraActivityEventEntry;
	initialInlineComments?: readonly InlineReviewComment[];
	onChapterReviewedChange?: (identity: string, chapterId: string, reviewed: boolean) => void;
	onInlineCommentsChange?: (identity: string, comments: readonly InlineReviewComment[]) => void;
	reviewedChapterIds?: ReadonlySet<string>;
	scrollContainerRef: RefObject<HTMLElement | null>;
	submitReviewAction?: PullRequestHeaderSubmitReviewAction;
}

export function PullRequestDetailView({
	approvalState,
	entry,
	initialInlineComments,
	onChapterReviewedChange,
	onInlineCommentsChange,
	reviewedChapterIds,
	scrollContainerRef,
	submitReviewAction,
}: Readonly<PullRequestDetailViewProps>) {
	const [activeTab, setActiveTab] = useState<PullRequestDetailTab>("details");
	const data = useMemo(() => resolvePullRequestDetailData(entry), [entry]);
	const review = data?.guidedReview;
	const [localReviewedChapterIds, setLocalReviewedChapterIds] = useState<ReadonlySet<string>>(
		() => resolveInitialReviewedChapterIds(review, approvalState),
	);
	const effectiveReviewedChapterIds = reviewedChapterIds ?? localReviewedChapterIds;
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

	const tabNavigation = review ? (
		<TabsList
			aria-label="Pull request details"
			className="w-full justify-start"
			variant="line"
		>
			<TabsTrigger value="details">Overview</TabsTrigger>
			<TabsTrigger value="guide">Guide</TabsTrigger>
			<TabsTrigger value="code">
				<span>{review.files.length} Files</span>
				<span className="inline-flex items-center gap-1 tabular-nums">
					<span className="text-text-success">+{data.additions}</span>
					<span className="text-text-danger">-{data.deletions}</span>
				</span>
			</TabsTrigger>
		</TabsList>
	) : undefined;
	const header = (
		<PullRequestDetailHeader
			data={data}
			onGuideOpen={review ? () => setActiveTab("guide") : undefined}
			scrollContainerRef={scrollContainerRef}
			submitReviewAction={submitReviewAction}
			tabNavigation={tabNavigation}
		/>
	);

	return (
		<section
			aria-label={`Pull request #${data.number}: ${data.title}`}
			className="flex min-h-0 min-w-0 flex-1 flex-col"
			data-jira-work-item-pull-request-detail
		>
			{review ? (
				<Tabs
					className="flex min-h-0 flex-1 flex-col"
					onValueChange={(value) => setActiveTab(value as PullRequestDetailTab)}
					value={activeTab}
				>
					{/*
					 * Sticky stack inside the body-only left-column scrollport;
					 * header + tabs stay anchored together below ContextResources.
					 */}
					<PullRequestStickyHeaderShell scrollContainerRef={scrollContainerRef}>
						{header}
					</PullRequestStickyHeaderShell>
					<div className="min-h-0 flex-1 pb-6">
						<TabsContent value="details">
							<PullRequestOverview data={data} />
						</TabsContent>
						<TabsContent value="guide">
							<PullRequestGuide
								onChapterReviewedChange={handleChapterReviewedChange}
								review={review}
								reviewedChapterIds={effectiveReviewedChapterIds}
								scrollContainerRef={scrollContainerRef}
							/>
						</TabsContent>
						<TabsContent className="pt-6" value="code">
							<PullRequestFiles
								commits={data.commits}
								initialInlineComments={initialInlineComments}
								onInlineCommentsChange={handleInlineCommentsChange}
								review={review}
							/>
						</TabsContent>
					</div>
				</Tabs>
			) : (
				<>
					<PullRequestStickyHeaderShell scrollContainerRef={scrollContainerRef}>
						{header}
					</PullRequestStickyHeaderShell>
					<div className="min-h-0 flex-1 pb-6">
						<PullRequestOverview data={data} />
					</div>
				</>
			)}
		</section>
	);
}
