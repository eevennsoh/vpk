"use client";

import { ShaderLabEffect } from "./shader-lab-effect-demo";
import { HALFTONE_LAYER } from "./shader-lab/layers/halftone";

export default function HalftoneDemo() {
	return <ShaderLabEffect definition={HALFTONE_LAYER} />;
}
