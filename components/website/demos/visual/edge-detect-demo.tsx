"use client";

import { ShaderLabEffect } from "./shader-lab-effect-demo";
import { EDGE_DETECT_LAYER } from "./shader-lab/layers/edge-detect";

export default function EdgeDetectDemo() {
	return <ShaderLabEffect definition={EDGE_DETECT_LAYER} />;
}
