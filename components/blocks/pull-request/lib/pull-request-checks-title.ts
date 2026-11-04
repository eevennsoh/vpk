import type { PullRequestCheck } from "@/components/blocks/pull-request/components/pull-request-checks-list";

export function pullRequestChecksTitleState(checks: readonly PullRequestCheck[]) {
	const passed = checks.filter((check) => check.status === "passed").length;
	return {
		inProgress: checks.some((check) => check.status === "running" || check.status === "queued"),
		passed,
		total: checks.length,
	};
}

/**
 * One-line CI summary for a collapsed row: `3/3 builds passed`, with
 * `· N failed` appended once anything has failed. `running` means a job is actively
 * executing (the caller shows a spinner); otherwise `segments` are the status
 * groups for a segmented progress ring.
 */
export function pullRequestChecksSummary(checks: readonly PullRequestCheck[]) {
	const { inProgress, passed, total } = pullRequestChecksTitleState(checks);
	const failed = checks.filter((check) => check.status === "failed").length;
	const running = checks.some((check) => check.status === "running");
	const noun = total === 1 ? "build" : "builds";
	const base = `${passed}/${total} ${noun} passed`;
	// One weighted arc per status (not per check), in passed / failed / yet-to-run order.
	const segments = (
		[
			{ status: "passed", weight: passed },
			{ status: "failed", weight: failed },
			{ status: "pending", weight: total - passed - failed },
		] as const
	).filter((segment) => segment.weight > 0);
	return {
		failed,
		inProgress,
		label: failed > 0 ? `${base} · ${failed} failed` : base,
		running,
		segments,
	};
}
