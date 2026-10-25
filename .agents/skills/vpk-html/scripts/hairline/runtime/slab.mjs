// hairline/runtime/slab — stands in for vendored slab.ts inside the bundle: slab() keeps upstream's paths and adds the side
// bands the iso kit's tone map paints (./iso.mjs withSides). The bundle resolves every vendored `slab` import here.
import { slab as vendorSlab } from "../vendor/packages/hairline/src/slab.ts";
import { withSides } from "./iso.mjs";

export * from "../vendor/packages/hairline/src/slab.ts";

export function slab(P, front, ring, inner, z0, z1) {
	return withSides(vendorSlab(P, front, ring, inner, z0, z1), P, front, ring, z0, z1);
}
