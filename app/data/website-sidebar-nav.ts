import type { NavItem, NavSection } from "@/components/website/website-sidebar-nav";
import { ART_COMPONENTS, UI_CHART_COMPONENTS, CUSTOM_COMPONENTS, UI_COMPONENTS, BLOCK_COMPONENTS, PROJECT_COMPONENTS, UTILITY_COMPONENTS, VISUAL_COMPONENTS } from "@/app/data/component-manifest";
import { buildNavItems, UI_GROUPS, BLOCK_GROUPS, VISUAL_GROUPS } from "@/app/data/nav-utils";

export const WEBSITE_STATIC_PAGES: NavItem[] = [];

export const WEBSITE_NAV_SECTIONS: NavSection[] = [
	{
		title: "Projects",
		href: "/projects",
		defaultOpen: false,
		items: PROJECT_COMPONENTS.map((component) => ({
			name: component.name,
			href: `/components/projects/${component.slug}`,
		})),
	},
	{
		title: "Arts",
		href: "/arts",
		defaultOpen: false,
		items: ART_COMPONENTS.map((component) => ({
			name: component.name,
			href: `/components/arts/${component.slug}`,
		})),
	},
	{
		title: "UI",
		href: "/ui",
		defaultOpen: false,
		items: buildNavItems(UI_COMPONENTS, "/components/ui/", UI_GROUPS),
	},
	{
		title: "UI — Charts",
		href: "/ui-charts",
		defaultOpen: false,
		items: UI_CHART_COMPONENTS.map((component) => ({
			name: component.name,
			href: `/components/ui-charts/${component.slug}`,
		})),
	},
	{
		title: "UI — Custom",
		href: "/ui-custom",
		defaultOpen: false,
		items: CUSTOM_COMPONENTS.map((component) => ({
			name: component.name,
			href: `/components/ui-custom/${component.slug}`,
		})),
	},
	{
		title: "Blocks",
		href: "/blocks",
		defaultOpen: false,
		items: buildNavItems(BLOCK_COMPONENTS, "/components/blocks/", BLOCK_GROUPS),
	},
	{
		title: "Utils",
		href: "/utility",
		defaultOpen: false,
		items: UTILITY_COMPONENTS.map((component) => ({
			name: component.name,
			href: `/components/utility/${component.slug}`,
		})),
	},
	{
		title: "Visual",
		href: "/visual",
		defaultOpen: false,
		items: buildNavItems(VISUAL_COMPONENTS, "/components/visual/", VISUAL_GROUPS),
	},
];
