"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

const PREVIEW_ROUTE_PREFIX = "/preview/";

const subscribeToEmbeddedState = () => () => {};

// The root layout's pre-hydration script marks <html data-embedded> before first paint when the
// document runs inside an iframe (or with ?embedded=1), and that never changes for the document.
function getEmbeddedSnapshot(): boolean {
	return document.documentElement.dataset.embedded !== undefined;
}

// Same-origin embeds (home and catalog cards) only ever load /preview/* routes, so the static
// export renders those as embedded and every other route as a top-level page.
function useIsEmbeddedDocument(isPreviewRoute: boolean): boolean {
	return useSyncExternalStore(
		subscribeToEmbeddedState,
		isPreviewRoute ? getEmbeddedSnapshot : () => false,
		() => isPreviewRoute,
	);
}

/**
 * The app's single main landmark and skip-link target. A preview embedded in another VPK page
 * renders a plain wrapper instead, so the host page keeps one unique main (axe merges frames for
 * landmark-unique). The native <main> stays because axe and HTML-AAM only scope a page header out
 * of the banner role under a real <main> element, not under role="main".
 *
 * Only a preview opened top-level swaps the wrapper for <main> after hydration (one remount); embedded
 * previews and every non-preview route hydrate with the element they keep.
 */
export function MainLandmark({ children }: Readonly<{ children: React.ReactNode }>) {
	const pathname = usePathname();
	const isEmbedded = useIsEmbeddedDocument(pathname?.startsWith(PREVIEW_ROUTE_PREFIX) ?? false);

	return isEmbedded ? <div id="main-content">{children}</div> : <main id="main-content">{children}</main>;
}
