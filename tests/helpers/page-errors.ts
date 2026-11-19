/**
 * Records what a page reports as broken while a spec drives it: uncaught exceptions
 * (`pageerror`) and `console.error` messages. Attach before `page.goto` so the first
 * load is covered.
 */
import type { Page } from "@playwright/test";

export type PageErrorLog = Readonly<{
	/** Uncaught exceptions and rejected promises the page did not handle. */
	pageErrors: string[];
	/** Text of every `console.error` call. */
	consoleErrors: string[];
}>;

// React names hydration in development; the production build reports minified codes
// 418 (server and client markup differ), 422 (a hydration error inside a Suspense
// boundary forced a client render), 423 (hydration fell back to client render) and
// 425 (text content mismatch).
const HYDRATION_ERROR = /hydrat|Minified React error #(?:418|422|423|425)\b/iu;

export function collectPageErrors(page: Page): PageErrorLog {
	const log: PageErrorLog = { pageErrors: [], consoleErrors: [] };
	page.on("pageerror", (error) => log.pageErrors.push(error.message));
	page.on("console", (message) => {
		if (message.type() === "error") log.consoleErrors.push(message.text());
	});
	return log;
}

/** Every recorded message, from either source, that reports a hydration failure. */
export function hydrationErrors(log: PageErrorLog): string[] {
	return [...log.pageErrors, ...log.consoleErrors].filter((message) => HYDRATION_ERROR.test(message));
}
