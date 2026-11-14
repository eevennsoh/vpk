"use client";

import { ShaderLabEffect } from "./shader-lab-effect-demo";
import { SMEAR_LAYER } from "./shader-lab/layers/smear";

export default function SmearDemo() {
	return <ShaderLabEffect definition={SMEAR_LAYER} />;
}
