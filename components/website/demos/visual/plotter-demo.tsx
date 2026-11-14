"use client";

import { ShaderLabEffect } from "./shader-lab-effect-demo";
import { PLOTTER_LAYER } from "./shader-lab/layers/plotter";

export default function PlotterDemo() {
	return <ShaderLabEffect definition={PLOTTER_LAYER} />;
}
