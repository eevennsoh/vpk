"use client";

import { createContext, use, useEffect, useLayoutEffect, useMemo, useRef } from "react";

import type { PieceStyles } from "@/public/1p/rovo-stage-kit/types/stage-file";

import { FINALE_COLORS } from "../data/finale-palette";
import { useFinaleFrame } from "../hooks/use-finale-frame";
import { wallPiecesLayout, pieceStillAfter, ROVO_STAGE_KIT_FAILED, ROVO_STAGE_KIT_READY, rovoStageKitSrcdoc, type RovoStageKit, type RovoStageKitWindow } from "../lib/finale-wall-pieces";
import type { WallGeometry, WallPiece, WallSlot } from "../lib/finale-wall-layout";
import { slotOnScreen, wallOffset, wallSlotRevealTime } from "../lib/finale-wall-motion";
import { applyFinaleDeal, finaleDealAmount, FINALE_TILE_RADIUS_CSS } from "./finale-tile";

/*
 * The mega bento's product tiles: each a grey card on the wall, its Rovo
 * Stage Kit pieces drawn by the kit in a frame of its own laid over the wall
 * (`lib/finale-wall-pieces.ts`). The wall moves the frame's track as it moves
 * its own, and each slot mirrors its presence (opacity, visibility, scale)
 * onto its pieces, so a piece rides its card exactly. Each piece is held on
 * the finale clock, its moment starting as its card appears: so it scrubs,
 * holds and pauses with the rest of the finale, and never runs a clock of
 * its own.
 */

/** The kit, loaded in its frame, and the track in that frame the wall moves. */
export interface WallPieceHost {
	readonly kit: RovoStageKit;
	readonly track: HTMLDivElement;
}

export const WallPieceHostContext = createContext<WallPieceHost | null>(null);

/** A slot's presence, written to `element` too from now on; returns the detach. */
export type WallSlotMirror = (element: HTMLElement) => () => void;

export const WallSlotMirrorContext = createContext<WallSlotMirror | null>(null);

const SRCDOC = rovoStageKitSrcdoc();

/**
 * `<rovo-piece>` as the kit defines it in its frame. Its own declaration
 * (`types/element.d.ts`) adds the tag to every page's DOM types, so only what
 * the wall uses is spelled out here.
 */
type RovoPiece = HTMLElement & { pieceStyles: PieceStyles | undefined; redraw(): void };

interface FinaleWallPieceFrameProps {
	/** The host once the kit is in (null again as the frame goes). */
	readonly onHost: (host: WallPieceHost | null) => void;
}

/**
 * The kit's own frame over the wall: transparent, light, inert and hidden
 * from assistive tech (the wall itself is aria-hidden decoration). It mounts
 * with the scene, while the confetti flies, so the kit has loaded by the
 * time the wall appears.
 */
export function FinaleWallPieceFrame({ onHost }: Readonly<FinaleWallPieceFrameProps>) {
	const ref = useRef<HTMLIFrameElement>(null);
	useEffect(() => {
		const frame = ref.current;
		if (!frame) return undefined;
		let track: HTMLDivElement | null = null;
		const open = () => {
			const kit = (frame.contentWindow as (Window & RovoStageKitWindow) | null)?.rovoStageKit;
			const body = frame.contentDocument?.body;
			if (track || !kit || !body) return;
			track = body.ownerDocument.createElement("div");
			track.style.cssText = "position:absolute;top:0;left:0;will-change:transform";
			body.append(track);
			onHost({ kit, track });
		};
		const failed = (event: Event) => console.warn("Rovo Stage Kit did not load; the wall's product tiles stay blank.", (event as CustomEvent<string>).detail);
		frame.addEventListener(ROVO_STAGE_KIT_READY, open);
		frame.addEventListener(ROVO_STAGE_KIT_FAILED, failed);
		// It may have loaded before this ran (a remount in development).
		open();
		return () => {
			frame.removeEventListener(ROVO_STAGE_KIT_READY, open);
			frame.removeEventListener(ROVO_STAGE_KIT_FAILED, failed);
			track?.remove();
			onHost(null);
		};
	}, [onHost]);
	return (
		<iframe
			ref={ref}
			title="Rovo stage pieces"
			srcDoc={SRCDOC}
			aria-hidden
			tabIndex={-1}
			inert
			className="pointer-events-none absolute inset-0 size-full border-0"
			style={{ colorScheme: "light" }}
		/>
	);
}

/** A tile's pieces as mounted in the kit's frame. */
interface MountedPieces {
	/** Takes the slot's presence. */
	readonly holder: HTMLDivElement;
	/** Takes the deal-in of a card that landed blank. */
	readonly inner: HTMLDivElement;
	readonly pieces: readonly { readonly element: RovoPiece; readonly still: number | null; written: number }[];
	dealt: number;
}

/** Seconds past a piece's last moving frame it is still written, so it rests on that frame exactly. */
const STILL_MARGIN_S = 0.25;
/** A jump in a piece's time at least this long (a seek) redraws it, so it is crisp where it lands. */
const SEEK_JUMP_S = 1;

function mountPieces(host: WallPieceHost, slot: WallSlot, pieceScale: number, specs: readonly WallPiece[]): MountedPieces | null {
	const { kit, track } = host;
	// A piece this kit does not draw (a stage file newer than the kit) is dropped, as the kit drops it.
	const known = specs.flatMap(({ id, scale }) => kit.pieces.filter((piece) => piece.id === id).map((piece) => ({ ...piece, scale })));
	if (known.length === 0) return null;
	const doc = track.ownerDocument;
	const { x, y, width, height } = slot.rect;
	const holder = doc.createElement("div");
	holder.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${width}px;height:${height}px;opacity:0;visibility:hidden`;
	const inner = doc.createElement("div");
	inner.style.cssText = "position:absolute;inset:0";
	const { boxes } = wallPiecesLayout(known, pieceScale);
	const pieces = boxes.map((box, index) => {
		const element = doc.createElement("rovo-piece") as RovoPiece;
		element.setAttribute("piece", box.id);
		element.setAttribute("scale", box.scale.toFixed(4));
		element.setAttribute("appearance", "light");
		element.setAttribute("time", "0");
		element.pieceStyles = kit.pieceStyles;
		element.style.cssText = `position:absolute;left:${box.x}px;top:${box.y}px`;
		inner.append(element);
		return { element, still: pieceStillAfter(known[index], kit.pieceStyles[box.id]), written: Number.NaN };
	});
	holder.append(inner);
	track.append(holder);
	return { holder, inner, pieces, dealt: Number.NaN };
}

interface WallPiecesProps {
	readonly slot: WallSlot;
	readonly geometry: WallGeometry;
	readonly pieces: readonly WallPiece[];
	/** When it builds (it landed blank), or null: it was on the wall all along. */
	readonly revealStart: number | null;
}

/**
 * A product tile: its grey card here, its pieces in the kit's frame over
 * it. A card that landed blank deals its pieces in as it builds, in the
 * bento's own entrance; one already there shows them at once. Either way
 * each piece's moment starts as its card appears, and its time is written
 * only while it is on screen and its frame still moves.
 */
export function WallPieces({ slot, geometry, pieces, revealStart }: Readonly<WallPiecesProps>) {
	const host = use(WallPieceHostContext);
	const mirror = use(WallSlotMirrorContext);
	const mountedRef = useRef<MountedPieces | null>(null);
	const timeRef = useRef<number | null>(null);
	const origin = useMemo(() => revealStart ?? wallSlotRevealTime(slot, geometry), [geometry, revealStart, slot]);

	const paint = (time: number) => {
		const mounted = mountedRef.current;
		if (!mounted) return;
		if (revealStart !== null) {
			const amount = finaleDealAmount(time, revealStart);
			if (amount !== mounted.dealt) {
				mounted.dealt = amount;
				applyFinaleDeal(mounted.inner, amount, geometry.typeScale);
			}
		}
		// Not gated on the slot's presence: its slot writes that after this runs, and a piece is only
		// ever hidden before its moment starts, where its time is 0 and nothing is written.
		const rect = slotOnScreen(slot, wallOffset(time, geometry), geometry);
		if (rect.x > geometry.viewport.width || rect.x + rect.width < 0) return;
		const elapsed = Math.max(0, time - origin);
		for (const piece of mounted.pieces) {
			const shown = piece.still === null ? elapsed : Math.min(elapsed, piece.still + STILL_MARGIN_S);
			if (shown === piece.written) continue;
			const jumped = Math.abs(shown - piece.written) >= SEEK_JUMP_S;
			piece.written = shown;
			piece.element.setAttribute("time", shown.toFixed(3));
			if (jumped) piece.element.redraw();
		}
	};

	const paintRef = useRef<(time: number) => void>(() => {});
	useLayoutEffect(() => {
		paintRef.current = paint;
	});

	useLayoutEffect(() => {
		if (!host) return undefined;
		const mounted = mountPieces(host, slot, geometry.pieceScale, pieces);
		if (!mounted) return undefined;
		mountedRef.current = mounted;
		const detach = mirror?.(mounted.holder);
		// The frame may already hold its time (a held clock emits no new one).
		if (timeRef.current !== null) paintRef.current(timeRef.current);
		return () => {
			detach?.();
			mounted.holder.remove();
			mountedRef.current = null;
		};
	}, [geometry, host, mirror, pieces, slot]);

	useFinaleFrame((time) => {
		timeRef.current = time;
		paintRef.current(time);
	});

	return <div className="absolute inset-0" style={{ background: FINALE_COLORS.tile, borderRadius: FINALE_TILE_RADIUS_CSS }} />;
}
