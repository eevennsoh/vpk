"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";

import { LANYARD_3D_AGENTS, LANYARD_3D_DEFAULT_SCENE, LANYARD_3D_PROFILES } from "@/components/blocks/3d-lanyard/data";
import type { LanyardRenderer } from "@/components/blocks/3d-lanyard/renderer/lanyard-renderer";
import type { LanyardConfig } from "@/components/blocks/3d-lanyard/renderer/types";

import { FINALE_COLORS } from "../data/finale-palette";
import { useFinaleFrame } from "../hooks/use-finale-frame";
import { WALL_LANYARD_FRAMING_SWING, wallLanyardDrop, wallLanyardFirstDrop, wallLanyardFrame } from "../lib/finale-wall-lanyard";
import { wallSlotRadius, type WallGeometry, type WallSlot } from "../lib/finale-wall-layout";
import { slotOnScreen, wallOffset } from "../lib/finale-wall-motion";
import { loadFinaleWallLanyard } from "../lib/load-finale-wall-lanyard";

const MAX_PIXEL_RATIO = 2;

/**
 * Drop `drop` of `slot` as the renderer draws it: its presenter in front, its
 * agent behind, at its own swing and reveal, framed for the liveliest swing so
 * the card keeps its size, on a clear ground (the tile is the card).
 */
function lanyardConfig(slot: WallSlot, drop: number): LanyardConfig {
	const { person, agent, swing, revealAngle } = wallLanyardDrop(slot, drop, LANYARD_3D_PROFILES.length, LANYARD_3D_AGENTS.length);
	const profile = LANYARD_3D_PROFILES[person];
	return {
		name: profile.name, role: profile.role, photo: profile.photo,
		background: "transparent", format: "portrait", swing, framingSwing: WALL_LANYARD_FRAMING_SWING, revealAngle,
		backCard: LANYARD_3D_AGENTS[agent], backCardTheme: LANYARD_3D_DEFAULT_SCENE.agentTheme,
	};
}

interface Painted {
	drop: number;
	config: LanyardConfig | null;
	time: number;
	lift: number;
	shown: boolean;
}

interface WallLanyardProps {
	readonly slot: WallSlot;
	readonly geometry: WallGeometry;
}

/**
 * A lanyard tile: a grey card hanging from the top of the frame, whose
 * lanyard drops in from that edge, swings out, and is reeled back up for the
 * next presenter and agent (`finale-wall-lanyard.ts`). The renderer is
 * deterministic in its time, so it is drawn straight from the finale clock,
 * and only while it moves and its tile is on screen; the reel-up is the
 * canvas's own transform.
 */
export function WallLanyard({ slot, geometry }: Readonly<WallLanyardProps>) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const rendererRef = useRef<LanyardRenderer | null>(null);
	const timeRef = useRef<number | null>(null);
	const paintedRef = useRef<Painted>({ drop: -1, config: null, time: Number.NaN, lift: Number.NaN, shown: false });
	const firstDrop = useMemo(() => wallLanyardFirstDrop(slot, geometry), [geometry, slot]);
	const { width, height } = slot.rect;

	const paint = (time: number) => {
		const canvas = canvasRef.current;
		const renderer = rendererRef.current;
		if (!canvas || !renderer) return;
		const rect = slotOnScreen(slot, wallOffset(time, geometry), geometry);
		if (rect.x > geometry.viewport.width || rect.x + rect.width < 0) return;
		const painted = paintedRef.current;
		const frame = wallLanyardFrame(time, firstDrop, renderer.duration);
		if (!frame) {
			if (painted.shown) canvas.style.visibility = "hidden";
			painted.shown = false;
			return;
		}
		if (frame.drop !== painted.drop || !painted.config) {
			const config = lanyardConfig(slot, frame.drop);
			Object.assign(painted, { drop: frame.drop, config, time: Number.NaN });
			// Its face swaps in as it decodes (prewarmed, so within a frame); until then the card shows initials, still above the tile.
			const redraw = () => {
				if (rendererRef.current === renderer && painted.config === config && Number.isFinite(painted.time)) renderer.draw(painted.time, config);
			};
			renderer.setPortrait(config.photo).then(redraw, redraw);
		}
		if (frame.time !== painted.time && painted.config) {
			painted.time = frame.time;
			renderer.draw(frame.time, painted.config);
		}
		if (frame.lift !== painted.lift) {
			painted.lift = frame.lift;
			canvas.style.transform = frame.lift > 0 ? `translateY(${(-frame.lift * 100).toFixed(2)}%)` : "";
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
				return created.ready.then(() => {
					if (cancelled) return;
					rendererRef.current = created;
					paintedRef.current = { drop: -1, config: null, time: Number.NaN, lift: Number.NaN, shown: false };
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
	}, [width, height]);

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
