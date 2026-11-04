import { pullRequestChecksScenario } from "@/components/blocks/pull-request/data/demo-pull-request-checks";
import type { PullRequestProps } from "@/components/blocks/pull-request/components/pull-request-types";

/**
 * Catalog fixtures for the Pull Request block.
 *
 * The dropdown cards ignore `repository`, `reviewers`, `checks`, and the action links: the
 * provider mark and `#N` already say where the change lives there. The flyout
 * prints them, matching the production dev-panel hover card content.
 */
export const DEMO_PULL_REQUESTS: readonly PullRequestProps[] = [
	{
		number: 1306,
		title: "Add guest checkout to the storefront",
		status: "Open",
		author: {
			name: "Venn",
			avatarUrl: "/avatar-user/venn/venn.png",
		},
		repository: "acme/storefront",
		branch: "rovo/rfp-103-response-validation",
		targetBranch: "main",
		additions: 86,
		deletions: 21,
		filesChanged: 6,
		relativeTime: "1h",
		reviewers: { approved: 0, total: 1 },
		checks: pullRequestChecksScenario("passed"),
		href: "https://github.com/acme/storefront/pull/1306",
		reviewHref: "https://github.com/acme/storefront/pull/1306/files",
	},
	{
		number: 1847,
		title: "Fix threaded comment highlight bottom corners",
		status: "Merged",
		author: {
			name: "Maya Chen",
			avatarUrl: "/avatar-user/olivia-yang/color/asow-service-yellow.png",
		},
		repository: "acme/storefront",
		branch: "fix/comment-highlight",
		targetBranch: "main",
		additions: 148,
		deletions: 37,
		filesChanged: 12,
		relativeTime: "Yesterday",
		reviewers: { approved: 1, total: 2 },
		checks: pullRequestChecksScenario("passed"),
		href: "https://github.com/acme/storefront/pull/1847",
	},
	{
		number: 7,
		title: "SHIL-25: Integrate Pull Request Data and Actions into Dev Panel - (Jira Dev Panel)",
		status: "Merged",
		provider: "bitbucket",
		author: { name: "Shilpa Airi" },
		repository: "atlassian/shilpas-test-repo",
		branch: "SHIL-25-dev-panel-pull-request-data-integration-2e5f6",
		targetBranch: "main",
		additions: 312,
		deletions: 48,
		filesChanged: 9,
		relativeTime: "20d ago",
		reviewers: { approved: 0, total: 0 },
		checks: pullRequestChecksScenario("passed"),
		href: "https://bitbucket.org/atlassian/shilpas-test-repo/pull-requests/7",
		reviewHref: "https://bitbucket.org/atlassian/shilpas-test-repo/pull-requests/7/review",
	},
];
