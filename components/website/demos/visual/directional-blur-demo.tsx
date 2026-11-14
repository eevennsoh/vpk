"use client";

import { ShaderLabEffect } from "./shader-lab-effect-demo";
import { DIRECTIONAL_BLUR_LAYER } from "./shader-lab/layers/directional-blur";

export default function DirectionalBlurDemo() {
	return <ShaderLabEffect definition={DIRECTIONAL_BLUR_LAYER} />;
}
