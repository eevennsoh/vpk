"use client";

import { CUE } from "../data/finale-cues";
import { FinaleBuildSpan, buildAfter } from "./finale-build-text";

/** "Team 26" set exactly as the finale's title settles (`finale-team-title.tsx`), for the wall's title tiles. */
export const FINALE_TITLE_FONT_SIZE = 112;
export const FINALE_TITLE_LINE = 1.1;

interface FinaleTitleLockupProps {
	readonly ink: string;
	/** When it builds ("Team" through the colour band, then the year); null: already built. */
	readonly revealStart: number | null;
}

export function FinaleTitleLockup({ ink, revealStart }: Readonly<FinaleTitleLockupProps>) {
	return (
		<div
			className="flex items-baseline justify-center gap-[0.22em] whitespace-nowrap"
			style={{ fontSize: FINALE_TITLE_FONT_SIZE, lineHeight: FINALE_TITLE_LINE, height: FINALE_TITLE_FONT_SIZE * FINALE_TITLE_LINE, fontFamily: "var(--font-sans)", fontWeight: 400 }}
		>
			<FinaleBuildSpan text="Team" start={revealStart} duration={CUE.reveal * 0.85} ink={ink} />
			<FinaleBuildSpan text="26" start={buildAfter(revealStart, CUE.reveal * 0.4)} duration={CUE.reveal * 0.6} ink={ink} />
		</div>
	);
}
