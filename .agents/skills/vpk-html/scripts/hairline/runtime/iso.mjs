// hairline/runtime/iso — stands in for vendored core/iso.ts inside the bundle, so hairline solids take the iso kit's face
// tones (illustrations.md § 4: tops lightest, the near side tone 1, the far side tone 2). Upstream draws a prism as one
// silhouette (the hull of its top and bottom rings) plus a crease; its geometry is unchanged here. prism() also returns
// `left` and `right`, the two visible side bands (the front-facing run of the ring split where its normal turns from
// screen-left to screen-right, swept from the top ring down to the bottom one), and `edge`, the outline drawn over them:
// the silhouette, the lid's front edge and, where the split falls on a corner, the vertical edge there. runtime/stage.mjs
// paints them over the silhouette, so its own fill shows only on the top. The bundle resolves every vendored `core/iso`
// import here.
import { open, poly, prism as vendorPrism, r2, ringAt, run } from "../vendor/packages/hairline/src/core/iso.ts";

export * from "../vendor/packages/hairline/src/core/iso.ts";

// A split sharper than this (degrees between the normals either side) is a corner and draws its vertical edge.
const CORNER_DEG = 25;

function sides(P, front, ring, z0, z1) {
	const empty = { left: "", right: "", split: "" };
	if (Math.abs(z1 - z0) < 1e-6) return empty;
	const o = P(0, 0, 0), ex = P(1, 0, 0)[0] - o[0], ey = P(0, 1, 0)[0] - o[0];
	const isRight = q => q.nu * ex + q.nv * ey >= 0;
	const sweep = part => (part.length < 2 ? "" : poly(ringAt(P, part, z1).concat(ringAt(P, part.slice().reverse(), z0))));
	const left = run(ring, q => front(q) && !isRight(q)), right = run(ring, q => front(q) && isRight(q));
	let split = "";
	if (left.length && right.length) {
		const a = left.at(-1), b = right[0];
		const angle = (Math.acos(Math.max(-1, Math.min(1, a.nu * b.nu + a.nv * b.nv))) * 180) / Math.PI;
		if (angle > CORNER_DEG) {
			const [x1, y1] = P(b.u, b.v, z1), [x0, y0] = P(b.u, b.v, z0);
			split = `M${r2(x1)} ${r2(y1)}L${r2(x0)} ${r2(y0)}`;
		}
	}
	return { left: sweep(left.length && right.length ? left.concat([right[0]]) : left), right: sweep(right), split };
}

// Adds the side bands and the outline to a prism's paths (upstream readers ignore the extra keys).
export function withSides(paths, P, front, ring, z0, z1) {
	const s = sides(P, front, ring, z0, z1);
	const lid = s.left || s.right ? open(ringAt(P, run(ring, front), Math.max(z0, z1))) : "";
	return { ...paths, left: s.left, right: s.right, edge: s.left || s.right ? paths.sil + lid + s.split : "" };
}

export function prism(P, front, ring, inner, z0, z1) {
	return withSides(vendorPrism(P, front, ring, inner, z0, z1), P, front, ring, z0, z1);
}
