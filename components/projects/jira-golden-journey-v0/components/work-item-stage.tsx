"use client";

import { useCallback, useState } from "react";

import type { JiraWorkItemExperimentalPreset } from "@/components/blocks/jira-work-item";
import { ExperimentalJiraWorkItem } from "@/components/blocks/jira-work-item/experimental/experimental-jira-work-item";

export interface WorkItemStageController {
	preset: JiraWorkItemExperimentalPreset;
	launchId: number;
	selectPreset: (preset: JiraWorkItemExperimentalPreset) => void;
}

export function useWorkItemStageController(): WorkItemStageController {
	const [preset, setPreset] = useState<JiraWorkItemExperimentalPreset>("blank");
	const [launchId, setLaunchId] = useState(0);

	const selectPreset = useCallback((nextPreset: JiraWorkItemExperimentalPreset): void => {
		setPreset(nextPreset);
		setLaunchId((currentLaunchId) => currentLaunchId + 1);
	}, []);

	return { preset, launchId, selectPreset };
}

/** The experimental Agent Sessions work-item design with deterministic preset jumps. */
export function WorkItemStage({
	controller,
}: Readonly<{ controller: WorkItemStageController }>): React.ReactElement {
	return (
		<div className="relative left-1/2 flex h-full min-h-0 w-[100cqw] -translate-x-1/2 items-start justify-center overflow-hidden px-8 pt-4 pb-4">
			<ExperimentalJiraWorkItem
				key={controller.launchId}
				initialPreset={controller.preset}
				presentation="inline"
			/>
		</div>
	);
}
