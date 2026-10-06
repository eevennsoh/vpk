"use client";

import { useEffect, useRef } from "react";

import { CARD } from "../renderer/constants";
import { drawCard } from "../renderer/card-art";
import { loadCardArt } from "../renderer/card-sources";
import type { CardTheme } from "../renderer/types";
import { LANYARD_3D_ASSETS, type Lanyard3DAgent } from "../data";

interface Lanyard3DCardPreviewProps {
	readonly agent: Lanyard3DAgent;
	readonly theme: CardTheme;
}

const PREVIEW_WIDTH = 72;
const PREVIEW_HEIGHT = PREVIEW_WIDTH * CARD.height / CARD.width;
const PIXEL_RATIO = 3;

/** The agent's card face, which hides behind the person's card once the lanyard settles. */
export function Lanyard3DCardPreview({ agent, theme }: Readonly<Lanyard3DCardPreviewProps>) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		let cancelled = false;
		loadCardArt(LANYARD_3D_ASSETS).then((art) => {
			if (cancelled) return;
			const ctx = canvas.getContext("2d")!;
			const scale = canvas.width / CARD.width;
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.setTransform(scale, 0, 0, scale, -CARD.x * scale, -CARD.y * scale);
			drawCard(ctx, { ...art, portrait: null }, { ...agent, photo: null }, 0, agent, theme);
		}, () => undefined);
		return () => { cancelled = true; };
	}, [agent, theme]);

	return (
		<span aria-label={`${agent.name} card preview`} className="block shrink-0" role="img" style={{ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT }}>
			<canvas className="size-full rounded-md" height={Math.round(PREVIEW_HEIGHT * PIXEL_RATIO)} ref={canvasRef} width={PREVIEW_WIDTH * PIXEL_RATIO} />
		</span>
	);
}
