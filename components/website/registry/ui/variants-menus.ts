import dynamic from "next/dynamic";
import type { ComponentType } from "react";

export const UI_MENU_VARIANT_DEMOS: Record<string, ComponentType> = {
	// Dropdown Menu
	"dropdown-menu-demo-search": dynamic(
		() => import("../../demos/ui/dropdown-menu-search-demo").then((mod) => ({ default: mod.DropdownMenuDemoSearch })),
		{ ssr: false },
	),
	"dropdown-menu-demo-default": dynamic(
		() =>
			import("../../demos/ui/dropdown-menu-demo").then((mod) => ({
				default: mod.DropdownMenuDemoDefault,
			})),
		{ ssr: false },
	),
	"dropdown-menu-demo-subheading": dynamic(
		() =>
			import("../../demos/ui/dropdown-menu-demo").then((mod) => ({
				default: mod.DropdownMenuDemoSubheading,
			})),
		{ ssr: false },
	),
	"dropdown-menu-demo-appearance": dynamic(
		() =>
			import("../../demos/ui/dropdown-menu-demo").then((mod) => ({
				default: mod.DropdownMenuDemoAppearance,
			})),
		{ ssr: false },
	),
	"dropdown-menu-demo-item-sizing": dynamic(
		() =>
			import("../../demos/ui/dropdown-menu-demo").then((mod) => ({
				default: mod.DropdownMenuDemoItemSizing,
			})),
		{ ssr: false },
	),
	"dropdown-menu-demo-tall": dynamic(
		() =>
			import("../../demos/ui/dropdown-menu-demo").then((mod) => ({
				default: mod.DropdownMenuDemoTall,
			})),
		{ ssr: false },
	),
	"dropdown-menu-demo-custom-triggers": dynamic(
		() =>
			import("../../demos/ui/dropdown-menu-demo").then((mod) => ({
				default: mod.DropdownMenuDemoCustomTriggers,
			})),
		{ ssr: false },
	),
	"dropdown-menu-demo-using-trigger": dynamic(
		() =>
			import("../../demos/ui/dropdown-menu-demo").then((mod) => ({
				default: mod.DropdownMenuDemoUsingTrigger,
			})),
		{ ssr: false },
	),
	"dropdown-menu-demo-nested-dropdown-menu": dynamic(
		() =>
			import("../../demos/ui/dropdown-menu-demo").then((mod) => ({
				default: mod.DropdownMenuDemoNestedDropdownMenu,
			})),
		{ ssr: false },
	),
	"dropdown-menu-demo-states": dynamic(
		() =>
			import("../../demos/ui/dropdown-menu-demo").then((mod) => ({
				default: mod.DropdownMenuDemoStates,
			})),
		{ ssr: false },
	),
	"dropdown-menu-demo-loading": dynamic(
		() =>
			import("../../demos/ui/dropdown-menu-demo").then((mod) => ({
				default: mod.DropdownMenuDemoLoading,
			})),
		{ ssr: false },
	),
	"dropdown-menu-demo-open": dynamic(
		() =>
			import("../../demos/ui/dropdown-menu-demo").then((mod) => ({
				default: mod.DropdownMenuDemoOpen,
			})),
		{ ssr: false },
	),
	"dropdown-menu-demo-positioning": dynamic(
		() =>
			import("../../demos/ui/dropdown-menu-demo").then((mod) => ({
				default: mod.DropdownMenuDemoPositioning,
			})),
		{ ssr: false },
	),
	"dropdown-menu-demo-default-placement": dynamic(
		() =>
			import("../../demos/ui/dropdown-menu-demo").then((mod) => ({
				default: mod.DropdownMenuDemoDefaultPlacement,
			})),
		{ ssr: false },
	),
	"dropdown-menu-demo-placement": dynamic(
		() =>
			import("../../demos/ui/dropdown-menu-demo").then((mod) => ({
				default: mod.DropdownMenuDemoPlacement,
			})),
		{ ssr: false },
	),
	"dropdown-menu-demo-should-flip": dynamic(
		() =>
			import("../../demos/ui/dropdown-menu-demo").then((mod) => ({
				default: mod.DropdownMenuDemoShouldFlip,
			})),
		{ ssr: false },
	),
	"dropdown-menu-demo-z-index": dynamic(
		() =>
			import("../../demos/ui/dropdown-menu-demo").then((mod) => ({
				default: mod.DropdownMenuDemoZIndex,
			})),
		{ ssr: false },
	),
	"dropdown-menu-demo-content-without-portal": dynamic(
		() =>
			import("../../demos/ui/dropdown-menu-demo").then((mod) => ({
				default: mod.DropdownMenuDemoContentWithoutPortal,
			})),
		{ ssr: false },
	),
	"dropdown-menu-demo-full-width-dropdown-menu": dynamic(
		() =>
			import("../../demos/ui/dropdown-menu-demo").then((mod) => ({
				default: mod.DropdownMenuDemoFullWidthDropdownMenu,
			})),
		{ ssr: false },
	),
	"dropdown-menu-demo-accessible-labels": dynamic(
		() =>
			import("../../demos/ui/dropdown-menu-demo").then((mod) => ({
				default: mod.DropdownMenuDemoAccessibleLabels,
			})),
		{ ssr: false },
	),
	"dropdown-menu-demo-item-description": dynamic(
		() =>
			import("../../demos/ui/dropdown-menu-demo").then((mod) => ({
				default: mod.DropdownMenuDemoItemDescription,
			})),
		{ ssr: false },
	),
	"dropdown-menu-demo-item-multiline": dynamic(
		() =>
			import("../../demos/ui/dropdown-menu-demo").then((mod) => ({
				default: mod.DropdownMenuDemoItemMultiline,
			})),
		{ ssr: false },
	),
	"dropdown-menu-demo-item-states": dynamic(
		() =>
			import("../../demos/ui/dropdown-menu-demo").then((mod) => ({
				default: mod.DropdownMenuDemoItemStates,
			})),
		{ ssr: false },
	),
	"dropdown-menu-demo-item-disabled": dynamic(
		() =>
			import("../../demos/ui/dropdown-menu-demo").then((mod) => ({
				default: mod.DropdownMenuDemoItemDisabled,
			})),
		{ ssr: false },
	),
	"dropdown-menu-demo-item-with-elements": dynamic(
		() =>
			import("../../demos/ui/dropdown-menu-demo").then((mod) => ({
				default: mod.DropdownMenuDemoItemWithElements,
			})),
		{ ssr: false },
	),
	"dropdown-menu-demo-item-elem-before": dynamic(
		() =>
			import("../../demos/ui/dropdown-menu-demo").then((mod) => ({
				default: mod.DropdownMenuDemoItemElemBefore,
			})),
		{ ssr: false },
	),
	"dropdown-menu-demo-item-elem-after": dynamic(
		() =>
			import("../../demos/ui/dropdown-menu-demo").then((mod) => ({
				default: mod.DropdownMenuDemoItemElemAfter,
			})),
		{ ssr: false },
	),
	"dropdown-menu-demo-item-custom-component": dynamic(
		() =>
			import("../../demos/ui/dropdown-menu-demo").then((mod) => ({
				default: mod.DropdownMenuDemoItemCustomComponent,
			})),
		{ ssr: false },
	),
	"dropdown-menu-demo-checkbox-default-selected": dynamic(
		() =>
			import("../../demos/ui/dropdown-menu-demo").then((mod) => ({
				default: mod.DropdownMenuDemoCheckboxDefaultSelected,
			})),
		{ ssr: false },
	),
	"dropdown-menu-demo-checkbox-selected": dynamic(
		() =>
			import("../../demos/ui/dropdown-menu-demo").then((mod) => ({
				default: mod.DropdownMenuDemoCheckboxSelected,
			})),
		{ ssr: false },
	),
	"dropdown-menu-demo-radio-default-selected": dynamic(
		() =>
			import("../../demos/ui/dropdown-menu-demo").then((mod) => ({
				default: mod.DropdownMenuDemoRadioDefaultSelected,
			})),
		{ ssr: false },
	),
	"dropdown-menu-demo-radio-selected": dynamic(
		() =>
			import("../../demos/ui/dropdown-menu-demo").then((mod) => ({
				default: mod.DropdownMenuDemoRadioSelected,
			})),
		{ ssr: false },
	),
	"dropdown-menu-demo-with-checkbox": dynamic(
		() =>
			import("../../demos/ui/dropdown-menu-demo").then((mod) => ({
				default: mod.DropdownMenuDemoWithCheckbox,
			})),
		{ ssr: false },
	),
	"dropdown-menu-demo-with-radio-group": dynamic(
		() =>
			import("../../demos/ui/dropdown-menu-demo").then((mod) => ({
				default: mod.DropdownMenuDemoWithRadioGroup,
			})),
		{ ssr: false },
	),
	// Context Menu
	"context-menu-demo-default": dynamic(
		() =>
			import("../../demos/ui/context-menu-demo").then((mod) => ({
				default: mod.ContextMenuDemoDefault,
			})),
		{ ssr: false },
	),
	"context-menu-demo-with-shortcuts": dynamic(
		() =>
			import("../../demos/ui/context-menu-demo").then((mod) => ({
				default: mod.ContextMenuDemoWithShortcuts,
			})),
		{ ssr: false },
	),
	"context-menu-demo-basic": dynamic(
		() =>
			import("../../demos/ui/context-menu-demo").then((mod) => ({
				default: mod.ContextMenuDemoBasic,
			})),
		{ ssr: false },
	),
	"context-menu-demo-in-dialog": dynamic(
		() =>
			import("../../demos/ui/context-menu-demo").then((mod) => ({
				default: mod.ContextMenuDemoInDialog,
			})),
		{ ssr: false },
	),
	"context-menu-demo-with-checkboxes": dynamic(
		() =>
			import("../../demos/ui/context-menu-demo").then((mod) => ({
				default: mod.ContextMenuDemoWithCheckboxes,
			})),
		{ ssr: false },
	),
	"context-menu-demo-with-destructive-items": dynamic(
		() =>
			import("../../demos/ui/context-menu-demo").then((mod) => ({
				default: mod.ContextMenuDemoWithDestructiveItems,
			})),
		{ ssr: false },
	),
	"context-menu-demo-with-groups-labels-separators": dynamic(
		() =>
			import("../../demos/ui/context-menu-demo").then((mod) => ({
				default: mod.ContextMenuDemoWithGroupsLabelsSeparators,
			})),
		{ ssr: false },
	),
	"context-menu-demo-with-icons": dynamic(
		() =>
			import("../../demos/ui/context-menu-demo").then((mod) => ({
				default: mod.ContextMenuDemoWithIcons,
			})),
		{ ssr: false },
	),
	"context-menu-demo-with-inset": dynamic(
		() =>
			import("../../demos/ui/context-menu-demo").then((mod) => ({
				default: mod.ContextMenuDemoWithInset,
			})),
		{ ssr: false },
	),
	"context-menu-demo-with-radio-group": dynamic(
		() =>
			import("../../demos/ui/context-menu-demo").then((mod) => ({
				default: mod.ContextMenuDemoWithRadioGroup,
			})),
		{ ssr: false },
	),
	"context-menu-demo-with-sides": dynamic(
		() =>
			import("../../demos/ui/context-menu-demo").then((mod) => ({
				default: mod.ContextMenuDemoWithSides,
			})),
		{ ssr: false },
	),
	"context-menu-demo-with-submenu": dynamic(
		() =>
			import("../../demos/ui/context-menu-demo").then((mod) => ({
				default: mod.ContextMenuDemoWithSubmenu,
			})),
		{ ssr: false },
	),
	// Menubar
	"menubar-demo-default": dynamic(
		() =>
			import("../../demos/ui/menubar-demo").then((mod) => ({
				default: mod.MenubarDemoDefault,
			})),
		{ ssr: false },
	),
	"menubar-demo-with-shortcuts": dynamic(
		() =>
			import("../../demos/ui/menubar-demo").then((mod) => ({
				default: mod.MenubarDemoWithShortcuts,
			})),
		{ ssr: false },
	),
	"menubar-demo-basic": dynamic(
		() =>
			import("../../demos/ui/menubar-demo").then((mod) => ({
				default: mod.MenubarDemoBasic,
			})),
		{ ssr: false },
	),
	"menubar-demo-destructive": dynamic(
		() =>
			import("../../demos/ui/menubar-demo").then((mod) => ({
				default: mod.MenubarDemoDestructive,
			})),
		{ ssr: false },
	),
	"menubar-demo-format": dynamic(
		() =>
			import("../../demos/ui/menubar-demo").then((mod) => ({
				default: mod.MenubarDemoFormat,
			})),
		{ ssr: false },
	),
	"menubar-demo-in-dialog": dynamic(
		() =>
			import("../../demos/ui/menubar-demo").then((mod) => ({
				default: mod.MenubarDemoInDialog,
			})),
		{ ssr: false },
	),
	"menubar-demo-insert": dynamic(
		() =>
			import("../../demos/ui/menubar-demo").then((mod) => ({
				default: mod.MenubarDemoInsert,
			})),
		{ ssr: false },
	),
	"menubar-demo-sides": dynamic(
		() =>
			import("../../demos/ui/menubar-demo").then((mod) => ({
				default: mod.MenubarDemoSides,
			})),
		{ ssr: false },
	),
	"menubar-demo-with-checkboxes": dynamic(
		() =>
			import("../../demos/ui/menubar-demo").then((mod) => ({
				default: mod.MenubarDemoWithCheckboxes,
			})),
		{ ssr: false },
	),
	"menubar-demo-with-icons": dynamic(
		() =>
			import("../../demos/ui/menubar-demo").then((mod) => ({
				default: mod.MenubarDemoWithIcons,
			})),
		{ ssr: false },
	),
	"menubar-demo-with-inset": dynamic(
		() =>
			import("../../demos/ui/menubar-demo").then((mod) => ({
				default: mod.MenubarDemoWithInset,
			})),
		{ ssr: false },
	),
	"menubar-demo-with-radio": dynamic(
		() =>
			import("../../demos/ui/menubar-demo").then((mod) => ({
				default: mod.MenubarDemoWithRadio,
			})),
		{ ssr: false },
	),
	"menubar-demo-with-submenu": dynamic(
		() =>
			import("../../demos/ui/menubar-demo").then((mod) => ({
				default: mod.MenubarDemoWithSubmenu,
			})),
		{ ssr: false },
	),
	// Command
	"command-demo-default": dynamic(
		() =>
			import("../../demos/ui/command-demo").then((mod) => ({
				default: mod.CommandDemoDefault,
			})),
		{ ssr: false },
	),
	"command-demo-empty": dynamic(
		() =>
			import("../../demos/ui/command-demo").then((mod) => ({
				default: mod.CommandDemoEmpty,
			})),
		{ ssr: false },
	),
	"command-demo-groups": dynamic(
		() =>
			import("../../demos/ui/command-demo").then((mod) => ({
				default: mod.CommandDemoGroups,
			})),
		{ ssr: false },
	),
	"command-demo-basic": dynamic(
		() =>
			import("../../demos/ui/command-demo").then((mod) => ({
				default: mod.CommandDemoBasic,
			})),
		{ ssr: false },
	),
	"command-demo-inline": dynamic(
		() =>
			import("../../demos/ui/command-demo").then((mod) => ({
				default: mod.CommandDemoInline,
			})),
		{ ssr: false },
	),
	"command-demo-many-groups-and-items": dynamic(
		() =>
			import("../../demos/ui/command-demo").then((mod) => ({
				default: mod.CommandDemoManyGroupsAndItems,
			})),
		{ ssr: false },
	),
	"command-demo-with-groups": dynamic(
		() =>
			import("../../demos/ui/command-demo").then((mod) => ({
				default: mod.CommandDemoWithGroups,
			})),
		{ ssr: false },
	),
	"command-demo-with-shortcuts": dynamic(
		() =>
			import("../../demos/ui/command-demo").then((mod) => ({
				default: mod.CommandDemoWithShortcuts,
			})),
		{ ssr: false },
	),
	// Combobox
	"combobox-demo-default": dynamic(
		() =>
			import("../../demos/ui/combobox-demo").then((mod) => ({
				default: mod.ComboboxDemoDefault,
			})),
		{ ssr: false },
	),
	"combobox-demo-grouped": dynamic(
		() =>
			import("../../demos/ui/combobox-demo").then((mod) => ({
				default: mod.ComboboxDemoGrouped,
			})),
		{ ssr: false },
	),
	"combobox-demo-basic": dynamic(
		() =>
			import("../../demos/ui/combobox-demo").then((mod) => ({
				default: mod.ComboboxDemoBasic,
			})),
		{ ssr: false },
	),
	"combobox-demo-disabled-items": dynamic(
		() =>
			import("../../demos/ui/combobox-demo").then((mod) => ({
				default: mod.ComboboxDemoDisabledItems,
			})),
		{ ssr: false },
	),
	"combobox-demo-disabled": dynamic(
		() =>
			import("../../demos/ui/combobox-demo").then((mod) => ({
				default: mod.ComboboxDemoDisabled,
			})),
		{ ssr: false },
	),
	"combobox-demo-form-with-combobox": dynamic(
		() =>
			import("../../demos/ui/combobox-demo").then((mod) => ({
				default: mod.ComboboxDemoFormWithCombobox,
			})),
		{ ssr: false },
	),
	"combobox-demo-in-dialog": dynamic(
		() =>
			import("../../demos/ui/combobox-demo").then((mod) => ({
				default: mod.ComboboxDemoInDialog,
			})),
		{ ssr: false },
	),
	"combobox-demo-in-popup": dynamic(
		() =>
			import("../../demos/ui/combobox-demo").then((mod) => ({
				default: mod.ComboboxDemoInPopup,
			})),
		{ ssr: false },
	),
	"combobox-demo-invalid": dynamic(
		() =>
			import("../../demos/ui/combobox-demo").then((mod) => ({
				default: mod.ComboboxDemoInvalid,
			})),
		{ ssr: false },
	),
	"combobox-demo-large-list": dynamic(
		() =>
			import("../../demos/ui/combobox-demo").then((mod) => ({
				default: mod.ComboboxDemoLargeList,
			})),
		{ ssr: false },
	),
	"combobox-demo-multiple-disabled": dynamic(
		() =>
			import("../../demos/ui/combobox-demo").then((mod) => ({
				default: mod.ComboboxDemoMultipleDisabled,
			})),
		{ ssr: false },
	),
	"combobox-demo-multiple-invalid": dynamic(
		() =>
			import("../../demos/ui/combobox-demo").then((mod) => ({
				default: mod.ComboboxDemoMultipleInvalid,
			})),
		{ ssr: false },
	),
	"combobox-demo-multiple-no-remove": dynamic(
		() =>
			import("../../demos/ui/combobox-demo").then((mod) => ({
				default: mod.ComboboxDemoMultipleNoRemove,
			})),
		{ ssr: false },
	),
	"combobox-demo-multiple": dynamic(
		() =>
			import("../../demos/ui/combobox-demo").then((mod) => ({
				default: mod.ComboboxDemoMultiple,
			})),
		{ ssr: false },
	),
	"combobox-demo-sides": dynamic(
		() =>
			import("../../demos/ui/combobox-demo").then((mod) => ({
				default: mod.ComboboxDemoSides,
			})),
		{ ssr: false },
	),
	"combobox-demo-with-auto-highlight": dynamic(
		() =>
			import("../../demos/ui/combobox-demo").then((mod) => ({
				default: mod.ComboboxDemoWithAutoHighlight,
			})),
		{ ssr: false },
	),
	"combobox-demo-with-clear-button": dynamic(
		() =>
			import("../../demos/ui/combobox-demo").then((mod) => ({
				default: mod.ComboboxDemoWithClearButton,
			})),
		{ ssr: false },
	),
	"combobox-demo-with-custom-item-rendering": dynamic(
		() =>
			import("../../demos/ui/combobox-demo").then((mod) => ({
				default: mod.ComboboxDemoWithCustomItemRendering,
			})),
		{ ssr: false },
	),
	"combobox-demo-with-groups-and-separator": dynamic(
		() =>
			import("../../demos/ui/combobox-demo").then((mod) => ({
				default: mod.ComboboxDemoWithGroupsAndSeparator,
			})),
		{ ssr: false },
	),
	"combobox-demo-with-groups": dynamic(
		() =>
			import("../../demos/ui/combobox-demo").then((mod) => ({
				default: mod.ComboboxDemoWithGroups,
			})),
		{ ssr: false },
	),
	"combobox-demo-with-icon-addon": dynamic(
		() =>
			import("../../demos/ui/combobox-demo").then((mod) => ({
				default: mod.ComboboxDemoWithIconAddon,
			})),
		{ ssr: false },
	),
	"combobox-demo-with-other-inputs": dynamic(
		() =>
			import("../../demos/ui/combobox-demo").then((mod) => ({
				default: mod.ComboboxDemoWithOtherInputs,
			})),
		{ ssr: false },
	),
	// Input Group
	"input-group-demo-default": dynamic(
		() =>
			import("../../demos/ui/input-group-demo").then((mod) => ({
				default: mod.InputGroupDemoDefault,
			})),
		{ ssr: false },
	),
	"input-group-demo-prefix": dynamic(
		() =>
			import("../../demos/ui/input-group-demo").then((mod) => ({
				default: mod.InputGroupDemoPrefix,
			})),
		{ ssr: false },
	),
	"input-group-demo-button": dynamic(
		() =>
			import("../../demos/ui/input-group-demo").then((mod) => ({
				default: mod.InputGroupDemoButton,
			})),
		{ ssr: false },
	),
	"input-group-demo-textarea": dynamic(
		() =>
			import("../../demos/ui/input-group-demo").then((mod) => ({
				default: mod.InputGroupDemoTextarea,
			})),
		{ ssr: false },
	),
	"input-group-demo-basic": dynamic(
		() =>
			import("../../demos/ui/input-group-demo").then((mod) => ({
				default: mod.InputGroupDemoBasic,
			})),
		{ ssr: false },
	),
	"input-group-demo-in-card": dynamic(
		() =>
			import("../../demos/ui/input-group-demo").then((mod) => ({
				default: mod.InputGroupDemoInCard,
			})),
		{ ssr: false },
	),
	"input-group-demo-with-addons": dynamic(
		() =>
			import("../../demos/ui/input-group-demo").then((mod) => ({
				default: mod.InputGroupDemoWithAddons,
			})),
		{ ssr: false },
	),
	"input-group-demo-with-buttons": dynamic(
		() =>
			import("../../demos/ui/input-group-demo").then((mod) => ({
				default: mod.InputGroupDemoWithButtons,
			})),
		{ ssr: false },
	),
	"input-group-demo-with-kbd": dynamic(
		() =>
			import("../../demos/ui/input-group-demo").then((mod) => ({
				default: mod.InputGroupDemoWithKbd,
			})),
		{ ssr: false },
	),
	"input-group-demo-with-tooltip-dropdown-popover": dynamic(
		() =>
			import("../../demos/ui/input-group-demo").then((mod) => ({
				default: mod.InputGroupDemoWithTooltipDropdownPopover,
			})),
		{ ssr: false },
	),
	// Aspect Ratio
	"aspect-ratio-demo-default": dynamic(
		() =>
			import("../../demos/ui/aspect-ratio-demo").then((mod) => ({
				default: mod.AspectRatioDemoDefault,
			})),
		{ ssr: false },
	),
	"aspect-ratio-demo-square": dynamic(
		() =>
			import("../../demos/ui/aspect-ratio-demo").then((mod) => ({
				default: mod.AspectRatioDemoSquare,
			})),
		{ ssr: false },
	),
	"aspect-ratio-demo-16x9": dynamic(
		() =>
			import("../../demos/ui/aspect-ratio-demo").then((mod) => ({
				default: mod.AspectRatioDemo16x9,
			})),
		{ ssr: false },
	),
	"aspect-ratio-demo-1x1": dynamic(
		() =>
			import("../../demos/ui/aspect-ratio-demo").then((mod) => ({
				default: mod.AspectRatioDemo1x1,
			})),
		{ ssr: false },
	),
	"aspect-ratio-demo-21x9": dynamic(
		() =>
			import("../../demos/ui/aspect-ratio-demo").then((mod) => ({
				default: mod.AspectRatioDemo21x9,
			})),
		{ ssr: false },
	),
	"aspect-ratio-demo-9x16": dynamic(
		() =>
			import("../../demos/ui/aspect-ratio-demo").then((mod) => ({
				default: mod.AspectRatioDemo9x16,
			})),
		{ ssr: false },
	),
	// Scroll Area
	"scroll-area-demo-default": dynamic(
		() =>
			import("../../demos/ui/scroll-area-demo").then((mod) => ({
				default: mod.ScrollAreaDemoDefault,
			})),
		{ ssr: false },
	),
	"scroll-area-demo-horizontal": dynamic(
		() =>
			import("../../demos/ui/scroll-area-demo").then((mod) => ({
				default: mod.ScrollAreaDemoHorizontal,
			})),
		{ ssr: false },
	),
	"scroll-area-demo-vertical": dynamic(
		() =>
			import("../../demos/ui/scroll-area-demo").then((mod) => ({
				default: mod.ScrollAreaDemoVertical,
			})),
		{ ssr: false },
	),
	// Scroll Fade
	"scroll-fade-demo-default": dynamic(
		() =>
			import("../../demos/ui/scroll-fade-demo").then((mod) => ({
				default: mod.ScrollFadeDemoDefault,
			})),
		{ ssr: false },
	),
	"scroll-fade-demo-horizontal": dynamic(
		() =>
			import("../../demos/ui/scroll-fade-demo").then((mod) => ({
				default: mod.ScrollFadeDemoHorizontal,
			})),
		{ ssr: false },
	),
	"scroll-fade-demo-single-edge": dynamic(
		() =>
			import("../../demos/ui/scroll-fade-demo").then((mod) => ({
				default: mod.ScrollFadeDemoSingleEdge,
			})),
		{ ssr: false },
	),
	"scroll-fade-demo-size": dynamic(
		() =>
			import("../../demos/ui/scroll-fade-demo").then((mod) => ({
				default: mod.ScrollFadeDemoSize,
			})),
		{ ssr: false },
	),
	"scroll-fade-demo-reveal": dynamic(
		() =>
			import("../../demos/ui/scroll-fade-demo").then((mod) => ({
				default: mod.ScrollFadeDemoReveal,
			})),
		{ ssr: false },
	),
	"scroll-fade-demo-render": dynamic(
		() =>
			import("../../demos/ui/scroll-fade-demo").then((mod) => ({
				default: mod.ScrollFadeDemoRender,
			})),
		{ ssr: false },
	),
	// Resizable
	"resizable-demo-default": dynamic(
		() =>
			import("../../demos/ui/resizable-demo").then((mod) => ({
				default: mod.ResizableDemoDefault,
			})),
		{ ssr: false },
	),
	"resizable-demo-vertical": dynamic(
		() =>
			import("../../demos/ui/resizable-demo").then((mod) => ({
				default: mod.ResizableDemoVertical,
			})),
		{ ssr: false },
	),
	"resizable-demo-with-handle": dynamic(
		() =>
			import("../../demos/ui/resizable-demo").then((mod) => ({
				default: mod.ResizableDemoWithHandle,
			})),
		{ ssr: false },
	),
	"resizable-demo-controlled": dynamic(
		() =>
			import("../../demos/ui/resizable-demo").then((mod) => ({
				default: mod.ResizableDemoControlled,
			})),
		{ ssr: false },
	),
	"resizable-demo-horizontal": dynamic(
		() =>
			import("../../demos/ui/resizable-demo").then((mod) => ({
				default: mod.ResizableDemoHorizontal,
			})),
		{ ssr: false },
	),
	"resizable-demo-nested": dynamic(
		() =>
			import("../../demos/ui/resizable-demo").then((mod) => ({
				default: mod.ResizableDemoNested,
			})),
		{ ssr: false },
	),
	// Direction
	"direction-demo-default": dynamic(
		() =>
			import("../../demos/ui/direction-demo").then((mod) => ({
				default: mod.DirectionDemoDefault,
			})),
		{ ssr: false },
	),
	"direction-demo-rtl": dynamic(
		() =>
			import("../../demos/ui/direction-demo").then((mod) => ({
				default: mod.DirectionDemoRtl,
			})),
		{ ssr: false },
	),
};
