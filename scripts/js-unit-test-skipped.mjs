// Test files that are deliberately not run by this gate, each with its reason. Every
// *.test.* file with a node:test import runs by default (classification is by file name, see
// scripts/run-js-unit-tests.mjs); only the files and roots listed here, and the frozen
// legacy-drift baseline, do not run.

// Whole roots the gate never runs. Interactive vpk-html sessions add suites under
// artifacts/ routinely; listing them file by file would turn the gate red for work it
// does not cover.
export const SKIPPED_TEST_PREFIXES = {
	"artifacts/": "artifacts/ deliverables are owned by interactive vpk-html sessions (automation never modifies artifacts/); their suites run from each artifact's own workflow",
};

const TYPE_CONTRACT_REASON = "type-level contract with no runtime test; pnpm run typecheck enforces it";
export const SKIPPED_TEST_FILES = {
	"components/arts/rovo-p5/rovo-p5.contract.test.ts": TYPE_CONTRACT_REASON,
	"components/ui-custom/twg-appstack.contract.test.ts": TYPE_CONTRACT_REASON,
};
