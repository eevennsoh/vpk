"use client";

import { ShaderLabEffect } from "./shader-lab-effect-demo";
import { FLUTED_GLASS_LAYER } from "./shader-lab/layers/fluted-glass";

export default function FlutedGlassV2Demo() {
	return <ShaderLabEffect definition={FLUTED_GLASS_LAYER} />;
}
