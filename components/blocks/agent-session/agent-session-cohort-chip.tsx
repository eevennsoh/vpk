"use client";

import { AgentSessionDragChip } from "./agent-session-drag-chip";
import type { AgentSessionItem } from "./agent-session-types";
import type { SessionCohort } from "./session-cohort";

/**
 * Cohort-shaped entry point every drag surface already calls (jira-dropzone,
 * jira-linking-glow, jira-linking-flight, agent-session-medium-drag). It
 * delegates the drawing to the shared drag chip, so a single change upgrades
 * every surface at once. The cohort sentence lives in the chip, not here —
 * two copies of one user-visible string is the duplication this stack exists
 * to remove.
 */
export function AgentSessionCohortChip({
	cohort,
	elevated = false,
	isFusionSource = false,
	animateIdentity,
}: Readonly<{
	cohort: SessionCohort<AgentSessionItem>;
	elevated?: boolean;
	/** Only the travelling copy inside a drag overlay is measured by the goo. */
	isFusionSource?: boolean;
	/** Prepared previews draw the identity immediately instead of replaying its entrance. */
	animateIdentity?: boolean;
}>) {
	return (
		<AgentSessionDragChip
			cohort={cohort}
			elevated={elevated}
			isFusionSource={isFusionSource}
			animateIdentity={animateIdentity}
		/>
	);
}
