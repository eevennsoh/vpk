"use client";

import { ArtifactList, type ArtifactListItem } from "@/components/ui-custom/artifact-list";

const HANDOFF_ARTIFACTS: readonly ArtifactListItem[] = [
	{ id: "suspension-design", title: "Off-road suspension controls", source: "Figma design", logoName: "figma" },
	{ id: "suspension-handoff", title: "Suspension controls handoff", source: "Confluence page", iconName: "page", tileVariant: "blueSubtle" },
	{ id: "suspension-criteria", title: "Off-road control acceptance criteria", source: "Jira work item", iconName: "page", tileVariant: "blueSubtle" },
];

export function renderAgentSessionDemoArtifacts(widget: { type: string; data: unknown }) {
	if (widget.type !== "agent-session-demo-artifacts" || widget.data !== "off-road-handoff") return null;
	return (
		<section aria-label="Generated artifacts" className="mt-3">
			<h3 className="mb-2 text-sm font-medium text-text">Generated artifacts</h3>
			<ArtifactList items={HANDOFF_ARTIFACTS} variant="compact" />
		</section>
	);
}
