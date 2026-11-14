import type { ComponentType } from "react";
import type { NewCoreIconProps } from "@atlaskit/icon/base-new";
import AddIcon from "@atlaskit/icon/core/add";
import AlignTextLeftIcon from "@atlaskit/icon/core/align-text-left";
import AppsIcon from "@atlaskit/icon/core/apps";
import ArrowUpRightIcon from "@atlaskit/icon/core/arrow-up-right";
import ChartTrendIcon from "@atlaskit/icon/core/chart-trend";
import ChartTrendUpIcon from "@atlaskit/icon/core/chart-trend-up";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import CreditCardIcon from "@atlaskit/icon/core/credit-card";
import DashboardIcon from "@atlaskit/icon/core/dashboard";
import DownloadIcon from "@atlaskit/icon/core/download";
import GlobeIcon from "@atlaskit/icon/core/globe";
import LockLockedIcon from "@atlaskit/icon/core/lock-locked";
import OfficeBuildingIcon from "@atlaskit/icon/core/office-building";
import PersonAddIcon from "@atlaskit/icon/core/person-add";
import PersonIcon from "@atlaskit/icon/core/person";
import ShieldIcon from "@atlaskit/icon/core/shield";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import SettingsIcon from "@atlaskit/icon/core/settings";
import DatabaseStorageIcon from "@atlaskit/icon-lab/core/database-storage";
import DirectoryIcon from "@atlaskit/icon-lab/core/directory";
import RovoIcon from "@atlaskit/icon-lab/core/rovo";

export type AdminIconComponent = ComponentType<NewCoreIconProps>;

export interface AdminNavLeaf {
	label: string;
	type?: "bullet" | "site";
	emoji?: string;
	colorClassName?: string;
}

export interface AdminNavSection {
	defaultExpanded?: boolean;
	icon: AdminIconComponent;
	items?: readonly AdminNavLeaf[];
	label: string;
	nested?: readonly {
		defaultExpanded?: boolean;
		items: readonly AdminNavLeaf[];
		label: string;
	}[];
	type: "expandable" | "leaf";
}

export const ADMIN_ICONS = {
	add: AddIcon,
	alignTextLeft: AlignTextLeftIcon,
	apps: AppsIcon,
	arrowUpRight: ArrowUpRightIcon,
	chartTrend: ChartTrendIcon,
	chartTrendUp: ChartTrendUpIcon,
	chevronDown: ChevronDownIcon,
	chevronRight: ChevronRightIcon,
	creditCard: CreditCardIcon,
	dashboard: DashboardIcon,
	directory: DirectoryIcon,
	download: DownloadIcon,
	globe: GlobeIcon,
	lockLocked: LockLockedIcon,
	officeBuilding: OfficeBuildingIcon,
	person: PersonIcon,
	personAdd: PersonAddIcon,
	rovo: RovoIcon,
	settings: SettingsIcon,
	shield: ShieldIcon,
	showMoreHorizontal: ShowMoreHorizontalIcon,
	databaseStorage: DatabaseStorageIcon,
} as const;

export const ADMIN_NAV_SECTIONS: readonly AdminNavSection[] = [
	{ icon: DashboardIcon, label: "Overview", type: "leaf" },
	{
		defaultExpanded: true,
		icon: DirectoryIcon,
		items: [
			{ label: "Users" },
			{ label: "Groups" },
			{ label: "Teams" },
			{ label: "Managed accounts" },
			{ label: "Service accounts" },
			{ label: "Administrators" },
			{ label: "Domains" },
		],
		label: "Directory",
		type: "expandable",
	},
	{
		defaultExpanded: true,
		icon: AppsIcon,
		items: [
			{ label: "Atlassian apps" },
			{ label: "Connectors" },
			{ label: "App access settings" },
			{ label: "User requests" },
			{ label: "App URLs" },
			{ label: "User counts" },
			{ label: "Sandboxes" },
			{ label: "Platform experiences" },
		],
		label: "Apps",
		nested: [
			{
				items: [
					{ label: "App updates", type: "bullet" },
					{ label: "Release tracks", type: "bullet" },
					{ label: "Freeze windows", type: "bullet" },
				],
				label: "Release management",
			},
			{
				items: [
					{ label: "Shadow IT apps", type: "bullet" },
					{ label: "Shadow IT controls", type: "bullet" },
				],
				label: "Shadow IT",
			},
			{
				defaultExpanded: true,
				items: [
					{ colorClassName: "bg-yellow-100", emoji: "M", label: "Moon unit 5000", type: "site" },
					{ colorClassName: "bg-teal-100", emoji: "P", label: "Peak twins", type: "site" },
					{ colorClassName: "bg-red-100", emoji: "B", label: "Bobby R Easels", type: "site" },
					{ colorClassName: "bg-purple-100", emoji: "C", label: "Cursor codes", type: "site" },
					{ colorClassName: "bg-blue-100", emoji: "K", label: "Koality chewy", type: "site" },
					{ label: "View all sites" },
				],
				label: "Sites",
			},
		],
		type: "expandable",
	},
	{
		defaultExpanded: true,
		icon: RovoIcon,
		items: [
			{ label: "Rovo access" },
			{ label: "Agents" },
			{ label: "Rovo MCP server" },
			{ label: "Rovo insights" },
			{ label: "Rovo settings" },
		],
		label: "Rovo",
		type: "expandable",
	},
	{
		icon: ShieldIcon,
		items: [{ label: "Security guide" }],
		label: "Security",
		nested: [
			{
				items: [
					{ label: "Authentication policies", type: "bullet" },
					{ label: "External users", type: "bullet" },
					{ label: "Identity providers", type: "bullet" },
				],
				label: "User security",
			},
			{
				items: [
					{ label: "Data classification", type: "bullet" },
					{ label: "Data security policies", type: "bullet" },
					{ label: "Encryption", type: "bullet" },
					{ label: "HIPAA compliance", type: "bullet" },
				],
				label: "Data protection",
			},
			{
				items: [
					{ label: "IP allowlists", type: "bullet" },
					{ label: "Mobile app policies", type: "bullet" },
				],
				label: "Device security",
			},
		],
		type: "expandable",
	},
	{
		icon: DatabaseStorageIcon,
		items: [
			{ label: "Data transfer" },
			{ label: "Backups" },
			{ label: "Data residency" },
			{ label: "Migration plans" },
			{ label: "Link fixing" },
		],
		label: "Data management",
		nested: [
			{ items: [{ label: "Data use", type: "bullet" }], label: "Privacy" },
			{
				items: [
					{ label: "Connected sources", type: "bullet" },
					{ label: "Application tunnels", type: "bullet" },
				],
				label: "Data sources",
			},
		],
		type: "expandable",
	},
	{
		icon: ChartTrendIcon,
		items: [
			{ label: "Platform usage" },
			{ label: "Analytics" },
			{ label: "Audit log" },
			{ label: "System health" },
			{ label: "Portfolio insights" },
			{ label: "API token activity" },
		],
		label: "Insights",
		type: "expandable",
	},
	{ icon: CreditCardIcon, label: "Billing", type: "leaf" },
	{
		icon: SettingsIcon,
		items: [
			{ label: "Profile" },
			{ label: "Emails" },
			{ label: "Contacts" },
			{ label: "Login page" },
			{ label: "API keys" },
		],
		label: "Organization settings",
		type: "expandable",
	},
];
