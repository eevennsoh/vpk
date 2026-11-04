import type { ComponentDetail } from "@/app/data/component-detail-types";

export const DEVELOPMENT_PANEL_DETAIL: ComponentDetail = {
	description: "A work-item development panel with pull request settings, CI summaries for non-merged pull requests, a start coding menu and pull request detail flyouts. Switch the preview between the empty and pull-request states.",
	importStatement: 'import { DevelopmentPanel } from "@/components/blocks/development-panel";',
	usage: '<DevelopmentPanel pullRequests={pullRequests} workItem={{ code: "PAY-999", summary: "Improve onboarding", description: "" }} />',
	props: [
		{ name: "pullRequests", type: "readonly PullRequestProps[]", default: "[]", description: "Pull requests linked to the work item. An empty list shows Start coding and Copy prompt." },
		{ name: "workItem", type: "{ code: string; summary: string; description: string }", required: true, description: "Work item details used by Copy prompt." },
		{ name: "onStartCoding", type: "() => void", description: "Called when Start coding is selected in the before-setup state." },
	],
};
