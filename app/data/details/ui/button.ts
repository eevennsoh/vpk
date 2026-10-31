import type { ComponentDetail } from "@/app/data/component-detail-types";

export const BUTTON_DETAIL: ComponentDetail = {
    description:
      "A styled button component extending Base UI's ButtonPrimitive with configurable variants, icon-only sizes, and anchor rendering for link-style actions.",
    adsUrl: "https://atlassian.design/components/button/",
    adsLinks: [
      {
        label: "{ Button } from @atlaskit/button/new",
        url: "https://atlassian.design/components/button/",
      },
      {
        label: "{ IconButton } from @atlaskit/button/new",
        url: "https://atlassian.design/components/button/icon-button/",
      },
    ],
    usage: `import { Button } from "@/components/ui/button";

<Button>
  Click me
</Button>

<Button variant="outline" size="compact">
  Compact outline
</Button>

<Button variant="ghost" size="icon" aria-label="Search">
  <SearchIcon />
</Button>

<Button nativeButton={false} render={<a href="/settings" />}>
  Settings
</Button>`,
    props: [
      {
        name: "variant",
        type: '"default" | "outline" | "secondary" | "ghost" | "disclosure" | "destructive" | "link" | "warning" | "discovery"',
        default: '"default"',
        description: "Visual style variant. Disclosure uses an opaque surface and neutral expanded state for card-border controls.",
      },
      {
        name: "size",
        type: '"default" | "compact" | "disclosure" | "icon" | "icon-compact"',
        default: '"default"',
        description: "Default is 32px tall; compact is 24px. Disclosure is a 24px pill with 12px regular text and 8px inline padding.",
      },
      {
        name: "isLoading",
        type: "boolean",
        default: "false",
        description: "Shows a spinner and disables interaction.",
      },
      {
        name: "nativeButton",
        type: "boolean",
        default: "true",
        description:
          "When false, render as a non-button element (for example an anchor).",
      },
      {
        name: "render",
        type: "React.ReactElement",
        description: "Element to render when using non-native button mode.",
      },
      {
        name: "className",
        type: "string",
        description: "Additional CSS classes.",
      },
    ],
    examples: [
      { title: "Default", demoSlug: "button-demo-default" },
      { title: "Secondary", demoSlug: "button-demo-secondary" },
      { title: "Outline", demoSlug: "button-demo-outline" },
      { title: "Ghost", demoSlug: "button-demo-ghost" },
      { title: "Destructive", demoSlug: "button-demo-destructive" },
      { title: "Link", demoSlug: "button-demo-link" },
      {
        title: "All variants",
        description: "All button variants side by side.",
        demoSlug: "button-demo-variants",
      },
      {
        title: "Sizes",
        description: "Compact 24px and default 32px text and icon button sizes.",
        demoSlug: "button-demo-sizes",
      },
      {
        title: "With icon",
        description: "Icon before text, after text, and icon-only.",
        demoSlug: "button-demo-with-icon",
      },
      {
        title: "Loading",
        description: "Loading state with spinner overlay.",
        demoSlug: "button-demo-loading",
      },
      {
        title: "Disabled",
        description: "All variants in disabled state.",
        demoSlug: "button-demo-disabled",
      },
      {
        title: "Full width",
        description: "Button stretched to fill container width.",
        demoSlug: "button-demo-full-width",
      },
      {
        title: "Icon left",
        description: "Icon before text across compact and default sizes.",
        demoSlug: "button-demo-icon-left",
      },
      {
        title: "Icon right",
        description: "Icon after text across compact and default sizes.",
        demoSlug: "button-demo-icon-right",
      },
      {
        title: "Icon only",
        description: "Icon-only buttons across compact and default sizes.",
        demoSlug: "button-demo-icon-only",
      },
      {
        title: "Invalid states",
        description: "All variants in invalid/error state.",
        demoSlug: "button-demo-invalid-states",
      },
      {
        title: "Selected",
        description: "Pressed/selected state across variants.",
        demoSlug: "button-demo-selected",
      },
      {
        title: "Usage patterns",
        description: "Common button usage patterns.",
        demoSlug: "button-demo-usage",
      },
      {
        title: "Variants and sizes",
        description: "Full matrix of all variants across compact and default sizes.",
        demoSlug: "button-demo-variants-and-sizes",
      },
    ],
  };
