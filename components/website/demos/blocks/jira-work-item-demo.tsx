"use client";

import { useState } from "react";

import JiraWorkItem, {
	type JiraWorkItemExperimentalPreset,
	type JiraWorkItemVariant,
} from "@/components/blocks/jira-work-item";
import JiraWorkItemPage from "@/components/blocks/jira-work-item/page";
import { Button } from "@/components/ui/button";

const PRESET_OPTIONS: ReadonlyArray<{
	value: JiraWorkItemExperimentalPreset;
	label: string;
}> = [
	{ value: "filled", label: "With content" },
	{ value: "empty", label: "Empty state" },
	{ value: "running", label: "Agents running" },
];

const ALL_PRESETS = PRESET_OPTIONS.map((option) => option.value);
const TEAM_EU26_PRESETS: readonly JiraWorkItemExperimentalPreset[] = ["filled", "empty"];

function JiraWorkItemPresetDemo({
	presets = ALL_PRESETS,
	variant,
}: Readonly<{
	presets?: readonly JiraWorkItemExperimentalPreset[];
	variant: Exclude<JiraWorkItemVariant, "default">;
}>) {
	const [activePreset, setActivePreset] = useState<JiraWorkItemExperimentalPreset | null>(null);

	return activePreset ? (
		<JiraWorkItem
			key={`${variant}-${activePreset}`}
			initialExperimentalPreset={activePreset}
			initialIssueOpen
			onIssueClose={() => setActivePreset(null)}
			variant={variant}
		/>
	) : (
		<div className="flex h-full min-h-[400px] flex-wrap content-center items-center justify-center gap-3 p-4">
			{PRESET_OPTIONS.filter((option) => presets.includes(option.value)).map((option) => (
				<Button
					key={option.value}
					onClick={() => setActivePreset(option.value)}
					type="button"
					variant="outline"
				>
					{option.label}
				</Button>
			))}
		</div>
	);
}

export default function JiraWorkItemDemo() {
	return <JiraWorkItemPage />;
}

export function JiraWorkItemDemoStandard() {
	return <JiraWorkItem variant="default" />;
}

export function JiraWorkItemDemoExperimental() {
	return <JiraWorkItemPresetDemo variant="experimental" />;
}

export function JiraWorkItemDemoExperimentalEmpty() {
	return <JiraWorkItem variant="experimental" initialExperimentalPreset="empty" />;
}

export function JiraWorkItemDemoExperimentalRunning() {
	return <JiraWorkItem variant="experimental" initialExperimentalPreset="running" />;
}

export function JiraWorkItemDemoExperimentalV2() {
	return <JiraWorkItemPresetDemo variant="experimental-v2" />;
}

export function JiraWorkItemDemoExperimentalV2Empty() {
	return <JiraWorkItem variant="experimental-v2" initialExperimentalPreset="empty" />;
}

export function JiraWorkItemDemoExperimentalV2Running() {
	return <JiraWorkItem variant="experimental-v2" initialExperimentalPreset="running" />;
}

export function JiraWorkItemDemoExperimentalV3() {
	return <JiraWorkItemPresetDemo variant="experimental-v3" />;
}
export function JiraWorkItemDemoExperimentalV4() {
	return <JiraWorkItemPresetDemo variant="experimental-v4" />;
}
export function JiraWorkItemDemoExperimentalV5() {
	return <JiraWorkItemPresetDemo variant="experimental-v5" />;
}
export function JiraWorkItemDemoTeamEu26() {
	return <JiraWorkItemPresetDemo presets={TEAM_EU26_PRESETS} variant="team-eu26" />;
}

export function JiraWorkItemDemoTeamEu26Empty() {
	return <JiraWorkItem variant="team-eu26" initialExperimentalPreset="empty" />;
}

export function JiraWorkItemDemoExperimentalV3Empty() {
	return <JiraWorkItem variant="experimental-v3" initialExperimentalPreset="empty" />;
}
export function JiraWorkItemDemoExperimentalV4Empty() {
	return <JiraWorkItem variant="experimental-v4" initialExperimentalPreset="empty" />;
}
export function JiraWorkItemDemoExperimentalV5Empty() {
	return <JiraWorkItem variant="experimental-v5" initialExperimentalPreset="empty" />;
}
export function JiraWorkItemDemoExperimentalV3Running() {
	return <JiraWorkItem variant="experimental-v3" initialExperimentalPreset="running" />;
}
export function JiraWorkItemDemoExperimentalV4Running() {
	return <JiraWorkItem variant="experimental-v4" initialExperimentalPreset="running" />;
}
export function JiraWorkItemDemoExperimentalV5Running() {
	return <JiraWorkItem variant="experimental-v5" initialExperimentalPreset="running" />;
}
