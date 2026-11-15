"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { isEmbeddedDocument, subscribeToEmbeddedDocument } from "@/lib/embedded-document";

const PREVIEW_ROUTE_PREFIX = "/preview/";

const getNotEmbedded = () => false;

// VPK's own catalog embeds (home and catalog card iframes) load /preview/* routes, so the static
// export renders those as embedded and every other route as a top-level page. A non-preview route
// loaded in an iframe (e.g. through web-preview) keeps its <main>, as intended.
function useIsEmbeddedDocument(isPreviewRoute: boolean): boolean {
	return useSyncExternalStore(
		subscribeToEmbeddedDocument,
		isPreviewRoute ? isEmbeddedDocument : getNotEmbedded,
		() => isPreviewRoute,
	);
}

/**
 * The app's single main landmark and skip-link target. A preview embedded in another VPK page
 * renders a plain wrapper instead, so the host page keeps one unique main (axe merges frames for
 * landmark-unique). The native <main> stays because axe and HTML-AAM only scope a page header out
 * of the banner role under a real <main> element, not under role="main".
 *
 * Embedded previews and every non-preview route hydrate with the element they keep. Only a preview
 * opened top-level swaps the wrapper for <main> after hydration, so its children remount once
 * (effects, one-shot animations and canvases initialise twice); the alternative would remount every
 * embedded card instead.
 */
export function MainLandmark({ children }: Readonly<{ children: React.ReactNode }>) {
	const pathname = usePathname();
	const isEmbedded = useIsEmbeddedDocument(pathname?.startsWith(PREVIEW_ROUTE_PREFIX) ?? false);

	return isEmbedded ? <div id="main-content">{children}</div> : <main id="main-content">{children}</main>;
}
