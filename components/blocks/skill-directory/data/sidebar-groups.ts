import type { SkillCategory } from "@/app/data/directory/skills";
import type { AtlassianLogoName } from "@/components/ui/logo";
import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";

/** Primary (sectionless) nav rows shown above the first group heading. */
export interface SkillDirectoryPrimaryItem {
	id: string;
	label: string;
}

/** Icon keys for the `Category` group tiles (resolved in the sidebar component). */
export type SkillNavIcon =
	| "timeline"
	| "settings"
	| "edit"
	| "chart-trend-up"
	| "angle-brackets"
	| "support"
	| "branch"
	| "shield"
	| "people-group"
	| "cart";

export interface SkillDirectoryFavouriteItem {
	kind: "skill";
	/** References a skill id in the directory data. */
	id: string;
}

export interface SkillDirectoryCategoryItem {
	kind: "category";
	id: SkillCategory;
	label: string;
	icon: SkillNavIcon;
}

export interface SkillDirectoryCompanyItem {
	kind: "company";
	id: string;
	label: string;
	logoSrc?: string;
	/** When set, renders the ADS brand logo instead of a `logoSrc` image. */
	logoName?: AtlassianLogoName;
	/** When set, renders the upstream `@atlassian/logo-third-party` mark. */
	brandName?: ThirdPartyLogoName;
	/**
	 * When true, wrap the logo in a bordered VPK tile. Use for bare marks that
	 * lack their own tile/background (e.g. the Atlassian brand mark, Tempo).
	 */
	needsTile?: boolean;
}

export type SkillDirectorySidebarItem =
	| SkillDirectoryFavouriteItem
	| SkillDirectoryCategoryItem
	| SkillDirectoryCompanyItem;

export interface SkillDirectorySidebarGroup {
	title: string;
	items: readonly SkillDirectorySidebarItem[];
	showAll?: boolean;
}

export const DEFAULT_SKILL_DIRECTORY_PRIMARY_ITEMS: readonly SkillDirectoryPrimaryItem[] = [
	{ id: "all-skills", label: "All skills" },
	{ id: "favorite-skills", label: "Favourite skills" },
	{ id: "your-skills", label: "Your skills" },
];

export const DEFAULT_SKILL_DIRECTORY_SIDEBAR_GROUPS: readonly SkillDirectorySidebarGroup[] = [
	{
		title: "By companies",
		items: [
			{ kind: "company", id: "atlassian", label: "Atlassian", logoName: "atlassian", needsTile: true },
			{ kind: "company", id: "stripe", label: "Stripe", brandName: "stripe" },
			{ kind: "company", id: "tempo", label: "Tempo", logoSrc: "/2p/tempo-software.png", needsTile: true },
			{ kind: "company", id: "google", label: "Google", brandName: "google-drive" },
			{ kind: "company", id: "notion", label: "Notion", brandName: "notion" },
			{ kind: "company", id: "slack", label: "Slack", brandName: "slack" },
			{ kind: "company", id: "figma", label: "Figma", brandName: "figma" },
			{ kind: "company", id: "github", label: "GitHub", brandName: "github" },
			{ kind: "company", id: "salesforce", label: "Salesforce", brandName: "salesforce" },
			{ kind: "company", id: "zoom", label: "Zoom", brandName: "zoom" },
			{ kind: "company", id: "asana", label: "Asana", brandName: "asana" },
			{ kind: "company", id: "miro", label: "Miro", brandName: "miro" },
			{ kind: "company", id: "dropbox", label: "Dropbox", brandName: "dropbox" },
			{ kind: "company", id: "gitkraken", label: "GitKraken", logoSrc: "/2p/gitkraken.png", needsTile: true },
			{ kind: "company", id: "appfire", label: "Appfire", logoSrc: "/2p/appfire.png", needsTile: true },
		],
	},
];
