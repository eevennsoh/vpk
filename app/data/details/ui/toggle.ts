import type { ComponentDetail } from "@/app/data/component-detail-types";

export const TOGGLE_DETAIL: ComponentDetail = {
    description:
      "A toggle button component built on Base UI with variant and size options for toolbar-style interactions.",
    usage: `import { Toggle } from "@/components/ui/toggle";
import { BoldIcon } from "@/components/ui/vpk-icons";

<Toggle aria-label="Toggle bold">
  <BoldIcon className="size-4" />
</Toggle>`,
    props: [
      {
        name: "variant",
        type: '"default" | "subtle" | "outline"',
        default: '"default"',
        description: "Visual style variant. Subtle uses darker text and icons when pressed, without a persistent selected background.",
      },
      {
        name: "size",
        type: '"default" | "sm" | "lg"',
        default: '"default"',
        description: "Size of the toggle.",
      },
      {
        name: "pressed",
        type: "boolean",
        description: "Controlled pressed state.",
      },
      {
        name: "defaultPressed",
        type: "boolean",
        description: "Default pressed state.",
      },
    ],
    examples: [
      { title: "Default", demoSlug: "toggle-demo-default" },
      {
        title: "Outline",
        description: "Outline variant.",
        demoSlug: "toggle-demo-outline",
      },
      {
        title: "With text",
        description: "Toggle with icon and text.",
        demoSlug: "toggle-demo-with-text",
      },
      {
        title: "Sizes",
        description: "Small, default, and large toggles.",
        demoSlug: "toggle-demo-sizes",
      },
      { title: "Basic", demoSlug: "toggle-demo-basic" },
      { title: "Disabled", demoSlug: "toggle-demo-disabled" },
      {
        title: "With button icon and text",
        description: "Toggle button with icon and text.",
        demoSlug: "toggle-demo-with-button-icon-text",
      },
      {
        title: "With button icon",
        description: "Toggle button with icon only.",
        demoSlug: "toggle-demo-with-button-icon",
      },
      {
        title: "With button text",
        description: "Toggle button with text only.",
        demoSlug: "toggle-demo-with-button-text",
      },
      {
        title: "With icon",
        description: "Toggle with icon.",
        demoSlug: "toggle-demo-with-icon",
      },
    ],
  };
