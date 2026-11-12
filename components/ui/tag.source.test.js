const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const TAG_DEMO_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components", "website", "demos", "ui", "tag-demo.tsx"),
	"utf8",
);

test("Tag front-slot demo uses shared logo treatment for 1P, 2P, and 3P marks", () => {
	const logoMarkSource = fs.readFileSync(
		path.join(process.cwd(), "components", "ui", "logo-mark.tsx"),
		"utf8",
	);

	assert.match(TAG_DEMO_SOURCE, /import \{ RovoColorIcon \} from "@\/components\/ui\/logo";/u);
	assert.match(TAG_DEMO_SOURCE, /import \{ IconTile \} from "@\/components\/ui\/icon-tile";/u);
	assert.match(TAG_DEMO_SOURCE, /import \{ AtlassianLogoMark, BrandLogoMark \} from "@\/components\/ui\/logo-mark";/u);
	assert.match(TAG_DEMO_SOURCE, /<IconTile[\s\S]*<Icon render=\{<TagIcon label="" size="small" \/>\} aria-hidden \/>[\s\S]*size="xxsmall"[\s\S]*variant="transparent"/u);
	// 1P brand logos route through the shared AtlassianLogoMark chip frame (same
	// inline-chip API as BrandLogoMark) rather than a hand-wrapped IconTile / bare logo.
	assert.match(TAG_DEMO_SOURCE, /<AtlassianLogoMark frame="chip" name="jira" label="Jira" \/>/u);
	assert.match(TAG_DEMO_SOURCE, /<AtlassianLogoMark frame="chip" name="atlassian" label="Atlassian" \/>/u);
	assert.match(TAG_DEMO_SOURCE, /<IconTile[\s\S]*<RovoColorIcon aria-hidden \/>[\s\S]*size="xxsmall"[\s\S]*variant="transparent"/u);
	assert.match(TAG_DEMO_SOURCE, /<BrandLogoMark frame="chip" src="\/2p\/appfire\.png" label="Appfire" \/>/u);
	assert.match(TAG_DEMO_SOURCE, /<BrandLogoMark frame="chip" name="google-drive" label="Google Drive" \/>/u);
	assert.match(logoMarkSource, /presentation\.hasBorder \? "size-3" : "size-4"/u);
	assert.doesNotMatch(TAG_DEMO_SOURCE, /from "next\/image"/u);
	assert.doesNotMatch(TAG_DEMO_SOURCE, /PublicLogoMark|ProductLogoMark|LogoSlot/u);
	assert.doesNotMatch(TAG_DEMO_SOURCE, /className="size-3 \[&_svg\]:size-3"/u);
});

test("Tag exposes ADS visual-uplift color tokens and trailing metrics", () => {
	const tagSource = fs.readFileSync(
		path.join(process.cwd(), "components", "ui", "tag.tsx"),
		"utf8",
	);

	assert.match(tagSource, /border: "border-border-accent-blue-subtle"/u);
	assert.match(tagSource, /icon: "text-icon-accent-blue group-hover\/tag:text-text-accent-blue/u);
	assert.match(tagSource, /metric: "bg-bg-accent-blue-subtler"/u);
	// Gray/standard front-slot icons stay icon-subtle (no hover/active accent swap).
	assert.match(tagSource, /border: "border-border-accent-gray-subtle"/u);
	assert.match(tagSource, /icon: "text-icon-subtle"/u);
	assert.doesNotMatch(
		tagSource,
		/icon: "text-icon-accent-gray group-hover\/tag:text-text-accent-gray group-active\/tag:text-text-accent-gray"/u,
	);
	// IconTile transparent's `text-icon` must inherit the front-slot tone (Backlog demo).
	assert.match(tagSource, /\[&_\[data-slot=icon-tile\]\]:text-inherit/u);
	assert.doesNotMatch(tagSource, /border-blue-500|border-red-500|border-neutral-500/u);
	assert.match(tagSource, /\[&>\[data-slot=icon\]>span\]:size-3! \[&>\[data-slot=icon\]_svg\]:size-3!/u);

	// Component keeps the escape-hatch trailing slot and also supports the
	// package-compatible `trailingMetric` prop.
	assert.match(tagSource, /elemAfter\?: React\.ReactNode;/u);
	assert.match(tagSource, /trailingMetric\?: TagTrailingMetric \| readonly TagTrailingMetric\[\];/u);
	assert.match(tagSource, /type TagTrailingMetric =/u);
	assert.match(tagSource, /data-slot="tag-trailing-metric"/u);
	assert.match(tagSource, /data-slot="tag-trailing-metrics"/u);
	// Inter-metric gap is 1px; any trailing metric/badge uses the same pe-px.
	assert.match(
		tagSource,
		/className="inline-flex shrink-0 items-center gap-px"[\s\S]*data-slot="tag-trailing-metrics"/u,
	);
	assert.match(
		tagSource,
		/: hasElemAfter\s*\n\s*\? "pe-px"/u,
	);
	assert.match(
		TAG_DEMO_SOURCE,
		/trailingMetric=\{\[[\s\S]*value: "1 Open"[\s\S]*color: "lime"[\s\S]*value: "1 Needs input"[\s\S]*color: "yellow"[\s\S]*value: "1 Draft"[\s\S]*color: "gray"[\s\S]*value: "1 Merged"[\s\S]*color: "purple"/u,
	);
	assert.match(tagSource, /const resolvedElemAfter = elemAfter \?\?/u);
	assert.match(tagSource, /hasElemAfter \? "gap-1" : "gap-0\.5"/u);
	assert.match(tagSource, /data-slot="tag-after-content"/u);
	assert.match(tagSource, /\{resolvedElemAfter \? \([\s\S]*shrink-0[\s\S]*\) : null\}/u);

	// Demo uses the current package-style metric prop instead of hand-built Badge
	// instances, including the red count example.
	assert.doesNotMatch(TAG_DEMO_SOURCE, /import \{ Badge \} from "@\/components\/ui\/badge";/u);
	assert.match(TAG_DEMO_SOURCE, /export function TagDemoBadge\(\)/u);
	assert.match(TAG_DEMO_SOURCE, /<Tag color="red" trailingMetric=\{5\} onRemove=\{\(\) => \{\}\}>/u);
});

test("Tag removable demo centers its removable tag in the preview surface", () => {
	assert.match(
		TAG_DEMO_SOURCE,
		/export function TagDemoRemovable\(\)[\s\S]*className="flex min-h-\[352px\] w-full items-center justify-center"/u,
	);
	assert.match(TAG_DEMO_SOURCE, /<Tag className="self-center" onRemove=\{\(\) => setVisible\(false\)\}>Removable<\/Tag>/u);
});

test("Tag click handlers expose a keyboard-operable button contract", () => {
	const tagSource = fs.readFileSync(
		path.join(process.cwd(), "components", "ui", "tag.tsx"),
		"utf8",
	);

	assert.match(tagSource, /role=\{isInteractive \? "button" : role\}/u);
	assert.match(tagSource, /tabIndex=\{isInteractive \? \(disabled \? -1 : 0\) : undefined\}/u);
	assert.match(tagSource, /event\.key === "Enter" \|\| event\.key === " "/u);
	assert.match(tagSource, /className,\s*style,\s*role,\s*onClick,/u);
});

test("Tag uses a rounded shell and remove control for every avatar type", () => {
	const tagSource = fs.readFileSync(
		path.join(process.cwd(), "components", "ui", "tag.tsx"),
		"utf8",
	);

	assert.match(tagSource, /const removeButtonShapeClass = isAvatarType \|\| isRounded \? "rounded-full" : "rounded-xs";/u);
	assert.match(tagSource, /isAvatarType \|\| isRounded \? "rounded-full" : "rounded-sm"/u);
	assert.match(tagSource, /isOtherAvatarTag \? "ps-0\.5" : "ps-px"/u);
	// Removable hover-bg → outer border matches 2px top/bottom: bordered pe-px,
	// borderless editor pe-0.5. Metric/badge chips stay on pe-px.
	assert.match(
		tagSource,
		/hasRemoveButton[\s\S]*\? isEditor[\s\S]*\? "pe-0\.5"[\s\S]*: "pe-px"[\s\S]*: hasElemAfter[\s\S]*\? "pe-px"[\s\S]*: isAvatarType[\s\S]*\? "pe-1\.5"[\s\S]*: "pe-\[4px\]"/u,
	);
	assert.match(tagSource, /const removeButtonMarginClass = hasLeadingElement \? undefined : "-ms-0\.5";/u);
	assert.doesNotMatch(tagSource, /isOtherAvatarTag \|\| type === "agent" \? "rounded-sm"/u);
});

test("Tag ignores HTML button type when deciding avatar shell rounding", () => {
	const tagSource = fs.readFileSync(
		path.join(process.cwd(), "components", "ui", "tag.tsx"),
		"utf8",
	);
	const pullRequestsSelectSource = fs.readFileSync(
		path.join(
			process.cwd(),
			"components",
			"blocks",
			"jira-work-item",
			"experimental-v2",
			"components",
			"pull-requests-select.tsx",
		),
		"utf8",
	);

	// Unknown `type` values (e.g. HTML `type="button"` merged onto Tag) must not
	// flip the Tag into the avatar `rounded-full` shell.
	assert.match(
		tagSource,
		/const isAvatarType = type === "user" \|\| type === "other" \|\| type === "agent";/u,
	);
	assert.doesNotMatch(tagSource, /const isAvatarType = type !== "default";/u);
	assert.match(tagSource, /data-type=\{type\}/u);
	assert.doesNotMatch(
		pullRequestsSelectSource,
		/shape="rounded"|variant="rounded"/u,
	);
});

test("Tag avatar demo uses removable controls without a team verification badge", () => {
	const avatarTagsDemoSource = TAG_DEMO_SOURCE.match(
		/export function TagDemoAvatarTags\(\)[\s\S]*?(?=export function TagDemoMentionTags\(\))/u,
	)?.[0];

	assert.ok(avatarTagsDemoSource);
	assert.match(avatarTagsDemoSource, /type="other"\s+onRemove=\{\(\) => \{\}\}/u);
	assert.doesNotMatch(avatarTagsDemoSource, /isVerified/u);
});

test("Tag at-mention demo shows rounded human, team, and agent treatments", () => {
	const tagDetailsSource = fs.readFileSync(
		path.join(process.cwd(), "app", "data", "details", "ui", "tag.ts"),
		"utf8",
	);
	const tagRegistrySource = fs.readFileSync(
		path.join(process.cwd(), "components", "website", "registry", "ui", "variants-progress.ts"),
		"utf8",
	);

	assert.match(TAG_DEMO_SOURCE, /export function TagDemoMentionTags\(\)/u);
	assert.match(TAG_DEMO_SOURCE, /import \{ AgentAvatarVisual \} from "@\/components\/ui-custom\/agent-avatar-visual";/u);
	assert.match(TAG_DEMO_SOURCE, /type="user"[\s\S]*variant="editor"[\s\S]*Ee Venn Soh/u);
	assert.match(TAG_DEMO_SOURCE, /type="other"[\s\S]*variant="editor"[\s\S]*Apple Ecosystem/u);
	assert.match(TAG_DEMO_SOURCE, /type="agent"[\s\S]*variant="editor"[\s\S]*Code Planner/u);
	assert.match(TAG_DEMO_SOURCE, /sizePx=\{16\}[\s\S]*vpkLogo="rovo"[\s\S]*Rovo/u);
	assert.match(TAG_DEMO_SOURCE, /brandName="claude"[\s\S]*Claude/u);
	assert.doesNotMatch(
		TAG_DEMO_SOURCE.match(/export function TagDemoMentionTags\(\)[\s\S]*$/u)?.[0] ?? "",
		/sizePx=\{(?:20|24|32|40)\}/u,
	);
	assert.match(tagDetailsSource, /title: "At-mention tags"[\s\S]*demoSlug: "tag-demo-mention-tags"/u);
	assert.match(
		tagDetailsSource,
		/hexagonal Rovo \(`vpkLogo`\) and Claude \(`brandName`\) marks/u,
	);
	assert.match(tagRegistrySource, /"tag-demo-mention-tags"[\s\S]*default: mod\.TagDemoMentionTags/u);
});
