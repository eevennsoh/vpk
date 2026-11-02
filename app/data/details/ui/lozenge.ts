import type { ComponentDetail } from "@/app/data/component-detail-types";

export const LOZENGE_DETAIL: ComponentDetail = {
    description:
      "A compact status indicator for categorical labels, statuses, and light metadata. Matches the latest ADS filled lozenge visuals with semantic and accent color variants plus compact and spacious sizes.",
    adsUrl: "https://atlassian.design/components/lozenge",
    usage: `import { Lozenge } from "@/components/ui/lozenge";

<Lozenge>Neutral</Lozenge>
<Lozenge variant="information">In progress</Lozenge>
<Lozenge variant="success" trailingMetric="0.8">Completed</Lozenge>`,
    props: [
      {
        name: "appearance (LozengeDropdownTrigger)",
        type: '"lozenge" | "icon" | "text"',
        default: '"lozenge"',
        description: "Dropdown trigger presentation: filled lozenge, compact icon, or plain icon and text. Icon-only triggers require an accessible label.",
      },
      {
        name: "variant",
        type: '"neutral" | "success" | "danger" | "information" | "discovery" | "warning" | "accent-red" | "accent-orange" | "accent-yellow" | "accent-lime" | "accent-green" | "accent-teal" | "accent-blue" | "accent-purple" | "accent-magenta" | "accent-gray"',
        default: '"neutral"',
        description: "Visual variant of the lozenge.",
      },
      {
        name: "size",
        type: '"compact" | "spacious"',
        default: '"compact"',
        description: "Size variant controlling height, padding, and font size.",
      },
      {
        name: "isBold",
        type: "boolean",
        default: "false",
        description:
          "Deprecated compatibility prop. ADS now renders the filled lozenge appearance by default.",
      },
      {
        name: "elemBefore",
        type: "ReactNode",
        description:
          "Element rendered before the lozenge text. A plain `<Icon>` is tinted to the variant tone; a logo, `IconTile`, `BrandLogoMark`, or avatar is rendered verbatim (keeping its own colors) in a fixed leading box.",
      },
      {
        name: "icon",
        type: "ReactNode",
        description:
          "Deprecated alias for `elemBefore`, kept for back-compat. Optional leading icon element.",
      },
      {
        name: "maxWidth",
        type: "string | number",
        description: "Maximum width before text truncation.",
      },
      {
        name: "metric",
        type: "string | number",
        description:
          "Deprecated local alias for `trailingMetric`.",
      },
      {
        name: "trailingMetric",
        type: "string | number",
        description:
          "Trailing metric rendered as an embedded Badge. Semantic variants map metrics to bold Badge appearances; accent variants fall back to neutral to match ADS guidance.",
      },
    ],
    examples: [
      { title: "Default", demoSlug: "lozenge-demo-default" },
      { title: "Appearance", demoSlug: "lozenge-demo-appearances" },
      { title: "Accent colors", demoSlug: "lozenge-demo-accent-colors" },
      { title: "With icon", demoSlug: "lozenge-demo-with-icon" },
      {
        title: "Front slot",
        description:
          "Leading product logo and 2P/3P public-logo examples using `elemBefore`. Logos render verbatim in their own colors.",
        demoSlug: "lozenge-demo-front-slot",
      },
      {
        title: "Trailing metric",
        description: "Display a compact trailing metric inside the lozenge.",
        demoSlug: "lozenge-demo-trailing-metric",
      },
      { title: "Spacing", demoSlug: "lozenge-demo-spacing" },
      { title: "Max width", demoSlug: "lozenge-demo-max-width" },
      { title: "Dropdown trigger", demoSlug: "lozenge-demo-dropdown-trigger" },
      {
        title: "Dropdown trigger semantic colors",
        demoSlug: "lozenge-demo-dropdown-trigger-appearances",
      },
      { title: "Usage in context", demoSlug: "lozenge-demo-usage" },
    ],
  };
