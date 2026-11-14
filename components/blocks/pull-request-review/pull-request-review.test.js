const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

const DIR = __dirname;
const COMPONENT_SOURCE = fs.readFileSync(
	path.join(DIR, "components", "pull-request-review.tsx"),
	"utf8",
);
const VERDICT_SOURCE = fs.readFileSync(
	path.join(DIR, "components", "pull-request-review-verdict.tsx"),
	"utf8",
);
const VERDICT_DATA_SOURCE = fs.readFileSync(
	path.join(DIR, "data", "pull-request-review-verdicts.ts"),
	"utf8",
);
const TYPES_SOURCE = fs.readFileSync(
	path.join(DIR, "components", "pull-request-review-types.ts"),
	"utf8",
);
const DATA_SOURCE = fs.readFileSync(
	path.join(DIR, "data", "demo-pull-request-review.ts"),
	"utf8",
);
const PAGE_SOURCE = fs.readFileSync(path.join(DIR, "page.tsx"), "utf8");
const INDEX_SOURCE = fs.readFileSync(path.join(DIR, "index.ts"), "utf8");
const DEMO_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components", "website", "demos", "blocks", "pull-request-review-demo.tsx"),
	"utf8",
);
const FLOATING_COMPOSER_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components", "projects", "shared", "components", "floating-composer.tsx"),
	"utf8",
);
const COMPONENTS_SOURCE = fs.readFileSync(path.join(process.cwd(), "app", "data", "component-manifest.ts"), "utf8");
const COMPONENT_MANIFEST_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "app", "data", "component-manifest.ts"),
	"utf8",
);
const BLOCK_DETAILS_SOURCE = readDetailCategorySource("blocks");
const REGISTRY_SOURCE = readWebsiteRegistrySource();

test("PullRequestReview exposes the review composer props contract", () => {
	assert.match(TYPES_SOURCE, /ariaLabel\?: string/u);
	assert.match(
		TYPES_SOURCE,
		/export type PullRequestReviewVerdict =\s*"comment" \| "approve" \| "request-changes"/u,
	);
	assert.match(
		TYPES_SOURCE,
		/export type PullRequestReviewVariant = "compact" \| "expanded"/u,
	);
	assert.match(TYPES_SOURCE, /variant\?: PullRequestReviewVariant/u);
	assert.match(TYPES_SOURCE, /defaultVariant\?: PullRequestReviewVariant/u);
	assert.match(TYPES_SOURCE, /autoFocus\?: boolean/u);
	assert.match(TYPES_SOURCE, /expandOnFocus\?: boolean/u);
	assert.match(TYPES_SOURCE, /reviewedCount\?: number/u);
	assert.match(TYPES_SOURCE, /reviewedTotal\?: number/u);
	assert.match(TYPES_SOURCE, /commentCount\?: number/u);
	assert.match(TYPES_SOURCE, /submitDisabled\?: boolean/u);
	assert.match(
		TYPES_SOURCE,
		/onSubmit\?: \(submission: PullRequestReviewSubmission\) => boolean \| void/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/const accepted = onSubmit\?\.\(\{ body: value\.trim\(\), verdict: activeVerdict \}\);[\s\S]*if \(accepted === false\) return;[\s\S]*updateValue\(""\)/u,
	);
	assert.match(TYPES_SOURCE, /export interface PullRequestReviewSubmission \{[\s\S]*body: string;[\s\S]*verdict: PullRequestReviewVerdict;/u);
});

test("the preview gives each review form landmark a unique accessible name", () => {
	assert.match(COMPONENT_SOURCE, /aria-label=\{ariaLabel \?\? title\}/u);

	const landmarkLabels = [...PAGE_SOURCE.matchAll(/ariaLabel="([^"]+)"/gu)].map(
		([, label]) => label,
	);
	assert.equal(landmarkLabels.length, 4);
	assert.equal(new Set(landmarkLabels).size, landmarkLabels.length);
});

test("the review editor can take focus when a host opens the expanded surface", () => {
	assert.match(COMPONENT_SOURCE, /autoFocus = false/u);
	assert.match(
		COMPONENT_SOURCE,
		/<PromptInputTextarea[\s\S]*autoFocus=\{autoFocus\}/u,
	);
});

test("compact and expanded render one composer subtree so the draft survives the transform", () => {
	// A second <PromptInputTextarea> would mean a second editor instance, and
	// expanding on focus would drop the caret and any open mention menu.
	assert.equal(
		(COMPONENT_SOURCE.match(/<PromptInputTextarea/gu) ?? []).length,
		1,
		"expected exactly one PromptInputTextarea across both presentations",
	);
	assert.equal(
		(COMPONENT_SOURCE.match(/<FloatingComposer/gu) ?? []).length,
		1,
		"expected exactly one FloatingComposer across both presentations",
	);
	// Early-returning a separate expanded tree is the regression this guards.
	assert.doesNotMatch(COMPONENT_SOURCE, /if \(isExpanded\) \{\s*return/u);
});

test("expanded pins the stacked FloatingComposer layout", () => {
	assert.match(
		COMPONENT_SOURCE,
		/layout=\{isExpanded \? "stacked" : "auto"\}/u,
		"expanded must reserve a full-width editor row instead of waiting for the draft to wrap",
	);
	assert.match(FLOATING_COMPOSER_SOURCE, /layout\?: "auto" \| "stacked"/u);
	assert.match(
		FLOATING_COMPOSER_SOURCE,
		/const isExpanded = layout === "stacked" \|\| isMeasuredExpanded/u,
	);
	// The probe cannot change a caller-pinned layout, so it must not run.
	assert.match(
		FLOATING_COMPOSER_SOURCE,
		/if \(layout === "stacked"\) \{\s*return \(\) => undefined;\s*\}/u,
	);
	assert.match(FLOATING_COMPOSER_SOURCE, /\}, \[layout\]\);/u);
	assert.match(FLOATING_COMPOSER_SOURCE, /data-slot="floating-composer-row"/u);
});

test("submit enables when the editor has non-empty content", () => {
	// Every verdict needs a trimmed body. Host `submitDisabled` is only a hard
	// block — chapter progress must not keep Send off while the reviewer types.
	assert.match(
		COMPONENT_SOURCE,
		/function canSubmitReview\(body: string\): boolean \{\s*return body\.trim\(\)\.length > 0;\s*\}/u,
	);
	assert.match(COMPONENT_SOURCE, /submitDisabled = false/u);
	assert.match(
		COMPONENT_SOURCE,
		/const canSubmit = !submitDisabled && canSubmitReview\(value\);/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/<PromptInputSubmit[\s\S]*className="hover:opacity-90 active:opacity-80"[\s\S]*disabled=\{!canSubmit\}/u,
	);
	assert.doesNotMatch(
		COMPONENT_SOURCE,
		/canSubmitReview\(value, activeVerdict\)/u,
		"verdict must not gate Send — only content (and hard submitDisabled) does",
	);
});

test("the verdict control is a radiogroup, not a tablist", () => {
	// Three submit verdicts with no tabpanels behind them; role="tab" would be
	// an a11y lie even though the skin borrows the ADS segmented tab.
	assert.match(VERDICT_SOURCE, /role="radiogroup"/u);
	assert.match(VERDICT_SOURCE, /role="radio"/u);
	assert.match(VERDICT_SOURCE, /aria-checked=\{isSelected\}/u);
	assert.doesNotMatch(VERDICT_SOURCE, /role="tab"/u);
	// Roving tabindex: exactly one stop per group.
	assert.match(VERDICT_SOURCE, /tabIndex=\{isSelected \? 0 : -1\}/u);
	assert.match(VERDICT_SOURCE, /event\.key === "ArrowRight" \|\| event\.key === "ArrowDown"/u);
	assert.match(VERDICT_SOURCE, /event\.key === "ArrowLeft" \|\| event\.key === "ArrowUp"/u);
	for (const label of ["Comment", "Approve", "Request changes"]) {
		assert.ok(
			VERDICT_DATA_SOURCE.includes(`label: "${label}"`),
			`missing verdict "${label}"`,
		);
	}
});

test("the verdict control file exports a component and nothing else", () => {
	// Mixing a component and a constant in one module defeats Fast Refresh state
	// preservation (react-doctor/only-export-components), so the option list
	// lives in data/. Regression for PR #1324 review.
	assert.doesNotMatch(
		VERDICT_SOURCE,
		/export const PULL_REQUEST_REVIEW_VERDICTS/u,
		"move the verdict option list to data/, do not re-colocate it",
	);
	assert.equal(
		(VERDICT_SOURCE.match(/^export /gmu) ?? []).length,
		1,
		"the verdict control module must have exactly one export (the component)",
	);
	assert.match(VERDICT_SOURCE, /^export function PullRequestReviewVerdictControl/mu);
	assert.match(VERDICT_DATA_SOURCE, /export const PULL_REQUEST_REVIEW_VERDICTS/u);
	assert.match(
		INDEX_SOURCE,
		/export \{ PULL_REQUEST_REVIEW_VERDICTS \} from "@\/components\/blocks\/pull-request-review\/data\/pull-request-review-verdicts"/u,
	);
});

test("the verdict control uses token classes and honors reduced motion", () => {
	assert.match(VERDICT_SOURCE, /bg-bg-accent-gray-subtlest/u);
	assert.match(VERDICT_SOURCE, /bg-surface text-text shadow-sm/u);
	assert.match(VERDICT_SOURCE, /duration-normal ease-out-practical motion-reduce:transition-none/u);
	// VPK components must not reach for raw ADS custom properties.
	assert.doesNotMatch(VERDICT_SOURCE, /\[var\(--ds-/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /\[var\(--ds-/u);
});

test("the expanded card entrance is reduced-motion safe", () => {
	assert.match(
		COMPONENT_SOURCE,
		/animate-in fade-in-0 duration-medium ease-out motion-reduce:animate-none/u,
	);
});

test("the expanded Review heading uses the 16px ADS small heading token", () => {
	assert.match(
		COMPONENT_SOURCE,
		/<h2 className="text-text" style=\{\{ font: token\("font\.heading\.small"\) \}\}>/u,
	);
	assert.doesNotMatch(
		COMPONENT_SOURCE,
		/font\.heading\.medium/u,
		"Review title must stay at heading.small (16px), not heading.medium (20px)",
	);
});

test("the reviewed badge only renders when both counts are supplied", () => {
	assert.match(
		COMPONENT_SOURCE,
		/const hasReviewedProgress =\s*reviewedCount !== undefined && reviewedTotal !== undefined;/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/hasReviewedProgress \? \(\s*<Badge variant="neutral">\{`\$\{reviewedCount\}\/\$\{reviewedTotal\} Reviewed`\}<\/Badge>/u,
	);
	// Ternary, never `&&` — `0/0` progress must not leak a stray `0` into the row.
	assert.doesNotMatch(COMPONENT_SOURCE, /hasReviewedProgress &&/u);
});

test("the comment badge pluralizes and hides at zero", () => {
	assert.match(
		COMPONENT_SOURCE,
		/const hasCommentCount = commentCount !== undefined && commentCount > 0;/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/`\$\{commentCount\} \$\{commentCount === 1 \? "Comment" : "Comments"\}`/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/hasCommentCount \? \(\s*<Badge variant="neutral">\{commentBadgeLabel\}<\/Badge>\s*\) : null/u,
	);
	assert.doesNotMatch(COMPONENT_SOURCE, /hasCommentCount &&/u);
});

test("focus expansion yields to a controlled variant", () => {
	assert.match(
		COMPONENT_SOURCE,
		/expandOnFocus && controlledVariant === undefined/u,
		"a host owning `variant` must not have it overwritten by composer focus",
	);
	assert.match(COMPONENT_SOURCE, /const variant = controlledVariant \?\? uncontrolledVariant;/u);
	assert.match(COMPONENT_SOURCE, /const value = controlledValue \?\? uncontrolledValue;/u);
	assert.match(COMPONENT_SOURCE, /const verdict = controlledVerdict \?\? uncontrolledVerdict;/u);
});

test("the dismiss control collapses the card and notifies the host", () => {
	assert.match(COMPONENT_SOURCE, /function close\(\) \{[\s\S]*updateVariant\("compact"\);\s*onClose\?\.\(\);/u);
	assert.match(COMPONENT_SOURCE, /aria-label="Close review"/u);
	// The dismiss gesture also discards the pending selection so the next
	// expansion starts clean.
	assert.match(
		COMPONENT_SOURCE,
		/function close\(\) \{[\s\S]*updateVerdict\(defaultVerdict\);[\s\S]*updateVariant\("compact"\);/u,
	);
});

test("compact can never submit a verdict the user cannot see", () => {
	// The verdict control renders only when expanded. Resetting inside close()
	// alone is not enough: a host flipping the controlled `variant` (as the demo
	// page's Expanded/Compact toggle does) never calls close(), so a stale
	// `approve` / `request-changes` would still reach the payload. Derive the
	// effective verdict at render so every collapse path is covered.
	assert.match(
		COMPONENT_SOURCE,
		/const activeVerdict: PullRequestReviewVerdict = isExpanded\s*\? verdict\s*: "comment";/u,
		"the effective verdict must be derived from `isExpanded`, not just reset on dismiss",
	);
	// Gate on content; payload must still read the derived verdict, not the raw one.
	assert.match(
		COMPONENT_SOURCE,
		/const canSubmit = !submitDisabled && canSubmitReview\(value\);/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/onSubmit\?\.\(\{ body: value\.trim\(\), verdict: activeVerdict \}\)/u,
	);
	assert.doesNotMatch(
		COMPONENT_SOURCE,
		/onSubmit\?\.\(\{ body: value\.trim\(\), verdict \}\)/u,
		"submitting the raw verdict reopens the hidden-verdict hole",
	);
	// Effect-free derivation: syncing this through useEffect would violate
	// `.agents/rules/gotchas-react.md` and still render one stale frame.
	assert.doesNotMatch(COMPONENT_SOURCE, /useEffect/u);
});

test("demo data seeds the fully-reviewed state from the design", () => {
	assert.match(DATA_SOURCE, /reviewedCount: 3/u);
	assert.match(DATA_SOURCE, /reviewedTotal: 3/u);
	assert.match(DATA_SOURCE, /placeholder: "Leave a comment\.\.\."/u);
});

test("the block is registered across every discovery surface", () => {
	assert.match(INDEX_SOURCE, /export \{ PullRequestReview \}/u);
	assert.match(INDEX_SOURCE, /export \{ DEMO_PULL_REQUEST_REVIEW \}/u);
	assert.match(PAGE_SOURCE, /export default function PullRequestReviewPage/u);
	assert.match(DEMO_SOURCE, /import Page from "@\/components\/blocks\/pull-request-review\/page"/u);
	assert.match(
		COMPONENTS_SOURCE,
		/blockComponent\("pull-request-review", "Pull Request Review"\)/u,
	);
	assert.match(
		COMPONENT_MANIFEST_SOURCE,
		/blockComponent\("pull-request-review", "Pull Request Review"\)/u,
	);
	assert.match(BLOCK_DETAILS_SOURCE, /"pull-request-review": PULL_REQUEST_REVIEW_DETAIL/u);
	assert.match(REGISTRY_SOURCE, /"pull-request-review": dynamic\(/u);
});
