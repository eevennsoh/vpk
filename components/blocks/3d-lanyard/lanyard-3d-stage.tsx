"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { dimensions } from "./renderer/constants";
import { createLanyardRenderer } from "./renderer/lanyard-renderer";
import type { LanyardConfig } from "./renderer/types";
import { LANYARD_3D_ASSETS } from "./data";
import { LanyardPlayer } from "./lanyard-player";
import { Lanyard3DTransport } from "./components/lanyard-3d-transport";

export interface Lanyard3DStageProps {
	config: LanyardConfig;
	/** Plays the drop and swing on mount; reduced-motion users get the settled pose instead. */
	autoPlay?: boolean;
	className?: string;
}

const MAX_PIXEL_RATIO = 2;

/** Draws the lanyard into a canvas that fits its container at the chosen aspect ratio. */
export function Lanyard3DStage({ config, autoPlay = true, className }: Readonly<Lanyard3DStageProps>) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const configRef = useRef(config);
	const syncRef = useRef<((config: LanyardConfig) => void) | null>(null);
	const [player, setPlayer] = useState<LanyardPlayer | null>(null);
	const [failed, setFailed] = useState(false);
	const [width, height] = dimensions[config.format];

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const renderer = createLanyardRenderer(canvas, LANYARD_3D_ASSETS);
		const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
		const next = new LanyardPlayer(renderer.duration, (time) => renderer.draw(time, configRef.current), () => reducedMotion.matches);
		let cancelled = false;

		const fit = () => {
			const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
			canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio));
			canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio));
			next.redraw();
		};
		const observer = new ResizeObserver(fit);
		observer.observe(canvas);

		renderer.ready
			.then(() => renderer.setPortrait(configRef.current.photo).catch(() => undefined))
			.then(() => {
				if (cancelled) return;
				fit();
				setPlayer(next);
				if (autoPlay) next.play();
				else next.finish();
			})
			.catch(() => { if (!cancelled) setFailed(true); });

		// The renderer is built once; config flows in through syncRef. Changes redraw the current frame and swap the portrait without restarting playback.
		const syncConfig = (config: LanyardConfig) => {
			configRef.current = config;
			// setPortrait clears the previous image synchronously, so this redraw never pairs
			// the new name with the old face; initials show until the new photo decodes.
			const portrait = renderer.setPortrait(config.photo);
			next.redraw();
			portrait.then(() => next.redraw(), () => next.redraw());
		};
		syncRef.current = syncConfig;

		return () => {
			cancelled = true;
			syncRef.current = null;
			observer.disconnect();
			next.dispose();
			renderer.dispose();
			setPlayer(null);
		};
	}, [autoPlay]);

	useEffect(() => { syncRef.current?.(config); }, [config]);

	const label = `Animated lanyard for ${config.name.replace(/\n/g, " ")}, ${config.role.replace(/\n/g, " ")}, paired with ${config.backCard.name}`;

	return (
		<div className={cn("flex min-h-0 flex-col gap-3", className)} data-slot="lanyard-3d-stage">
			<div className="flex min-h-0 flex-1 items-center justify-center" style={{ containerType: "size" }}>
				<div aria-label={label} role="img" style={{ aspectRatio: `${width} / ${height}`, width: `min(100cqw, calc(100cqh * ${width / height}))` }}>
					<canvas className="block size-full rounded-xl" ref={canvasRef} />
				</div>
			</div>
			{failed ? <p className="text-center text-sm text-text-danger" role="alert">The lanyard could not load its artwork.</p> : null}
			{player ? <Lanyard3DTransport player={player} /> : <div aria-hidden className="h-8" />}
		</div>
	);
}
