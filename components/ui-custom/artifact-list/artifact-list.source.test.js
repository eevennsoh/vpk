const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

function readProjectFile(relativePath) {
	return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("Artifact List is registered as a UI Custom component in all four registries", () => {
	assert.match(
		readProjectFile("app/data/components.ts"),
		/customComponent\("artifact-list", "Artifact List"\)/u,
	);
	assert.match(
		readProjectFile("app/data/component-manifest.ts"),
		/customComponent\("artifact-list", "Artifact List"\)/u,
	);
	assert.match(
		readDetailCategorySource("ui-custom"),
		/import \{ ArtifactList \} from "@\/components\/ui-custom\/artifact-list";/u,
	);
	assert.match(
		readWebsiteRegistrySource(),
		/"artifact-list": dynamic\(\(\) => import\("\.\/demos\/ui-custom\/artifact-list-demo"\)/u,
	);
});

test("Artifact List card uses the raised-surface elevation skin from Figma", () => {
	const source = readProjectFile(
		"components/ui-custom/artifact-list/components/artifact-list.tsx",
	);

	assert.match(source, /min-w-0 max-w-full overflow-hidden rounded-lg bg-surface-raised/u);
	assert.match(source, /boxShadow: token\("elevation\.shadow\.raised"\)/u);
});

test("Artifact List rows are at least 64px, hover to surface-hovered, and the last row is borderless", () => {
	const source = readProjectFile(
		"components/ui-custom/artifact-list/components/artifact-list.tsx",
	);

	assert.match(source, /flex min-h-16 items-center px-3 py-2 transition-colors motion-reduce:transition-none hover:bg-surface-hovered/u);
	// Icon/text gap lives on the content cluster; the Open slot uses margin on reveal.
	assert.match(source, /group\/artifact-row min-w-0 w-full/u);
	assert.match(source, /relative flex min-w-0 flex-1 items-center gap-3 overflow-hidden/u);
	assert.match(source, /<span className="shrink-0">\s*<ArtifactListLeadingTile/u);
	// Every row except the last draws a bottom border.
	assert.match(source, /!isLast && "border-b border-border"/u);
	assert.match(source, /isLast=\{index === items\.length - 1\}/u);
});

test("Artifact List leading visual uses the ADS tile radius and neutral inset-image rows", () => {
	const source = readProjectFile(
		"components/ui-custom/artifact-list/components/artifact-list.tsx",
	);

	assert.match(source, /const usesInsetImage = Boolean\(item\.avatarSrc \|\| item\.logoSrc\);/u);
	assert.match(source, /variant=\{usesInsetImage \? "neutral" : item\.tileVariant \?\? "neutral"\}/u);
	assert.match(source, /size=\{variant === "compact" \? "small" : "medium"\}[\s\S]*className=\{cn\([\s\S]*"rounded-tile"/u);
	// Avatar/logo paths render inset on the same tile; icon is the fallback.
	assert.match(source, /if \(item\.avatarSrc\)[\s\S]*<img[\s\S]*src=\{item\.avatarSrc\}/u);
	assert.match(source, /if \(item\.logoSrc\)[\s\S]*<img[\s\S]*src=\{item\.logoSrc\}/u);
	assert.match(source, /return item\.icon;/u);
	assert.match(source, /item\.iconName === "page"[\s\S]*<PageIcon label="" size="small" \/>/u);
	assert.match(source, /item\.iconName === "video"[\s\S]*<VideoIcon label="" size="small" \/>/u);
});

test("Artifact List metadata renders source · owner with the small subtlest dot", () => {
	const source = readProjectFile(
		"components/ui-custom/artifact-list/components/artifact-list.tsx",
	);

	assert.match(source, /<span className="shrink-0 text-text-subtle">\{item\.source\}<\/span>/u);
	assert.equal((source.match(/aria-hidden="true" className="shrink-0 text-text-subtlest">·<\/span>/gu) ?? []).length, 1);
	assert.match(source, /<span aria-hidden="true" className="text-text-subtlest"> · <\/span>/u);
	// Compact rows stack the combined metadata beneath the title, and both lines
	// truncate before the trailing action.
	assert.match(source, /<span className="block w-full truncate text-xs leading-4 text-text-subtle">/u);
	assert.match(source, /<div className="flex min-w-0 flex-1 flex-col overflow-hidden">/u);
	assert.match(source, /<p className="w-full truncate text-xs font-medium leading-4 text-text">\{item\.title\}<\/p>/u);
	assert.doesNotMatch(source, /shrink-0 truncate text-sm font-medium leading-5 text-text/u);
});

test("Artifact List keeps the compact row structure and uses flyout metadata for PR bylines", () => {
	const source = readProjectFile(
		"components/ui-custom/artifact-list/components/artifact-list.tsx",
	);

	assert.match(source, /const compactPullRequestByline = item\.pullRequest \? \(/u);
	assert.match(source, /<span className="mt-0\.5 flex w-full min-w-0 items-center gap-1 text-xs leading-4">/u);
	assert.match(
		source,
		/<span className="shrink-0">\s*<Lozenge variant=\{item\.pullRequest\.status === "Merged" \? "discovery" : "success"\}>[\s\S]*\{item\.pullRequest\.status\}/u,
	);
	// The PR byline links only when the item supplies a destination; without one it
	// renders plain text rather than a focusable anchor that cannot navigate.
	assert.match(source, /\{item\.href \? \([\s\S]*<a[\s\S]*no-underline decoration-current outline-none hover:underline focus-visible:underline[\s\S]*href=\{item\.href\}[\s\S]*#\{item\.pullRequest\.number\}: \{item\.title\}[\s\S]*<\/a>/u);
	assert.doesNotMatch(source, /href="#"/u);
	assert.doesNotMatch(source, /event\.preventDefault\(\)/u);
	assert.match(source, /<p className="w-full truncate text-xs font-medium leading-4 text-text">\{item\.title\}<\/p>[\s\S]*\{compactPullRequestByline \?\? compactMetadata\}/u);
	assert.match(source, /aria-label=\{item\.pullRequest[\s\S]*`Code changes: \$\{item\.pullRequest\.additions\} additions, \$\{item\.pullRequest\.deletions\} deletions`/u);
	assert.match(source, /\{item\.pullRequest \? \([\s\S]*text-text-success[\s\S]*text-text-danger[\s\S]*\) : rowOpenLabel\}/u);
});

test("Artifact List Open button reveals on row hover/focus and stays keyboard-reachable", () => {
	const source = readProjectFile(
		"components/ui-custom/artifact-list/components/artifact-list.tsx",
	);

	// In-flow trailing column collapses at rest (0fr) and expands on hover/focus so
	// the raised card's overflow never clips an absolute overlay.
	assert.match(source, /group\/artifact-row/u);
	assert.match(
		source,
		/grid-cols-\[0fr\] group-hover\/artifact-row:ml-3 group-hover\/artifact-row:grid-cols-\[1fr\]/u,
	);
	assert.match(
		source,
		/group-has-\[:focus-visible\]\/artifact-row:ml-3 group-has-\[:focus-visible\]\/artifact-row:grid-cols-\[1fr\]/u,
	);
	assert.match(
		source,
		/\[@media\(hover:none\)\]:ml-3 \[@media\(hover:none\)\]:grid-cols-\[1fr\]/u,
	);
	assert.match(
		source,
		/<Button[\s\S]*pointer-events-none opacity-0[\s\S]*group-hover\/artifact-row:pointer-events-auto group-hover\/artifact-row:opacity-100[\s\S]*group-has-\[:focus-visible\]\/artifact-row:pointer-events-auto group-has-\[:focus-visible\]\/artifact-row:opacity-100[\s\S]*\[@media\(hover:none\)\]:pointer-events-auto \[@media\(hover:none\)\]:opacity-100[\s\S]*focus-visible:pointer-events-auto focus-visible:opacity-100[\s\S]*variant="outline"[\s\S]*size=\{variant === "compact" \? "compact" : "default"\}[\s\S]*type="button"[\s\S]*event\.stopPropagation\(\);[\s\S]*handleOpen\(\);/u,
	);
	assert.match(source, /openOnRowClick \? \([\s\S]*<button[\s\S]*type="button"[\s\S]*onClick=\{handleOpen\}/u);
	assert.match(source, /openOnRowClick\?: boolean;/u);
	assert.doesNotMatch(source, /role=\{openOnRowClick \? "button"/u);
	assert.doesNotMatch(source, /\binert\b/u);
	assert.doesNotMatch(source, /<HoverRevealActions/u);
});

test("Artifact List action slots expose their button-owned focus indicators", () => {
	const source = readProjectFile(
		"components/ui-custom/artifact-list/components/artifact-list.tsx",
	);

	assert.match(
		source,
		/className="min-w-0 overflow-hidden has-\[:focus-visible\]:overflow-visible"[\s\S]*Code changes:/u,
	);
});

test("Artifact List text expands into the action slot at rest", () => {
	const source = readProjectFile(
		"components/ui-custom/artifact-list/components/artifact-list.tsx",
	);

	assert.match(source, /className="min-w-0 flex-1 overflow-hidden"/u);
	assert.match(source, /ml-0 grid shrink-0/u);
	assert.match(source, /grid-cols-\[0fr\]/u);
	assert.doesNotMatch(source, /pr-\[92px\]/u);
	assert.doesNotMatch(source, /group-hover\/hover-reveal-row:pr-\[72px\]/u);
});

test("Artifact List docs demo renders the sample items card", () => {
	const page = readProjectFile("components/ui-custom/artifact-list/page.tsx");
	const demo = readProjectFile("components/website/demos/ui-custom/artifact-list-demo.tsx");
	const sampleItems = readProjectFile("components/ui-custom/artifact-list/data/sample-items.tsx");

	assert.match(page, /import \{ ArtifactList \} from "@\/components\/ui-custom\/artifact-list";/u);
	assert.match(page, /items=\{SAMPLE_ARTIFACT_ITEMS\}/u);
	assert.match(page, /items=\{COMPACT_SAMPLE_ARTIFACT_ITEMS\}/u);
	assert.match(page, /variant="compact"/u);
	assert.match(demo, /import ArtifactListPage from "@\/components\/ui-custom\/artifact-list\/page";/u);
	assert.match(sampleItems, /id: "vertexrail-assets-positioning-pr"[\s\S]*logoName: "github"[\s\S]*number: 1847[\s\S]*status: "Open"[\s\S]*additions: 148[\s\S]*deletions: 37/u);
});

test("Artifact List compact variant shares default shell chrome, keeps denser rows, 24px tiles and compact actions", () => {
	const source = readProjectFile(
		"components/ui-custom/artifact-list/components/artifact-list.tsx",
	);

	assert.match(source, /variant\?: "default" \| "compact";/u);
	// Shared raised shell; compact keeps denser min-h-12 rows (not default min-h-16).
	assert.match(source, /min-w-0 max-w-full overflow-hidden rounded-lg bg-surface-raised/u);
	assert.doesNotMatch(source, /border border-border bg-surface/u);
	assert.match(source, /variant === "compact"[\s\S]*flex min-h-12 items-center px-3 py-2 transition-colors motion-reduce:transition-none hover:bg-surface-hovered/u);
	assert.match(source, /flex min-h-16 items-center px-3 py-2 transition-colors motion-reduce:transition-none hover:bg-surface-hovered/u);
	assert.match(source, /relative flex min-w-0 flex-1 items-center gap-3 overflow-hidden/u);
	assert.doesNotMatch(source, /grid size-8 shrink-0 place-items-center/u);
	assert.match(source, /size=\{variant === "compact" \? "small" : "medium"\}/u);
	assert.match(source, /flex min-w-0 flex-1 flex-col overflow-hidden/u);
	assert.match(source, /size=\{variant === "compact" \? "compact" : "default"\}/u);
});
