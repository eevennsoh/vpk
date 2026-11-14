"use client";

import { ShaderLabEffect } from "./shader-lab-effect-demo";
import { THRESHOLD_LAYER } from "./shader-lab/layers/threshold";

export default function ThresholdDemo() {
	return <ShaderLabEffect definition={THRESHOLD_LAYER} />;
}
