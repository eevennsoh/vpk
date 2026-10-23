/*
 * runtime/review — the ws0 pipeline adapter for the vpk-review runtime (ws1 C13, integration R13).
 *
 * Replace-only: on demo and artifact kinds it refreshes the `review` and `review-content`
 * blocks in place when their markers exist, and never inserts them. The first insert is
 * `build.mjs --inject-review` (or `--stamp` on a reviewable ledger). Importing this module
 * reads no files and loads no heavy dependency (R28): esbuild loads on the first refresh
 * of a file that carries the markers.
 */

import { refreshReviewRuntime } from "../review/inject.mjs";

export const reviewRuntimeStep = Object.freeze({
	id: "review",
	kinds: Object.freeze(["demo", "artifact"]),
	apply: html => refreshReviewRuntime(html),
});
