import type { ComponentDetail } from "@/app/data/component-detail-types";

export const EMPTY_DETAIL: ComponentDetail = {
    description:
      "An empty state component with header, media, title, description, and action slots for zero-data scenarios. Maps to @atlaskit/empty-state.",
    adsUrl: "https://atlassian.design/components/empty-state",
    usage: `import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia, EmptyContent } from "@/components/ui/empty";

<Empty>
  <EmptyHeader>
    <EmptyMedia variant="icon"><SearchIcon label="" /></EmptyMedia>
    <EmptyTitle>No results found</EmptyTitle>
    <EmptyDescription>Try adjusting your search.</EmptyDescription>
  </EmptyHeader>
  <EmptyContent>
    <Button>Create new</Button>
  </EmptyContent>
</Empty>`,
    props: [
      {
        name: "width",
        type: `"wide" | "narrow"`,
        description:
          "Controls max-width. Wide (464px, default) or narrow (304px). Ignored when orientation is horizontal.",
      },
      {
        name: "orientation",
        type: `"vertical" | "horizontal"`,
        description:
          "Layout direction. Vertical (default) stacks media above centered text. Horizontal places media on the leading edge with left-aligned text and actions, collapsing back to vertical below the sm breakpoint.",
      },
    ],
    subComponents: [
      { name: "EmptyHeader", description: "Top section with media and text." },
      {
        name: "EmptyBody",
        description:
          "Groups text and actions together so, in the horizontal orientation, the actions wrap directly under the text (aligned to it) instead of relative to the leading media.",
      },
      {
        name: "EmptyMedia",
        description:
          'Icon or image slot. Use variant="icon" for icon backgrounds.',
      },
      {
        name: "EmptyTitle",
        description:
          'Primary heading (h4). Accepts headingSize: "medium" (default) or "xsmall".',
      },
      { name: "EmptyDescription", description: "Secondary description text." },
      {
        name: "EmptyContent",
        description: "Action area for buttons and links.",
      },
    ],
    examples: [
      {
        title: "Default",
        description: "Basic empty state with heading and description.",
        demoSlug: "empty-demo-default",
      },
      {
        title: "With primary action",
        description: "Empty state with a call-to-action button.",
        demoSlug: "empty-demo-with-action",
      },
      {
        title: "With primary and secondary actions",
        description: "Empty state with two action buttons.",
        demoSlug: "empty-demo-with-actions",
      },
      {
        title: "With image",
        description: "Empty state with an illustration image.",
        demoSlug: "empty-demo-with-image",
      },
      {
        title: "With image horizontal",
        description:
          "Single-row layout: image, text, then secondary and primary actions pushed to the far right. Collapses to the vertical stack on small screens.",
        demoSlug: "empty-demo-with-image-horizontal",
      },
      {
        title: "With icon",
        description: "Empty state with icon media.",
        demoSlug: "empty-demo-with-icon",
      },
      {
        title: "Narrow width",
        description: "Empty state in narrow width mode for compact contexts.",
        demoSlug: "empty-demo-narrow",
      },
      {
        title: "Compact heading",
        description: "Empty state with xsmall heading size for popups.",
        demoSlug: "empty-demo-compact",
      },
      {
        title: "Compact heading with icon",
        description: "Compact search empty state with icon media and no action.",
        demoSlug: "empty-demo-compact-with-icon",
      },
      {
        title: "With tertiary action",
        description: "Empty state with a link-style tertiary action.",
        demoSlug: "empty-demo-with-tertiary",
      },
    ],
  };
