"use client";

import { ShaderLabEffect } from "./shader-lab-effect-demo";
import { PATTERN_LAYER } from "./shader-lab/layers/pattern";

export default function PatternDemo() {
	return <ShaderLabEffect definition={PATTERN_LAYER} />;
}
