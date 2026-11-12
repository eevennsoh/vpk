const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

function readProjectFile(relativePath) {
	return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("Code List is registered as a UI Custom component in all four registries", () => {
	assert.match(
		readProjectFile("app/data/components.ts"),
		/customComponent\("code-list", "Code List"\)/u,
	);
	assert.match(
		readProjectFile("app/data/component-manifest.ts"),
		/customComponent\("code-list", "Code List"\)/u,
	);
	assert.match(
		readDetailCategorySource("ui-custom"),
		/import \{ CodeList \} from "@\/components\/ui-custom\/code-list";/u,
	);
	assert.match(
		readWebsiteRegistrySource(),
		/"code-list": dynamic\(\(\) => import\("\.\/demos\/ui-custom\/code-list-demo"\)/u,
	);
});

test("Code List card uses the raised-surface elevation skin", () => {
	const source = readProjectFile(
		"components/ui-custom/code-list/components/code-list.tsx",
	);

	assert.match(source, /overflow-hidden rounded-lg bg-surface-raised/u);
	assert.match(source, /boxShadow: token\("elevation\.shadow\.raised"\)/u);
});

test("Code List rows are full-width 32px buttons that hover to surface-hovered, last row borderless", () => {
	const source = readProjectFile(
		"components/ui-custom/code-list/components/code-list.tsx",
	);

	// The whole row is a single button hit area with a list-item hover background.
	assert.match(source, /<button[\s\S]*?min-h-8 w-full cursor-pointer items-center gap-2 px-3 py-1[\s\S]*?hover:bg-surface-hovered/u);
	assert.match(source, /!isLast && "border-b border-border"/u);
	assert.match(source, /isLast=\{index === items\.length - 1\}/u);
});

test("Code List uses plain 12px chevron icons, not ADS Buttons", () => {
	const source = readProjectFile(
		"components/ui-custom/code-list/components/code-list.tsx",
	);

	// Chevrons render as decorative icons at the small (12px) size, never buttons.
	assert.match(source, /<ChevronRightIcon[\s\S]*?size="small"/u);
	assert.match(source, /<ChevronDownIcon[\s\S]*?size="small"/u);
	assert.match(source, /<CodeIcon[\s\S]*?size="small"/u);
	assert.doesNotMatch(source, /from "@\/components\/ui\/button"/u);
	assert.doesNotMatch(source, /<Button\b/u);
});

test("Code List renders the file path in monospace with a subtlest dir and default-text filename", () => {
	const source = readProjectFile(
		"components/ui-custom/code-list/components/code-list.tsx",
	);

	assert.match(source, /min-w-0 flex-1 truncate font-mono text-xs leading-5 text-text-subtlest/u);
	assert.match(source, /<span>\{dir\}<\/span>/u);
	assert.match(source, /<span className="text-text">\{filename\}<\/span>/u);
});

test("Code List diff stats use the lime (additions) and red (deletions) accent tokens", () => {
	const source = readProjectFile(
		"components/ui-custom/code-list/components/code-list.tsx",
	);

	assert.match(source, /<span className="text-text-accent-lime">\+\{additions\}<\/span>/u);
	assert.match(source, /<span className="text-text-accent-red">-\{deletions\}<\/span>/u);
});

test("Code List expands a row into a small, line-numbered code block", () => {
	const source = readProjectFile(
		"components/ui-custom/code-list/components/code-list.tsx",
	);

	// The per-row chevron toggles an accessible, aria-controlled panel.
	assert.match(source, /aria-controls=\{panelId\}/u);
	assert.match(source, /aria-expanded=\{isExpanded\}/u);
	// The expanded panel reuses the shared CodeBlock in its small + line-numbers
	// variant, with the container stroke removed so it blends into the row card.
	assert.match(source, /<CodeBlock\b[\s\S]*?className="border-0"[\s\S]*?code=\{item\.code\}[\s\S]*?language=\{language\}[\s\S]*?showLineNumbers[\s\S]*?size="sm"/u);
	assert.match(source, /import \{ CodeBlock \} from "@\/components\/ui-custom\/code-block";/u);
});

test("Code List summary header reports the file count, totals, and a minimise toggle", () => {
	const source = readProjectFile(
		"components/ui-custom/code-list/components/code-list.tsx",
	);

	assert.match(source, /\{fileCount\} \{fileCount === 1 \? "file" : "files"\}/u);
	assert.match(source, /aria-expanded=\{!isMinimized\}/u);
	assert.match(source, /setIsMinimized\(\(prev\) => !prev\)/u);
	// The whole header is the toggle; its label underlines on hover.
	assert.match(source, /text-text-subtlest group-hover:underline/u);
});

test("Code List docs demo renders the sample items card", () => {
	const page = readProjectFile("components/ui-custom/code-list/page.tsx");
	const demo = readProjectFile("components/website/demos/ui-custom/code-list-demo.tsx");

	assert.match(page, /import \{ CodeList \} from "@\/components\/ui-custom\/code-list";/u);
	assert.match(page, /items=\{SAMPLE_CODE_LIST_ITEMS\}/u);
	assert.match(demo, /import CodeListPage from "@\/components\/ui-custom\/code-list\/page";/u);
});
