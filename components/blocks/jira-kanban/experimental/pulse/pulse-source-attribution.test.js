const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const STORY_SOURCE = readFileSync(join(__dirname, "components/pulse-story.tsx"), "utf8");
const APPSTACK_SOURCE = readFileSync(join(__dirname, "components/pulse-sources-appstack.tsx"), "utf8");
const PREVIEW_SOURCE = readFileSync(join(__dirname, "data/pulse-sources-preview.ts"), "utf8");

test("Pulse attributes every insight to fourteen sources with a static app stack", () => {
	const sourceBlock = PREVIEW_SOURCE.match(
		/export const PULSE_SOURCES = \[([\s\S]*?)\] satisfies readonly TwgToolSource\[\];/u,
	)?.[1] ?? "";

	assert.equal([...sourceBlock.matchAll(/\{ id:/gu)].length, 14);
	assert.match(PREVIEW_SOURCE, /import type \{ TwgToolSource \} from "@\/components\/ui-custom\/twg-appstack";/u);
	assert.match(APPSTACK_SOURCE, /import \{ TWGAppstack \} from "@\/components\/ui-custom\/twg-appstack";/u);
	assert.match(
		APPSTACK_SOURCE,
		/import \{\s*PULSE_SOURCE_PREVIEW_PAGES,\s*PULSE_SOURCES,\s*\} from "@\/components\/blocks\/jira-kanban\/experimental\/pulse\/data\/pulse-sources-preview";/u,
	);
	assert.match(
		STORY_SOURCE,
		/import \{ PulseSourcesAppstack \} from "@\/components\/blocks\/jira-kanban\/experimental\/pulse\/components\/pulse-sources-appstack";/u,
	);
	assert.match(
		STORY_SOURCE,
		/import \{ PULSE_SOURCES \} from "@\/components\/blocks\/jira-kanban\/experimental\/pulse\/data\/pulse-sources-preview";/u,
	);
	assert.match(STORY_SOURCE, /<span aria-hidden className=\{cn\("shrink-0", PULSE_ROW_META\)\}>·<\/span>/u);
	assert.match(
		STORY_SOURCE,
		/\{`\$\{PULSE_SOURCES\.length\} \$\{PULSE_SOURCES\.length === 1 \? "Source" : "Sources"\}`\}[\s\S]*<span className="sr-only"> from Jira, Confluence, GitHub, Slack, and 10 more<\/span>/u,
	);
	assert.match(STORY_SOURCE, /<PulseSourcesAppstack \/>/u);
	assert.match(APPSTACK_SOURCE, /<TWGAppstack[\s\S]*animated=\{false\}[\s\S]*aria-hidden[\s\S]*iconSize="xxsmall"[\s\S]*sources=\{PULSE_SOURCES\}/u);
});

test("Pulse opens the shared sources preview menu from the app stack button", () => {
	assert.match(
		APPSTACK_SOURCE,
		/import \{\s*PULSE_SOURCE_PREVIEW_PAGES,\s*PULSE_SOURCES,\s*\} from "@\/components\/blocks\/jira-kanban\/experimental\/pulse\/data\/pulse-sources-preview";/u,
	);
	assert.match(APPSTACK_SOURCE, /<SourcePreviewMenu/u);
	assert.match(APPSTACK_SOURCE, /pages=\{PULSE_SOURCE_PREVIEW_PAGES\}/u);
	assert.match(
		APPSTACK_SOURCE,
		/aria-label=\{`View \$\{PULSE_SOURCES\.length\} sources`\}/u,
	);
	assert.match(
		APPSTACK_SOURCE,
		/className="inline-flex h-auto w-auto min-h-0 min-w-fit shrink-0 items-center overflow-visible/u,
	);
	assert.match(
		APPSTACK_SOURCE,
		/className="w-auto min-w-fit shrink-0 justify-start overflow-visible"/u,
	);
	assert.doesNotMatch(APPSTACK_SOURCE, /variant="ghost"/u);
	assert.doesNotMatch(APPSTACK_SOURCE, /\bSOURCE_PREVIEW_PAGES\b/u);
	assert.doesNotMatch(APPSTACK_SOURCE, /function SourcePreviewCard/u);
	assert.doesNotMatch(STORY_SOURCE, /function SourcePreviewCard/u);
});

test("Pulse preview pages match the connected sources one-for-one", () => {
	const copyBlock = PREVIEW_SOURCE.match(
		/const PULSE_SOURCE_PREVIEW_COPY = \{([\s\S]*?)\} satisfies Record<PulseSourceId, PulseSourcePreviewCopy>;/u,
	)?.[1] ?? "";

	assert.equal([...copyBlock.matchAll(/title:/gu)].length, 14);
	assert.match(PREVIEW_SOURCE, /PULSE_SOURCES\.map\(\(source\) =>/u);
	assert.match(PREVIEW_SOURCE, /hello\.atlassian\.net\/browse\/PAY-102/u);
	assert.match(PREVIEW_SOURCE, /hello\.atlassian\.net\/wiki\/spaces\/PAY/u);
	assert.match(PREVIEW_SOURCE, /github\.com\/acme\/storefront\/pull\/1847/u);
	assert.match(PREVIEW_SOURCE, /atlassian\.slack\.com\/archives\/C0PAYMENTS/u);
	assert.match(PREVIEW_SOURCE, /atlassian\.sentry\.io/u);
	assert.match(PREVIEW_SOURCE, /app\.launchdarkly\.com/u);
	assert.doesNotMatch(PREVIEW_SOURCE, /About UST/u);
	assert.doesNotMatch(PREVIEW_SOURCE, /Unified String Theory/u);
});

test("Pulse keeps source attribution when an insight has no contributors", () => {
	assert.doesNotMatch(
		STORY_SOURCE,
		/if \(contributors\.length === 0\) \{\s*return null;\s*\}/u,
	);
	assert.match(STORY_SOURCE, /\{contributors\.length === 0 \? null : \([\s\S]*<AvatarGroup/u);
});
