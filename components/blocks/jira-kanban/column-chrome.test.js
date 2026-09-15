const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

const COLUMN_CHROME_SOURCE = readFileSync(
	path.join(__dirname, "column-chrome.ts"),
	"utf8",
);
const SESSION_COLUMN_SOURCE = readFileSync(
	path.join(__dirname, "../agent-session-column/index.tsx"),
	"utf8",
);
const SESSION_HEADER_SOURCE = readFileSync(
	path.join(__dirname, "../agent-session-column/agent-session-column-header.tsx"),
	"utf8",
);

async function loadColumnChromeHarness() {
	const result = await esbuild.build({
		stdin: {
			contents: `
				export {
					DEFAULT_KANBAN_COLUMN_CHROME,
					DEFAULT_KANBAN_DROP_ARMED_CLASS_NAME,
					DEFAULT_KANBAN_DROP_IDLE_CLASS_NAME,
					DEFAULT_KANBAN_DROP_SHELL_CLASS_NAME,
					SIMPLE_KANBAN_DROP_ARMED_CLASS_NAME,
					SIMPLE_KANBAN_DROP_IDLE_CLASS_NAME,
					SIMPLE_KANBAN_DROP_CONTENT_INSET,
					SIMPLE_KANBAN_DROP_RING_CLIP_GUTTER,
					SIMPLE_KANBAN_DROP_SHELL_CLASS_NAME,
					resolveKanbanColumnChrome,
					setKanbanColumnDropArmed,
					withKanbanDropContentGutter,
					withKanbanDropRingClipGutter,
				} from "./components/blocks/jira-kanban/column-chrome";
				export { token } from "./lib/tokens";
			`,
			loader: "ts",
			resolveDir: process.cwd(),
			sourcefile: "column-chrome-harness.ts",
		},
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	});

	return loadCjsModuleFromText(result.outputFiles[0].text, "column-chrome-harness.cjs");
}

test("default names bg-surface-sunken and the well tokens", async () => {
	const harness = await loadColumnChromeHarness();
	const chrome = harness.resolveKanbanColumnChrome("default");

	assert.equal(harness.DEFAULT_KANBAN_COLUMN_CHROME, "default");
	assert.equal(
		chrome.columnClassName,
		"bg-surface-sunken border border-solid border-transparent",
	);
	assert.equal(chrome.cardChrome, "raised");
	assert.equal(chrome.header.paddingTop, harness.token("space.100"));
	assert.equal(chrome.header.paddingInline, harness.token("space.150"));
	assert.equal(chrome.header.paddingBottom, harness.token("space.050"));
	assert.equal(chrome.cardList.paddingTop, harness.token("space.050"));
	assert.equal(chrome.cardList.paddingBottom, harness.token("space.100"));
	assert.equal(chrome.cardList.paddingInline, harness.token("space.050"));
	assert.equal(chrome.cardList.gap, harness.token("space.050"));
	assert.equal(chrome.footer.paddingInline, harness.token("space.050"));
	assert.equal(chrome.dropShellClassName, harness.DEFAULT_KANBAN_DROP_SHELL_CLASS_NAME);
	assert.equal(chrome.dropArmedClassName, harness.DEFAULT_KANBAN_DROP_ARMED_CLASS_NAME);
	assert.equal(chrome.dropIdleClassName, harness.DEFAULT_KANBAN_DROP_IDLE_CLASS_NAME);
	assert.equal(chrome.dropRingClipGutter, "");
	assert.equal(chrome.dropContentPadding, undefined);
	assert.equal("resizeButtonClassName" in chrome, false);
	assert.equal(chrome.headerFrame, "enclosed");
	assert.equal(
		chrome.collapsed.pillClassName,
		"bg-surface-sunken border border-solid border-transparent",
	);
	assert.equal(chrome.collapsed.captionPaddingBottom, undefined);
	assert.equal(chrome.collapsed.countPaddingTop, harness.token("space.100"));
	assert.equal(chrome.collapsed.pillRadius, harness.token("radius.large"));
	assert.equal(chrome.collapsed.pillPaddingBlock, harness.token("space.150"));
	assert.equal("headerFrame" in chrome.collapsed, false);
});

test("column chrome does not pad the collapse control", () => {
	// icon-compact is a 24px box. Asymmetric padding (pt-2/pb-1) shrinks the
	// content box and drops the glyph off vertical center.
	assert.doesNotMatch(COLUMN_CHROME_SOURCE, /resizeButtonClassName/u);
	assert.doesNotMatch(COLUMN_CHROME_SOURCE, /pt-2 pb-1/u);
});

test("default well and Untracked enclosed well share a 1px border box", () => {
	assert.match(
		COLUMN_CHROME_SOURCE,
		/columnClassName: "bg-surface-sunken border border-solid border-transparent"/u,
	);
	assert.match(
		SESSION_COLUMN_SOURCE,
		/AGENT_SESSION_WELL_PAINT = cn\(\s*AGENT_SESSION_PLANE,\s*"rounded-xl border border-solid border-transparent",\s*\)/u,
	);
	assert.match(
		SESSION_HEADER_SOURCE,
		/enclosed: \{\s*\n\s*paddingTop: token\("space\.100"\),\s*\n\s*paddingInline: token\("space\.150"\),\s*\n\s*paddingBottom: token\("space\.050"\),\s*\n\s*\}/u,
	);
	assert.doesNotMatch(
		SESSION_COLUMN_SOURCE,
		/layout === "enclosed" \? "border border-solid border-transparent" : null/u,
	);
	assert.match(COLUMN_CHROME_SOURCE, /countPaddingTop: token\("space\.100"\)/u);
});

test("simple has an empty class and undefined insets", async () => {
	const harness = await loadColumnChromeHarness();
	const chrome = harness.resolveKanbanColumnChrome("simple");

	assert.equal(chrome.columnClassName, "");
	assert.equal(chrome.cardChrome, "stroke");
	assert.equal(chrome.header.paddingTop, undefined);
	assert.equal(chrome.header.paddingInline, undefined);
	assert.equal("paddingBottom" in chrome.header, false);
	assert.equal(chrome.cardList.paddingTop, undefined);
	assert.equal(chrome.cardList.paddingBottom, undefined);
	assert.equal(chrome.cardList.paddingInline, undefined);
	assert.equal("gap" in chrome.cardList, false);
	assert.equal(chrome.footer.paddingInline, undefined);
	assert.equal(chrome.dropShellClassName, harness.SIMPLE_KANBAN_DROP_SHELL_CLASS_NAME);
	assert.equal(chrome.dropArmedClassName, harness.SIMPLE_KANBAN_DROP_ARMED_CLASS_NAME);
	assert.equal(chrome.dropIdleClassName, harness.SIMPLE_KANBAN_DROP_IDLE_CLASS_NAME);
	assert.equal(chrome.dropContentPadding?.paddingTop, harness.SIMPLE_KANBAN_DROP_CONTENT_INSET);
	assert.equal(chrome.dropContentPadding?.paddingInline, harness.SIMPLE_KANBAN_DROP_CONTENT_INSET);
	assert.equal(chrome.dropContentPadding?.paddingBottom, harness.SIMPLE_KANBAN_DROP_CONTENT_INSET);
	assert.equal(chrome.dropContentPadding?.paddingTop, harness.token("space.050"));
	assert.equal(chrome.dropContentPadding?.paddingInline, harness.token("space.050"));
	assert.equal("resizeButtonClassName" in chrome, false);
	assert.equal(Object.hasOwn(chrome.header, "paddingTop"), true);
	assert.notEqual(chrome.header.paddingTop, 0);
	assert.notEqual(chrome.cardList.paddingInline, 0);
	assert.equal(chrome.headerFrame, "caption");
	assert.equal(chrome.collapsed.pillClassName, "border border-border-disabled");
	assert.equal(chrome.collapsed.captionPaddingBottom, harness.token("space.100"));
	assert.equal(chrome.collapsed.countPaddingTop, undefined);
	assert.equal(chrome.collapsed.pillRadius, harness.token("radius.large"));
	assert.equal(chrome.collapsed.pillPaddingBlock, harness.token("space.150"));
	assert.equal("headerFrame" in chrome.collapsed, false);
});

test("omit and undefined resolve to the default well", async () => {
	const harness = await loadColumnChromeHarness();
	const omitted = harness.resolveKanbanColumnChrome();
	const explicitUndefined = harness.resolveKanbanColumnChrome(undefined);
	const namedDefault = harness.resolveKanbanColumnChrome("default");

	assert.equal(omitted, namedDefault);
	assert.equal(explicitUndefined, namedDefault);
	assert.equal(
		omitted.columnClassName,
		"bg-surface-sunken border border-solid border-transparent",
	);
	assert.equal(omitted.cardChrome, "raised");
});

test("repeated resolve returns the same frozen object", async () => {
	const harness = await loadColumnChromeHarness();
	const firstDefault = harness.resolveKanbanColumnChrome("default");
	const secondDefault = harness.resolveKanbanColumnChrome("default");
	const firstSimple = harness.resolveKanbanColumnChrome("simple");
	const secondSimple = harness.resolveKanbanColumnChrome("simple");

	assert.equal(firstDefault, secondDefault);
	assert.equal(firstSimple, secondSimple);
	assert.notEqual(firstDefault, firstSimple);
	assert.equal(Object.isFrozen(firstDefault), true);
	assert.equal(Object.isFrozen(firstSimple), true);
});

test("simple paints an offset gutter outline and keeps the 2px layout border idle", async () => {
	const harness = await loadColumnChromeHarness();
	const simple = harness.resolveKanbanColumnChrome("simple");
	const namedDefault = harness.resolveKanbanColumnChrome("default");

	assert.equal(
		harness.SIMPLE_KANBAN_DROP_SHELL_CLASS_NAME,
		[
			"border-2 border-transparent",
			"outline-2 outline-offset-2 outline-transparent",
			"transition-[outline-color] duration-normal ease-out-practical",
			"motion-reduce:transition-none",
		].join(" "),
	);
	assert.equal(simple.dropArmedClassName, "outline-ring");
	assert.equal(simple.dropIdleClassName, "outline-transparent");
	assert.match(simple.dropShellClassName, /outline-offset-2/u);
	assert.match(simple.dropShellClassName, /border-2 border-transparent/u);
	assert.doesNotMatch(simple.dropShellClassName, /border-ring/u);
	assert.equal(namedDefault.dropArmedClassName, "border-ring");
	assert.equal(namedDefault.dropIdleClassName, "border-transparent");
	assert.doesNotMatch(namedDefault.dropShellClassName, /outline-offset-2/u);
	assert.equal(simple.dropRingClipGutter, harness.SIMPLE_KANBAN_DROP_RING_CLIP_GUTTER);
	assert.equal(simple.dropRingClipGutter, harness.token("space.100"));
	assert.equal(simple.dropContentPadding?.paddingTop, harness.SIMPLE_KANBAN_DROP_CONTENT_INSET);
	assert.equal(simple.dropContentPadding?.paddingInline, harness.SIMPLE_KANBAN_DROP_CONTENT_INSET);
	assert.equal(namedDefault.dropRingClipGutter, "");
	assert.equal(namedDefault.dropContentPadding, undefined);
	assert.doesNotMatch(COLUMN_CHROME_SOURCE, /headerDropArmedClassName/u);
	assert.doesNotMatch(COLUMN_CHROME_SOURCE, /padding-inline:calc/u);
});

test("simple drop-ring clip gutter adds 8px of unclipped top padding", async () => {
	const harness = await loadColumnChromeHarness();
	const simple = harness.resolveKanbanColumnChrome("simple");
	const namedDefault = harness.resolveKanbanColumnChrome("default");
	const gutter = harness.token("space.100");

	assert.deepEqual(harness.withKanbanDropRingClipGutter(0, simple), {
		paddingTop: `calc(0px + ${gutter})`,
	});
	assert.deepEqual(
		harness.withKanbanDropRingClipGutter(harness.token("space.150"), simple),
		{
			paddingTop: `calc(${harness.token("space.150")} + ${gutter})`,
		},
	);
	assert.deepEqual(harness.withKanbanDropRingClipGutter(0, namedDefault), { paddingTop: 0 });
	assert.doesNotMatch(COLUMN_CHROME_SOURCE, /marginTop/u);
});

test("simple drop content inset plus clip gutter keeps Untracked captions aligned", async () => {
	const harness = await loadColumnChromeHarness();
	const simple = harness.resolveKanbanColumnChrome("simple");
	const namedDefault = harness.resolveKanbanColumnChrome("default");
	const gutter = harness.token("space.100");
	const inset = harness.token("space.050");

	assert.deepEqual(harness.withKanbanDropContentGutter(0, simple), {
		paddingTop: `calc(0px + ${gutter} + ${inset})`,
	});
	assert.deepEqual(
		harness.withKanbanDropContentGutter(harness.token("space.150"), simple),
		{
			paddingTop: `calc(${harness.token("space.150")} + ${gutter} + ${inset})`,
		},
	);
	assert.deepEqual(harness.withKanbanDropContentGutter(0, namedDefault), { paddingTop: 0 });
});

test("setKanbanColumnDropArmed swaps the idle and armed color classes", async () => {
	const harness = await loadColumnChromeHarness();
	const tokens = new Set(["border-2", "border-transparent", "outline-2", "outline-offset-2", "outline-transparent"]);
	const element = {
		classList: {
			toggle(name, force) {
				if (force) {
					tokens.add(name);
					return;
				}
				tokens.delete(name);
			},
		},
	};
	const chrome = harness.resolveKanbanColumnChrome("simple");

	harness.setKanbanColumnDropArmed(element, chrome, true);
	assert.equal(tokens.has(chrome.dropArmedClassName), true);
	assert.equal(tokens.has(chrome.dropIdleClassName), false);

	harness.setKanbanColumnDropArmed(element, chrome, false);
	assert.equal(tokens.has(chrome.dropArmedClassName), false);
	assert.equal(tokens.has(chrome.dropIdleClassName), true);
});

test("the recipe module does not import design-variants", () => {
	assert.doesNotMatch(COLUMN_CHROME_SOURCE, /design-variants/u);
	assert.doesNotMatch(COLUMN_CHROME_SOURCE, /useDesignVariants/u);
	assert.doesNotMatch(COLUMN_CHROME_SOURCE, /isKanbanColumnChrome/u);
});

test("the recipe type-imports the session-column frame, not a duplicated union", () => {
	assert.match(
		COLUMN_CHROME_SOURCE,
		/import type \{ AgentSessionColumnFrame \} from "@\/components\/blocks\/agent-session-column\/agent-session-column-frame"/u,
	);
	assert.doesNotMatch(COLUMN_CHROME_SOURCE, /export type KanbanColumnHeaderFrame/u);
	assert.match(COLUMN_CHROME_SOURCE, /readonly headerFrame: AgentSessionColumnFrame;/u);
	assert.doesNotMatch(
		COLUMN_CHROME_SOURCE,
		/interface KanbanCollapsedChromeStyles \{[^}]*headerFrame/u,
	);
});
