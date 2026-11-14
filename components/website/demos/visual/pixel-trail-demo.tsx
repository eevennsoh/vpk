"use client";

import { ShaderLabLayer } from "./shader-lab-effect-demo";
import { PIXEL_TRAIL_LAYER } from "./shader-lab/layers/pixel-trail";

export default function PixelTrailDemo() {
	return <ShaderLabLayer definition={PIXEL_TRAIL_LAYER} />;
}
