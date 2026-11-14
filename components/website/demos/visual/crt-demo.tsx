"use client";

import { ShaderLabEffect } from "./shader-lab-effect-demo";
import { CRT_LAYER } from "./shader-lab/layers/crt";

export default function CrtDemo() {
	return <ShaderLabEffect definition={CRT_LAYER} />;
}
