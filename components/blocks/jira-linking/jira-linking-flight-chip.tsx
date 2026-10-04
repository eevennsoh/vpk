"use client";

import type { Ref } from "react";
import { createPortal } from "react-dom";
import { AgentSessionCohortChip } from "@/components/blocks/agent-session/agent-session-cohort-chip";
import { toJiraLinkingCohort } from "./drop-cohort";
import type { JiraLinkingDrop } from "./drop";

/** One shared chip face for linking and inline creation flights. */
export function JiraLinkingFlightChip({ drop, portalRoot, ref, purpose = "link", zIndex = 400 }: Readonly<{
	drop: JiraLinkingDrop;
	portalRoot: HTMLElement;
	ref: Ref<HTMLDivElement>;
	purpose?: "link" | "create-inline";
	zIndex?: number;
}>) {
	return createPortal(
		<div aria-hidden="true" data-slot="jira-linking" data-jira-linking-variant="glow" className="pointer-events-none">
			<div
				ref={ref}
				data-jira-linking-flight=""
				data-jira-linking-flight-purpose={purpose}
				data-jira-linking-flight-members={String(drop.members.length)}
				className="fixed left-0 top-0 w-fit"
				style={{ zIndex, transform: `translate3d(${drop.from.x}px, ${drop.from.y}px, 0)`, transformOrigin: "0 0" }}
			>
				<div className="flex w-fit -translate-x-1/2 -translate-y-1/2 items-center">
					<AgentSessionCohortChip cohort={toJiraLinkingCohort(drop.members)} elevated />
				</div>
			</div>
		</div>, portalRoot,
	);
}
