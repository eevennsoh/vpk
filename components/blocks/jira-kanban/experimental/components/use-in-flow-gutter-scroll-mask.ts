"use client";

import { useEffect, useState, type RefObject } from "react";

import { createLatestAnimationFrame } from "@/lib/latest-animation-frame";

import {
	findInFlowGutterScrollport,
	hasInFlowGutterUnderlap,
	readInFlowGutterMaskRect,
} from "./in-flow-gutter-scroll-mask";

/**
 * Tells `onChange` whether painted UI sits under `host`'s leading gutter, as
 * the adjacent scrollport scrolls, resizes or changes; returns the unsubscribe.
 *
 * DOM changes around the column arrive in bursts (a card pick-up or drop
 * commits many), and every measure forces a layout of the whole board, so
 * they rebind and remeasure once per frame rather than once per burst.
 */
export function watchInFlowGutterScrollMask(
	host: HTMLElement,
	onChange: (maskActive: boolean) => void,
): () => void {
	let scrollport: HTMLElement | null = null;

	const syncMask = () => {
		onChange(hasInFlowGutterUnderlap(
			readInFlowGutterMaskRect(host),
			scrollport,
		));
	};

	const resizeObserver = new ResizeObserver(syncMask);
	resizeObserver.observe(host);

	const unbindScrollport = () => {
		if (!scrollport) {
			return;
		}
		scrollport.removeEventListener("scroll", syncMask);
		scrollport.removeEventListener("transitionend", syncMask);
		resizeObserver.unobserve(scrollport);
		scrollport = null;
	};

	const bindScrollport = () => {
		const nextScrollport = findInFlowGutterScrollport(host);
		if (nextScrollport === scrollport) {
			syncMask();
			return;
		}

		unbindScrollport();
		scrollport = nextScrollport;
		if (scrollport) {
			scrollport.addEventListener("scroll", syncMask, { passive: true });
			// Status columns animate max-width after childList; remeasure when that ends.
			scrollport.addEventListener("transitionend", syncMask);
			resizeObserver.observe(scrollport);
		}
		syncMask();
	};

	const mutations = createLatestAnimationFrame<null>({
		requestFrame: (callback) => window.requestAnimationFrame(callback),
		cancelFrame: (id) => window.cancelAnimationFrame(id),
		onFrame: bindScrollport,
	});
	bindScrollport();
	const observer = new MutationObserver(() => mutations.schedule(null));
	observer.observe(host.parentElement ?? host, { childList: true, subtree: true });
	window.addEventListener("resize", syncMask);

	return () => {
		observer.disconnect();
		mutations.dispose();
		resizeObserver.disconnect();
		window.removeEventListener("resize", syncMask);
		unbindScrollport();
	};
}

/**
 * Watches the adjacent Board or List scrollport and reports when painted UI
 * actually sits under the leading 24px Untracked gutter.
 */
export function useInFlowGutterScrollMask(
	hostRef: RefObject<HTMLElement | null>,
): boolean {
	const [maskActive, setMaskActive] = useState(false);

	useEffect(() => {
		const host = hostRef.current;
		if (!host) {
			return undefined;
		}
		return watchInFlowGutterScrollMask(host, setMaskActive);
	}, [hostRef]);

	return maskActive;
}
