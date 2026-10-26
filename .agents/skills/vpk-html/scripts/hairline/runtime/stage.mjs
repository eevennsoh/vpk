// hairline/runtime/stage — vendored core/stage.ts, adapted at two exports for the vpk page:
//   register  comes from the shared vpk frame loop (./loop.mjs), so every figure ticks on window.vpkFrameLoop;
//   tour      the `play` option's unseen pointer is not offered (the gallery mounts figures without `play`), so
//             upstream's own rAF loop, IntersectionObserver and reduced-motion query tree-shake out of the bundle;
// The bundle resolves every vendored `../core/stage` and `./core/stage` import here (hairline/inline.mjs); an
// explicit export wins over `export *`, so nothing else changes.
export * from "../vendor/packages/hairline/src/core/stage.ts";
export { register } from "./loop.mjs";

export function tour() {
	return { stop() {} };
}
