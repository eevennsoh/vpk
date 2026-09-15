import type { JiraIssuePullRequestPreview } from "@/components/blocks/jira-issue/types";

import { PAY_101_INVENTORY_PR_ARTIFACT } from "./presentation-build";

const PAY_REPOSITORY = "payments-platform/payments";

const PAY_AUTHORS = {
	jordan: {
		name: "Jordan Okafor",
		avatarUrl: "/avatar-user/issac-varghese/color/asow-dev-lime.png",
	},
	maya: {
		name: "Maya Ferreira",
		avatarUrl: "/avatar-user/chloe-lee/color/asow-dev-lime.png",
	},
	priya: {
		name: "Priya Raman",
		avatarUrl: "/avatar-user/ting-chen/color/asow-teamwork-blue.png",
	},
} as const;

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
	author: (typeof PAY_AUTHORS)[keyof typeof PAY_AUTHORS];
	branch: string;
	deletions: number;
	filesChanged: number;
	relativeTime: string;
	title: string;
}>): JiraIssuePullRequestPreview {
	return {
		additions,
		author: { ...author },
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
export const JIRA_GOLDEN_JOURNEYS_V4_PULL_REQUEST_PREVIEWS = {
	"PAY-101": createPreview({
		additions: 312,
		author: PAY_AUTHORS.maya,
		branch: "pay-101-call-site-inventory",
		deletions: 8,
		filesChanged: 14,
		relativeTime: "3d",
		title: PAY_101_INVENTORY_PR_ARTIFACT.title,
	}),
	"PAY-102": createPreview({
		additions: 186,
		author: PAY_AUTHORS.maya,
		branch: "pay-102-legacy-adapter-spike",
		deletions: 41,
		filesChanged: 9,
		relativeTime: "2d",
		title: "Prove LegacyGatewayAdapter can be deleted outright",
	}),
	"PAY-104": createPreview({
		additions: 248,
		author: PAY_AUTHORS.jordan,
		branch: "pay-104-create-payment-intent",
		deletions: 33,
		filesChanged: 11,
		relativeTime: "yesterday",
		title: "Port createPaymentIntent onto the v2 client",
	}),
	"PAY-105": createPreview({
		additions: 274,
		author: PAY_AUTHORS.jordan,
		branch: "pay-105-confirm-3ds-challenge",
		deletions: 52,
		filesChanged: 13,
		relativeTime: "2h",
		title: "Port confirmPaymentIntent and the 3-D Secure challenge flow",
	}),
	"PAY-107": createPreview({
		additions: 163,
		author: PAY_AUTHORS.maya,
		branch: "pay-107-retry-backoff-extract",
		deletions: 88,
		filesChanged: 7,
		relativeTime: "4h",
		title: "Move retry and backoff out of LegacyGatewayAdapter",
	}),
	"PAY-109": createPreview({
		additions: 419,
		author: PAY_AUTHORS.maya,
		branch: "pay-109-webhook-openapi-codegen",
		deletions: 27,
		filesChanged: 18,
		relativeTime: "yesterday",
		title: "Regenerate webhook payloads from the v2 OpenAPI spec",
	}),
	"PAY-112": createPreview({
		additions: 97,
		author: PAY_AUTHORS.jordan,
		branch: "pay-112-sandbox-key-retention",
		deletions: 12,
		filesChanged: 4,
		relativeTime: "6h",
		title: "Confirm the sandbox key retention window before replay",
	}),
	"PAY-113": createPreview({
		additions: 531,
		author: PAY_AUTHORS.jordan,
		branch: "pay-113-3ds-contract-suite",
		deletions: 19,
		filesChanged: 22,
		relativeTime: "4d",
		title: "Land the 3-D Secure contract suite with 214 assertions",
	}),
	"PAY-119": createPreview({
		additions: 64,
		author: PAY_AUTHORS.maya,
		branch: "pay-119-rollback-rehearsal-runbook",
		deletions: 3,
		filesChanged: 3,
		relativeTime: "8h",
		title: "Publish and link the rollback rehearsal runbook",
	}),
	"PAY-121": createPreview({
		additions: 142,
		author: PAY_AUTHORS.priya,
		branch: "pay-121-account-targeting-kill-switch",
		deletions: 16,
		filesChanged: 6,
		relativeTime: "12h",
		title: "Add per-account targeting and an armed kill switch",
	}),
	"PAY-126": createPreview({
		additions: 28,
		author: PAY_AUTHORS.maya,
		branch: "pay-126-delete-legacy-adapter",
		deletions: 410,
		filesChanged: 17,
		relativeTime: "5d",
		title: "Delete LegacyGatewayAdapter after all 61 ports land",
	}),
	"PAY-128": createPreview({
		additions: 81,
		author: PAY_AUTHORS.maya,
		branch: "pay-128-sdk-version-settlement",
		deletions: 9,
		filesChanged: 5,
		relativeTime: "3h",
		title: "Stamp SDK version at settlement for finance exports",
	}),
} as const satisfies Readonly<Record<string, JiraIssuePullRequestPreview>>;

export function getJiraGoldenJourneysV4PullRequestPreview(
	code: string,
): JiraIssuePullRequestPreview | undefined {
	return JIRA_GOLDEN_JOURNEYS_V4_PULL_REQUEST_PREVIEWS[
		code as keyof typeof JIRA_GOLDEN_JOURNEYS_V4_PULL_REQUEST_PREVIEWS
	];
}
