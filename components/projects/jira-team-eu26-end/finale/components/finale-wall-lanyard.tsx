"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";

import { LANYARD_3D_AGENTS, LANYARD_3D_DEFAULT_SCENE, LANYARD_3D_PROFILES } from "@/components/blocks/3d-lanyard/data";
import type { LanyardRenderer } from "@/components/blocks/3d-lanyard/renderer/lanyard-renderer";
import type { LanyardConfig } from "@/components/blocks/3d-lanyard/renderer/types";

import { FINALE_COLORS } from "../data/finale-palette";
import { useFinaleFrame } from "../hooks/use-finale-frame";
import { WALL_LANYARD_FRAMING_SWING, wallLanyardDeal, wallLanyardDropTime, wallLanyardTime } from "../lib/finale-wall-lanyard";
import { wallSlotRadius, type WallGeometry, type WallSlot } from "../lib/finale-wall-layout";
import { slotOnScreen, wallOffset } from "../lib/finale-wall-motion";
import { loadFinaleWallLanyard } from "../lib/load-finale-wall-lanyard";

const MAX_PIXEL_RATIO = 2;

/**
 * Lanyard `order` along the wall as the renderer draws it: its presenter in
 * front, its agent behind, at its own swing and reveal, framed for the
 * liveliest swing so the card keeps its size, on a clear ground (the tile is
 * the card).
 */
function lanyardConfig(order: number): LanyardConfig {
	const { person, agent, swing, revealAngle } = wallLanyardDeal(order, LANYARD_3D_PROFILES.length, LANYARD_3D_AGENTS.length);
	const profile = LANYARD_3D_PROFILES[person];
	return {
		name: profile.name, role: profile.role, photo: profile.photo,
		background: "transparent", format: "portrait", swing, framingSwing: WALL_LANYARD_FRAMING_SWING, revealAngle,
		backCard: LANYARD_3D_AGENTS[agent], backCardTheme: LANYARD_3D_DEFAULT_SCENE.agentTheme,
	};
}

interface WallLanyardProps {
	readonly slot: WallSlot;
	readonly geometry: WallGeometry;
	/** Its place in the wall's run of lanyards, which deals it. */
	readonly order: number;
}

/**
 * A lanyard tile: a grey card hanging from the top of the frame, whose
 * lanyard drops in from that edge once, swings out, and hangs still until the
 * wall carries it off (`finale-wall-lanyard.ts`). The renderer is
 * deterministic in its time, so it is drawn straight from the finale clock,
 * and only while it moves and its tile is on screen.
 */
export function WallLanyard({ slot, geometry, order }: Readonly<WallLanyardProps>) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const rendererRef = useRef<LanyardRenderer | null>(null);
	const timeRef = useRef<number | null>(null);
	const paintedRef = useRef({ time: Number.NaN, shown: false });
	const dropTime = useMemo(() => wallLanyardDropTime(slot, geometry), [geometry, slot]);
	const config = useMemo(() => lanyardConfig(order), [order]);
	const { width, height } = slot.rect;

	const paint = (time: number) => {
		const canvas = canvasRef.current;
		const renderer = rendererRef.current;
		if (!canvas || !renderer) return;
		const rect = slotOnScreen(slot, wallOffset(time, geometry), geometry);
		if (rect.x > geometry.viewport.width || rect.x + rect.width < 0) return;
		const painted = paintedRef.current;
		const at = wallLanyardTime(time, dropTime, renderer.duration);
		if (at === null) {
			if (painted.shown) canvas.style.visibility = "hidden";
			painted.shown = false;
			return;
		}
		if (at !== painted.time) {
			painted.time = at;
			renderer.draw(at, config);
		}
		if (!painted.shown) canvas.style.visibility = "visible";
		painted.shown = true;
	};

	const paintRef = useRef(paint);
	useLayoutEffect(() => {
		paintRef.current = paint;
	});

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return undefined;
		const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
		canvas.width = Math.max(1, Math.round(width * ratio));
		canvas.height = Math.max(1, Math.round(height * ratio));
		let cancelled = false;
		let renderer: LanyardRenderer | null = null;
		void loadFinaleWallLanyard()
			.then((create) => {
				if (cancelled) return undefined;
				const created = create(canvas);
				renderer = created;
				// Its face is prewarmed, so it decodes at once; a missing one draws initials.
				return created.ready.then(() => created.setPortrait(config.photo).catch(() => undefined)).then(() => {
					if (cancelled) return;
					rendererRef.current = created;
					paintedRef.current = { time: Number.NaN, shown: false };
					// The clock may be held, emitting no new reading.
					if (timeRef.current !== null) paintRef.current(timeRef.current);
				});
			})
			// Without its artwork the tile stays a plain grey card, as a kit piece does without its kit.
			.catch(() => undefined);
		return () => {
			cancelled = true;
			rendererRef.current = null;
			renderer?.dispose();
		};
	}, [config, width, height]);

	useFinaleFrame((time) => {
		timeRef.current = time;
		paintRef.current(time);
	});

	return (
		<div className="absolute inset-0 overflow-hidden" data-finale-wall-lanyard={slot.key} style={{ background: FINALE_COLORS.tile, borderRadius: wallSlotRadius(slot, geometry) }}>
			<canvas ref={canvasRef} className="absolute inset-0 size-full" style={{ visibility: "hidden" }} />
		</div>
	);
}
