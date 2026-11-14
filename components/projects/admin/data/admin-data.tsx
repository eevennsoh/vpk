import AppsIcon from "@atlaskit/icon/core/apps";
import ChartTrendUpIcon from "@atlaskit/icon/core/chart-trend-up";
import GlobeIcon from "@atlaskit/icon/core/globe";
import LockLockedIcon from "@atlaskit/icon/core/lock-locked";
import PersonAddIcon from "@atlaskit/icon/core/person-add";
import ShieldIcon from "@atlaskit/icon/core/shield";
import SettingsIcon from "@atlaskit/icon/core/settings";

export const ADMIN_QUICK_ACTIONS = [
	{ icon: PersonAddIcon, label: "Invite users" },
	{ icon: AppsIcon, label: "Add app" },
	{ icon: GlobeIcon, label: "Verify domain" },
] as const;

export const ADMIN_LINE_CHART_DATA = [
	{ date: "Jul 7", value: 200 },
	{ date: "Jul 8", value: 400 },
	{ date: "Jul 9", value: 600 },
	{ date: "Jul 10", value: 750 },
	{ date: "Jul 11", value: 900 },
	{ date: "Jul 12", value: 1300 },
	{ date: "Jul 13", value: 1100 },
] as const;

export const ADMIN_AREA_CHART_DATA = [
	{ date: "Jan", value: 11200 },
	{ date: "Feb", value: 12800 },
	{ date: "Mar", value: 14539 },
] as const;

export const ADMIN_BAR_CHART_DATA = [
	{ label: "Jira", value: 190 },
	{ label: "Confluence", value: 130 },
	{ label: "Loom", value: 110 },
	{ label: "JSM", value: 25 },
] as const;

export const ADMIN_DISCOVER_CARDS = [
	{
		accentClassName: "bg-green-50 text-icon-accent-green",
		description: "Keep track of how your organization is using Rovo credits and other features.",
		icon: ChartTrendUpIcon,
		title: "Platform usage",
	},
	{
		accentClassName: "bg-blue-50 text-icon-accent-blue",
		description: "Enforce security policies, understand your risk profile, and quickly remediate issues.",
		icon: ShieldIcon,
		title: "Atlassian Guard",
	},
	{
		accentClassName: "bg-orange-50 text-icon-accent-orange",
		description: "Specify security settings for different sets of users and configurations.",
		icon: LockLockedIcon,
		title: "Authentication policies",
	},
	{
		accentClassName: "bg-purple-50 text-icon-accent-purple",
		description: "Connect the work your team does across different apps.",
		icon: SettingsIcon,
		title: "Platform experiences",
	},
] as const;

export const ADMIN_USER_METRICS = [
	{ label: "Total users", value: "1,437" },
	{ label: "Active users", value: "1,387" },
	{ label: "Managed accounts", value: "0" },
	{ label: "Organization admins", value: "0" },
] as const;

export const ADMIN_SPACES = [
	{
		description: "Collaborative space for design discussions and resources",
		members: 8,
		name: "Design Team",
		type: "Team Space",
	},
	{
		description: "Technical documentation and development resources",
		members: 12,
		name: "Engineering",
		type: "Team Space",
	},
	{
		description: "Strategic planning and product roadmap discussions",
		members: 5,
		name: "Product Planning",
		type: "Project Space",
	},
	{
		description: "General company information and policies",
		members: 25,
		name: "Company Wiki",
		type: "Knowledge Base",
	},
] as const;

export const ADMIN_PROJECTS = [
	{
		description: "Complete redesign of the company website using modern design principles",
		name: "Website Redesign",
		status: "In Progress",
		variant: "information",
	},
	{
		description: "Native mobile application for iOS and Android platforms",
		name: "Mobile App",
		status: "Planning",
		variant: "discovery",
	},
	{
		description: "Integration with third-party APIs for enhanced functionality",
		name: "API Integration",
		status: "Complete",
		variant: "success",
	},
] as const;

export const ADMIN_INVOICES = [
	{ amount: "$150.00", date: "Dec 1, 2024", description: "Team Plan - December 2024", status: "Paid" },
	{ amount: "$150.00", date: "Nov 1, 2024", description: "Team Plan - November 2024", status: "Paid" },
	{ amount: "$150.00", date: "Oct 1, 2024", description: "Team Plan - October 2024", status: "Paid" },
	{ amount: "$150.00", date: "Sep 1, 2024", description: "Team Plan - September 2024", status: "Paid" },
	{ amount: "$150.00", date: "Aug 1, 2024", description: "Team Plan - August 2024", status: "Paid" },
] as const;

export type AdminAuditStatus = "failure" | "success" | "warning";

export interface AdminAuditLog {
	action: string;
	details: string;
	id: number;
	ipAddress: string;
	resource: string;
	status: AdminAuditStatus;
	timestamp: string;
	user: string;
}

export const ADMIN_AUDIT_LOGS: readonly AdminAuditLog[] = [
	{ id: 1, timestamp: "2024-12-15T10:30:00Z", user: "admin@company.com", action: "User created", resource: "john.smith@company.com", status: "success", details: "New user account created with standard permissions", ipAddress: "192.168.1.100" },
	{ id: 2, timestamp: "2024-12-15T09:15:00Z", user: "admin@company.com", action: "Settings updated", resource: "Security Policy", status: "success", details: "Updated password policy: minimum length changed from 8 to 12", ipAddress: "192.168.1.100" },
	{ id: 3, timestamp: "2024-12-14T16:45:00Z", user: "user1@company.com", action: "User login", resource: "Web Portal", status: "failure", details: "Failed login attempt - incorrect password (attempt 3/5)", ipAddress: "10.0.0.55" },
	{ id: 4, timestamp: "2024-12-14T14:20:00Z", user: "admin@company.com", action: "Permission changed", resource: "marketing-team", status: "success", details: "Added write access to shared drive", ipAddress: "192.168.1.100" },
	{ id: 5, timestamp: "2024-12-14T11:00:00Z", user: "system@company.com", action: "Backup completed", resource: "Full System Backup", status: "success", details: "Weekly backup completed successfully. Size: 2.4GB", ipAddress: "10.0.0.1" },
	{ id: 6, timestamp: "2024-12-13T22:30:00Z", user: "system@company.com", action: "Security alert", resource: "Firewall", status: "warning", details: "Unusual traffic pattern detected from external IP range", ipAddress: "10.0.0.1" },
	{ id: 7, timestamp: "2024-12-13T15:10:00Z", user: "admin@company.com", action: "Data exported", resource: "User Report Q4", status: "success", details: "Exported 1,437 user records to CSV", ipAddress: "192.168.1.100" },
	{ id: 8, timestamp: "2024-12-13T10:45:00Z", user: "admin@company.com", action: "Integration connected", resource: "Slack Workspace", status: "success", details: "Connected Slack integration for notifications", ipAddress: "192.168.1.100" },
	{ id: 9, timestamp: "2024-12-12T09:00:00Z", user: "admin@company.com", action: "Group created", resource: "qa-engineers", status: "success", details: "Created new group with 5 initial members", ipAddress: "192.168.1.100" },
	{ id: 10, timestamp: "2024-12-12T08:30:00Z", user: "admin@company.com", action: "Billing updated", resource: "Subscription", status: "success", details: "Upgraded from Team to Enterprise plan", ipAddress: "192.168.1.100" },
];
