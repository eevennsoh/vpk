"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { animateSessionChipDrop } from "@/components/blocks/jira-dropzone/lib/session-chip-drop-flight";
import { JIRA_LINKING_GLOW_DROP_DURATION_MS } from "@/components/blocks/jira-linking/glow-motion";
import { JiraLinkingFlightChip } from "@/components/blocks/jira-linking/jira-linking-flight-chip";
import type { JiraLinkingDrop, JiraLinkingPoint } from "@/components/blocks/jira-linking";

export function CreatedCardInlineFlight({ drop, onLanded, resolveLandingPoint }: Readonly<{
	drop: JiraLinkingDrop;
	onLanded: () => void;
	resolveLandingPoint: () => JiraLinkingPoint | null;
}>) {
	const flightRef = useRef<HTMLDivElement>(null);
	const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
	useLayoutEffect(() => { setPortalRoot(document.body); }, []);
	useLayoutEffect(() => {
		const flight = flightRef.current;
		if (!flight) return;
		return animateSessionChipDrop(flight, { durationMs: JIRA_LINKING_GLOW_DROP_DURATION_MS, from: drop.from, onLanded, resolveLandingPoint });
	}, [drop, onLanded, portalRoot, resolveLandingPoint]);
	if (!portalRoot) return null;
	return <JiraLinkingFlightChip drop={drop} ref={flightRef} portalRoot={portalRoot} purpose="create-inline" />;
}
