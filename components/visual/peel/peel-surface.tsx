"use client";

import { Canvas, type RootState } from "@react-three/fiber";
import { useReducedMotion, type MotionValue } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";

import { parseColor } from "@/components/ui-custom/lib/shimmer-colors";
import { cn } from "@/lib/utils";
import { PEEL_CAMERA_DISTANCE, PEEL_CAMERA_FOV, PEEL_OVERSCAN, PEEL_PAPER_COLOUR, resolvePeelTuning, type PeelTuning } from "./data";
import { createPeelState, grabPeel, startPeelFlash } from "./peel-model";
import { peelSurfacePointer } from "./peel-geometry";
import { PeelScene } from "./peel-scene";
import type { PeelPointerSample } from "./peel-geometry";

export interface PeelSurfaceProps {
	/** Decorative drag preview. The original interactive source stays in its own owner. */
	children: ReactNode;
	/** Stable copy for capture when the visible card is morphing. */
	captureChildren?: ReactNode;
	/** Start after the preview's entrance morph has finished. */
	active: boolean;
	/** Stable visual identity; a changed identity invalidates the previous print. */
	contentKey: string;
	/** Optional avatar accent for the brief face flash. */
	flashColor?: string;
	pointerX: MotionValue<number>;
	pointerY: MotionValue<number>;
	/** Retained input intent from the gesture owner, available before capture finishes. */
	pointerDirection: MotionValue<number>;
	pointerOriginX: MotionValue<number>;
	tuning?: Partial<PeelTuning>;
	className?: string;
}

/** Bend the existing component's rendered pixels rather than reconstructing its UI. */
export function PeelSurface({ active, ...props }: Readonly<PeelSurfaceProps>) {
	const reducedMotion = useReducedMotion() ?? false;
	const sourceRef = useRef<HTMLDivElement>(null);
	return (
		<div aria-hidden inert className={cn("group/peel pointer-events-none relative w-fit", props.className)} data-peel-surface="" style={{ "--peel-flash-color": props.flashColor } as CSSProperties}>
			{/* Keep the existing subtree mounted through the entrance and capture:
			    remounting it would restart its avatars at opacity zero. */}
			<div ref={props.captureChildren === undefined ? sourceRef : undefined} data-peel-native-source="" className="w-fit p-6 group-data-[peel-ready=true]/peel:opacity-0">{props.children}</div>
			{props.captureChildren !== undefined ? <div ref={sourceRef} data-peel-capture-source="" className="pointer-events-none absolute left-0 top-0 w-fit p-6 opacity-0">{props.captureChildren}</div> : null}
			{!reducedMotion ? <PeelCapturedSurface key={JSON.stringify([props.contentKey, props.flashColor])} active={active} sourceRef={sourceRef} pointerX={props.pointerX} pointerY={props.pointerY} pointerDirection={props.pointerDirection} pointerOriginX={props.pointerOriginX} tuning={props.tuning} /> : null}
		</div>
	);
}

/** One prepared print/context per opted-in preview; the frame loop parks between drags. */
function PeelCapturedSurface({ active, sourceRef, pointerX, pointerY, pointerDirection, pointerOriginX, tuning }: Readonly<Pick<PeelSurfaceProps, "active" | "pointerX" | "pointerY" | "pointerDirection" | "pointerOriginX" | "tuning"> & { sourceRef: RefObject<HTMLDivElement | null> }>) {
	const emptyElementRef = useRef<HTMLElement | null>(null);
	const pointerRef = useRef<PeelPointerSample>({ clientX: 0, clientY: 0, valid: false });
	const reducedMotion = useReducedMotion() ?? false;
	const [capture, setCapture] = useState<{ canvas: HTMLCanvasElement; width: number; height: number; generation: number; flashColor?: string; surfaceInset: readonly [number, number] } | null>(null);
	const activeRef = useRef(false);
	const preparedRef = useRef(false);
	const rootRef = useRef<RootState | null>(null);
	const resolvedTuning = useMemo(() => resolvePeelTuning("uv-gloss", {
		waveAmplitude: 0.13,
		waveLength: 1.4,
		waveShear: 1.4,
		flutter: 0.067,
		// Cards need a clearer carry pose than the reference illustration.
		tilt: 0.19,
		swing: 0.075,
		...tuning,
	}, reducedMotion), [tuning, reducedMotion]);
	const [state] = useState(() => createPeelState(resolvedTuning));
	const pointerPosition = useMemo(() => ({ x: pointerX, y: pointerY, direction: pointerDirection, originX: pointerOriginX }), [pointerX, pointerY, pointerDirection, pointerOriginX]);
	const startPeel = useCallback(() => {
		if (!activeRef.current || !preparedRef.current) return;
		// Reset paper motion at handoff; the gesture owner retains input history.
		Object.assign(state, createPeelState(resolvedTuning));
		state.x = state.targetX = pointerX.get();
		state.y = state.targetY = pointerY.get();
		grabPeel(state, 0.25, 0.1);
		state.pointerU = state.pointerTargetU = peelSurfacePointer(state.targetX - pointerOriginX.get());
		if (capture?.flashColor) startPeelFlash(state);
		rootRef.current?.setFrameloop("always");
		rootRef.current?.invalidate();
	}, [state, resolvedTuning, pointerX, pointerY, pointerOriginX, capture?.flashColor]);
	useLayoutEffect(() => {
		activeRef.current = active;
		if (active) startPeel();
		else {
			const frame = sourceRef.current?.parentElement;
			if (frame) delete frame.dataset.peelReady;
			Object.assign(state, createPeelState(resolvedTuning));
			rootRef.current?.setFrameloop("demand");
			rootRef.current?.invalidate();
		}
	}, [active, startPeel, sourceRef, state, resolvedTuning]);

	useEffect(() => {
		const source = sourceRef.current;
		if (reducedMotion || !source) return;
		let disposed = false;
		let generation = 0;
		let pendingFrame = 0;
		let previousSize = "";
		const captureSource = async () => {
			const current = ++generation;
			try {
				const { toCanvas } = await import("html-to-image");
				await document.fonts.ready;
				await Promise.all([...source.querySelectorAll("img")].map((image) => image.decode().catch(() => {})));
				if (disposed || current !== generation) return;
				const width = source.offsetWidth;
				const height = source.offsetHeight;
				// Computed custom properties resolve theme variables too, keeping
				// near-black agent marks consistent with their rendered avatars.
				const sourceStyle = getComputedStyle(source);
				const accent = parseColor(sourceStyle.getPropertyValue("--peel-flash-color"));
				const surfaceInset = [parseFloat(sourceStyle.paddingLeft) / width, parseFloat(sourceStyle.paddingTop) / height] as const;
				const flashColor = accent ? `rgb(${accent.r}, ${accent.g}, ${accent.b})` : undefined;
				const canvas = await toCanvas(source, {
					pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
					preferredFontFormat: "woff2",
					style: { opacity: "1" },
				});
				if (disposed || current !== generation) return;
				delete source.dataset.peelCaptureError;
				preparedRef.current = false;
				if (source.parentElement) {
					delete source.parentElement.dataset.peelPrepared;
					delete source.parentElement.dataset.peelReady;
				}
				setCapture({ canvas, width, height, generation: current, flashColor, surfaceInset });
			} catch (error: unknown) {
				// The canonical DOM preview remains visible if capture is unavailable.
				if (!disposed && current === generation) source.dataset.peelCaptureError = error instanceof Error ? error.message : String(error);
			}
		};
		function scheduleCapture() {
			cancelAnimationFrame(pendingFrame);
			pendingFrame = requestAnimationFrame(() => { void captureSource(); });
		}
		// Pointer/morph transforms never invalidate the print. Refresh only its
		// theme, layout size or image data; late captures cannot replace newer ones.
		const resize = new ResizeObserver(() => {
			const size = `${source.offsetWidth}:${source.offsetHeight}:${window.devicePixelRatio}`;
			if (size === previousSize) return;
			previousSize = size;
			scheduleCapture();
		});
		resize.observe(source);
		const images = new MutationObserver(scheduleCapture);
		images.observe(source, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
		const theme = new MutationObserver(scheduleCapture);
		theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "data-color-mode"] });
		return () => {
			disposed = true;
			cancelAnimationFrame(pendingFrame);
			resize.disconnect();
			images.disconnect();
			theme.disconnect();
			activeRef.current = false;
			preparedRef.current = false;
			rootRef.current?.setFrameloop("demand");
			if (source.parentElement) {
				delete source.parentElement.dataset.peelReady;
				delete source.parentElement.dataset.peelPrepared;
			}
		};
	}, [sourceRef, reducedMotion]);
	const handleReady = useCallback(() => {
		const frame = sourceRef.current?.parentElement;
		if (!frame) return;
		preparedRef.current = true;
		frame.dataset.peelPrepared = "true";
		startPeel();
	}, [sourceRef, startPeel]);
	const handleRender = useCallback(() => {
		const frame = sourceRef.current?.parentElement;
		// Reveal only after an active frame draws, so the morph joins the wave
		// without exposing a stale folded frame from a previous gesture.
		if (frame && activeRef.current && preparedRef.current && frame.dataset.peelReady !== "true") frame.dataset.peelReady = "true";
	}, [sourceRef]);
	const drawSurface = !reducedMotion && capture !== null;
	const overscan = capture ? Math.round(capture.height * PEEL_OVERSCAN) : 0;

	return drawSurface ? (
		<div className="pointer-events-none absolute opacity-0 group-data-[peel-ready=true]/peel:opacity-100" style={{ inset: -overscan }}>
			<Canvas frameloop={active ? "always" : "demand"} onCreated={(root) => { rootRef.current = root; }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} style={{ pointerEvents: "none" }} camera={{ fov: PEEL_CAMERA_FOV, position: [0, 0, PEEL_CAMERA_DISTANCE], near: 0.1, far: 20 }}>
				<PeelScene key={capture.generation} state={state} tuning={resolvedTuning} print={capture.canvas} flashColor={capture.flashColor} surfaceInset={capture.surfaceInset} shape="surface" pointerPosition={pointerPosition} liftRef={emptyElementRef} hitRef={emptyElementRef} pointerRef={pointerRef} box={{ width: capture.width, height: capture.height, rotation: 0 }} aspect={capture.width / capture.height} surfaceColor={PEEL_PAPER_COLOUR} onReady={handleReady} onRender={handleRender} />
			</Canvas>
		</div>
	) : null;
}
