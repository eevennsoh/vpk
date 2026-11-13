import { defineConfig } from "@playwright/test";

// Browser specs only; tests/helpers/*.test.ts are node:test suites run by scripts/run-js-unit-tests.mjs.
// Specs resolve their own origin through tests/helpers/origin.ts (this worktree's server, never a fixed port).
// Evidence lands under the ignored output/playwright/ (see WORKFLOW.md and .agents/docs/symphony.md).
const isCI = Boolean(process.env.CI);

export default defineConfig({
	testDir: "tests",
	testMatch: "**/*.spec.ts",
	// A committed test.only would silently skip the rest of the suite.
	forbidOnly: isCI,
	// One retry tells a flaky spec from a broken one; the retry records a trace to show why.
	retries: 1,
	outputDir: "output/playwright/test-results",
	reporter: [
		[isCI ? "line" : "list"],
		["html", { open: "never", outputFolder: "output/playwright/report" }],
		["json", { outputFile: "output/playwright/results.json" }],
	],
	use: {
		trace: "on-first-retry",
		screenshot: "only-on-failure",
	},
});
