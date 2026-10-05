"use client";

import type { CSSProperties, Ref } from "react";

import type { FinaleSlot, FinaleStory } from "../data/finale-stories";
import { FinaleTileFace } from "./finale-tile-face";

interface FinaleBentoTileProps {
	readonly story: FinaleStory;
	readonly slot: FinaleSlot;
	/** Stage-to-viewport scale: the face is laid out at the 1920 stage, then scaled onto the slot. */
	readonly scale: number;
	readonly ref?: Ref<HTMLDivElement>;
	readonly className?: string;
	readonly style?: CSSProperties;
}

/**
 * A bento tile on its slot's viewport rect, its face built from the start.
 * The slide shows it and its face prints are taken of it, so the sheet that
 * lands on a slot and the tile it hands over to are one picture.
 */
export function FinaleBentoTile({ story, slot, scale, ref, className, style }: Readonly<FinaleBentoTileProps>) {
	return (
		<div ref={ref} className={className} style={{ width: slot.rect.width, height: slot.rect.height, ...style }}>
			<div style={{ transform: `scale(${scale})`, transformOrigin: "0 0" }}>
				<FinaleTileFace story={story} slot={slot} scale={scale} revealStart={null} />
			</div>
		</div>
	);
}
