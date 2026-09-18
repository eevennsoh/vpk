"use client";

import { useState } from "react";
import { useReducedMotion } from "motion/react";
import { createVoiceGlowSimulation } from "@/components/visual/voice-glow/simulated-voice";

export function useVoiceGlowSimulation(enabled = true, manualLevel = 0.5) {
	const [simulation] = useState(() => createVoiceGlowSimulation());
	const reducedMotion = useReducedMotion();
	return {
		level: enabled && !reducedMotion ? simulation.read : manualLevel,
		reset: simulation.reset,
	};
}
