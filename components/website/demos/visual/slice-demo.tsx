"use client";

import { ShaderLabEffect } from "./shader-lab-effect-demo";
import { SLICE_LAYER } from "./shader-lab/layers/slice";

export default function SliceDemo() {
	return <ShaderLabEffect definition={SLICE_LAYER} />;
}
