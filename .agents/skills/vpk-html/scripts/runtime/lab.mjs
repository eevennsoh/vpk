/*
 * runtime/lab — registry adapter for the vpk-lab kit block (ws4a; integration R13 slot "lab", K2).
 *
 * Replace-only: documents whose <!-- vpk-lab:start/end --> block exists get it refreshed in place; every other
 * document comes back byte-identical, and lab/kit.mjs reads its sources only when a block is present. The first
 * insertion is lab/kit.mjs --inject (or a generator calling injectLabKit). The block inlines the shared frame loop
 * (runtime/frame-loop.mjs), so there is no separate loop step (R1).
 */

import { refreshLabKit } from "../lab/kit.mjs";

export const labKitStep = Object.freeze({
	id: "lab",
	kinds: Object.freeze(["template", "demo", "artifact"]),
	apply: html => refreshLabKit(html),
});
