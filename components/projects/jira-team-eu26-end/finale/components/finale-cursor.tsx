"use client";

import { useLayoutEffect, useRef, useState } from "react";

import type { FinaleSlot } from "../data/finale-stories";
import type { FinaleViewport } from "../lib/finale-card-motion";
import { FINALE_CURSORS, cursorPose, type FinaleCursorPose } from "../lib/finale-cursor-path";
import type { PageCursor } from "../lib/finale-wall-cursors";
import { useFinaleFrame } from "../hooks/use-finale-frame";

/** The arrow's tip inside its 30×30 box; the cursor is placed and pressed about it. */
const TIP = { x: 3, y: 2.5 } as const;

interface FinaleTelepointerProps {
	/** Arrow and name-pill fill. */
	readonly color: string;
	/** Name ink on that fill. */
	readonly ink: string;
	readonly label: string;
	readonly ref?: React.Ref<HTMLDivElement>;
}

/**
 * Multiplayer cursor from the Figma bento frame: an arrow plus a lozenge name
 * tag in the collaborator's colour, drawn at the 1920 stage size. Decorative:
 * it starts hidden and is placed imperatively by its owner, which may turn it
 * over (`data-pill="above"`): mirrored top to bottom about its tip, the arrow
 * points down onto what it holds and its name sits above, still upright, its
 * shadow still below.
 */
export function FinaleTelepointer({ color, ink, label, ref }: Readonly<FinaleTelepointerProps>) {
	return (
		<div
			ref={ref}
			aria-hidden
			data-finale-cursor={label}
			className="group pointer-events-none absolute top-0 left-0"
			style={{
				opacity: 0,
				visibility: "hidden",
				transformOrigin: `${TIP.x}px ${TIP.y}px`,
				willChange: "transform, opacity",
				filter: "drop-shadow(0 0 0.5px rgba(30, 31, 33, 0.31)) drop-shadow(0 8px 6px rgba(30, 31, 33, 0.15))",
			}}
		>
			<div className="flex items-start group-data-[pill=above]:-scale-y-100" style={{ transformOrigin: `${TIP.x}px ${TIP.y}px` }}>
				<svg width={30} height={30} viewBox="0 0 30 30" className="shrink-0">
					<path
						d="M3 2.5 L26.5 12.2 L15.6 15.6 L12.2 26.5 Z"
						fill={color}
						stroke="#FFFFFF"
						strokeWidth={2.4}
						strokeLinejoin="round"
					/>
				</svg>
				<span
					className="mt-5 -ml-1 rounded-full font-sans font-semibold whitespace-nowrap group-data-[pill=above]:-scale-y-100"
					style={{ background: color, color: ink, fontSize: 20, lineHeight: 1, padding: "10px 16px" }}
				>
					{label}
				</span>
			</div>
		</div>
	);
}

/** A telepointer's colours and name. */
interface FinaleTelepointerLook {
	readonly id: string;
	readonly label: string;
	readonly color: string;
	readonly ink: string;
}

interface FinaleTelepointersProps {
	readonly looks: readonly FinaleTelepointerLook[];
	/**
	 * Cursor `index` (of `looks`) at `time`: its tip in viewport px, press or
	 * perspective scale, opacity, and whether it is turned over with its name
	 * above (`pillAbove`); null while it is off.
	 */
	readonly poseAt: (time: number, index: number) => (FinaleCursorPose & { readonly pillAbove?: boolean }) | null;
	/** Stage fit: the cursors are drawn at the 1920 stage size and scaled with the type. */
	readonly scale: number;
}

/**
 * One telepointer per look, placed every frame by `poseAt`. A cursor that is
 * off (or faded out) is hidden, and a resting one is not rewritten. A render
 * (a wall cursor taking a new name) places the last frame again at once, as
 * the clock may be held.
 */
function FinaleTelepointers({ looks, poseAt, scale }: Readonly<FinaleTelepointersProps>) {
	const refs = useRef<(HTMLDivElement | null)[]>([]);
	const written = useRef<{ opacity: string; transform: string }[]>([]);
	const lastTime = useRef<number | null>(null);

	const place = (time: number) => {
		lastTime.current = time;
		refs.current.forEach((element, index) => {
			if (!element) return;
			const pose = poseAt(time, index);
			const visibility = pose && pose.opacity > 0 ? "visible" : "hidden";
			if (element.style.visibility !== visibility) element.style.visibility = visibility;
			if (!pose || visibility === "hidden") return;
			const last = (written.current[index] ??= { opacity: "", transform: "" });
			const pill = pose.pillAbove ? "above" : "below";
			if (element.dataset.pill !== pill) element.dataset.pill = pill;
			const opacity = String(pose.opacity);
			const transform = `translate3d(${pose.x - TIP.x}px, ${pose.y - TIP.y}px, 0) scale(${scale * pose.scale})`;
			if (last.opacity !== opacity) {
				last.opacity = opacity;
				element.style.opacity = opacity;
			}
			if (last.transform !== transform) {
				last.transform = transform;
				element.style.transform = transform;
			}
		});
	};
	useFinaleFrame(place);
	useLayoutEffect(() => {
		if (lastTime.current !== null) place(lastTime.current);
	});

	return (
		<>
			{looks.map((look, index) => (
				<FinaleTelepointer
					key={look.id}
					ref={(element) => {
						refs.current[index] = element;
						// A fresh element has none of the styles written to the last one.
						written.current[index] = { opacity: "", transform: "" };
					}}
					color={look.color}
					ink={look.ink}
					label={look.label}
				/>
			))}
		</>
	);
}

interface FinaleCursorsProps {
	readonly slots: readonly FinaleSlot[];
	readonly viewport: FinaleViewport;
	/** Stage fit: the cursors are drawn at the 1920 stage size and scaled with the type. */
	readonly scale: number;
}

/**
 * The four presenters' cursors placing the final cards while the bento
 * assembles. Their motion is `cursorPose` on the finale clock.
 */
export function FinaleCursors({ slots, viewport, scale }: Readonly<FinaleCursorsProps>) {
	return <FinaleTelepointers looks={FINALE_CURSORS} scale={scale} poseAt={(time, index) => cursorPose(time, index, slots, viewport, scale)} />;
}

interface FinaleWallCursorsProps {
	/** The wall's cursors at `time` (`wallCursorsAt`): who holds which card, in which lane. */
	readonly cursorsAt: (time: number) => readonly PageCursor[];
	/** Stage fit: the cursors are drawn at the 1920 stage size and scaled with the type. */
	readonly scale: number;
}

const INITIAL_WALL_LOOKS = FINALE_CURSORS.map((_, colorIndex) => ({ name: "", colorIndex }));

/**
 * The mega bento's cursors: one lane per cursor, named and coloured for the
 * teammate holding its card. An idle lane keeps its last look; a new holder
 * stays hidden until its own look is rendered.
 */
export function FinaleWallCursors({ cursorsAt, scale }: Readonly<FinaleWallCursorsProps>) {
	const [looks, setLooks] = useState(INITIAL_WALL_LOOKS);
	const holderAt = (time: number, lane: number) => cursorsAt(time).find((cursor) => cursor.lane === lane);

	useFinaleFrame((time) => {
		const next = looks.map((look, lane) => {
			const holder = holderAt(time, lane);
			return holder ? { name: holder.name, colorIndex: holder.colorIndex } : look;
		});
		if (next.some((look, lane) => look.name !== looks[lane].name || look.colorIndex !== looks[lane].colorIndex)) setLooks(next);
	});

	return (
		<FinaleTelepointers
			looks={FINALE_CURSORS.map(({ id }, lane) => {
				const { color, ink } = FINALE_CURSORS[looks[lane].colorIndex];
				return { id, color, ink, label: looks[lane].name };
			})}
			scale={scale}
			poseAt={(time, lane) => {
				const cursor = holderAt(time, lane);
				return cursor && cursor.name === looks[lane].name && cursor.colorIndex === looks[lane].colorIndex ? cursor : null;
			}}
		/>
	);
}
