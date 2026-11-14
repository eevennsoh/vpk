"use client";

import { ShaderLabLayer } from "./shader-lab-effect-demo";
import { FLUID_LAYER } from "./shader-lab/layers/fluid";

export default function FluidDemo() {
	return <ShaderLabLayer definition={FLUID_LAYER} />;
}
