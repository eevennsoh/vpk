"use client";

import { ExperimentalJiraWorkItem } from "@/components/blocks/jira-work-item/experimental/experimental-jira-work-item";

import type { JiraForYouItem } from "./jira-for-you-types";
import type { JiraForYouWorkspaceItemDetails } from "./jira-for-you-workspace-types";
import { mapJiraForYouItemToWorkItem } from "./jira-for-you-work-item-data";

interface JiraForYouWorkItemViewProps {
	details: JiraForYouWorkspaceItemDetails;
	item: JiraForYouItem;
}

export function JiraForYouWorkItemView({
	details,
	item,
}: Readonly<JiraForYouWorkItemViewProps>) {
	return (
		<section
			aria-label={`Work item: ${item.issueKey}`}
			className="flex min-h-0 w-full flex-1 overflow-hidden"
			data-testid="jira-for-you-work-item-view"
		>
			<ExperimentalJiraWorkItem
				defaultMetadataCollapsed
				initialPreset="filled"
				inlineSurface="fill"
				key={item.id}
				outputs={details.outputs.map((output) => output.title)}
				presentation="inline"
				workItem={mapJiraForYouItemToWorkItem(item)}
			/>
		</section>
	);
}
