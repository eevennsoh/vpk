import dynamic from "next/dynamic";
import type { ComponentType } from "react";

export const UI_PRIMARY_DEMOS: Record<string, ComponentType> = {
	accordion: dynamic(() => import("../../demos/ui/accordion-demo"), { ssr: false }),
	alert: dynamic(() => import("../../demos/ui/alert-demo"), { ssr: false }),
	"alert-dialog": dynamic(() => import("../../demos/ui/alert-dialog-demo"), {
		ssr: false,
	}),
	"aspect-ratio": dynamic(() => import("../../demos/ui/aspect-ratio-demo"), {
		ssr: false,
	}),
	attachment: dynamic(() => import("../../demos/ui/attachment-demo"), { ssr: false }),
	avatar: dynamic(() => import("../../demos/ui/avatar-demo"), { ssr: false }),
	badge: dynamic(() => import("../../demos/ui/badge-demo"), { ssr: false }),
	breadcrumb: dynamic(() => import("../../demos/ui/breadcrumb-demo"), {
		ssr: false,
	}),
	bubble: dynamic(() => import("../../demos/ui/bubble-demo"), { ssr: false }),
	button: dynamic(() => import("../../demos/ui/button-demo"), { ssr: false }),
	"button-group": dynamic(() => import("../../demos/ui/button-group-demo"), {
		ssr: false,
	}),
	calendar: dynamic(() => import("../../demos/ui/calendar-demo"), { ssr: false }),
	card: dynamic(() => import("../../demos/ui/card-demo"), { ssr: false }),
	carousel: dynamic(() => import("../../demos/ui/carousel-demo"), { ssr: false }),
	chart: dynamic(() => import("../../demos/ui/chart-demo"), { ssr: false }),
	checkbox: dynamic(() => import("../../demos/ui/checkbox-demo"), { ssr: false }),
	collapsible: dynamic(() => import("../../demos/ui/collapsible-demo"), {
		ssr: false,
	}),
	combobox: dynamic(() => import("../../demos/ui/combobox-demo"), { ssr: false }),
	command: dynamic(() => import("../../demos/ui/command-demo"), { ssr: false }),
	"context-menu": dynamic(() => import("../../demos/ui/context-menu-demo"), {
		ssr: false,
	}),
	dialog: dynamic(() => import("../../demos/ui/dialog-demo"), { ssr: false }),
	direction: dynamic(() => import("../../demos/ui/direction-demo"), { ssr: false }),
	drawer: dynamic(() => import("../../demos/ui/drawer-demo"), { ssr: false }),
	"dropdown-menu": dynamic(() => import("../../demos/ui/dropdown-menu-demo"), {
		ssr: false,
	}),
	empty: dynamic(() => import("../../demos/ui/empty-demo"), { ssr: false }),
	field: dynamic(() => import("../../demos/ui/field-demo"), { ssr: false }),
	heading: dynamic(() => import("../../demos/ui/heading-demo"), { ssr: false }),
	"hover-card": dynamic(() => import("../../demos/ui/hover-card-demo"), {
		ssr: false,
	}),
	"input-group": dynamic(() => import("../../demos/ui/input-group-demo"), {
		ssr: false,
	}),
	"input-otp": dynamic(() => import("../../demos/ui/input-otp-demo"), {
		ssr: false,
	}),
	item: dynamic(() => import("../../demos/ui/item-demo"), { ssr: false }),
	kbd: dynamic(() => import("../../demos/ui/kbd-demo"), { ssr: false }),
	label: dynamic(() => import("../../demos/ui/label-demo"), { ssr: false }),
	marker: dynamic(() => import("../../demos/ui/marker-demo"), { ssr: false }),
	menubar: dynamic(() => import("../../demos/ui/menubar-demo"), { ssr: false }),
	message: dynamic(() => import("../../demos/ui/message-demo"), { ssr: false }),
	"message-scroller": dynamic(() => import("../../demos/ui/message-scroller-demo"), {
		ssr: false,
	}),
	"native-select": dynamic(() => import("../../demos/ui/native-select-demo"), {
		ssr: false,
	}),
	"navigation-menu": dynamic(() => import("../../demos/ui/navigation-menu-demo"), {
		ssr: false,
	}),
	pagination: dynamic(() => import("../../demos/ui/pagination-demo"), {
		ssr: false,
	}),
	popover: dynamic(() => import("../../demos/ui/popover-demo"), { ssr: false }),
	progress: dynamic(() => import("../../demos/ui/progress-demo"), { ssr: false }),
	questionnaire: dynamic(() => import("../../demos/ui/questionnaire-demo"), {
		ssr: false,
	}),
	"radio-group": dynamic(() => import("../../demos/ui/radio-group-demo"), {
		ssr: false,
	}),
	resizable: dynamic(() => import("../../demos/ui/resizable-demo"), { ssr: false }),
	"scroll-area": dynamic(() => import("../../demos/ui/scroll-area-demo"), {
		ssr: false,
	}),
	"scroll-fade": dynamic(() => import("../../demos/ui/scroll-fade-demo"), {
		ssr: false,
	}),
	select: dynamic(() => import("../../demos/ui/select-demo"), { ssr: false }),
	separator: dynamic(() => import("../../demos/ui/separator-demo"), { ssr: false }),
	sheet: dynamic(() => import("../../demos/ui/sheet-demo"), { ssr: false }),
	sidebar: dynamic(() => import("../../demos/ui/sidebar-demo"), { ssr: false }),
	skeleton: dynamic(() => import("../../demos/ui/skeleton-demo"), { ssr: false }),
	slider: dynamic(() => import("../../demos/ui/slider-demo"), { ssr: false }),
	sonner: dynamic(() => import("../../demos/ui/sonner-demo"), { ssr: false }),
	spinner: dynamic(() => import("../../demos/ui/spinner-demo"), { ssr: false }),
	switch: dynamic(() => import("../../demos/ui/switch-demo"), { ssr: false }),
	table: dynamic(() => import("../../demos/ui/table-demo"), { ssr: false }),
	tabs: dynamic(() => import("../../demos/ui/tabs-demo"), { ssr: false }),

	toggle: dynamic(() => import("../../demos/ui/toggle-demo"), { ssr: false }),
	"toggle-group": dynamic(() => import("../../demos/ui/toggle-group-demo"), {
		ssr: false,
	}),
	tooltip: dynamic(() => import("../../demos/ui/tooltip-demo"), { ssr: false }),
	blanket: dynamic(() => import("../../demos/ui/blanket-demo"), { ssr: false }),
	banner: dynamic(() => import("../../demos/ui/banner-demo"), { ssr: false }),
	comment: dynamic(() => import("../../demos/ui/comment-demo"), { ssr: false }),
	"date-label": dynamic(() => import("../../demos/ui/date-label-demo"), {
		ssr: false,
	}),
	"date-picker": dynamic(() => import("../../demos/ui/date-picker-demo"), {
		ssr: false,
	}),
	"date-time-picker": dynamic(
		() => import("../../demos/ui/date-time-picker-demo"),
		{ ssr: false },
	),
	forms: dynamic(() => import("../../demos/ui/forms-demo"), { ssr: false }),
	icon: dynamic(() => import("../../demos/ui/icon-demo"), { ssr: false }),
	"icon-tile": dynamic(() => import("../../demos/ui/icon-tile-demo"), {
		ssr: false,
	}),
	"inline-edit": dynamic(() => import("../../demos/ui/inline-edit-demo"), {
		ssr: false,
	}),
	logo: dynamic(() => import("../../demos/ui/logo-demo"), { ssr: false }),
	"logo-third-party": dynamic(
		() => import("../../demos/ui/logo-third-party-demo"),
		{ ssr: false },
	),
	lozenge: dynamic(() => import("../../demos/ui/lozenge-demo"), { ssr: false }),
	"page-header": dynamic(() => import("../../demos/ui/page-header-demo"), {
		ssr: false,
	}),
	panel: dynamic(() => import("../../demos/ui/panel-demo"), { ssr: false }),
	"progress-indicator": dynamic(
		() => import("../../demos/ui/progress-indicator-demo"),
		{ ssr: false },
	),
	"progress-tracker": dynamic(
		() => import("../../demos/ui/progress-tracker-demo"),
		{ ssr: false },
	),
	tag: dynamic(() => import("../../demos/ui/tag-demo"), { ssr: false }),

	"time-picker": dynamic(() => import("../../demos/ui/time-picker-demo"), {
		ssr: false,
	}),
	tile: dynamic(() => import("../../demos/ui/tile-demo"), { ssr: false }),
};
