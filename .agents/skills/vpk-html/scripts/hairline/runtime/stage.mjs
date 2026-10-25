// hairline/runtime/stage — vendored core/stage.ts, adapted at four exports for the vpk page:
//   register  comes from the shared vpk frame loop (./loop.mjs), so every figure ticks on window.vpkFrameLoop;
//   tour      the `play` option's unseen pointer is not offered (the gallery mounts figures without `play`), so
//             upstream's own rAF loop, IntersectionObserver and reduced-motion query tree-shake out of the bundle;
//   solid/put a solid also carries its two side bands (data-hl-side="l" | "r", ./iso.mjs), painted over the silhouette
//             and under the crease, so it takes the iso kit's face tones. A solid whose paths carry no bands stays one face.
// The bundle resolves every vendored `../core/stage` and `./core/stage` import here (hairline/inline.mjs); an
// explicit export wins over `export *`, so nothing else changes.
import { mk } from "../vendor/packages/hairline/src/core/stage.ts";

export * from "../vendor/packages/hairline/src/core/stage.ts";
export { register } from "./loop.mjs";

export function tour() {
	return { stop() {} };
}

export function solid(parent) {
	const g = mk("g", {}, parent);
	const sil = mk("path", { class: "sil" }, g);
	const left = mk("path", { class: "fo", "data-hl-side": "l" }, g);
	const right = mk("path", { class: "fo", "data-hl-side": "r" }, g);
	const edge = mk("path", { class: "nf", "data-hl-edge": "" }, g);
	return { g, sil, left, right, edge, cr: mk("path", { class: "nf lo" }, g) };
}

export const put = (el, s) => {
	el.sil.setAttribute("d", s.sil);
	el.cr.setAttribute("d", s.crease);
	if (el.left) {
		el.left.setAttribute("d", s.left ?? "");
		el.right.setAttribute("d", s.right ?? "");
		el.edge.setAttribute("d", s.edge ?? "");
	}
};
