import type { PullRequestCheck } from "@/components/blocks/pull-request/components/pull-request-checks-list";

export type ProjectButterDevelopmentPhase = "pr" | "failed" | "fixing" | "passed" | "merged";

export const PROJECT_BUTTER_JOURNEY_PULL_REQUEST = {
	number: 284,
	title: "Add merchant onboarding quickstart",
	href: "https://github.com/payments-platform/payments/pull/284",
	branch: "rovo/pay-999-merchant-onboarding",
	targetBranch: "main",
	additions: 186,
	deletions: 24,
	filesChanged: 6,
};

const PHASE_PRESENTATION = {
	pr: { status: "Open", ciStatus: "running", label: "Pull request created · Checks running", detail: "Build, unit tests, and accessibility checks are running." },
	failed: { status: "Open", ciStatus: "failed", label: "2 of 3 checks passed", detail: "Inline errors are not associated with their form fields. Add aria-describedby and announce validation errors." },
	fixing: { status: "Open", ciStatus: "running", label: "Fixing accessibility check", detail: "Associating inline errors with their fields and rerunning accessibility checks." },
	passed: { status: "Open", ciStatus: "passed", label: "All 3 checks passed", detail: "Inline errors are associated with their fields. Ready to merge into main." },
	merged: { status: "Merged", ciStatus: "passed", label: "All 3 checks passed · Merged", detail: "Merchant onboarding quickstart merged into main." },
} satisfies Record<ProjectButterDevelopmentPhase, {
	status: "Open" | "Merged";
	ciStatus: "running" | "failed" | "passed";
	label: string;
	detail: string;
}>;

export function projectButterDevelopmentPresentation(phase: ProjectButterDevelopmentPhase) {
	return PHASE_PRESENTATION[phase];
}

export function nextProjectButterDevelopmentPhase(phase: ProjectButterDevelopmentPhase, autoFix: boolean, autoMerge: boolean): ProjectButterDevelopmentPhase | null {
	return phase === "failed" && autoFix ? "fixing" : phase === "fixing" ? "passed" : phase === "passed" && autoMerge ? "merged" : null;
}

export function projectButterDevelopmentChecks(phase: ProjectButterDevelopmentPhase): readonly PullRequestCheck[] {
	return [
		{ id: "build", name: "Build", status: phase === "pr" ? "running" : "passed", details: phase === "pr" ? "Building merchant onboarding quickstart" : "Production build passed" },
		{ id: "tests", name: "Unit tests", status: phase === "pr" ? "running" : "passed", details: phase === "pr" ? "Running onboarding tests" : "All unit tests passed" },
		{
			id: "accessibility",
			name: "Accessibility",
			status: phase === "pr" ? "queued" : phase === "failed" ? "failed" : phase === "fixing" ? "running" : "passed",
			details: phase === "failed" ? PHASE_PRESENTATION.failed.detail : phase === "fixing" ? "Rechecking inline-error associations" : phase === "pr" ? "Waiting for build" : "Inline errors are accessible",
		},
	];
}
