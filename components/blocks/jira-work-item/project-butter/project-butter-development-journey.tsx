"use client";

import CheckCircleIcon from "@atlaskit/icon/core/check-circle";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import StatusErrorIcon from "@atlaskit/icon/core/status-error";
import { PullRequest } from "@/components/blocks/pull-request";
import { PullRequestChecksList } from "@/components/blocks/pull-request/components/pull-request-checks-list";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { PROJECT_BUTTER_JOURNEY_PULL_REQUEST, projectButterDevelopmentChecks, projectButterDevelopmentPresentation, type ProjectButterDevelopmentPhase } from "@/components/blocks/jira-work-item/project-butter/development-journey-model";

export interface ProjectButterDevelopmentJourneyProps {
	phase: ProjectButterDevelopmentPhase;
	autoFixEnabled: boolean;
	autoMergeEnabled: boolean;
	agentName?: string;
	onAutoFixChange?: (enabled: boolean) => void;
	onAutoMergeChange?: (enabled: boolean) => void;
	onFailChecks?: () => void;
	onFixCheck?: () => void;
	onMergePullRequest?: () => void;
	onOpenPullRequest?: () => void;
}

export function ProjectButterDevelopmentJourney({ agentName = "Rovo", autoFixEnabled, autoMergeEnabled, onAutoFixChange, onAutoMergeChange, onFailChecks, onFixCheck, onMergePullRequest, onOpenPullRequest, phase }: Readonly<ProjectButterDevelopmentJourneyProps>) {
	const presentation = projectButterDevelopmentPresentation(phase);
	const checks = projectButterDevelopmentChecks(phase);
	const automationLabel = autoFixEnabled && autoMergeEnabled ? "Auto-fix & auto-merge enabled" : autoFixEnabled ? "Auto-fix enabled" : autoMergeEnabled ? "Auto-merge enabled" : "Automation disabled";
	const locked = phase === "merged";
	return (
		<section aria-label="Pull request development" className="flex min-w-0 flex-col gap-3" data-ci-status={presentation.ciStatus} data-project-butter-development={phase} data-pr-number={PROJECT_BUTTER_JOURNEY_PULL_REQUEST.number}>
			<PullRequest {...PROJECT_BUTTER_JOURNEY_PULL_REQUEST} author={{ name: agentName }} onActivate={onOpenPullRequest} status={presentation.status} variant="spacious" />
			<div aria-live="polite" className="flex items-start gap-2 text-xs">
				<span aria-hidden className={cn("mt-0.5 shrink-0", presentation.ciStatus === "failed" ? "text-icon-danger" : "text-icon-success")}>
					{presentation.ciStatus === "running" ? <Spinner label="" size="sm" /> : presentation.ciStatus === "failed" ? <StatusErrorIcon label="" size="small" /> : <CheckCircleIcon label="" size="small" />}
				</span>
				<div className="min-w-0 space-y-1">
					<p className="font-medium text-text">{presentation.label}</p>
					<p className="text-text-subtle">{phase === "fixing" ? `${agentName} is fixing the failing check. ` : ""}{presentation.detail}</p>
				</div>
			</div>
			<DropdownMenu>
				<DropdownMenuTrigger render={<Button aria-label={`CI checks and automation: ${automationLabel}`} className="w-full justify-between" type="button" variant="ghost" />}>
					<span className="min-w-0 truncate text-xs">{automationLabel}</span><ChevronDownIcon label="" size="small" />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-80" positionerClassName="z-[650]">
					<DropdownMenuGroup>
						<DropdownMenuLabel>CI checks · {checks.filter((check) => check.status === "passed").length}/3 passed</DropdownMenuLabel>
						<PullRequestChecksList checks={checks} density="compact" />
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuLabel>Automation</DropdownMenuLabel>
						<DropdownMenuCheckboxItem checked={autoFixEnabled} closeOnClick={false} disabled={locked || !onAutoFixChange} onCheckedChange={onAutoFixChange}>Auto-fix CI & address comments</DropdownMenuCheckboxItem>
						<DropdownMenuCheckboxItem checked={autoMergeEnabled} closeOnClick={false} disabled={locked || !onAutoMergeChange} onCheckedChange={onAutoMergeChange}>Auto-merge when ready</DropdownMenuCheckboxItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
			{phase === "pr" && onFailChecks ? <Button onClick={onFailChecks} size="compact" type="button" variant="outline">Complete checks</Button> : null}
			{phase === "failed" ? <Button disabled={!onFixCheck} onClick={onFixCheck} size="compact" type="button" variant="outline">Fix accessibility check</Button> : phase === "passed" ? <Button disabled={!onMergePullRequest} onClick={onMergePullRequest} size="compact" type="button" variant="outline">Merge pull request</Button> : null}
		</section>
	);
}
