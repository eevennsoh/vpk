import type { JiraIssuePullRequestPreview } from "@/components/blocks/jira-issue/types";

import { PAY_101_INVENTORY_PR_ARTIFACT } from "./presentation-build";
import { PAY_STORY_PEOPLE } from "./presentation-people";

const PAY_REPOSITORY = "payments-platform/payments";

function createPreview({
	additions,
	author,
	branch,
	deletions,
	filesChanged,
	relativeTime,
	title,
}: Readonly<{
	additions: number;
	author: (typeof PAY_STORY_PEOPLE)[keyof typeof PAY_STORY_PEOPLE];
	branch: string;
	deletions: number;
	filesChanged: number;
	relativeTime: string;
	title: string;
}>): JiraIssuePullRequestPreview {
	return {
		additions,
		author: { name: author.name, avatarUrl: author.avatarSrc },
		branch,
		deletions,
		filesChanged,
		relativeTime,
		repository: PAY_REPOSITORY,
		targetBranch: "main",
		title,
	};
}

/** Dummy spacious overlay content, keyed by issue code (PR numbers repeat). */
export const JIRA_TEAM_EU26_PULL_REQUEST_PREVIEWS = {
	"PAY-101": createPreview({
		additions: 312,
		author: PAY_STORY_PEOPLE.maya,
		branch: "pay-101-call-site-inventory",
		deletions: 8,
		filesChanged: 14,
		relativeTime: "3d",
		title: PAY_101_INVENTORY_PR_ARTIFACT.title,
	}),
	"PAY-102": createPreview({
		additions: 186,
		author: PAY_STORY_PEOPLE.maya,
		branch: "pay-102-legacy-adapter-spike",
		deletions: 41,
		filesChanged: 9,
		relativeTime: "2d",
		title: "Verify adapter removal",
	}),
	"PAY-104": createPreview({
		additions: 248,
		author: PAY_STORY_PEOPLE.jordan,
		branch: "pay-104-create-payment-intent",
		deletions: 33,
		filesChanged: 11,
		relativeTime: "yesterday",
		title: "Port payment intents",
	}),
	"PAY-105": createPreview({
		additions: 274,
		author: PAY_STORY_PEOPLE.jordan,
		branch: "pay-105-confirm-3ds-challenge",
		deletions: 52,
		filesChanged: 13,
		relativeTime: "2h",
		title: "Port 3DS flow",
	}),
	"PAY-107": createPreview({
		additions: 163,
		author: PAY_STORY_PEOPLE.maya,
		branch: "pay-107-retry-backoff-extract",
		deletions: 88,
		filesChanged: 7,
		relativeTime: "4h",
		title: "Extract retry policy",
	}),
	"PAY-109": createPreview({
		additions: 419,
		author: PAY_STORY_PEOPLE.maya,
		branch: "pay-109-webhook-openapi-codegen",
		deletions: 27,
		filesChanged: 18,
		relativeTime: "yesterday",
		title: "Refresh webhook data",
	}),
	"PAY-112": createPreview({
		additions: 97,
		author: PAY_STORY_PEOPLE.jordan,
		branch: "pay-112-sandbox-key-retention",
		deletions: 12,
		filesChanged: 4,
		relativeTime: "6h",
		title: "Set key retention",
	}),
	"PAY-113": createPreview({
		additions: 531,
		author: PAY_STORY_PEOPLE.jordan,
		branch: "pay-113-3ds-contract-suite",
		deletions: 19,
		filesChanged: 22,
		relativeTime: "4d",
		title: "Add 3DS contracts",
	}),
	"PAY-119": createPreview({
		additions: 64,
		author: PAY_STORY_PEOPLE.maya,
		branch: "pay-119-rollback-rehearsal-runbook",
		deletions: 3,
		filesChanged: 3,
		relativeTime: "8h",
		title: "Publish rollback guide",
	}),
	"PAY-121": createPreview({
		additions: 142,
		author: PAY_STORY_PEOPLE.priya,
		branch: "pay-121-account-targeting-kill-switch",
		deletions: 16,
		filesChanged: 6,
		relativeTime: "12h",
		title: "Add kill switch",
	}),
	"PAY-126": createPreview({
		additions: 28,
		author: PAY_STORY_PEOPLE.maya,
		branch: "pay-126-delete-legacy-adapter",
		deletions: 410,
		filesChanged: 17,
		relativeTime: "5d",
		title: "Remove v1 adapter",
	}),
	"PAY-128": createPreview({
		additions: 81,
		author: PAY_STORY_PEOPLE.maya,
		branch: "pay-128-sdk-version-settlement",
		deletions: 9,
		filesChanged: 5,
		relativeTime: "3h",
		title: "Stamp SDK version",
	}),
} as const satisfies Readonly<Record<string, JiraIssuePullRequestPreview>>;

export function getJiraTeamEu26PullRequestPreview(
	code: string,
): JiraIssuePullRequestPreview | undefined {
	return JIRA_TEAM_EU26_PULL_REQUEST_PREVIEWS[
		code as keyof typeof JIRA_TEAM_EU26_PULL_REQUEST_PREVIEWS
	];
}
