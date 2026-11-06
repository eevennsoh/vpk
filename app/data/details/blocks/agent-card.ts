import type { ComponentDetail } from "@/app/data/component-detail-types";

export const AGENT_CARD_DETAIL: ComponentDetail = {
		description:
			"Self-contained agent card with multiple layouts. The default \"expanded\" variant has a cover banner, attribution byline, inline template stats, \"Works with\" sources, \"Skills\" tags, and a scrollable capabilities feature list. The experimental template variant is a compact banner-first treatment with inline metrics, stacked app/skill sections, and a feature list. The experimental profile variant is a plain-surface, entity-style profile card for a built agent — hexagon avatar, byline, description, and social proof, with a 1px border that fades on hover. The \"template\" variant is a flat card (icon + name, description, \"Works with\", \"Skills\"). Passing onSelect turns the whole card into a keyboard-operable select button.",
		demoLayout: { previewHeight: "fit" },
		importStatement: `import { AgentCard } from "@/components/blocks/agent-card";`,
		usage: `import { AgentCard } from "@/components/blocks/agent-card";

<AgentCard
  name="Decision Director"
  publisher="Atlassian"
  attributionKind="company"
  verified
  avatarSrc="/avatar-agent-new/blue/decision-director.svg"
  description="Review DACI decisions, close context gaps, and suggest the next decision-ready resources."
  sources={[
    { id: "jira", label: "Jira", provider: "jira" },
    { id: "confluence", label: "Confluence", provider: "confluence" },
  ]}
  skills={[
    { label: "stakeholder-input", color: "teamwork" },
    { label: "opportunity-sizing", color: "product" },
  ]}
  capabilities={[
    { icon: "review", label: "Review DACI decisions and close context gaps" },
    { icon: "target", label: "Size opportunities against current priorities" },
  ]}
  stats={[
    { value: "1.8K", label: "Remix" },
    { value: "2 weeks ago", label: "Last update" },
  ]}
  collaborators={[
    { name: "Michael Chu", src: "/avatar-human/michael-chu.png" },
    { name: "Melanie Lee", src: "/avatar-human/melanie-lee.png" },
  ]}
  onSelect={() => useTemplate()}
/>`,
		props: [
			{ name: "name", type: "string", required: true, description: "Agent name shown in the card header." },
			{ name: "variant", type: '"expanded" | "experimental" | "experimental-template" | "experimental-profile" | "template"', default: '"expanded"', description: 'Layout: "expanded" (banner + inline stats + template details), "experimental" / "experimental-template" (banner-first template card), "experimental-profile" (built-agent profile summary), or flat "template".' },
			{ name: "publisher", type: "string", required: true, description: "Attribution publisher shown in the byline." },
			{ name: "avatarSrc", type: "string", description: "Cover/avatar art rendered in the banner and hexagon (expanded variant)." },
			{ name: "iconSrc", type: "string", description: 'Flat icon shown in the header of the "template" variant.' },
			{ name: "attributionKind", type: '"company" | "team" | "person"', description: "Controls the avatar badge (company logo, team project badge, or none)." },
			{ name: "description", type: "string", description: "Secondary text under the header; falls back to a derived line." },
			{ name: "capabilities", type: "readonly (AgentCardCapability | string)[]", description: 'Feature list rendered as an icon-tile capabilities list (expanded variant).' },
			{ name: "sources", type: "ReadonlyArray<TwgToolSource>", description: 'Tools/products shown in the "Works with" appstack.' },
			{ name: "skills", type: "ReadonlyArray<AgentCardSkill>", description: 'Skill tags shown in the "Skills" group.' },
			{ name: "stats", type: "ReadonlyArray<{ value: string; label: string }>", description: "Metric pairs (e.g. Remix, Last update)." },
			{ name: "collaborators", type: "ReadonlyArray<{ src: string; name: string }>", description: "Collaborator avatars shown where the selected variant supports social proof." },
			{ name: "verified", type: "boolean", default: "false", description: "Shows the verified badge next to the publisher." },
			{ name: "onSelect", type: "() => void", description: "Whole-card selection handler." },
			{ name: "onMoreActions", type: "() => void", description: "Reveals an overflow button in the header on hover/focus." },
		],
		examples: [
			{
				title: "Expanded",
				description:
					"Full layout: cover banner, attribution byline, inline template stats, \"Works with\" sources, \"Skills\" tags, and a scrollable capabilities feature list.",
				demoSlug: "agent-card-demo-expanded",
			},
			{
				title: "Experimental (template)",
				description:
					"Compact banner-first treatment with inline metrics, \"Works with\" sources, \"Skills\" tags, and a feature list, shown across the five agent color families.",
				demoSlug: "agent-card-demo-experimental-template",
			},
			{
				title: "Experimental (profile)",
				description:
					"Built-agent profile card on a plain elevation surface with an entity-style lock-up (hexagon avatar, byline), description, and social proof. No cover banner, illustration, Works with, Skills, or feature-list sections.",
				demoSlug: "agent-card-demo-experimental-profile",
			},
			{
				title: "Simple",
				description:
					"Flat \"template\" variant: icon + name header, description, \"Works with\", and \"Skills\". Hugs its content.",
				demoSlug: "agent-card-demo-simple",
			},
		],
	};
