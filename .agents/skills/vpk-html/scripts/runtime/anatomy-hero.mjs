/*
 * runtime/anatomy-hero — the anatomy hero registry step (ws4b P-an-6; integration K2, R13).
 *
 * Owns two blocks per document: <!-- vpk-anatomy-css:start/end --> in <head> (upsertMarkedHeadBlock) and
 * <!-- vpk-anatomy-runtime:start/end --> before the last </body> (upsertMarkedBlock). Both are replaced in
 * place, never moved, and removed once no [data-vpk-engine="anatomy-hero"] root remains. Together they stay
 * within budgetBytes for every flow/pulse flag pair, both included (T11 asserts all four, since pipeline T-P5
 * measures only steps with build()). There is no build(): the step owns two blocks, not one marked block.
 * Adapter rules (runtime/pipeline.mjs): imports only blocks.mjs and its own domain module, no file reads at
 * import time (the anatomy sources are read lazily), never the registry, pipeline or check-html.
 */

import { ANATOMY_BLOCKS_BUDGET_BYTES, refreshAnatomyRuntime } from "../anatomy/runtime.mjs";

export const anatomyHeroStep = Object.freeze({
	id: "anatomy-hero",
	kinds: Object.freeze(["template", "demo", "illustration", "artifact"]),
	budgetBytes: ANATOMY_BLOCKS_BUDGET_BYTES,
	apply: html => refreshAnatomyRuntime(html),
});
