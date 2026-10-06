"use client";

import { useMemo, useRef, useState } from "react";

import type { FinaleFit, FinaleViewport } from "../lib/finale-card-motion";
import type { FinaleWall, WallPrintShapes } from "../lib/finale-wall-layout";
import { wallCursorsAt } from "../lib/finale-wall-cursors";
import { wallActive, wallLandingsAt, type BentoDrop } from "../lib/finale-wall-motion";
import { useFinaleFrame } from "../hooks/use-finale-frame";
import { FinaleWallCursors } from "./finale-cursor";
import { FinaleTileGlow } from "./finale-tile-glow";

/** `compute`, worked out once per clock reading however many layers ask for it in that frame. */
function perFrame<T>(compute: (time: number) => T): (time: number) => T {
	const memo: { time: number; value: T | null } = { time: Number.NaN, value: null };
	return (time) => {
		if (memo.value !== null && memo.time === time) return memo.value;
		const value = compute(time);
		memo.time = time;
		memo.value = value;
		return value;
	};
}

interface FinaleWallAccentsProps {
	readonly wall: FinaleWall;
	readonly drops: readonly BentoDrop[];
	readonly fit: FinaleFit;
	readonly viewport: FinaleViewport;
	/** The Done cards' print shapes: each of a print slot's cards glows and is held on its own. */
	readonly prints: WallPrintShapes;
}

/**
 * The mega bento's landing accents, as on the slide: every card that lands
 * on it — the bento's tiles and title in their gaps, then each card that
 * comes down from the leading edge — gets the border glow the bento's tiles
 * got, on its rect as the wall carries it. MCB drags the title into its gap,
 * and then now and then a teammate takes a waiting card and sets it down.
 *
 * The accents were authored for the bento's tiles; on the wall's smaller ones
 * the bloom and smoke shrink with the wall's type scale, so they read in
 * proportion. The glow's core stays the slide's hairline: thinner,
 * it would fall between pixels and shimmer as the wall glides. The cursors
 * are drawn as the slide's, in its four colours, MCB's named as on the slide
 * and the rest for teammates from the avatar roster, at the stage fit, larger
 * as a held card nears the lens.
 *
 * Nothing mounts until the wall exists (so never on the reduced-motion rest
 * frame), and it comes down again if the clock is taken back before it. A
 * layer that mounts on a held frame is handed that frame by the registry.
 */
export function FinaleWallAccents({ wall, drops, fit, viewport, prints }: Readonly<FinaleWallAccentsProps>) {
	const [active, setActive] = useState(false);
	const activeRef = useRef(false);
	const { geometry } = wall;

	const landingsAt = useMemo(() => perFrame((time) => wallLandingsAt(time, wall, drops, prints)), [wall, drops, prints]);
	const cursorsAt = useMemo(() => perFrame((time) => wallCursorsAt(time, wall, drops, viewport, prints)), [wall, drops, viewport, prints]);

	// Only as the wall comes or goes does this re-render.
	useFinaleFrame((time) => {
		const next = wallActive(time);
		if (next === activeRef.current) return;
		activeRef.current = next;
		setActive(next);
	});

	if (!active) return null;
	return (
		<div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
			<FinaleTileGlow landings={landingsAt} radius={geometry.radius} scale={geometry.typeScale} stroke={fit.scale} viewport={viewport} />
			<FinaleWallCursors cursorsAt={cursorsAt} scale={fit.scale} />
		</div>
	);
}
