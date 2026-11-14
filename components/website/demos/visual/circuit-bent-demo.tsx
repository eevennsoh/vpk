"use client";

import { ShaderLabEffect } from "./shader-lab-effect-demo";
import { CIRCUIT_BENT_LAYER } from "./shader-lab/layers/circuit-bent";

export default function CircuitBentDemo() {
	return <ShaderLabEffect definition={CIRCUIT_BENT_LAYER} />;
}
