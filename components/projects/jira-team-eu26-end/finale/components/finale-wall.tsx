"use client";

import { memo, useCallback, useRef, useState } from "react";

import { WALL_CUE } from "../data/finale-cues";
import { useFinaleFrame } from "../hooks/use-finale-frame";
import { wallPrintOpacity, type FinaleWall as FinaleWallModel, type WallPrintShapes, type WallSlot } from "../lib/finale-wall-layout";
import { visibleWallBuckets, wallActive, wallMounted, wallOffset, wallSlotPresence, type BentoDrop } from "../lib/finale-wall-motion";
import { FinaleWallPieceFrame, WallPieceHostContext, WallSlotMirrorContext, type WallPieceHost } from "./finale-wall-pieces";
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

/** A slot's presence on an element: its own card, or its pieces in the kit's frame. */
function writePresence(element: HTMLElement, shown: string, visibility: string, transform: string) {
	element.style.opacity = shown;
	element.style.visibility = visibility;
	element.style.transform = transform;
}

/**
 * One card on the wall, shown as `wallSlotPresence` says: coming up (a hair
 * small, settling) as the wall appears around the throw, or taking over from
 * its GL sheet once that has landed, to build its content from then on if it
 * landed blank; a print slot's Done cards each as their own sheets hand over.
 * Hidden, it is not painted at all; it writes only when its presence moves,
 * to its own card and to any pieces of it in the kit's frame (`mirror`).
 */
function WallSlotCard({ slot, wall, drops, cardPrint, prints }: Readonly<WallSlotCardProps>) {
	const ref = useRef<HTMLDivElement>(null);
	const writtenRef = useRef("");
	const cardsRef = useRef(0);
	const mirrorsRef = useRef<Set<HTMLElement> | null>(null);
	// When a slot's content builds is fixed for its wall; only its opacity and scale move with the clock.
	const { revealStart } = wallSlotPresence(slot, wall, drops, WALL_CUE.start);

	const mirror = useCallback((target: HTMLElement) => {
		const element = ref.current;
		if (element) writePresence(target, element.style.opacity, element.style.visibility, element.style.transform);
		const mirrors = (mirrorsRef.current ??= new Set());
		mirrors.add(target);
		return () => {
			mirrors.delete(target);
		};
	}, []);

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
		const visibility = opacity > 0 ? "visible" : "hidden";
		writePresence(element, shown, visibility, transform);
		for (const target of mirrorsRef.current ?? []) writePresence(target, shown, visibility, transform);
		// Each printed card reads its own (a card printed later picks it up as it mounts).
		each.forEach((value, index) => element.style.setProperty(wallPrintOpacity(index), value));
		for (let index = each.length; index < cardsRef.current; index += 1) element.style.removeProperty(wallPrintOpacity(index));
		cardsRef.current = each.length;
	});

	return (
		<div ref={ref} className="absolute" style={{ left: slot.rect.x, top: slot.rect.y, width: slot.rect.width, height: slot.rect.height, opacity: 0, visibility: "hidden" }}>
			<WallSlotMirrorContext value={mirror}>
				<FinaleWallTileContent slot={slot} geometry={wall.geometry} cardPrint={cardPrint} revealStart={revealStart} />
			</WallSlotMirrorContext>
		</div>
	);
}

interface WallBucketProps {
	readonly slots: readonly WallSlot[];
	readonly wall: FinaleWallModel;
	readonly drops: readonly BentoDrop[];
	readonly cardPrint: CardPrint;
	readonly prints: WallPrintShapes;
}

/** One bucket of the wall; it renders once, when it comes into range. */
const WallBucket = memo(function WallBucket({ slots, wall, drops, cardPrint, prints }: Readonly<WallBucketProps>) {
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
 * track carries every bucket left at the wall's pace; only the buckets in or
 * beside the frame are mounted, so React renders only as one comes in or
 * leaves. Its cards come up around the throw from the middle of the frame
 * out, or take over from the GL sheets landing on it (`FinaleWallGl`, drawn
 * above). Its buckets mount hidden on the bento's held final frame
 * (`wallMounted`) and show once the act starts. Its product tiles' pieces
 * are drawn by the Rovo Stage Kit in a frame laid over the cards, on a track
 * of its own that moves with this one (`FinaleWallPieceFrame`).
 */
export function FinaleWall({ wall, drops, cardPrint, prints }: Readonly<FinaleWallProps>) {
	const rootRef = useRef<HTMLDivElement>(null);
	const trackRef = useRef<HTMLDivElement>(null);
	const [range, setRange] = useState<{ first: number; last: number } | null>(null);
	const rangeRef = useRef<{ first: number; last: number } | null>(null);
	const transformRef = useRef("");
	const [pieceHost, setPieceHost] = useState<WallPieceHost | null>(null);
	const pieceTrackRef = useRef<HTMLDivElement | null>(null);
	const { geometry } = wall;

	// The kit's frame keeps its own track; it moves exactly as the wall's does, from wherever the wall is now.
	const hostPieces = useCallback((host: WallPieceHost | null) => {
		pieceTrackRef.current = host?.track ?? null;
		if (host) host.track.style.transform = transformRef.current;
		setPieceHost(host);
	}, []);

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
			if (pieceTrackRef.current) pieceTrackRef.current.style.transform = transform;
		}
		const next = visibleWallBuckets(offset, geometry);
		const current = rangeRef.current;
		// A bucket enters or leaves every few seconds; only then does the wall re-render.
		if (!current || current.first !== next.first || current.last !== next.last) {
			rangeRef.current = next;
			setRange(next);
		}
	});

	const buckets = range ? Array.from({ length: range.last - range.first + 1 }, (_, index) => range.first + index) : [];

	return (
		<div ref={rootRef} aria-hidden className="absolute inset-0 overflow-hidden" style={{ visibility: "hidden" }}>
			<WallPieceHostContext value={pieceHost}>
				<div ref={trackRef} className="absolute top-0 left-0" style={{ willChange: "transform" }}>
					{buckets.map((bucket) => (
						<WallBucket key={bucket} slots={wall.bucket(bucket)} wall={wall} drops={drops} cardPrint={cardPrint} prints={prints} />
					))}
				</div>
			</WallPieceHostContext>
			{/* Over the cards, under everything the scene draws above the wall: the product tiles' Rovo Stage Kit pieces. */}
			<FinaleWallPieceFrame onHost={hostPieces} />
		</div>
	);
}
