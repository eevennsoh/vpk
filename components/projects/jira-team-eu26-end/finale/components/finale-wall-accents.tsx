"use client";

import { useMemo, useRef, useState } from "react";

import type { FinaleFieldRipple, FinaleFit, FinaleViewport } from "../lib/finale-card-motion";
import type { FinaleCursorPose } from "../lib/finale-cursor-path";
import type { FinaleWall } from "../lib/finale-wall-layout";
import { wallActive, wallCursorsAt, wallLandingsAt, type BentoDrop } from "../lib/finale-wall-motion";
import { useFinaleFrame } from "../hooks/use-finale-frame";
import { FinalePresenterCursors } from "./finale-cursor";
import { FinaleDotField } from "./finale-dot-field";
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

const NO_RIPPLES: readonly FinaleFieldRipple[] = [];

interface FinaleWallAccentsProps {
	readonly wall: FinaleWall;
	readonly drops: readonly BentoDrop[];
	readonly fit: FinaleFit;
	readonly viewport: FinaleViewport;
}

/**
 * The mega bento's landing accents, as on the slide: every card that lands
 * on it — the bento's tiles and title in their gaps, then each card that
 * comes down from the leading edge — gets the border glow and the dot pulse
 * the bento's tiles got, on its rect as the wall carries it; and now and then
 * a presenter takes a waiting card by its corner and sets it down.
 *
 * The accents were authored for the bento's tiles; on the wall's smaller ones
 * the bloom, smoke, lattice and rings shrink with the wall's type scale, so
 * they read in proportion. The glow's core stays the slide's hairline: thinner,
 * it would fall between pixels and shimmer as the wall glides. The cursors
 * are the slide's, at the stage fit, larger as a held corner nears the lens.
 *
 * Nothing mounts until the wall exists (so never on the reduced-motion rest
 * frame), and it comes down again if the clock is taken back before it. A
 * layer that mounts on a held frame is handed that frame by the registry.
 */
export function FinaleWallAccents({ wall, drops, fit, viewport }: Readonly<FinaleWallAccentsProps>) {
	const [active, setActive] = useState(false);
	const activeRef = useRef(false);
	const { geometry } = wall;

	// The glow and the dot pulse share one reading of the landings each frame.
	const landingsAt = useMemo(() => perFrame((time) => wallLandingsAt(time, wall, drops)), [wall, drops]);
	const ripplesAt = useMemo(
		() => perFrame((time): readonly FinaleFieldRipple[] => {
			const landings = landingsAt(time);
			return landings.length === 0 ? NO_RIPPLES : landings.map((landing) => ({ from: landing.rect, start: landing.touchdown, amp: 1 }));
		}),
		[landingsAt],
	);
	const cursorsAt = useMemo(() => perFrame((time) => wallCursorsAt(time, wall, viewport)), [wall, viewport]);
	// Presenters go by their place in `FINALE_CURSORS` (Mike, Tamar, Sherif, Taroon), as `PageCursor.presenter` does.
	const poseAt = (time: number, index: number): FinaleCursorPose | null => {
		for (const cursor of cursorsAt(time)) if (cursor.presenter === index) return cursor;
		return null;
	};

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
			<FinaleDotField fit={fit} scale={geometry.typeScale} viewport={viewport} ripplesAt={ripplesAt} radius={geometry.radius} />
			<FinalePresenterCursors poseAt={poseAt} scale={fit.scale} />
		</div>
	);
}
