"use client";

import { useEffect, useState, type ReactNode } from "react";
import { DevelopmentPanel, type DevelopmentPanelProps } from "@/components/blocks/development-panel/development-panel";
import type { PullRequestAuthor } from "@/components/blocks/pull-request/components/pull-request-types";
import { Button } from "@/components/ui/button";
import { PROJECT_BUTTER_JOURNEY_PULL_REQUEST, nextProjectButterDevelopmentPhase, projectButterDevelopmentChecks, projectButterDevelopmentPresentation, type ProjectButterDevelopmentPhase } from "@/components/blocks/jira-work-item/project-butter/development-journey-model";

export interface ProjectButterDevelopmentJourneyProps {
	phase?: ProjectButterDevelopmentPhase;
	pullRequests?: DevelopmentPanelProps["pullRequests"];
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

export function ProjectButterDevelopmentJourney({ agentName = "Rovo", author, autoFixEnabled, autoMergeEnabled, headerExtra, onAutoFixChange, onAutoMergeChange, onFixCheck, onMergePullRequest, phase, pullRequests, surface, workItem = { code: "PAY-999", summary: "Improve merchant onboarding for Payments SDK v2", description: "" } }: Readonly<ProjectButterDevelopmentJourneyProps>) {
	const pullRequestSettings = { autoFix: autoFixEnabled, mergeWhenReady: autoMergeEnabled, onAutoFixChange, onMergeWhenReadyChange: onAutoMergeChange };
	const presentation = phase ? projectButterDevelopmentPresentation(phase) : undefined;
	const checks = phase ? projectButterDevelopmentChecks(phase) : [];
	const footerExtra = phase === "passed" ? <Button className="mt-2 w-full" disabled={!onMergePullRequest} onClick={onMergePullRequest} size="compact" type="button" variant="outline">Merge pull request</Button> : null;
	return (
		<section aria-label={phase ? "Pull request development" : undefined} data-ci-status={presentation?.ciStatus} data-project-butter-development={phase} data-pr-number={phase ? PROJECT_BUTTER_JOURNEY_PULL_REQUEST.number : undefined}>
			<DevelopmentPanel
				footerExtra={footerExtra}
				headerExtra={headerExtra}
				pullRequests={pullRequests ?? (presentation ? [{ ...PROJECT_BUTTER_JOURNEY_PULL_REQUEST, author: author ?? { name: agentName }, checks, onFix: onFixCheck ? () => onFixCheck() : undefined, showReview: true, relativeTime: "Just now", repository: "payments-platform/payments", status: presentation.status }] : [])}
				pullRequestSettings={pullRequestSettings}
				surface={surface}
				workItem={workItem}
			/>
		</section>
	);
}

export function ProjectButterDevelopmentGallery({ author }: Readonly<{ author: PullRequestAuthor }>) {
	const [phase, setPhase] = useState<ProjectButterDevelopmentPhase>("failed");
	const [autoFixEnabled, setAutoFixEnabled] = useState(true);
	const [autoMergeEnabled, setAutoMergeEnabled] = useState(true);
	useEffect(() => {
		const next = nextProjectButterDevelopmentPhase(phase, autoFixEnabled, autoMergeEnabled);
		if (!next) return;
		const timer = window.setTimeout(() => setPhase(next), next === "merged" ? 2000 : 5000);
		return () => window.clearTimeout(timer);
	}, [autoFixEnabled, autoMergeEnabled, phase]);
	return <ProjectButterDevelopmentJourney author={author} autoFixEnabled={autoFixEnabled} autoMergeEnabled={autoMergeEnabled} onAutoFixChange={setAutoFixEnabled} onAutoMergeChange={setAutoMergeEnabled} onFixCheck={() => setPhase("fixing")} onMergePullRequest={() => setPhase("merged")} phase={phase} />;
}
