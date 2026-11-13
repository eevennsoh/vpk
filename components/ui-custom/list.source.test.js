const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

const SOURCE = readFileSync(join(__dirname, "list.tsx"), "utf8");

test("List is a presentational compound: Root section, Heading h2, Table colgroup+body, Row, Cell", () => {
	// Compound namespace exposes all five sub-components.
	assert.match(
		SOURCE,
		/export const List = \{[\s\S]*Root: ListRoot,[\s\S]*Heading: ListHeading,[\s\S]*Table: ListTable,[\s\S]*Row: ListRow,[\s\S]*Cell: ListCell,[\s\S]*\} as const/,
	);
	// Root renders a <section> and forwards props (so aria-labelledby passes through).
	assert.match(SOURCE, /function ListRoot\(\{ className, \.\.\.props \}[\s\S]*<section/);
	assert.match(SOURCE, /flex w-full flex-col gap-2/);
	// Heading renders an <h2> with the studio section-label classes.
	assert.match(SOURCE, /function ListHeading\([\s\S]*<h2/);
	assert.match(SOURCE, /px-1\.5 text-xs font-semibold leading-4 text-text-subtlest/);
	// Table renders one <col> per column inside a Table + TableBody.
	assert.match(
		SOURCE,
		/columns\.map\(\(column, columnIndex\) => \([\s\S]*<col key=\{columnIndex\} className=\{column\.className\} \/>/,
	);
	assert.match(SOURCE, /min-w-full table-fixed/);
});

test("List.Row carries the list row styling (height, divider, transparent hover)", () => {
	assert.match(SOURCE, /function ListRow\(/);
	// 14-unit row height, disabled-token divider, and a transparent row so the
	// per-cell hover highlight can be clipped by rounded corners.
	assert.match(SOURCE, /group\/row h-14 border-disabled hover:bg-transparent/);
});

test("List.Cell applies padding, the row-wide hover highlight, and edge corner rounding", () => {
	assert.match(SOURCE, /function ListCell\(/);
	// px-2 padding + the group hover highlight.
	assert.match(
		SOURCE,
		/px-2 transition-colors group-hover\/row:bg-bg-neutral-subtle-hovered/,
	);
	// Edge cells round the outer corners on the first/last rows.
	assert.match(SOURCE, /edge === "leading" && isFirst && "rounded-tl-\[12px\]"/);
	assert.match(SOURCE, /edge === "leading" && isLast && "rounded-bl-\[12px\]"/);
	assert.match(SOURCE, /edge === "trailing" && isFirst && "rounded-tr-\[12px\]"/);
	assert.match(SOURCE, /edge === "trailing" && isLast && "rounded-br-\[12px\]"/);
});

test("List.Table supplies row position so cells can round outer corners", () => {
	assert.match(SOURCE, /ListRowPositionContext/);
	assert.match(SOURCE, /isFirst: rowIndex === 0, isLast: rowIndex === lastIndex/);
	assert.match(SOURCE, /React\.use\(ListRowPositionContext\)/);
});

test("List stays presentational: no studio/state logic leaks in", () => {
	assert.doesNotMatch(SOURCE, /localStorage|pinned/i);
});

test("List is registered in the component catalog and demo registry", () => {
	const manifest = readFileSync(
		join(__dirname, "..", "..", "app", "data", "component-manifest.ts"),
		"utf8",
	);
	const components = readFileSync(
		join(__dirname, "..", "..", "app", "data", "components.ts"),
		"utf8",
	);
	const registry = readWebsiteRegistrySource();
	// Catalog/nav (manifest) and detail page (components) both expose the slug.
	assert.match(manifest, /customComponent\("list"\)/);
	assert.match(components, /customComponent\("list"\)/);
	// A live demo is registered so the docs page renders a preview.
	assert.match(registry, /list: dynamic\(\(\) => import\("\.\/demos\/ui-custom\/list-demo"\)/);
});
