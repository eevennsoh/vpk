"use client";

import { type KeyboardEvent, memo } from "react";
import { cn } from "@/lib/utils";
import { ringOptions } from "./sunburst";
import { sunburstCssVars, useSunburstStable } from "./sunburst-context";

export interface SunburstCenterProps {
	className?: string;
}

export const SunburstCenter = memo(function SunburstCenter({
	className,
}: SunburstCenterProps) {
	const { focus, prevFocus, maxDepth, radius, zoomT, zoomTo, registerCenter, getColor } =
		useSunburstStable();

	const { centerR } = ringOptions(focus.depth, maxDepth, radius);
	const liveCenterR =
		centerR * zoomT +
		ringOptions(prevFocus.depth, maxDepth, radius).centerR * (1 - zoomT);

	if (liveCenterR <= 1) {
		return null;
	}

	const centerColor =
		focus.depth === 0
			? sunburstCssVars.background
			: getColor(focus.categoryIndex);

	return (
		/* biome-ignore lint/a11y/noStaticElementInteractions: Center zoom-out control */
		<circle
			aria-label={focus.parentId ? `Zoom out from ${focus.name}` : focus.name}
			className={cn("focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focused", className)}
			data-sunburst-center=""
			ref={registerCenter}
			role={focus.parentId ? "button" : "img"}
			tabIndex={focus.parentId ? 0 : -1}
			cx={0}
			cy={0}
			fill={centerColor}
			onClick={() => { if (focus.parentId) { zoomTo(focus.parentId); } }}
			onKeyDown={(event: KeyboardEvent<SVGCircleElement>) => {
				if (event.key === " ") { event.preventDefault(); }
				if (event.key === "Enter" && focus.parentId) { event.preventDefault(); zoomTo(focus.parentId); }
			}}
			onKeyUp={(event: KeyboardEvent<SVGCircleElement>) => {
				if (event.key === " " && focus.parentId) { event.preventDefault(); zoomTo(focus.parentId); }
			}}
			r={Math.max(liveCenterR - 2, 0)}
			stroke={sunburstCssVars.ring}
			strokeWidth={1}
			style={{ cursor: focus.parentId ? "pointer" : "default" }}
		/>
	);
});

SunburstCenter.displayName = "SunburstCenter";
