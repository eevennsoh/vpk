import dynamic from "next/dynamic";
import type { ComponentType } from "react";

export const UI_NAVIGATION_VARIANT_DEMOS: Record<string, ComponentType> = {
	// Navigation Menu
	"navigation-menu-demo-default": dynamic(
		() =>
			import("../../demos/ui/navigation-menu-demo").then((mod) => ({
				default: mod.NavigationMenuDemoDefault,
			})),
		{ ssr: false },
	),
	"navigation-menu-demo-with-trigger": dynamic(
		() =>
			import("../../demos/ui/navigation-menu-demo").then((mod) => ({
				default: mod.NavigationMenuDemoWithTrigger,
			})),
		{ ssr: false },
	),
	"navigation-menu-demo-basic": dynamic(
		() =>
			import("../../demos/ui/navigation-menu-demo").then((mod) => ({
				default: mod.NavigationMenuDemoBasic,
			})),
		{ ssr: false },
	),
	// Progress
	"progress-demo-default": dynamic(
		() => import("../../demos/ui/progress/progress-demo-default"),
		{ ssr: false },
	),
	"progress-demo-variants": dynamic(
		() => import("../../demos/ui/progress/progress-demo-variants"),
		{ ssr: false },
	),
	"progress-demo-success": dynamic(
		() => import("../../demos/ui/progress/progress-demo-success"),
		{ ssr: false },
	),
	"progress-demo-transparent": dynamic(
		() => import("../../demos/ui/progress/progress-demo-transparent"),
		{ ssr: false },
	),
	"progress-demo-indeterminate": dynamic(
		() => import("../../demos/ui/progress/progress-demo-indeterminate"),
		{ ssr: false },
	),
	"progress-demo-with-label": dynamic(
		() => import("../../demos/ui/progress/progress-demo-with-label"),
		{ ssr: false },
	),
	"progress-demo-controlled": dynamic(
		() =>
			import("../../demos/ui/progress-demo").then((mod) => ({
				default: mod.ProgressDemoControlled,
			})),
		{ ssr: false },
	),
	"progress-demo-file-upload-list": dynamic(
		() =>
			import("../../demos/ui/progress-demo").then((mod) => ({
				default: mod.ProgressDemoFileUploadList,
			})),
		{ ssr: false },
	),
	"progress-demo-zero": dynamic(
		() =>
			import("../../demos/ui/progress-demo").then((mod) => ({
				default: mod.ProgressDemoZero,
			})),
		{ ssr: false },
	),
	// Spinner
	"spinner-demo-default": dynamic(
		() =>
			import("../../demos/ui/spinner-demo").then((mod) => ({
				default: mod.SpinnerDemoDefault,
			})),
		{ ssr: false },
	),
	"spinner-demo-sizes": dynamic(
		() =>
			import("../../demos/ui/spinner-demo").then((mod) => ({
				default: mod.SpinnerDemoSizes,
			})),
		{ ssr: false },
	),
	"spinner-demo-rainbow": dynamic(
		() =>
			import("../../demos/ui/spinner-demo").then((mod) => ({
				default: mod.SpinnerDemoRainbow,
			})),
		{ ssr: false },
	),
	"spinner-demo-experimental": dynamic(
		() =>
			import("../../demos/ui/spinner-demo").then((mod) => ({
				default: mod.SpinnerDemoExperimental,
			})),
		{ ssr: false },
	),
	"spinner-demo-basic": dynamic(
		() =>
			import("../../demos/ui/spinner-demo").then((mod) => ({
				default: mod.SpinnerDemoBasic,
			})),
		{ ssr: false },
	),
	"spinner-demo-in-badges": dynamic(
		() =>
			import("../../demos/ui/spinner-demo").then((mod) => ({
				default: mod.SpinnerDemoInBadges,
			})),
		{ ssr: false },
	),
	"spinner-demo-in-buttons": dynamic(
		() =>
			import("../../demos/ui/spinner-demo").then((mod) => ({
				default: mod.SpinnerDemoInButtons,
			})),
		{ ssr: false },
	),
	"spinner-demo-in-empty-state": dynamic(
		() =>
			import("../../demos/ui/spinner-demo").then((mod) => ({
				default: mod.SpinnerDemoInEmptyState,
			})),
		{ ssr: false },
	),
	"spinner-demo-in-input-group": dynamic(
		() =>
			import("../../demos/ui/spinner-demo").then((mod) => ({
				default: mod.SpinnerDemoInInputGroup,
			})),
		{ ssr: false },
	),
	// Avatar
	"avatar-demo-default": dynamic(
		() =>
			import("../../demos/ui/avatar-demo").then((mod) => ({
				default: mod.AvatarDemoDefault,
			})),
		{ ssr: false },
	),
	"avatar-demo-sizes": dynamic(
		() =>
			import("../../demos/ui/avatar-demo").then((mod) => ({
				default: mod.AvatarDemoSizes,
			})),
		{ ssr: false },
	),
	"avatar-demo-unassigned": dynamic(
		() =>
			import("../../demos/ui/avatar-demo").then((mod) => ({
				default: mod.AvatarDemoUnassigned,
			})),
		{ ssr: false },
	),
	"avatar-demo-group": dynamic(
		() =>
			import("../../demos/ui/avatar-demo").then((mod) => ({
				default: mod.AvatarDemoGroup,
			})),
		{ ssr: false },
	),
	"avatar-demo-badge-with-icon": dynamic(
		() =>
			import("../../demos/ui/avatar-demo").then((mod) => ({
				default: mod.AvatarDemoBadgeWithIcon,
			})),
		{ ssr: false },
	),
	"avatar-demo-badge": dynamic(
		() =>
			import("../../demos/ui/avatar-demo").then((mod) => ({
				default: mod.AvatarDemoBadge,
			})),
		{ ssr: false },
	),
	"avatar-demo-group-with-count": dynamic(
		() =>
			import("../../demos/ui/avatar-demo").then((mod) => ({
				default: mod.AvatarDemoGroupWithCount,
			})),
		{ ssr: false },
	),
	"avatar-demo-group-with-icon-count": dynamic(
		() =>
			import("../../demos/ui/avatar-demo").then((mod) => ({
				default: mod.AvatarDemoGroupWithIconCount,
			})),
		{ ssr: false },
	),
	"avatar-demo-in-empty": dynamic(
		() =>
			import("../../demos/ui/avatar-demo").then((mod) => ({
				default: mod.AvatarDemoInEmpty,
			})),
		{ ssr: false },
	),
	"avatar-demo-shapes": dynamic(
		() =>
			import("../../demos/ui/avatar-demo").then((mod) => ({
				default: mod.AvatarDemoShapes,
			})),
		{ ssr: false },
	),
	"avatar-demo-agent-tiers": dynamic(
		() =>
			import("../../demos/ui/avatar-demo").then((mod) => ({
				default: mod.AvatarDemoAgentTiers,
			})),
		{ ssr: false },
	),
	"avatar-demo-agent-group": dynamic(
		() =>
			import("../../demos/ui/avatar-demo").then((mod) => ({
				default: mod.AvatarDemoAgentGroup,
			})),
		{ ssr: false },
	),
	"avatar-demo-coding-agents": dynamic(
		() =>
			import("../../demos/ui/avatar-demo").then((mod) => ({
				default: mod.AvatarDemoCodingAgents,
			})),
		{ ssr: false },
	),
	"avatar-demo-all-sizes": dynamic(
		() =>
			import("../../demos/ui/avatar-demo").then((mod) => ({
				default: mod.AvatarDemoAllSizes,
			})),
		{ ssr: false },
	),
	"avatar-demo-presence": dynamic(
		() =>
			import("../../demos/ui/avatar-demo").then((mod) => ({
				default: mod.AvatarDemoPresence,
			})),
		{ ssr: false },
	),
	"avatar-demo-status": dynamic(
		() =>
			import("../../demos/ui/avatar-demo").then((mod) => ({
				default: mod.AvatarDemoStatus,
			})),
		{ ssr: false },
	),
	"avatar-demo-disabled": dynamic(
		() =>
			import("../../demos/ui/avatar-demo").then((mod) => ({
				default: mod.AvatarDemoDisabled,
			})),
		{ ssr: false },
	),
	"avatar-demo-company": dynamic(
		() =>
			import("../../demos/ui/avatar-demo").then((mod) => ({
				default: mod.AvatarDemoCompany,
			})),
		{ ssr: false },
	),
	"avatar-demo-project": dynamic(
		() =>
			import("../../demos/ui/avatar-demo").then((mod) => ({
				default: mod.AvatarDemoProject,
			})),
		{ ssr: false },
	),
	// Card
	"card-demo-default": dynamic(
		() =>
			import("../../demos/ui/card-demo").then((mod) => ({
				default: mod.CardDemoDefault,
			})),
		{ ssr: false },
	),
	"card-demo-small": dynamic(
		() =>
			import("../../demos/ui/card-demo").then((mod) => ({
				default: mod.CardDemoSmall,
			})),
		{ ssr: false },
	),
	"card-demo-with-action": dynamic(
		() =>
			import("../../demos/ui/card-demo").then((mod) => ({
				default: mod.CardDemoWithAction,
			})),
		{ ssr: false },
	),
	"card-demo-simple": dynamic(
		() =>
			import("../../demos/ui/card-demo").then((mod) => ({
				default: mod.CardDemoSimple,
			})),
		{ ssr: false },
	),
	"card-demo-default-size": dynamic(
		() =>
			import("../../demos/ui/card-demo").then((mod) => ({
				default: mod.CardDemoDefaultSize,
			})),
		{ ssr: false },
	),
	"card-demo-footer-with-border-small": dynamic(
		() =>
			import("../../demos/ui/card-demo").then((mod) => ({
				default: mod.CardDemoFooterWithBorderSmall,
			})),
		{ ssr: false },
	),
	"card-demo-footer-with-border": dynamic(
		() =>
			import("../../demos/ui/card-demo").then((mod) => ({
				default: mod.CardDemoFooterWithBorder,
			})),
		{ ssr: false },
	),
	"card-demo-header-with-border-small": dynamic(
		() =>
			import("../../demos/ui/card-demo").then((mod) => ({
				default: mod.CardDemoHeaderWithBorderSmall,
			})),
		{ ssr: false },
	),
	"card-demo-header-with-border": dynamic(
		() =>
			import("../../demos/ui/card-demo").then((mod) => ({
				default: mod.CardDemoHeaderWithBorder,
			})),
		{ ssr: false },
	),
	"card-demo-login": dynamic(
		() =>
			import("../../demos/ui/card-demo").then((mod) => ({
				default: mod.CardDemoLogin,
			})),
		{ ssr: false },
	),
	"card-demo-meeting-notes": dynamic(
		() =>
			import("../../demos/ui/card-demo").then((mod) => ({
				default: mod.CardDemoMeetingNotes,
			})),
		{ ssr: false },
	),
	"card-demo-small-size": dynamic(
		() =>
			import("../../demos/ui/card-demo").then((mod) => ({
				default: mod.CardDemoSmallSize,
			})),
		{ ssr: false },
	),
	"card-demo-with-image-small": dynamic(
		() =>
			import("../../demos/ui/card-demo").then((mod) => ({
				default: mod.CardDemoWithImageSmall,
			})),
		{ ssr: false },
	),
	"card-demo-with-image": dynamic(
		() =>
			import("../../demos/ui/card-demo").then((mod) => ({
				default: mod.CardDemoWithImage,
			})),
		{ ssr: false },
	),
	// Panel
	"panel-demo-default": dynamic(
		() =>
			import("../../demos/ui/panel-demo").then((mod) => ({
				default: mod.PanelDemoDefault,
			})),
		{ ssr: false },
	),
	"panel-demo-basic": dynamic(
		() =>
			import("../../demos/ui/panel-demo").then((mod) => ({
				default: mod.PanelDemoBasic,
			})),
		{ ssr: false },
	),
	"panel-demo-header": dynamic(
		() =>
			import("../../demos/ui/panel-demo").then((mod) => ({
				default: mod.PanelDemoHeader,
			})),
		{ ssr: false },
	),
	"panel-demo-with-subheader": dynamic(
		() =>
			import("../../demos/ui/panel-demo").then((mod) => ({
				default: mod.PanelDemoWithSubheader,
			})),
		{ ssr: false },
	),
	"panel-demo-inline-edit": dynamic(
		() =>
			import("../../demos/ui/panel-demo").then((mod) => ({
				default: mod.PanelDemoInlineEdit,
			})),
		{ ssr: false },
	),
	"panel-demo-with-footer": dynamic(
		() =>
			import("../../demos/ui/panel-demo").then((mod) => ({
				default: mod.PanelDemoWithFooter,
			})),
		{ ssr: false },
	),
	"panel-demo-loading": dynamic(
		() =>
			import("../../demos/ui/panel-demo").then((mod) => ({
				default: mod.PanelDemoLoading,
			})),
		{ ssr: false },
	),
	"panel-demo-unsaved-changes": dynamic(
		() =>
			import("../../demos/ui/panel-demo").then((mod) => ({
				default: mod.PanelDemoUnsavedChanges,
			})),
		{ ssr: false },
	),
	// Table
	"table-demo-default": dynamic(
		() =>
			import("../../demos/ui/table-demo").then((mod) => ({
				default: mod.TableDemoDefault,
			})),
		{ ssr: false },
	),
	"table-demo-with-caption": dynamic(
		() =>
			import("../../demos/ui/table-demo").then((mod) => ({
				default: mod.TableDemoWithCaption,
			})),
		{ ssr: false },
	),
	"table-demo-with-footer": dynamic(
		() =>
			import("../../demos/ui/table-demo").then((mod) => ({
				default: mod.TableDemoWithFooter,
			})),
		{ ssr: false },
	),
	"table-demo-basic": dynamic(
		() =>
			import("../../demos/ui/table-demo").then((mod) => ({
				default: mod.TableDemoBasic,
			})),
		{ ssr: false },
	),
	"table-demo-simple": dynamic(
		() =>
			import("../../demos/ui/table-demo").then((mod) => ({
				default: mod.TableDemoSimple,
			})),
		{ ssr: false },
	),
	"table-demo-with-actions": dynamic(
		() =>
			import("../../demos/ui/table-demo").then((mod) => ({
				default: mod.TableDemoWithActions,
			})),
		{ ssr: false },
	),
	"table-demo-with-badges": dynamic(
		() =>
			import("../../demos/ui/table-demo").then((mod) => ({
				default: mod.TableDemoWithBadges,
			})),
		{ ssr: false },
	),
	"table-demo-with-input": dynamic(
		() =>
			import("../../demos/ui/table-demo").then((mod) => ({
				default: mod.TableDemoWithInput,
			})),
		{ ssr: false },
	),
	"table-demo-with-select": dynamic(
		() =>
			import("../../demos/ui/table-demo").then((mod) => ({
				default: mod.TableDemoWithSelect,
			})),
		{ ssr: false },
	),
	"table-demo-striped": dynamic(
		() =>
			import("../../demos/ui/table-demo").then((mod) => ({
				default: mod.TableDemoStriped,
			})),
		{ ssr: false },
	),
	"table-demo-row-highlight": dynamic(
		() =>
			import("../../demos/ui/table-demo").then((mod) => ({
				default: mod.TableDemoRowHighlight,
			})),
		{ ssr: false },
	),
	// Skeleton
	"skeleton-demo-default": dynamic(
		() =>
			import("../../demos/ui/skeleton-demo").then((mod) => ({
				default: mod.SkeletonDemoDefault,
			})),
		{ ssr: false },
	),
	"skeleton-demo-card": dynamic(
		() =>
			import("../../demos/ui/skeleton-demo").then((mod) => ({
				default: mod.SkeletonDemoCard,
			})),
		{ ssr: false },
	),
	"skeleton-demo-list": dynamic(
		() =>
			import("../../demos/ui/skeleton-demo").then((mod) => ({
				default: mod.SkeletonDemoList,
			})),
		{ ssr: false },
	),
	"skeleton-demo-avatar": dynamic(
		() =>
			import("../../demos/ui/skeleton-demo").then((mod) => ({
				default: mod.SkeletonDemoAvatar,
			})),
		{ ssr: false },
	),
	"skeleton-demo-form": dynamic(
		() =>
			import("../../demos/ui/skeleton-demo").then((mod) => ({
				default: mod.SkeletonDemoForm,
			})),
		{ ssr: false },
	),
	"skeleton-demo-table": dynamic(
		() =>
			import("../../demos/ui/skeleton-demo").then((mod) => ({
				default: mod.SkeletonDemoTable,
			})),
		{ ssr: false },
	),
	"skeleton-demo-text": dynamic(
		() =>
			import("../../demos/ui/skeleton-demo").then((mod) => ({
				default: mod.SkeletonDemoText,
			})),
		{ ssr: false },
	),
	// Empty
	"empty-demo-default": dynamic(
		() =>
			import("../../demos/ui/empty-demo").then((mod) => ({
				default: mod.EmptyDemoDefault,
			})),
		{ ssr: false },
	),
	"empty-demo-with-action": dynamic(
		() =>
			import("../../demos/ui/empty-demo").then((mod) => ({
				default: mod.EmptyDemoWithAction,
			})),
		{ ssr: false },
	),
	"empty-demo-with-actions": dynamic(
		() =>
			import("../../demos/ui/empty-demo").then((mod) => ({
				default: mod.EmptyDemoWithActions,
			})),
		{ ssr: false },
	),
	"empty-demo-with-image": dynamic(
		() =>
			import("../../demos/ui/empty-demo").then((mod) => ({
				default: mod.EmptyDemoWithImage,
			})),
		{ ssr: false },
	),
	"empty-demo-with-icon": dynamic(
		() =>
			import("../../demos/ui/empty-demo").then((mod) => ({
				default: mod.EmptyDemoWithIcon,
			})),
		{ ssr: false },
	),
	"empty-demo-narrow": dynamic(
		() =>
			import("../../demos/ui/empty-demo").then((mod) => ({
				default: mod.EmptyDemoNarrow,
			})),
		{ ssr: false },
	),
	"empty-demo-compact": dynamic(
		() =>
			import("../../demos/ui/empty-demo").then((mod) => ({
				default: mod.EmptyDemoCompact,
			})),
		{ ssr: false },
	),
	"empty-demo-with-tertiary": dynamic(
		() =>
			import("../../demos/ui/empty-demo").then((mod) => ({
				default: mod.EmptyDemoWithTertiary,
			})),
		{ ssr: false },
	),
	"empty-demo-with-image-horizontal": dynamic(
		() =>
			import("../../demos/ui/empty-demo").then((mod) => ({
				default: mod.EmptyDemoWithImageHorizontal,
			})),
		{ ssr: false },
	),
	// Kbd
	"kbd-demo-default": dynamic(
		() =>
			import("../../demos/ui/kbd-demo").then((mod) => ({
				default: mod.KbdDemoDefault,
			})),
		{ ssr: false },
	),
	"kbd-demo-group": dynamic(
		() =>
			import("../../demos/ui/kbd-demo").then((mod) => ({
				default: mod.KbdDemoGroup,
			})),
		{ ssr: false },
	),
	"kbd-demo-arrow-keys": dynamic(
		() =>
			import("../../demos/ui/kbd-demo").then((mod) => ({
				default: mod.KbdDemoArrowKeys,
			})),
		{ ssr: false },
	),
	"kbd-demo-basic": dynamic(
		() =>
			import("../../demos/ui/kbd-demo").then((mod) => ({
				default: mod.KbdDemoBasic,
			})),
		{ ssr: false },
	),
	"kbd-demo-input-group": dynamic(
		() =>
			import("../../demos/ui/kbd-demo").then((mod) => ({
				default: mod.KbdDemoInputGroup,
			})),
		{ ssr: false },
	),
	"kbd-demo-kbd-group": dynamic(
		() =>
			import("../../demos/ui/kbd-demo").then((mod) => ({
				default: mod.KbdDemoKbdGroup,
			})),
		{ ssr: false },
	),
	"kbd-demo-modifier-keys": dynamic(
		() =>
			import("../../demos/ui/kbd-demo").then((mod) => ({
				default: mod.KbdDemoModifierKeys,
			})),
		{ ssr: false },
	),
	"kbd-demo-tooltip": dynamic(
		() =>
			import("../../demos/ui/kbd-demo").then((mod) => ({
				default: mod.KbdDemoTooltip,
			})),
		{ ssr: false },
	),
	"kbd-demo-with-icons-and-text": dynamic(
		() =>
			import("../../demos/ui/kbd-demo").then((mod) => ({
				default: mod.KbdDemoWithIconsAndText,
			})),
		{ ssr: false },
	),
	"kbd-demo-with-icons": dynamic(
		() =>
			import("../../demos/ui/kbd-demo").then((mod) => ({
				default: mod.KbdDemoWithIcons,
			})),
		{ ssr: false },
	),
	"kbd-demo-with-samp": dynamic(
		() =>
			import("../../demos/ui/kbd-demo").then((mod) => ({
				default: mod.KbdDemoWithSamp,
			})),
		{ ssr: false },
	),
	// Item
	"item-demo-default": dynamic(
		() =>
			import("../../demos/ui/item-demo").then((mod) => ({
				default: mod.ItemDemoDefault,
			})),
		{ ssr: false },
	),
	"item-demo-with-description": dynamic(
		() =>
			import("../../demos/ui/item-demo").then((mod) => ({
				default: mod.ItemDemoWithDescription,
			})),
		{ ssr: false },
	),
	"item-demo-with-media": dynamic(
		() =>
			import("../../demos/ui/item-demo").then((mod) => ({
				default: mod.ItemDemoWithMedia,
			})),
		{ ssr: false },
	),
	"item-demo-as-child": dynamic(
		() =>
			import("../../demos/ui/item-demo").then((mod) => ({
				default: mod.ItemDemoAsChild,
			})),
		{ ssr: false },
	),
	"item-demo-default-item-media-image": dynamic(
		() =>
			import("../../demos/ui/item-demo").then((mod) => ({
				default: mod.ItemDemoDefaultItemMediaImage,
			})),
		{ ssr: false },
	),
	"item-demo-extra-small": dynamic(
		() =>
			import("../../demos/ui/item-demo").then((mod) => ({
				default: mod.ItemDemoExtraSmall,
			})),
		{ ssr: false },
	),
	"item-demo-item-footer": dynamic(
		() =>
			import("../../demos/ui/item-demo").then((mod) => ({
				default: mod.ItemDemoItemFooter,
			})),
		{ ssr: false },
	),
	"item-demo-item-group": dynamic(
		() =>
			import("../../demos/ui/item-demo").then((mod) => ({
				default: mod.ItemDemoItemGroup,
			})),
		{ ssr: false },
	),
	"item-demo-item-header-item-footer": dynamic(
		() =>
			import("../../demos/ui/item-demo").then((mod) => ({
				default: mod.ItemDemoItemHeaderItemFooter,
			})),
		{ ssr: false },
	),
	"item-demo-item-header": dynamic(
		() =>
			import("../../demos/ui/item-demo").then((mod) => ({
				default: mod.ItemDemoItemHeader,
			})),
		{ ssr: false },
	),
	"item-demo-item-separator": dynamic(
		() =>
			import("../../demos/ui/item-demo").then((mod) => ({
				default: mod.ItemDemoItemSeparator,
			})),
		{ ssr: false },
	),
	"item-demo-muted-as-child": dynamic(
		() =>
			import("../../demos/ui/item-demo").then((mod) => ({
				default: mod.ItemDemoMutedAsChild,
			})),
		{ ssr: false },
	),
	"item-demo-muted-extra-small": dynamic(
		() =>
			import("../../demos/ui/item-demo").then((mod) => ({
				default: mod.ItemDemoMutedExtraSmall,
			})),
		{ ssr: false },
	),
	"item-demo-muted-item-group": dynamic(
		() =>
			import("../../demos/ui/item-demo").then((mod) => ({
				default: mod.ItemDemoMutedItemGroup,
			})),
		{ ssr: false },
	),
	"item-demo-muted-item-media-image": dynamic(
		() =>
			import("../../demos/ui/item-demo").then((mod) => ({
				default: mod.ItemDemoMutedItemMediaImage,
			})),
		{ ssr: false },
	),
	"item-demo-muted-small": dynamic(
		() =>
			import("../../demos/ui/item-demo").then((mod) => ({
				default: mod.ItemDemoMutedSmall,
			})),
		{ ssr: false },
	),
	"item-demo-muted": dynamic(
		() =>
			import("../../demos/ui/item-demo").then((mod) => ({
				default: mod.ItemDemoMuted,
			})),
		{ ssr: false },
	),
	"item-demo-outline-as-child": dynamic(
		() =>
			import("../../demos/ui/item-demo").then((mod) => ({
				default: mod.ItemDemoOutlineAsChild,
			})),
		{ ssr: false },
	),
	"item-demo-outline-extra-small": dynamic(
		() =>
			import("../../demos/ui/item-demo").then((mod) => ({
				default: mod.ItemDemoOutlineExtraSmall,
			})),
		{ ssr: false },
	),
	"item-demo-outline-item-group": dynamic(
		() =>
			import("../../demos/ui/item-demo").then((mod) => ({
				default: mod.ItemDemoOutlineItemGroup,
			})),
		{ ssr: false },
	),
	"item-demo-outline-item-media-image-extra-small": dynamic(
		() =>
			import("../../demos/ui/item-demo").then((mod) => ({
				default: mod.ItemDemoOutlineItemMediaImageExtraSmall,
			})),
		{ ssr: false },
	),
	"item-demo-outline-item-media-image-small": dynamic(
		() =>
			import("../../demos/ui/item-demo").then((mod) => ({
				default: mod.ItemDemoOutlineItemMediaImageSmall,
			})),
		{ ssr: false },
	),
	"item-demo-outline-item-media-image": dynamic(
		() =>
			import("../../demos/ui/item-demo").then((mod) => ({
				default: mod.ItemDemoOutlineItemMediaImage,
			})),
		{ ssr: false },
	),
	"item-demo-outline-small": dynamic(
		() =>
			import("../../demos/ui/item-demo").then((mod) => ({
				default: mod.ItemDemoOutlineSmall,
			})),
		{ ssr: false },
	),
	"item-demo-outline": dynamic(
		() =>
			import("../../demos/ui/item-demo").then((mod) => ({
				default: mod.ItemDemoOutline,
			})),
		{ ssr: false },
	),
	"item-demo-small": dynamic(
		() =>
			import("../../demos/ui/item-demo").then((mod) => ({
				default: mod.ItemDemoSmall,
			})),
		{ ssr: false },
	),
};
