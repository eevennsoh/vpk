import dynamic from "next/dynamic";
import type { ComponentType } from "react";

export const UI_CUSTOM_FOUNDATION_VARIANT_DEMOS: Record<string, ComponentType> = {

	"animated-icon-demo-rainbow": dynamic(
		() => import("../../demos/ui-custom/animated-icon-demo").then((mod) => ({ default: mod.AnimatedIconDemoRainbow })),
		{ ssr: false },
	),
	"plan-demo-summary-and-tasks": dynamic(
		() =>
			import("../../demos/ui-custom/plan-demo").then((mod) => ({
				default: mod.PlanDemoSummaryAndTasks,
			})),
		{ ssr: false },
	),
	"plan-demo-tasks-only": dynamic(
		() =>
			import("../../demos/ui-custom/plan-demo").then((mod) => ({
				default: mod.PlanDemoTasksOnly,
			})),
		{ ssr: false },
	),
	"plan-demo-inline": dynamic(
		() =>
			import("../../demos/ui-custom/plan-demo").then((mod) => ({
				default: mod.PlanDemoInline,
			})),
		{ ssr: false },
	),

	// Migrated UI custom components
	"footer-demo-default": dynamic(
		() => import("../../demos/ui-custom/footer-demo").then((mod) => ({ default: mod.FooterDemoDefault })),
		{ ssr: false },
	),
	"footer-demo-custom-text": dynamic(
		() => import("../../demos/ui-custom/footer-demo").then((mod) => ({ default: mod.FooterDemoCustomText })),
		{ ssr: false },
	),
	"footer-demo-no-icon": dynamic(
		() => import("../../demos/ui-custom/footer-demo").then((mod) => ({ default: mod.FooterDemoNoIcon })),
		{ ssr: false },
	),
	"footer-demo-keyboard-hints": dynamic(
		() => import("../../demos/ui-custom/footer-demo").then((mod) => ({ default: mod.FooterDemoKeyboardHints })),
		{ ssr: false },
	),
	"hover-reveal-row-demo-toggle-and-action": dynamic(
		() => import("../../demos/ui-custom/hover-reveal-row-demo").then((mod) => ({ default: mod.HoverRevealRowDemoToggleAndAction })),
		{ ssr: false },
	),
	"hover-reveal-row-demo-toggle-only": dynamic(
		() => import("../../demos/ui-custom/hover-reveal-row-demo").then((mod) => ({ default: mod.HoverRevealRowDemoToggleOnly })),
		{ ssr: false },
	),
	"hover-reveal-row-demo-parked": dynamic(
		() => import("../../demos/ui-custom/hover-reveal-row-demo").then((mod) => ({ default: mod.HoverRevealRowDemoParked })),
		{ ssr: false },
	),
	"progress-circle-demo-default": dynamic(
		() => import("../../demos/ui-custom/progress-circle-demo").then((mod) => ({ default: mod.ProgressCircleDemoDefault })),
		{ ssr: false },
	),
	"progress-circle-demo-indeterminate": dynamic(
		() => import("../../demos/ui-custom/progress-circle-demo").then((mod) => ({ default: mod.ProgressCircleDemoIndeterminate })),
		{ ssr: false },
	),
	"progress-circle-demo-values": dynamic(
		() => import("../../demos/ui-custom/progress-circle-demo").then((mod) => ({ default: mod.ProgressCircleDemoValues })),
		{ ssr: false },
	),
	"progress-circle-demo-complete": dynamic(
		() => import("../../demos/ui-custom/progress-circle-demo").then((mod) => ({ default: mod.ProgressCircleDemoComplete })),
		{ ssr: false },
	),
	"progress-circle-demo-sizes": dynamic(
		() => import("../../demos/ui-custom/progress-circle-demo").then((mod) => ({ default: mod.ProgressCircleDemoSizes })),
		{ ssr: false },
	),
	"progress-circle-demo-controlled": dynamic(
		() => import("../../demos/ui-custom/progress-circle-demo").then((mod) => ({ default: mod.ProgressCircleDemoControlled })),
		{ ssr: false },
	),
	"progress-circle-demo-filled": dynamic(
		() => import("../../demos/ui-custom/progress-circle-demo").then((mod) => ({ default: mod.ProgressCircleDemoFilled })),
		{ ssr: false },
	),
	"progress-circle-demo-filled-controlled": dynamic(
		() => import("../../demos/ui-custom/progress-circle-demo").then((mod) => ({ default: mod.ProgressCircleDemoFilledControlled })),
		{ ssr: false },
	),
	"progress-circle-demo-status": dynamic(
		() => import("../../demos/ui-custom/progress-circle-demo").then((mod) => ({ default: mod.ProgressCircleDemoStatus })),
		{ ssr: false },
	),
	"progress-circle-demo-segmented": dynamic(
		() =>
			import("../../demos/ui-custom/progress-circle-demo").then((mod) => ({
				default: mod.ProgressCircleDemoSegmented,
			})),
		{ ssr: false },
	),
	"progress-rovo-demo-default": dynamic(() => import("../../demos/ui-custom/progress-rovo/progress-rovo-demo-default"), { ssr: false }),
	"progress-rovo-demo-completed": dynamic(() => import("../../demos/ui-custom/progress-rovo/progress-rovo-demo-completed"), { ssr: false }),
	"progress-rovo-demo-determinate": dynamic(() => import("../../demos/ui-custom/progress-rovo/progress-rovo-demo-determinate"), { ssr: false }),
	"progress-rovo-demo-controlled": dynamic(
		() => import("../../demos/ui-custom/progress-rovo-demo").then((mod) => ({ default: mod.ProgressRovoDemoControlled })),
		{ ssr: false },
	),
	"progress-rovo-demo-transition": dynamic(
		() => import("../../demos/ui-custom/progress-rovo-demo").then((mod) => ({ default: mod.ProgressRovoDemoTransition })),
		{ ssr: false },
	),
	"sidebar-nav-item-demo-default": dynamic(
		() => import("../../demos/ui-custom/sidebar-nav-item-demo").then((mod) => ({ default: mod.SidebarNavItemDemoDefault })),
		{ ssr: false },
	),
	"sidebar-nav-item-demo-tile-leading": dynamic(
		() => import("../../demos/ui-custom/sidebar-nav-item-demo").then((mod) => ({ default: mod.SidebarNavItemDemoTileLeading })),
		{ ssr: false },
	),
	"sidebar-nav-item-demo-expanded": dynamic(
		() => import("../../demos/ui-custom/sidebar-nav-item-demo").then((mod) => ({ default: mod.SidebarNavItemDemoExpanded })),
		{ ssr: false },
	),
	"sidebar-nav-item-demo-hovered": dynamic(
		() => import("../../demos/ui-custom/sidebar-nav-item-demo").then((mod) => ({ default: mod.SidebarNavItemDemoHovered })),
		{ ssr: false },
	),
	"sidebar-nav-item-demo-selected": dynamic(
		() => import("../../demos/ui-custom/sidebar-nav-item-demo").then((mod) => ({ default: mod.SidebarNavItemDemoSelected })),
		{ ssr: false },
	),
	"sidebar-nav-item-demo-focus-visible": dynamic(
		() => import("../../demos/ui-custom/sidebar-nav-item-demo").then((mod) => ({ default: mod.SidebarNavItemDemoFocusVisible })),
		{ ssr: false },
	),
	"sidebar-nav-item-demo-with-count": dynamic(
		() => import("../../demos/ui-custom/sidebar-nav-item-demo").then((mod) => ({ default: mod.SidebarNavItemDemoWithCount })),
		{ ssr: false },
	),
	"sidebar-nav-item-demo-project-count": dynamic(
		() => import("../../demos/ui-custom/sidebar-nav-item-demo").then((mod) => ({ default: mod.SidebarNavItemDemoProjectCount })),
		{ ssr: false },
	),
	"sidebar-nav-item-demo-with-description": dynamic(
		() => import("../../demos/ui-custom/sidebar-nav-item-demo").then((mod) => ({ default: mod.SidebarNavItemDemoWithDescription })),
		{ ssr: false },
	),
	"sidebar-nav-item-demo-nested-levels": dynamic(
		() => import("../../demos/ui-custom/sidebar-nav-item-demo").then((mod) => ({ default: mod.SidebarNavItemDemoNestedLevels })),
		{ ssr: false },
	),
	"object-tile-demo-default": dynamic(
		() => import("../../demos/ui-custom/object-tile-demo").then((mod) => ({ default: mod.ObjectTileDemoDefault })),
		{ ssr: false },
	),
	"object-tile-demo-description": dynamic(
		() => import("../../demos/ui-custom/object-tile-demo").then((mod) => ({ default: mod.ObjectTileDemoDescription })),
		{ ssr: false },
	),
	"object-tile-demo-meta": dynamic(
		() => import("../../demos/ui-custom/object-tile-demo").then((mod) => ({ default: mod.ObjectTileDemoMeta })),
		{ ssr: false },
	),
	"object-tile-demo-link": dynamic(
		() => import("../../demos/ui-custom/object-tile-demo").then((mod) => ({ default: mod.ObjectTileDemoLink })),
		{ ssr: false },
	),
	"object-tile-demo-list": dynamic(
		() => import("../../demos/ui-custom/object-tile-demo").then((mod) => ({ default: mod.ObjectTileDemoList })),
		{ ssr: false },
	),
	"object-tile-demo-with-avatar": dynamic(
		() => import("../../demos/ui-custom/object-tile-demo").then((mod) => ({ default: mod.ObjectTileDemoWithAvatar })),
		{ ssr: false },
	),
	"entity-card-demo-default": dynamic(
		() => import("../../demos/ui-custom/entity-card-demo"),
		{ ssr: false },
	),
	"entity-card-demo-add-remove": dynamic(
		() => import("../../demos/ui-custom/entity-card-demo").then((mod) => ({ default: mod.EntityCardDemoAddRemove })),
		{ ssr: false },
	),
	"entity-card-demo-skills": dynamic(
		() => import("../../demos/ui-custom/entity-card-demo").then((mod) => ({ default: mod.EntityCardDemoSkills })),
		{ ssr: false },
	),
	"entity-card-demo-apps": dynamic(
		() => import("../../demos/ui-custom/entity-card-demo").then((mod) => ({ default: mod.EntityCardDemoApps })),
		{ ssr: false },
	),
	"entity-card-demo-tools": dynamic(
		() => import("../../demos/ui-custom/entity-card-demo").then((mod) => ({ default: mod.EntityCardDemoTools })),
		{ ssr: false },
	),
	"entity-card-demo-agents": dynamic(
		() => import("../../demos/ui-custom/entity-card-demo").then((mod) => ({ default: mod.EntityCardDemoAgents })),
		{ ssr: false },
	),
	"entity-card-demo-knowledge": dynamic(
		() => import("../../demos/ui-custom/entity-card-demo").then((mod) => ({ default: mod.EntityCardDemoKnowledge })),
		{ ssr: false },
	),
	"skill-tag-demo-default": dynamic(
		() => import("../../demos/ui-custom/skill-tag-demo").then((mod) => ({ default: mod.SkillTagDemoDefault })),
		{ ssr: false },
	),
	"skill-tag-demo-colors": dynamic(
		() => import("../../demos/ui-custom/skill-tag-demo").then((mod) => ({ default: mod.SkillTagDemoColors })),
		{ ssr: false },
	),
	"skill-tag-demo-with-icon": dynamic(
		() => import("../../demos/ui-custom/skill-tag-demo").then((mod) => ({ default: mod.SkillTagDemoWithIcon })),
		{ ssr: false },
	),
	"skill-tag-demo-interactive": dynamic(
		() => import("../../demos/ui-custom/skill-tag-demo").then((mod) => ({ default: mod.SkillTagDemoInteractive })),
		{ ssr: false },
	),
	"skill-tag-demo-removable": dynamic(
		() => import("../../demos/ui-custom/skill-tag-demo").then((mod) => ({ default: mod.SkillTagDemoRemovable })),
		{ ssr: false },
	),
	"skill-tag-demo-group": dynamic(
		() => import("../../demos/ui-custom/skill-tag-demo").then((mod) => ({ default: mod.SkillTagDemoGroup })),
		{ ssr: false },
	),
	"skill-tag-demo-inline": dynamic(
		() => import("../../demos/ui-custom/skill-tag-demo").then((mod) => ({ default: mod.SkillTagDemoInline })),
		{ ssr: false },
	),
	"skill-tag-demo-count": dynamic(
		() => import("../../demos/ui-custom/skill-tag-demo").then((mod) => ({ default: mod.SkillTagDemoCount })),
		{ ssr: false },
	),
	"skill-tag-demo-overflow": dynamic(
		() => import("../../demos/ui-custom/skill-tag-demo").then((mod) => ({ default: mod.SkillTagDemoOverflow })),
		{ ssr: false },
	),
};
