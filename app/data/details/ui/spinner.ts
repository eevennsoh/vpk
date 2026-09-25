import type { ComponentDetail } from "@/app/data/component-detail-types";

export const SPINNER_DETAIL: ComponentDetail = {
    description:
      "A loading spinner with an icon-subtlest default arc that sweeps around the circle. Supports `inherit`, `invert`, and `rainbow` treatments plus an explicit `experimental` six-dot iconic orb and an `experimental-avatar` treatment from Jira's agent status prototype.",
    adsUrl: "https://atlassian.design/components/spinner",
    usage: `import { Spinner } from "@/components/ui/spinner";

<Spinner />
<Spinner size="xl" />
<Spinner variant="rainbow" />
<Spinner variant="experimental" />
<Spinner variant="experimental" pulse />
<Spinner variant="experimental-avatar" pulse />`,
    props: [
      {
        name: "size",
        type: `"xs" | "sm" | "default" | "lg" | "xl"`,
        default: `"default"`,
        description: "Glyph size.",
      },
      {
        name: "variant",
        type: `"default" | "experimental" | "experimental-avatar" | "inherit" | "invert" | "rainbow"`,
        default: `"default"`,
        description:
          "Treatment. `default` uses icon subtlest, `experimental` rotates a uniform six-dot orb, `experimental-avatar` gives each dot a different opacity and collapses to a compact hexagonal avatar cluster when pulsing, `inherit` follows currentColor, `invert` paints the background token, and `rainbow` uses the Rovo brand gradient.",
      },
      {
        name: "pulse",
        type: "boolean",
        default: "false",
        description:
          "Experimental variants only. When true, dots converge to one center dot (`experimental`) or a compact hexagonal avatar cluster (`experimental-avatar`) and grow back into the ring. Default stays at full ring size and rotates.",
      },
      {
        name: "className",
        type: "string",
        description: "Additional CSS classes for sizing.",
      },
    ],
    examples: [
      { title: "Default", demoSlug: "spinner-demo-default" },
      {
        title: "Sizes",
        description: "Different spinner sizes.",
        demoSlug: "spinner-demo-sizes",
      },
      {
        title: "Rainbow",
        description: "Rovo brand-gradient variant used for agent loading states.",
        demoSlug: "spinner-demo-rainbow",
      },
      {
        title: "Experimental",
        description: "Six-dot iconic orb from the Jira agent status prototype. Toggle Avatar spinner for varied dot opacity and a compact hexagonal collapse; enabling it also turns on Grow in/out. Turn Grow in/out off to keep the ring expanded.",
        demoSlug: "spinner-demo-experimental",
      },
      { title: "Basic", demoSlug: "spinner-demo-basic" },
      {
        title: "In badges",
        description: "Spinner inside badge components.",
        demoSlug: "spinner-demo-in-badges",
      },
      {
        title: "In buttons",
        description: "Spinner inside button components.",
        demoSlug: "spinner-demo-in-buttons",
      },
      {
        title: "In empty state",
        description: "Spinner in an empty state layout.",
        demoSlug: "spinner-demo-in-empty-state",
      },
      {
        title: "In input group",
        description: "Spinner inside an input group.",
        demoSlug: "spinner-demo-in-input-group",
      },
    ],
  };
