import { createElement, type ComponentType } from "react";

export const ATLASSIAN_LOGO_SOURCE = "atlassian";
export const LOGO_TILE_SIZES = [
	"xxsmall",
	"xsmall",
	"small",
	"medium",
	"large",
	"xlarge",
] as const;

export function isAtlassianLogoSource(src: string | null | undefined): boolean {
	return src === ATLASSIAN_LOGO_SOURCE;
}
import type { LogoProps as AtlaskitLogoProps } from "@atlaskit/logo";

import { SHARED_LOGO_WRAPPERS } from "@/components/ui/data/logo-wrappers";
import { createLazyGlyph } from "@/components/ui/lazy-glyph";

type AtlassianLogoComponentProps = AtlaskitLogoProps & {
	shouldUseHexLogo?: boolean;
};

// Each product logo loads its own `@atlaskit/logo` entrypoint the first time it renders: the
// package's barrel is about 270 KB, while a route shows a few logos. Until it arrives, the logo's
// square box at its size is held empty (a lockup's wordmark arrives with it). Names the barrel
// aliases (Atlassian Administration and Analytics, Jira Align, the Loom attribution icon) load the
// entrypoint whose component the barrel renders for them.
function lazyLogo(load: () => Promise<ComponentType<AtlassianLogoComponentProps>>): ComponentType<AtlassianLogoComponentProps> {
	return createLazyGlyph<AtlassianLogoComponentProps>(
		load as () => Promise<ComponentType<AtlassianLogoComponentProps>>,
		(props) => CUSTOM_LOGO_SIZES[props.size ?? "medium"] ?? CUSTOM_LOGO_SIZES.medium,
	);
}

// Keeps the shared logo wrappers and their stylesheets in the page (logo-wrappers.ts).
void SHARED_LOGO_WRAPPERS;

// The barrel's Rovo logos are the hex mark, with the retired `shouldUseHexLogo` flag dropped.
function withoutHexLogoFlag(Component: ComponentType<AtlassianLogoComponentProps>): ComponentType<AtlassianLogoComponentProps> {
	return function RovoHexLogo({ shouldUseHexLogo, ...props }: AtlassianLogoComponentProps) {
		void shouldUseHexLogo;
		return createElement(Component, props);
	};
}

const AtlaskitAdminIcon = lazyLogo(() => import("@atlaskit/logo/admin/icon").then((module) => module.AdminIcon));
const AtlaskitAdminLogo = lazyLogo(() => import("@atlaskit/logo/admin/logo").then((module) => module.AdminLogoCS));
const AtlaskitAlignIcon = lazyLogo(() => import("@atlaskit/logo/align/icon").then((module) => module.AlignIcon));
const AtlaskitAlignLogo = lazyLogo(() => import("@atlaskit/logo/align/logo").then((module) => module.AlignLogoCS));
const AtlaskitAnalyticsIcon = lazyLogo(() => import("@atlaskit/logo/analytics/icon").then((module) => module.AnalyticsIcon));
const AtlaskitAnalyticsLogo = lazyLogo(() => import("@atlaskit/logo/analytics/logo").then((module) => module.AnalyticsLogoCS));
const AtlaskitAssetsIcon = lazyLogo(() => import("@atlaskit/logo/assets/icon").then((module) => module.AssetsIcon));
const AtlaskitAssetsLogo = lazyLogo(() => import("@atlaskit/logo/assets/logo").then((module) => module.AssetsLogoCS));
const AtlaskitAtlassianAdministrationIcon = lazyLogo(() => import("@atlaskit/logo/admin/icon").then((module) => module.AdminIcon));
const AtlaskitAtlassianAdministrationLogo = lazyLogo(() => import("@atlaskit/logo/admin/logo").then((module) => module.AdminLogoCS));
const AtlaskitAtlassianAnalyticsIcon = lazyLogo(() => import("@atlaskit/logo/analytics/icon").then((module) => module.AnalyticsIcon));
const AtlaskitAtlassianAnalyticsLogo = lazyLogo(() => import("@atlaskit/logo/analytics/logo").then((module) => module.AnalyticsLogoCS));
const AtlaskitAtlassianIcon = lazyLogo(() => import("@atlaskit/logo/atlassian-icon").then((module) => module.AtlassianIcon));
const AtlaskitAtlassianLogo = lazyLogo(() => import("@atlaskit/logo/atlassian/logo").then((module) => module.AtlassianLogo));
const AtlaskitBambooIcon = lazyLogo(() => import("@atlaskit/logo/bamboo/icon").then((module) => module.BambooIcon));
const AtlaskitBambooLogo = lazyLogo(() => import("@atlaskit/logo/bamboo/logo").then((module) => module.BambooLogoCS));
const AtlaskitBitbucketDataCenterIcon = lazyLogo(() => import("@atlaskit/logo/bitbucket-data-center/icon").then((module) => module.BitbucketDataCenterIcon));
const AtlaskitBitbucketDataCenterLogo = lazyLogo(() => import("@atlaskit/logo/bitbucket-data-center/logo").then((module) => module.BitbucketDataCenterLogoCS));
const AtlaskitBitbucketIcon = lazyLogo(() => import("@atlaskit/logo/bitbucket/icon").then((module) => module.BitbucketIcon));
const AtlaskitBitbucketLogo = lazyLogo(() => import("@atlaskit/logo/bitbucket/logo").then((module) => module.BitbucketLogoCS));
const AtlaskitChatIcon = lazyLogo(() => import("@atlaskit/logo/chat/icon").then((module) => module.ChatIcon));
const AtlaskitChatLogo = lazyLogo(() => import("@atlaskit/logo/chat/logo").then((module) => module.ChatLogoCS));
const AtlaskitCompassIcon = lazyLogo(() => import("@atlaskit/logo/compass/icon").then((module) => module.CompassIcon));
const AtlaskitCompassLogo = lazyLogo(() => import("@atlaskit/logo/compass/logo").then((module) => module.CompassLogoCS));
const AtlaskitConfluenceDataCenterIcon = lazyLogo(() => import("@atlaskit/logo/confluence-data-center/icon").then((module) => module.ConfluenceDataCenterIcon));
const AtlaskitConfluenceDataCenterLogo = lazyLogo(() => import("@atlaskit/logo/confluence-data-center/logo").then((module) => module.ConfluenceDataCenterLogoCS));
const AtlaskitConfluenceIcon = lazyLogo(() => import("@atlaskit/logo/confluence/icon").then((module) => module.ConfluenceIcon));
const AtlaskitConfluenceLogo = lazyLogo(() => import("@atlaskit/logo/confluence/logo").then((module) => module.ConfluenceLogoCS));
const AtlaskitCrowdIcon = lazyLogo(() => import("@atlaskit/logo/crowd/icon").then((module) => module.CrowdIcon));
const AtlaskitCrowdLogo = lazyLogo(() => import("@atlaskit/logo/crowd/logo").then((module) => module.CrowdLogoCS));
const AtlaskitCustomerServiceManagementIcon = lazyLogo(() => import("@atlaskit/logo/customer-service-management/icon").then((module) => module.CustomerServiceManagementIcon));
const AtlaskitCustomerServiceManagementLogo = lazyLogo(() => import("@atlaskit/logo/customer-service-management/logo").then((module) => module.CustomerServiceManagementLogoCS));
const AtlaskitDxIcon = lazyLogo(() => import("@atlaskit/logo/dx/icon").then((module) => module.DxIcon));
const AtlaskitFeedbackIcon = lazyLogo(() => import("@atlaskit/logo/feedback/icon").then((module) => module.FeedbackIcon));
const AtlaskitFeedbackLogo = lazyLogo(() => import("@atlaskit/logo/feedback/logo").then((module) => module.FeedbackLogoCS));
const AtlaskitFocusIcon = lazyLogo(() => import("@atlaskit/logo/focus/icon").then((module) => module.FocusIcon));
const AtlaskitFocusLogo = lazyLogo(() => import("@atlaskit/logo/focus/logo").then((module) => module.FocusLogoCS));
const AtlaskitGoalsIcon = lazyLogo(() => import("@atlaskit/logo/goals/icon").then((module) => module.GoalsIcon));
const AtlaskitGoalsLogo = lazyLogo(() => import("@atlaskit/logo/goals/logo").then((module) => module.GoalsLogoCS));
const AtlaskitGuardIcon = lazyLogo(() => import("@atlaskit/logo/guard/icon").then((module) => module.GuardIcon));
const AtlaskitGuardLogo = lazyLogo(() => import("@atlaskit/logo/guard/logo").then((module) => module.GuardLogoCS));
const AtlaskitHomeIcon = lazyLogo(() => import("@atlaskit/logo/home/icon").then((module) => module.HomeIcon));
const AtlaskitHomeLogo = lazyLogo(() => import("@atlaskit/logo/home/logo").then((module) => module.HomeLogoCS));
const AtlaskitHubIcon = lazyLogo(() => import("@atlaskit/logo/hub/icon").then((module) => module.HubIcon));
const AtlaskitHubLogo = lazyLogo(() => import("@atlaskit/logo/hub/logo").then((module) => module.HubLogoCS));
const AtlaskitJiraAlignIcon = lazyLogo(() => import("@atlaskit/logo/align/icon").then((module) => module.AlignIcon));
const AtlaskitJiraAlignLogo = lazyLogo(() => import("@atlaskit/logo/align/logo").then((module) => module.AlignLogoCS));
const AtlaskitJiraDataCenterIcon = lazyLogo(() => import("@atlaskit/logo/jira-data-center/icon").then((module) => module.JiraDataCenterIcon));
const AtlaskitJiraDataCenterLogo = lazyLogo(() => import("@atlaskit/logo/jira-data-center/logo").then((module) => module.JiraDataCenterLogoCS));
const AtlaskitJiraIcon = lazyLogo(() => import("@atlaskit/logo/jira/icon").then((module) => module.JiraIcon));
const AtlaskitJiraLogo = lazyLogo(() => import("@atlaskit/logo/jira/logo").then((module) => module.JiraLogoCS));
const AtlaskitJiraProductDiscoveryIcon = lazyLogo(() => import("@atlaskit/logo/jira-product-discovery/icon").then((module) => module.JiraProductDiscoveryIcon));
const AtlaskitJiraProductDiscoveryLogo = lazyLogo(() => import("@atlaskit/logo/jira-product-discovery/logo").then((module) => module.JiraProductDiscoveryLogoCS));
const AtlaskitJiraServiceManagementDataCenterIcon = lazyLogo(() => import("@atlaskit/logo/jira-service-management-data-center/icon").then((module) => module.JiraServiceManagementDataCenterIcon));
const AtlaskitJiraServiceManagementDataCenterLogo = lazyLogo(() => import("@atlaskit/logo/jira-service-management-data-center/logo").then((module) => module.JiraServiceManagementDataCenterLogoCS));
const AtlaskitJiraServiceManagementIcon = lazyLogo(() => import("@atlaskit/logo/jira-service-management/icon").then((module) => module.JiraServiceManagementIcon));
const AtlaskitJiraServiceManagementLogo = lazyLogo(() => import("@atlaskit/logo/jira-service-management/logo").then((module) => module.JiraServiceManagementLogoCS));
const AtlaskitLoomAttributionIcon = lazyLogo(() => import("@atlaskit/logo/loom/icon").then((module) => module.LoomIcon));
const AtlaskitLoomAttributionLogo = lazyLogo(() => import("@atlaskit/logo/loom-attribution/logo").then((module) => module.LoomAttributionLogoCS));
const AtlaskitLoomIcon = lazyLogo(() => import("@atlaskit/logo/loom/icon").then((module) => module.LoomIcon));
const AtlaskitLoomLogo = lazyLogo(() => import("@atlaskit/logo/loom/logo").then((module) => module.LoomLogoCS));
const AtlaskitOpsgenieIcon = lazyLogo(() => import("@atlaskit/logo/opsgenie/icon").then((module) => module.OpsgenieIcon));
const AtlaskitOpsgenieLogo = lazyLogo(() => import("@atlaskit/logo/opsgenie/logo").then((module) => module.OpsgenieLogoCS));
const AtlaskitProjectsIcon = lazyLogo(() => import("@atlaskit/logo/projects/icon").then((module) => module.ProjectsIcon));
const AtlaskitProjectsLogo = lazyLogo(() => import("@atlaskit/logo/projects/logo").then((module) => module.ProjectsLogoCS));
const AtlaskitRovoDevAgentIcon = lazyLogo(() => import("@atlaskit/logo/rovo-dev-agent/icon").then((module) => module.RovoDevAgentIcon));
const AtlaskitRovoDevAgentLogo = lazyLogo(() => import("@atlaskit/logo/rovo-dev-agent/logo").then((module) => module.RovoDevAgentLogoCS));
const AtlaskitRovoDevIcon = lazyLogo(() => import("@atlaskit/logo/rovo-dev/icon").then((module) => module.RovoDevIcon));
const AtlaskitRovoDevLogo = lazyLogo(() => import("@atlaskit/logo/rovo-dev/logo").then((module) => module.RovoDevLogoCS));
const AtlaskitRovoIcon = lazyLogo(() => import("@atlaskit/logo/rovo-hex/icon").then((module) => withoutHexLogoFlag(module.RovoHexIcon)));
const AtlaskitRovoLogo = lazyLogo(() => import("@atlaskit/logo/rovo-hex/logo").then((module) => withoutHexLogoFlag(module.RovoHexLogoCS)));
const AtlaskitSearchIcon = lazyLogo(() => import("@atlaskit/logo/search/icon").then((module) => module.SearchIcon));
const AtlaskitSearchLogo = lazyLogo(() => import("@atlaskit/logo/search/logo").then((module) => module.SearchLogoCS));
const AtlaskitStatuspageIcon = lazyLogo(() => import("@atlaskit/logo/statuspage/icon").then((module) => module.StatuspageIcon));
const AtlaskitStatuspageLogo = lazyLogo(() => import("@atlaskit/logo/statuspage/logo").then((module) => module.StatuspageLogoCS));
const AtlaskitStudioIcon = lazyLogo(() => import("@atlaskit/logo/studio/icon").then((module) => module.StudioIcon));
const AtlaskitStudioLogo = lazyLogo(() => import("@atlaskit/logo/studio/logo").then((module) => module.StudioLogoCS));
const AtlaskitTalentIcon = lazyLogo(() => import("@atlaskit/logo/talent/icon").then((module) => module.TalentIcon));
const AtlaskitTalentLogo = lazyLogo(() => import("@atlaskit/logo/talent/logo").then((module) => module.TalentLogoCS));
const AtlaskitTeamsIcon = lazyLogo(() => import("@atlaskit/logo/teams/icon").then((module) => module.TeamsIcon));
const AtlaskitTeamsLogo = lazyLogo(() => import("@atlaskit/logo/teams/logo").then((module) => module.TeamsLogoCS));
const AtlaskitTrelloIcon = lazyLogo(() => import("@atlaskit/logo/trello/icon").then((module) => module.TrelloIcon));
const AtlaskitTrelloLogo = lazyLogo(() => import("@atlaskit/logo/trello/logo").then((module) => module.TrelloLogoCS));

export type AtlassianLogoName =
	| "admin"
	| "align"
	| "analytics"
	| "assets"
	| "atlassian"
	| "atlassian-administration"
	| "atlassian-analytics"
	| "bamboo"
	| "bitbucket"
	| "bitbucket-data-center"
	| "chat"
	| "compass"
	| "confluence"
	| "confluence-data-center"
	| "crowd"
	| "customer-service-management"
	| "dx"
	| "feedback"
	| "focus"
	| "goals"
	| "guard"
	| "home"
	| "hub"
	| "jira"
	| "jira-align"
	| "jira-data-center"
	| "jira-product-discovery"
	| "jira-service-management"
	| "jira-service-management-data-center"
	| "loom"
	| "loom-attribution"
	| "opsgenie"
	| "projects"
	| "rovo"
	| "rovo-dev"
	| "rovo-dev-agent"
	| "search"
	| "statuspage"
	| "studio"
	| "talent"
	| "teams"
	| "trello";

export const LOGO_ICON_COMPONENTS: Record<AtlassianLogoName, ComponentType<AtlassianLogoComponentProps>> = {
	admin: AtlaskitAdminIcon,
	align: AtlaskitAlignIcon,
	analytics: AtlaskitAnalyticsIcon,
	assets: AtlaskitAssetsIcon,
	atlassian: AtlaskitAtlassianIcon,
	"atlassian-administration": AtlaskitAtlassianAdministrationIcon,
	"atlassian-analytics": AtlaskitAtlassianAnalyticsIcon,
	bamboo: AtlaskitBambooIcon,
	bitbucket: AtlaskitBitbucketIcon,
	"bitbucket-data-center": AtlaskitBitbucketDataCenterIcon,
	chat: AtlaskitChatIcon,
	compass: AtlaskitCompassIcon,
	confluence: AtlaskitConfluenceIcon,
	"confluence-data-center": AtlaskitConfluenceDataCenterIcon,
	crowd: AtlaskitCrowdIcon,
	"customer-service-management": AtlaskitCustomerServiceManagementIcon,
	dx: AtlaskitDxIcon,
	feedback: AtlaskitFeedbackIcon,
	focus: AtlaskitFocusIcon,
	goals: AtlaskitGoalsIcon,
	guard: AtlaskitGuardIcon,
	home: AtlaskitHomeIcon,
	hub: AtlaskitHubIcon,
	jira: AtlaskitJiraIcon,
	"jira-align": AtlaskitJiraAlignIcon,
	"jira-data-center": AtlaskitJiraDataCenterIcon,
	"jira-product-discovery": AtlaskitJiraProductDiscoveryIcon,
	"jira-service-management": AtlaskitJiraServiceManagementIcon,
	"jira-service-management-data-center": AtlaskitJiraServiceManagementDataCenterIcon,
	loom: AtlaskitLoomIcon,
	"loom-attribution": AtlaskitLoomAttributionIcon,
	opsgenie: AtlaskitOpsgenieIcon,
	projects: AtlaskitProjectsIcon,
	rovo: AtlaskitRovoIcon,
	"rovo-dev": AtlaskitRovoDevIcon,
	"rovo-dev-agent": AtlaskitRovoDevAgentIcon,
	search: AtlaskitSearchIcon,
	statuspage: AtlaskitStatuspageIcon,
	studio: AtlaskitStudioIcon,
	talent: AtlaskitTalentIcon,
	teams: AtlaskitTeamsIcon,
	trello: AtlaskitTrelloIcon,
};

export const LOGO_LOCKUP_COMPONENTS: Record<AtlassianLogoName, ComponentType<AtlassianLogoComponentProps>> = {
	admin: AtlaskitAdminLogo,
	align: AtlaskitAlignLogo,
	analytics: AtlaskitAnalyticsLogo,
	assets: AtlaskitAssetsLogo,
	atlassian: AtlaskitAtlassianLogo,
	"atlassian-administration": AtlaskitAtlassianAdministrationLogo,
	"atlassian-analytics": AtlaskitAtlassianAnalyticsLogo,
	bamboo: AtlaskitBambooLogo,
	bitbucket: AtlaskitBitbucketLogo,
	"bitbucket-data-center": AtlaskitBitbucketDataCenterLogo,
	chat: AtlaskitChatLogo,
	compass: AtlaskitCompassLogo,
	confluence: AtlaskitConfluenceLogo,
	"confluence-data-center": AtlaskitConfluenceDataCenterLogo,
	crowd: AtlaskitCrowdLogo,
	"customer-service-management": AtlaskitCustomerServiceManagementLogo,
	// Dx ships an icon glyph only — no wordmark lockup exists, so reuse the icon.
	dx: AtlaskitDxIcon,
	feedback: AtlaskitFeedbackLogo,
	focus: AtlaskitFocusLogo,
	goals: AtlaskitGoalsLogo,
	guard: AtlaskitGuardLogo,
	home: AtlaskitHomeLogo,
	hub: AtlaskitHubLogo,
	jira: AtlaskitJiraLogo,
	"jira-align": AtlaskitJiraAlignLogo,
	"jira-data-center": AtlaskitJiraDataCenterLogo,
	"jira-product-discovery": AtlaskitJiraProductDiscoveryLogo,
	"jira-service-management": AtlaskitJiraServiceManagementLogo,
	"jira-service-management-data-center": AtlaskitJiraServiceManagementDataCenterLogo,
	loom: AtlaskitLoomLogo,
	"loom-attribution": AtlaskitLoomAttributionLogo,
	opsgenie: AtlaskitOpsgenieLogo,
	projects: AtlaskitProjectsLogo,
	rovo: AtlaskitRovoLogo,
	"rovo-dev": AtlaskitRovoDevLogo,
	"rovo-dev-agent": AtlaskitRovoDevAgentLogo,
	search: AtlaskitSearchLogo,
	statuspage: AtlaskitStatuspageLogo,
	studio: AtlaskitStudioLogo,
	talent: AtlaskitTalentLogo,
	teams: AtlaskitTeamsLogo,
	trello: AtlaskitTrelloLogo,
};

export const CUSTOM_LOGO_SIZES: Record<string, number> = {
	xxsmall: 16,
	xsmall: 20,
	small: 24,
	medium: 32,
	large: 40,
	xlarge: 48,
};
