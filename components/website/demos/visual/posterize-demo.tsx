"use client";

import { ShaderLabEffect } from "./shader-lab-effect-demo";
import { POSTERIZE_LAYER } from "./shader-lab/layers/posterize";

export default function PosterizeDemo() {
	return <ShaderLabEffect definition={POSTERIZE_LAYER} />;
}
