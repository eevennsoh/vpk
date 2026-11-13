const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

function readProjectFile(relativePath) {
	return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const SOURCE = "components/blocks/next-best-action/components/next-best-action.tsx";
const ARTIFACT_LIST = "components/ui-custom/artifact-list/components/artifact-list.tsx";

test("Next Best Action is registered as a Blocks component in all four registries", () => {
	assert.match(
		readProjectFile("app/data/components.ts"),
		/blockComponent\("next-best-action", "Next Best Action"\)/u,
	);
	assert.match(
		readProjectFile("app/data/component-manifest.ts"),
		/blockComponent\("next-best-action", "Next Best Action"\)/u,
	);
	assert.match(
		readDetailCategorySource("blocks"),
		/"next-best-action": NEXT_BEST_ACTION_DETAIL/u,
	);
	assert.match(
		readWebsiteRegistrySource(),
		/"next-best-action": dynamic\(\(\) => import\("\.\/demos\/blocks\/next-best-action-demo"\)/u,
	);
});

test("Next Best Action delegates to Artifact List instead of restating its row anatomy", () => {
	const source = readProjectFile(SOURCE);

	assert.match(source, /import \{ ArtifactList, type ArtifactListItem \} from "@\/components\/ui-custom\/artifact-list";/u);
	assert.match(source, /<ArtifactList\b/u);
	assert.match(source, /export type NextBestActionItem = ArtifactListItem;/u);

	// The row implementation must live in exactly one place. If any of these
	// reappear here, the block has started re-implementing Artifact List.
	for (const duplicated of [
		"bg-surface-raised",
		"elevation.shadow.raised",
		"min-h-16",
		"min-h-12",
		"rounded-tile",
		"grid-cols-[0fr]",
		"<Tile",
		"<Lozenge",
		"pullRequest",
		"border-b border-border",
	]) {
		assert.ok(
			!source.includes(duplicated),
			`"${duplicated}" belongs to Artifact List; the block must not restate it`,
		);
	}

	// A thin adapter, not a fork.
	assert.ok(source.split("\n").length < 60, "adapter should stay small");
});

test("Next Best Action renames the action surface without changing behavior", () => {
	const source = readProjectFile(SOURCE);

	assert.match(source, /onAct\?: \(item: NextBestActionItem\) => void;/u);
	assert.match(source, /actionLabel = "Create"/u);
	assert.match(source, /actOnRowClick = false/u);
	assert.match(source, /onOpen=\{onAct\}/u);
	assert.match(source, /openLabel=\{actionLabel\}/u);
	assert.match(source, /openOnRowClick=\{actOnRowClick\}/u);
	// The renamed props must not also leak through as their Artifact List names.
	assert.match(source, /Omit<[\s\S]*"onOpen" \| "openLabel" \| "openOnRowClick"[\s\S]*>/u);
});

test("Artifact List supports the per-row action verb the block relies on", () => {
	const source = readProjectFile(ARTIFACT_LIST);

	assert.match(source, /rowActionLabel\?: string;/u);
	assert.match(source, /const rowOpenLabel = item\.rowActionLabel \?\? openLabel;/u);
	// Both the visible button label and the row-overlay accessible name use it.
	assert.match(source, /\) : rowOpenLabel\}/u);
	assert.match(source, /aria-label=\{`\$\{rowOpenLabel\} \$\{item\.title\}`\}/u);
});

test("Artifact List never renders a focusable PR link without a destination", () => {
	const source = readProjectFile(ARTIFACT_LIST);

	assert.match(source, /\{item\.href \? \([\s\S]*<a[\s\S]*href=\{item\.href\}/u);
	assert.doesNotMatch(source, /href="#"/u);
	assert.doesNotMatch(source, /event\.preventDefault\(\)/u);
	assert.match(source, /\) : \([\s\S]*<span[\s\S]*min-w-0 flex-1 truncate text-text[\s\S]*#\{item\.pullRequest\.number\}: \{item\.title\}/u);
});

test("Artifact List honors prefers-reduced-motion on every transition", () => {
	const source = readProjectFile(ARTIFACT_LIST);

	// VPK duration/easing tokens do not collapse automatically, so each transition
	// needs an explicit guard.
	const transitions = source.match(/transition-\[[^\]]+\]|transition-colors/gu) ?? [];
	assert.ok(transitions.length >= 3, `expected transitions to guard, found ${transitions.length}`);
	assert.equal(
		(source.match(/motion-reduce:transition-none/gu) ?? []).length,
		transitions.length,
		"every transition utility must be paired with motion-reduce:transition-none",
	);
});

test("Artifact List row-click overlay keeps its focus ring inside the clipping wrapper", () => {
	const source = readProjectFile(ARTIFACT_LIST);

	// The row content wrapper is overflow-hidden, so an outward ring-offset is clipped.
	assert.match(source, /absolute inset-0 z-10[\s\S]*focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/u);
	assert.doesNotMatch(source, /focus-visible:ring-offset-2/u);
});

test("Next Best Action sample data suggests skills, agents, automations, integrations and nudges", () => {
	const page = readProjectFile("components/blocks/next-best-action/page.tsx");
	const demo = readProjectFile("components/website/demos/blocks/next-best-action-demo.tsx");
	const sampleItems = readProjectFile("components/blocks/next-best-action/data/sample-items.tsx");

	assert.match(page, /import \{ NextBestAction \} from "@\/components\/blocks\/next-best-action";/u);
	assert.match(page, /items=\{SAMPLE_NEXT_BEST_ACTIONS\}/u);
	assert.match(page, /items=\{COMPACT_SAMPLE_NEXT_BEST_ACTIONS\}/u);
	assert.match(page, /variant="compact"/u);
	assert.match(demo, /import Page from "@\/components\/blocks\/next-best-action\/page";/u);

	for (const kind of [
		"Suggested skill",
		"Suggested agent",
		"Suggested automation",
		"Suggested integration",
		"Suggested nudge",
	]) {
		assert.ok(sampleItems.includes(kind), `sample items should include a "${kind}" row`);
	}
	// Every non-PR suggestion carries its own verb so the reveal never reads "Create" for a review nudge.
	for (const verb of ["Create", "Enable", "Connect", "Review", "View", "Update"]) {
		assert.ok(
			sampleItems.includes(`rowActionLabel: "${verb}"`),
			`sample items should include a "${verb}" action`,
		);
	}
	// The PR row carries a real destination so the demo exercises the link path.
	assert.match(sampleItems, /id: "review-pull-request"[\s\S]*href: "https:\/\/[\s\S]*logoName: "github"[\s\S]*number: 1847[\s\S]*status: "Open"[\s\S]*additions: 148[\s\S]*deletions: 37/u);
});
