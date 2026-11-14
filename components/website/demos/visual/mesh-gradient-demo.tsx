"use client";

import { ShaderLabLayer } from "./shader-lab-effect-demo";
import { MESH_GRADIENT_LAYER } from "./shader-lab/layers/mesh-gradient";

export default function MeshGradientDemo() {
	return <ShaderLabLayer definition={MESH_GRADIENT_LAYER} />;
}
