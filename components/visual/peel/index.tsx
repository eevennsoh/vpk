"use client";

/**
 * Peel — a sheet of printed paper you can lift off the page.
 *
 * Three behaviours, and each one is doing a job:
 *
 *   - at rest it lies flat under a tight contact shadow;
 *   - on hover an iridescent spot-gloss follows the cursor across the printed
 *     ink, the way UV varnish catches a light as you move your head;
 *   - clicking sweeps a diagonal curl across the sheet from the grabbed
 *     corner; clicking again reverses the curl and lays the paper back down.
 *
 * The silhouette is a perforated postage stamp, matching the reference at
 * jaksenc.com/about. Peel draws the paper margin, the die-cut and the stock
 * texture procedurally, so any photo becomes a stamp.
 *
 * ```tsx
 * <Peel src="/avatar-human/annie-clare.png" alt="Annie Clare" />
 * ```
 *
 * The canvas only mounts while the card is on screen. Each instance owns a
 * WebGL context and browsers cap those near 16, so a page of these wants to be
 * a handful, not a hundred.
 */

import { Canvas } from "@react-three/fiber";
import { useReducedMotion } from "motion/react";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type KeyboardEvent,
	type MouseEvent,
	type PointerEvent,
	type Ref,
} from "react";

import { cn } from "@/lib/utils";

import {
	PEEL_CAMERA_DISTANCE,
	PEEL_CAMERA_FOV,
	PEEL_OVERSCAN,
	PEEL_PAPER_COLOUR,
	PEEL_STAMP_RATIO,
	resolvePeelTuning,
	type PeelFinish,
	type PeelTuning,
} from "./data";
import { resolvePeelUv, type PeelBox, type PeelPointerSample } from "./peel-geometry";
import { PeelScene } from "./peel-scene";
import {
	createPeelState,
	dragPeel,
	grabPeel,
	hoverPeel,
	nudgePeel,
	pointPeel,
	releasePeel,
} from "./peel-model";

/**
 * Default footprint, in CSS pixels: the reference stamp's own paper size.
 * Height follows from PEEL_STAMP_RATIO — the reference measures 98.12 x 128.61,
 * and 98 rounds to 129 here.
 */
const PEEL_STAMP_WIDTH = 98;

/** CSS pixels an arrow key moves the sheet. Shift multiplies by four. */
const PEEL_NUDGE_STEP = 12;

export interface PeelProps {
	/**
	 * Artwork printed on the sheet. It sits inside the cream paper margin — a
	 * uniform 3.03 CSS px band of bare stock all the way round, measured off the
	 * reference — so the print box comes out at the source image's own 0.75
	 * aspect. Omitted, the sheet renders as blank stock.
	 */
	src?: string;
	/** Describes the sheet. Becomes its accessible name. */
	alt: string;
	/** Sheet width in CSS pixels. */
	width?: number;
	/** Sheet height in CSS pixels. Defaults to the stamp proportion. */
	height?: number;
	finish?: PeelFinish;
	/** Whether the sheet can be picked up by pointer or keyboard. */
	draggable?: boolean;
	/** Resting angle in degrees, for scattered layouts. */
	rotation?: number;
	/** Paper stock colour: the margin, and the whole sheet when no `src` is set. */
	surfaceColor?: string;
	/** Overrides merged over the finish preset. */
	tuning?: Partial<PeelTuning>;
	/** Fires as the sheet starts to come off the page. */
	onPeel?: () => void;
	/** Fires as it is set back down. */
	onLand?: () => void;
	className?: string;
	/** Additional layout styles. The dedicated props still own the rendered size. */
	style?: CSSProperties;
	ref?: Ref<HTMLDivElement>;
}

export function Peel({
	src,
	alt,
	width = PEEL_STAMP_WIDTH,
	height,
	finish = "foil",
	draggable = true,
	rotation = 0,
	surfaceColor = PEEL_PAPER_COLOUR,
	tuning,
	onPeel,
	onLand,
	className,
	style,
	ref,
}: Readonly<PeelProps>) {
	const rootRef = useRef<HTMLDivElement>(null);
	const liftRef = useRef<HTMLDivElement>(null);
	const hitRef = useRef<HTMLButtonElement>(null);
	const pointerRef = useRef<PeelPointerSample>({ clientX: 0, clientY: 0, valid: false });
	/** Pointer/sheet offset captured when the sheet came up, so it hangs from the click point. */
	const carryRef = useRef({ clientX: 0, clientY: 0, x: 0, y: 0 });

	const reducedMotion = useReducedMotion() ?? false;
	const [inView, setInView] = useState(false);
	const [active, setActive] = useState(false);
	const [lifted, setLifted] = useState(false);

	const sheetHeight = height ?? Math.round(width / PEEL_STAMP_RATIO);
	const aspect = width / sheetHeight;
	const overscan = Math.round(sheetHeight * PEEL_OVERSCAN);

	const resolvedTuning = useMemo(
		() => resolvePeelTuning(finish, tuning, reducedMotion),
		[finish, tuning, reducedMotion],
	);

	// The model outlives every render: the frame loop mutates it in place and
	// the event handlers below push into it, so it must never be recreated.
	//
	// Initialised lazily. `useRef(createPeelState(...))` evaluates the factory on
	// EVERY render and throws the result away — React only keeps the first — so
	// it would allocate a model and its impulse ring on each pass for nothing.
	// A useState lazy initialiser, not a ref: the factory runs exactly once and
	// the identity never changes, with no ref write during render at all. A ref
	// initialised in render — in any form, guarded or not — can leak from work
	// React replays or discards.
	const [state] = useState(() => createPeelState(resolvedTuning));
	useEffect(() => {
		state.tuning = resolvedTuning;
		state.reducedMotion = reducedMotion;
	}, [resolvedTuning, reducedMotion, state]);

	const box = useMemo<PeelBox>(
		() => ({ width, height: sheetHeight, rotation: (rotation * Math.PI) / 180 }),
		[width, sheetHeight, rotation],
	);

	// Deferring the canvas until the stamp is on screen keeps a scattered page
	// from opening every WebGL context at once.
	useEffect(() => {
		const element = rootRef.current;
		if (!element) {
			return;
		}
		const observer = new IntersectionObserver(
			([entry]) => setInView(entry.isIntersecting),
			{ rootMargin: "160px" },
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	const wake = useCallback(() => setActive(true), []);
	const handleIdleChange = useCallback((idle: boolean) => setActive(!idle), []);

	const handlePointerEnter = useCallback(
		(event: PointerEvent<HTMLButtonElement>) => {
			const sample = pointerRef.current;
			sample.clientX = event.clientX;
			sample.clientY = event.clientY;
			sample.valid = true;
			hoverPeel(state, true);
			wake();
		},
		[state, wake],
	);

	const handlePointerMove = useCallback((event: PointerEvent<HTMLButtonElement>) => {
		const sample = pointerRef.current;
		sample.clientX = event.clientX;
		sample.clientY = event.clientY;
		sample.valid = true;
		wake();
	}, [wake]);

	const handlePointerLeave = useCallback(() => {
		pointerRef.current.valid = false;
		hoverPeel(state, false);
		wake();
	}, [state, wake]);

	const togglePeel = useCallback((u = state.pointerU, v = state.pointerV) => {
		if (!draggable) {
			return;
		}
		if (state.held) {
			releasePeel(state);
			setLifted(false);
			onLand?.();
		} else {
			const sample = pointerRef.current;
			carryRef.current = { clientX: sample.clientX, clientY: sample.clientY, x: state.targetX, y: state.targetY };
			grabPeel(state, u, v);
			setLifted(true);
			onPeel?.();
		}
		wake();
	}, [draggable, onLand, onPeel, state, wake]);

	// The reference lets the detached sheet follow the pointer without holding
	// a button. The next click on the sheet lays it down; Escape cancels a carry.
	useEffect(() => {
		if (!lifted || !draggable) {
			return;
		}
		const follow = (event: globalThis.PointerEvent) => {
			const anchor = carryRef.current;
			const sample = pointerRef.current;
			sample.clientX = event.clientX;
			sample.clientY = event.clientY;
			sample.valid = true;
			dragPeel(state, anchor.x + event.clientX - anchor.clientX, anchor.y + event.clientY - anchor.clientY);
			wake();
		};
		const cancel = () => {
			if (state.held) {
				togglePeel();
			}
		};
		const escape = (event: globalThis.KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				cancel();
			}
		};
		window.addEventListener("pointermove", follow);
		window.addEventListener("pointercancel", cancel);
		window.addEventListener("blur", cancel);
		window.addEventListener("keydown", escape);
		return () => {
			window.removeEventListener("pointermove", follow);
			window.removeEventListener("pointercancel", cancel);
			window.removeEventListener("blur", cancel);
			window.removeEventListener("keydown", escape);
		};
	}, [lifted, draggable, state, togglePeel, wake]);

	const handlePointerDown = useCallback((event: PointerEvent<HTMLButtonElement>) => {
		if (!draggable || event.button !== 0 || !event.isPrimary || !hitRef.current) {
			return;
		}
		event.currentTarget.focus({ preventScroll: true });
		pointerRef.current = { clientX: event.clientX, clientY: event.clientY, valid: true };
		const uv = resolvePeelUv(hitRef.current, box, event.clientX, event.clientY);
		togglePeel(uv.u, uv.v);
	}, [box, draggable, togglePeel]);

	const handleClick = useCallback((event: MouseEvent<HTMLButtonElement>) => {
		// Keyboard and assistive technology activation use native button clicks.
		// Pointer activation already began the fold on pointerdown.
		if (event.detail === 0) {
			togglePeel();
		}
	}, [togglePeel]);

	const handleKeyDown = useCallback(
		(event: KeyboardEvent<HTMLButtonElement>) => {
			if (!draggable) {
				return;
			}
			if (event.repeat && (event.key === "Enter" || event.key === " ")) {
				event.preventDefault();
				return;
			}
			const step = event.shiftKey ? PEEL_NUDGE_STEP * 4 : PEEL_NUDGE_STEP;

			switch (event.key) {
				case "ArrowLeft":
					nudgePeel(state, -step, 0);
					break;
				case "ArrowRight":
					nudgePeel(state, step, 0);
					break;
				case "ArrowUp":
					nudgePeel(state, 0, -step);
					break;
				case "ArrowDown":
					nudgePeel(state, 0, step);
					break;
				default:
					return;
			}

			event.preventDefault();
			wake();
		},
		[draggable, state, wake],
	);

	const handleFocus = useCallback(() => {
		// Focus lights the sheen, so tabbing to a stamp shows the same surface
		// a pointer user gets rather than a flat one.
		pointPeel(state, 0.32, 0.7);
		hoverPeel(state, true);
		wake();
	}, [state, wake]);

	const handleBlur = useCallback(() => {
		hoverPeel(state, false);
		wake();
	}, [state, wake]);

	// The caller's ref and the observer's ref are the same node, so they have
	// to be merged rather than chosen between — forwarding only the caller's
	// would silently leave the canvas permanently unmounted.
	const setRootNode = useCallback(
		(node: HTMLDivElement | null) => {
			rootRef.current = node;
			if (typeof ref === "function") {
				ref(node);
			} else if (ref) {
				ref.current = node;
			}
		},
		[ref],
	);

	return (
		<div
			ref={setRootNode}
			className={cn("relative inline-block align-top", className)}
			style={{ ...style, width, height: sheetHeight }}
		>
			{/* Kept separate from the layout slot so the drag transform never
			    moves the box that surrounding content is flowing around. */}
			<div ref={liftRef} className="absolute inset-0 will-change-transform">
				<div
					aria-hidden
					className="pointer-events-none absolute"
					style={{ inset: -overscan }}
				>
					{inView ? (
						<Canvas
							frameloop={active ? "always" : "demand"}
							dpr={[1, 2]}
							gl={{ antialias: true, alpha: true }}
							// R3F writes `pointer-events: auto` inline on its
							// container, which beats the `none` inherited from
							// the wrapper. Without this the canvas stays
							// interactive — and because it overscans the stamp
							// on every side, its invisible margin would swallow
							// clicks on whatever sits behind it.
							style={{ pointerEvents: "none" }}
							camera={{
								fov: PEEL_CAMERA_FOV,
								position: [0, 0, PEEL_CAMERA_DISTANCE],
								near: 0.1,
								far: 20,
							}}
						>
							<PeelScene
								state={state}
								tuning={resolvedTuning}
								liftRef={liftRef}
								hitRef={hitRef}
								pointerRef={pointerRef}
								box={box}
								aspect={aspect}
								surfaceColor={surfaceColor}
								src={src}
								onIdleChange={handleIdleChange}
							/>
						</Canvas>
					) : null}
				</div>

				{/* The hit area, not the canvas, owns input: the sheet is
				    displaced in a vertex shader, so scene-space picking would
				    disagree with what is on screen. */}
				<button
					type="button"
					ref={hitRef}
					disabled={!draggable}
					aria-pressed={lifted}
					aria-label={alt}
					tabIndex={draggable ? 0 : undefined}
					className={cn(
						"absolute inset-0 touch-none rounded-xs border-0 bg-transparent p-0 outline-none",
						"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focused",
						draggable ? (lifted ? "cursor-grabbing" : "cursor-grab") : null,
					)}
					onPointerEnter={handlePointerEnter}
					onPointerMove={handlePointerMove}
					onPointerLeave={handlePointerLeave}
					onPointerDown={handlePointerDown}
					onClick={handleClick}
					onKeyDown={handleKeyDown}
					onFocus={handleFocus}
					onBlur={handleBlur}
				/>

			</div>
		</div>
	);
}

export {
	PEEL_STAMP_RATIO,
	PEEL_FINISHES,
	PEEL_FINISH_PRESETS,
	PEEL_TUNING_DEFAULTS,
	resolvePeelTuning,
	type PeelFinish,
	type PeelTuning,
} from "./data";

export default Peel;

export { PeelSurface, type PeelSurfaceProps } from "./peel-surface";
