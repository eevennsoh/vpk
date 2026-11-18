import type { ComponentDetail } from "@/app/data/component-detail-types";

export const BUBBLE_DETAIL: ComponentDetail = {
    description:
      "A chat bubble primitive with ADS-tokenized variants, polymorphic content, alignment, grouping, and reaction overlays.",
    usage: `import { Bubble, BubbleContent } from "@/components/ui/bubble";

<Bubble align="end">
  <BubbleContent>Can you review this change?</BubbleContent>
</Bubble>`,
    props: [
      {
        name: "variant",
        type: '"default" | "primary" | "secondary" | "muted" | "tinted" | "outline" | "ghost" | "destructive"',
        default: '"default"',
        description: "Visual treatment for bubble content.",
      },
      {
        name: "align",
        type: '"start" | "end"',
        default: '"start"',
        description: "Aligns the bubble within a message row.",
      },
    ],
    subComponents: [
      { name: "BubbleGroup", description: "Vertical stack of bubbles." },
      { name: "BubbleContent", description: "Bubble body, with render support." },
      { name: "BubbleReactions", description: "Reaction overlay positioned on a bubble." },
    ],
    examples: [
      { title: "Sizes", demoSlug: "bubble-demo-sizes" },
      { title: "Variants", demoSlug: "bubble-demo-variants" },
      { title: "Alignment", demoSlug: "bubble-demo-alignment" },
      { title: "Grouped", demoSlug: "bubble-demo-grouped" },
      { title: "Collapsible", demoSlug: "bubble-demo-collapsible" },
      { title: "Button & Links", id: "button-links", demoSlug: "bubble-demo-button-links" },
      { title: "Reaction Placement", demoSlug: "bubble-demo-reaction-placement" },
      { title: "Reactions Buttons", demoSlug: "bubble-demo-reactions-buttons" },
    ],
  };
