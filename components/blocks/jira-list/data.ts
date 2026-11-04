import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";

import type { JiraListAssignedAgent, JiraListRowData } from "./jira-list-types";

export type JiraListSampleRow = JiraListRowData;

function sampleAssignedAgent(
	name: string,
	visual: { avatarSrc?: string; brandName?: ThirdPartyLogoName } = {},
): JiraListAssignedAgent {
	return {
		id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
		name,
		...visual,
		statusKind: "idle",
		statusLabel: "Assigned",
	};
}

export const JIRA_LIST_SAMPLE_ROWS: readonly JiraListSampleRow[] = [
	{
		issueKey: "PD-001",
		summary: "Review and access threaded-ideas survey",
		issueType: "epic",
		priority: "medium",
		status: "In progress",
		statusVariant: "information",
		assignee: {
			id: "maya-chen",
			name: "Maya Chen",
			avatarSrc: "/avatar-user/andrea-wilson/color/asow-service-yellow.png",
		},
		agentSessions: [
			sampleAssignedAgent("Survey summarizer", {
				avatarSrc: "/avatar-agent-new/purple/customer-insight.svg",
			}),
			sampleAssignedAgent("Readiness checker", {
				avatarSrc: "/avatar-agent-new/blue/backlog-buddy.svg",
			}),
			sampleAssignedAgent("Theme analyzer", {
				avatarSrc: "/avatar-agent-new/blue/research-scout.svg",
			}),
		],
		goals: [{ text: "Improve response quality" }],
		labels: [
			{ text: "research", color: "teal" },
			{ text: "team-24", color: "discovery" },
			{ text: "VULN-1966436", color: "red" },
			{ text: "sales-css", color: "blue" },
			{ text: "user-initiated", color: "teal" },
		],
		dueDate: "Jul 18, 2026",
		contributors: [
			{
				id: "maya-chen",
				name: "Maya Chen",
				avatarSrc: "/avatar-user/andrea-wilson/color/asow-service-yellow.png",
			},
			{
				id: "priya-shah",
				name: "Priya Shah",
				avatarSrc: "/avatar-user/annie-clare/color/asow-strategy-orange.png",
			},
			{
				id: "jordan-lee",
				name: "Jordan Lee",
				avatarSrc: "/avatar-user/andrew-park/color/asow-dev-lime.png",
			},
			{
				id: "rfp-agent",
				name: "RFP Drafter",
				avatarUnassignedKind: "agent",
			},
		],
	},
	{
		issueKey: "PD-002",
		summary: "Capture survey response anomalies across enterprise accounts",
		issueType: "task",
		priority: "major",
		status: "In review",
		statusVariant: "warning",
		assignee: {
			id: "priya-shah",
			name: "Priya Shah",
			avatarSrc: "/avatar-user/annie-clare/color/asow-strategy-orange.png",
		},
		agentSessions: [
			sampleAssignedAgent("Signal monitor", {
				avatarSrc: "/avatar-agent-new/lime/ops-agent.svg",
			}),
		],
		goals: [{ text: "Reduce escalation volume", emphasis: "warning" }],
		labels: [
			{ text: "signals", color: "orange" },
			{ text: "enterprise", color: "discovery" },
		],
		dueDate: "Jul 20, 2026",
		contributors: [
			{
				id: "priya-shah",
				name: "Priya Shah",
				avatarSrc: "/avatar-user/annie-clare/color/asow-strategy-orange.png",
			},
			{
				id: "rfp-agent",
				name: "RFP Drafter",
				avatarUnassignedKind: "agent",
			},
		],
	},
	{
		issueKey: "PD-003",
		summary: "Draft the threaded-ideas follow-up checklist",
		issueType: "story",
		priority: "minor",
		status: "Done",
		statusVariant: "success",
		assignee: {
			id: "jordan-lee",
			name: "Jordan Lee",
			avatarSrc: "/avatar-user/andrew-park/color/asow-dev-lime.png",
		},
		agentSessions: [
			sampleAssignedAgent("Checklist drafter", {
				avatarSrc: "/avatar-agent-new/blue/auto-dev.svg",
			}),
			sampleAssignedAgent("Content reviewer", {
				avatarSrc: "/avatar-agent-new/lime/auto-review.svg",
			}),
		],
		goals: [{ text: "Publish checklist" }],
		labels: [
			{ text: "ops", color: "blue" },
			{ text: "playbook", color: "green" },
		],
		dueDate: "Jul 14, 2026",
		contributors: [
			{
				id: "jordan-lee",
				name: "Jordan Lee",
				avatarSrc: "/avatar-user/andrew-park/color/asow-dev-lime.png",
			},
		],
	},
	{
		issueKey: "PD-004",
		summary: "Prepare launch brief for cross-product survey insights",
		issueType: "epic",
		priority: "major",
		status: "Blocked",
		statusVariant: "danger",
		assignee: {
			id: "david-hsieh",
			name: "David Hsieh",
			avatarSrc: "/avatar-user/david-hsieh/color/asow-service-yellow.png",
		},
		agentSessions: [
			sampleAssignedAgent("Launch planner", {
				avatarSrc: "/avatar-agent-new/lime/auto-dev.svg",
			}),
			sampleAssignedAgent("Release notes drafter", {
				avatarSrc: "/avatar-agent-new/blue/release-notes.svg",
			}),
		],
		goals: [{ text: "Align launch narrative" }],
		labels: [
			{ text: "launch", color: "red" },
			{ text: "narrative", color: "purple" },
		],
		dueDate: "Jul 24, 2026",
		contributors: [
			{
				id: "david-hsieh",
				name: "David Hsieh",
				avatarSrc: "/avatar-user/david-hsieh/color/asow-service-yellow.png",
			},
			{
				id: "maya-chen",
				name: "Maya Chen",
				avatarSrc: "/avatar-user/andrea-wilson/color/asow-service-yellow.png",
			},
		],
	},
	{
		issueKey: "PD-005",
		summary: "Collect approval notes from legal and security reviewers",
		issueType: "subtask",
		priority: "major",
		status: "To do",
		statusVariant: "neutral",
		assignee: {
			id: "elena-ruiz",
			name: "Elena Ruiz",
			avatarSrc: "/avatar-user/aoife-burke/color/asow-service-yellow.png",
		},
		agentSessions: [
			sampleAssignedAgent("Approval tracker", {
				avatarSrc: "/avatar-agent-new/blue/backlog-buddy.svg",
			}),
		],
		goals: [{ text: "Unblock launch brief", emphasis: "warning" }],
		labels: [{ text: "approvals", color: "yellow" }],
		dueDate: "Jul 21, 2026",
		contributors: [
			{
				id: "elena-ruiz",
				name: "Elena Ruiz",
				avatarSrc: "/avatar-user/aoife-burke/color/asow-service-yellow.png",
			},
		],
	},
	{
		issueKey: "PD-006",
		summary: "Fix duplicate submission bug in survey export flow",
		issueType: "bug",
		priority: "major",
		status: "In progress",
		statusVariant: "information",
		assignee: {
			id: "florence-garcia",
			name: "Florence Garcia",
			avatarSrc: "/avatar-user/florence-garcia/color/asow-strategy-orange.png",
		},
		agentSessions: [
			sampleAssignedAgent("Bug triage", {
				avatarSrc: "/avatar-agent-new/blue/auto-fix.svg",
			}),
		],
		goals: [{ text: "Restore export accuracy" }],
		labels: [
			{ text: "bug", color: "red" },
			{ text: "export", color: "blue" },
		],
		dueDate: "Jul 16, 2026",
		contributors: [
			{
				id: "florence-garcia",
				name: "Florence Garcia",
				avatarSrc: "/avatar-user/florence-garcia/color/asow-strategy-orange.png",
			},
			{
				id: "code-reviewer",
				name: "Code Reviewer",
				avatarUnassignedKind: "agent",
			},
		],
	},
	{
		issueKey: "PD-007",
		summary: "Publish customer-ready highlights for survey analytics",
		issueType: "task",
		priority: "minor",
		status: "Done",
		statusVariant: "success",
		assignee: {
			id: "maya-chen",
			name: "Maya Chen",
			avatarSrc: "/avatar-user/andrea-wilson/color/asow-service-yellow.png",
		},
		agentSessions: [
			sampleAssignedAgent("Insight summarizer", {
				avatarSrc: "/avatar-agent-new/orange/research-scout.svg",
			}),
			sampleAssignedAgent("Editor", {
				avatarSrc: "/avatar-agent-new/lime/comms-drafter.svg",
			}),
		],
		goals: [{ text: "Increase stakeholder adoption" }],
		labels: [
			{ text: "analytics", color: "lime" },
			{ text: "customer", color: "discovery" },
		],
		dueDate: "Jul 12, 2026",
		contributors: [
			{
				id: "maya-chen",
				name: "Maya Chen",
				avatarSrc: "/avatar-user/andrea-wilson/color/asow-service-yellow.png",
			},
			{
				id: "jordan-lee",
				name: "Jordan Lee",
				avatarSrc: "/avatar-user/andrew-park/color/asow-dev-lime.png",
			},
		],
	},
] as const;
