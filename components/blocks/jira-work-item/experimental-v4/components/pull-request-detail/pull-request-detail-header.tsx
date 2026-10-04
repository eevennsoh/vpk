"use client";

import { useState, type RefObject } from "react";

import { PullRequestHeader } from "@/components/blocks/pull-request-header";
import type {
	PullRequestHeaderMergeState,
	PullRequestHeaderSubmitReviewAction,
} from "@/components/blocks/pull-request-header";
import { useMetadataRail } from "@/components/blocks/jira-work-item/experimental-v4/context-metadata-rail";

import type {
	PullRequestDetailData,
} from "@/components/blocks/jira-work-item/experimental-v4/lib/pull-request-detail-data";
import { PULL_REQUEST_CHECKS_SECTION_ID } from "./pull-request-details-rail";

const DEMO_MERGE = () => undefined;

interface PullRequestDetailHeaderProps {
	data: PullRequestDetailData;
	onGuideOpen?: () => void;
	scrollContainerRef: RefObject<HTMLElement | null>;
	submitReviewAction?: PullRequestHeaderSubmitReviewAction;
}

/** Derives the actionable header state from mergeability, checks, and review. */
function mapPullRequestHeaderMergeState(
	data: PullRequestDetailData,
): PullRequestHeaderMergeState {
	switch (data.mergeState) {
		case "conflicts":
			return "merge-conflicts";
		case "merged":
			return "ready";
		case "ready":
		case "blocked":
			if (data.checks.some((check) => check.status === "failed")) {
				return "checks-failed";
			}
			if (data.checks.some((check) => check.status === "running" || check.status === "queued")) {
				return "checks-running";
			}
			if (
				data.reviewDecision === "changes-requested"
				|| data.reviewDecision === "review-required"
			) {
				return "review-required";
			}
			return "ready";
		default: {
			const _exhaustive: never = data.mergeState;
			return _exhaustive;
		}
	}
}

/** Thin adapter: maps PR detail data onto the shared Pull request header block. */
export function PullRequestDetailHeader({
	data,
	onGuideOpen,
	scrollContainerRef,
	submitReviewAction,
}: Readonly<PullRequestDetailHeaderProps>) {
	const [autoMerge, setAutoMerge] = useState(true);
	const { requestExpandPullRequestSection } = useMetadataRail();
	const isOpen = data.status === "Open";
	const mergeReady = isOpen && data.mergeState === "ready";
	// The rail is Details-only now, so the section request is the whole action.
	const openChecks = () => {
		requestExpandPullRequestSection(data.identity, PULL_REQUEST_CHECKS_SECTION_ID);
	};

	return (
		<PullRequestHeader
			number={data.number}
			title={data.title}
			status={data.status}
			baseBranch={data.baseBranch}
			headBranch={data.headBranch}
			repository={data.repository}
			url={data.url}
			scmProviderName={data.provider.name}
			mergeState={mapPullRequestHeaderMergeState(data)}
			autoMerge={isOpen ? autoMerge : false}
			onAutoMergeChange={isOpen ? setAutoMerge : undefined}
			onChecksFailedClick={openChecks}
			onChecksRunningClick={openChecks}
			onMergeConflictsClick={openChecks}
			onConvertToDraftClick={() => undefined}
			onMergeClick={mergeReady ? DEMO_MERGE : undefined}
			onReviewRequiredClick={onGuideOpen}
			onClosePullRequestClick={() => undefined}
			scrollContainerRef={scrollContainerRef}
			submitReviewAction={isOpen ? submitReviewAction : undefined}
			className="rounded-xl border bg-surface p-4"
			data-jira-work-item-pull-request-detail-header
		/>
	);
}
