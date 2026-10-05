"use client";

import { CUE } from "../data/finale-cues";
import { FINALE_TITLE } from "../data/finale-title";
import { buildAfter } from "../lib/finale-build-style";
import { FinaleBuildSpan } from "./finale-build-text";

const TRACKING = `${FINALE_TITLE.tracking}em`;

interface FinaleTitleLockupProps {
	readonly ink: string;
	/** When it builds ("Team ’26" through the colour band, then "Europe"); null: already built. */
	readonly revealStart: number | null;
}

/** "Team ’26 Europe" set exactly as the finale's title settles (`finale-team-title.tsx`), for the wall's title tiles. */
export function FinaleTitleLockup({ ink, revealStart }: Readonly<FinaleTitleLockupProps>) {
	const [first, second] = FINALE_TITLE.lines;
	const lineHeight = FINALE_TITLE.fontSize * FINALE_TITLE.line;
	return (
		<div
			className="relative text-center whitespace-nowrap"
			style={{ top: -FINALE_TITLE.lift, fontSize: FINALE_TITLE.fontSize, lineHeight: FINALE_TITLE.line, fontFamily: "var(--font-sans)", fontWeight: 400 }}
		>
			<div style={{ height: lineHeight, marginBottom: FINALE_TITLE.fontSize * FINALE_TITLE.gap }}>
				<FinaleBuildSpan text={first} start={revealStart} duration={CUE.reveal * 0.85} ink={ink} tracking={TRACKING} />
			</div>
			<div style={{ height: lineHeight }}>
				<FinaleBuildSpan text={second} start={buildAfter(revealStart, CUE.reveal * 0.4)} duration={CUE.reveal * 0.6} ink={ink} tracking={TRACKING} />
			</div>
		</div>
	);
}
