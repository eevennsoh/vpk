"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";

import { TWGAppstack, type TwgToolSource } from "@/components/ui-custom/twg-appstack";

import { CUE } from "../data/finale-cues";
import { FINALE_COLORS } from "../data/finale-palette";
import type { FinaleSlot, FinaleStory } from "../data/finale-stories";
import { EASE, progress } from "../lib/finale-math";
import { FinaleBuildText } from "./finale-build-text";
import { useFinaleFrame } from "../hooks/use-finale-frame";

export const FINALE_TILE_RADIUS = 20;

interface FinaleTileLogosProps {
	readonly sources: readonly TwgToolSource[];
	/** When they deal in (finale-clock seconds); null: already there. */
	readonly revealStart: number | null;
	readonly className?: string;
}

/** Shown, the logos either deal in or (the clock already past their entrance) are simply there. */
type LogosShown = "hidden" | "dealing" | "dealt";

/**
 * A tile's product logos, dealt in with the app stack's own left-to-right
 * entrance. The stack animates on mount, so it mounts when the clock reaches
 * the reveal (and unmounts on a seek back, to replay it); it renders again
 * only when that flips. A tile that mounts past its entrance (a seek, a held
 * frame) shows them settled at once, as its heading shows built, so a print
 * taken then is the tile as it rests.
 */
export function FinaleTileLogos({ sources, revealStart, className }: Readonly<FinaleTileLogosProps>) {
	const [shown, setShown] = useState<LogosShown>(revealStart === null ? "dealt" : "hidden");
	const shownRef = useRef<LogosShown | null>(null);

	useFinaleFrame((time) => {
		if (revealStart === null) return;
		const current = shownRef.current ?? shown;
		const next: LogosShown = time < revealStart ? "hidden" : current !== "hidden" ? current : time < revealStart + CUE.reveal ? "dealing" : "dealt";
		if (next === shownRef.current) return;
		shownRef.current = next;
		setShown(next);
	});

	return (
		<div className={className}>
			{shown === "hidden" ? null : <TWGAppstack animated={shown === "dealing"} direction="left-to-right" iconSize="medium" sources={sources} aria-hidden />}
		</div>
	);
}

/** The app stack's entrance, as `TWGAppstack` plays it: a beat between items, each fading in sharp from the right. */
const DEAL_STAGGER_S = 0.18;
const DEAL_S = 0.36;
const DEAL_OFFSET = 14;
const DEAL_BLUR = 6;

interface FinaleDealtProps {
	/** When the first item deals in (finale-clock seconds); null: already there. */
	readonly start: number | null;
	/** Its place in the deal: each item comes a beat after the last. */
	readonly index?: number;
	readonly className?: string;
	readonly style?: CSSProperties;
	readonly children: ReactNode;
}

/**
 * Anything else dealt onto a landed tile (an avatar, a lozenge, a button),
 * with the app stack's own entrance but on the finale clock, so it scrubs.
 * It writes only while it deals in, and clears its styles once in.
 */
export function FinaleDealt({ start, index = 0, className = "flex", style, children }: Readonly<FinaleDealtProps>) {
	const ref = useRef<HTMLDivElement>(null);
	const amountRef = useRef(Number.NaN);
	useFinaleFrame((time) => {
		const element = ref.current;
		if (!element || start === null) return;
		const at = start + index * DEAL_STAGGER_S;
		const amount = EASE.outBold(progress(time, at, at + DEAL_S));
		if (amount === amountRef.current) return;
		amountRef.current = amount;
		const rest = 1 - amount;
		element.style.opacity = amount >= 1 ? "1" : amount.toFixed(3);
		// 2D, so a dealt item paints with its card instead of taking a compositor layer of its own.
		element.style.transform = amount >= 1 ? "" : `translate(${(rest * DEAL_OFFSET).toFixed(2)}px, 0)`;
		element.style.filter = amount >= 1 ? "" : `blur(${(rest * DEAL_BLUR).toFixed(2)}px)`;
	});
	return (
		<div ref={ref} className={className} style={start === null ? style : { ...style, opacity: 0 }}>
			{children}
		</div>
	);
}

interface FinaleTileFaceProps {
	readonly story: FinaleStory;
	readonly slot: Pick<FinaleSlot, "rect" | "short">;
	/** Stage-to-viewport type scale: the face is laid out at slot size ÷ scale, then scaled up. */
	readonly scale: number;
	/**
	 * When the logo and heading start to build (finale-clock seconds). Null
	 * shows it already built, as a card that was on the wall all along.
	 */
	readonly revealStart: number | null;
}

const HEADING_STYLE = { lineHeight: 1.05, fontWeight: 400 } as const;

/**
 * Slide-side face of a bento tile, laid out in stage units: just the product
 * logo top-left and the feature heading — the Figma bento's editorial minimum.
 * It lands as an empty sheet (matching the GL tile it takes over from), then
 * the logos deal in with the app stack's own left-to-right entrance while the
 * heading builds.
 */
export function FinaleTileFace({ story, slot, scale, revealStart }: Readonly<FinaleTileFaceProps>) {
	const short = slot.short;
	return (
		<div
			className="flex flex-col overflow-hidden"
			style={{ width: slot.rect.width / scale, height: slot.rect.height / scale, padding: short ? 32 : 40, borderRadius: FINALE_TILE_RADIUS, background: FINALE_COLORS.tile }}
		>
			<FinaleTileLogos sources={story.apps} revealStart={revealStart} className="flex h-12 origin-top-left scale-150" />
			<FinaleBuildText
				text={story.lines.join("\n")}
				start={revealStart}
				className="mt-auto whitespace-pre-line font-sans"
				style={{ ...HEADING_STYLE, fontSize: short ? 48 : 60 }}
			/>
		</div>
	);
}
