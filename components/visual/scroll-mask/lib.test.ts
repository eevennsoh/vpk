import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

// @ts-expect-error Node's strip-types test runner requires the explicit .ts extension here.
import { buildHorizontalScrollMaskStyle, buildScrollMaskBlurLayerStyles, buildScrollMaskOverlayStyle, buildScrollMaskStyle, resolveFadeSize } from "./lib.ts";
import { createRequire } from "node:module";

const requireRegistrySource = createRequire(import.meta.url);
const { readWebsiteRegistrySource } = requireRegistrySource(process.cwd() + "/components/website/registry/test-source.cjs");
const ROOT = process.cwd();
const SCROLL_MASK_SOURCE = readWorkspaceFile("components/visual/scroll-mask/index.tsx");

function readWorkspaceFile(filePath: string): string {
	return fs.readFileSync(path.join(ROOT, filePath), "utf8");
}

test("buildScrollMaskStyle preserves the scrollbar gutter as an opaque mask track", () => {
	const style = buildScrollMaskStyle();

	assert.equal(style["--scroll-mask-fade-size"], "var(--ds-space-400)");
	assert.equal(style["--scroll-mask-scrollbar-width"], "10px");
	assert.equal(
		style.maskImage,
		"linear-gradient(to bottom, transparent 0, black var(--scroll-mask-fade-size), black calc(100% - var(--scroll-mask-fade-size)), transparent 100%), linear-gradient(black, black)",
	);
	assert.equal(style.WebkitMaskImage, style.maskImage);
	assert.equal(style.maskRepeat, "no-repeat, no-repeat");
	assert.equal(style.WebkitMaskRepeat, "no-repeat, no-repeat");
	assert.equal(style.maskPosition, "0 0, 100% 0");
	assert.equal(style.WebkitMaskPosition, "0 0, 100% 0");
	assert.equal(style.maskSize, "calc(100% - 10px) 100%, 10px 100%");
	assert.equal(style.WebkitMaskSize, "calc(100% - 10px) 100%, 10px 100%");
});

test("buildScrollMaskStyle resolves numeric fade and scrollbar values to pixels", () => {
	const style = buildScrollMaskStyle({ fadeSize: 24, scrollbarWidth: 12 });

	assert.equal(style["--scroll-mask-fade-size"], "24px");
	assert.equal(style["--scroll-mask-scrollbar-width"], "12px");
	assert.equal(style.maskSize, "calc(100% - 12px) 100%, 12px 100%");
});

test("buildScrollMaskStyle can fade the full width without reserving a scrollbar track", () => {
	const style = buildScrollMaskStyle({ fadeSize: 48, scrollbarWidth: 0 });

	assert.equal(style["--scroll-mask-scrollbar-width"], "0px");
	assert.equal(
		style.maskImage,
		"linear-gradient(to bottom, transparent 0, black var(--scroll-mask-fade-size), black calc(100% - var(--scroll-mask-fade-size)), transparent 100%)",
	);
	assert.equal(style.WebkitMaskImage, style.maskImage);
	assert.equal(style.maskPosition, "0 0");
	assert.equal(style.maskRepeat, "no-repeat");
	assert.equal(style.maskSize, "100% 100%");
});

test("buildHorizontalScrollMaskStyle can fade before an opaque trailing gutter", () => {
	const style = buildHorizontalScrollMaskStyle({ edge: "end", endGutterWidth: 24, fadeSize: 20 });

	assert.equal(style["--scroll-mask-fade-size"], "20px");
	assert.equal(style["--scroll-mask-end-gutter-width"], "24px");
	assert.equal(
		style.maskImage,
		"linear-gradient(to right, black 0, black calc(100% - var(--scroll-mask-fade-size)), transparent 100%), linear-gradient(black, black)",
	);
	assert.equal(style.WebkitMaskImage, style.maskImage);
	assert.equal(style.maskPosition, "0 0, 100% 0");
	assert.equal(style.WebkitMaskPosition, "0 0, 100% 0");
	assert.equal(style.maskRepeat, "no-repeat, no-repeat");
	assert.equal(style.WebkitMaskRepeat, "no-repeat, no-repeat");
	assert.equal(style.maskSize, "calc(100% - 24px) 100%, 24px 100%");
	assert.equal(style.WebkitMaskSize, "calc(100% - 24px) 100%, 24px 100%");
});

test("buildHorizontalScrollMaskStyle can fade the trailing edge without a gutter", () => {
	const style = buildHorizontalScrollMaskStyle({ edge: "end", fadeSize: 20 });

	assert.equal(style["--scroll-mask-fade-size"], "20px");
	assert.equal(style["--scroll-mask-end-gutter-width"], undefined);
	assert.equal(
		style.maskImage,
		"linear-gradient(to right, black 0, black calc(100% - var(--scroll-mask-fade-size)), transparent 100%)",
	);
	assert.equal(style.maskRepeat, "no-repeat");
	assert.equal(style.maskSize, "100% 100%");
});

test("buildScrollMaskBlurLayerStyles stacks feathered backdrop-blur layers per edge", () => {
	const top = buildScrollMaskBlurLayerStyles("top");
	const bottom = buildScrollMaskBlurLayerStyles("bottom");

	assert.equal(top.length, 5);
	assert.equal(bottom.length, 5);

	// Each layer is an absolutely-positioned overlay whose backdrop blur and CSS mask match.
	for (const layer of top) {
		assert.equal(layer.position, "absolute");
		assert.equal(layer.inset, 0);
		assert.equal(layer.backdropFilter, layer.WebkitBackdropFilter);
		assert.equal(layer.maskImage, layer.WebkitMaskImage);
	}

	// Blur ramps up toward the edge and the mask band narrows so layers compound at the edge.
	assert.equal(top[0].backdropFilter, "blur(0.5px)");
	assert.equal(top[4].backdropFilter, "blur(6px)");
	assert.equal(top[0].maskImage, "linear-gradient(to bottom, #000 0%, #000 68%, transparent 100%)");
	assert.equal(top[4].maskImage, "linear-gradient(to bottom, #000 0%, #000 10%, transparent 26%)");

	// The bottom edge mirrors the gradient direction.
	assert.equal(bottom[4].maskImage, "linear-gradient(to top, #000 0%, #000 10%, transparent 26%)");
});

test("sticky row fades reuse the standard surface fade without progressive blur", () => {
	assert.match(SCROLL_MASK_SOURCE, /export function StickyRowScrollFade/u);
	assert.match(
		SCROLL_MASK_SOURCE,
		/bg-linear-to-b from-surface-overlay to-transparent/u,
	);
	const stickyFadeStart = SCROLL_MASK_SOURCE.indexOf("export function StickyRowScrollFade");
	const stickyFadeEnd = SCROLL_MASK_SOURCE.indexOf("export function ScrollMask", stickyFadeStart);
	assert.notEqual(stickyFadeStart, -1);
	assert.notEqual(stickyFadeEnd, -1);
	const stickyFadeSource = SCROLL_MASK_SOURCE.slice(stickyFadeStart, stickyFadeEnd);
	assert.doesNotMatch(stickyFadeSource, /TOP_BLUR_LAYERS/u);
	assert.doesNotMatch(stickyFadeSource, /backdropFilter|WebkitBackdropFilter/u);
});

test("buildScrollMaskBlurLayerStyles rotates the same ramp onto horizontal edges", () => {
	const left = buildScrollMaskBlurLayerStyles("left");
	const right = buildScrollMaskBlurLayerStyles("right");

	assert.equal(left.length, 5);
	assert.equal(right.length, 5);

	// Horizontal edges reuse the identical blur ramp; only the gradient axis changes.
	assert.equal(left[0].backdropFilter, "blur(0.5px)");
	assert.equal(left[4].backdropFilter, "blur(6px)");
	assert.equal(left[0].maskImage, "linear-gradient(to right, #000 0%, #000 68%, transparent 100%)");
	assert.equal(left[4].maskImage, "linear-gradient(to right, #000 0%, #000 10%, transparent 26%)");

	// The right edge mirrors the gradient direction (toward the leading interior).
	assert.equal(right[4].maskImage, "linear-gradient(to left, #000 0%, #000 10%, transparent 26%)");
});

test("resolveFadeSize coerces numbers to pixels and defaults to the fade-size token", () => {
	assert.equal(resolveFadeSize(), "var(--ds-space-400)");
	assert.equal(resolveFadeSize(24), "24px");
	assert.equal(resolveFadeSize("2rem"), "2rem");
});

test("ScrollMask renders opt-in progressive blur overlays behind a pinned region", () => {
	assert.match(SCROLL_MASK_SOURCE, /edgeBlur = false/);
	assert.match(SCROLL_MASK_SOURCE, /data-slot="scroll-mask-blur"/);
	assert.match(SCROLL_MASK_SOURCE, /data-edge="top"[\s\S]*data-edge="bottom"/);
});

test("ScrollMask gates the edge fade and blur on real scroll overflow state", () => {
	// The mask fades and the blur overlays only render for edges with content scrolled past them.
	assert.match(SCROLL_MASK_SOURCE, /useHasVerticalOverflow/);
	assert.match(SCROLL_MASK_SOURCE, /fadeTop: showTopScrollMask/);
	assert.match(SCROLL_MASK_SOURCE, /fadeBottom: showBottomScrollMask/);
	assert.match(SCROLL_MASK_SOURCE, /edgeBlur && showTopScrollMask/);
	assert.match(SCROLL_MASK_SOURCE, /edgeBlur && showBottomScrollMask/);
});

test("buildScrollMaskStyle fades only the edges with content scrolled past them", () => {
	const topOnly = buildScrollMaskStyle({ fadeTop: true, fadeBottom: false });
	assert.equal(
		topOnly.maskImage,
		"linear-gradient(to bottom, transparent 0, black var(--scroll-mask-fade-size), black 100%), linear-gradient(black, black)",
	);

	const bottomOnly = buildScrollMaskStyle({ fadeTop: false, fadeBottom: true });
	assert.equal(
		bottomOnly.maskImage,
		"linear-gradient(to bottom, black 0, black calc(100% - var(--scroll-mask-fade-size)), transparent 100%), linear-gradient(black, black)",
	);

	// Fitting content should not have a mask or its extra stacking context.
	const none = buildScrollMaskStyle({ fadeTop: false, fadeBottom: false });
	assert.equal(none.maskImage, "none");
	assert.equal(none.WebkitMaskImage, "none");
});

test("buildScrollMaskOverlayStyle fades visually without clipping hit-testing", () => {
	const top = buildScrollMaskOverlayStyle({ edge: "top", fadeSize: "3rem" });
	assert.equal(top["--scroll-mask-fade-size"], "3rem");
	assert.equal(top.height, "3rem");
	assert.equal(top.pointerEvents, "none");
	assert.equal(
		top.backgroundImage,
		"linear-gradient(to bottom, var(--color-surface) 0, transparent 100%)",
	);

	const bottom = buildScrollMaskOverlayStyle({ edge: "bottom" });
	assert.equal(bottom.pointerEvents, "none");
	assert.equal(
		bottom.backgroundImage,
		"linear-gradient(to top, var(--color-surface) 0, transparent 100%)",
	);
});

test("buildScrollMaskOverlayStyle rotates the visual fade onto horizontal edges", () => {
	const left = buildScrollMaskOverlayStyle({ edge: "left", fadeSize: "3rem" });
	assert.equal(left.width, "3rem");
	assert.equal(left.height, undefined);
	assert.equal(
		left.backgroundImage,
		"linear-gradient(to right, var(--color-surface) 0, transparent 100%)",
	);

	const right = buildScrollMaskOverlayStyle({ edge: "right" });
	assert.equal(right.width, "var(--ds-space-400)");
	assert.equal(right.height, undefined);
	assert.equal(
		right.backgroundImage,
		"linear-gradient(to left, var(--color-surface) 0, transparent 100%)",
	);
});

test("buildScrollMaskOverlayStyle can fade into a parent backdrop other than surface", () => {
	const color = "var(--color-bg-accent-gray-subtlest)";
	const top = buildScrollMaskOverlayStyle({ color, edge: "top", fadeSize: "3rem" });
	assert.equal(
		top.backgroundImage,
		"linear-gradient(to bottom, var(--color-bg-accent-gray-subtlest) 0, transparent 100%)",
	);
	const bottom = buildScrollMaskOverlayStyle({ color, edge: "bottom" });
	assert.equal(
		bottom.backgroundImage,
		"linear-gradient(to top, var(--color-bg-accent-gray-subtlest) 0, transparent 100%)",
	);
});

test("ScrollMaskEdgeOverlay is a pointer-events-none band gated by the caller", () => {
	assert.match(SCROLL_MASK_SOURCE, /export function ScrollMaskEdgeOverlay/u);
	assert.match(SCROLL_MASK_SOURCE, /data-scroll-mask-overlay=\{edge\}/u);
	assert.match(SCROLL_MASK_SOURCE, /const isHorizontal = edge === "left" \|\| edge === "right"/u);
	assert.match(SCROLL_MASK_SOURCE, /isHorizontal \? "inset-y-0" : "inset-x-0"/u);
	assert.match(SCROLL_MASK_SOURCE, /buildScrollMaskOverlayStyle\(\{ color, edge, fadeSize \}\)/u);
});

test("Scroll Mask is wired into the Visual catalog route and demo registry", () => {
	assert.match(
		readWorkspaceFile("app/data/components.ts"),
		/visualComponent\("scroll-mask", "Scroll Mask", "@\/components\/visual\/scroll-mask"\)/,
	);
	assert.match(
		readWorkspaceFile("app/data/component-manifest.ts"),
		/visualComponent\("scroll-mask", "Scroll Mask", "@\/components\/visual\/scroll-mask"\)/,
	);
	assert.match(
		readWorkspaceFile("app/data/details/visual.ts"),
		/import \{ SCROLL_MASK_DETAIL \} from "\.\/visual\/scroll-mask";[\s\S]*"scroll-mask": SCROLL_MASK_DETAIL,/,
	);
	assert.match(
		readWorkspaceFile("app/data/details/visual/scroll-mask.ts"),
		/import \{ ScrollMask \} from "@\/components\/visual\/scroll-mask";/,
	);
	assert.match(
		readWebsiteRegistrySource(),
		/"scroll-mask": dynamic\(\(\) => import\("\.\/demos\/visual\/scroll-mask-demo"\)/,
	);
});

test("ScrollMask bars stay unbordered so the mask owns the header and footer edge", () => {
	assert.doesNotMatch(SCROLL_MASK_SOURCE, /border-b border-border/);
	assert.doesNotMatch(SCROLL_MASK_SOURCE, /border-t border-border/);
	assert.match(
		SCROLL_MASK_SOURCE,
		/data-slot="scroll-mask-header"[\s\S]*data-slot="scroll-mask-viewport"[\s\S]*data-slot="scroll-mask-footer"/,
	);
	assert.match(SCROLL_MASK_SOURCE, /"min-h-0 flex-1 overflow-y-auto/);
});
