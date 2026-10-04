const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

function readProjectFile(relativePath) {
	return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

// Matches the full-bleed stage breakout in either unit, so the assertions below
// can find every bleed site and then require the container-relative one.
const BLEED_PATTERN = /left-1\/2[^"]*w-(?:screen|\[100cqw\])[^"]*-translate-x-1\/2/u;

function listSourceFiles(relativeDir) {
	return fs
		.readdirSync(path.join(process.cwd(), relativeDir), { withFileTypes: true })
		.flatMap((entry) => {
			const entryPath = `${relativeDir}/${entry.name}`;
			if (entry.isDirectory()) return listSourceFiles(entryPath);
			return entry.isFile() && entry.name.endsWith(".tsx") ? [entryPath] : [];
		});
}

test("Gallery is registered as a website block in both catalog files", () => {
	assert.match(
		readProjectFile("app/data/components.ts"),
		/blockComponent\(\s*"gallery",\s*"Gallery"\s*\)/u,
	);
	assert.match(
		readProjectFile("app/data/component-manifest.ts"),
		/blockComponent\(\s*"gallery",\s*"Gallery"\s*\)/u,
	);
});

test("Gallery detail is imported and mapped in the blocks details barrel", () => {
	const source = readDetailCategorySource("blocks");
	assert.match(
		source,
		/import\s*\{\s*GALLERY_DETAIL\s*\}\s*from\s*"\.\/blocks\/gallery";/u,
	);
	assert.match(source, /(?:"gallery"|gallery)\s*:\s*GALLERY_DETAIL\s*,/u);
});

test("Gallery demo is registered as an ssr:false dynamic import", () => {
	assert.match(
		readWebsiteRegistrySource(),
		/(?:"gallery"|gallery)\s*:\s*dynamic\(\s*\(\)\s*=>\s*import\(\s*"\.\/demos\/blocks\/gallery-demo"\s*\)\s*,\s*\{\s*ssr\s*:\s*false\s*,?\s*\}\s*\)/u,
	);
});

test("Gallery animation sources declare an explicit reduced-motion guard", () => {
	assert.match(
		readProjectFile("components/blocks/gallery/components/gallery-track.tsx"),
		/useReducedMotion/u,
	);
	assert.match(
		readProjectFile("components/blocks/gallery/components/gallery-card.tsx"),
		/useReducedMotion/u,
	);
	assert.match(
		readProjectFile("components/blocks/gallery/components/gallery-selected-stage.tsx"),
		/useReducedMotion/u,
	);
	assert.match(
		readProjectFile("components/blocks/gallery/components/gallery-selected-surface.tsx"),
		/useReducedMotion/u,
	);
});

test("Gallery is now an in-page selector instead of a lightbox morph", () => {
	const gallerySource = readProjectFile("components/blocks/gallery/components/gallery.tsx");
	assert.match(gallerySource, /selectedId\?: string;/u);
	assert.match(gallerySource, /defaultSelectedId\?: string;/u);
	assert.match(gallerySource, /onSelectedChange\?: \(selectedId: string\) => void;/u);
	assert.match(gallerySource, /renderSelectedItem\?: \(item: GalleryItem\) => ReactNode;/u);
	assert.match(gallerySource, /GallerySelectedStage/u);
	assert.doesNotMatch(gallerySource, /scrollIntoView/u);
	assert.doesNotMatch(gallerySource, /GalleryExpanded/u);
	assert.doesNotMatch(gallerySource, /expandedId/u);
	assert.equal(
		fs.existsSync(
			path.join(process.cwd(), "components/blocks/gallery/components/gallery-expanded.tsx"),
		),
		false,
	);
});

test("Gallery fills its container without document scrolling", () => {
	const gallerySource = readProjectFile("components/blocks/gallery/components/gallery.tsx");
	const stageSource = readProjectFile("components/blocks/gallery/components/gallery-selected-stage.tsx");
	const indexSource = readProjectFile("components/blocks/gallery/index.ts");

	assert.match(gallerySource, /@container\/gallery-stage flex h-full min-h-0 flex-col overflow-hidden/u);
	// `h-dvh` would size the Gallery to the window rather than to the box it is
	// mounted in, which overflows the fixed-height catalog demo shell.
	assert.doesNotMatch(gallerySource, /h-dvh/u);
	assert.doesNotMatch(gallerySource, /STAGE_SCROLL_OFFSET|previousSelectedIdRef|scrollIntoView/u);
	assert.match(stageSource, /flex min-h-0[^\n]*flex-1/u);
	assert.match(gallerySource, /stagePosition = "top"/u);
	assert.match(gallerySource, /position=\{stagePosition\}/u);
	assert.match(stageSource, /export type GalleryStagePosition = "top" \| "center";/u);
	assert.match(stageSource, /origin-top flex-col/u);
	assert.match(stageSource, /position === "center"[\s\S]*items-center justify-center[\s\S]*items-stretch justify-start/u);
	assert.match(indexSource, /GalleryStagePosition/u);
	assert.doesNotMatch(stageSource, /pt-20|pb-80|min-h-\[calc\(100dvh/u);
});

test("Gallery consumers give it a parent with a definite height", () => {
	// Gallery is `h-full`, so a `min-h-*` parent lets it collapse to content height.
	const consumers = ["components/blocks/gallery/page.tsx", ...listSourceFiles("components/projects")].filter(
		(file) => /<Gallery\b/u.test(readProjectFile(file)),
	);

	assert.ok(consumers.length >= 4, `expected several Gallery consumers, found ${consumers.length}`);
	for (const consumer of consumers) {
		assert.match(
			readProjectFile(consumer),
			/className="relative h-dvh w-full/u,
			`${consumer} must wrap Gallery in a parent with a definite height`,
		);
	}
});

test("Full-bleed stages break out to the Gallery width, not the window width", () => {
	// Regression: `w-screen` (100vw) made stages render at window width inside the
	// fixed-width catalog demo shell, so `overflow-hidden` clipped both edges.
	// `100cqw` measures the `@container/gallery-stage` box instead. Standalone
	// stages size to their immediate parent and are covered by their owner tests.
	//
	// Stage files are DISCOVERED rather than listed: these projects get duplicated
	// into new `vN` variants, and a hardcoded list silently exempts every copy.
	const stageFiles = listSourceFiles("components/projects").filter((file) =>
		BLEED_PATTERN.test(readProjectFile(file)),
	);

	assert.ok(stageFiles.length >= 12, `expected the bleed pattern in several stages, found ${stageFiles.length}`);
	for (const stageFile of stageFiles) {
		const source = readProjectFile(stageFile);
		assert.match(
			source,
			/left-1\/2[^"]*w-\[100cqw\][^"]*-translate-x-1\/2/u,
			`${stageFile} must bleed with w-[100cqw]`,
		);
		assert.doesNotMatch(source, /\bw-screen\b/u, `${stageFile} must not bleed to the window width`);
	}
});

test("Gallery collapses the bottom carousel picker when there is only one card", () => {
	const gallerySource = readProjectFile("components/blocks/gallery/components/gallery.tsx");
	const toggleSource = readProjectFile("components/blocks/gallery/components/gallery-toggle.tsx");

	assert.match(gallerySource, /const showCarouselPicker = items\.length >= 2;/u);
	assert.match(gallerySource, /isOpen && showCarouselPicker \?/u);
	assert.match(gallerySource, /showOpenToggle=\{showCarouselPicker\}/u);
	assert.match(toggleSource, /showOpenToggle\?: boolean;/u);
	assert.match(toggleSource, /showOpenToggle = true,/u);
	assert.match(toggleSource, /\{showOpenToggle \? \([\s\S]*aria-label=\{galleryToggleLabel\}[\s\S]*\) : null\}/u);
});

test("Gallery cards remain mounted toggle buttons with origin-aware selection state", () => {
	const source = readProjectFile("components/blocks/gallery/components/gallery-card.tsx");
	assert.match(source, /aria-pressed/u);
	assert.match(source, /getGallerySelectionOriginFromPoint/u);
	assert.match(source, /DEFAULT_GALLERY_SELECTION_ORIGIN/u);
});

test("Gallery centers the card strip by default without breaking overflow reachability", () => {
	const source = readProjectFile("components/blocks/gallery/components/gallery-track.tsx");
	assert.match(source, /justify-center-safe/u);
	assert.match(source, /overflow-x-auto/u);
});

test("Gallery fits selected-stage text before paint", () => {
	const source = readProjectFile("components/blocks/gallery/hooks/use-fit-text.ts");
	assert.match(source, /import \{ useCallback, useLayoutEffect, useRef, useState/u);
	assert.match(source, /useLayoutEffect\(\(\) => \{[\s\S]*new ResizeObserver\(fit\)[\s\S]*fit\(\);/u);
});

test("Gallery preserves explicit title line groups without wrapping inside a line", () => {
	const source = readProjectFile("components/blocks/gallery/components/gallery-title-lines.tsx");

	assert.match(source, /className="block whitespace-nowrap"/u);
});

test("Gallery suppresses click-to-expand after a drag-to-pan gesture", () => {
	const cardSource = readProjectFile("components/blocks/gallery/components/gallery-card.tsx");
	const dragScrollSource = readProjectFile("components/blocks/gallery/hooks/use-drag-scroll.ts");
	assert.ok(
		/wasDragged/u.test(cardSource) || /wasDragged/u.test(dragScrollSource),
		"wasDragged must be referenced in the card click path (gallery-card.tsx and/or use-drag-scroll.ts)",
	);
});

test("Gallery selected surface preserves the organic ink-bloom contract", () => {
	const source = readProjectFile("components/blocks/gallery/components/gallery-selected-surface.tsx");
	assert.match(source, /const ENTER_EASE = \[0\.45, 0, 0\.55, 1\] as const;/u);
	assert.match(source, /const EXIT_EASE = motionEase\.out;/u);
	assert.match(source, /const DUR_ENTER = 0\.8;/u);
	assert.match(source, /const inkMaskSeed = seed \+ visual\.key \* 7919;/u);
	assert.match(
		source,
		/useMemo\(\(\) => createInkMaskImage\(inkMaskSeed\), \[inkMaskSeed\]\)/u,
	);
	assert.match(source, /feTurbulence/u);
	assert.match(source, /feDisplacementMap/u);
	assert.match(source, /feGaussianBlur/u);
	assert.match(source, /const originX = \(width \* visual\.origin\.xPercent\) \/ 100;/u);
	assert.match(source, /const originY = \(height \* visual\.origin\.yPercent\) \/ 100;/u);
	assert.match(source, /return `\$\{originX - offset\}px \$\{originY - offset\}px`;/u);
	assert.match(source, /const targetRadius = isExitPhase \? 0 : revealRadius;/u);
	assert.match(source, /if \(shouldReduceMotion\) \{\s*radius\.set\(targetRadius\);/u);
	assert.match(source, /MASK_FEATHER_PX/u);
	assert.match(source, /maskPosition,/u);
	assert.match(source, /maskSize,/u);
	assert.match(source, /maskImage: inkMaskImage/u);
	assert.equal((source.match(/\bmaskImage:/gu) ?? []).length, 1);
	assert.match(source, /maskMode: "alpha"/u);
	assert.match(source, /DEFAULT_GALLERY_PALETTE/u);
	assert.match(source, /palette = DEFAULT_GALLERY_PALETTE/u);
	assert.match(source, /LiquidGradient/u);
	assert.match(source, /highlightTextRef/u);
	assert.match(source, /text-text-inverse/u);
});

test("Gallery keeps the WebGL shader timeline continuous during selection exit", () => {
	const source = readProjectFile("components/blocks/gallery/components/gallery-selected-surface.tsx");
	const gallerySource = readProjectFile("components/blocks/gallery/components/gallery.tsx");
	const selectionSource = readProjectFile("components/blocks/gallery/lib/gallery-selection.ts");
	assert.doesNotMatch(source, /speed=\{visual\.phase/u);
	assert.match(source, /speed=\{shaderParameters\.speed\}/u);
	assert.doesNotMatch(source, /colors=\{\[\.\.\.palette\]\}/u);
	assert.match(source, /colors=\{palette\}/u);
	assert.doesNotMatch(source, /const DUR_EXIT = 0\.1/u);
	assert.match(selectionSource, /GALLERY_SELECTION_SHADER_EXIT_SECONDS = 0\.6;/u);
	assert.match(
		selectionSource,
		/GALLERY_SELECTION_SHADER_EXIT_OVERLAP_MS =\s*GALLERY_SELECTION_SHADER_EXIT_SECONDS \* 1000 \+ 40;/u,
	);
	assert.match(source, /GALLERY_SELECTION_SHADER_EXIT_SECONDS/u);
	assert.match(gallerySource, /GALLERY_SELECTION_SHADER_EXIT_OVERLAP_MS/u);
	assert.doesNotMatch(gallerySource, /EXIT_OVERLAP_MS = 140/u);
});

test("Gallery rolls bounded shader parameters for every selection visual", () => {
	const source = readProjectFile("components/blocks/gallery/components/gallery-selected-surface.tsx");
	const cardSource = readProjectFile("components/blocks/gallery/components/gallery-card.tsx");

	assert.match(source, /const GALLERY_SHADER_PARAMETER_RANGES = \{/u);
	assert.match(
		source,
		/function createGalleryShaderParameters\(random: \(\) => number = Math\.random\)/u,
	);
	assert.match(source, /const \[shaderParameters\] = useState\(createGalleryShaderParameters\);/u);
	assert.match(cardSource, /<GallerySelectedSurface[\s\S]*key=\{selectionVisual\.key\}/u);
	for (const parameter of [
		"seed",
		"speed",
		"scale",
		"turbAmp",
		"turbFreq",
		"turbIter",
		"waveFreq",
		"distBias",
	]) {
		assert.match(source, new RegExp(`${parameter}=\\{shaderParameters\\.${parameter}\\}`, "u"));
	}
	assert.doesNotMatch(source, /seed=\{seed\}[\s\S]*speed=\{0\.18\}/u);
});

test("Gallery drag scroll cancels stale pending presses", () => {
	const hookSource = readProjectFile("components/blocks/gallery/hooks/use-drag-scroll.ts");
	const trackSource = readProjectFile("components/blocks/gallery/components/gallery-track.tsx");
	assert.match(hookSource, /event\.buttons & 1/u);
	assert.match(hookSource, /onPointerLeave/u);
	assert.match(hookSource, /onLostPointerCapture/u);
	assert.match(trackSource, /onLostPointerCapture/u);
});

test("Gallery backdrop layers masked surface veils over a progressive page blur", () => {
	const source = readProjectFile("components/blocks/gallery/components/gallery-backdrop.tsx");
	assert.match(source, /WebkitMaskImage/u);
	// The white veil now sits over a progressive backdrop-filter blur reused from the
	// shared ScrollMask blur builder, so underlying page content blurs toward the dock.
	assert.match(source, /buildScrollMaskBlurLayerStyles\("bottom"\)/u);
	// The blur must stay OUT of the veil's opacity fade — an ancestor opacity isolates
	// backdrop-filter — so only the veil layers carry the fade variant.
	assert.match(source, /variants=\{shouldReduceMotion \? BACKDROP_REDUCED : BACKDROP\}/u);
	// The blur itself must resolve to zero during the dock exit. Keeping the blur
	// static until AnimatePresence unmounts the strip makes it disappear in one frame.
	assert.match(source, /const BLUR_NONE = "blur\(0px\)";/u);
	assert.match(source, /exit:\s*\{\s*backdropFilter: BLUR_NONE,/u);
	assert.match(
		source,
		/BOTTOM_BLUR_LAYERS\.map\([\s\S]*?<motion\.div[\s\S]*?variants=\{shouldReduceMotion \? reducedVariants : variants\}/u,
	);
	assert.match(source, /pointer-events-none/u);
});

test("Gallery demo swaps middle content in place", () => {
	const source = readProjectFile("components/blocks/gallery/page.tsx");
	assert.match(source, /renderSelectedItem/u);
	assert.match(source, /\{item\.title\}/u);
	assert.doesNotMatch(source, /article/u);
	assert.doesNotMatch(source, /Placeholder middle-page content/u);
	assert.doesNotMatch(source, /Click any card to morph it into a centered detail view/u);
});

test("Gallery controls expose state-aware tooltips and reset the selected prototype", () => {
	const gallerySource = readProjectFile("components/blocks/gallery/components/gallery.tsx");
	const stageSource = readProjectFile("components/blocks/gallery/components/gallery-selected-stage.tsx");
	const toggleSource = readProjectFile("components/blocks/gallery/components/gallery-toggle.tsx");

	assert.match(gallerySource, /setResetKey\(\(current\) => current \+ 1\)/u);
	assert.match(gallerySource, /onReset\?\.\(selectedItem\)/u);
	assert.match(stageSource, /key=\{`\$\{item\.id\}:\$\{resetKey\}`\}/u);
	assert.match(toggleSource, /<TooltipContent side="bottom">Reset<\/TooltipContent>/u);
	assert.match(toggleSource, /<TooltipContent side="bottom">\{themeLabel\}<\/TooltipContent>/u);
	assert.match(toggleSource, /<TooltipContent side="bottom">\{galleryToggleLabel\}<\/TooltipContent>/u);
	assert.match(toggleSource, /open \? "Close gallery" : "Open gallery"/u);
	assert.doesNotMatch(toggleSource, /window\.location\.reload/u);
});

test("Gallery theme control supports a route-owned theme without replacing its global default", () => {
	const gallerySource = readProjectFile("components/blocks/gallery/components/gallery.tsx");
	const toggleSource = readProjectFile("components/blocks/gallery/components/gallery-toggle.tsx");

	assert.match(gallerySource, /theme\?: GalleryTheme;/u);
	assert.match(gallerySource, /onThemeCycle\?: \(\) => void;/u);
	assert.match(gallerySource, /theme=\{theme\}/u);
	assert.match(gallerySource, /onThemeCycle=\{onThemeCycle\}/u);
	assert.match(toggleSource, /const theme = controlledTheme \?\? globalTheme;/u);
	assert.match(toggleSource, /const handleThemeCycle = onThemeCycle \?\? \(\(\) => setTheme\(getNextTheme\(theme\)\)\);/u);
	assert.match(toggleSource, /onClick=\{handleThemeCycle\}/u);
});

test("Gallery controls reserve an in-flow row with compact button geometry", () => {
	const gallerySource = readProjectFile("components/blocks/gallery/components/gallery.tsx");
	const toggleSource = readProjectFile("components/blocks/gallery/components/gallery-toggle.tsx");
	const toggleIndex = gallerySource.indexOf("<GalleryToggle");
	const stageIndex = gallerySource.indexOf("<GallerySelectedStage");

	assert.ok(toggleIndex >= 0 && toggleIndex < stageIndex);
	assert.match(toggleSource, /const TOGGLE_SIZE = 24;/u);
	assert.match(toggleSource, /grid h-12 grid-cols-\[minmax\(0,1fr\)_auto_minmax\(0,1fr\)\] items-center gap-4 p-3/u);
	assert.match(toggleSource, /<Heading size="xsmall" className="truncate justify-self-start">/u);
	assert.match(toggleSource, /min-w-0 justify-self-center/u);
	assert.match(toggleSource, /flex shrink-0 items-center gap-1 justify-self-end/u);
	assert.match(gallerySource, /title = "Gallery"/u);
	assert.match(gallerySource, /topBarCenter\?: ReactNode/u);
	assert.match(gallerySource, /topBarCenterCompact\?: ReactNode/u);
	assert.match(gallerySource, /centerContent=\{topBarCenter\}/u);
	assert.match(gallerySource, /compactCenterContent=\{topBarCenterCompact\}/u);
	assert.match(gallerySource, /showTopBarBorder = false/u);
	assert.match(gallerySource, /showBottomBorder=\{showTopBarBorder\}/u);
	assert.match(toggleSource, /showBottomBorder \? "border-b border-border" : null/u);
	assert.match(toggleSource, /GALLERY_CONTROL_ICON_CLASS_NAME = "size-3/u);
	assert.doesNotMatch(toggleSource, /fixed top-4 right-4/u);
	assert.doesNotMatch(toggleSource, /boxShadow|elevation\.shadow/u);
});

test("Gallery swaps a section group for compact controls on smaller viewports", () => {
	const demoSource = readProjectFile("components/blocks/gallery/page.tsx");
	const toggleSource = readProjectFile("components/blocks/gallery/components/gallery-toggle.tsx");

	assert.match(demoSource, /topBarCenter=\{<DemoSectionControls/u);
	assert.match(demoSource, /topBarCenterCompact=/u);
	assert.match(demoSource, /activeSection === sectionIndex \? sectionLabel\(index\) : section\.label/u);
	assert.match(demoSource, /if \(section\.count === 1\) return section\.label;/u);
	assert.doesNotMatch(demoSource, /DEMO_STEPS/u);
	assert.match(toggleSource, /className="hidden lg:block"/u);
	assert.match(toggleSource, /className="lg:hidden"/u);
});
