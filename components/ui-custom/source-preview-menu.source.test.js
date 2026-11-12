const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

const MENU_SOURCE = readFileSync(join(__dirname, "source-preview-menu.tsx"), "utf8");
const DATA_SOURCE = readFileSync(join(__dirname, "source-preview-menu-data.ts"), "utf8");
const DATA_PATH = join(__dirname, "source-preview-menu-data.ts");

test("preview-menu data keeps a long owner so metadata must ellipsize beside hover actions", () => {
	assert.match(DATA_SOURCE, /export const SOURCE_PREVIEW_LONG_OWNER = "Mike Cannon-Brookes";/u);
	assert.match(DATA_SOURCE, /owner: SOURCE_PREVIEW_LONG_OWNER,/u);
	assert.match(DATA_SOURCE, /id: "unified-string-theory",[\s\S]*owner: SOURCE_PREVIEW_LONG_OWNER,/u);
});

test("preview-menu metadata truncates the owner with CSS ellipsis, not a hard clip", () => {
	assert.match(
		MENU_SOURCE,
		/<span className="shrink-0">\s*Updated on \{formatSourcePreviewDate\(source\.updatedAt\)\}\s*<\/span>/u,
	);
	assert.match(
		MENU_SOURCE,
		/<span aria-hidden="true" className="shrink-0">\s*·\s*<\/span>/u,
	);
	assert.match(
		MENU_SOURCE,
		/<span className=\{truncateOwner \? "min-w-0 flex-1 truncate" : undefined\}>\s*Owned by \{source\.owner\}\s*<\/span>/u,
	);
	assert.match(
		MENU_SOURCE,
		/menu-row-byline flex min-w-0 items-center gap-1\.5 overflow-visible! text-text-subtlest!/u,
	);
	assert.match(
		MENU_SOURCE,
		/<SourcePreviewMetadata source=\{source\} truncateOwner=\{true\} \/>/u,
	);
	assert.doesNotMatch(MENU_SOURCE, /source\.owner\.slice\(/u);
	assert.match(
		MENU_SOURCE,
		/aria-label=\{`More actions for \$\{source\.title\}`\}/u,
	);
});

test("preview-menu is a shared popover owner, not a docs-only demo", () => {
	assert.match(MENU_SOURCE, /export function SourcePreviewMenu/u);
	assert.match(MENU_SOURCE, /<Popover onOpenChange=\{setMenuOpen\} open=\{menuOpen\}>/u);
	assert.match(MENU_SOURCE, /<PopoverTrigger render=\{trigger\}>/u);
	assert.match(MENU_SOURCE, /<PopoverTitle className="sr-only">Source previews<\/PopoverTitle>/u);
	assert.match(MENU_SOURCE, /Open preview modal/u);
	assert.match(MENU_SOURCE, /Copy link/u);
	assert.match(
		MENU_SOURCE,
		/max-h-\[min\(22rem,var\(--available-height,22rem\)\)\][\s\S]*overflow-y-auto/u,
	);
	assert.doesNotMatch(MENU_SOURCE, /gap-0 overflow-visible border-0 p-1 shadow-2xl/u);
});

test("preview-menu leading tiles follow an explicit source, then the href product", () => {
	assert.match(MENU_SOURCE, /function SourcePreviewLeadingTile/u);
	assert.match(MENU_SOURCE, /if \(source\.source\) \{/u);
	assert.match(MENU_SOURCE, /const product = getSourcePreviewProduct\(source\.href\)/u);
	assert.match(MENU_SOURCE, /case "jira":/u);
	assert.match(MENU_SOURCE, /case "confluence":/u);
	assert.match(MENU_SOURCE, /case "github":/u);
	assert.match(MENU_SOURCE, /case "slack":/u);
	assert.match(MENU_SOURCE, /<TwgToolSourceIcon/u);
	assert.match(MENU_SOURCE, /provider: "jira"/u);
	assert.match(MENU_SOURCE, /name: "github"/u);
	assert.match(MENU_SOURCE, /name: "slack"/u);
	assert.match(
		MENU_SOURCE,
		/case "github":[\s\S]*<TwgToolSourceIcon[\s\S]*aria-hidden[\s\S]*name: "github"[\s\S]*case "slack":[\s\S]*<TwgToolSourceIcon[\s\S]*aria-hidden[\s\S]*name: "slack"/u,
	);
	assert.match(MENU_SOURCE, /variant="blue"/u);
});

test("preview-menu product mapping follows href host and path", async () => {
	const { code } = await esbuild.transform(readFileSync(DATA_PATH, "utf8"), {
		format: "cjs",
		loader: "ts",
	});
	const { getSourcePreviewProduct, getSourcePreviewIconTileVariant } = loadCjsModuleFromText(
		code,
		DATA_PATH,
	);

	assert.equal(getSourcePreviewProduct("https://hello.atlassian.net/browse/PAY-102"), "jira");
	assert.equal(
		getSourcePreviewProduct("https://hello.atlassian.net/wiki/spaces/PAY/pages/5483563901"),
		"confluence",
	);
	assert.equal(getSourcePreviewProduct("https://github.com/acme/storefront/pull/1847"), "github");
	assert.equal(getSourcePreviewProduct("https://atlassian.slack.com/archives/C0PAYMENTS"), "slack");
	assert.equal(
		getSourcePreviewIconTileVariant("https://hello.atlassian.net/wiki/spaces/UST/pages/1"),
		"blue",
	);
	assert.equal(getSourcePreviewIconTileVariant("https://github.com/acme/storefront/pull/1847"), "gray");
});
