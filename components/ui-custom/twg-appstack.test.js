const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");
const { accessibleName, renderComponent } = require(process.cwd() + "/scripts/lib/render-component.js");

const ROOT = join(__dirname, "..", "..");
const SOURCE = readFileSync(join(__dirname, "twg-appstack.tsx"), "utf8");
const COMPONENTS_SOURCE = readFileSync(join(ROOT, "app/data/components.ts"), "utf8");
const MANIFEST_SOURCE = readFileSync(join(ROOT, "app/data/component-manifest.ts"), "utf8");
const DETAILS_SOURCE = readDetailCategorySource("ui-custom");
const REGISTRY_SOURCE = readWebsiteRegistrySource();
const DEMO_SOURCE = readFileSync(join(ROOT, "components/website/demos/ui-custom/twg-appstack-demo.tsx"), "utf8");
const TWG_TOOL_SOURCE = readFileSync(join(ROOT, "components/ui-custom/twg-tool.tsx"), "utf8");
const TWG_TOOL_DEMO_SOURCE = readFileSync(join(ROOT, "components/website/demos/ui-custom/twg-tool-demo.tsx"), "utf8");
const THINKING_TRACE_PRESENTATION_SOURCE = readFileSync(join(ROOT, "components/projects/shared/lib/assistant-thinking-trace-presentation.tsx"), "utf8");

test("TWG Appstack exposes the shared 16/20/24/32 tile size scale", () => {
	assert.match(SOURCE, /export function TWGAppstack/u);
	assert.match(
		SOURCE,
		/export type TwgToolSourceIconSize = "xxsmall" \| "xsmall" \| "small" \| "medium";/u,
	);
	assert.match(SOURCE, /xxsmall: \{\s*box: "size-4",\s*overflowBox: "h-4 max-h-4 min-h-0 min-w-4 w-auto",\s*overflowRadius: "rounded-sm!",\s*imagePx: 16,\s*overlap: "-ml-0\.5",\s*countText: "text-\[10px\]",\s*countPad: "px-0\.5",\s*\}/u);
	assert.match(SOURCE, /xsmall: \{\s*box: "size-5",\s*overflowBox: "h-5 max-h-5 min-h-0 min-w-5 w-auto",\s*overflowRadius: "rounded-sm!",\s*imagePx: 20,\s*overlap: "-ml-1",\s*countText: "text-\[10px\]",\s*countPad: "px-0\.5",\s*\}/u);
	assert.match(SOURCE, /small: \{\s*box: "size-6",\s*overflowBox: "h-6 max-h-6 min-h-0 min-w-6 w-auto",\s*overflowRadius: "rounded-md!",\s*imagePx: 24,\s*overlap: "-ml-1",\s*countText: "text-xs",\s*countPad: "px-1",\s*\}/u);
	assert.match(SOURCE, /medium: \{\s*box: "size-8",\s*overflowBox: "h-8 max-h-8 min-h-0 min-w-8 w-auto",\s*overflowRadius: "rounded-lg!",\s*imagePx: 32,\s*overlap: "-ml-1\.5",\s*countText: "text-xs",\s*countPad: "px-1",\s*\}/u);
	assert.match(SOURCE, /as const satisfies Record<TwgToolSourceIconSize, \{/u);
	assert.match(SOURCE, /"relative flex shrink-0 items-center justify-center"/u);
});

test("TWG Appstack defaults to 24px and passes the size straight to the tile scale", () => {
	assert.match(SOURCE, /size = "small",/u);
	assert.match(SOURCE, /iconSize = "small",/u);
	assert.match(SOURCE, /const sizing = APPSTACK_SIZES\[iconSize\];/u);
	assert.match(SOURCE, /boxClassName: string = sizing\.box/u);
	assert.match(SOURCE, /boxClassName,\s*index > 0 && sizing\.overlap/u);
	// The four names are shared with `components/ui/tile`, so no translation
	// table sits between the prop and the Tile / logo primitives.
	assert.doesNotMatch(SOURCE, /getSourceTileSize|getAppstackItemClassName|getSourceImageSize/u);
	assert.doesNotMatch(SOURCE, /size === "md"/u);
});

test("TWG Appstack rejects caller children that its source render path discards", () => {
	assert.match(
		SOURCE,
		/export type TWGAppstackProps = Omit<ComponentProps<"div">, "children"> & \{\s*children\?: never;/u,
	);
	assert.match(SOURCE, /\{visibleSources\.map\(\(source, index\) => \(/u);
});

test("TWG Appstack uses a solid fill on stacked tiles", () => {
	assert.match(SOURCE, /const APPSTACK_TILE_FILL_CLASS = "bg-surface"/u);
	assert.match(SOURCE, /cn\("shrink-0", APPSTACK_TILE_FILL_CLASS, className\)/u);
	assert.match(SOURCE, /"box-border w-auto shrink-0 overflow-hidden bg-surface py-0 leading-none text-text-subtlest \[&_span\]:h-full \[&_span\]:w-auto"/u);
	assert.match(
		SOURCE,
		/<span className=\{cn\("whitespace-nowrap font-medium leading-none tabular-nums", sizing\.countText\)\}>/u,
	);
});

test("TWG Appstack animation is optional and preserves source stack rotation", () => {
	assert.match(SOURCE, /animated = true/u);
	assert.match(SOURCE, /const shouldAnimate = animated && !shouldReduceMotion/u);
	assert.match(SOURCE, /if \(!shouldAnimate\)/u);
	assert.match(SOURCE, /const APPSTACK_ROTATIONS = \[\s*0,\s*6,\s*0,\s*-8,\s*\] as const/u);
	assert.match(SOURCE, /const APPSTACK_ENTER_ROTATION_OFFSET = 18/u);
	assert.match(SOURCE, /rotate: \{ type: "spring", stiffness: 260, damping: 30, mass: 0\.85/u);
	assert.match(SOURCE, /transform: `rotate\(\$\{rotation\}deg\)`/u);
	assert.match(SOURCE, /animate=\{\{ filter: "blur\(0px\)", opacity: 1, rotate: rotation, scale: 1, x: 0 \}\}/u);
});

test("TWG Appstack only staggers its first reveal and layout-animates later sources", () => {
	assert.match(SOURCE, /const hasRenderedSources = useRef\(false\);/u);
	assert.match(SOURCE, /const shouldStaggerEntrance = !hasRenderedSources\.current;/u);
	assert.match(SOURCE, /if \(sources\.length > 0\) hasRenderedSources\.current = true;/u);
	assert.match(
		SOURCE,
		/const delay = shouldStaggerEntrance[\s\S]*\? getAppstackDelay\(index, itemCount, direction\)[\s\S]*: 0;/u,
	);
	assert.match(SOURCE, /layout=\{shouldReduceMotion \? false : "position"\}/u);
	assert.match(SOURCE, /layout: \{ duration: 0\.25, ease: motionEase\.inOut \}/u);
});

test("TWG source icons hide labeled third-party logos when aria-hidden is set", () => {
	assert.match(
		SOURCE,
		/if \(source\.name\) \{[\s\S]*return props\["aria-hidden"\] \? <span aria-hidden>\{logo\}<\/span> : logo;/u,
	);
	assert.match(
		SOURCE,
		/if \(isThirdPartyProvider\(source\.provider\)\) \{[\s\S]*return props\["aria-hidden"\] \? <span aria-hidden>\{logo\}<\/span> : logo;/u,
	);
});

test("Rovo source icons use the app container across sizes and preserve decorative semantics", async () => {
	const esbuild = require("esbuild");
	const React = require("react");
	const { renderToStaticMarkup } = require("react-dom/server");
	const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");
	const result = await esbuild.build({
		stdin: {
			contents: 'export { TwgToolSourceIcon } from "@/components/ui-custom/twg-appstack"; export { ThemeWrapper } from "@/components/utils/theme-wrapper";',
			resolveDir: process.cwd(),
		},
		bundle: true,
		format: "cjs",
		platform: "node",
		external: ["react", "react/*", "next/image"],
		loader: { ".css": "empty" },
		tsconfig: join(process.cwd(), "tsconfig.json"),
		write: false,
	});
	const { TwgToolSourceIcon, ThemeWrapper } = loadCjsModuleFromText(result.outputFiles[0].text);
	const renderIcon = (props) => renderToStaticMarkup(React.createElement(ThemeWrapper, null, React.createElement(TwgToolSourceIcon, props)));
	const source = { id: "rovo", label: "Rovo", provider: "rovo" };
	for (const [size, geometry] of [["xxsmall", "size-4"], ["xsmall", "size-5"], ["small", "size-6"], ["medium", "size-8"]]) {
		const markup = renderIcon({ source, size });
		assert.match(markup, /bg-bg-neutral-bold/u);
		assert.ok(markup.includes(geometry));
		assert.match(markup, /role="img"/u);
		assert.match(markup, /aria-label="Rovo"/u);
		assert.match(markup, /<svg/u);
	}
	const decorative = renderIcon({ source, "aria-hidden": true });
	assert.match(decorative, /aria-hidden="true"/u);
	assert.doesNotMatch(decorative, /aria-label="Rovo"|role="img"/u);
	const custom = renderIcon({
		source: { ...source, icon: React.createElement("span", null, "Custom mark") },
	});
	assert.match(custom, /Custom mark/u);
	assert.doesNotMatch(custom, /bg-bg-neutral-bold/u);
	const jira = renderIcon({
		source: { id: "jira", label: "Jira", provider: "jira" },
	});
	assert.match(jira, /bg-surface/u);
	assert.doesNotMatch(jira, /bg-bg-neutral-bold/u);
});

test("Teamwork Graph app tiles reuse the graph mark and can be decorative", async () => {
	const source = { id: "teamwork-graph", label: "Teamwork Graph", provider: "teamwork-graph" };
	const view = await renderComponent({
		entry: "components/ui-custom/twg-appstack.tsx",
		exportName: "TwgToolSourceIcon",
		props: { source, size: "xsmall" },
	});
	assert.equal(accessibleName(view.getByRole("img", { name: "Teamwork Graph" })), "Teamwork Graph");
	assert.equal(view.container.querySelectorAll("circle").length, 4);
	assert.equal(view.container.querySelectorAll("svg").length, 1);
	assert.equal(view.container.querySelector("svg").getAttribute("aria-hidden"), "true");
	assert.deepEqual(view.tabOrder(), []);

	await view.rerender({ source, size: "xsmall", "aria-hidden": true });
	assert.equal(view.queryByRole("img", { name: "Teamwork Graph" }) === null, true);
	assert.equal(view.container.querySelector('[aria-label="Teamwork Graph"]') === null, true);
});

test("Code Search uses its existing glyph in the lime app tile", async () => {
	const source = { id: "search", label: "Search", provider: "code-search" };
	const view = await renderComponent({
		entry: "components/ui-custom/twg-appstack.tsx",
		exportName: "TwgToolSourceIcon",
		props: { source, size: "xsmall" },
	});
	const tile = view.getByRole("img", { name: "Search" });
	assert.equal(accessibleName(tile), "Search");
	assert.equal(tile.classList.contains("bg-lime-300"), true);
	assert.equal(tile.querySelector("img").getAttribute("src"), "/brand-icons/rovo-search.svg");
	assert.equal(tile.querySelector("img").getAttribute("aria-hidden"), "true");
	assert.equal(tile.querySelector("img").getAttribute("width"), "20");
	assert.deepEqual(view.tabOrder(), []);

	await view.rerender({ source, size: "xsmall", "aria-hidden": true });
	assert.equal(view.queryByRole("img", { name: "Search" }) === null, true);
});

test("TWG Appstack keeps the legacy TwgToolSourceStack adapter", () => {
	assert.match(SOURCE, /export function TwgToolSourceStack\(props: TWGAppstackProps\)/u);
	assert.match(SOURCE, /return <TWGAppstack \{\.\.\.props\} \/>/u);
});

test("TWG Tool aligns expanded reasoning content with the banner copy", () => {
	assert.match(
		TWG_TOOL_SOURCE,
		/"mt-2 pl-12 overflow-hidden text-xs leading-5 text-text-subtle"/u,
	);
});

test("TWG Tool only reserves banner inset for the animated loader", () => {
	assert.match(
		TWG_TOOL_SOURCE,
		/const bannerPaddingClassName = showLoader \? "pl-1" : "";/u,
	);
});

test("TWG Tool nested reasoning content can be expanded and collapsed", () => {
	assert.match(
		TWG_TOOL_DEMO_SOURCE,
		/<ChainOfThoughtStep[\s\S]*label="Evaluating sources"[\s\S]*collapsible[\s\S]*defaultOpen/u,
	);
	assert.match(TWG_TOOL_DEMO_SOURCE, /description="Read through 6 sources"[\s\S]*showLoader=\{false\}[\s\S]*contentClassName="pl-2"/u);
});

test("assistant thinking TWG tools omit the nested loader", () => {
	assert.match(
		THINKING_TRACE_PRESENTATION_SOURCE,
		/<TwgTool[\s\S]*onBannerClick=\{interactive \? toggleOpen : undefined\}[\s\S]*showLoader=\{false\}/u,
	);
	assert.match(
		THINKING_TRACE_PRESENTATION_SOURCE,
		/"twg\.lookup_work_item_delivery_context": \{[\s\S]*title: "Connecting work through Teamwork Graph"[\s\S]*className: "pl-2"/u,
	);
	assert.match(THINKING_TRACE_PRESENTATION_SOURCE, /TWG_TOOL_ICON_CONTAINER_STYLE = \{ marginTop: 6 \}/u);
	assert.match(
		THINKING_TRACE_PRESENTATION_SOURCE,
		/entry\.header\?\.type === "twg-tool" \? TWG_TOOL_ICON_CONTAINER_STYLE : undefined/u,
	);
});

test("the TWG Tool demo exposes a no-loader variant", () => {
	assert.match(
		TWG_TOOL_DEMO_SOURCE,
		/export function TwgToolDemoCompleted\(\)[\s\S]*showLoader=\{false\}[\s\S]*contentClassName="pl-2"/u,
	);
	assert.match(
		DETAILS_SOURCE,
		/title: "Without loader"[\s\S]*TWG Tool banner without the nested Teamwork Graph loader\./u,
	);
});

test("all TWG Tool demos use a centered frame", () => {
	assert.match(
		TWG_TOOL_DEMO_SOURCE,
		/function TwgToolDemoFrame[\s\S]*flex min-h-full w-full items-center justify-center p-4/u,
	);
	assert.equal((TWG_TOOL_DEMO_SOURCE.match(/<TwgToolDemoFrame>/gu) ?? []).length, 4);
});

test("TWG Appstack overflow count uses tile min-width and grows for longer counts", () => {
	assert.match(SOURCE, /overflowBox: "h-4 max-h-4 min-h-0 min-w-4 w-auto"/u);
	assert.match(SOURCE, /overflowBox: "h-6 max-h-6 min-h-0 min-w-6 w-auto"/u);
	assert.match(SOURCE, /overflowBox: "h-8 max-h-8 min-h-0 min-w-8 w-auto"/u);
	assert.match(SOURCE, /overflowRadius: "rounded-sm!"/u);
	assert.match(SOURCE, /overflowRadius: "rounded-md!"/u);
	assert.match(SOURCE, /overflowRadius: "rounded-lg!"/u);
	assert.match(SOURCE, /sizing\.overflowBox/u);
	assert.match(SOURCE, /sizing\.overflowRadius/u);
	assert.match(SOURCE, /sizing\.countPad/u);
	assert.match(SOURCE, /countPad: "px-0\.5"/u);
	assert.match(SOURCE, /countPad: "px-1"/u);
	assert.doesNotMatch(SOURCE, /countPad: "p-/u);
	assert.doesNotMatch(SOURCE, /countPad: "py-/u);
	assert.match(SOURCE, /Never use `rounded-tile` here/u);
	assert.match(SOURCE, /data-appstack-overflow=\{hiddenCount\}/u);
	assert.match(SOURCE, /whitespace-nowrap/u);
	assert.match(SOURCE, /box-border w-auto shrink-0 overflow-hidden bg-surface py-0 leading-none/u);
	assert.match(SOURCE, /\[&_span\]:h-full \[&_span\]:w-auto/u);
	assert.doesNotMatch(SOURCE, /\[&_span\]:size-auto/u);
	assert.doesNotMatch(
		SOURCE,
		/hiddenCount > 0 \? \([\s\S]*renderItem\([\s\S]*sizing\.box/u,
	);
	assert.match(DEMO_SOURCE, /createOverflowSources\(10\)/u);
	assert.match(DEMO_SOURCE, /createOverflowSources\(48\)/u);
	assert.match(DEMO_SOURCE, /\+10 — square min-width/u);
	assert.match(DEMO_SOURCE, /\+48 — grows past the tile square/u);
	assert.match(DETAILS_SOURCE, /demoSlug: "twg-appstack-demo-overflow-grow"/u);
	assert.match(REGISTRY_SOURCE, /"twg-appstack-demo-overflow-grow": dynamic\(/u);
});

test("TWG Appstack is wired into the ui-custom catalog", () => {
	assert.match(COMPONENTS_SOURCE, /customComponent\("twg-appstack", "TWG Appstack"\)/u);
	assert.match(MANIFEST_SOURCE, /customComponent\("twg-appstack", "TWG Appstack"\)/u);
	assert.match(DETAILS_SOURCE, /"twg-appstack": \{/u);
	assert.match(REGISTRY_SOURCE, /"twg-appstack": dynamic\(\(\) => import\("\.\/demos\/ui-custom\/twg-appstack-demo"\)/u);
	assert.match(REGISTRY_SOURCE, /"twg-appstack-demo-sizes": dynamic\(/u);
	assert.match(DETAILS_SOURCE, /demoSlug: "twg-appstack-demo-sizes"/u);
	assert.match(DEMO_SOURCE, /export function TWGAppstackDemoSizes\(\)/u);
	assert.match(DEMO_SOURCE, /export function TWGAppstackDemoOverflowGrow\(\)/u);
	assert.match(DEMO_SOURCE, /export default function TWGAppstackDemo/u);
	assert.match(DEMO_SOURCE, /aria-label="Replay TWG app stack animation"/u);
	assert.match(DEMO_SOURCE, /setReplayKey\(\(currentKey\) => currentKey \+ 1\)/u);
	assert.match(DEMO_SOURCE, /<div key=\{replayKey\}/u);
});
