// Test files that are deliberately not run by this gate, each with its reason. Every
// *.test.* file is either run (a CI-included classification or an included prefix) or
// listed here or in legacy-drift; `node scripts/run-js-unit-tests.mjs` fails on the rest.
const ARTIFACT_SUITE_REASON = "artifacts/ deliverable owned by interactive vpk-html sessions (automation never modifies artifacts/); its figure suites take minutes and are run from that artifact's own workflow";
const TYPE_CONTRACT_REASON = "type-level contract with no runtime test; pnpm run typecheck enforces it";
export const SKIPPED_TEST_FILES = {
	"artifacts/vpk-html/eu26-animation-explained/_figures/build-explorer.behavior.test.mjs": ARTIFACT_SUITE_REASON,
	"artifacts/vpk-html/eu26-animation-explained/_figures/continuous-scrub.behavior.test.mjs": ARTIFACT_SUITE_REASON,
	"artifacts/vpk-html/eu26-animation-explained/_figures/cursor.behavior.test.mjs": ARTIFACT_SUITE_REASON,
	"artifacts/vpk-html/eu26-animation-explained/_figures/explorer.behavior.test.mjs": ARTIFACT_SUITE_REASON,
	"artifacts/vpk-html/eu26-animation-explained/_figures/face-overlap.test.mjs": ARTIFACT_SUITE_REASON,
	"artifacts/vpk-html/eu26-animation-explained/_figures/media-ui.behavior.test.mjs": ARTIFACT_SUITE_REASON,
	"artifacts/vpk-html/eu26-animation-explained/_figures/refinement-model.test.mjs": ARTIFACT_SUITE_REASON,
	"artifacts/vpk-html/eu26-animation-explained/_figures/refinement.behavior.test.mjs": ARTIFACT_SUITE_REASON,
	"artifacts/vpk-html/eu26-animation-explained/_figures/slides-timeline.behavior.test.mjs": ARTIFACT_SUITE_REASON,
	"artifacts/vpk-html/eu26-animation-explained/_figures/story-layout.behavior.test.mjs": ARTIFACT_SUITE_REASON,
	"artifacts/vpk-html/eu26-animation-explained/_figures/tick-scaling.behavior.test.mjs": ARTIFACT_SUITE_REASON,
	"artifacts/vpk-html/eu26-animation-explained/_figures/timeline-motion.test.mjs": ARTIFACT_SUITE_REASON,
	"artifacts/vpk-html/eu26-animation-explained/_figures/vertical-timeline.behavior.test.mjs": ARTIFACT_SUITE_REASON,
	"artifacts/vpk-html/eu26-animation-explained/_figures/video-playhead.behavior.test.mjs": ARTIFACT_SUITE_REASON,
	"artifacts/vpk-html/eu26-animation-explained/_video/composition.behavior.test.mjs": ARTIFACT_SUITE_REASON,
	"artifacts/vpk-html/eu26-animation-explained/_video/render-server.test.mjs": ARTIFACT_SUITE_REASON,
	"components/arts/rovo-p5/rovo-p5.contract.test.ts": TYPE_CONTRACT_REASON,
	"components/ui-custom/twg-appstack.contract.test.ts": TYPE_CONTRACT_REASON,
};
