import type { PullRequestCheck } from "@/components/blocks/pull-request/components/pull-request-checks-list";

export interface PullRequestChecksScenario {
	id: string;
	label: string;
	/** Compact label for toggle groups. */
	shortLabel: string;
	description: string;
	checks: readonly PullRequestCheck[];
}

/**
 * CI check permutations for the catalog. They mirror what the Jira golden
 * journeys walk through (queued → running → settled → failed → repaired), laid
 * side by side so each row state can be read without stepping a story.
 *
 * `running` details use the `Running for Ns` shape so the row ticks live;
 * `queued` rows carry a plain label because nothing has started yet.
 */
export const PULL_REQUEST_CHECKS_SCENARIOS: readonly PullRequestChecksScenario[] = [
	{
		id: "queued",
		shortLabel: "Queued",
		label: "Yet to be run",
		description: "CI has accepted the push but no job has started.",
		checks: [
			{ id: "lint-types", name: "Lint and typecheck", status: "queued", details: "Queued" },
			{ id: "unit-tests", name: "Unit tests", status: "queued", details: "Queued" },
			{ id: "browser-tests", name: "Guest checkout browser tests", status: "queued", details: "Waiting for CI" },
		],
	},
	{
		id: "running",
		shortLabel: "Running",
		label: "Running",
		description: "Jobs are executing; each row shows a live elapsed time.",
		checks: [
			{ id: "lint-types", name: "Lint and typecheck", status: "running", details: "Running for 48s" },
			{ id: "unit-tests", name: "Unit tests", status: "running", details: "Running for 12s" },
			{ id: "browser-tests", name: "Guest checkout browser tests", status: "running", details: "Running for 6s" },
		],
	},
	{
		id: "in-progress",
		shortLabel: "Mixed",
		label: "In progress (mixed)",
		description: "Some jobs have landed, some are running, some still wait.",
		checks: [
			{ id: "lint-types", name: "Lint and typecheck", status: "running", details: "Running for 1m 12s" },
			{ id: "unit-tests", name: "Unit tests", status: "passed", details: "418 tests in 2m 46s" },
			{ id: "browser-tests", name: "Guest checkout browser tests", status: "queued", details: "Waiting for CI" },
		],
	},
	{
		id: "passed",
		shortLabel: "Passed",
		label: "Successful",
		description: "Every check passed.",
		checks: [
			{ id: "lint-types", name: "Lint and typecheck", status: "passed", details: "Completed in 1m 18s" },
			{ id: "unit-tests", name: "Unit tests", status: "passed", details: "418 tests in 2m 46s" },
			{ id: "browser-tests", name: "Guest checkout browser tests", status: "passed", details: "5 scenarios in 1m 32s" },
		],
	},
	{
		id: "failed",
		shortLabel: "Failed",
		label: "Failed",
		description: "A check failed; its row offers Fix, and the others stay green.",
		checks: [
			{ id: "lint-types", name: "Lint and typecheck", status: "failed", details: "Failed after 42s · deliveryAddress may be null" },
			{ id: "unit-tests", name: "Unit tests", status: "passed", details: "418 tests in 2m 46s" },
			{ id: "browser-tests", name: "Guest checkout browser tests", status: "passed", details: "5 scenarios in 1m 32s" },
		],
	},
];

/** Scenario checks by id; throws on a typo so a fixture cannot silently lose its CI row. */
export function pullRequestChecksScenario(id: string): readonly PullRequestCheck[] {
	const scenario = PULL_REQUEST_CHECKS_SCENARIOS.find((candidate) => candidate.id === id);
	if (!scenario) {
		throw new Error(`Unknown pull request checks scenario: ${id}`);
	}
	return scenario.checks;
}
