import { defineConfig } from "@playwright/test";

// Browser specs only; tests/helpers/*.test.ts are node:test suites run by scripts/run-js-unit-tests.mjs.
// Specs resolve their own origin through tests/helpers/origin.ts (this worktree's server, never a fixed port).
export default defineConfig({
	testDir: "tests",
	testMatch: "**/*.spec.ts",
});
