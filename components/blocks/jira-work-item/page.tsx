"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import JiraWorkItem, { type JiraWorkItemVariant } from "./index";

export {
	JiraWorkItem,
	type JiraWorkItemProps,
	type JiraWorkItemVariant,
	type JiraWorkItemExperimentalPreset,
} from "./index";

export default function JiraWorkItemPage() {
	const [activeVariant, setActiveVariant] = useState<JiraWorkItemVariant | null>(null);

	if (activeVariant) {
		return (
			<JiraWorkItem
				key={activeVariant}
				initialIssueOpen
				variant={activeVariant}
				initialExperimentalPreset="filled"
				onIssueClose={() => setActiveVariant(null)}
			/>
		);
	}

	return (
		<div className="flex h-full min-h-screen flex-wrap content-center items-center justify-center gap-3 p-4">
			<Button type="button" variant="outline" onClick={() => setActiveVariant("default")}>
				Open standard session
			</Button>
			<Button type="button" variant="outline" onClick={() => setActiveVariant("experimental")}>
				Open experimental session
			</Button>
			<Button type="button" variant="outline" onClick={() => setActiveVariant("experimental-v2")}>
				Open experimental v2 session
			</Button>
			<Button type="button" variant="outline" onClick={() => setActiveVariant("experimental-v3")}>
				Open experimental v3 session
			</Button>
			<Button type="button" variant="outline" onClick={() => setActiveVariant("experimental-v4")}>
				Open experimental v4 session
			</Button>
			<Button type="button" variant="outline" onClick={() => setActiveVariant("experimental-v5")}>
				Open experimental v5 session
			</Button>
			<Button type="button" onClick={() => setActiveVariant("team-eu26")}>
				Open Team EU26 session
			</Button>
			<Button type="button" variant="outline" onClick={() => setActiveVariant("project-butter")}>
				Open Project butter session
			</Button>
		</div>
	);
}

export function JiraWorkItemExperimentalPage() {
	return <JiraWorkItem variant="experimental" initialExperimentalPreset="filled" />;
}

export function JiraWorkItemExperimentalV2Page() {
	return <JiraWorkItem variant="experimental-v2" initialExperimentalPreset="filled" />;
}

export function JiraWorkItemExperimentalV3Page() {
	return <JiraWorkItem variant="experimental-v3" initialExperimentalPreset="filled" />;
}
export function JiraWorkItemExperimentalV4Page() {
	return <JiraWorkItem variant="experimental-v4" initialExperimentalPreset="filled" />;
}

export function JiraWorkItemExperimentalV5Page() {
	return <JiraWorkItem variant="experimental-v5" initialExperimentalPreset="filled" />;
}

export function JiraWorkItemTeamEu26Page() {
	return <JiraWorkItem variant="team-eu26" initialExperimentalPreset="filled" />;
}

export function JiraWorkItemTeamEu26EmptyPage() {
	return <JiraWorkItem variant="team-eu26" initialExperimentalPreset="empty" />;
}
