import type { ComponentDetail } from "@/app/data/component-detail-types";

import { BUTTON_DETAIL } from "./ui/button";
import { BADGE_DETAIL } from "./ui/badge";
import { LOGO_DETAIL } from "./ui/logo";
import { LOGO_THIRD_PARTY_DETAIL } from "./ui/logo-third-party";
import { DIALOG_DETAIL } from "./ui/dialog";
import { TABS_DETAIL } from "./ui/tabs";
import { SELECT_DETAIL } from "./ui/select";
import { CHECKBOX_DETAIL } from "./ui/checkbox";
import { RADIO_GROUP_DETAIL } from "./ui/radio-group";
import { SWITCH_DETAIL } from "./ui/switch";
import { TOGGLE_DETAIL } from "./ui/toggle";
import { TOGGLE_GROUP_DETAIL } from "./ui/toggle-group";
import { LABEL_DETAIL } from "./ui/label";
import { FIELD_DETAIL } from "./ui/field";
import { NATIVE_SELECT_DETAIL } from "./ui/native-select";
import { INPUT_OTP_DETAIL } from "./ui/input-otp";
import { ALERT_DIALOG_DETAIL } from "./ui/alert-dialog";
import { POPOVER_DETAIL } from "./ui/popover";
import { TOOLTIP_DETAIL } from "./ui/tooltip";
import { HEADING_DETAIL } from "./ui/heading";
import { HOVER_CARD_DETAIL } from "./ui/hover-card";
import { SHEET_DETAIL } from "./ui/sheet";
import { DRAWER_DETAIL } from "./ui/drawer";
import { COLLAPSIBLE_DETAIL } from "./ui/collapsible";
import { BREADCRUMB_DETAIL } from "./ui/breadcrumb";
import { PAGINATION_DETAIL } from "./ui/pagination";
import { ACCORDION_DETAIL } from "./ui/accordion";
import { SEPARATOR_DETAIL } from "./ui/separator";
import { NAVIGATION_MENU_DETAIL } from "./ui/navigation-menu";
import { PROGRESS_DETAIL } from "./ui/progress";
import { SPINNER_DETAIL } from "./ui/spinner";
import { AVATAR_DETAIL } from "./ui/avatar";
import { CARD_DETAIL } from "./ui/card";
import { PANEL_DETAIL } from "./ui/panel";
import { TABLE_DETAIL } from "./ui/table";
import { SKELETON_DETAIL } from "./ui/skeleton";
import { EMPTY_DETAIL } from "./ui/empty";
import { KBD_DETAIL } from "./ui/kbd";
import { ITEM_DETAIL } from "./ui/item";
import { DROPDOWN_MENU_DETAIL } from "./ui/dropdown-menu";
import { CONTEXT_MENU_DETAIL } from "./ui/context-menu";
import { MENUBAR_DETAIL } from "./ui/menubar";
import { COMMAND_DETAIL } from "./ui/command";
import { COMBOBOX_DETAIL } from "./ui/combobox";
import { INPUT_GROUP_DETAIL } from "./ui/input-group";
import { ASPECT_RATIO_DETAIL } from "./ui/aspect-ratio";
import { SCROLL_AREA_DETAIL } from "./ui/scroll-area";
import { SCROLL_FADE_DETAIL } from "./ui/scroll-fade";
import { ATTACHMENT_DETAIL } from "./ui/attachment";
import { BUBBLE_DETAIL } from "./ui/bubble";
import { MARKER_DETAIL } from "./ui/marker";
import { MESSAGE_DETAIL } from "./ui/message";
import { MESSAGE_SCROLLER_DETAIL } from "./ui/message-scroller";
import { QUESTIONNAIRE_DETAIL } from "./ui/questionnaire";
import { RESIZABLE_DETAIL } from "./ui/resizable";
import { DIRECTION_DETAIL } from "./ui/direction";
import { BUTTON_GROUP_DETAIL } from "./ui/button-group";
import { ALERT_DETAIL } from "./ui/alert";
import { SLIDER_DETAIL } from "./ui/slider";
import { CALENDAR_DETAIL } from "./ui/calendar";
import { CAROUSEL_DETAIL } from "./ui/carousel";
import { CHART_DETAIL } from "./ui/chart";
import { SIDEBAR_DETAIL } from "./ui/sidebar";
import { SONNER_DETAIL } from "./ui/sonner";
import { FORMS_DETAIL } from "./ui/forms";
import { ICON_DETAIL } from "./ui/icon-detail";
import { ICON_TILE_DETAIL } from "./ui/icon-tile";
import { INLINE_EDIT_DETAIL } from "./ui/inline-edit";
import { BANNER_DETAIL } from "./ui/banner";
import { BLANKET_DETAIL } from "./ui/blanket";
import { COMMENT_DETAIL } from "./ui/comment";
import { DATE_LABEL_DETAIL } from "./ui/date-label";
import { DATE_PICKER_DETAIL } from "./ui/date-picker";
import { LOZENGE_DETAIL } from "./ui/lozenge";
import { PAGE_HEADER_DETAIL } from "./ui/page-header";
import { PROGRESS_INDICATOR_DETAIL } from "./ui/progress-indicator";
import { PROGRESS_TRACKER_DETAIL } from "./ui/progress-tracker";
import { TAG_DETAIL } from "./ui/tag";
import { TIME_PICKER_DETAIL } from "./ui/time-picker";
import { TILE_DETAIL } from "./ui/tile";
import { DATE_TIME_PICKER_DETAIL } from "./ui/date-time-picker";

export const UI_DETAILS: Record<string, ComponentDetail> = {
	button: BUTTON_DETAIL,
	badge: BADGE_DETAIL,
	logo: LOGO_DETAIL,
	"logo-third-party": LOGO_THIRD_PARTY_DETAIL,
	dialog: DIALOG_DETAIL,
	tabs: TABS_DETAIL,
	select: SELECT_DETAIL,
	checkbox: CHECKBOX_DETAIL,
	"radio-group": RADIO_GROUP_DETAIL,
	switch: SWITCH_DETAIL,
	toggle: TOGGLE_DETAIL,
	"toggle-group": TOGGLE_GROUP_DETAIL,
	label: LABEL_DETAIL,
	field: FIELD_DETAIL,
	"native-select": NATIVE_SELECT_DETAIL,
	"input-otp": INPUT_OTP_DETAIL,
	"alert-dialog": ALERT_DIALOG_DETAIL,
	popover: POPOVER_DETAIL,
	tooltip: TOOLTIP_DETAIL,
	heading: HEADING_DETAIL,
	"hover-card": HOVER_CARD_DETAIL,
	sheet: SHEET_DETAIL,
	drawer: DRAWER_DETAIL,
	collapsible: COLLAPSIBLE_DETAIL,
	breadcrumb: BREADCRUMB_DETAIL,
	pagination: PAGINATION_DETAIL,
	accordion: ACCORDION_DETAIL,
	separator: SEPARATOR_DETAIL,
	"navigation-menu": NAVIGATION_MENU_DETAIL,
	progress: PROGRESS_DETAIL,
	spinner: SPINNER_DETAIL,
	avatar: AVATAR_DETAIL,
	card: CARD_DETAIL,
	panel: PANEL_DETAIL,
	table: TABLE_DETAIL,
	skeleton: SKELETON_DETAIL,
	empty: EMPTY_DETAIL,
	kbd: KBD_DETAIL,
	item: ITEM_DETAIL,
	"dropdown-menu": DROPDOWN_MENU_DETAIL,
	"context-menu": CONTEXT_MENU_DETAIL,
	menubar: MENUBAR_DETAIL,
	command: COMMAND_DETAIL,
	combobox: COMBOBOX_DETAIL,
	"input-group": INPUT_GROUP_DETAIL,
	"aspect-ratio": ASPECT_RATIO_DETAIL,
	"scroll-area": SCROLL_AREA_DETAIL,
	"scroll-fade": SCROLL_FADE_DETAIL,
	attachment: ATTACHMENT_DETAIL,
	bubble: BUBBLE_DETAIL,
	marker: MARKER_DETAIL,
	message: MESSAGE_DETAIL,
	"message-scroller": MESSAGE_SCROLLER_DETAIL,
	questionnaire: QUESTIONNAIRE_DETAIL,
	resizable: RESIZABLE_DETAIL,
	direction: DIRECTION_DETAIL,
	"button-group": BUTTON_GROUP_DETAIL,
	alert: ALERT_DETAIL,
	slider: SLIDER_DETAIL,
	calendar: CALENDAR_DETAIL,
	carousel: CAROUSEL_DETAIL,
	chart: CHART_DETAIL,
	sidebar: SIDEBAR_DETAIL,
	sonner: SONNER_DETAIL,
	forms: FORMS_DETAIL,
	icon: ICON_DETAIL,
	"icon-tile": ICON_TILE_DETAIL,
	"inline-edit": INLINE_EDIT_DETAIL,
	banner: BANNER_DETAIL,
	blanket: BLANKET_DETAIL,
	comment: COMMENT_DETAIL,
	"date-label": DATE_LABEL_DETAIL,
	"date-picker": DATE_PICKER_DETAIL,
	lozenge: LOZENGE_DETAIL,
	"page-header": PAGE_HEADER_DETAIL,
	"progress-indicator": PROGRESS_INDICATOR_DETAIL,
	"progress-tracker": PROGRESS_TRACKER_DETAIL,
	tag: TAG_DETAIL,
	"time-picker": TIME_PICKER_DETAIL,
	tile: TILE_DETAIL,
	"date-time-picker": DATE_TIME_PICKER_DETAIL,
};
