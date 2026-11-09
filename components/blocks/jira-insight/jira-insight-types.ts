import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";

interface JiraInsightSourceBase {
	id: string;
	label: string;
	brandName?: ThirdPartyLogoName;
}

export type JiraInsightSource =
	| (JiraInsightSourceBase & {
		kind: "work-item-section";
		sectionId: "description" | "activity";
	})
	| (JiraInsightSourceBase & {
		kind: "activity-entry";
		entryId: string;
	})
	| (JiraInsightSourceBase & {
		kind: "agent-session";
		sessionId: string;
	})
	| (JiraInsightSourceBase & {
		kind: "pull-request";
		identity: string;
	})
	| (JiraInsightSourceBase & {
		kind: "external-link";
		href: string;
	});

export interface JiraInsightCheckpoint {
	id: string;
	title: string;
	description: string;
	capturedAtMs: number;
	sources: readonly JiraInsightSource[];
}

export interface JiraInsightSnapshot {
	summary: string;
	checkpoints: readonly JiraInsightCheckpoint[];
	unreadCheckpointIds: readonly string[];
	revision: string | number;
}

export interface JiraInsightSelectionState {
	activeCheckpointId: string | null;
	readCheckpointIds: readonly string[];
	revision: string | number;
}

export interface JiraInsightSourceSelectHandler {
	(source: JiraInsightSource): void;
}
