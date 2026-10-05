"use client";

import { memo, useRef, useState } from "react";

import { WALL_CUE } from "../data/finale-cues";
import { useFinaleFrame } from "../hooks/use-finale-frame";
import { wallPrintOpacity, type FinaleWall as FinaleWallModel, type WallPrintShapes, type WallSlot } from "../lib/finale-wall-layout";
import { visibleColumns, wallActive, wallMounted, wallOffset, wallSlotPresence, type BentoDrop } from "../lib/finale-wall-motion";
import { FinaleWallTileContent } from "./finale-wall-tiles";

type CardPrint = (code: string) => HTMLCanvasElement | undefined;

interface WallSlotCardProps {
	readonly slot: WallSlot;
	readonly wall: FinaleWallModel;
	readonly drops: readonly BentoDrop[];
	readonly cardPrint: CardPrint;
	readonly prints: WallPrintShapes;
}

const opacityText = (opacity: number) => (opacity >= 1 ? "1" : opacity.toFixed(3));

/**
 * One card on the wall, shown as `wallSlotPresence` says: coming up (a hair
 * small, settling) as the wall appears around the throw, or taking over from
 * its GL sheet once that has landed, to build its content from then on if it
 * landed blank; a print slot's Done cards each as their own sheets hand over.
 * Hidden, it is not painted at all; it writes only when its presence moves.
 */
function WallSlotCard({ slot, wall, drops, cardPrint, prints }: Readonly<WallSlotCardProps>) {
	const ref = useRef<HTMLDivElement>(null);
	const writtenRef = useRef("");
	const cardsRef = useRef(0);
	// When a slot's content builds is fixed for its wall; only its opacity and scale move with the clock.
	const { revealStart } = wallSlotPresence(slot, wall, drops, WALL_CUE.start);

	useFinaleFrame((time) => {
		const element = ref.current;
		if (!element) return;
		const { opacity, scale, cards } = wallSlotPresence(slot, wall, drops, time, prints);
		const shown = opacityText(opacity);
		const transform = scale >= 1 ? "" : `scale(${scale.toFixed(4)})`;
		const each = cards?.map(opacityText) ?? [];
		const written = `${shown}|${transform}|${each.join(",")}`;
		if (written === writtenRef.current) return;
		writtenRef.current = written;
		element.style.opacity = shown;
		element.style.visibility = opacity > 0 ? "visible" : "hidden";
		element.style.transform = transform;
		// Each printed card reads its own (a card printed later picks it up as it mounts).
		each.forEach((value, index) => element.style.setProperty(wallPrintOpacity(index), value));
		for (let index = each.length; index < cardsRef.current; index += 1) element.style.removeProperty(wallPrintOpacity(index));
		cardsRef.current = each.length;
	});

	return (
		<div ref={ref} className="absolute" style={{ left: slot.rect.x, top: slot.rect.y, width: slot.rect.width, height: slot.rect.height, opacity: 0, visibility: "hidden" }}>
			<FinaleWallTileContent slot={slot} geometry={wall.geometry} cardPrint={cardPrint} revealStart={revealStart} />
		</div>
	);
}

interface WallColumnProps {
	readonly slots: readonly WallSlot[];
	readonly wall: FinaleWallModel;
	readonly drops: readonly BentoDrop[];
	readonly cardPrint: CardPrint;
	readonly prints: WallPrintShapes;
}

/** One column of the wall; it renders once, when it comes into range. */
const WallColumn = memo(function WallColumn({ slots, wall, drops, cardPrint, prints }: Readonly<WallColumnProps>) {
	return slots.map((slot) => <WallSlotCard key={slot.key} slot={slot} wall={wall} drops={drops} cardPrint={cardPrint} prints={prints} />);
});

interface FinaleWallProps {
	readonly wall: FinaleWallModel;
	/** The bento's cards and the gaps they land in. */
	readonly drops: readonly BentoDrop[];
	readonly cardPrint: CardPrint;
	/** Those prints' shapes, as the GL layer and the accents take them. */
	readonly prints: WallPrintShapes;
}

/**
 * Act III's mega bento, as DOM: the crisp faces of every card on it. One
 * track carries every column left at the wall's pace; only the columns in or
 * beside the frame are mounted, so React renders only as one comes in or
 * leaves. Its cards come up around the throw from the middle of the frame
 * out, or take over from the GL sheets landing on it (`FinaleWallGl`, drawn
 * above). Its columns mount hidden on the bento's held final frame
 * (`wallMounted`) and show once the act starts.
 */
export function FinaleWall({ wall, drops, cardPrint, prints }: Readonly<FinaleWallProps>) {
	const rootRef = useRef<HTMLDivElement>(null);
	const trackRef = useRef<HTMLDivElement>(null);
	const [range, setRange] = useState<{ first: number; last: number } | null>(null);
	const rangeRef = useRef<{ first: number; last: number } | null>(null);
	const transformRef = useRef("");
	const { geometry } = wall;

	useFinaleFrame((time) => {
		const root = rootRef.current;
		const visibility = wallActive(time) ? "visible" : "hidden";
		if (root && root.style.visibility !== visibility) root.style.visibility = visibility;
		if (!wallMounted(time)) {
			if (rangeRef.current !== null) {
				rangeRef.current = null;
				setRange(null);
			}
			return;
		}
		const offset = wallOffset(time, geometry);
		const transform = `translate3d(${(geometry.originX - offset).toFixed(2)}px, 0, 0)`;
		const track = trackRef.current;
		if (track && transformRef.current !== transform) {
			transformRef.current = transform;
			track.style.transform = transform;
		}
		const next = visibleColumns(offset, geometry);
		const current = rangeRef.current;
		// A column enters or leaves every few seconds; only then does the wall re-render.
		if (!current || current.first !== next.first || current.last !== next.last) {
			rangeRef.current = next;
			setRange(next);
		}
	});

	const columns = range ? Array.from({ length: range.last - range.first + 1 }, (_, index) => range.first + index) : [];

	return (
		<div ref={rootRef} aria-hidden className="absolute inset-0 overflow-hidden" style={{ visibility: "hidden" }}>
			<div ref={trackRef} className="absolute top-0 left-0" style={{ willChange: "transform" }}>
				{columns.map((column) => (
					<WallColumn key={column} slots={wall.column(column)} wall={wall} drops={drops} cardPrint={cardPrint} prints={prints} />
				))}
			</div>
		</div>
	);
}
