"use client";

import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";

import { FINALE_FEATURES, finaleBentoLayout } from "../data/finale-stories";
import type { FinaleFacePrints } from "../hooks/use-finale-face-prints";
import { FinaleBentoTile } from "./finale-bento-tile";

/**
 * The bento's six tiles, off screen, laid out as the slide will lay them out
 * for the window's fit, while their faces are printed (`useFinaleFacePrints`).
 * Under `body`, as the finale's dialog is, so they inherit what it inherits.
 */
export function FinaleFacePrintStage({ prints }: Readonly<{ prints: Pick<FinaleFacePrints, "stage" | "print"> }>) {
	const { stage, print } = prints;
	const tilesRef = useRef<(HTMLDivElement | null)[]>([]);
	const bento = useMemo(() => (stage ? finaleBentoLayout(stage, stage.scale) : null), [stage]);

	useEffect(() => {
		if (stage) print(stage, tilesRef.current);
	}, [print, stage]);

	if (!stage || !bento) return null;
	return createPortal(
		<div aria-hidden inert className="pointer-events-none fixed top-0 left-[-30000px] flex flex-col">
			{FINALE_FEATURES.map((story, order) => (
				<FinaleBentoTile
					key={story.code}
					ref={(element) => { tilesRef.current[order] = element; }}
					story={story}
					slot={bento.slots[order]}
					scale={stage.scale}
				/>
			))}
		</div>,
		document.body,
	);
}
