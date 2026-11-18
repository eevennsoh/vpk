import type { JiraIssuePullRequestPreview } from "@/components/blocks/jira-issue";

export const EXPERIMENTAL_DEMO_PULL_REQUEST_PREVIEW: JiraIssuePullRequestPreview = {
	additions: 86,
	author: {
		avatarUrl: "/avatar-user/andrea-wilson/color/asow-service-yellow.png",
		name: "Andrea Wilson",
	},
	branch: "feat/pd-40-date-range-filter",
	deletions: 21,
	filesChanged: 6,
	relativeTime: "1h",
	repository: "acme/storefront",
	targetBranch: "main",
	title: "Add date-range filter query params",
};
