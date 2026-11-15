import dynamic from "next/dynamic";
import type { ComponentType } from "react";

export const UI_ACTION_VARIANT_DEMOS: Record<string, ComponentType> = {
	// Button Group
	"button-group-demo-default": dynamic(
		() =>
			import("../../demos/ui/button-group-demo").then((mod) => ({
				default: mod.ButtonGroupDemoDefault,
			})),
		{ ssr: false },
	),
	"button-group-demo-vertical": dynamic(
		() =>
			import("../../demos/ui/button-group-demo").then((mod) => ({
				default: mod.ButtonGroupDemoVertical,
			})),
		{ ssr: false },
	),
	"button-group-demo-with-separator": dynamic(
		() =>
			import("../../demos/ui/button-group-demo").then((mod) => ({
				default: mod.ButtonGroupDemoWithSeparator,
			})),
		{ ssr: false },
	),
	"button-group-demo-basic": dynamic(
		() =>
			import("../../demos/ui/button-group-demo").then((mod) => ({
				default: mod.ButtonGroupDemoBasic,
			})),
		{ ssr: false },
	),
	"button-group-demo-navigation": dynamic(
		() =>
			import("../../demos/ui/button-group-demo").then((mod) => ({
				default: mod.ButtonGroupDemoNavigation,
			})),
		{ ssr: false },
	),
	"button-group-demo-nested": dynamic(
		() =>
			import("../../demos/ui/button-group-demo").then((mod) => ({
				default: mod.ButtonGroupDemoNested,
			})),
		{ ssr: false },
	),
	"button-group-demo-pagination-split": dynamic(
		() =>
			import("../../demos/ui/button-group-demo").then((mod) => ({
				default: mod.ButtonGroupDemoPaginationSplit,
			})),
		{ ssr: false },
	),
	"button-group-demo-pagination": dynamic(
		() =>
			import("../../demos/ui/button-group-demo").then((mod) => ({
				default: mod.ButtonGroupDemoPagination,
			})),
		{ ssr: false },
	),
	"button-group-demo-text-alignment": dynamic(
		() =>
			import("../../demos/ui/button-group-demo").then((mod) => ({
				default: mod.ButtonGroupDemoTextAlignment,
			})),
		{ ssr: false },
	),
	"button-group-demo-vertical-icons": dynamic(
		() =>
			import("../../demos/ui/button-group-demo").then((mod) => ({
				default: mod.ButtonGroupDemoVerticalIcons,
			})),
		{ ssr: false },
	),
	"button-group-demo-vertical-nested": dynamic(
		() =>
			import("../../demos/ui/button-group-demo").then((mod) => ({
				default: mod.ButtonGroupDemoVerticalNested,
			})),
		{ ssr: false },
	),
	"button-group-demo-with-dropdown": dynamic(
		() =>
			import("../../demos/ui/button-group-demo").then((mod) => ({
				default: mod.ButtonGroupDemoWithDropdown,
			})),
		{ ssr: false },
	),
	"button-group-demo-with-fields": dynamic(
		() =>
			import("../../demos/ui/button-group-demo").then((mod) => ({
				default: mod.ButtonGroupDemoWithFields,
			})),
		{ ssr: false },
	),
	"button-group-demo-with-icons": dynamic(
		() =>
			import("../../demos/ui/button-group-demo").then((mod) => ({
				default: mod.ButtonGroupDemoWithIcons,
			})),
		{ ssr: false },
	),
	"button-group-demo-with-input-group": dynamic(
		() =>
			import("../../demos/ui/button-group-demo").then((mod) => ({
				default: mod.ButtonGroupDemoWithInputGroup,
			})),
		{ ssr: false },
	),
	"button-group-demo-with-input": dynamic(
		() =>
			import("../../demos/ui/button-group-demo").then((mod) => ({
				default: mod.ButtonGroupDemoWithInput,
			})),
		{ ssr: false },
	),
	"button-group-demo-with-like": dynamic(
		() =>
			import("../../demos/ui/button-group-demo").then((mod) => ({
				default: mod.ButtonGroupDemoWithLike,
			})),
		{ ssr: false },
	),
	"button-group-demo-with-select-and-input": dynamic(
		() =>
			import("../../demos/ui/button-group-demo").then((mod) => ({
				default: mod.ButtonGroupDemoWithSelectAndInput,
			})),
		{ ssr: false },
	),
	"button-group-demo-with-select": dynamic(
		() =>
			import("../../demos/ui/button-group-demo").then((mod) => ({
				default: mod.ButtonGroupDemoWithSelect,
			})),
		{ ssr: false },
	),
	"button-group-demo-with-text": dynamic(
		() =>
			import("../../demos/ui/button-group-demo").then((mod) => ({
				default: mod.ButtonGroupDemoWithText,
			})),
		{ ssr: false },
	),
	"button-group-demo-separated": dynamic(
		() =>
			import("../../demos/ui/button-group-demo").then((mod) => ({
				default: mod.ButtonGroupDemoSeparated,
			})),
		{ ssr: false },
	),
	"button-group-demo-separated-outline": dynamic(
		() =>
			import("../../demos/ui/button-group-demo").then((mod) => ({
				default: mod.ButtonGroupDemoSeparatedOutline,
			})),
		{ ssr: false },
	),
	"button-group-demo-variants": dynamic(
		() =>
			import("../../demos/ui/button-group-demo").then((mod) => ({
				default: mod.ButtonGroupDemoVariants,
			})),
		{ ssr: false },
	),
	// Alert
	"alert-demo-default": dynamic(
		() =>
			import("../../demos/ui/alert-demo").then((mod) => ({
				default: mod.AlertDemoDefault,
			})),
		{ ssr: false },
	),
	"alert-demo-info": dynamic(
		() =>
			import("../../demos/ui/alert-demo").then((mod) => ({
				default: mod.AlertDemoInfo,
			})),
		{ ssr: false },
	),
	"alert-demo-warning": dynamic(
		() =>
			import("../../demos/ui/alert-demo").then((mod) => ({
				default: mod.AlertDemoWarning,
			})),
		{ ssr: false },
	),
	"alert-demo-success": dynamic(
		() =>
			import("../../demos/ui/alert-demo").then((mod) => ({
				default: mod.AlertDemoSuccess,
			})),
		{ ssr: false },
	),
	"alert-demo-danger": dynamic(
		() =>
			import("../../demos/ui/alert-demo").then((mod) => ({
				default: mod.AlertDemoDanger,
			})),
		{ ssr: false },
	),
	"alert-demo-discovery": dynamic(
		() =>
			import("../../demos/ui/alert-demo").then((mod) => ({
				default: mod.AlertDemoDiscovery,
			})),
		{ ssr: false },
	),
	"alert-demo-error": dynamic(
		() =>
			import("../../demos/ui/alert-demo").then((mod) => ({
				default: mod.AlertDemoError,
			})),
		{ ssr: false },
	),
	"alert-demo-announcement": dynamic(
		() =>
			import("../../demos/ui/alert-demo").then((mod) => ({
				default: mod.AlertDemoAnnouncement,
			})),
		{ ssr: false },
	),
	"alert-demo-compound": dynamic(
		() =>
			import("../../demos/ui/alert-demo").then((mod) => ({
				default: mod.AlertDemoCompound,
			})),
		{ ssr: false },
	),
	"alert-demo-appearances": dynamic(
		() =>
			import("../../demos/ui/alert-demo").then((mod) => ({
				default: mod.AlertDemoAppearances,
			})),
		{ ssr: false },
	),
	"alert-demo-sizes": dynamic(
		() =>
			import("../../demos/ui/alert-demo").then((mod) => ({
				default: mod.AlertDemoSizes,
			})),
		{ ssr: false },
	),
	"alert-demo-destructive": dynamic(
		() =>
			import("../../demos/ui/alert-demo").then((mod) => ({
				default: mod.AlertDemoDestructive,
			})),
		{ ssr: false },
	),
	"alert-demo-with-action": dynamic(
		() =>
			import("../../demos/ui/alert-demo").then((mod) => ({
				default: mod.AlertDemoWithAction,
			})),
		{ ssr: false },
	),
	"alert-demo-basic": dynamic(
		() =>
			import("../../demos/ui/alert-demo").then((mod) => ({
				default: mod.AlertDemoBasic,
			})),
		{ ssr: false },
	),
	"alert-demo-with-actions": dynamic(
		() =>
			import("../../demos/ui/alert-demo").then((mod) => ({
				default: mod.AlertDemoWithActions,
			})),
		{ ssr: false },
	),
	"alert-demo-with-icons": dynamic(
		() =>
			import("../../demos/ui/alert-demo").then((mod) => ({
				default: mod.AlertDemoWithIcons,
			})),
		{ ssr: false },
	),
	// Slider
	"slider-demo-default": dynamic(
		() =>
			import("../../demos/ui/slider-demo").then((mod) => ({
				default: mod.SliderDemoDefault,
			})),
		{ ssr: false },
	),
	"slider-demo-range": dynamic(
		() =>
			import("../../demos/ui/slider-demo").then((mod) => ({
				default: mod.SliderDemoRange,
			})),
		{ ssr: false },
	),
	"slider-demo-disabled": dynamic(
		() =>
			import("../../demos/ui/slider-demo").then((mod) => ({
				default: mod.SliderDemoDisabled,
			})),
		{ ssr: false },
	),
	"slider-demo-basic": dynamic(
		() =>
			import("../../demos/ui/slider-demo").then((mod) => ({
				default: mod.SliderDemoBasic,
			})),
		{ ssr: false },
	),
	"slider-demo-controlled": dynamic(
		() =>
			import("../../demos/ui/slider-demo").then((mod) => ({
				default: mod.SliderDemoControlled,
			})),
		{ ssr: false },
	),
	"slider-demo-multiple-thumbs": dynamic(
		() =>
			import("../../demos/ui/slider-demo").then((mod) => ({
				default: mod.SliderDemoMultipleThumbs,
			})),
		{ ssr: false },
	),
	"slider-demo-vertical": dynamic(
		() =>
			import("../../demos/ui/slider-demo").then((mod) => ({
				default: mod.SliderDemoVertical,
			})),
		{ ssr: false },
	),
	// Calendar
	"calendar-demo-default": dynamic(
		() =>
			import("../../demos/ui/calendar-demo").then((mod) => ({
				default: mod.CalendarDemoDefault,
			})),
		{ ssr: false },
	),
	"calendar-demo-range": dynamic(
		() =>
			import("../../demos/ui/calendar-demo").then((mod) => ({
				default: mod.CalendarDemoRange,
			})),
		{ ssr: false },
	),
	"calendar-demo-booked-dates": dynamic(
		() =>
			import("../../demos/ui/calendar-demo").then((mod) => ({
				default: mod.CalendarDemoBookedDates,
			})),
		{ ssr: false },
	),
	"calendar-demo-custom-days": dynamic(
		() =>
			import("../../demos/ui/calendar-demo").then((mod) => ({
				default: mod.CalendarDemoCustomDays,
			})),
		{ ssr: false },
	),
	"calendar-demo-date-picker-range": dynamic(
		() =>
			import("../../demos/ui/calendar-demo").then((mod) => ({
				default: mod.CalendarDemoDatePickerRange,
			})),
		{ ssr: false },
	),
	"calendar-demo-date-picker-simple": dynamic(
		() =>
			import("../../demos/ui/calendar-demo").then((mod) => ({
				default: mod.CalendarDemoDatePickerSimple,
			})),
		{ ssr: false },
	),
	"calendar-demo-date-picker-with-dropdowns": dynamic(
		() =>
			import("../../demos/ui/calendar-demo").then((mod) => ({
				default: mod.CalendarDemoDatePickerWithDropdowns,
			})),
		{ ssr: false },
	),
	"calendar-demo-in-card": dynamic(
		() =>
			import("../../demos/ui/calendar-demo").then((mod) => ({
				default: mod.CalendarDemoInCard,
			})),
		{ ssr: false },
	),
	"calendar-demo-in-popover": dynamic(
		() =>
			import("../../demos/ui/calendar-demo").then((mod) => ({
				default: mod.CalendarDemoInPopover,
			})),
		{ ssr: false },
	),
	"calendar-demo-multiple": dynamic(
		() =>
			import("../../demos/ui/calendar-demo").then((mod) => ({
				default: mod.CalendarDemoMultiple,
			})),
		{ ssr: false },
	),
	"calendar-demo-range-multi-month": dynamic(
		() =>
			import("../../demos/ui/calendar-demo").then((mod) => ({
				default: mod.CalendarDemoRangeMultiMonth,
			})),
		{ ssr: false },
	),
	"calendar-demo-range-multiple-months": dynamic(
		() =>
			import("../../demos/ui/calendar-demo").then((mod) => ({
				default: mod.CalendarDemoRangeMultipleMonths,
			})),
		{ ssr: false },
	),
	"calendar-demo-single": dynamic(
		() =>
			import("../../demos/ui/calendar-demo").then((mod) => ({
				default: mod.CalendarDemoSingle,
			})),
		{ ssr: false },
	),
	"calendar-demo-week-numbers": dynamic(
		() =>
			import("../../demos/ui/calendar-demo").then((mod) => ({
				default: mod.CalendarDemoWeekNumbers,
			})),
		{ ssr: false },
	),
	"calendar-demo-with-presets": dynamic(
		() =>
			import("../../demos/ui/calendar-demo").then((mod) => ({
				default: mod.CalendarDemoWithPresets,
			})),
		{ ssr: false },
	),
	"calendar-demo-with-time": dynamic(
		() =>
			import("../../demos/ui/calendar-demo").then((mod) => ({
				default: mod.CalendarDemoWithTime,
			})),
		{ ssr: false },
	),
	// Carousel
	"carousel-demo-default": dynamic(
		() =>
			import("../../demos/ui/carousel-demo").then((mod) => ({
				default: mod.CarouselDemoDefault,
			})),
		{ ssr: false },
	),
	"carousel-demo-sizes": dynamic(
		() =>
			import("../../demos/ui/carousel-demo").then((mod) => ({
				default: mod.CarouselDemoSizes,
			})),
		{ ssr: false },
	),
	"carousel-demo-vertical": dynamic(
		() =>
			import("../../demos/ui/carousel-demo").then((mod) => ({
				default: mod.CarouselDemoVertical,
			})),
		{ ssr: false },
	),
	"carousel-demo-basic": dynamic(
		() =>
			import("../../demos/ui/carousel-demo").then((mod) => ({
				default: mod.CarouselDemoBasic,
			})),
		{ ssr: false },
	),
	"carousel-demo-multiple": dynamic(
		() =>
			import("../../demos/ui/carousel-demo").then((mod) => ({
				default: mod.CarouselDemoMultiple,
			})),
		{ ssr: false },
	),
	"carousel-demo-with-gap": dynamic(
		() =>
			import("../../demos/ui/carousel-demo").then((mod) => ({
				default: mod.CarouselDemoWithGap,
			})),
		{ ssr: false },
	),
	// Sidebar
	"sidebar-demo-default": dynamic(
		() =>
			import("../../demos/ui/sidebar-demo").then((mod) => ({
				default: mod.SidebarDemoDefault,
			})),
		{ ssr: false },
	),
	"sidebar-demo-collapsed": dynamic(
		() =>
			import("../../demos/ui/sidebar-demo").then((mod) => ({
				default: mod.SidebarDemoCollapsed,
			})),
		{ ssr: false },
	),
	// Sonner
	"sonner-demo-default": dynamic(
		() =>
			import("../../demos/ui/sonner-demo").then((mod) => ({
				default: mod.SonnerDemoDefault,
			})),
		{ ssr: false },
	),
	"sonner-demo-variants": dynamic(
		() =>
			import("../../demos/ui/sonner-demo").then((mod) => ({
				default: mod.SonnerDemoVariants,
			})),
		{ ssr: false },
	),
	"sonner-demo-with-description": dynamic(
		() =>
			import("../../demos/ui/sonner-demo").then((mod) => ({
				default: mod.SonnerDemoWithDescription,
			})),
		{ ssr: false },
	),
	"sonner-demo-with-action": dynamic(
		() =>
			import("../../demos/ui/sonner-demo").then((mod) => ({
				default: mod.SonnerDemoWithAction,
			})),
		{ ssr: false },
	),
	"sonner-demo-auto-dismiss": dynamic(
		() =>
			import("../../demos/ui/sonner-demo").then((mod) => ({
				default: mod.SonnerDemoAutoDismiss,
			})),
		{ ssr: false },
	),
	"sonner-demo-promise": dynamic(
		() =>
			import("../../demos/ui/sonner-demo").then((mod) => ({
				default: mod.SonnerDemoPromise,
			})),
		{ ssr: false },
	),
	"sonner-demo-close-button": dynamic(
		() =>
			import("../../demos/ui/sonner-demo").then((mod) => ({
				default: mod.SonnerDemoCloseButton,
			})),
		{ ssr: false },
	),
	"sonner-demo-long-title": dynamic(
		() =>
			import("../../demos/ui/sonner-demo").then((mod) => ({
				default: mod.SonnerDemoLongTitle,
			})),
		{ ssr: false },
	),
};
