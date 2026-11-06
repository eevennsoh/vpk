import AutomationIcon from "@atlaskit/icon/core/automation";
import BranchIcon from "@atlaskit/icon/core/branch";
import ChartBarIcon from "@atlaskit/icon/core/chart-bar";
import ClockIcon from "@atlaskit/icon/core/clock";
import LinkBrokenIcon from "@atlaskit/icon/core/link-broken";
import MagicWandIcon from "@atlaskit/icon/core/magic-wand";

import type { NextBestActionItem } from "@/components/blocks/next-best-action";

// Reuses the Artifact List row anatomy (leading tile, title, "kind · rationale"
// metadata, hover-revealed action) but swaps artifacts for proactive
// suggestions: things the product noticed you could create, enable, or connect.
export const SAMPLE_NEXT_BEST_ACTIONS: readonly NextBestActionItem[] = [
	{
		id: "create-release-notes-skill",
		title: "Create a “Release notes drafter” skill",
		source: "Suggested skill",
		owner: "You wrote 14 similar prompts this month",
		icon: <MagicWandIcon label="" />,
		tileVariant: "purpleSubtle",
		rowActionLabel: "Create",
	},
	{
		id: "create-sprint-triage-agent",
		title: "Create a “Sprint triage” agent",
		source: "Suggested agent",
		owner: "Would cover 23 untriaged bugs",
		avatarSrc: "/avatar-agent-new/blue/backlog-buddy.svg",
		rowActionLabel: "Create",
	},
	{
		id: "automate-in-review-on-pr",
		title: "Move work items to In review when a PR opens",
		source: "Suggested automation",
		owner: "You did this by hand 31 times",
		icon: <AutomationIcon label="" />,
		tileVariant: "blueSubtle",
		rowActionLabel: "Enable",
	},
	{
		id: "connect-github-to-board",
		title: "Connect GitHub to teams-in-space-frontend",
		source: "Suggested integration",
		owner: "Used by 8 teams in your org",
		logoName: "github",
		rowActionLabel: "Connect",
	},
	{
		id: "estimate-backlog-items",
		title: "Add estimates to 12 unestimated backlog items",
		source: "Suggested nudge",
		owner: "Before Sprint 24 planning on Friday",
		icon: <ChartBarIcon label="" />,
		tileVariant: "greenSubtle",
		rowActionLabel: "Review",
	},
];

// Compact rows model the in-context "Work suggestions" nudges: denser, and the
// pull-request row swaps its action for inline diff stats.
export const COMPACT_SAMPLE_NEXT_BEST_ACTIONS: readonly NextBestActionItem[] = [
	{
		id: "review-pull-request",
		title: "VertexRail Assets positioning",
		source: "Review pull request",
		href: "https://github.com/vertexrail/teams-in-space-frontend/pull/1847",
		logoName: "github",
		pullRequest: {
			number: 1847,
			status: "Open",
			additions: 148,
			deletions: 37,
		},
	},
	{
		id: "changes-requested",
		title: "Your pull request has changes requested",
		source: "BG-16 Set up CLI schema generation",
		owner: "teams-in-space-frontend",
		icon: <BranchIcon label="" />,
		tileVariant: "orangeSubtle",
		rowActionLabel: "Review",
	},
	{
		id: "view-blocking-issue",
		title: "View blocking issue",
		source: "Migrate approvers and launch checks",
		owner: "Blocks 2 issues",
		icon: <LinkBrokenIcon label="" />,
		tileVariant: "redSubtle",
		rowActionLabel: "View",
	},
	{
		id: "stale-work-item",
		title: "Stale work item — no update in 34 days",
		source: "BG-10 Adjust target SLO",
		owner: "teams-in-space-frontend",
		icon: <ClockIcon label="" />,
		tileVariant: "yellowSubtle",
		rowActionLabel: "Update",
	},
];
