"use client";

import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { EXPANDED_TICKET_TEAR_LINE_STYLE } from "@/components/blocks/agent-card/components/agent-card-ticket-style";

const notchMask = [0, 100].map((edge) => `radial-gradient(circle var(--recommendation-notch-radius) at ${edge}% var(--recommendation-seam-y, -20px), transparent calc(var(--recommendation-notch-radius) - 0.5px), black var(--recommendation-notch-radius))`).join(", ");
export const AGENT_LANYARD_RECOMMENDATION_SURFACE_STYLE = {
	"--recommendation-notch-radius": "5px",
	maskImage: notchMask,
	maskComposite: "intersect",
	WebkitMaskImage: notchMask,
	WebkitMaskComposite: "source-in",
} satisfies CSSProperties & { "--recommendation-notch-radius": string };

export function useAgentLanyardRecommendation(enabled: boolean) {
	const surfaceRef = useRef<HTMLDivElement>(null);
	const identityRef = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const surface = surfaceRef.current;
		const identity = identityRef.current;
		if (!enabled || !surface || !identity) return;
		const placeNotches = (height: number) => surface.style.setProperty("--recommendation-seam-y", `calc(${height}px + 0.5px)`);
		placeNotches(identity.offsetHeight);
		const observer = new ResizeObserver(([entry]) => {
			// Border-box sizes remain in CSS pixels under canvas zoom and perspective tilt.
			placeNotches(entry?.borderBoxSize[0]?.blockSize ?? identity.offsetHeight);
		});
		observer.observe(identity, { box: "border-box" });
		return () => observer.disconnect();
	}, [enabled]);
	return { surfaceRef, identityRef };
}

export function AgentLanyardRecommendation({ reason, headingLevel }: Readonly<{ reason: string; headingLevel: 2 | 3 }>) {
	const Heading = headingLevel === 2 ? "h3" : "h4";
	return (
		<div className="relative px-4 pt-4 pb-3" data-slot="agent-lanyard-recommendation-section">
			<span aria-hidden="true" className="pointer-events-none absolute top-0 h-px bg-border" style={{ ...EXPANDED_TICKET_TEAR_LINE_STYLE, insetInline: "calc(var(--recommendation-notch-radius) - 2px)" }} data-slot="agent-lanyard-tear-line" />
			<div data-slot="agent-lanyard-recommendation">
				<Heading className="mb-1 p-0 text-xs leading-4 font-semibold text-text-subtlest">Why recommended</Heading>
				<p className="wrap-anywhere text-xs text-text-subtle">{reason}</p>
			</div>
		</div>
	);
}
