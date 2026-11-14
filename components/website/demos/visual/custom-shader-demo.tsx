"use client";

import { ShaderLabLayer } from "./shader-lab-effect-demo";
import { CUSTOM_SHADER_LAYER } from "./shader-lab/layers/custom-shader";

export default function CustomShaderDemo() {
	return <ShaderLabLayer definition={CUSTOM_SHADER_LAYER} />;
}
