"use client";

/**
 * Peel — a sheet of printed paper you can lift off the page.
 *
 * Three behaviours, and each one is doing a job:
 *
 *   - at rest it lies flat under a tight contact shadow;
 *   - on hover an iridescent spot-gloss follows the cursor across the printed
 *     ink, the way UV varnish catches a light as you move your head;
 *   - on drag it peels — the grabbed corner comes up first, a ripple crosses
 *     the sheet, and releasing drops it where you let go with a second ripple
 *     from the same point.
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
import {
	PeelScene,
	resolvePeelUv,
	type PeelBox,
	type PeelPointerSample,
} from "./peel-scene";
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
	const hitRef = useRef<HTMLDivElement>(null);
	const pointerRef = useRef<PeelPointerSample>({ clientX: 0, clientY: 0, valid: false });
	/** Pointer/sheet offset captured when the sheet came up, so it hangs from the click point. */
	const carryRef = useRef({ clientX: 0, clientY: 0, x: 0, y: 0, viaPointer: false });

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
	const stateRef = useRef(createPeelState(resolvedTuning));
	useEffect(() => {
		stateRef.current.tuning = resolvedTuning;
	}, [resolvedTuning]);

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
		(event: PointerEvent<HTMLDivElement>) => {
			pointerRef.current = { clientX: event.clientX, clientY: event.clientY, valid: true };
			hoverPeel(stateRef.current, true);
			wake();
		},
		[wake],
	);

	const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
		const sample = pointerRef.current;
		sample.clientX = event.clientX;
		sample.clientY = event.clientY;
		sample.valid = true;
	}, []);

	const handlePointerLeave = useCallback(() => {
		pointerRef.current.valid = false;
		hoverPeel(stateRef.current, false);
	}, []);

	// While the sheet is up it follows the cursor with no button held, and the
	// next click — anywhere — puts it down.
	//
	// Both listeners are on the window rather than on the sheet. There is no
	// button held, so there is no pointer capture to ride on; and the sheet
	// trails the cursor on a spring, so a listener bound to the sheet would
	// stop receiving moves and clicks exactly while it is catching up, which is
	// when the user is most likely to click.
	//
	// The drop is ARMED by the lifting gesture's own pointerup, not attached
	// live. React flushes this effect synchronously during the discrete
	// pointerdown that lifted the sheet, so the listener is already on the
	// window while that same event is still bubbling — attach it unguarded and
	// one click lifts and instantly drops, which looks exactly like the click
	// doing nothing at all. A keyboard lift has no pointerup to wait for, so it
	// arms immediately.
	useEffect(() => {
		if (!lifted || !draggable) {
			return;
		}

		let armed = !carryRef.current.viaPointer;
		const arm = () => {
			armed = true;
		};

		const follow = (event: globalThis.PointerEvent) => {
			const anchor = carryRef.current;
			const sample = pointerRef.current;
			sample.clientX = event.clientX;
			sample.clientY = event.clientY;
			sample.valid = true;
			// Arithmetic only. Turning this into sheet UV needs a geometry
			// read, which the scene does once per frame after the model steps.
			dragPeel(
				stateRef.current,
				anchor.x + (event.clientX - anchor.clientX),
				anchor.y + (event.clientY - anchor.clientY),
			);
			wake();
		};

		const drop = () => {
			if (!armed) {
				return;
			}
			releasePeel(stateRef.current);
			setLifted(false);
			onLand?.();
			wake();
		};

		window.addEventListener("pointerup", arm, { once: true });
		window.addEventListener("pointermove", follow);
		window.addEventListener("pointerdown", drop);
		return () => {
			window.removeEventListener("pointerup", arm);
			window.removeEventListener("pointermove", follow);
			window.removeEventListener("pointerdown", drop);
		};
	}, [lifted, draggable, onLand, wake]);

	const handlePointerDown = useCallback(
		(event: PointerEvent<HTMLDivElement>) => {
			if (!draggable || !hitRef.current) {
				return;
			}

			const state = stateRef.current;
			if (state.held) {
				// Already up and following the cursor — the window listener
				// owns the second click. Doing it here as well would drop the
				// sheet twice and fire onLand twice.
				return;
			}

			// The anchor is the pointer's offset from the sheet at the moment
			// it comes up, so the sheet hangs from where it was clicked rather
			// than snapping its centre under the cursor.
			const uv = resolvePeelUv(hitRef.current, box, event.clientX, event.clientY);
			carryRef.current = {
				clientX: event.clientX,
				clientY: event.clientY,
				x: state.targetX,
				y: state.targetY,
				viaPointer: true,
			};

			grabPeel(state, uv.u, uv.v);
			setLifted(true);
			onPeel?.();
			wake();
		},
		[box, draggable, onPeel, wake],
	);

	const handleKeyDown = useCallback(
		(event: KeyboardEvent<HTMLDivElement>) => {
			if (!draggable) {
				return;
			}
			const state = stateRef.current;
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
				case "Enter":
				case " ": {
					// The same toggle the pointer gets, so a keyboard user can
					// lift the sheet, move it with the arrows, and set it down.
					if (state.held) {
						releasePeel(state);
						setLifted(false);
						onLand?.();
					} else {
						// Anchor the carry to wherever the pointer currently
						// is, even though the keyboard lifted it. Without this
						// the sheet keeps a stale anchor and jumps the moment
						// the mouse is nudged afterwards.
						const sample = pointerRef.current;
						carryRef.current = {
							clientX: sample.clientX,
							clientY: sample.clientY,
							x: state.targetX,
							y: state.targetY,
							viaPointer: false,
						};
						grabPeel(state, state.pointerU, state.pointerV);
						setLifted(true);
						onPeel?.();
					}
					break;
				}
				default:
					return;
			}

			event.preventDefault();
			wake();
		},
		[draggable, onLand, onPeel, wake],
	);

	const handleFocus = useCallback(() => {
		// Focus lights the sheen, so tabbing to a stamp shows the same surface
		// a pointer user gets rather than a flat one.
		pointPeel(stateRef.current, 0.32, 0.7);
		hoverPeel(stateRef.current, true);
		wake();
	}, [wake]);

	const handleBlur = useCallback(() => hoverPeel(stateRef.current, false), []);

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
			style={{ width, height: sheetHeight, ...style }}
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
								state={stateRef.current}
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
				<div
					ref={hitRef}
					role="img"
					aria-label={alt}
					tabIndex={draggable ? 0 : undefined}
					className={cn(
						"absolute inset-0 touch-none rounded-xs outline-none",
						"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focused",
						draggable && (lifted ? "cursor-grabbing" : "cursor-grab"),
					)}
					onPointerEnter={handlePointerEnter}
					onPointerMove={handlePointerMove}
					onPointerLeave={handlePointerLeave}
					onPointerDown={handlePointerDown}
					onKeyDown={handleKeyDown}
					onFocus={handleFocus}
					onBlur={handleBlur}
				/>

			</div>
		</div>
	);
}

export {
	PEEL_FINISHES,
	PEEL_FINISH_PRESETS,
	PEEL_TUNING_DEFAULTS,
	resolvePeelTuning,
	type PeelFinish,
	type PeelTuning,
} from "./data";

export default Peel;
