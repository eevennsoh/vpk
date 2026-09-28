"use client";

import { useState } from "react";

import { TWGAppstack } from "@/components/ui-custom/twg-appstack";

import { FINALE_COLORS } from "../data/finale-palette";
import type { FinaleSlot, FinaleStory } from "../data/finale-stories";
import { FinaleBuildText } from "./finale-build-text";
import { useFinaleFrame } from "../hooks/use-finale-frame";

export const FINALE_TILE_RADIUS = 20;

interface FinaleTileFaceProps {
	readonly story: FinaleStory;
	readonly slot: FinaleSlot;
	/** Stage-to-viewport type scale: the face is laid out at slot size ÷ scale, then scaled up. */
	readonly scale: number;
	/** When the logo and heading start to build (finale-clock seconds). */
	readonly revealStart: number;
}

/**
 * Slide-side face of a bento tile, laid out in stage units: just the product
 * logo top-left and the feature heading — the Figma bento's editorial minimum.
 * It lands as an empty sheet (matching the GL tile it takes over from), then
 * the logos deal in with the app stack's own left-to-right entrance while the
 * heading builds.
 */
export function FinaleTileFace({ story, slot, scale, revealStart }: Readonly<FinaleTileFaceProps>) {
	const [revealed, setRevealed] = useState(false);
	const short = slot.short;

	// The stack animates on mount, so it mounts when the clock reaches the
	// reveal (and unmounts on a seek back, to replay it).
	useFinaleFrame((time) => {
		const next = time >= revealStart;
		setRevealed((current) => (current === next ? current : next));
	});

	return (
		<div
			className="flex flex-col overflow-hidden"
			style={{ width: slot.rect.width / scale, height: slot.rect.height / scale, padding: short ? 32 : 40, borderRadius: FINALE_TILE_RADIUS, background: FINALE_COLORS.tile }}
		>
			<div className="flex h-12 origin-top-left scale-150">
				{revealed ? <TWGAppstack direction="left-to-right" iconSize="medium" sources={story.apps} aria-hidden /> : null}
			</div>
			<FinaleBuildText
				text={story.lines.join("\n")}
				start={revealStart}
				className="mt-auto whitespace-pre-line font-sans"
				style={{ fontSize: short ? 48 : 60, lineHeight: 1.05, fontWeight: 400 }}
			/>
		</div>
	);
}
