"use client";

import { ShaderLabEffect } from "./shader-lab-effect-demo";
import { INK_LAYER } from "./shader-lab/layers/ink";

export default function InkDemo() {
	return <ShaderLabEffect definition={INK_LAYER} />;
}
