const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

const DIR = __dirname;
const COMPONENT_SOURCE = fs.readFileSync(path.join(DIR, "components", "smart-link.tsx"), "utf8");
const TYPES_SOURCE = fs.readFileSync(path.join(DIR, "components", "smart-link-types.ts"), "utf8");
const VISUALS_SOURCE = fs.readFileSync(path.join(DIR, "components", "smart-link-visuals.tsx"), "utf8");
const DATA_SOURCE = fs.readFileSync(path.join(DIR, "data", "demo-smart-links.tsx"), "utf8");
const PULL_REQUEST_HELPER_SOURCE = fs.readFileSync(path.join(DIR, "lib", "pull-request-smart-link.tsx"), "utf8");
const GITHUB_ARTIFACT_ICONS_SOURCE = fs.readFileSync(path.join(DIR, "lib", "github-artifact-icons.tsx"), "utf8");
const DEMO_SOURCE = fs.readFileSync(path.join(process.cwd(), "components", "website", "demos", "blocks", "smart-link-demo.tsx"), "utf8");
const PAGE_SOURCE = fs.readFileSync(path.join(DIR, "page.tsx"), "utf8");
const INDEX_SOURCE = fs.readFileSync(path.join(DIR, "index.ts"), "utf8");
const COMPONENTS_SOURCE = fs.readFileSync(path.join(process.cwd(), "app", "data", "components.ts"), "utf8");
const COMPONENT_MANIFEST_SOURCE = fs.readFileSync(path.join(process.cwd(), "app", "data", "component-manifest.ts"), "utf8");
const NAV_ADS_SOURCE = fs.readFileSync(path.join(process.cwd(), "app", "data", "nav-ads.ts"), "utf8");
const BLOCK_DETAILS_SOURCE = readDetailCategorySource("blocks");
const REGISTRY_SOURCE = readWebsiteRegistrySource();

test("SmartLink is powered by the shared ConeSafezone utility", () => {
	assert.match(COMPONENT_SOURCE, /ConeSafezone, ConeSafezoneContent, ConeSafezoneTrigger/u);
	assert.match(COMPONENT_SOURCE, /<ConeSafezone[\s\S]*openDelay=\{openDelay\}/u);
	assert.match(COMPONENT_SOURCE, /<ConeSafezoneTrigger[\s\S]*render=\{[\s\S]*<SmartLinkTrigger/u);
	assert.match(COMPONENT_SOURCE, /<ConeSafezoneContent[\s\S]*alignOffset=\{alignOffset\}[\s\S]*positionerClassName=\{positionerClassName\}[\s\S]*<SmartLinkCard/u);
	assert.match(COMPONENT_SOURCE, /aria-describedby=\{open \? `smart-link-card-\$\{item\.id\}` : undefined\}/u);
});

test("SmartLink keeps existing inline consumers as external-link anchors", () => {
	assert.match(COMPONENT_SOURCE, /if \(onActivate\) \{[\s\S]*<button[\s\S]*type="button"[\s\S]*return \([\s\S]*<a[\s\S]*href=\{item\.href\}/u);
	assert.match(COMPONENT_SOURCE, /<SmartLinkCard[\s\S]*appearance="flyout"/u);
	assert.match(COMPONENT_SOURCE, /<a[\s\S]*href=\{item\.href\}[\s\S]*id=\{titleId\}/u);
});

test("SmartLink selectable mode uses a pressed button and closes its preview on activation", () => {
	assert.match(TYPES_SOURCE, /onActivate\?: \(item: SmartLinkItem\) => void;/u);
	assert.match(TYPES_SOURCE, /selected\?: boolean;/u);
	assert.match(COMPONENT_SOURCE, /<button[\s\S]*aria-pressed=\{selected\}[\s\S]*type="button"/u);
	assert.match(COMPONENT_SOURCE, /onActivate &&[\s\S]*selected &&[\s\S]*border-border-selected bg-bg-selected text-text-selected hover:bg-bg-selected-hovered active:bg-bg-selected-pressed/u);
	assert.match(COMPONENT_SOURCE, /const handleActivate = \(\) => \{[\s\S]*handleOpenChange\(false\);[\s\S]*onActivate\?\.\(item\);/u);
	assert.match(COMPONENT_SOURCE, /onActivate=\{onActivate \? handleActivate : undefined\}/u);
});

test("SmartLink supports a card appearance that expands any item into a block card", () => {
	assert.match(TYPES_SOURCE, /export type SmartLinkAppearance = "inline" \| "card"/u);
	assert.match(TYPES_SOURCE, /appearance\?: SmartLinkAppearance;/u);
	assert.match(
		COMPONENT_SOURCE,
		/if \(appearance === "card"\)[\s\S]*<SmartLinkCard[\s\S]*appearance="block"[\s\S]*onActivate=\{onActivate\}[\s\S]*selected=\{selected\}/u,
	);
	assert.match(TYPES_SOURCE, /appearance\?: "block" \| "flyout"/u);
	assert.match(TYPES_SOURCE, /onActivate\?: \(item: SmartLinkItem\) => void;/u);
	assert.match(
		COMPONENT_SOURCE,
		/onActivate \? \([\s\S]*<button[\s\S]*aria-pressed=\{selected\}[\s\S]*onClick=\{\(\) => onActivate\(item\)\}[\s\S]*type="button"[\s\S]*: \([\s\S]*<a className=\{titleClassName\} href=\{item\.href\}/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/onActivate &&[\s\S]*selected &&[\s\S]*"border-border-selected bg-bg-selected text-text-selected"/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/isFlyout \? "bg-surface-overlay shadow-2xl" : "border border-border"/u,
	);
	assert.match(COMPONENT_SOURCE, /SmartLinkFooterActions/u);
	assert.match(COMPONENT_SOURCE, /function SmartLinkEngagementRow/u);
	assert.match(COMPONENT_SOURCE, /Created by \{item\.author\.name\}/u);
	assert.match(INDEX_SOURCE, /SmartLinkAppearance/u);
	assert.match(DEMO_SOURCE, /export function SmartLinkDemoCard\(\)/u);
	assert.match(DEMO_SOURCE, /appearance="card"/u);
	assert.match(
		DEMO_SOURCE,
		/export function SmartLinkDemoCard\(\)[\s\S]*appearance="card"[\s\S]*items=\{SMART_LINK_DEMO_ITEMS\}/u,
	);
	assert.match(PAGE_SOURCE, /appearance="card"/u);
	assert.match(PAGE_SOURCE, /items = SMART_LINK_DEMO_ITEMS/u);
});

test("SmartLink card footer shows at most two action buttons and overflows the rest", () => {
	assert.match(COMPONENT_SOURCE, /const FOOTER_VISIBLE_ACTION_COUNT = 2;/u);
	assert.match(COMPONENT_SOURCE, /actions\.slice\(0, FOOTER_VISIBLE_ACTION_COUNT\)/u);
	assert.match(COMPONENT_SOURCE, /actions\.slice\(FOOTER_VISIBLE_ACTION_COUNT\)/u);
	assert.match(COMPONENT_SOURCE, /overflowActions\.length > 0 \?[\s\S]*<DropdownMenu>[\s\S]*aria-label="More actions"/u);
	assert.match(COMPONENT_SOURCE, /ShowMoreHorizontalIcon/u);
	assert.match(COMPONENT_SOURCE, /action\.id !== "copy-link"/u);
	assert.match(DATA_SOURCE, /id: "laptop-refresh"[\s\S]*Summarize with Rovo[\s\S]*View related links/u);
	assert.match(DATA_SOURCE, /id: "project-slingshot"[\s\S]*Summarize with AI/u);
});

test("SmartLink exports the public component and type API", () => {
	for (const source of [PAGE_SOURCE, INDEX_SOURCE]) {
		assert.match(source, /SmartLinkCard/u);
		assert.match(source, /SmartLinkAction/u);
		assert.match(source, /SmartLinkItem/u);
		assert.match(source, /SmartLinkProps/u);
		assert.match(source, /SmartLinkVariant/u);
	}
});

test("demo data covers every required production variant", () => {
	for (const variant of ["confluence", "jira", "team", "goal", "project", "loom", "article", "file", "generic"]) {
		assert.match(DATA_SOURCE, new RegExp(`variant: "${variant}"`, "u"));
	}

	// Pull-request demos are built via the shared mapper (variant lives on the helper).
	assert.match(DATA_SOURCE, /toPullRequestSmartLink/u);
	assert.match(DATA_SOURCE, /variant === "pull-request"/u);
	assert.match(DATA_SOURCE, /"pull-request"/u);
	assert.match(PULL_REQUEST_HELPER_SOURCE, /variant: "pull-request"/u);
	assert.match(DATA_SOURCE, /SMART_LINK_VARIANT_EXAMPLES/u);
	assert.match(DATA_SOURCE, /Existing-assets-only/u);
});

test("catalog details and registry expose smart-link demos", () => {
	assert.match(COMPONENTS_SOURCE, /blockComponent\("smart-link", "Smart Link"\)/u);
	assert.match(COMPONENT_MANIFEST_SOURCE, /blockComponent\("smart-link", "Smart Link"\)/u);
	assert.match(NAV_ADS_SOURCE, /"smart-link"/u);
	assert.match(BLOCK_DETAILS_SOURCE, /"smart-link": \{/u);
	assert.match(BLOCK_DETAILS_SOURCE, /smart-link-demo-rich/u);
	assert.match(BLOCK_DETAILS_SOURCE, /smart-link-demo-article/u);
	assert.match(BLOCK_DETAILS_SOURCE, /smart-link-demo-team/u);
	assert.match(BLOCK_DETAILS_SOURCE, /smart-link-demo-goal/u);
	assert.match(BLOCK_DETAILS_SOURCE, /smart-link-demo-project/u);
	assert.match(BLOCK_DETAILS_SOURCE, /smart-link-demo-loom/u);
	assert.match(BLOCK_DETAILS_SOURCE, /smart-link-demo-generic/u);
	assert.match(BLOCK_DETAILS_SOURCE, /smart-link-demo-pull-request/u);
	assert.match(BLOCK_DETAILS_SOURCE, /smart-link-demo-card/u);
	assert.match(BLOCK_DETAILS_SOURCE, /smart-link-demo-removable-overlay/u);
	assert.match(REGISTRY_SOURCE, /"smart-link": dynamic\(\(\) => import\("\.\/demos\/blocks\/smart-link-demo"\)/u);
	assert.match(REGISTRY_SOURCE, /"smart-link-demo-pull-request"[\s\S]*SmartLinkDemoPullRequest/u);
	assert.match(REGISTRY_SOURCE, /"smart-link-demo-card"[\s\S]*SmartLinkDemoCard/u);
	assert.match(REGISTRY_SOURCE, /"smart-link-demo-removable-overlay"[\s\S]*SmartLinkDemoRemovableOverlay/u);

	for (const exportName of [
		"SmartLinkDemoRich",
		"SmartLinkDemoArticle",
		"SmartLinkDemoTeam",
		"SmartLinkDemoGoal",
		"SmartLinkDemoProject",
		"SmartLinkDemoLoom",
		"SmartLinkDemoGeneric",
		"SmartLinkDemoPullRequest",
		"SmartLinkDemoCard",
		"SmartLinkDemoRemovableOverlay",
	]) {
		assert.match(REGISTRY_SOURCE, new RegExp(exportName, "u"));
	}
});

test("SmartLink owns the pull-request variant with code stats in the flyout", () => {
	assert.match(TYPES_SOURCE, /\| "pull-request"/u);
	assert.match(TYPES_SOURCE, /codeStats\?: \{[\s\S]*additions: number;[\s\S]*deletions: number;/u);
	assert.match(TYPES_SOURCE, /codeStats\?: \{\s*files\?: number;/u);
	assert.match(COMPONENT_SOURCE, /function SmartLinkCodeStatsRow/u);
	assert.match(COMPONENT_SOURCE, /text-text-success[\s\S]*\+\{codeStats\.additions\}/u);
	assert.match(COMPONENT_SOURCE, /text-text-danger[\s\S]*-\{codeStats\.deletions\}/u);
	assert.match(
		COMPONENT_SOURCE,
		/item\.variant === "pull-request"[\s\S]*\? isFlyout[\s\S]*\? "w-\[320px\] max-w-\[calc\(100vw-48px\)\]"[\s\S]*: "w-\[25rem\] max-w-full"/u,
	);
	assert.match(INDEX_SOURCE, /toPullRequestSmartLink/u);
	assert.match(DEMO_SOURCE, /export function SmartLinkDemoPullRequest\(\)/u);
});

test("pull-request code stats sit in their own row under the description", () => {
	// `N files` pluralizes, and each stat group carries its own glyph.
	assert.match(COMPONENT_SOURCE, /function codeStatsFileLabel\(files: number\) \{[\s\S]*files === 1 \? "file" : "files"/u);
	assert.match(COMPONENT_SOURCE, /import FilesIcon from "@atlaskit\/icon\/core\/files";/u);
	assert.match(COMPONENT_SOURCE, /import AngleBracketsIcon from "@atlaskit\/icon\/core\/angle-brackets";/u);
	assert.match(COMPONENT_SOURCE, /<FilesIcon label="" size="small" \/>/u);
	assert.match(COMPONENT_SOURCE, /<AngleBracketsIcon label="" size="small" \/>/u);
	// The row renders between the description and the engagement row.
	assert.match(
		COMPONENT_SOURCE,
		/line-clamp-3 text-sm leading-5 text-text[\s\S]*?<SmartLinkCodeStatsRow item=\{item\} \/>\s*<SmartLinkEngagementRow item=\{item\} \/>/u,
	);
	// The row is the only renderer, and the footer no longer competes with it.
	assert.equal((COMPONENT_SOURCE.match(/<SmartLinkCodeStatsRow/gu) ?? []).length, 1);
	assert.doesNotMatch(COMPONENT_SOURCE, /showActionButtons && !codeStats/u);
	// `aria-label` is prohibited on the implicit `generic` role, so without an
	// explicit `role` assistive tech drops the label and reads "+86 -21" bare.
	assert.match(COMPONENT_SOURCE, /aria-label=\{`\$\{codeStats\.additions\} additions, \$\{codeStats\.deletions\} deletions`\}[\s\S]*?role="img"/u);
	assert.match(COMPONENT_SOURCE, /aria-label=\{`\$\{fileLabel\} changed`\}[\s\S]*?role="img"/u);
	// The +/- counts read as one pair, so they sit tighter (2px) than the icon gap.
	assert.match(
		COMPONENT_SOURCE,
		/<span className="inline-flex items-center gap-0\.5">\s*<span className="text-text-success">/u,
	);
});

test("pull-request cards keep their footer free of action buttons", () => {
	// Actions stay in the flyout rather than repeating as a block-card button.
	assert.match(COMPONENT_SOURCE, /showActionButtons && item\.variant !== "pull-request"/u);
});

test("the pull-request metadata row is a single-line branch context strip", () => {
	assert.match(TYPES_SOURCE, /export interface SmartLinkBranchPath \{\s*branch\?: string;\s*targetBranch\?: string;/u);
	assert.match(TYPES_SOURCE, /branchPath\?: SmartLinkBranchPath;/u);
	// The repo is not part of the card model: the provider mark and `#N` already
	// say where the change lives, so the tag was dropped along with the field.
	assert.doesNotMatch(TYPES_SOURCE, /repository\?: string;/u);
	assert.match(COMPONENT_SOURCE, /import ArrowRightIcon from "@atlaskit\/icon\/core\/arrow-right";/u);
	assert.match(COMPONENT_SOURCE, /function SmartLinkBranchPathLabel/u);
	// Source branch truncates behind a subtle `prefix/`; the target stays whole.
	assert.match(COMPONENT_SOURCE, /function SmartLinkBranchName[\s\S]*?name\.slice\(0, slashIndex \+ 1\)[\s\S]*?name\.slice\(slashIndex \+ 1\)/u);
	assert.match(COMPONENT_SOURCE, /\{targetBranch \? <span className="shrink-0 text-text">\{targetBranch\}<\/span> : null\}/u);
	assert.match(COMPONENT_SOURCE, /aria-label=\{branch && targetBranch \? `\$\{branch\} into \$\{targetBranch\}`/u);
	assert.match(COMPONENT_SOURCE, /<SmartLinkBranchPathLabel branchPath=\{branchPath\} \/>/u);
	assert.match(PULL_REQUEST_HELPER_SOURCE, /branchPath:\s*input\.branch \|\| input\.targetBranch/u);
	// `repository` survives only as href input, never as a rendered field.
	assert.doesNotMatch(PULL_REQUEST_HELPER_SOURCE, /repository: input\.repository,/u);
	assert.match(PULL_REQUEST_HELPER_SOURCE, /https:\/\/github\.com\/\$\{input\.repository\}\/pull\/\$\{input\.number\}/u);
	assert.match(DATA_SOURCE, /branch: "feature\/shop-4821-guest-checkout"/u);
	assert.match(DATA_SOURCE, /targetBranch: "main"/u);

	// Avatar + branch path share one line; the branch truncates to fit.
	assert.match(COMPONENT_SOURCE, /isBranchContext \? "flex-nowrap overflow-hidden" : "flex-wrap"/u);
	// The author's name gives up its space — the avatar's `label` still names them.
	assert.match(
		COMPONENT_SOURCE,
		/\{isBranchContext \? null : <span className="truncate">Created by \{item\.author\.name\}<\/span>\}/u,
	);
	assert.match(COMPONENT_SOURCE, /\{item\.author && item\.date && !isBranchContext \? <span aria-hidden>·<\/span> : null\}/u);
	// No repo tag on the row, and no Tag import left behind to render one.
	assert.doesNotMatch(COMPONENT_SOURCE, /item\.repository/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /from "@\/components\/ui\/tag"/u);
});

test("the pull-request status lozenge trails the title like every other card", () => {
	// One title row for every variant: visual, title, then the trailing status.
	assert.match(
		COMPONENT_SOURCE,
		/<span className="inline-flex shrink-0 items-center">\{renderVisual\(item\.icon, "card", statusIconTone\(item\.variant, item\.status\)\)\}<\/span>[\s\S]*?\{item\.status \? \(\s*<span className="shrink-0">\s*<SmartLinkStatusDropdown selection=\{activeStatusSelection\} status=\{item\.status\} \/>/u,
	);
	// The leading-placement split and its lozenge glyph are gone with it.
	assert.doesNotMatch(TYPES_SOURCE, /placement\?: "leading" \| "trailing";/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /leadingStatus|trailingStatus|statusPlacement/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /elemBefore=\{status\.icon/u);
	// Deprecated Lozenge `icon` prop must not creep back in either.
	assert.doesNotMatch(COMPONENT_SOURCE, /\n\t+icon=\{(?:status|metadata)\.icon/u);
});

test("the pull-request front slot is a status-tinted pull-request glyph", () => {
	// A transparent icon tile holding the status glyph replaces the GitHub logo;
	// Open, Merged, and Failed each get their Jira-issue chrome glyph.
	assert.match(PULL_REQUEST_HELPER_SOURCE, /import PullRequestIcon from "@atlaskit\/icon\/core\/pull-request";/u);
	assert.match(PULL_REQUEST_HELPER_SOURCE, /import MergeSuccessIcon from "@atlaskit\/icon\/core\/merge-success";/u);
	assert.match(PULL_REQUEST_HELPER_SOURCE, /import MergeFailureIcon from "@atlaskit\/icon\/core\/merge-failure";/u);
	assert.match(PULL_REQUEST_HELPER_SOURCE, /icon: \{ kind: "icon", icon: frontSlot\.icon \}/u);
	assert.match(PULL_REQUEST_HELPER_SOURCE, /label: "Open", variant: "success"/u);
	assert.match(PULL_REQUEST_HELPER_SOURCE, /label: "Merged", variant: "discovery"/u);
	assert.match(PULL_REQUEST_HELPER_SOURCE, /label: "Failed", variant: "danger"/u);
	assert.match(PULL_REQUEST_HELPER_SOURCE, /<PullRequestIcon label="" \/>/u);
	assert.match(PULL_REQUEST_HELPER_SOURCE, /<MergeSuccessIcon label="" \/>/u);
	assert.match(PULL_REQUEST_HELPER_SOURCE, /<MergeFailureIcon label="" \/>/u);
	// GitHub still identifies the provider for the footer and the repo tag.
	assert.match(PULL_REQUEST_HELPER_SOURCE, /provider: \{ name: "GitHub", logo: \{ kind: "third-party", name: "github" \} \}/u);
	// `kind: "icon"` routes through the transparent IconTile branch.
	assert.match(VISUALS_SOURCE, /if \(visual\.kind === "icon"\)[\s\S]*?variant="transparent"/u);
	// Goals and pull requests share one variant→tone map.
	assert.match(VISUALS_SOURCE, /const statusIconToneClasses: Record<NonNullable<LozengeProps\["variant"\]>, string>/u);
	assert.match(VISUALS_SOURCE, /variant !== "goal" && variant !== "pull-request"/u);
	assert.match(VISUALS_SOURCE, /success: "text-icon-success",/u);
	assert.match(COMPONENT_SOURCE, /\{renderVisual\(item\.icon, "trigger", iconTone\)\}/u);
	// The chip must not gate the PR glyph's tone on lozenge visibility — the
	// default `<SmartLink item={item} />` hides the lozenge but still shows state.
	assert.match(
		COMPONENT_SOURCE,
		/statusIconTone\(item\.variant, item\.variant === "goal" \? status : item\.status\)/u,
	);
	assert.match(GITHUB_ARTIFACT_ICONS_SOURCE, /import BranchIcon from "@atlaskit\/icon\/core\/branch"/u);
	assert.match(GITHUB_ARTIFACT_ICONS_SOURCE, /import CommitIcon from "@atlaskit\/icon\/core\/commit"/u);
	assert.match(INDEX_SOURCE, /GITHUB_BRANCH_SMART_LINK_ICON/u);
	assert.match(INDEX_SOURCE, /GITHUB_COMMIT_SMART_LINK_ICON/u);
});

test("the pull-request number prefixes the title", () => {
	assert.match(PULL_REQUEST_HELPER_SOURCE, /title: `#\$\{input\.number\}: \$\{input\.title\}`/u);
	// No metadata `suffix` affordance remains now the number lives in the title.
	assert.doesNotMatch(TYPES_SOURCE, /suffix\?: string;/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /metadata\.suffix/u);
});

test("SmartLink owns its removable overlay variant", () => {
	assert.match(TYPES_SOURCE, /onRemove\?: \(\) => void;[\s\S]*removeVariant\?: "overlay";[\s\S]*removeButtonLabel\?: string;/u);
	assert.match(COMPONENT_SOURCE, /group\/smart-link-remove/u);
	assert.match(COMPONENT_SOURCE, /data-smart-link-text/u);
	assert.match(COMPONENT_SOURCE, /data-slot="smart-link-remove-overlay-button"/u);
	assert.match(COMPONENT_SOURCE, /removable &&\s*!status &&\s*"group-hover\/smart-link-remove:\[mask-image:/u);
	assert.match(COMPONENT_SOURCE, /triggerStatusClasses\[size\],[\s\S]*group-hover\/smart-link-remove:\[mask-image:linear-gradient\(to_right,#000_calc\(100%-1\.5rem\),transparent_calc\(100%-1rem\)\)\]/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /group-hover\/smart-link-remove:opacity-0/u);
	assert.match(COMPONENT_SOURCE, /absolute end-0\.5 top-1\/2/u);
	assert.match(COMPONENT_SOURCE, /aria-label=\{removeButtonLabel \?\? `Remove \$\{item\.title\}`\}/u);
	assert.match(COMPONENT_SOURCE, /<CrossIcon label="" size="small" color="currentColor" \/>/u);
	assert.match(DEMO_SOURCE, /export function SmartLinkDemoRemovableOverlay\(\)[\s\S]*onRemove=\{\(\) => setItems[\s\S]*removeVariant="overlay"/u);
	assert.match(DEMO_SOURCE, /SmartLinkDemoRemovableOverlay\(\)[\s\S]*SMART_LINK_STATUS_EXAMPLES\[0\][\s\S]*removeVariant="overlay"[\s\S]*showStatus=\{item\.id === SMART_LINK_STATUS_EXAMPLES\[0\]\.id\}/u);
	// The inline chip stays bespoke — it owns the removable mask geometry, so it
	// must not be rebuilt on Tag. Elsewhere (the metadata row's repo pill) Tag is
	// the right primitive, so scope the guard to the trigger rather than the file.
	const triggerSource = COMPONENT_SOURCE.slice(
		COMPONENT_SOURCE.indexOf("function SmartLinkTrigger"),
		COMPONENT_SOURCE.indexOf("function SmartLinkAvatarStack"),
	);
	assert.ok(triggerSource.length > 0, "SmartLinkTrigger source slice resolved");
	assert.doesNotMatch(triggerSource, /<Tag[\s/>]/u);
});

test("SmartLink implementation uses semantic tokens instead of raw ds variable utilities", () => {
	for (const source of [COMPONENT_SOURCE, PAGE_SOURCE]) {
		assert.doesNotMatch(source, /(?:bg|text)-\[var\(--ds-/u);
	}
});

test("SmartLink visual rendering uses shared icon and logo primitives", () => {
	assert.match(VISUALS_SOURCE, /import \{ IconTile \} from "@\/components\/ui\/icon-tile";/u);
	assert.match(VISUALS_SOURCE, /import \{ AtlassianLogo, CustomLogo,[\s\S]*type LogoProps \} from "@\/components\/ui\/logo";/u);
	assert.match(VISUALS_SOURCE, /import \{ BrandLogoMark \} from "@\/components\/ui\/logo-mark";/u);
	assert.match(VISUALS_SOURCE, /<AtlassianLogo[\s\S]*withUsageBorder/u);
	assert.match(VISUALS_SOURCE, /<BrandLogoMark frame="chip" src=\{visual\.src\} label=\{visual\.alt\} \/>/u);
	assert.match(VISUALS_SOURCE, /<CustomLogo src=\{visual\.src\} label=\{visual\.alt\} size=\{logoSize\} \/>/u);
	assert.match(VISUALS_SOURCE, /if \(visual\.kind === "icon"\)[\s\S]*<IconTile[\s\S]*variant="transparent"/u);
	assert.match(VISUALS_SOURCE, /<IconTile[\s\S]*size=\{visualIconTileSizes\[size\]\}[\s\S]*variant=\{toneIconTileVariants\[visual\.tone \?\? "neutral"\]\}/u);
	assert.match(VISUALS_SOURCE, /size: iconSize/u);
	assert.doesNotMatch(VISUALS_SOURCE, /height=\{imageSize\}/u);
	assert.doesNotMatch(VISUALS_SOURCE, /width=\{imageSize\}/u);
	assert.match(COMPONENT_SOURCE, /className="flex min-w-0 items-center gap-2"/u);
	assert.match(COMPONENT_SOURCE, /<span className="inline-flex shrink-0 items-center">\{renderVisual\(item\.icon, "card", statusIconTone\(item\.variant, item\.status\)\)\}<\/span>/u);
});

test("the Jira work-item demo uses a blue work-item icon tile with rich card controls", () => {
	assert.match(DATA_SOURCE, /import WorkItemIcon from "@atlaskit\/icon\/core\/work-item";/u);
	assert.match(DATA_SOURCE, /id: "engineering-whiteboard"[\s\S]*icon: \{ kind: "icon-tile", icon: <WorkItemIcon label="" size="medium" \s*\/>, tone: "information" \}[\s\S]*assignee:[\s\S]*status:[\s\S]*priority:[\s\S]*actions: SMART_LINK_MODAL_ACTIONS/u);
});

test("SmartLink trigger icon tiles render as inline spans", () => {
	assert.match(VISUALS_SOURCE, /const iconTileElement = size === "trigger" \? "span" : "div";/u);
	assert.equal((VISUALS_SOURCE.match(/as=\{iconTileElement\}/gu) ?? []).length, 2);
});
