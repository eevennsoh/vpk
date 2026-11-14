"use client";

import { ShaderLabEffect } from "./shader-lab-effect-demo";
import { DISPLACEMENT_MAP_LAYER } from "./shader-lab/layers/displacement-map";

export default function DisplacementMapDemo() {
	return <ShaderLabEffect definition={DISPLACEMENT_MAP_LAYER} />;
}
