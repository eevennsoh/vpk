import type { ComponentDetail } from "@/app/data/component-detail-types";

export const TABS_DETAIL: ComponentDetail = {
    description:
      "A tabbed interface component with configurable orientations and visual variants. Built on Base UI TabsPrimitive.",
    adsUrl: "https://atlassian.design/components/tabs",
    usage: `import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">First</TabsTrigger>
    <TabsTrigger value="tab2">Second</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Content 1</TabsContent>
  <TabsContent value="tab2">Content 2</TabsContent>
</Tabs>`,
    props: [
      {
        name: "orientation",
        type: '"horizontal" | "vertical"',
        default: '"horizontal"',
        description: "Tab layout direction.",
      },
      {
        name: "defaultValue",
        type: "string",
        description: "Initially active tab value.",
      },
    ],
    subComponents: [
      { name: "TabsList", description: "Container for tab triggers." },
      { name: "TabsTrigger", description: "Individual tab button." },
      { name: "TabsContent", description: "Panel content for each tab." },
    ],
    examples: [
      {
        title: "Default",
        description: "Basic tabbed interface with pill-style tabs.",
        demoSlug: "tabs-demo-default",
      },
      {
        title: "Compact",
        description: "A 24px pill-style tab list with an inset selected tab.",
        demoSlug: "tabs-demo-compact",
      },
      {
        title: "Line variant",
        description: "Line tabs with a sliding indicator enabled by the animateIndicator prop on TabsList.",
        demoSlug: "tabs-demo-line",
      },
      {
        title: "Line full width",
        description: "Line tabs whose grey separator spans the list.",
        demoSlug: "tabs-demo-line-full-width",
      },
      {
        title: "Vertical",
        description: "Vertically-oriented tabs.",
        demoSlug: "tabs-demo-vertical",
      },
      {
        title: "Disabled",
        description: "Tab with disabled trigger.",
        demoSlug: "tabs-demo-disabled",
      },
      { title: "Basic", demoSlug: "tabs-demo-basic" },
      {
        title: "Icon only",
        description: "Tabs with icon-only triggers.",
        demoSlug: "tabs-demo-icon-only",
      },
      {
        title: "Line disabled",
        description: "Line variant with disabled trigger.",
        demoSlug: "tabs-demo-line-disabled",
      },
      {
        title: "Line with content",
        description: "Line variant with tab panel content.",
        demoSlug: "tabs-demo-line-with-content",
      },
      {
        title: "Multiple",
        description: "Multiple tab groups stacked.",
        demoSlug: "tabs-demo-multiple",
      },
      {
        title: "Variants alignment",
        description: "All variants with alignment options.",
        demoSlug: "tabs-demo-variants-alignment",
      },
      {
        title: "With content",
        description: "Tabs with panel content.",
        demoSlug: "tabs-demo-with-content",
      },
      {
        title: "With dropdown",
        description: "Tabs with dropdown overflow menu.",
        demoSlug: "tabs-demo-with-dropdown",
      },
      {
        title: "With icons",
        description: "Tabs with icon and text triggers.",
        demoSlug: "tabs-demo-with-icons",
      },
      {
        title: "With input and button",
        description: "Tabs combined with input and button.",
        demoSlug: "tabs-demo-with-input-and-button",
      },
    ],
  };
