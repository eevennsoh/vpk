"use client";

import { useState } from "react";
import { BUTTER_PICKER_AGENTS } from "@/components/blocks/jira-issue/project-butter-agent-catalog";
import { ProjectButterAgentPickerContent } from "@/components/blocks/jira-issue/project-butter-agent-picker";
import { ProjectButterInvocationProvider } from "@/components/blocks/jira-issue/project-butter-invocation";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import { FavoritesPreview } from "./favorites-preview";
import { DestinationAfterSelectPreview, GlobalDestinationPreview, InlineActionsPreview, RememberDestinationPreview, RowActionsPreview } from "./destination-previews";
import { ActivityDigestPreview, PeopleFoldPreview, QuietDisclosurePreview } from "@/app/sandbox/agent-selector-canvas/teammate-session-previews";
import { EvidenceLedgerPreview, MarginNotePreview, ScopeMapPreview, WorkPlanPreview } from "@/app/sandbox/agent-selector-canvas/recommendation-previews";
import { FullWidthFooterLayoutPreview, InsetDividerLayoutPreview, InsetPanelLayoutPreview, PerforatedSeamLayoutPreview } from "@/app/sandbox/agent-selector-canvas/recommendation-layout-previews";

const safeAgents = BUTTER_PICKER_AGENTS.filter((agent) => agent.id !== "rovo-cli");
const cursorSession: readonly AgentSessionItem[] = [{
	id: "canvas-cursor-session",
	title: "Sample Cursor session",
	state: "running",
	host: "cloud",
	agent: { id: "test-agent", name: "Cursor" },
}];

function ButterPicker({ sessions = [] }: Readonly<{ sessions?: readonly AgentSessionItem[] }>) {
	const [selected, setSelected] = useState<readonly string[]>([]);
	return (
		<ProjectButterInvocationProvider agents={safeAgents} enabled>
			<div className="w-80 max-w-full overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-2xl">
				<ProjectButterAgentPickerContent selectedAgentIds={selected} sessions={sessions} onContinueSession={() => undefined} onAssign={(agent) => setSelected([agent.id])} onBrowseAgents={() => undefined} onCreateAgent={() => undefined} />
			</div>
		</ProjectButterInvocationProvider>
	);
}

function ButterPickerPreview() {
	return <ButterPicker />;
}

function ButterPickerExistingSessionPreview() {
	return <ButterPicker sessions={cursorSession} />;
}

export const previews = [{
	id: "project-butter",
	name: "Agent selector · Project butter",
	component: ButterPickerPreview,
	position: { x: 0, y: 0 },
	width: 320,
}, {
	id: "project-butter-existing-session",
	name: "Agent selector · Project butter · Existing session",
	component: ButterPickerExistingSessionPreview,
	position: { x: 680, y: 0 },
	width: 320,
}, {
	id: "project-butter-favorites",
	name: "Agent selector · Project butter · Favorites",
	component: FavoritesPreview,
	position: { x: 1360, y: 0 },
	width: 320,
}, {
	id: "destination-remember",
	name: "Run destination · Remember per agent",
	component: RememberDestinationPreview,
	position: { x: 2040, y: 0 },
	width: 320,
}, {
	id: "destination-global",
	name: "Run destination · Picker default",
	component: GlobalDestinationPreview,
	position: { x: 2480, y: 0 },
	width: 320,
}, {
	id: "destination-row-actions",
	name: "Run destination · Row actions",
	component: RowActionsPreview,
	position: { x: 2920, y: 0 },
	width: 320,
}, {
	id: "destination-inline",
	name: "Run destination · Inline expansion",
	component: InlineActionsPreview,
	position: { x: 3360, y: 0 },
	width: 320,
}, {
	id: "destination-after-select",
	name: "Run destination · After selection",
	component: DestinationAfterSelectPreview,
	position: { x: 3800, y: 0 },
	width: 320,
}, {
	id: "teammate-sessions-quiet",
	name: "Teammate sessions · Quiet disclosure",
	component: QuietDisclosurePreview,
	position: { x: 2040, y: 680 },
	width: 280,
}, {
	id: "teammate-sessions-people",
	name: "Teammate sessions · People fold",
	component: PeopleFoldPreview,
	position: { x: 2480, y: 680 },
	width: 280,
}, {
	id: "teammate-sessions-activity",
	name: "Teammate sessions · Activity digest",
	component: ActivityDigestPreview,
	position: { x: 2920, y: 680 },
	width: 280,
}, {
	id: "recommendation-margin-note",
	name: "Recommendation lanyard · Margin note",
	component: MarginNotePreview,
	position: { x: 0, y: 1400 },
	width: 588,
}, {
	id: "recommendation-evidence-ledger",
	name: "Recommendation lanyard · Evidence ledger",
	component: EvidenceLedgerPreview,
	position: { x: 680, y: 1400 },
	width: 588,
}, {
	id: "recommendation-scope-map",
	name: "Recommendation lanyard · Scope map",
	component: ScopeMapPreview,
	position: { x: 1360, y: 1400 },
	width: 588,
}, {
	id: "recommendation-work-plan",
	name: "Recommendation lanyard · Work plan",
	component: WorkPlanPreview,
	position: { x: 2040, y: 1400 },
	width: 588,
}, {
	id: "recommendation-layout-stack",
	name: "Recommendation layout · Inset divider",
	component: InsetDividerLayoutPreview,
	position: { x: 0, y: 2100 },
	width: 588,
}, {
	id: "recommendation-layout-inset",
	name: "Recommendation layout · Inset panel",
	component: InsetPanelLayoutPreview,
	position: { x: 680, y: 2100 },
	width: 588,
}, {
	id: "recommendation-layout-footer",
	name: "Recommendation layout · Full-width footer",
	component: FullWidthFooterLayoutPreview,
	position: { x: 1360, y: 2100 },
	width: 588,
}, {
	id: "recommendation-layout-perforated",
	name: "Recommendation layout · Perforated seam",
	component: PerforatedSeamLayoutPreview,
	position: { x: 2040, y: 2100 },
	width: 588,
}] as const;
