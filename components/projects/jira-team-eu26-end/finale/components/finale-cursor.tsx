"use client";

import { useRef } from "react";

import type { FinaleSlot } from "../data/finale-stories";
import type { FinaleViewport } from "../lib/finale-card-motion";
import { FINALE_CURSORS, cursorPose } from "../lib/finale-cursor-path";
import { useFinaleFrame } from "./finale-frame";

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
	const refs = useRef<(HTMLDivElement | null)[]>([]);

	useFinaleFrame((time) => {
		refs.current.forEach((element, index) => {
			if (!element) return;
			const pose = cursorPose(time, index, slots, viewport, scale);
			if (!pose) {
				if (element.style.visibility !== "hidden") element.style.visibility = "hidden";
				return;
			}
			element.style.visibility = "visible";
			element.style.opacity = String(pose.opacity);
			element.style.transform = `translate3d(${pose.x - TIP.x}px, ${pose.y - TIP.y}px, 0) scale(${scale * pose.scale})`;
		});
	});

	return (
		<>
			{FINALE_CURSORS.map((cursor, index) => (
				<FinaleTelepointer
					key={cursor.id}
					ref={(element) => { refs.current[index] = element; }}
					color={cursor.color}
					ink={cursor.ink}
					label={cursor.label}
				/>
			))}
		</>
	);
}
