"use client";

import { ShaderLabEffect } from "./shader-lab-effect-demo";
import { BLOOM_LAYER } from "./shader-lab/layers/bloom";

export default function BloomDemo() {
	return <ShaderLabEffect definition={BLOOM_LAYER} />;
}
