const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

const DIR = __dirname;
const COMPONENT_SOURCE = fs.readFileSync(path.join(DIR, "components", "pull-request.tsx"), "utf8");
const TYPES_SOURCE = fs.readFileSync(path.join(DIR, "components", "pull-request-types.ts"), "utf8");
const DATA_SOURCE = fs.readFileSync(path.join(DIR, "data", "demo-pull-requests.ts"), "utf8");
const PAGE_SOURCE = fs.readFileSync(path.join(DIR, "page.tsx"), "utf8");
const INDEX_SOURCE = fs.readFileSync(path.join(DIR, "index.ts"), "utf8");
const DEMO_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components", "website", "demos", "blocks", "pull-request-demo.tsx"),
	"utf8",
);
const COMPONENTS_SOURCE = fs.readFileSync(path.join(process.cwd(), "app", "data", "components.ts"), "utf8");
const COMPONENT_MANIFEST_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "app", "data", "component-manifest.ts"),
	"utf8",
);
const NAV_ADS_SOURCE = fs.readFileSync(path.join(process.cwd(), "app", "data", "nav-ads.ts"), "utf8");
const BLOCK_DETAILS_SOURCE = readDetailCategorySource("blocks");
const REGISTRY_SOURCE = readWebsiteRegistrySource();

test("PullRequest exposes the dropdown, spacious, and flyout card props contract", () => {
	assert.match(TYPES_SOURCE, /export type PullRequestStatus = "Open" \| "Merged"/u);
	assert.match(TYPES_SOURCE, /export type PullRequestVariant = "dropdown" \| "spacious" \| "flyout"/u);
	assert.doesNotMatch(TYPES_SOURCE, /"compact"/u);
	assert.match(
		TYPES_SOURCE,
		/export interface PullRequestAuthor \{[\s\S]*name: string;[\s\S]*avatarUrl\?: string;/u,
	);
	assert.match(
		TYPES_SOURCE,
		/export interface PullRequestProps \{[\s\S]*variant\?: PullRequestVariant;[\s\S]*number: number;[\s\S]*title: string;[\s\S]*status: PullRequestStatus;[\s\S]*author\?: PullRequestAuthor;[\s\S]*branch\?: string;[\s\S]*targetBranch\?: string;[\s\S]*additions: number;[\s\S]*deletions: number;[\s\S]*filesChanged\?: number;[\s\S]*timestampMs\?: number;[\s\S]*relativeTime\?: string;[\s\S]*selected\?: boolean;[\s\S]*onActivate\?: \(\) => void;/u,
	);
});

test("PullRequest card reuses Avatar, Lozenge, BrandLogoMark, and ArrowRight", () => {
	assert.match(COMPONENT_SOURCE, /from "@\/components\/ui\/avatar"/u);
	assert.match(COMPONENT_SOURCE, /from "@\/components\/ui\/lozenge"/u);
	assert.match(COMPONENT_SOURCE, /from "@\/components\/ui\/logo-mark"/u);
	assert.match(COMPONENT_SOURCE, /from "@atlaskit\/icon\/core\/arrow-right"/u);
	assert.match(
		COMPONENT_SOURCE,
		/BrandLogoMark[\s\S]*name="github"/u,
	);
	assert.doesNotMatch(COMPONENT_SOURCE, /dark:\[&_svg\]:invert/u);
	// Dropdown keeps the 24px avatar by default; flyout/spacious opt down to 16px.
	assert.match(COMPONENT_SOURCE, /function PullRequestAuthorAvatar\([\s\S]*size = "sm",/u);
	assert.match(COMPONENT_SOURCE, /text-text-success">\+\{additions\}/u);
	assert.match(COMPONENT_SOURCE, /text-text-danger">-\{deletions\}/u);
	assert.match(
		COMPONENT_SOURCE,
		/aria-label=\{`\$\{additions\} additions, \$\{deletions\} deletions`\}[\s\S]*role="group"/u,
	);
	assert.match(COMPONENT_SOURCE, /function PullRequestBranchPath/u);
	assert.match(
		COMPONENT_SOURCE,
		/aria-label=\{[\s\S]*branch && targetBranch[\s\S]*className="inline-flex min-w-0 shrink items-center gap-1 overflow-hidden text-xs leading-5"\s*role="group"/u,
	);
	assert.match(COMPONENT_SOURCE, /ArrowRightIcon/u);
	assert.match(
		COMPONENT_SOURCE,
		/flex min-w-0 flex-nowrap items-center gap-1\.5 overflow-hidden/u,
	);
	// Source/head is the flexible truncating part; target/base never truncates.
	assert.match(
		COMPONENT_SOURCE,
		/function BranchName[\s\S]*min-w-0 truncate(?: text-text)?/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/targetBranch \? \(\s*<span className="shrink-0 text-text">\{targetBranch\}<\/span>/u,
	);
	assert.doesNotMatch(
		COMPONENT_SOURCE,
		/targetBranch \? \(\s*<span className="truncate text-text">\{targetBranch\}<\/span>/u,
	);
	assert.match(COMPONENT_SOURCE, /shrink-0 text-text-subtlest">#\{number\}/u);
	assert.match(COMPONENT_SOURCE, /case "Open":[\s\S]*return "success"/u);
	assert.match(COMPONENT_SOURCE, /case "Merged":[\s\S]*return "discovery"/u);
	assert.match(COMPONENT_SOURCE, /const _exhaustive: never = status/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /RelativeTime|from "@\/components\/ui\/elapsed-time"|BranchIcon|IconTile/u);
});

test("PullRequest GitHub mark does not add an inline line-box wrapper", () => {
	const githubMark = COMPONENT_SOURCE.slice(
		COMPONENT_SOURCE.indexOf("function PullRequestGitHubMark"),
		COMPONENT_SOURCE.indexOf("function PullRequestInlineTitle"),
	);

	assert.match(
		githubMark,
		/return <BrandLogoMark frame="chip" label="GitHub" name="github" \/>;/u,
	);
	assert.doesNotMatch(githubMark, /<span className="shrink-0">/u);
});

test("PullRequest selection styling works for read-only and interactive cards", () => {
	assert.match(
		COMPONENT_SOURCE,
		/if \(onActivate\) \{[\s\S]*<button[\s\S]*aria-pressed=\{selected\}[\s\S]*onClick=\{onActivate\}[\s\S]*type="button"/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/const activeSelected = selected;[\s\S]*activeSelected && !isFlyout\s*\?\s*"border-border-selected bg-bg-selected text-text-selected"\s*:\s*null,[\s\S]*onActivate && activeSelected && !isFlyout\s*\?\s*"hover:bg-bg-selected-hovered"/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/<div[\s\S]*aria-current=\{selected \? "true" : undefined\}[\s\S]*data-pull-request=\{number\}[\s\S]*data-selected=\{selected \? "true" : undefined\}[\s\S]*role="group"/u,
	);
	// Trailing inset is half the leading one so the status lozenge clears the
	// top and right borders by the same 7px.
	assert.match(COMPONENT_SOURCE, /border border-border py-1\.5 ps-3 pe-1\.5/u);
	assert.match(COMPONENT_SOURCE, /items-center gap-2 rounded-lg/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /bg-\[#|text-\[#|purple-500|Open preview modal/u);
});

test("PullRequest spacious variant renders the three-row dropdown card", () => {
	assert.match(COMPONENT_SOURCE, /variant = "dropdown"/u);
	assert.match(COMPONENT_SOURCE, /const isSpacious = variant === "spacious"/u);
	assert.match(
		COMPONENT_SOURCE,
		/isSpacious\s*\?\s*"flex-col items-stretch gap-2 rounded-xl border border-border p-3"/u,
	);
	assert.match(COMPONENT_SOURCE, /function PullRequestSpaciousBody/u);
	assert.match(COMPONENT_SOURCE, /from "@atlaskit\/icon\/core\/pull-request"/u);
	assert.match(COMPONENT_SOURCE, /<PullRequestStatusLozenge status=\{status\} withIcon \/>/u);
	assert.match(
		COMPONENT_SOURCE,
		/function PullRequestSpaciousBody[\s\S]*<PullRequestInlineTitle[\s\S]*className="flex-1 font-medium"/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/function PullRequestSpaciousBody[\s\S]*<PullRequestGitHubMark \/>[\s\S]*<PullRequestBranchPath branch=\{branch\} targetBranch=\{targetBranch\} \/>/u,
	);
	assert.doesNotMatch(COMPONENT_SOURCE, /function PullRequestCompactBody|variant = "compact"/u);
});

/**
 * Figma 3173:2888 moved the status out of the leading slot: row one is the
 * wrapping `#N` + title with the lozenge trailing, right-aligned. Slice the
 * body so a greedy match cannot satisfy the order by wandering into the flyout
 * body, which has always trailed its lozenge.
 */
test("PullRequest spacious row one leads with the title and trails the status", () => {
	const spaciousBody = COMPONENT_SOURCE.slice(
		COMPONENT_SOURCE.indexOf("function PullRequestSpaciousBody"),
		COMPONENT_SOURCE.indexOf("function PullRequestFlyoutBody"),
	);

	assert.ok(spaciousBody.length > 0, "spacious body not found before the flyout body");
	assert.ok(
		spaciousBody.indexOf("<PullRequestInlineTitle")
			< spaciousBody.indexOf("<PullRequestStatusLozenge"),
		"spacious row one must render the title before the status lozenge",
	);
	// `flex-1` on the title is the only thing pushing the lozenge to the edge.
	assert.match(spaciousBody, /<PullRequestInlineTitle\s*className="flex-1 font-medium"/u);
});

test("PullRequest spacious title and branch metadata share a zero-gap group", () => {
	const spaciousBody = COMPONENT_SOURCE.slice(
		COMPONENT_SOURCE.indexOf("function PullRequestSpaciousBody"),
		COMPONENT_SOURCE.indexOf("function PullRequestFlyoutBody"),
	);

	assert.match(
		spaciousBody,
		/<div className="flex min-w-0 flex-col gap-0">[\s\S]*?<div className="flex min-w-0 items-start gap-2">[\s\S]*?<\/div>\s*<div className="flex min-w-0 flex-nowrap items-center gap-1\.5 overflow-hidden">[\s\S]*?<\/div>\s*<\/div>\s*<div className="flex min-w-0 items-center gap-2">/u,
	);
});

test("PullRequest flyout and spacious titles wrap as one inline text run", () => {
	assert.match(
		COMPONENT_SOURCE,
		/function PullRequestDropdownBody[\s\S]*min-w-0 truncate text-text[\s\S]*function PullRequestSpaciousBody/u,
	);
	assert.match(COMPONENT_SOURCE, /function PullRequestInlineTitle/u);
	assert.match(
		COMPONENT_SOURCE,
		/<span className="text-text-subtlest">#\{number\} <\/span>\s*<span className="text-text">\{title\}<\/span>/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/function PullRequestSpaciousBody[\s\S]*<PullRequestInlineTitle[\s\S]*function PullRequestFlyoutBody/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/function PullRequestFlyoutBody[\s\S]*<PullRequestInlineTitle number=\{number\} title=\{title\} \/>/u,
	);
	assert.doesNotMatch(
		COMPONENT_SOURCE,
		/function PullRequestFlyoutBody[\s\S]*shrink-0 text-text-subtlest">#\{number\}/u,
	);
	assert.doesNotMatch(
		COMPONENT_SOURCE,
		/function PullRequestSpaciousBody[\s\S]*min-w-0 truncate text-text/u,
	);
	assert.doesNotMatch(
		COMPONENT_SOURCE,
		/function PullRequestFlyoutBody[\s\S]*min-w-0 truncate text-text/u,
	);
});

test("PullRequest flyout variant matches the overlay summary card", () => {
	assert.match(COMPONENT_SOURCE, /variant = "dropdown"/u);
	assert.match(COMPONENT_SOURCE, /const isFlyout = variant === "flyout"/u);
	assert.match(
		COMPONENT_SOURCE,
		/isFlyout\s*\?\s*"flex-col items-stretch gap-3 rounded-lg bg-surface-raised pt-3 shadow-2xl"/u,
	);
	assert.match(COMPONENT_SOURCE, /data-variant=\{variant\}/u);
	assert.match(COMPONENT_SOURCE, /function PullRequestDropdownBody/u);
	assert.match(COMPONENT_SOURCE, /function PullRequestFlyoutBody/u);
	assert.match(COMPONENT_SOURCE, /function PullRequestStatusLozenge/u);
	assert.match(COMPONENT_SOURCE, /function PullRequestGitHubMark/u);
	// No card prints the repo: the GitHub mark and `#N` already say where the
	// change lives, so the pill and its `repository` prop are both gone.
	assert.doesNotMatch(COMPONENT_SOURCE, /PullRequestRepositoryTag|repository/u);
	assert.doesNotMatch(TYPES_SOURCE, /repository/u);
	assert.match(
		COMPONENT_SOURCE,
		/function PullRequestDropdownBody[\s\S]*text-sm font-medium leading-5[\s\S]*function PullRequestFlyoutBody/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/function PullRequestFlyoutBody[\s\S]*<PullRequestInlineTitle number=\{number\} title=\{title\} \/>/u,
	);
	assert.doesNotMatch(
		COMPONENT_SOURCE,
		/function PullRequestFlyoutBody[\s\S]*font-medium/u,
	);
	assert.match(COMPONENT_SOURCE, /PullRequestAuthorAvatar author=\{author\} size="xs"/u);
	assert.match(
		COMPONENT_SOURCE,
		/<span className="min-w-0 truncate">\{author\.name\}<\/span>/u,
	);
	assert.match(COMPONENT_SOURCE, /relativeTime \? \(\s*<>\s*<span className="shrink-0">·<\/span>/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /Created by \{author\.name\}/u);
	assert.match(
		COMPONENT_SOURCE,
		/function PullRequestFlyoutBody[\s\S]*<PullRequestGitHubMark \/>[\s\S]*<PullRequestBranchPath branch=\{branch\} targetBranch=\{targetBranch\} \/>/u,
	);
	assert.doesNotMatch(
		COMPONENT_SOURCE,
		/function PullRequestFlyoutBody[\s\S]*<PullRequestMetaLeadingIcon \/>[\s\S]*<PullRequestGitHubMark \/>/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/\{filesChanged\} \{filesChanged === 1 \? "file" : "files"\}/u,
	);
	assert.match(COMPONENT_SOURCE, /border-t border-border-disabled/u);
	// File icon leads the files/diff row, not the GitHub branch row.
	assert.match(COMPONENT_SOURCE, /from "@atlaskit\/icon\/core\/file"/u);
	assert.match(COMPONENT_SOURCE, /function PullRequestMetaLeadingIcon/u);
	assert.match(
		COMPONENT_SOURCE,
		/grid size-4 shrink-0 place-items-center text-icon-subtlest/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/function PullRequestFlyoutBody[\s\S]*<PullRequestMetaLeadingIcon \/>[\s\S]*\{filesChanged\} \{filesChanged === 1 \? "file" : "files"\}/u,
	);
	assert.doesNotMatch(
		COMPONENT_SOURCE,
		/function PullRequestFlyoutBody[\s\S]*flex h-5 min-w-0 flex-nowrap items-center gap-1\.5 overflow-hidden/u,
	);
});

test("Pull Request demos include source → target branch paths", () => {
	assert.match(DATA_SOURCE, /targetBranch: "main"/u);
	assert.match(DATA_SOURCE, /branch: "rovo\/rfp-103-response-validation"/u);
	assert.match(DATA_SOURCE, /filesChanged: 6/u);
	assert.match(DATA_SOURCE, /relativeTime: "1h"/u);
	assert.match(DATA_SOURCE, /relativeTime: "Yesterday"/u);
	assert.doesNotMatch(DATA_SOURCE, /relativeTime: "yesterday"/u);
	assert.doesNotMatch(DATA_SOURCE, /number:\s*902/u);
});

test("Pull Request demo page offers compact, spacious, and flyout variant toggles", () => {
	assert.match(PAGE_SOURCE, /useState<PullRequestVariant>\(\s*lockedVariant \?\? "dropdown",\s*\)/u);
	assert.match(PAGE_SOURCE, /<ToggleGroupItem value="dropdown">Dropdown compact<\/ToggleGroupItem>/u);
	assert.match(PAGE_SOURCE, /<ToggleGroupItem value="spacious">Dropdown spacious<\/ToggleGroupItem>/u);
	assert.match(PAGE_SOURCE, /<ToggleGroupItem value="flyout">Flyout<\/ToggleGroupItem>/u);
	assert.match(PAGE_SOURCE, /variant=\{variant\}/u);
	assert.match(PAGE_SOURCE, /w-\[344px\]/u);
	assert.match(INDEX_SOURCE, /PullRequestVariant/u);
	assert.doesNotMatch(PAGE_SOURCE, /value="compact"/u);
});

test("Pull Request demo page centers the card list in the preview shell", () => {
	assert.match(
		PAGE_SOURCE,
		/flex h-full min-h-\[360px\] w-full items-center justify-center/u,
	);
	assert.match(PAGE_SOURCE, /flex w-full max-w-xl flex-col gap-3/u);
});

test("Pull Request block is registered in the website catalog", () => {
	assert.match(INDEX_SOURCE, /export \{ PullRequest \}/u);
	assert.match(INDEX_SOURCE, /DEMO_PULL_REQUESTS/u);
	assert.match(PAGE_SOURCE, /DEMO_PULL_REQUESTS\.map/u);
	assert.match(DATA_SOURCE, /export const DEMO_PULL_REQUESTS/u);
	assert.match(DEMO_SOURCE, /from "@\/components\/blocks\/pull-request\/page"/u);
	assert.match(DEMO_SOURCE, /export function PullRequestDemoDropdown/u);
	assert.match(DEMO_SOURCE, /export function PullRequestDemoSpacious/u);
	assert.match(DEMO_SOURCE, /export function PullRequestDemoFlyout/u);
	assert.match(COMPONENTS_SOURCE, /blockComponent\("pull-request", "Pull Request"\)/u);
	assert.match(COMPONENT_MANIFEST_SOURCE, /blockComponent\("pull-request", "Pull Request"\)/u);
	assert.match(NAV_ADS_SOURCE, /"pull-request"/u);
	assert.match(BLOCK_DETAILS_SOURCE, /PULL_REQUEST_DETAIL|"pull-request": PULL_REQUEST_DETAIL/u);
	assert.match(BLOCK_DETAILS_SOURCE, /"dropdown" \| "spacious" \| "flyout"/u);
	assert.match(BLOCK_DETAILS_SOURCE, /pull-request-demo-dropdown/u);
	assert.match(BLOCK_DETAILS_SOURCE, /pull-request-demo-spacious/u);
	assert.match(BLOCK_DETAILS_SOURCE, /pull-request-demo-flyout/u);
	assert.match(REGISTRY_SOURCE, /"pull-request": dynamic\(/u);
	assert.match(REGISTRY_SOURCE, /"pull-request-demo-dropdown"/u);
	assert.match(REGISTRY_SOURCE, /"pull-request-demo-spacious"/u);
	assert.match(REGISTRY_SOURCE, /"pull-request-demo-flyout"/u);
});
