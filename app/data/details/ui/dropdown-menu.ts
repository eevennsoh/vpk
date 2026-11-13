import type { ComponentDetail } from "@/app/data/component-detail-types";

export const DROPDOWN_MENU_DETAIL: ComponentDetail = {
    description:
      "An ADS-aligned dropdown menu built on Base UI Menu with item descriptions, element slots, checkbox/radio selections, placement controls, and optional non-portal rendering.",
    adsUrl: "https://atlassian.design/components/dropdown-menu",
    usage: `import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

<DropdownMenu>
  <DropdownMenuTrigger render={<Button variant="outline" size="default" />}>
    Open
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Profile</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem>Settings</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>`,
    props: [
      {
        name: "spacing",
        type: '"compact" | "spacious"',
        default: '"compact"',
        description: "Menu content inset: 6px compact or 8px spacious.",
      },
      {
        name: "variant",
        type: '"default" | "destructive"',
        default: '"default"',
        description: "Visual variant of menu items.",
      },
      {
        name: "inset",
        type: "boolean",
        description: "Adds left padding for icon alignment.",
      },
      {
        name: "elemBefore",
        type: "ReactNode",
        description: "Element before item text.",
      },
      {
        name: "elemAfter",
        type: "ReactNode",
        description: "Element after item text.",
      },
      {
        name: "description",
        type: "string",
        description: "Secondary supporting text for menu items.",
      },
      {
        name: "portalled",
        type: "boolean",
        default: "true",
        description:
          "Render menu content in a portal or inline with the trigger container.",
      },
      {
        name: "side",
        type: '"top" | "right" | "bottom" | "left" | "inline-start" | "inline-end"',
        default: '"bottom"',
        description: "Popup side relative to trigger.",
      },
      {
        name: "align",
        type: '"start" | "center" | "end"',
        default: '"start"',
        description: "Popup alignment on the selected side.",
      },
    ],
    subComponents: [
      {
        name: "DropdownMenuTrigger",
        description: "Element that opens the menu.",
      },
      { name: "DropdownMenuContent", description: "Floating menu container." },
      { name: "DropdownMenuItem", description: "Individual menu item." },
      {
        name: "DropdownMenuCheckboxItem",
        description: "Toggleable checkbox item.",
      },
      { name: "DropdownMenuRadioGroup", description: "Radio group container." },
      { name: "DropdownMenuRadioItem", description: "Radio selection item." },
      { name: "DropdownMenuLabel", description: "Group label." },
      { name: "DropdownMenuSeparator", description: "Visual separator." },
      { name: "DropdownMenuShortcut", description: "Keyboard shortcut text." },
      { name: "DropdownMenuSub", description: "Sub-menu container." },
      {
        name: "DropdownMenuSubTrigger",
        description: "Element that opens sub-menu.",
      },
      { name: "DropdownMenuSubContent", description: "Sub-menu content." },
    ],
    examples: [
      {
        title: "Appearance",
        description: "Default and tall menu appearances.",
        demoSlug: "dropdown-menu-demo-appearance",
      },
      {
        title: "Default",
        description: "Basic dropdown menu.",
        demoSlug: "dropdown-menu-demo-default",
      },
      {
        title: "Density",
        description: "Spacious and compact menu insets.",
        demoSlug: "dropdown-menu-demo-density",
      },
      {
        title: "Tall",
        description: "Large viewport-height menu behavior.",
        demoSlug: "dropdown-menu-demo-tall",
      },
      {
        title: "Custom triggers",
        description: "Icon-only and custom trigger elements.",
        demoSlug: "dropdown-menu-demo-custom-triggers",
      },
      {
        title: "Using trigger",
        description: "Simple trigger content usage.",
        demoSlug: "dropdown-menu-demo-using-trigger",
      },
      {
        title: "Nested dropdown menu",
        description: "Sub-menu and nested sub-menu behavior.",
        demoSlug: "dropdown-menu-demo-nested-dropdown-menu",
      },
      {
        title: "States",
        description:
          "Default, hovered, pressed, destructive, and disabled item states.",
        demoSlug: "dropdown-menu-demo-states",
      },
      {
        title: "Loading",
        description: "Loading row treatment inside a menu.",
        demoSlug: "dropdown-menu-demo-loading",
      },
      {
        title: "Open",
        description: "Controlled open state.",
        demoSlug: "dropdown-menu-demo-open",
      },
      {
        title: "Positioning",
        description: "Positioning across different side/alignment settings.",
        demoSlug: "dropdown-menu-demo-positioning",
      },
      {
        title: "Default placement",
        description: "Default popup placement.",
        demoSlug: "dropdown-menu-demo-default-placement",
      },
      {
        title: "Placement",
        description: "Explicit side placement examples.",
        demoSlug: "dropdown-menu-demo-placement",
      },
      {
        title: "Should flip",
        description: "Viewport edge flip behavior.",
        demoSlug: "dropdown-menu-demo-should-flip",
      },
      {
        title: "Z-index",
        description: "Overlay stacking behavior.",
        demoSlug: "dropdown-menu-demo-z-index",
      },
      {
        title: "Content without portal",
        description: "Inline popup rendering with `portalled={false}`.",
        demoSlug: "dropdown-menu-demo-content-without-portal",
      },
      {
        title: "Full width dropdown menu",
        description: "Popup width aligned with trigger width.",
        demoSlug: "dropdown-menu-demo-full-width-dropdown-menu",
      },
      {
        title: "Accessible labels",
        description: "Icon-only triggers with explicit accessible labels.",
        demoSlug: "dropdown-menu-demo-accessible-labels",
      },
      {
        title: "Description",
        description: "Dropdown item with secondary description text.",
        demoSlug: "dropdown-menu-demo-item-description",
      },
      {
        title: "Multiline",
        description: "Dropdown item wrapping across multiple lines.",
        demoSlug: "dropdown-menu-demo-item-multiline",
      },
      {
        title: "States (dropdown item)",
        description: "Dropdown item state styling.",
        demoSlug: "dropdown-menu-demo-item-states",
      },
      {
        title: "Disabled (dropdown item)",
        description: "Disabled dropdown item treatment.",
        demoSlug: "dropdown-menu-demo-item-disabled",
      },
      {
        title: "With elements",
        description: "Dropdown item with leading and trailing elements.",
        demoSlug: "dropdown-menu-demo-item-with-elements",
      },
      {
        title: "Elem before",
        description: "Leading element slot usage.",
        demoSlug: "dropdown-menu-demo-item-elem-before",
      },
      {
        title: "Elem after",
        description: "Trailing element slot usage.",
        demoSlug: "dropdown-menu-demo-item-elem-after",
      },
      {
        title: "Custom component",
        description: "Dropdown item rendered as a custom component.",
        demoSlug: "dropdown-menu-demo-item-custom-component",
      },
      {
        title: "Default selected (checkbox)",
        description: "Checkbox items with uncontrolled default selection.",
        demoSlug: "dropdown-menu-demo-checkbox-default-selected",
      },
      {
        title: "Selected (checkbox)",
        description: "Checkbox items with controlled selection.",
        demoSlug: "dropdown-menu-demo-checkbox-selected",
      },
      {
        title: "Default selected (radio)",
        description: "Radio items with uncontrolled default selection.",
        demoSlug: "dropdown-menu-demo-radio-default-selected",
      },
      {
        title: "Selected (radio)",
        description: "Radio items with controlled selection.",
        demoSlug: "dropdown-menu-demo-radio-selected",
      },
      {
        title: "With Checkbox component",
        description:
          "Dropdown items composed with VPK Checkbox for richer toggle controls.",
        demoSlug: "dropdown-menu-demo-with-checkbox",
      },
      {
        title: "With RadioGroup component",
        description:
          "Dropdown items composed with VPK RadioGroup for richer radio controls.",
        demoSlug: "dropdown-menu-demo-with-radio-group",
      },
    ],
  };
