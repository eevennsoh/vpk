"use client";

import { useState } from "react";
import RefreshIcon from "@atlaskit/icon/core/refresh";

import { cn } from "@/lib/utils";

/**
 * The refresh arrow, turning while the agent re-runs. When the run ends it finishes its current turn
 * and settles upright instead of snapping back mid-rotation. Transform only; the global reduced-motion reset covers it.
 */
export function RefreshGlyph({ running }: Readonly<{ running: boolean }>) {
	const [spinning, setSpinning] = useState(running);
	if (running && !spinning) setSpinning(true);
	return (
		<span
			aria-hidden="true"
			className={cn("flex", spinning ? "animate-spin" : null)}
			onAnimationIteration={() => {
				if (!running) setSpinning(false);
			}}
		>
			<RefreshIcon color="currentColor" label="" size="small" />
		</span>
	);
}
