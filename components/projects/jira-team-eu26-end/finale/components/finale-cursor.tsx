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
 * it starts hidden and is placed imperatively by its owner.
 */
export function FinaleTelepointer({ color, ink, label, ref }: Readonly<FinaleTelepointerProps>) {
	return (
		<div
			ref={ref}
			aria-hidden
			data-finale-cursor={label}
			className="pointer-events-none absolute top-0 left-0 flex items-start"
			style={{
				opacity: 0,
				visibility: "hidden",
				transformOrigin: `${TIP.x}px ${TIP.y}px`,
				willChange: "transform, opacity",
				filter: "drop-shadow(0 0 0.5px rgba(30, 31, 33, 0.31)) drop-shadow(0 8px 6px rgba(30, 31, 33, 0.15))",
			}}
		>
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
				className="mt-5 -ml-1 rounded-full font-sans font-semibold whitespace-nowrap"
				style={{ background: color, color: ink, fontSize: 20, lineHeight: 1, padding: "10px 16px" }}
			>
				{label}
			</span>
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
	 * perspective scale, and opacity; null while it is off.
	 */
	readonly poseAt: (time: number, index: number) => FinaleCursorPose | null;
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

const NO_NAMES: readonly string[] = FINALE_CURSORS.map(() => "");

/**
 * The mega bento's cursors: one lane per cursor colour of the slide, named
 * for the teammate holding its card (`PageCursor.name`). An idle lane keeps
 * its last name; as it takes a card from someone else it re-renders with the
 * new name and stays hidden until that name is in, so it never shows the
 * last holder's.
 */
export function FinaleWallCursors({ cursorsAt, scale }: Readonly<FinaleWallCursorsProps>) {
	const [names, setNames] = useState(NO_NAMES);
	const holderAt = (time: number, lane: number) => cursorsAt(time).find((cursor) => cursor.lane === lane);

	useFinaleFrame((time) => {
		const next = names.map((name, lane) => holderAt(time, lane)?.name ?? name);
		if (next.some((name, lane) => name !== names[lane])) setNames(next);
	});

	return (
		<FinaleTelepointers
			looks={FINALE_CURSORS.map(({ id, color, ink }, lane) => ({ id, color, ink, label: names[lane] }))}
			scale={scale}
			poseAt={(time, lane) => {
				const cursor = holderAt(time, lane);
				return cursor && cursor.name === names[lane] ? cursor : null;
			}}
		/>
	);
}
