export const FAILED_PR_CHECKS = [
	{ id: "lint-types", name: "Lint and typecheck", status: "failed", details: "Failed after 42s · deliveryAddress may be null" },
	{ id: "unit-tests", name: "Unit tests", status: "passed", details: "418 tests in 2m 46s" },
	{ id: "browser-tests", name: "Guest checkout browser tests", status: "passed", details: "5 scenarios in 1m 32s" },
] as const;

/** CI has picked up the first job as soon as the PR opens; the rest still wait. */
export const STARTED_PR_CHECKS = [
	{ id: "lint-types", name: "Lint and typecheck", status: "running", details: "Running for 6s" },
	{ id: "unit-tests", name: "Unit tests", status: "queued", details: "Queued" },
	{ id: "browser-tests", name: "Guest checkout browser tests", status: "queued", details: "Queued" },
] as const;

export const RUNNING_PR_CHECKS = [
	{ id: "lint-types", name: "Lint and typecheck", status: "running", details: "Running for 48s" },
	{ id: "unit-tests", name: "Unit tests", status: "running", details: "Running for 12s" },
	{ id: "browser-tests", name: "Guest checkout browser tests", status: "queued", details: "Waiting for CI" },
] as const;

/** Unit tests have landed green; browser is still running and lint continues. */
export const UNIT_PASSED_PR_CHECKS = [
	{ id: "lint-types", name: "Lint and typecheck", status: "running", details: "Running for 1m 12s" },
	{ id: "unit-tests", name: "Unit tests", status: "passed", details: "418 tests in 2m 46s" },
	{ id: "browser-tests", name: "Guest checkout browser tests", status: "running", details: "Running for 48s" },
] as const;

/** Unit + browser have landed green; lint is still running before it fails. */
export const SETTLING_PR_CHECKS = [
	{ id: "lint-types", name: "Lint and typecheck", status: "running", details: "Running for 1m 48s" },
	{ id: "unit-tests", name: "Unit tests", status: "passed", details: "418 tests in 2m 46s" },
	{ id: "browser-tests", name: "Guest checkout browser tests", status: "passed", details: "5 scenarios in 1m 32s" },
] as const;

export const RERUNNING_PR_CHECKS = [
	{ id: "lint-types", name: "Lint and typecheck", status: "running", details: "Rerunning after delivery-address repair" },
	{ id: "unit-tests", name: "Unit tests", status: "passed", details: "418 tests in 2m 46s" },
	{ id: "browser-tests", name: "Guest checkout browser tests", status: "passed", details: "5 scenarios in 1m 32s" },
] as const;

export const PASSED_PR_CHECKS = [
	{ id: "lint-types", name: "Lint and typecheck", status: "passed", details: "Rerun completed in 1m 18s" },
	{ id: "unit-tests", name: "Unit tests", status: "passed", details: "418 tests in 2m 46s" },
	{ id: "browser-tests", name: "Guest checkout browser tests", status: "passed", details: "5 scenarios in 1m 32s" },
] as const;
