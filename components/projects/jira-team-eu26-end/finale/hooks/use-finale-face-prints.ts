"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { currentFinaleStageFit, type FinaleStageFit } from "../lib/finale-stage-fit";
import { printFinaleElement } from "./use-finale-prints";

/** A bento face print's key: its tile's landing order, as the slide's and the wall's sheets look it up. */
export function finaleFacePrintKey(order: number): string {
	return `bento-${order}`;
}

function layoutKey(fit: Pick<FinaleStageFit, "width" | "height">): string {
	return `${fit.width}x${fit.height}`;
}

interface FacePrintRun {
	readonly layout: string;
	readonly prints: Map<string, HTMLCanvasElement>;
	done: boolean;
	readonly waiters: (() => void)[];
}

export interface FinaleFacePrints {
	/** A tile's face print for the window as it is now; undefined until it is printed. */
	readonly get: (key: string) => HTMLCanvasElement | undefined;
	/** Prints every bento face for the window as it is now, unless that is done; resolves when it is. */
	readonly ensure: () => Promise<void>;
	/** The fit the print stage lays its tiles out at while a run prints (null between runs). */
	readonly stage: FinaleStageFit | null;
	/** The print stage's tiles, mounted, in landing order: print them one idle slot at a time. */
	readonly print: (fit: FinaleStageFit, tiles: readonly (HTMLElement | null)[]) => void;
}

const idle = (callback: () => void) => (window.requestIdleCallback ?? ((next: () => void) => window.setTimeout(next, 50)))(callback);

/**
 * Prints of the bento's six faces (`bento-<order>`), taken ahead of the
 * finale as the Done cards' prints are, so each landing sheet turns from its
 * card straight into its tile and the thrown sheets carry the same faces. They
 * are printed off a hidden stage (`FinaleFacePrintStage`) at the window's
 * fit, and only for it: after a resize `ensure` prints them again.
 */
export function useFinaleFacePrints(): FinaleFacePrints {
	const runRef = useRef<FacePrintRun | null>(null);
	const [stage, setStage] = useState<FinaleStageFit | null>(null);

	const get = useCallback((key: string) => {
		const run = runRef.current;
		return run && run.layout === layoutKey(currentFinaleStageFit()) ? run.prints.get(key) : undefined;
	}, []);

	const ensure = useCallback(() => {
		const fit = currentFinaleStageFit();
		const layout = layoutKey(fit);
		const current = runRef.current;
		if (current?.layout === layout && current.done) return Promise.resolve();
		return new Promise<void>((resolve) => {
			if (current?.layout === layout) {
				current.waiters.push(resolve);
				return;
			}
			for (const waiter of current?.waiters ?? []) waiter();
			runRef.current = { layout, prints: new Map(), done: false, waiters: [resolve] };
			setStage(fit);
		});
	}, []);

	const print = useCallback((fit: FinaleStageFit, tiles: readonly (HTMLElement | null)[]) => {
		const run = runRef.current;
		if (!run || run.layout !== layoutKey(fit)) return;
		const next = (order: number) => {
			if (runRef.current !== run) return;
			if (order >= tiles.length) {
				run.done = true;
				for (const waiter of run.waiters.splice(0)) waiter();
				setStage(null);
				return;
			}
			idle(() => {
				const tile = tiles[order];
				if (!tile || runRef.current !== run) return next(order + 1);
				// Detached, as card prints are: the copy pins single-line text so the print never re-wraps it.
				void printFinaleElement(tile, { detach: true })
					.then((canvas) => run.prints.set(finaleFacePrintKey(order), canvas))
					.catch(() => undefined)
					.finally(() => next(order + 1));
			});
		};
		next(0);
	}, []);

	return useMemo(() => ({ get, ensure, stage, print }), [ensure, get, print, stage]);
}
