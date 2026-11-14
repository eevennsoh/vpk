"use client";

import { ShaderLabEffect } from "./shader-lab-effect-demo";
import { PIXELATION_LAYER } from "./shader-lab/layers/pixelation";

export default function PixelationDemo() {
	return <ShaderLabEffect definition={PIXELATION_LAYER} />;
}
