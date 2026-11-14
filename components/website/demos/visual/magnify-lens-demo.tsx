"use client";

import { ShaderLabLayer } from "./shader-lab-effect-demo";
import { MAGNIFY_LENS_LAYER } from "./shader-lab/layers/magnify-lens";

export default function MagnifyLensDemo() {
	return <ShaderLabLayer definition={MAGNIFY_LENS_LAYER} />;
}
