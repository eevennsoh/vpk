"use client";

import { ShaderLabEffect } from "./shader-lab-effect-demo";
import { PIXEL_SORTING_LAYER } from "./shader-lab/layers/pixel-sorting";

export default function PixelSortingDemo() {
	return <ShaderLabEffect definition={PIXEL_SORTING_LAYER} />;
}
