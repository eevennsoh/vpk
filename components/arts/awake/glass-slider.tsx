"use client";

// oxlint-disable react-doctor/no-derived-state -- These components maintain local derived display state for controlled animations, measurements, or draft editing that cannot be represented as render-only values without changing UX.

// oxlint-disable react-doctor/no-event-handler -- Effects in this file bridge external systems, animation/media state, timers, or parent-controlled state rather than user event handlers.

// Vertical port of chanhdai's Elastic Slider (https://chanhdai.com/components/elastic-slider)
// Original: @ncdai — horizontal slider with rubber-band drag & magnetic snap.
// This version flips to vertical: drag up = increase, fill grows from bottom.

import {
	animate,
	motion,
	useMotionValue,
	useMotionValueEvent,
	useReducedMotion,
	useTransform,
} from "motion/react";
import {
	Fragment,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { CSSProperties } from "react";

import {
	formatCornerShapeSuperellipse,
	SQUIRCLE_DEFAULT_SMOOTHNESS,
} from "@/components/website/demos/visual/shaders/squircle-shape";
import LiquidGlass, {
	type LiquidGlassProps,
} from "@/components/website/demos/visual/shaders/liquid-glass";
import { cn } from "@/lib/utils";
import { clamp } from "@/lib/math";
import { ROVO_COLOR_SWATCHES } from "@/lib/rovo-colors";
import { useControllableState } from "@/hooks/use-controllable-state";

// Linear gradient for the selected/hovered tick mark on the elastic slider.
// Uses the 4 Rovo brand colors with hard stops at 25/50/75% so each color
// renders as a solid band (no blending between stops).
// Order: blue-600 → orange-300 → purple-500 → lime-400.
//
// IMPORTANT: We use the literal `hex` values (not the `cssVar`) so the
// rainbow stays identical in BOTH light and dark themes. The CSS variables
// (`--color-blue-600`, etc.) point at `--ds-*` tokens that flip in dark
// mode, which would shift the gradient. The hex values match the canonical
// "light mode" Rovo brand colors and are theme-agnostic.
const ROVO_TICK_GRADIENT = `linear-gradient(90deg, ${ROVO_COLOR_SWATCHES[0].hex} 0%, ${ROVO_COLOR_SWATCHES[0].hex} 25%, ${ROVO_COLOR_SWATCHES[1].hex} 25%, ${ROVO_COLOR_SWATCHES[1].hex} 50%, ${ROVO_COLOR_SWATCHES[2].hex} 50%, ${ROVO_COLOR_SWATCHES[2].hex} 75%, ${ROVO_COLOR_SWATCHES[3].hex} 75%, ${ROVO_COLOR_SWATCHES[3].hex} 100%)`;

const CLICK_THRESHOLD = 3;
const DEAD_ZONE = 16;
const MAX_CURSOR_RANGE = 200;
const MAX_STRETCH = 24;
// Maximum width-thinning at full stretch (e.g. 0.18 → track narrows to 82%).
const MAX_THIN_RATIO = 0.18;
// Maximum vertical "magnet" stretch (in px) when the cursor hovers INSIDE
// the track. Pulls the track toward the cursor as if the surface were
// elastic. Tuned to feel like a strong rubber pull while still leaving
// headroom for past-edge overshoot (`MAX_STRETCH`) to read as "stronger".
const MAX_HOVER_STRETCH = 32;

const HANDLE_BUFFER = 8;
const DEFAULT_GLASS_SHELL_PROPS: Partial<LiquidGlassProps> = {
	borderRadius: 9999,
	borderWidth: 0,
	brightness: 50,
	opacity: 0.93,
	blur: 8,
	backgroundOpacity: 0.2,
	saturation: 1,
	distortionScale: -90,
	dispersion: 6,
	borderOpacity: 1,
	borderColor: "var(--elastic-slider-border)",
};

const GLASS_SLIDER_FOCUS_RING_BOX_SHADOW =
	"0 0 0 3px color-mix(in srgb, var(--ds-border-focused) 24%, transparent)";
const GLASS_SLIDER_TICK_EMBOSS_BOX_SHADOW =
	"inset 0 1px 0 color-mix(in srgb, var(--ds-text-inverse) 40%, transparent), inset 0 -1px 0 color-mix(in srgb, var(--ds-text) 22%, transparent), 0 1px 2px color-mix(in srgb, var(--ds-text) 12%, transparent)";

// Liquid-glass props for the PROGRESS FILL itself. These are intentionally
// softer than the shell so that, when the slider is wrapped in a
// `shell="liquid-glass"` surface, the inner fill reads as a lighter "inner
// lens" sitting inside the outer glass rather than doubling up the shell's
// chromatic aberration. Tuned so the meniscus (boundary between filled and
// empty track) stays visually crisp.
//
// Exported so demos / playgrounds can spread the defaults and override
// individual values for live tuning without re-stating every key.
// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
export const DEFAULT_FILL_GLASS_PROPS: Partial<LiquidGlassProps> = {
	borderRadius: 9999,
	borderWidth: 0,
	brightness: 55,
	opacity: 0.85,
	blur: 6,
	backgroundOpacity: 0.18,
	saturation: 1.05,
	distortionScale: -60,
	dispersion: 4,
	borderOpacity: 0,
	dropShadow: false,
};

// Subtle Rovo brand tint that rides on top of the liquid-glass fill so the
// progress region picks up brand color without overpowering the refractive
// surface. Bottom→top vertical gradient using the canonical Rovo hex values
// (theme-agnostic, matching ROVO_TICK_GRADIENT). Alphas are intentionally
// low (~22% peak) so the underlying refraction still dominates.
//
// Exported as the default for the slider's `fillTintGradient` prop so demos
// can override it with custom CSS gradients.
export const DEFAULT_FILL_TINT_GRADIENT = `linear-gradient(0deg, ${ROVO_COLOR_SWATCHES[0].hex}38 0%, ${ROVO_COLOR_SWATCHES[1].hex}30 35%, ${ROVO_COLOR_SWATCHES[2].hex}30 70%, ${ROVO_COLOR_SWATCHES[3].hex}38 100%)`;

// The meniscus mask is composed from a curved fixed-height cap layer plus
// a rectangular body layer underneath. Without a tiny overlap, some dark-mode
// combinations reveal a faint horizontal seam where the two mask layers meet.
const MENISCUS_MASK_JOIN_OVERLAP_PX = 1;

// Build a `mask-image` CSS style object that crops the top of the fill
// element with a half-ellipse cap of the given pixel height and curvature
// (0 = flat, 1 = full half-ellipse). Returns `null` when either input
// collapses so callers can short-circuit by clearing the inline mask.
//
// Pulled out of the component body so the same builder is reused by both
// the static `useMemo` path AND the per-frame animation path that springs
// the meniscus shape between resting and hovered states.
function buildMeniscusMaskStyle(
	heightPx: number,
	curve: number,
): {
	maskImage: string;
	WebkitMaskImage: string;
	maskRepeat: string;
	WebkitMaskRepeat: string;
	maskPosition: string;
	WebkitMaskPosition: string;
	maskSize: string;
	WebkitMaskSize: string;
	maskComposite: string;
	WebkitMaskComposite: string;
} | null {
	const h = Math.max(0, heightPx);
	const c = Math.max(0, Math.min(1, curve));
	if (h <= 0 || c <= 0) return null;
	const capRy = c * 100;
	const path = `M 0 ${capRy} A 50 ${capRy} 0 0 1 100 ${capRy} L 100 100 L 0 100 Z`;
	const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><path d='${path}' fill='black'/></svg>`;
	const encoded = encodeURIComponent(svg)
		.replace(/'/g, "%27")
		.replace(/"/g, "%22");
	const url = `url("data:image/svg+xml;utf8,${encoded}")`;
	return {
		maskImage: `${url}, linear-gradient(black, black)`,
		WebkitMaskImage: `${url}, linear-gradient(black, black)`,
		maskRepeat: "no-repeat, no-repeat",
		WebkitMaskRepeat: "no-repeat, no-repeat",
		maskPosition: "top center, bottom center",
		WebkitMaskPosition: "top center, bottom center",
		maskSize: `100% ${h}px, 100% calc(100% - ${h}px + ${MENISCUS_MASK_JOIN_OVERLAP_PX}px)`,
		WebkitMaskSize: `100% ${h}px, 100% calc(100% - ${h}px + ${MENISCUS_MASK_JOIN_OVERLAP_PX}px)`,
		maskComposite: "add",
		WebkitMaskComposite: "source-over",
	};
}

function hoverStretchFromNorm(norm: number) {
	const DEAD = 0.1;
	const sign = Math.sign(norm);
	const mag = Math.max(0, Math.abs(norm) - DEAD) / (1 - DEAD);
	return -sign * MAX_HOVER_STRETCH * Math.sqrt(mag);
}

function computeHoverStretchFromPercent(percent: number) {
	return hoverStretchFromNorm(clamp(percent / 50 - 1, -1, 1));
}

function roundValue(val: number, step: number): number {
	const raw = Math.round(val / step) * step;
	const s = step.toString();
	const dot = s.indexOf(".");
	const decimals = dot === -1 ? 0 : s.length - dot - 1;
	return parseFloat(raw.toFixed(decimals));
}

export interface GlassSliderProps {
	label?: string;
	value?: number;
	defaultValue?: number;
	onValueChange?: (value: number) => void;
	min?: number;
	max?: number;
	step?: number;
	formatValue?: (value: number) => string;
	className?: string;
	trackClassName?: string;
	trackStyle?: CSSProperties;
	trackShape?: "squircle" | "none";
	shell?: "none" | "liquid-glass";
	shellProps?: Partial<LiquidGlassProps>;
	/**
	 * Override the LiquidGlass props applied to the PROGRESS FILL (the
	 * inner liquid-glass region that grows from the bottom of the track).
	 * Spread on top of `DEFAULT_FILL_GLASS_PROPS` so callers only need to
	 * specify the values they want to change.
	 *
	 * Useful for live-tuning playgrounds — pass a partial that overrides
	 * `distortionScale`, `dispersion`, `blur`, `backgroundOpacity`, etc.
	 */
	fillGlassProps?: Partial<LiquidGlassProps>;
	/**
	 * Override the CSS gradient string layered ON TOP of the liquid-glass
	 * fill to give the progress region a brand tint. Defaults to a soft
	 * Rovo-color vertical gradient (`DEFAULT_FILL_TINT_GRADIENT`).
	 *
	 * Pass `"none"` (or any falsy value) to disable the tint entirely.
	 */
	fillTintGradient?: string;
	/**
	 * CSS `mix-blend-mode` applied to the tint overlay. Lets the tint
	 * interact with the underlying glass refraction:
	 *   - `"normal"` — opaque overlay (default)
	 *   - `"overlay"` / `"soft-light"` — picks up the refracted color
	 *   - `"screen"` — brightens
	 *   - `"multiply"` — darkens
	 */
	fillTintBlendMode?: React.CSSProperties["mixBlendMode"];
	/**
	 * Height (in pixels) of the curved meniscus cap that sits on top of
	 * the rectangular progress fill. The cap is rendered via an SVG
	 * `mask-image` so the LiquidGlass refraction continues smoothly
	 * across the curve. Set to `0` for a flat (square-cut) meniscus.
	 *
	 * @default 12
	 */
	fillMeniscusHeightPx?: number;
	/**
	 * Curvature of the meniscus cap, 0 = perfectly flat (no cap), 1 =
	 * full half-ellipse (maximally convex). Values in between produce
	 * a shallow convex arc.
	 *
	 * @default 0.7
	 */
	fillMeniscusCurve?: number;
	/**
	 * Optional "active" meniscus height (in pixels) the cap springs to
	 * when the slider is hovered or interacted with. Defaults to
	 * `fillMeniscusHeightPx * 1.6` — the cap deepens to feel responsive
	 * to attention. Falsy / undefined disables the active variant and
	 * keeps the meniscus at its resting height.
	 */
	fillMeniscusHeightPxActive?: number;
	/**
	 * Optional "active" meniscus curve (0–1) the cap springs to when
	 * the slider is hovered or interacted with. Defaults to `1` (a
	 * full half-ellipse) so the meniscus rounds out under attention.
	 */
	fillMeniscusCurveActive?: number;
	/**
	 * Optional labels (one per hash-mark tick, ordered low→high).
	 * When provided, the corresponding hash marks and their labels are
	 * always visible (independent of hover/interaction state).
	 */
	tickLabels?: ReadonlyArray<string>;
	/**
	 * When `true`, hover-to-select is disabled and the slider stays on its
	 * current value until the user explicitly changes it (drag, keyboard,
	 * or external value change). Hover still triggers the rubber-band /
	 * scaleY morph so the visual response is preserved.
	 */
	pinned?: boolean;
	/**
	 * Fires only on EXPLICIT commits — click on the track / tick, drag end,
	 * or keyboard navigation. Does NOT fire on pure hover (which only
	 * updates the previewed value via `onValueChange`). Use this to drive
	 * "pin" or "confirm selection" semantics that should require a
	 * deliberate user action.
	 */
	onCommit?: (value: number) => void;
	/**
	 * Fires whenever the hovered tick index changes during pure pointer
	 * hover (including when `pinned` is true). Use this to trigger sound
	 * or other feedback that should still respond to hover even when
	 * hover-to-select is disabled.
	 *
	 * Called with `null` when the cursor leaves the track.
	 */
	onHoverTickChange?: (index: number | null) => void;
	"aria-label"?: string;
	/**
	 * Fires whenever any of the slider's shape-affecting transforms change
	 * (rubber-band overshoot, hover-magnet, or active scale-up). Returns
	 * the CURRENT pixel offset of each outer edge from its resting
	 * position:
	 *   • `topOffsetPx`    — negative when the top edge has moved UP
	 *   • `bottomOffsetPx` — positive when the bottom edge has moved DOWN
	 *
	 * Use this to keep external chrome (e.g. floating buttons anchored to
	 * the slider's top or bottom edge) glued to the deformed track edges
	 * across every interaction state (hover, drag, overshoot, pinned).
	 */
	onShapeChange?: (offsets: {
		topOffsetPx: number;
		bottomOffsetPx: number;
	}) => void;
	keyboardNavigationPulseKey?: number;
}

export function GlassSlider({
	label,
	value: valueProp,
	defaultValue,
	onValueChange,
	min = 0,
	max = 1,
	step = 1,
	formatValue,
	className,
	trackClassName,
	trackStyle,
	trackShape = "squircle",
	shell = "none",
	shellProps,
	fillGlassProps,
	fillTintGradient = DEFAULT_FILL_TINT_GRADIENT,
	fillTintBlendMode,
	fillMeniscusHeightPx = 14,
	fillMeniscusCurve = 0.55,
	fillMeniscusHeightPxActive,
	fillMeniscusCurveActive,
	tickLabels,
	pinned = false,
	onCommit,
	onHoverTickChange,
	"aria-label": ariaLabel,
	onShapeChange,
	keyboardNavigationPulseKey = 0,
}: GlassSliderProps) {
	const [value = min, setValue] = useControllableState({
		prop: valueProp,
		defaultProp: defaultValue ?? min,
		onChange: onValueChange,
	});

	const shouldReduceMotion = useReducedMotion();

	const wrapperRef = useRef<HTMLDivElement>(null);
	const trackRef = useRef<HTMLDivElement>(null);
	// ── Meniscus animation ───────────────────────────────────────────
	// The progress fill's meniscus (curved top edge) is rendered via a
	// CSS mask-image of an SVG ellipse. To get a buttery transition
	// between the resting and hovered cap shapes, we animate the cap's
	// HEIGHT and CURVATURE as separate motion values — and then write
	// the resulting `mask-*` CSS strings DIRECTLY to the fill element
	// via a ref on every motion-value change. This avoids a React
	// re-render per frame and keeps the animation on the compositor.
	//
	// Resolved targets: the active variants default to a deeper, more
	// rounded cap to feel responsive to attention. Callers can override
	// either with explicit values (or pass equal values to disable the
	// hover deepening entirely).
	const restMeniscusHeightPx = fillMeniscusHeightPx;
	const restMeniscusCurve = fillMeniscusCurve;
	const activeMeniscusHeightPx =
		fillMeniscusHeightPxActive ?? fillMeniscusHeightPx * 1.6;
	const activeMeniscusCurve = fillMeniscusCurveActive ?? 1;

	const meniscusHeightMV = useMotionValue(restMeniscusHeightPx);
	const meniscusCurveMV = useMotionValue(restMeniscusCurve);
	const fillElementRef = useRef<HTMLDivElement>(null);
	// Initial (resting) mask style — used so the fill renders correctly
	// on first paint, before any hover / animation has run.
	const initialMeniscusMask = useMemo(
		() => buildMeniscusMaskStyle(restMeniscusHeightPx, restMeniscusCurve),
		[restMeniscusHeightPx, restMeniscusCurve],
	);
	// Apply the latest motion values to the fill element on every
	// frame they change. Subscribed once; fires for either MV.
	const writeMeniscusMaskFromMVs = useCallback(() => {
		const el = fillElementRef.current;
		if (!el) return;
		const mask = buildMeniscusMaskStyle(meniscusHeightMV.get(), meniscusCurveMV.get());
		if (!mask) {
			el.style.maskImage = "";
			el.style.webkitMaskImage = "";
			return;
		}
		el.style.maskImage = mask.maskImage;
		el.style.webkitMaskImage = mask.WebkitMaskImage;
		el.style.maskRepeat = mask.maskRepeat;
		el.style.webkitMaskRepeat = mask.WebkitMaskRepeat;
		el.style.maskPosition = mask.maskPosition;
		el.style.webkitMaskPosition = mask.WebkitMaskPosition;
		el.style.maskSize = mask.maskSize;
		el.style.webkitMaskSize = mask.WebkitMaskSize;
		el.style.maskComposite = mask.maskComposite;
		el.style.webkitMaskComposite = mask.WebkitMaskComposite;
	}, [meniscusHeightMV, meniscusCurveMV]);
	useMotionValueEvent(meniscusHeightMV, "change", writeMeniscusMaskFromMVs);
	useMotionValueEvent(meniscusCurveMV, "change", writeMeniscusMaskFromMVs);
	const squircleTrackStyle = useMemo(
		() =>
			({
				borderRadius: 9999,
				cornerShape: formatCornerShapeSuperellipse(SQUIRCLE_DEFAULT_SMOOTHNESS),
			}) as CSSProperties & { cornerShape: string },
		[],
	);

	const [isInteracting, setIsInteracting] = useState(false);
	const [, setIsDragging] = useState(false);
	const [isHovered, setIsHovered] = useState(false);
	const [isKeyboardActive, setIsKeyboardActive] = useState(false);
	const [isFocusVisible, setIsFocusVisible] = useState(false);
	const skipControlledFillAnimationRef = useRef(false);
	const keyboardReleaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const keyboardActiveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
	const pendingPointerFocusRef = useRef(false);
	const isClickRef = useRef(true);
	const animRef = useRef<ReturnType<typeof animate> | null>(null);
	// Separate animation handle for the in-track hover-magnet stretch so it
	// can be stopped/cancelled independently from the fill animation when a
	// drag begins or the cursor leaves the track.
	const hoverStretchAnimRef = useRef<ReturnType<typeof animate> | null>(null);
	const wrapperRectRef = useRef<DOMRect | null>(null);
	const scaleRef = useRef(1);
	// Captured at pointerdown so drag can advance from the original handle
	// position by *delta* rather than jumping to wherever the cursor is.
	const valueAtPointerDownRef = useRef(0);
	const trackHeightAtPointerDownRef = useRef(0);

	// Tracks which tick row the cursor is currently over (for label hover
	// styling). `null` when not hovering any tick.
	const [hoveredTickIndex, setHoveredTickIndex] = useState<number | null>(null);

	// Percentage: 0 = min (bottom), 100 = max (top)
	const percentage = ((value - min) / (max - min)) * 100;
	const isActive = isInteracting || isHovered || isKeyboardActive;

	const fillPercent = useMotionValue(percentage);
	// Fill grows from bottom
	const fillHeight = useTransform(fillPercent, (pct) => `${pct}%`);
	// Handle positioned from bottom
	const handleBottom = useTransform(
		fillPercent,
		(pct) => `max(4px, calc(${pct}% - 8px))`,
	);

	// Rubber band: stretches track height and shifts it so the anchor edge
	// (opposite to the overshoot direction) stays put while the other edge
	// extends past the wrapper.
	//   • s < 0 → overshoot at top    → shift up   so bottom stays anchored
	//   • s > 0 → overshoot at bottom → shift down so top    stays anchored
	const rubberStretch = useMotionValue(0);
	const rubberHeight = useTransform(
		rubberStretch,
		(s) => `calc(100% + ${Math.abs(s)}px)`,
	);
	// Real rubber bands get thinner as you stretch them. Map the absolute
	// stretch (0 → MAX_STRETCH) to a width scale (1 → 1 - MAX_THIN_RATIO),
	// applied symmetrically on both "+" and "-" overshoot directions.
	const rubberScaleX = useTransform(rubberStretch, (s) => {
		const ratio = Math.min(Math.abs(s) / MAX_STRETCH, 1);
		return 1 - ratio * MAX_THIN_RATIO;
	});
	const rubberY = useTransform(rubberStretch, (s) => s);

	// Drive the active-state scaleY ourselves so we can both pass it to
	// the track AND publish edge offsets to external consumers (e.g.
	// floating buttons that need to stay glued to the deformed edges.
	// `useLayoutEffect` starts the reverse hover animation in the same
	// frame as mouseleave, avoiding a visible one-frame delay before the
	// slider begins settling back to rest.
	const activeScaleY = useMotionValue(1);
	useLayoutEffect(() => {
		const target = isActive ? 1.04 : 1;
		if (shouldReduceMotion) {
			activeScaleY.jump(target);
			return;
		}
		const controls = animate(activeScaleY, target, {
			type: "spring",
			stiffness: 260,
			damping: 18,
			mass: 0.6,
		});
		return () => {
			controls.stop();
		};
	}, [activeScaleY, isActive, shouldReduceMotion]);

	// Animate the meniscus cap between resting and active shapes
	// whenever `isActive` flips. Uses a slightly slower spring than the
	// scale-up so the meniscus reads as a soft "settling" of liquid
	// rather than an instantaneous snap. Keep this in `useLayoutEffect`
	// too so the reverse meniscus motion starts immediately on hover-out.
	useLayoutEffect(() => {
		const targetHeight = isActive ? activeMeniscusHeightPx : restMeniscusHeightPx;
		const targetCurve = isActive ? activeMeniscusCurve : restMeniscusCurve;
		if (shouldReduceMotion) {
			meniscusHeightMV.jump(targetHeight);
			meniscusCurveMV.jump(targetCurve);
			writeMeniscusMaskFromMVs();
			return;
		}
		const c1 = animate(meniscusHeightMV, targetHeight, {
			type: "spring",
			stiffness: 220,
			damping: 24,
			mass: 0.7,
		});
		const c2 = animate(meniscusCurveMV, targetCurve, {
			type: "spring",
			stiffness: 220,
			damping: 24,
			mass: 0.7,
		});
		return () => {
			c1.stop();
			c2.stop();
		};
	}, [
		isActive,
		activeMeniscusHeightPx,
		activeMeniscusCurve,
		restMeniscusHeightPx,
		restMeniscusCurve,
		meniscusHeightMV,
		meniscusCurveMV,
		shouldReduceMotion,
		writeMeniscusMaskFromMVs,
	]);

	// Forward combined shape changes (rubber-band overshoot + active
	// scale-up) to the parent so external chrome can follow the deformed
	// track edges across every interaction state.
	const computeShapeOffsets = useCallback(() => {
		if (!onShapeChange) return;
		const wrapper = wrapperRef.current;
			const stretch = rubberStretch.get();
			const scale = activeScaleY.get();
			// `scaleY` is applied with `transformOrigin: center center`,
			// so each edge moves outward by half the *additional* height.
			const restingHeight = wrapper?.offsetHeight ?? 0;
			const halfScaleGrowth = (restingHeight * (scale - 1)) / 2;
			// The track grows its height by `|s|` and then translates
			// the whole box by `y: s`. We treat the resulting deformation
			// symmetrically so both anchored buttons (top and bottom)
			// track the slider's shape consistently in EITHER direction:
			//   • TOP    edge moves by `−|s| / 2 + s` minus active growth
			//   • BOTTOM edge moves by `+|s| / 2 + s` plus  active growth
			// This means each icon follows the track edge nearest to it
			// for ANY rubber-band direction (top hover/drag and bottom
			// hover/drag both move both icons proportionally).
			const halfHeightGrowth = Math.abs(stretch) / 2;
			const topOffsetPx = stretch - halfHeightGrowth - halfScaleGrowth;
			const bottomOffsetPx = stretch + halfHeightGrowth + halfScaleGrowth;
			onShapeChange({ topOffsetPx, bottomOffsetPx });
	}, [activeScaleY, onShapeChange, rubberStretch]);
	useMotionValueEvent(rubberStretch, "change", computeShapeOffsets);
	useMotionValueEvent(activeScaleY, "change", computeShapeOffsets);

	// Convert clientY to a value. Up = higher value.
	const positionToValue = useCallback(
		(clientY: number) => {
			const rect = wrapperRectRef.current;
			if (!rect) return min;

			const sceneY = (clientY - rect.top) / scaleRef.current;
			const nativeHeight = wrapperRef.current?.offsetHeight ?? rect.height;
			// Invert: top of track = max, bottom = min
			const percent = 1 - clamp(sceneY / nativeHeight, 0, 1);

			return clamp(min + percent * (max - min), min, max);
		},
		[min, max],
	);

	const percentFromValue = useCallback(
		(v: number) => ((v - min) / (max - min)) * 100,
		[min, max],
	);

	const animateFillTo = useCallback(
		(targetPercent: number) => {
			animRef.current?.stop();

			if (shouldReduceMotion) {
				fillPercent.jump(targetPercent);
				animRef.current = null;
				return;
			}

			animRef.current = animate(fillPercent, targetPercent, {
				type: "spring",
				stiffness: 240,
				damping: 20,
				mass: 0.55,
				onComplete: () => {
					animRef.current = null;
				},
			});
		},
		[fillPercent, shouldReduceMotion],
	);

	const clearKeyboardPulseTimeouts = useCallback(() => {
		if (keyboardReleaseTimeoutRef.current !== null) {
			clearTimeout(keyboardReleaseTimeoutRef.current);
			keyboardReleaseTimeoutRef.current = null;
		}
		if (keyboardActiveTimeoutRef.current !== null) {
			clearTimeout(keyboardActiveTimeoutRef.current);
			keyboardActiveTimeoutRef.current = null;
		}
	}, []);

	const pulseKeyboardHover = useCallback(
		(targetPercent: number) => {
			if (isInteracting || isHovered) return;

			clearKeyboardPulseTimeouts();
			setIsKeyboardActive(true);

			if (shouldReduceMotion) {
				rubberStretch.jump(0);
				setIsKeyboardActive(false);
				return;
			}

			const targetStretch = computeHoverStretchFromPercent(targetPercent);
			hoverStretchAnimRef.current?.stop();
			hoverStretchAnimRef.current = animate(rubberStretch, targetStretch, {
				type: "spring",
				stiffness: 260,
				damping: 22,
				mass: 0.55,
			});

			keyboardReleaseTimeoutRef.current = setTimeout(() => {
				hoverStretchAnimRef.current?.stop();
				hoverStretchAnimRef.current = animate(rubberStretch, 0, {
					type: "spring",
					visualDuration: 0.6,
					bounce: 0.5,
				});
				keyboardReleaseTimeoutRef.current = null;
			}, 130);

			keyboardActiveTimeoutRef.current = setTimeout(() => {
				setIsKeyboardActive(false);
				keyboardActiveTimeoutRef.current = null;
			}, 280);
		},
		[
			clearKeyboardPulseTimeouts,
			isHovered,
			isInteracting,
			rubberStretch,
			shouldReduceMotion,
		],
	);

	useEffect(() => {
		return () => {
			clearKeyboardPulseTimeouts();
		};
	}, [clearKeyboardPulseTimeouts]);

	useEffect(() => {
		if (isInteracting) {
			return;
		}

		// Hover and drag already drive the fill motion directly from the
		// pointer path, so the controlled-value echo from `setValue` should
		// snap to the already-correct position instead of re-animating.
		if (skipControlledFillAnimationRef.current) {
			skipControlledFillAnimationRef.current = false;
			fillPercent.jump(percentage);
			return;
		}

		// Parent-driven updates (for example the weather scene's global
		// ArrowUp / ArrowDown shortcuts) don't touch the fill directly, so
		// retarget the fill here on every new percentage instead of waiting
		// for any previous animation to finish.
		if (fillPercent.get() !== percentage) {
			animateFillTo(percentage);
		}
	}, [percentage, isInteracting, fillPercent, animateFillTo]);

	useEffect(() => {
		if (keyboardNavigationPulseKey <= 0) return;
		pulseKeyboardHover(percentage);
	}, [keyboardNavigationPulseKey, percentage, pulseKeyboardHover]);

	const computeRubberStretch = useCallback(
		(clientY: number, sign: number) => {
			const rect = wrapperRectRef.current;
			if (!rect) return 0;

			// sign < 0 = past top (increase), sign > 0 = past bottom (decrease)
			const distancePast =
				sign < 0 ? rect.top - clientY : clientY - rect.bottom;
			const overflow = Math.max(0, distancePast - DEAD_ZONE);

			// Steeper rubber-band curve (cube root) ramps up faster than sqrt at small overflow,
			// matching the bouncier feel of reactbits.dev/elastic-slider.
			const ratio = Math.min(overflow / MAX_CURSOR_RANGE, 1);
			return sign * MAX_STRETCH * Math.cbrt(ratio);
		},
		[],
	);

	// Magnet-style stretch when the cursor is INSIDE the track. Maps the
	// cursor's normalized position (−1 = bottom edge, 0 = center, +1 = top
	// edge) to a stretch value that pulls the track toward the cursor:
	//   • cursor near the TOP   → stretch < 0 → height grows + shifts UP
	//                             (bottom stays anchored, track elongates
	//                             upward toward the cursor)
	//   • cursor near the BOTTOM → stretch > 0 → height grows + shifts DOWN
	//                             (top stays anchored, track elongates
	//                             downward toward the cursor)
	// A small dead-zone around the center keeps the resting state crisp.
	const computeHoverStretch = useCallback((clientY: number) => {
		const rect = wrapperRectRef.current;
		if (!rect) return 0;
		const center = (rect.top + rect.bottom) / 2;
		const halfHeight = (rect.bottom - rect.top) / 2;
		if (halfHeight <= 0) return 0;
		// Normalized position: −1 at bottom edge, +1 at top edge.
		// (Bottom is the larger clientY, so we negate.)
		const norm = clamp(-(clientY - center) / halfHeight, -1, 1);
		// Reuse the same easing curve as keyboard navigation pulses so the
		// directional stretch feels identical regardless of input method.
		return hoverStretchFromNorm(norm);
	}, []);

	const handlePointerDown = useCallback(
		(e: React.PointerEvent) => {
			e.preventDefault();
			(trackRef.current ?? (e.target as HTMLElement)).setPointerCapture(e.pointerId);

			// Cancel any in-flight hover-magnet stretch so the drag path
			// can directly drive `rubberStretch` without fighting a spring.
			hoverStretchAnimRef.current?.stop();
			hoverStretchAnimRef.current = null;

			pointerDownPos.current = { x: e.clientX, y: e.clientY };
			isClickRef.current = true;
			setIsInteracting(true);
			pendingPointerFocusRef.current = true;
			trackRef.current?.focus({ preventScroll: true });
			requestAnimationFrame(() => {
				pendingPointerFocusRef.current = false;
			});

			const wrapper = wrapperRef.current;
			if (wrapper) {
				const rect = wrapper.getBoundingClientRect();
				wrapperRectRef.current = rect;
				scaleRef.current = rect.height / wrapper.offsetHeight;
				// Native (unscaled) height — drag deltas are in scene-space
				// pixels, matching positionToValue's coordinate handling.
				trackHeightAtPointerDownRef.current = wrapper.offsetHeight;
			}
			valueAtPointerDownRef.current = value;
		},
		[value],
	);

	// Cache the wrapper rect during pure hover (no pointer-down) so
	// hover-to-select doesn't recompute it on every pointermove.
	const refreshWrapperRect = useCallback(() => {
		const wrapper = wrapperRef.current;
		if (!wrapper) return;
		const rect = wrapper.getBoundingClientRect();
		wrapperRectRef.current = rect;
		scaleRef.current = rect.height / wrapper.offsetHeight;
	}, []);

	// Hash marks (discrete steps). Declared early because the hover-snap
	// path inside `handlePointerMove` needs `hashMarkCount` to clamp the
	// snapped index.
	const discreteSteps = (max - min) / step;
	const hashMarkCount =
		discreteSteps <= 20 ? discreteSteps + 1 : Math.min(11, discreteSteps + 1);
	const hashMarkPct = (i: number) =>
		((hashMarkCount - 1 - i) / (hashMarkCount - 1)) * 100;

	// Index of the currently-selected tick (used to hide the redundant dot
	// behind the handle and to highlight the active label).
	const selectedIndex = clamp(
		Math.round((value - min) / step),
		0,
		hashMarkCount - 1,
	);

	const handlePointerMove = useCallback(
		(e: React.PointerEvent) => {
			// ── Pure hover path (no pointer-down) ─────────────────────────
			// Continuous-follow: snap to nearest tick under the cursor and
			// drive the rubber-band morph as the cursor approaches/exits the
			// track edges. Disabled when `pinned` (selection is locked) or
			// when there's no discrete tick set (continuous slider keeps the
			// classic click-to-set / drag interaction).
			if (!isInteracting) {
				if (!tickLabels || e.pointerType === "touch") return;

				if (!wrapperRectRef.current) refreshWrapperRect();
				const rect = wrapperRectRef.current;
				if (!rect) return;

				// Vertical "elastic-magnet" stretch: while the cursor is
				// INSIDE the track, the track elongates toward the cursor
				// (anchoring its far edge). Past the edges we keep the
				// stronger rubber-band overshoot for continuity with drag.
				if (!shouldReduceMotion) {
					let target: number;
					if (e.clientY < rect.top) {
						target = computeRubberStretch(e.clientY, -1);
					} else if (e.clientY > rect.bottom) {
						target = computeRubberStretch(e.clientY, 1);
					} else {
						target = computeHoverStretch(e.clientY);
					}
					// Spring toward the target stretch so the morph eases
					// rather than snapping each pointermove frame. Tuned to
					// trail the cursor slightly so the surface reads as
					// elastic / weighty rather than rigid.
					hoverStretchAnimRef.current?.stop();
					hoverStretchAnimRef.current = animate(rubberStretch, target, {
						type: "spring",
						stiffness: 260,
						damping: 22,
						mass: 0.55,
					});
				}

				const rawValue = positionToValue(e.clientY);
				const snappedIndex = clamp(
					Math.round((rawValue - min) / step),
					0,
					hashMarkCount - 1,
				);
				const snappedValue = clamp(min + snappedIndex * step, min, max);

				if (snappedIndex !== hoveredTickIndex) {
					onHoverTickChange?.(snappedIndex);
				}
				setHoveredTickIndex(snappedIndex);

				// When pinned, selection is locked — only the elastic-magnet
				// stretch and hover sound (via onHoverTickChange) are active.
				// Skip fill animation and value update.
				if (pinned) return;

				// Drive the fill height from the RAW cursor position so the
				// progress fluidly trails the mouse — instead of staying
				// pinned at the snapped tick while the elastic stretch makes
				// the fill look detached from the cursor. The committed
				// value (city label) still snaps to the nearest tick.
				animRef.current?.stop();
				animRef.current = null;
				fillPercent.set(percentFromValue(rawValue));

				if (snappedValue !== value) {
					skipControlledFillAnimationRef.current = true;
					setValue(roundValue(snappedValue, step));
				}
				return;
			}

			// ── Drag path (pointer is down) ───────────────────────────────
			if (!pointerDownPos.current) return;

			const dx = e.clientX - pointerDownPos.current.x;
			const dy = e.clientY - pointerDownPos.current.y;

			if (isClickRef.current && Math.hypot(dx, dy) > CLICK_THRESHOLD) {
				isClickRef.current = false;
				setIsDragging(true);
			}

			if (isClickRef.current) return;

			const rect = wrapperRectRef.current;
			if (rect && !shouldReduceMotion) {
				if (e.clientY < rect.top) {
					rubberStretch.jump(computeRubberStretch(e.clientY, -1));
				} else if (e.clientY > rect.bottom) {
					rubberStretch.jump(computeRubberStretch(e.clientY, 1));
				} else {
					rubberStretch.jump(0);
				}
			}

			// Drag uses *delta* from the press-down position so the handle
			// stays put on press-down and tracks the cursor relatively (no
			// jump-to-cursor). Click-snap is handled in handlePointerUp.
			const trackHeight = trackHeightAtPointerDownRef.current;
			const range = max - min;
			const valueDelta =
				trackHeight > 0
					? -(dy / scaleRef.current / trackHeight) * range
					: 0;
			const newValue = clamp(
				valueAtPointerDownRef.current + valueDelta,
				min,
				max,
			);
			animRef.current?.stop();
			animRef.current = null;
			fillPercent.jump(percentFromValue(newValue));
			skipControlledFillAnimationRef.current = true;
			setValue(roundValue(newValue, step));
		},
		[
			isInteracting,
			min,
			max,
			percentFromValue,
			setValue,
			step,
			value,
			fillPercent,
			rubberStretch,
			computeRubberStretch,
			computeHoverStretch,
			shouldReduceMotion,
			pinned,
			tickLabels,
			positionToValue,
			refreshWrapperRect,
			hashMarkCount,
			hoveredTickIndex,
			onHoverTickChange,
		],
	);

	const handlePointerUp = useCallback(
		(e: React.PointerEvent) => {
			if (!isInteracting) return;

			// Track which value to commit. For a click, that's the snapped
			// position under the cursor at release; for a drag, it's the
			// current value (already kept in sync via handlePointerMove).
			let committedValue = value;

			if (isClickRef.current) {
				const rawValue = positionToValue(e.clientY);
				const snapped = clamp(
					min + Math.round((rawValue - min) / step) * step,
					min,
					max,
				);
				const rounded = roundValue(snapped, step);
				animateFillTo(percentFromValue(snapped));
				setValue(rounded);
				committedValue = rounded;
			}

			if (!shouldReduceMotion && rubberStretch.get() !== 0) {
				animate(rubberStretch, 0, {
					type: "spring",
					visualDuration: 0.6,
					bounce: 0.5,
				});
			}

			setIsInteracting(false);
			setIsDragging(false);
			pointerDownPos.current = null;

			// Explicit commit — fire `onCommit` for click-release and
			// drag-release alike. This is what consumers should listen to
			// for "user deliberately picked this value" semantics.
			onCommit?.(committedValue);
		},
		[
			isInteracting,
			value,
			positionToValue,
			percentFromValue,
			setValue,
			step,
			min,
			max,
			animateFillTo,
			rubberStretch,
			shouldReduceMotion,
			onCommit,
		],
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			const bigStep = step * 10;
			let newValue: number | null = null;

			switch (e.key) {
				case "ArrowUp":
				case "ArrowRight":
					newValue = clamp(value + (e.shiftKey ? bigStep : step), min, max);
					break;
				case "ArrowDown":
				case "ArrowLeft":
					newValue = clamp(value - (e.shiftKey ? bigStep : step), min, max);
					break;
				case "Home":
					newValue = min;
					break;
				case "End":
					newValue = max;
					break;
				default:
					return;
			}

			e.preventDefault();
			const rounded = roundValue(newValue, step);
			if (rounded === value) return;
			animateFillTo(percentFromValue(rounded));
			pulseKeyboardHover(percentFromValue(rounded));
			setValue(rounded);
			// Keyboard navigation is an explicit commit.
			onCommit?.(rounded);
		},
		[
			value,
			min,
			max,
			step,
			percentFromValue,
			animateFillTo,
			pulseKeyboardHover,
			setValue,
			onCommit,
		],
	);

	// Snap directly to a tick (used by the per-tick hit-area buttons). Skips
	// the drag/rubber-band path entirely and animates the fill.
	const handleTickActivate = useCallback(
		(i: number) => {
			const target = clamp(min + i * step, min, max);
			const rounded = roundValue(target, step);
			animateFillTo(percentFromValue(target));
			setValue(rounded);
			// Per-tick button click is an explicit commit.
			onCommit?.(rounded);
		},
		[min, max, step, animateFillTo, percentFromValue, setValue, onCommit],
	);

	// Handle opacity based on overlap with label/value
	const [handleOpacity, setHandleOpacity] = useState(1);
	useLayoutEffect(() => {
		if (!wrapperRef.current || !trackRef.current) return;
		const trackHeight = wrapperRef.current.offsetHeight;
		const handlePos = (percentage / 100) * trackHeight;
		const nearTop = handlePos < HANDLE_BUFFER + 24;
		const nearBottom = handlePos > trackHeight - HANDLE_BUFFER - 24;
		setHandleOpacity(nearTop || nearBottom ? 0.3 : 1);
	}, [percentage]);

	const displayValue = formatValue
		? formatValue(value)
		: value.toFixed(
				step.toString().indexOf(".") === -1
					? 0
					: step.toString().length - step.toString().indexOf(".") - 1,
			);
	const trackMotionStyle = {
		width: "100%",
		height: rubberHeight,
		y: rubberY,
		scaleX: rubberScaleX,
		scaleY: activeScaleY,
		transformOrigin: "center center",
	};
	const trackSurfaceStyle = {
		borderRadius: "var(--elastic-slider-radius)",
		...(trackShape === "squircle" ? squircleTrackStyle : {}),
		...trackStyle,
	};
	const glassShellStyle = {
		position: "absolute",
		inset: 0,
		...(trackShape === "squircle" ? squircleTrackStyle : {}),
		...trackStyle,
		...shellProps?.style,
	} satisfies CSSProperties;
	const focusRingStyle = {
		borderRadius: "var(--elastic-slider-radius)",
		border: "1px solid var(--ds-border-focused)",
		boxShadow: GLASS_SLIDER_FOCUS_RING_BOX_SHADOW,
		...(trackShape === "squircle" ? squircleTrackStyle : {}),
	} satisfies CSSProperties;
	const trackChrome = (
		<>
			{shell === "none" ? (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0"
					style={{
						boxShadow: "inset 0 0 0 1px var(--elastic-slider-border)",
					}}
				/>
			) : null}
			{/* Hash marks + city labels are stacked ABOVE the liquid-glass
			    progress fill (`z-20`) so that the cities below the meniscus
			    are still legible through / over the glass instead of being
			    refracted/blurred underneath it. The fill itself has no
			    explicit z-index and renders above the squircle background
			    but below this layer. */}
			<div
				data-slot="glass-slider-hash-marks"
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 z-20"
			>
				{Array.from({ length: hashMarkCount }, (_, i) => {
					// `hashMarkPct` places `i = 0` at top:100% (the BOTTOM of the
					// track) and `i = hashMarkCount - 1` at top:0% (the TOP of the
					// track). Slider values run min→max bottom→top, and tickLabels
					// are passed low→high, so the label for tick `i` is just
					// `tickLabels[i]`.
					const tickLabel = tickLabels?.[i];
					const isTopTick = i === hashMarkCount - 1;
					const isBottomTick = i === 0;
					// When a label is supplied for this tick, the tick mark and its
					// label are always visible. Otherwise the tick keeps the
					// default behavior of only appearing on hover/interaction.
					const hasLabel = Boolean(tickLabel);
					const isSelected = i === selectedIndex;
					const isHoveredTick = i === hoveredTickIndex;
					// The tick mark is shown for every labeled position. When
					// selected OR hovered, it renders in its expanded form
					// (bigger w-5 focus-color pill). The selected tick simply
					// reuses the hover styling persistently.
					const showDot = true;
					const isEmphasized = isSelected || isHoveredTick;

					// ── Layout model ────────────────────────────────────────
					// The tick mark (horizontal line) and the label are
					// rendered as TWO INDEPENDENT absolutely-positioned siblings
					// of the parent hash-marks container. Each has its own
					// `top` value, so they can be moved independently.
					//
					// Cluster orientations:
					// - KL (top end):    TICK on top  → LABEL below.
					//                    The tick is pinned at a fixed inset
					//                    from the top edge so its default and
					//                    selected positions are identical.
					// - TYO, SF (inner): LABEL on top → TICK below.
					// - SYD (bottom end): LABEL on top → TICK below.
					//                    The tick is pinned at a fixed inset
					//                    from the bottom edge so its default
					//                    and selected positions are identical
					//                    (mirror of KL).
					const TICK_HEIGHT_PX = 3; // reserved hover footprint
					const LABEL_GAP_PX = 6;
					// LA's tick→label gap visually appears LARGER than SYD's
					// label→tick gap because the label's TOP edge is the cap
					// line (no descenders, no leading above the glyphs in this
					// font's metrics), while the label's BOTTOM edge sits below
					// descenders. So matching the gap visually requires using a
					// SMALLER pixel value for the top-tick gap.
					const TOP_LABEL_GAP_PX = 1;
					// Inset of the TICK MARK from its corresponding edge for
					// the end ticks. These MUST match the selected-state handle
					// position so the tick mark doesn't visually jump when the
					// end tick is selected.
					//
					// The handle is positioned via `handleBottom`:
					//   `max(4px, calc(${pct}% - 8px))`
					// • SYD selected (pct=0):   handleBottom = max(4px, -8px) = 4px
					//                           → tick should sit  4px from bottom.
					// • KL selected  (pct=100): handleBottom = max(4px, calc(100% - 8px))
					//                           → tick should sit  8px from top.
					const TOP_TICK_INSET_PX = 8;
					const BOTTOM_TICK_INSET_PX = 4;
					// Inner ticks (not top/bottom most) are nudged DOWN slightly
					// from their natural percentage so the selected tick doesn't
					// sit flush against the top edge of the progress fill —
					// instead a small visual gap separates the tick from the
					// fill boundary.
					const INNER_TICK_OFFSET_PX = 4;

					// Tick mark top:
					// - Top end (KL): pinned to TOP_TICK_INSET_PX from the top.
					// - Bottom end (SYD): pinned to BOTTOM_TICK_INSET_PX from
					//   the bottom.
					// - Inner ticks: at their natural percentage along the track,
					//   offset slightly downward so the tick doesn't sit flush
					//   on the fill boundary when selected.
					const tickTop = isTopTick
						? `${TOP_TICK_INSET_PX}px`
						: isBottomTick
							? `calc(100% - ${BOTTOM_TICK_INSET_PX}px)`
							: `calc(${hashMarkPct(i)}% + ${INNER_TICK_OFFSET_PX}px)`;

					// Label top (where the label's TOP edge sits):
					// - Top end (KL): just BELOW the tick mark.
					// - Bottom end (SYD): just ABOVE the tick mark
					//   (tick-top - gap - label-height).
					// - Inner ticks: just above the (offset) tick by LABEL_GAP_PX.
					const labelTop = isTopTick
						? `calc(${TOP_TICK_INSET_PX}px + ${TICK_HEIGHT_PX / 2}px + ${TOP_LABEL_GAP_PX}px)`
						: isBottomTick
							? `calc(100% - ${BOTTOM_TICK_INSET_PX}px - ${TICK_HEIGHT_PX / 2}px - ${LABEL_GAP_PX}px - 1.25em)`
							: `calc(${hashMarkPct(i)}% + ${INNER_TICK_OFFSET_PX}px - ${TICK_HEIGHT_PX / 2}px - ${LABEL_GAP_PX}px - 1.25em)`;

					// Label anchors to its TOP edge for all ticks (labelTop
					// always represents the top of the label).
					const labelTransform = "translate(-50%, 0)";

					return (
						<Fragment key={i}>
							{/* Horizontal tick mark (independent positioning).
							    `z-10` ensures the emphasized (gradient) tick
							    sits ABOVE the progress fill — otherwise the
							    fill (rendered later in the DOM) would dim
							    the rainbow tick when it overlaps. */}
							<div
								data-selected={isSelected || undefined}
								data-slot="glass-slider-tick"
								className="absolute left-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
								style={{ top: tickTop }}
							>
								<div className="flex h-[3px] w-7 items-center justify-center">
									{showDot ? (
										<div
											className={cn(
												"rounded-full transition-all duration-normal ease-out",
												hasLabel
													? isEmphasized
														// Selected gets the wider w-7 pill;
														// hover keeps the original w-5 width.
														// Both get the rainbow gradient via the
														// inline style below.
														? isSelected
															? "h-[3px] w-7"
															: "h-[3px] w-5"
														: "h-px w-4 bg-(--elastic-slider-hash)"
													: "h-px w-4 bg-transparent group-data-[active=true]/elastic-slider:bg-(--elastic-slider-hash)",
											)}
											style={
												hasLabel && isEmphasized
													? { backgroundImage: ROVO_TICK_GRADIENT }
													: hasLabel
														? { boxShadow: GLASS_SLIDER_TICK_EMBOSS_BOX_SHADOW }
														: undefined
											}
										/>
									) : null}
								</div>
							</div>
							{/* Tick label (independent positioning).
							    All labels — including the selected one — are
							    hidden by default and revealed only on
							    hover/interaction via the group
							    `data-active=true` state. */}
							{tickLabel ? (
								<span
									data-slot="glass-slider-tick-label"
									className={cn(
										"pointer-events-none absolute left-1/2",
										"text-[10px] font-medium uppercase tracking-[0.15em]",
										"transition-[color,opacity] duration-normal ease-out",
										"whitespace-nowrap",
										"opacity-0 group-data-[active=true]/elastic-slider:opacity-100",
										isSelected || isHoveredTick
											? "text-(--elastic-slider-focus)"
											: "text-(--elastic-slider-label)",
									)}
									style={{
										top: labelTop,
										transform: labelTransform,
										fontFamily: "'DotGothic16', sans-serif",
									}}
								>
									{tickLabel}
								</span>
							) : null}
						</Fragment>
					);
				})}
			</div>

			{/* Per-tick hit areas. Each row spans the full track width and snaps
			    to its city on click. Pointer events are scoped to the buttons
			    only so the rest of the track can still initiate drag. */}
			{tickLabels ? (
				<div
					data-slot="glass-slider-tick-hit-areas"
					className="pointer-events-none absolute inset-0"
				>
					{Array.from({ length: hashMarkCount }, (_, i) => {
						const tickLabel = tickLabels[i];
						if (!tickLabel) return null;
						const rowHeightPct = 100 / hashMarkCount;
						const centerPct = hashMarkPct(i);
						const topPct = clamp(
							centerPct - rowHeightPct / 2,
							0,
							100 - rowHeightPct,
						);
						return (
							<button
								key={i}
								type="button"
								tabIndex={-1}
								aria-label={`Select ${tickLabel}`}
								className="pointer-events-auto absolute left-0 right-0 bg-transparent outline-none"
								style={{
									top: `${topPct}%`,
									height: `${rowHeightPct}%`,
								}}
								// NOTE: Don't pre-set `hoveredTickIndex` here. The
								// track's `handlePointerMove` is the single
								// source of truth for which tick is hovered —
								// pre-setting from the tick's `onPointerEnter`
								// races ahead of the move handler and makes
								// the `if (snappedIndex !== hoveredTickIndex)`
								// guard skip the `onHoverTickChange` call,
								// silencing the hover sound.
								onPointerLeave={() =>
									setHoveredTickIndex((prev) => (prev === i ? null : prev))
								}
								onClick={(e) => {
									e.stopPropagation();
									handleTickActivate(i);
								}}
							/>
						);
					})}
				</div>
			) : null}

			{/* Progress fill: a liquid-glass "inner lens" sitting at the bottom
			    of the track. The fill's height is driven by `fillHeight`, and
			    its bottom + side edges are clipped by the surrounding track's
			    overflow-hidden + squircle radius so the meniscus reads as a
			    crisp horizontal line at the top edge of the filled region.
			    A subtle Rovo brand-color gradient is layered over the glass
			    so the progress region still has a brand identity without
			    overpowering the refractive surface. */}
			{/*
			 * Progress fill clip strategy:
			 *
			 * The fill is a rectangular slab that GROWS from the bottom of
			 * the track. We deliberately give it NEITHER border-radius NOR
			 * a squircle `cornerShape` of its own — the surrounding
			 * track-surface (which is already `overflow-clip` + squircle)
			 * is the single source of truth for the bottom curve.
			 *
			 * Why not let the fill round its own corners?
			 *
			 * 1. A pill (`border-radius: 9999`) and a squircle of the same
			 *    radius have DIFFERENT silhouettes — pills bulge slightly
			 *    further out at the corners. When the fill rounds itself
			 *    as a pill but its parent rounds as a squircle, the fill
			 *    spills past the squircle's flatter bottom edge.
			 * 2. At small fill heights the fill's TOP corners would also
			 *    round, turning the meniscus into an ovoid bubble instead
			 *    of a crisp horizontal seam.
			 *
			 * Keeping the fill rectangular and delegating ALL clipping to
			 * the parent gives us a perfectly square meniscus on top and
			 * a perfectly squircle-matched bottom every time.
			 *
			 * `overflow-clip` (instead of `overflow-hidden`) on the parent
			 * guarantees the clip follows the squircle path on browsers
			 * that support `corner-shape: superellipse(...)`.
			 */}
			<motion.div
				ref={fillElementRef}
				data-slot="glass-slider-fill"
				aria-hidden="true"
				className={cn(
					"pointer-events-none absolute inset-x-0 bottom-0",
					"transition-opacity",
					"opacity-95 group-data-[active=true]/elastic-slider:opacity-100",
				)}
				style={{ height: fillHeight, ...initialMeniscusMask }}
			>
				<LiquidGlass
					{...DEFAULT_FILL_GLASS_PROPS}
					{...fillGlassProps}
					width="100%"
					height="100%"
					borderRadius={0}
					className="pointer-events-none absolute inset-0"
				/>
				{fillTintGradient ? (
					<div
						aria-hidden="true"
						className={cn(
							"pointer-events-none absolute inset-0 transition-opacity",
							"opacity-90 group-data-[active=true]/elastic-slider:opacity-100",
						)}
						style={{
							backgroundImage: fillTintGradient,
							mixBlendMode: fillTintBlendMode,
						}}
					/>
				) : null}
			</motion.div>

			{/* Floating motion-driven handle bar. When tickLabels are
			    supplied, the selected tick mark itself renders in its
			    emphasized form and serves as the visual handle, so this
			    separate handle would just produce a duplicate stacked mark
			    at the same Y position. Suppress it in that case. */}
			{tickLabels ? null : (
				<motion.div
					data-slot="glass-slider-handle"
					aria-hidden="true"
					className="pointer-events-none absolute left-1/2 h-1 w-5 rounded-full bg-(--elastic-slider-handle)"
					style={{ bottom: handleBottom, x: "-50%" }}
					animate={{
						opacity: handleOpacity,
						scaleY: isActive ? 1 : 0.25,
						scaleX: isActive ? 1 : 1,
					}}
					transition={
						shouldReduceMotion
							? { duration: 0 }
							: {
									scaleY: {
										type: "spring",
										visualDuration: 0.25,
										bounce: 0.15,
									},
									opacity: { duration: 0.15 },
								}
					}
				/>
			)}

			{label ? (
				<span
					data-slot="glass-slider-label"
					aria-hidden="true"
					className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 text-center text-[14px] font-medium uppercase tracking-[0.2em] text-(--elastic-slider-label) transition-colors"
					style={{ fontFamily: "'DotGothic16', sans-serif" }}
				>
					{label}
				</span>
			) : null}

			{/* When tickLabels are supplied, every tick already shows its own
			    label, so the floating value badge becomes a redundant duplicate
			    (e.g. "SYD" rendered twice at the bottom). Hide it in that case. */}
			{tickLabels ? null : (
				<span
					data-slot="glass-slider-value"
					aria-hidden="true"
					className={cn(
						"pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-center text-[14px] font-medium transition-colors",
						"text-(--elastic-slider-label) group-data-[active=true]/elastic-slider:text-(--elastic-slider-focus)",
					)}
					style={{ fontFamily: "'DotGothic16', sans-serif" }}
				>
					{displayValue}
				</span>
			)}

		</>
	);

	return (
		<div
			ref={wrapperRef}
			data-slot="glass-slider"
			data-active={isActive}
			className={cn(
				"group/elastic-slider relative flex w-full touch-none select-none flex-col items-center",
				className,
			)}
			style={
				{
					"--elastic-slider-height": "100%",
					"--elastic-slider-radius": "9999px",
					"--elastic-slider-bg": "var(--ds-background-neutral)",
					"--elastic-slider-fill": "var(--ds-background-neutral-hovered)",
					"--elastic-slider-fill-active": "var(--ds-background-neutral-pressed)",
					"--elastic-slider-hash": "var(--ds-border-bold)",
					"--elastic-slider-handle": "var(--ds-icon-subtle)",
					"--elastic-slider-label": "var(--ds-text-subtle)",
					"--elastic-slider-border": "var(--ds-border)",
					"--elastic-slider-focus": "var(--ds-icon)",
				} as React.CSSProperties
			}
		>
			<motion.div
				ref={trackRef}
				data-slot="glass-slider-track"
				role="slider"
				tabIndex={0}
				aria-label={ariaLabel ?? label ?? "Slider"}
				aria-valuemin={min}
				aria-valuemax={max}
				aria-valuenow={value}
				aria-valuetext={displayValue}
				aria-orientation="vertical"
				className={cn(
					"relative cursor-grab active:cursor-grabbing",
					"outline-none",
					shell === "none" && "overflow-clip bg-(--elastic-slider-bg)",
					shell === "none" && trackClassName,
				)}
				style={shell === "none" ? { ...trackMotionStyle, ...trackSurfaceStyle } : trackMotionStyle}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onPointerCancel={handlePointerUp}
				onKeyDown={handleKeyDown}
				onFocus={(event) => {
					setIsFocusVisible(event.currentTarget.matches(":focus-visible"));
				}}
				onBlur={() => {
					setIsFocusVisible(false);
				}}
				onMouseEnter={() => {
					setIsHovered(true);
					if (tickLabels) {
						refreshWrapperRect();
					}
				}}
				onMouseLeave={() => {
					const skipPinnedHoverLeaveSettle =
						pinned && !isInteracting && !isKeyboardActive;
					setIsHovered(false);
					setHoveredTickIndex(null);
					onHoverTickChange?.(null);
					hoverStretchAnimRef.current?.stop();
					hoverStretchAnimRef.current = null;
					if (skipPinnedHoverLeaveSettle) {
						rubberStretch.jump(0);
					} else if (!shouldReduceMotion && rubberStretch.get() !== 0) {
						animate(rubberStretch, 0, {
							type: "spring",
							visualDuration: 0.6,
							bounce: 0.5,
						});
					}
					// The fill was being driven by the raw cursor position
					// during hover; on leave, snap it back to the committed
					// (snapped) value with a spring so it visibly settles on
					// the selected city.
					const targetPercent = percentFromValue(value);
					if (fillPercent.get() !== targetPercent) {
						if (skipPinnedHoverLeaveSettle) {
							animRef.current?.stop();
							animRef.current = null;
							fillPercent.jump(targetPercent);
						} else {
							animateFillTo(targetPercent);
						}
					}
				}}
			>
				{shell === "liquid-glass" ? (
					<>
						<LiquidGlass
							{...DEFAULT_GLASS_SHELL_PROPS}
							{...shellProps}
							width="100%"
							height="100%"
							className={cn(
								"pointer-events-none absolute inset-0",
								shellProps?.className,
							)}
							style={glassShellStyle}
						/>
						<div
							data-slot="glass-slider-track-surface"
							className={cn(
								// `overflow-clip` (rather than
								// `overflow-hidden`) clips children to the
								// element's actual border path, including
								// the squircle corner-shape — preventing
								// the rectangular liquid-glass progress
								// fill from spilling past the squircle
								// curve at the bottom corners.
								"absolute inset-0 overflow-clip",
								trackClassName,
							)}
							style={trackSurfaceStyle}
						>
							{trackChrome}
						</div>
					</>
				) : (
					<>
						{trackChrome}
					</>
				)}
				{/* Focus ring is rendered as the LAST absolutely-positioned
				    child inside the track itself (rather than as an outer
				    sibling) so it shares the exact bounds, rubber-band
				    stretch, and squircle corner-shape of the visible glass
				    shell. Sibling-mirroring with the same motion values
				    still produced a tiny visual gap because the LiquidGlass
				    SVG renders with sub-pixel insets that the bare DOM box
				    of a sibling div cannot replicate. */}
				<div
					data-slot="glass-slider-focus-ring"
					aria-hidden="true"
					className={cn(
						"pointer-events-none absolute inset-0 z-40 transition-opacity duration-fast ease-out",
						isFocusVisible ? "opacity-100" : "opacity-0",
					)}
					style={focusRingStyle}
				/>
			</motion.div>
		</div>
	);
}
