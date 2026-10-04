import dynamic from "next/dynamic";
import type { ComponentType } from "react";

export const UI_ATLASSIAN_VARIANT_DEMOS: Record<string, ComponentType> = {
	// Blanket
	"blanket-demo-default": dynamic(
		() =>
			import("../../demos/ui/blanket-demo").then((mod) => ({
				default: mod.BlanketDemoDefault,
			})),
		{ ssr: false },
	),
	"blanket-demo-transparent": dynamic(
		() =>
			import("../../demos/ui/blanket-demo").then((mod) => ({
				default: mod.BlanketDemoTransparent,
			})),
		{ ssr: false },
	),
	"blanket-demo-with-content": dynamic(
		() =>
			import("../../demos/ui/blanket-demo").then((mod) => ({
				default: mod.BlanketDemoWithContent,
			})),
		{ ssr: false },
	),
	// Banner
	"banner-demo-warning": dynamic(
		() =>
			import("../../demos/ui/banner-demo").then((mod) => ({
				default: mod.BannerDemoWarning,
			})),
		{ ssr: false },
	),
	"banner-demo-error": dynamic(
		() =>
			import("../../demos/ui/banner-demo").then((mod) => ({
				default: mod.BannerDemoError,
			})),
		{ ssr: false },
	),
	"banner-demo-announcement": dynamic(
		() =>
			import("../../demos/ui/banner-demo").then((mod) => ({
				default: mod.BannerDemoAnnouncement,
			})),
		{ ssr: false },
	),
	"banner-demo-variants": dynamic(
		() =>
			import("../../demos/ui/banner-demo").then((mod) => ({
				default: mod.BannerDemoVariants,
			})),
		{ ssr: false },
	),
	// Comment
	"comment-demo-default": dynamic(
		() =>
			import("../../demos/ui/comment-demo").then((mod) => ({
				default: mod.CommentDemoDefault,
			})),
		{ ssr: false },
	),
	"comment-demo-with-time": dynamic(
		() =>
			import("../../demos/ui/comment-demo").then((mod) => ({
				default: mod.CommentDemoWithTime,
			})),
		{ ssr: false },
	),
	"comment-demo-with-avatar": dynamic(
		() =>
			import("../../demos/ui/comment-demo").then((mod) => ({
				default: mod.CommentDemoWithAvatar,
			})),
		{ ssr: false },
	),
	"comment-demo-with-actions": dynamic(
		() =>
			import("../../demos/ui/comment-demo").then((mod) => ({
				default: mod.CommentDemoWithActions,
			})),
		{ ssr: false },
	),
	"comment-demo-full": dynamic(
		() =>
			import("../../demos/ui/comment-demo").then((mod) => ({
				default: mod.CommentDemoFull,
			})),
		{ ssr: false },
	),
	"comment-demo-edited": dynamic(
		() =>
			import("../../demos/ui/comment-demo").then((mod) => ({
				default: mod.CommentDemoEdited,
			})),
		{ ssr: false },
	),
	"comment-demo-highlighted": dynamic(
		() =>
			import("../../demos/ui/comment-demo").then((mod) => ({
				default: mod.CommentDemoHighlighted,
			})),
		{ ssr: false },
	),
	"comment-demo-saving": dynamic(
		() =>
			import("../../demos/ui/comment-demo").then((mod) => ({
				default: mod.CommentDemoSaving,
			})),
		{ ssr: false },
	),
	"comment-demo-thread": dynamic(
		() =>
			import("../../demos/ui/comment-demo").then((mod) => ({
				default: mod.CommentDemoThread,
			})),
		{ ssr: false },
	),
	// DatePicker
	"date-picker-demo-default": dynamic(
		() =>
			import("../../demos/ui/date-picker-demo").then((mod) => ({
				default: mod.DatePickerDemoDefault,
			})),
		{ ssr: false },
	),
	"date-picker-demo-with-value": dynamic(
		() =>
			import("../../demos/ui/date-picker-demo").then((mod) => ({
				default: mod.DatePickerDemoWithValue,
			})),
		{ ssr: false },
	),
	"date-picker-demo-placeholder": dynamic(
		() =>
			import("../../demos/ui/date-picker-demo").then((mod) => ({
				default: mod.DatePickerDemoPlaceholder,
			})),
		{ ssr: false },
	),
	"date-picker-demo-disabled": dynamic(
		() =>
			import("../../demos/ui/date-picker-demo").then((mod) => ({
				default: mod.DatePickerDemoDisabled,
			})),
		{ ssr: false },
	),
	// Forms
	"forms-demo-tanstack-basic": dynamic(
		() =>
			import("../../demos/ui/forms-demo").then((mod) => ({
				default: mod.FormDemoTanstackBasic,
			})),
		{ ssr: false },
	),
	"forms-demo-tanstack-input": dynamic(
		() =>
			import("../../demos/ui/forms-demo").then((mod) => ({
				default: mod.FormDemoTanstackInput,
			})),
		{ ssr: false },
	),
	"forms-demo-tanstack-textarea": dynamic(
		() =>
			import("../../demos/ui/forms-demo").then((mod) => ({
				default: mod.FormDemoTanstackTextarea,
			})),
		{ ssr: false },
	),
	"forms-demo-tanstack-select": dynamic(
		() =>
			import("../../demos/ui/forms-demo").then((mod) => ({
				default: mod.FormDemoTanstackSelect,
			})),
		{ ssr: false },
	),
	"forms-demo-tanstack-checkbox": dynamic(
		() =>
			import("../../demos/ui/forms-demo").then((mod) => ({
				default: mod.FormDemoTanstackCheckbox,
			})),
		{ ssr: false },
	),
	"forms-demo-tanstack-radiogroup": dynamic(
		() =>
			import("../../demos/ui/forms-demo").then((mod) => ({
				default: mod.FormDemoTanstackRadioGroup,
			})),
		{ ssr: false },
	),
	"forms-demo-tanstack-switch": dynamic(
		() =>
			import("../../demos/ui/forms-demo").then((mod) => ({
				default: mod.FormDemoTanstackSwitch,
			})),
		{ ssr: false },
	),
	"forms-demo-tanstack-complex": dynamic(
		() =>
			import("../../demos/ui/forms-demo").then((mod) => ({
				default: mod.FormDemoTanstackComplex,
			})),
		{ ssr: false },
	),
	"forms-demo-tanstack-array": dynamic(
		() =>
			import("../../demos/ui/forms-demo").then((mod) => ({
				default: mod.FormDemoTanstackArray,
			})),
		{ ssr: false },
	),
	"forms-demo-ads-basic": dynamic(
		() =>
			import("../../demos/ui/forms-demo").then((mod) => ({
				default: mod.FormDemoAdsBasicForm,
			})),
		{ ssr: false },
	),
	"forms-demo-ads-validation": dynamic(
		() =>
			import("../../demos/ui/forms-demo").then((mod) => ({
				default: mod.FormDemoAdsFieldValidation,
			})),
		{ ssr: false },
	),
	"forms-demo-ads-disabled": dynamic(
		() =>
			import("../../demos/ui/forms-demo").then((mod) => ({
				default: mod.FormDemoAdsDisabled,
			})),
		{ ssr: false },
	),
	// Icon
	"icon-demo-default": dynamic(
		() =>
			import("../../demos/ui/icon-demo").then((mod) => ({
				default: mod.IconDemoDefault,
			})),
		{ ssr: false },
	),
	"icon-demo-multiple": dynamic(
		() =>
			import("../../demos/ui/icon-demo").then((mod) => ({
				default: mod.IconDemoMultiple,
			})),
		{ ssr: false },
	),
	"icon-demo-sized": dynamic(
		() =>
			import("../../demos/ui/icon-demo").then((mod) => ({
				default: mod.IconDemoSized,
			})),
		{ ssr: false },
	),
	"icon-demo-colored": dynamic(
		() =>
			import("../../demos/ui/icon-demo").then((mod) => ({
				default: mod.IconDemoColored,
			})),
		{ ssr: false },
	),
	// Icon Tile
	"icon-tile-demo-default": dynamic(
		() =>
			import("../../demos/ui/icon-tile-demo").then((mod) => ({
				default: mod.IconTileDemoDefault,
			})),
		{ ssr: false },
	),
	"icon-tile-demo-sizes": dynamic(
		() =>
			import("../../demos/ui/icon-tile-demo").then((mod) => ({
				default: mod.IconTileDemoSizes,
			})),
		{ ssr: false },
	),
	"icon-tile-demo-transparent": dynamic(
		() =>
			import("../../demos/ui/icon-tile-demo").then((mod) => ({
				default: mod.IconTileDemoTransparent,
			})),
		{ ssr: false },
	),
	"icon-tile-demo-appearances": dynamic(
		() =>
			import("../../demos/ui/icon-tile-demo").then((mod) => ({
				default: mod.IconTileDemoAppearances,
			})),
		{ ssr: false },
	),
	"icon-tile-demo-appearances-bold": dynamic(
		() =>
			import("../../demos/ui/icon-tile-demo").then((mod) => ({
				default: mod.IconTileDemoAppearancesBold,
			})),
		{ ssr: false },
	),
	"icon-tile-demo-shapes": dynamic(
		() =>
			import("../../demos/ui/icon-tile-demo").then((mod) => ({
				default: mod.IconTileDemoShapes,
			})),
		{ ssr: false },
	),
	// Inline Edit
	"inline-edit-demo-default": dynamic(
		() =>
			import("../../demos/ui/inline-edit-demo").then((mod) => ({
				default: mod.InlineEditDemoDefault,
			})),
		{ ssr: false },
	),
	"inline-edit-demo-with-placeholder": dynamic(
		() =>
			import("../../demos/ui/inline-edit-demo").then((mod) => ({
				default: mod.InlineEditDemoWithPlaceholder,
			})),
		{ ssr: false },
	),
	"inline-edit-demo-multiple": dynamic(
		() =>
			import("../../demos/ui/inline-edit-demo").then((mod) => ({
				default: mod.InlineEditDemoMultiple,
			})),
		{ ssr: false },
	),
	"inline-edit-demo-with-cancel": dynamic(
		() =>
			import("../../demos/ui/inline-edit-demo").then((mod) => ({
				default: mod.InlineEditDemoWithCancel,
			})),
		{ ssr: false },
	),
	"inline-edit-demo-validation": dynamic(
		() =>
			import("../../demos/ui/inline-edit-demo").then((mod) => ({
				default: mod.InlineEditDemoValidation,
			})),
		{ ssr: false },
	),
	// Logo
	"logo-demo-rovo-app-icon": dynamic(
		() =>
			import("../../demos/ui/logo-demo").then((mod) => ({
				default: mod.LogoDemoRovoAppIcon,
			})),
		{ ssr: false },
	),
	"logo-demo-icons": dynamic(
		() =>
			import("../../demos/ui/logo-demo").then((mod) => ({
				default: mod.LogoDemoIcons,
			})),
		{ ssr: false },
	),
	"logo-demo-lockups": dynamic(
		() =>
			import("../../demos/ui/logo-demo").then((mod) => ({
				default: mod.LogoDemoLockups,
			})),
		{ ssr: false },
	),
	"logo-demo-sizes": dynamic(
		() =>
			import("../../demos/ui/logo-demo").then((mod) => ({
				default: mod.LogoDemoSizes,
			})),
		{ ssr: false },
	),
	"logo-demo-appearances": dynamic(
		() =>
			import("../../demos/ui/logo-demo").then((mod) => ({
				default: mod.LogoDemoAppearances,
			})),
		{ ssr: false },
	),
	"logo-demo-custom": dynamic(
		() =>
			import("../../demos/ui/logo-demo").then((mod) => ({
				default: mod.LogoDemoCustom,
			})),
		{ ssr: false },
	),
	"logo-demo-named-exports": dynamic(
		() =>
			import("../../demos/ui/logo-demo").then((mod) => ({
				default: mod.LogoDemoNamedExports,
			})),
		{ ssr: false },
	),
	"logo-demo-brand-logos": dynamic(
		() =>
			import("../../demos/ui/logo-demo").then((mod) => ({
				default: mod.LogoDemoBrandLogos,
			})),
		{ ssr: false },
	),
	"logo-demo-in-tile": dynamic(
		() =>
			import("../../demos/ui/logo-demo").then((mod) => ({
				default: mod.LogoDemoInTile,
			})),
		{ ssr: false },
	),
	"logo-demo-in-tag": dynamic(
		() =>
			import("../../demos/ui/logo-demo").then((mod) => ({
				default: mod.LogoDemoInTag,
			})),
		{ ssr: false },
	),
	// Logo Third-party
	"logo-third-party-demo-icons": dynamic(
		() =>
			import("../../demos/ui/logo-third-party-demo").then((mod) => ({
				default: mod.LogoThirdPartyDemoIcons,
			})),
		{ ssr: false },
	),
	"logo-third-party-demo-sizes": dynamic(
		() =>
			import("../../demos/ui/logo-third-party-demo").then((mod) => ({
				default: mod.LogoThirdPartyDemoSizes,
			})),
		{ ssr: false },
	),
	"logo-third-party-demo-borderless": dynamic(
		() =>
			import("../../demos/ui/logo-third-party-demo").then((mod) => ({
				default: mod.LogoThirdPartyDemoBorderless,
			})),
		{ ssr: false },
	),
	"logo-third-party-demo-tile-background": dynamic(
		() =>
			import("../../demos/ui/logo-third-party-demo").then((mod) => ({
				default: mod.LogoThirdPartyDemoTileBackground,
			})),
		{ ssr: false },
	),
	"logo-third-party-demo-lockups": dynamic(
		() =>
			import("../../demos/ui/logo-third-party-demo").then((mod) => ({
				default: mod.LogoThirdPartyDemoLockups,
			})),
		{ ssr: false },
	),
	"logo-third-party-demo-in-tile": dynamic(
		() =>
			import("../../demos/ui/logo-third-party-demo").then((mod) => ({
				default: mod.LogoThirdPartyDemoInTile,
			})),
		{ ssr: false },
	),
	"logo-third-party-demo-in-tag": dynamic(
		() =>
			import("../../demos/ui/logo-third-party-demo").then((mod) => ({
				default: mod.LogoThirdPartyDemoInTag,
			})),
		{ ssr: false },
	),
	"logo-third-party-demo-named-exports": dynamic(
		() =>
			import("../../demos/ui/logo-third-party-demo").then((mod) => ({
				default: mod.LogoThirdPartyDemoNamedExports,
			})),
		{ ssr: false },
	),
	// Lozenge
	"lozenge-demo-default": dynamic(
		() =>
			import("../../demos/ui/lozenge-demo").then((mod) => ({
				default: mod.LozengeDemoDefault,
			})),
		{ ssr: false },
	),
	"lozenge-demo-appearances": dynamic(
		() =>
			import("../../demos/ui/lozenge-demo").then((mod) => ({
				default: mod.LozengeDemoAppearances,
			})),
		{ ssr: false },
	),
	"lozenge-demo-accent-colors": dynamic(
		() =>
			import("../../demos/ui/lozenge-demo").then((mod) => ({
				default: mod.LozengeDemoAccentColors,
			})),
		{ ssr: false },
	),
	"lozenge-demo-spacing": dynamic(
		() =>
			import("../../demos/ui/lozenge-demo").then((mod) => ({
				default: mod.LozengeDemoSpacing,
			})),
		{ ssr: false },
	),
	"lozenge-demo-with-icon": dynamic(
		() =>
			import("../../demos/ui/lozenge-demo").then((mod) => ({
				default: mod.LozengeDemoWithIcon,
			})),
		{ ssr: false },
	),
	"lozenge-demo-front-slot": dynamic(
		() =>
			import("../../demos/ui/lozenge-demo").then((mod) => ({
				default: mod.LozengeDemoFrontSlot,
			})),
		{ ssr: false },
	),
	"lozenge-demo-trailing-metric": dynamic(
		() =>
			import("../../demos/ui/lozenge-demo").then((mod) => ({
				default: mod.LozengeDemoTrailingMetric,
			})),
		{ ssr: false },
	),
	"lozenge-demo-max-width": dynamic(
		() =>
			import("../../demos/ui/lozenge-demo").then((mod) => ({
				default: mod.LozengeDemoMaxWidth,
			})),
		{ ssr: false },
	),
	"lozenge-demo-dropdown-trigger": dynamic(
		() =>
			import("../../demos/ui/lozenge-demo").then((mod) => ({
				default: mod.LozengeDemoDropdownTrigger,
			})),
		{ ssr: false },
	),
	"lozenge-demo-dropdown-trigger-appearances": dynamic(
		() =>
			import("../../demos/ui/lozenge-demo").then((mod) => ({
				default: mod.LozengeDemoDropdownTriggerAppearances,
			})),
		{ ssr: false },
	),
	"lozenge-demo-usage": dynamic(
		() =>
			import("../../demos/ui/lozenge-demo").then((mod) => ({
				default: mod.LozengeDemoUsage,
			})),
		{ ssr: false },
	),
	// Menu
	"menu-group-demo-default": dynamic(
		() =>
			import("../../demos/ui/menu-group-demo").then((mod) => ({
				default: mod.MenuGroupDemoDefault,
			})),
		{ ssr: false },
	),
	"menu-group-demo-menu-structure": dynamic(
		() =>
			import("../../demos/ui/menu-group-demo").then((mod) => ({
				default: mod.MenuGroupDemoMenuStructure,
			})),
		{ ssr: false },
	),
	"menu-group-demo-button-item": dynamic(
		() =>
			import("../../demos/ui/menu-group-demo").then((mod) => ({
				default: mod.MenuGroupDemoButtonItem,
			})),
		{ ssr: false },
	),
	"menu-group-demo-link-item": dynamic(
		() =>
			import("../../demos/ui/menu-group-demo").then((mod) => ({
				default: mod.MenuGroupDemoLinkItem,
			})),
		{ ssr: false },
	),
	"menu-group-demo-custom-item": dynamic(
		() =>
			import("../../demos/ui/menu-group-demo").then((mod) => ({
				default: mod.MenuGroupDemoCustomItem,
			})),
		{ ssr: false },
	),
	"menu-group-demo-section-and-heading": dynamic(
		() =>
			import("../../demos/ui/menu-group-demo").then((mod) => ({
				default: mod.MenuGroupDemoSectionAndHeading,
			})),
		{ ssr: false },
	),
	"menu-group-demo-density": dynamic(
		() =>
			import("../../demos/ui/menu-group-demo").then((mod) => ({
				default: mod.MenuGroupDemoDensity,
			})),
		{ ssr: false },
	),
	"menu-group-demo-scrolling": dynamic(
		() =>
			import("../../demos/ui/menu-group-demo").then((mod) => ({
				default: mod.MenuGroupDemoScrolling,
			})),
		{ ssr: false },
	),
	"menu-group-demo-loading": dynamic(
		() =>
			import("../../demos/ui/menu-group-demo").then((mod) => ({
				default: mod.MenuGroupDemoLoading,
			})),
		{ ssr: false },
	),
	// Page Header
	"page-header-demo-default": dynamic(
		() =>
			import("../../demos/ui/page-header-demo").then((mod) => ({
				default: mod.PageHeaderDemoDefault,
			})),
		{ ssr: false },
	),
	"page-header-demo-complex": dynamic(
		() =>
			import("../../demos/ui/page-header-demo").then((mod) => ({
				default: mod.PageHeaderDemoComplex,
			})),
		{ ssr: false },
	),
	// Progress Indicator
	"progress-indicator-demo-default": dynamic(
		() =>
			import("../../demos/ui/progress-indicator-demo").then((mod) => ({
				default: mod.ProgressIndicatorDemoDefault,
			})),
		{ ssr: false },
	),
	"progress-indicator-demo-appearances": dynamic(
		() =>
			import("../../demos/ui/progress-indicator-demo").then((mod) => ({
				default: mod.ProgressIndicatorDemoAppearances,
			})),
		{ ssr: false },
	),
	"progress-indicator-demo-sizes": dynamic(
		() =>
			import("../../demos/ui/progress-indicator-demo").then((mod) => ({
				default: mod.ProgressIndicatorDemoSizes,
			})),
		{ ssr: false },
	),
	"progress-indicator-demo-interaction": dynamic(
		() =>
			import("../../demos/ui/progress-indicator-demo").then((mod) => ({
				default: mod.ProgressIndicatorDemoInteraction,
			})),
		{ ssr: false },
	),
	"progress-indicator-demo-start": dynamic(
		() =>
			import("../../demos/ui/progress-indicator-demo").then((mod) => ({
				default: mod.ProgressIndicatorDemoStart,
			})),
		{ ssr: false },
	),
	"progress-indicator-demo-complete": dynamic(
		() =>
			import("../../demos/ui/progress-indicator-demo").then((mod) => ({
				default: mod.ProgressIndicatorDemoComplete,
			})),
		{ ssr: false },
	),
	"progress-indicator-demo-three-steps": dynamic(
		() =>
			import("../../demos/ui/progress-indicator-demo").then((mod) => ({
				default: mod.ProgressIndicatorDemoThreeSteps,
			})),
		{ ssr: false },
	),
};
