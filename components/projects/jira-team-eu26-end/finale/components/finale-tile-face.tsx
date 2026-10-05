"use client";

import { FINALE_COLORS } from "../data/finale-palette";
import { isFinaleFeatureCode } from "../data/finale-stories";
import { FinaleBentoFace } from "./bento/finale-bento-face";
import { FINALE_TILE_RADIUS, FinaleHeadingFace, type FinaleTileFaceProps } from "./finale-tile";

/**
 * Slide-side face of a story's tile, laid out at slot size ÷ scale (the 1920
 * stage) and scaled up by its caller. The bento's six featured stories show
 * their own Figma faces, in full from the start, on the bento and wherever
 * they land on the wall; any other story shows its product logos and
 * heading, which build from `revealStart`.
 */
export function FinaleTileFace({ story, slot, scale, revealStart }: Readonly<FinaleTileFaceProps>) {
	if (!isFinaleFeatureCode(story.code)) return <FinaleHeadingFace story={story} slot={slot} scale={scale} revealStart={revealStart} />;
	return (
		<div
			className="relative overflow-hidden"
			style={{ width: slot.rect.width / scale, height: slot.rect.height / scale, borderRadius: FINALE_TILE_RADIUS, background: FINALE_COLORS.tile }}
		>
			<FinaleBentoFace code={story.code} />
		</div>
	);
}
