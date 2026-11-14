"use client";

import { ShaderLabEffect } from "./shader-lab-effect-demo";
import { VOXEL_LAYER } from "./shader-lab/layers/voxel";

export default function VoxelDemo() {
	return <ShaderLabEffect definition={VOXEL_LAYER} />;
}
