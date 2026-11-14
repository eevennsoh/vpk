"use client";

import { ShaderLabEffect } from "./shader-lab-effect-demo";
import { CHROMATIC_ABERRATION_LAYER } from "./shader-lab/layers/chromatic-aberration";

export default function ChromaticAberrationV2Demo() {
	return <ShaderLabEffect definition={CHROMATIC_ABERRATION_LAYER} />;
}
