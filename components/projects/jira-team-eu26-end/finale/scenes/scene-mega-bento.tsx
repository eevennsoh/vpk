"use client";

import { useMemo, type ReactNode } from "react";

import { FinaleWall } from "../components/finale-wall";
import { FinaleWallAccents } from "../components/finale-wall-accents";
import { FinaleWallGl } from "../components/finale-wall-gl";
import type { FinaleBentoLayout } from "../data/finale-stories";
import type { FinaleFit, FinaleViewport } from "../lib/finale-card-motion";
import { buildFinaleWall, wallGeometry, wallPrintShapes } from "../lib/finale-wall-layout";
import { bentoDrops } from "../lib/finale-wall-motion";
import { useFinaleStudio } from "../studio/use-finale-studio";
import type { FinaleSceneInput } from "./scene-board-to-bento";

export interface SceneMegaBentoProps extends Pick<FinaleSceneInput, "features" | "dragOrder" | "cardPrint" | "facePrint"> {
	readonly bento: FinaleBentoLayout;
	readonly fit: FinaleFit;
	readonly viewport: FinaleViewport;
	readonly reducedMotion: boolean;
	readonly children: ReactNode;
}

/** Act III surrounds the initial bento with its background and foreground layers. */
export function SceneMegaBento({ bento, fit, viewport, features, dragOrder, cardPrint, facePrint, reducedMotion, children }: Readonly<SceneMegaBentoProps>) {
	const studio = useFinaleStudio();
	const geometry = useMemo(() => wallGeometry(fit.scale, viewport, studio), [fit.scale, viewport, studio]);
	const wall = useMemo(() => buildFinaleWall(geometry, bento, features, dragOrder, studio), [geometry, bento, features, dragOrder, studio]);
	const drops = useMemo(() => bentoDrops(wall, bento.slots.map((slot) => slot.rect), bento.title), [wall, bento]);
	const prints = useMemo(() => wallPrintShapes(cardPrint), [cardPrint]);

	return (
		<>
			{reducedMotion ? null : <FinaleWall wall={wall} drops={drops} cardPrint={cardPrint} prints={prints} />}
			{children}
			{reducedMotion ? null : (
				<>
					<FinaleWallGl wall={wall} drops={drops} viewport={viewport} fit={fit} cardPrint={cardPrint} prints={prints} facePrint={facePrint} />
					<FinaleWallAccents wall={wall} drops={drops} fit={fit} viewport={viewport} prints={prints} />
				</>
			)}
		</>
	);
}
