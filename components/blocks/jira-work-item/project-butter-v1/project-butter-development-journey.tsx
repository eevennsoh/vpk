"use client";

import type { ReactNode } from "react";
import { DevelopmentPanel, type DevelopmentPanelProps } from "@/components/blocks/development-panel/development-panel";
import type { PullRequestAuthor } from "@/components/blocks/pull-request/components/pull-request-types";
import { Button } from "@/components/ui/button";
import { PROJECT_BUTTER_JOURNEY_PULL_REQUEST, projectButterDevelopmentChecks, projectButterDevelopmentPresentation, type ProjectButterDevelopmentPhase } from "@/components/blocks/jira-work-item/project-butter-v1/development-journey-model";

export interface ProjectButterDevelopmentJourneyProps {
	phase?: ProjectButterDevelopmentPhase;
	autoFixEnabled: boolean;
	autoMergeEnabled: boolean;
	agentName?: string;
	author?: PullRequestAuthor;
	onAutoFixChange?: (enabled: boolean) => void;
	onAutoMergeChange?: (enabled: boolean) => void;
	onFixCheck?: () => void;
	onMergePullRequest?: () => void;
	workItem?: DevelopmentPanelProps["workItem"];
	headerExtra?: ReactNode;
	surface?: DevelopmentPanelProps["surface"];
}

export function ProjectButterDevelopmentJourney({ agentName = "Rovo", author, autoFixEnabled, autoMergeEnabled, headerExtra, onAutoFixChange, onAutoMergeChange, onFixCheck, onMergePullRequest, phase, surface, workItem = { code: "PAY-999", summary: "Improve merchant onboarding for Payments SDK v2", description: "" } }: Readonly<ProjectButterDevelopmentJourneyProps>) {
	const pullRequestSettings = { autoFix: autoFixEnabled, mergeWhenReady: autoMergeEnabled, onAutoFixChange, onMergeWhenReadyChange: onAutoMergeChange };
	const presentation = phase ? projectButterDevelopmentPresentation(phase) : undefined;
	const checks = phase ? projectButterDevelopmentChecks(phase) : [];
	const footerExtra = phase === "passed" ? <Button className="mt-2 w-full" disabled={!onMergePullRequest} onClick={onMergePullRequest} size="compact" type="button" variant="outline">Merge pull request</Button> : null;
	return (
		<section aria-label={phase ? "Pull request development" : undefined} data-ci-status={presentation?.ciStatus} data-project-butter-development={phase} data-pr-number={phase ? PROJECT_BUTTER_JOURNEY_PULL_REQUEST.number : undefined}>
			<DevelopmentPanel
				footerExtra={footerExtra}
				headerExtra={headerExtra}
				pullRequests={presentation ? [{ ...PROJECT_BUTTER_JOURNEY_PULL_REQUEST, author: author ?? { name: agentName }, checks, onFix: onFixCheck ? () => onFixCheck() : undefined, showReview: true, relativeTime: "Just now", repository: "payments-platform/payments", status: presentation.status }] : []}
				pullRequestSettings={pullRequestSettings}
				surface={surface}
				workItem={workItem}
			/>
		</section>
	);
}
