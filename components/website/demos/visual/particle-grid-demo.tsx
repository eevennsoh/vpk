"use client";

import { ShaderLabEffect } from "./shader-lab-effect-demo";
import { PARTICLE_GRID_LAYER } from "./shader-lab/layers/particle-grid";

export default function ParticleGridDemo() {
	return <ShaderLabEffect definition={PARTICLE_GRID_LAYER} />;
}
