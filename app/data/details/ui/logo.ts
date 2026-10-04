import type { ComponentDetail } from "@/app/data/component-detail-types";

export const LOGO_DETAIL: ComponentDetail = {
    description:
      "Unified Atlassian product/app logo wrapper built on @atlaskit/logo with theme-aware defaults for light and dark mode. Supports icon-only and lockup (icon + wordmark) variants, a CustomLogo for rendering your own SVG or a 2P partner brand asset, and a RovoColorIcon for the full-color Rovo brand mark. Logo usage decisions (bare vs. bordered tile vs. borderless-in-tile) are documented centrally in components/ui/data/logo-usage.json. CustomLogo with a src applies the 2P treatment automatically; AtlassianLogo opts in to the 1P treatment (Atlassian master logo = tile, product logos = bare) via withUsageBorder. Third-party (3P) brand logos live on their own component — see /components/ui/logo-third-party.",
    adsUrl: "https://atlassian.design/components/logo",
	usage: `import { AtlassianLogo, JiraIcon, CustomLogo, RovoColorIcon, RovoAppIcon } from "@/components/ui/logo";

<AtlassianLogo name="jira" label="Jira" size="small" />
<AtlassianLogo name="jira" label="Jira" variant="lockup" size="small" />
<JiraIcon label="Jira" size="small" variant="lockup" />
{/* withUsageBorder pulls the 1P treatment from logo-usage.json (atlassian = tile) */}
<AtlassianLogo name="atlassian" label="Atlassian" size="small" withUsageBorder />
{/* 2P partner mark by asset path */}
<CustomLogo src="/2p/appfire.png" label="Appfire" size="small" />
<CustomLogo svg={<MySvg />} wordmark="Acme" size="small" label="Acme" />
<RovoColorIcon size="small" label="Rovo" />
<RovoAppIcon size="small" label="Rovo" />`,
    props: [
      {
        name: "name",
        type: '"admin" | "align" | "analytics" | "assets" | "atlassian" | "bamboo" | "bitbucket" | "chat" | "compass" | "confluence" | "customer-service-management" | "focus" | "goals" | "guard" | "home" | "hub" | "jira" | "jira-product-discovery" | "jira-service-management" | "loom" | "opsgenie" | "projects" | "rovo" | "rovo-dev" | "rovo-dev-agent" | "search" | "statuspage" | "studio" | "talent" | "teams" | "trello"',
        description: "Atlassian logo key (required for AtlassianLogo).",
      },
      {
        name: "variant",
        type: '"icon" | "lockup"',
        default: '"icon"',
        description:
          "Icon renders the symbol only. Lockup renders icon + wordmark together.",
      },
      {
        name: "size",
        type: '"xxsmall" | "xsmall" | "small" | "medium" | "large" | "xlarge"',
        default: '"small"',
        description: "Logo size.",
      },
      {
        name: "appearance",
        type: '"brand" | "neutral" | "inverse"',
        description: "Explicit appearance override.",
      },
      {
        name: "themeAware",
        type: "boolean",
        default: "true",
        description:
          "When true and appearance is omitted, picks brand/inverse based on theme.",
      },
      {
        name: "shouldUseNewLogoDesign",
        type: "boolean",
        default: "true",
        description:
          "Uses the latest logo designs. Set to false for legacy logos.",
      },
      {
        name: "shouldUseHexLogo",
        type: "boolean",
        description: "Rovo-only option for hex logo variant.",
      },
      {
        name: "svg",
        type: "ReactElement (CustomLogo only)",
        description:
          "Custom SVG element to render as the logo icon. Provide either svg or src.",
      },
      {
        name: "src",
        type: "string (CustomLogo only)",
        description:
          "2P partner asset path (e.g. /2p/appfire.png). Border treatment and the borderless variant swap are resolved automatically from logo-usage.json. (3P brands use LogoThirdParty by name.)",
      },
      {
        name: "hasBorder",
        type: "boolean (AtlassianLogo)",
        description:
          "Explicitly draws a 1px bordered tile around the mark. Overrides withUsageBorder. Defaults to off.",
      },
      {
        name: "withUsageBorder",
        type: "boolean (AtlassianLogo)",
        default: "false",
        description:
          "Opt in to the 1P border treatment documented in logo-usage.json (atlassian = bordered tile, product logos = bare). Leave off when the logo is already inside an avatar/cover.",
      },
      {
        name: "wordmark",
        type: "string (CustomLogo only)",
        description: "Optional text displayed beside the custom SVG icon.",
      },
    ],
    examples: [
		{
			title: "Rovo App Icon",
			description: "The full-color Rovo mark in a rounded app container at all six sizes. Uses the same background color as the Rovo button in light and dark mode.",
			demoSlug: "logo-demo-rovo-app-icon",
		},
      {
        title: "Icons",
        description: "All available product icon logos.",
        demoSlug: "logo-demo-icons",
      },
      {
        title: "Lockups",
        description: "Icon + wordmark lockup variants.",
        demoSlug: "logo-demo-lockups",
      },
      {
        title: "Sizes",
        description: "All six size options for icon and lockup.",
        demoSlug: "logo-demo-sizes",
      },
      {
        title: "Appearances",
        description: "Brand, neutral, and inverse appearances.",
        demoSlug: "logo-demo-appearances",
      },
      {
        title: "Custom Logo",
        description: "Render a custom SVG with optional wordmark.",
        demoSlug: "logo-demo-custom",
      },
      {
        title: "Brand Logos (1P / 2P)",
        description:
          "1P Atlassian marks render via AtlassianLogo (opt into the tile treatment with withUsageBorder); 2P partner PNGs pass a src to CustomLogo and get a bordered tile resolved from logo-usage.json. 3P brands live on LogoThirdParty.",
        demoSlug: "logo-demo-brand-logos",
      },
      {
        title: "Brand Logos in a Tile",
        description:
          "Picker / suggestion-menu rows (e.g. the editor-palette): all Tile sizes are shown, including the 16×16 xxsmall tile. The Atlassian master logo and bare 2P marks sit in a surface Tile with a size-scaled inset, while solid-background 1P product marks (e.g. Jira) fill the whole tile — driven by logo-usage.json.",
        demoSlug: "logo-demo-in-tile",
      },
      {
        title: "Brand Logos in a Tag",
        description:
          "Inline chips (e.g. the agent config panel's tags): every mark is normalized to a 16px box; the Atlassian master logo and bare 2P marks render as a centered 12px glyph, solid-background 1P product marks fill the box.",
        demoSlug: "logo-demo-in-tag",
      },
      {
        title: "Named Exports",
        description: "All convenience named exports for direct usage.",
        demoSlug: "logo-demo-named-exports",
      },
    ],
  };
