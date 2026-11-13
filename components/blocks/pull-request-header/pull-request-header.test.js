const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

const DIR = __dirname;
const COMPONENT_SOURCE = fs.readFileSync(
	path.join(DIR, "components", "pull-request-header.tsx"),
	"utf8",
);
const VARIANT_SOURCE = fs.readFileSync(
	path.join(DIR, "components", "pull-request-header-variant.ts"),
	"utf8",
);
const TYPES_SOURCE = fs.readFileSync(
	path.join(DIR, "components", "pull-request-header-types.ts"),
	"utf8",
);
const DATA_SOURCE = fs.readFileSync(
	path.join(DIR, "data", "demo-pull-request-header.ts"),
	"utf8",
);
const PAGE_SOURCE = fs.readFileSync(path.join(DIR, "page.tsx"), "utf8");
const INDEX_SOURCE = fs.readFileSync(path.join(DIR, "index.ts"), "utf8");
const DEMO_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components", "website", "demos", "blocks", "pull-request-header-demo.tsx"),
	"utf8",
);
const COMPONENTS_SOURCE = fs.readFileSync(path.join(process.cwd(), "app", "data", "components.ts"), "utf8");
const COMPONENT_MANIFEST_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "app", "data", "component-manifest.ts"),
	"utf8",
);
const BLOCK_DETAILS_SOURCE = readDetailCategorySource("blocks");
const REGISTRY_SOURCE = readWebsiteRegistrySource();

test("PullRequestHeader exposes the detail header props contract", () => {
	assert.match(TYPES_SOURCE, /export type PullRequestHeaderStatus = "Open" \| "Merged"/u);
	assert.match(
		TYPES_SOURCE,
		/export type PullRequestHeaderVariant = "expanded" \| "compact"/u,
	);
	assert.match(
		TYPES_SOURCE,
		/export type PullRequestHeaderMergeState =[\s\S]*"checks-failed"[\s\S]*"checks-running"[\s\S]*"merge-conflicts"[\s\S]*"review-required"[\s\S]*"ready"/u,
	);
	assert.match(TYPES_SOURCE, /variant\?: PullRequestHeaderVariant/u);
	assert.match(
		TYPES_SOURCE,
		/scrollContainerRef\?: RefObject<HTMLElement \| null>/u,
	);
	assert.match(TYPES_SOURCE, /collapseOffset\?: number/u);
	assert.match(TYPES_SOURCE, /tabNavigation\?: ReactNode/u);
	assert.match(TYPES_SOURCE, /mergeState\?: PullRequestHeaderMergeState/u);
	assert.match(TYPES_SOURCE, /autoMerge\?: boolean/u);
	assert.match(TYPES_SOURCE, /defaultAutoMerge\?: boolean/u);
	assert.match(TYPES_SOURCE, /onAutoMergeChange\?: \(enabled: boolean\) => void/u);
	assert.doesNotMatch(TYPES_SOURCE, /onChatClick/u);
	assert.match(TYPES_SOURCE, /onMergeClick\?: \(\) => void/u);
	assert.match(TYPES_SOURCE, /onChecksFailedClick\?: \(\) => void/u);
	assert.match(TYPES_SOURCE, /onChecksRunningClick\?: \(\) => void/u);
	assert.match(TYPES_SOURCE, /onMergeConflictsClick\?: \(\) => void/u);
	assert.match(TYPES_SOURCE, /onReviewRequiredClick\?: \(\) => void/u);
	assert.match(
		TYPES_SOURCE,
		/export interface PullRequestHeaderSubmitReviewAction[\s\S]*ariaLabel: string;[\s\S]*badge\?: string;[\s\S]*disabled\?: boolean;[\s\S]*label: string;[\s\S]*onClick: \(\) => void;/u,
	);
	assert.match(TYPES_SOURCE, /submitReviewAction\?: PullRequestHeaderSubmitReviewAction/u);
	assert.match(TYPES_SOURCE, /url\?: string/u);
	assert.match(TYPES_SOURCE, /scmProviderName\?: string/u);
	assert.match(TYPES_SOURCE, /onConvertToDraftClick\?: \(\) => void/u);
	assert.match(TYPES_SOURCE, /onClosePullRequestClick\?: \(\) => void/u);
	assert.doesNotMatch(TYPES_SOURCE, /onMoreActionsClick/u);
	assert.match(
		TYPES_SOURCE,
		/export interface PullRequestHeaderProps[\s\S]*number: number;[\s\S]*title: string;[\s\S]*status: PullRequestHeaderStatus;[\s\S]*baseBranch\?: string \| null;[\s\S]*headBranch\?: string \| null;[\s\S]*repository: string;/u,
	);
	assert.doesNotMatch(TYPES_SOURCE, /authorName/u);
	assert.doesNotMatch(TYPES_SOURCE, /additions/u);
	assert.doesNotMatch(TYPES_SOURCE, /updatedTime/u);
});

test("PullRequestHeader resolves controlled and scroll-driven variants", () => {
	assert.match(VARIANT_SOURCE, /export function resolveVariant/u);
	assert.match(VARIANT_SOURCE, /const DEFAULT_COLLAPSE_OFFSET = 16/u);
	assert.match(
		VARIANT_SOURCE,
		/if \(variant\) \{[\s\S]*return variant;[\s\S]*scrollTop[\s\S]*>= collapseOffset[\s\S]*\? "compact"[\s\S]*: "expanded"/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/from "@\/components\/blocks\/pull-request-header\/components\/pull-request-header-variant"/u,
	);
	assert.match(COMPONENT_SOURCE, /useSyncExternalStore/u);
	assert.match(COMPONENT_SOURCE, /addEventListener\("scroll"/u);
	assert.match(
		COMPONENT_SOURCE,
		/const getResolvedVariant = useCallback\([\s\S]*resolveVariant\(\{[\s\S]*collapseOffset,[\s\S]*const resolvedVariant = useSyncExternalStore\([\s\S]*getResolvedVariant/u,
	);
	assert.doesNotMatch(COMPONENT_SOURCE, /const getScrollTop|useSyncExternalStore\([\s\S]*getScrollTop/u);
});

test("PullRequestHeader animates meta collapse and honors reduced motion", () => {
	assert.match(
		COMPONENT_SOURCE,
		/import \{ AnimatePresence, motion, useReducedMotion \} from "motion\/react"/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/<motion\.header[\s\S]*layout=\{shouldReduceMotion \? false : true\}[\s\S]*<motion\.div[\s\S]*layout=\{shouldReduceMotion \? false : "position"\}/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/<motion\.div[\s\S]*className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"[\s\S]*layout=\{shouldReduceMotion \? false : "position"\}[\s\S]*transition=\{\{ layout: LAYOUT_TRANSITION \}\}/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/key="pull-request-header-meta"[\s\S]*className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs text-text-subtle"[\s\S]*layout=\{shouldReduceMotion \? false : "position"\}[\s\S]*transition=\{\{ layout: LAYOUT_TRANSITION \}\}/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/<AnimatePresence initial=\{false\} mode="popLayout">/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/animate=\{\{ opacity: 1, transform: "translateY\(0px\)" \}\}/u,
	);
	assert.match(COMPONENT_SOURCE, /exit=\{\{[\s\S]*opacity: 0,[\s\S]*transform: "translateY\(-4px\)"/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /height:\s*(?:0|"auto")/u);
	assert.match(COMPONENT_SOURCE, /const shouldReduceMotion = useReducedMotion\(\) \?\? false/u);
	assert.match(COMPONENT_SOURCE, /duration: 0\.2,[\s\S]*ease: \[0, 0\.4, 0, 1\]/u);
	assert.match(COMPONENT_SOURCE, /duration: 0\.1,[\s\S]*ease: \[0\.6, 0, 0\.8, 0\.6\]/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /var\(--(?:duration|ease)-/u);
});

test("PullRequestHeader uses a two-row title and meta layout with action group", () => {
	assert.match(
		COMPONENT_SOURCE,
		/tabNavigation[\s\S]*\? "pt-4"[\s\S]*: "border-b pb-4"/u,
	);
	assert.match(COMPONENT_SOURCE, /from "@\/components\/ui\/button"/u);
	assert.match(COMPONENT_SOURCE, /from "@\/components\/ui\/button-group"/u);
	assert.match(COMPONENT_SOURCE, /from "@\/components\/ui\/spinner"/u);
	assert.match(
		COMPONENT_SOURCE,
		/function mergeStateLeadingIcon[\s\S]*case "checks-failed":[\s\S]*grid size-4 shrink-0 place-items-center text-icon-danger[\s\S]*<StatusErrorIcon[\s\S]*case "checks-running":[\s\S]*grid size-4 shrink-0 place-items-center[\s\S]*<Spinner size="xs" \/>[\s\S]*case "merge-conflicts":[\s\S]*grid size-4 shrink-0 place-items-center text-icon-danger[\s\S]*<MergeFailureIcon[\s\S]*case "review-required":[\s\S]*grid size-4 shrink-0 place-items-center text-icon-information[\s\S]*<StatusInformationIcon[\s\S]*case "ready":[\s\S]*grid size-4 shrink-0 place-items-center text-icon-success[\s\S]*<StatusSuccessIcon/u,
	);
	assert.match(COMPONENT_SOURCE, /\{mergeStateLeadingIcon\(mergeState\)\}/u);
	assert.match(COMPONENT_SOURCE, /variant="separated"/u);
	assert.match(COMPONENT_SOURCE, /variant="split"/u);
	assert.match(
		COMPONENT_SOURCE,
		/<ButtonGroup[\s\S]*variant="separated"[\s\S]*<ButtonGroup variant="split">[\s\S]*mergeStateLabel[\s\S]*aria-label="Merge options"[\s\S]*Auto merge[\s\S]*<\/ButtonGroup>[\s\S]*canMutatePullRequest && submitReviewAction \? \([\s\S]*\{submitReviewAction\.label\}[\s\S]*\) : null[\s\S]*<ButtonGroup>[\s\S]*aria-label="More actions"/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/canMutatePullRequest && submitReviewAction \? \([\s\S]*aria-label=\{submitReviewAction\.ariaLabel\}[\s\S]*disabled=\{submitReviewAction\.disabled\}[\s\S]*onClick=\{submitReviewAction\.onClick\}[\s\S]*variant="outline"[\s\S]*\{submitReviewAction\.label\}[\s\S]*submitReviewAction\.badge \? \([\s\S]*<Badge[\s\S]*\{submitReviewAction\.badge\}/u,
	);
	assert.match(COMPONENT_SOURCE, /from "@\/components\/ui\/badge"/u);
	assert.match(COMPONENT_SOURCE, /from "@\/components\/ui\/dropdown-menu"/u);
	assert.match(COMPONENT_SOURCE, /from "@\/components\/ui\/switch"/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /from "@\/components\/ui\/toggle"/u);
	assert.match(COMPONENT_SOURCE, /from "@\/components\/ui\/lozenge"/u);
	assert.match(COMPONENT_SOURCE, /from "@\/components\/ui\/tag"/u);
	assert.match(COMPONENT_SOURCE, /from "@\/components\/ui\/logo-mark"/u);
	assert.match(
		COMPONENT_SOURCE,
		/BrandLogoMark[\s\S]*name="github"/u,
	);
	assert.doesNotMatch(COMPONENT_SOURCE, /from "@atlaskit\/icon\/core\/comment"/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /aria-label="Chat"/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /onChatClick/u);
	assert.match(COMPONENT_SOURCE, /from "@atlaskit\/icon\/core\/chevron-down"/u);
	assert.match(COMPONENT_SOURCE, /from "@atlaskit\/icon\/core\/copy"/u);
	assert.match(COMPONENT_SOURCE, /from "@atlaskit\/icon\/core\/merge-failure"/u);
	assert.match(COMPONENT_SOURCE, /from "@atlaskit\/icon\/core\/merge-success"/u);
	assert.match(COMPONENT_SOURCE, /from "@atlaskit\/icon\/core\/pull-request"/u);
	assert.match(COMPONENT_SOURCE, /from "@atlaskit\/icon\/core\/show-more-horizontal"/u);
	assert.match(COMPONENT_SOURCE, /from "@atlaskit\/icon\/core\/status-error"/u);
	assert.match(COMPONENT_SOURCE, /from "@atlaskit\/icon\/core\/status-information"/u);
	assert.match(COMPONENT_SOURCE, /from "@atlaskit\/icon\/core\/status-success"/u);
	assert.match(COMPONENT_SOURCE, /from "@atlaskit\/icon\/core\/undo"/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /from "@atlaskit\/icon\/core\/check-circle"/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /from "@atlaskit\/icon\/core\/link-external"/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /from "@atlaskit\/icon\/core\/file"/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /from "@atlaskit\/icon\/core\/cross"/u);
	assert.match(
		COMPONENT_SOURCE,
		/inline-flex shrink-0 items-center gap-1[\s\S]*resolvedVariant === "compact" \? \([\s\S]*<CompactPullRequestStatusIcon status=\{status\} \/>[\s\S]*\) : null[\s\S]*#\{number\}/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/case "Open":[\s\S]*text-icon-success[\s\S]*<PullRequestIcon[\s\S]*case "Merged":[\s\S]*text-icon-accent-purple[\s\S]*<MergeSuccessIcon/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/className="w-full flex-wrap gap-2 sm:w-auto sm:shrink-0"/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/disabled=\{!primaryEnabled\}/u,
	);
	assert.match(COMPONENT_SOURCE, /function isMergePrimaryEnabled/u);
	assert.match(COMPONENT_SOURCE, /handlePrimaryClick/u);
	assert.match(COMPONENT_SOURCE, /case "checks-failed":[\s\S]*onChecksFailedClick/u);
	assert.match(COMPONENT_SOURCE, /case "checks-running":[\s\S]*onChecksRunningClick/u);
	assert.match(COMPONENT_SOURCE, /case "merge-conflicts":[\s\S]*onMergeConflictsClick/u);
	assert.match(COMPONENT_SOURCE, /case "review-required":[\s\S]*onReviewRequiredClick/u);
	assert.match(COMPONENT_SOURCE, /<ChevronDownIcon label="" size="small" \/>/u);
	assert.match(COMPONENT_SOURCE, /<ShowMoreHorizontalIcon label="" size="small" \/>/u);
	assert.match(COMPONENT_SOURCE, /aria-label="Merge options"/u);
	assert.match(COMPONENT_SOURCE, /aria-label="More actions"/u);
	assert.match(COMPONENT_SOURCE, /label="Auto merge"/u);
	assert.match(COMPONENT_SOURCE, /Auto merge/u);
	assert.match(
		COMPONENT_SOURCE,
		/label="Auto merge"[\s\S]*tabIndex=\{-1\}/u,
	);
	assert.match(COMPONENT_SOURCE, /closeOnClick=\{false\}/u);
	assert.match(COMPONENT_SOURCE, /handleMergeMethodChange/u);
	assert.match(COMPONENT_SOURCE, /handleAutoMergeChange/u);
	assert.match(COMPONENT_SOURCE, /DEFAULT_MERGE_METHOD: PullRequestHeaderMergeMethod = "squash"/u);
	assert.match(COMPONENT_SOURCE, /DEFAULT_AUTO_MERGE = true/u);
	assert.match(COMPONENT_SOURCE, /case "checks-failed":[\s\S]*return "Checks failed"/u);
	assert.match(COMPONENT_SOURCE, /case "checks-running":[\s\S]*return "Checks running"/u);
	assert.match(COMPONENT_SOURCE, /case "merge-conflicts":[\s\S]*return "Merge conflicts"/u);
	assert.match(COMPONENT_SOURCE, /case "review-required":[\s\S]*return "Require approval"/u);
	assert.match(
		COMPONENT_SOURCE,
		/function mergeMethodLabel[\s\S]*case "squash":[\s\S]*return "Squash and merge"[\s\S]*case "merge":[\s\S]*return "Create a merge commit"[\s\S]*case "rebase":[\s\S]*return "Rebase and merge"/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/case "ready":[\s\S]*return "Merge"/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/MERGE_METHOD_VALUES\.map\([\s\S]*DropdownMenuItem[\s\S]*selected=\{value === selectedMergeMethod\}[\s\S]*mergeMethodLabel/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/resolvedVariant === "compact" \? "text-sm" : "text-base"/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/transition-\[font-size\] duration-medium ease-in-out motion-reduce:transition-none/u,
	);
	assert.match(COMPONENT_SOURCE, /case "Open":[\s\S]*return "success"/u);
	assert.match(COMPONENT_SOURCE, /case "Merged":[\s\S]*return "discovery"/u);
	assert.match(COMPONENT_SOURCE, /const _exhaustive: never = status/u);
	assert.match(COMPONENT_SOURCE, /sm:items-center sm:justify-between/u);
	assert.match(
		COMPONENT_SOURCE,
		/className="flex min-w-0 flex-nowrap items-center gap-x-2 gap-y-1 sm:flex-1"[\s\S]*className=\{cn\([\s\S]*"min-w-0 flex-1 truncate font-medium text-text"/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/function BranchName[\s\S]*lastIndexOf\("\/"\)[\s\S]*text-text-subtlest/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/<span className="min-w-0 truncate">[\s\S]*<BranchName name=\{branchPair\.headBranch\} \/>[\s\S]*shrink-0 px-1 text-text-subtle[\s\S]*→[\s\S]*<span className="shrink-0">[\s\S]*<BranchName name=\{branchPair\.baseBranch\} \/>/u,
	);
	assert.doesNotMatch(
		COMPONENT_SOURCE,
		/<span className="min-w-0 truncate">\s*<BranchName name=\{branchPair\.headBranch\} \/>\s*<span aria-hidden className="px-1 text-text-subtle">/u,
	);
	assert.match(COMPONENT_SOURCE, /function resolveScmProviderName/u);
	assert.match(
		COMPONENT_SOURCE,
		/const openInScmLabel = `Open in \$\{resolvedScmProviderName\}`/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/Copy link[\s\S]*canMutatePullRequest \? \([\s\S]*DropdownMenuSeparator[\s\S]*Convert to draft[\s\S]*Close pull request[\s\S]*\) : null/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/elemBefore=\{<CopyIcon label="" size="small" \/>\}[\s\S]*Copy link/u,
	);
	assert.match(COMPONENT_SOURCE, /function ScmProviderMark/u);
	assert.match(COMPONENT_SOURCE, /AtlassianLogoMark[\s\S]*name="bitbucket"/u);
	assert.match(COMPONENT_SOURCE, /BrandLogoMark[\s\S]*name="gitlab"/u);
	assert.match(
		COMPONENT_SOURCE,
		/BrandLogoMark[\s\S]*name="github"/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/elemBefore=\{<ScmProviderMark name=\{resolvedScmProviderName\} \/>\}[\s\S]*\{openInScmLabel\}/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/text-icon-subtle[\s\S]*<PullRequestIcon[\s\S]*Convert to draft/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/text-icon-danger[\s\S]*<MergeFailureIcon[\s\S]*variant="destructive"[\s\S]*Close pull request/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/navigator\.clipboard\.writeText\(url\)|copyPullRequestUrl/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/window\.open\(url, "_blank", "noopener,noreferrer"\)/u,
	);
	assert.match(COMPONENT_SOURCE, /disabled=\{!hasPullRequestUrl\}/u);
	assert.match(COMPONENT_SOURCE, /const canMutatePullRequest = status === "Open"/u);
	assert.match(
		COMPONENT_SOURCE,
		/disabled=\{!onConvertToDraftClick\}/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/disabled=\{!onClosePullRequestClick\}/u,
	);
	assert.doesNotMatch(COMPONENT_SOURCE, /onMoreActionsClick/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /from "@\/components\/ui\/avatar"/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /GithubLogo/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /additions/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /Updated \{updatedTime\}/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /data-jira-work-item-pull-request-detail-header/u);
});

test("PullRequestHeader owns optional bottom-edge tab navigation", () => {
	assert.match(
		COMPONENT_SOURCE,
		/className=\{tabNavigation \? "px-4" : undefined\}[\s\S]*\{tabNavigation \? \([\s\S]*className=\{cn\([\s\S]*"relative z-10 -mb-px mt-4 shrink-0[\s\S]*\{tabNavigation\}/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/resolvedVariant === "compact"[\s\S]*\? "px-\[clamp\(1rem,calc\(30%-4rem\),16rem\)\]"[\s\S]*: "px-\[clamp\(1rem,calc\(20%-4rem\),11rem\)\]"/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/transition-\[padding-left,padding-right\] duration-medium ease-in-out motion-reduce:transition-none/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/overflow-x-auto overscroll-x-contain/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/\[&_\[data-slot=tabs-list\]\]:border-b-0/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/-mb-px[\s\S]*\[&_\[data-slot=tabs-trigger\]\]:after:bottom-0/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/"relative z-10 -mb-px mt-4 shrink-0/u,
	);
	assert.doesNotMatch(
		COMPONENT_SOURCE,
		/tabNavigation[\s\S]*\? "overflow-hidden pt-4"/u,
	);
	assert.doesNotMatch(
		COMPONENT_SOURCE,
		/borderBottomLeftRadius:\s*6|borderBottomRightRadius:\s*6/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/style=\{style\}/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/tabNavigation \? \([\s\S]*layout=\{shouldReduceMotion \? false : "position"\}[\s\S]*transition=\{\{ layout: LAYOUT_TRANSITION \}\}/u,
	);
});

test("PullRequestHeader replaces merge controls with Revert PR when merged", () => {
	assert.match(COMPONENT_SOURCE, /const canMutatePullRequest = status === "Open"/u);
	assert.match(
		COMPONENT_SOURCE,
		/\{canMutatePullRequest \? \([\s\S]*<ButtonGroup variant="split">[\s\S]*mergeStateLabel\(mergeState\)[\s\S]*aria-label="Merge options"[\s\S]*\) : \([\s\S]*aria-label="Revert pull request"[\s\S]*<UndoIcon[\s\S]*Revert PR[\s\S]*\)\}/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/canMutatePullRequest && submitReviewAction \? \(/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/canMutatePullRequest \? \([\s\S]*Convert to draft[\s\S]*Close pull request[\s\S]*\) : null/u,
	);
});

test("resolveScmProviderName maps common hosts", () => {
	assert.match(
		COMPONENT_SOURCE,
		/host\.includes\("bitbucket\."\)[\s\S]*return "Bitbucket"/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/host\.includes\("gitlab\."\)[\s\S]*return "GitLab"/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/host\.includes\("github\."\)[\s\S]*return "GitHub"/u,
	);
	assert.match(COMPONENT_SOURCE, /return "source control"/u);
});

test("Pull Request Header demo shows controlled and scroll-driven modes", () => {
	assert.match(DATA_SOURCE, /number: 1847/u);
	assert.match(DATA_SOURCE, /baseBranch: "main"/u);
	assert.match(DATA_SOURCE, /headBranch: "feature\/guest-checkout"/u);
	assert.match(DATA_SOURCE, /mergeState: "ready"/u);
	assert.match(DATA_SOURCE, /defaultAutoMerge: true/u);
	assert.match(
		DATA_SOURCE,
		/url: "https:\/\/github\.com\/acme\/storefront\/pull\/1847"/u,
	);
	assert.match(DATA_SOURCE, /scmProviderName: "GitHub"/u);
	assert.doesNotMatch(DATA_SOURCE, /authorName/u);
	assert.doesNotMatch(DATA_SOURCE, /additions/u);
	assert.doesNotMatch(DATA_SOURCE, /updatedTime/u);
	assert.match(
		PAGE_SOURCE,
		/h-full min-h-\[360px\] w-full overflow-y-auto/u,
	);
	assert.match(PAGE_SOURCE, /DEMO_PULL_REQUEST_HEADER/u);
	assert.match(
		PAGE_SOURCE,
		/import \{ Tabs, TabsList, TabsTrigger \} from "@\/components\/ui\/tabs"/u,
	);
	assert.match(
		PAGE_SOURCE,
		/function DemoPullRequestHeader[\s\S]*<Tabs defaultValue="details">[\s\S]*tabNavigation=\{<DemoPullRequestTabs \/>\}/u,
	);
	assert.match(
		PAGE_SOURCE,
		/Overview[\s\S]*Guide[\s\S]*4 Files[\s\S]*text-text-success[\s\S]*\+86[\s\S]*text-text-danger[\s\S]*-21/u,
	);
	assert.match(PAGE_SOURCE, />Merge</u);
	assert.match(PAGE_SOURCE, /value=\{\[variant\]\}/u);
	assert.match(PAGE_SOURCE, /mergeState="ready"/u);
	assert.match(PAGE_SOURCE, /mergeState="checks-running"/u);
	assert.match(PAGE_SOURCE, /onChecksRunningClick=\{\(\) => undefined\}/u);
	assert.match(PAGE_SOURCE, /onConvertToDraftClick=\{\(\) => undefined\}/u);
	assert.match(PAGE_SOURCE, /onClosePullRequestClick=\{\(\) => undefined\}/u);
	assert.doesNotMatch(PAGE_SOURCE, /onMoreActionsClick/u);
	assert.match(PAGE_SOURCE, /mergeState="merge-conflicts"/u);
	assert.match(PAGE_SOURCE, /onMergeConflictsClick=\{\(\) => undefined\}/u);
	assert.match(PAGE_SOURCE, /Checks running/u);
	assert.match(PAGE_SOURCE, /Merge conflicts/u);
	assert.doesNotMatch(PAGE_SOURCE, /Merge button label/u);
	assert.doesNotMatch(PAGE_SOURCE, /Pull request merge state/u);
	assert.doesNotMatch(PAGE_SOURCE, /mergeState=\{mergeState\}/u);
	assert.match(PAGE_SOURCE, /Scroll-driven variant/u);
	assert.match(PAGE_SOURCE, /scrollContainerRef=\{scrollContainerRef\}/u);
});

test("Pull Request Header block is registered in the website catalog", () => {
	assert.match(INDEX_SOURCE, /export \{ PullRequestHeader \}/u);
	assert.match(INDEX_SOURCE, /PullRequestHeaderMergeState/u);
	assert.match(INDEX_SOURCE, /PullRequestHeaderSubmitReviewAction/u);
	assert.match(INDEX_SOURCE, /DEMO_PULL_REQUEST_HEADER/u);
	assert.match(DEMO_SOURCE, /from "@\/components\/blocks\/pull-request-header\/page"/u);
	assert.match(
		COMPONENTS_SOURCE,
		/blockComponent\("pull-request-header", "Pull Request Header"\)/u,
	);
	assert.match(
		COMPONENT_MANIFEST_SOURCE,
		/blockComponent\("pull-request-header", "Pull Request Header"\)/u,
	);
	assert.match(
		BLOCK_DETAILS_SOURCE,
		/PULL_REQUEST_HEADER_DETAIL|"pull-request-header": PULL_REQUEST_HEADER_DETAIL/u,
	);
	assert.match(BLOCK_DETAILS_SOURCE, /scrollContainerRef/u);
	assert.match(BLOCK_DETAILS_SOURCE, /collapseOffset/u);
	assert.match(BLOCK_DETAILS_SOURCE, /mergeState/u);
	assert.match(BLOCK_DETAILS_SOURCE, /defaultAutoMerge/u);
	assert.match(BLOCK_DETAILS_SOURCE, /onChecksRunningClick/u);
	assert.match(BLOCK_DETAILS_SOURCE, /url/u);
	assert.match(BLOCK_DETAILS_SOURCE, /scmProviderName/u);
	assert.match(BLOCK_DETAILS_SOURCE, /onConvertToDraftClick/u);
	assert.match(BLOCK_DETAILS_SOURCE, /onClosePullRequestClick/u);
	assert.match(BLOCK_DETAILS_SOURCE, /Open in \{SCM\}|Open in \{name\}/u);
	assert.doesNotMatch(BLOCK_DETAILS_SOURCE, /onMoreActionsClick/u);
	assert.doesNotMatch(BLOCK_DETAILS_SOURCE, /authorName/u);
	assert.match(REGISTRY_SOURCE, /"pull-request-header": dynamic\(/u);
});
