/**
 * The one reader for "this document runs embedded in another page". The root layout's
 * pre-hydration script marks `<html data-embedded>` before first paint when the document runs in
 * an iframe (same- or cross-origin) or with `?embedded=1`, and the flag never changes for the life
 * of the document. Read it through `useSyncExternalStore(subscribeToEmbeddedDocument,
 * isEmbeddedDocument, <server snapshot>)` so hydration never mismatches.
 */
export function isEmbeddedDocument(): boolean {
	return document.documentElement.dataset.embedded !== undefined;
}

/** The flag is fixed for the document, so there is nothing to subscribe to. */
export function subscribeToEmbeddedDocument(): () => void {
	return noop;
}

function noop(): void {}
