import type { ComponentDetail } from "@/app/data/component-detail-types";

export const AGENT_LANYARD_DETAIL: ComponentDetail = {
	description: "An agent badge card with a dotted grid backdrop, verified identity, chat or connect actions, and independently configurable hover tilt and grid waves.",
	importStatement: `import { AgentLanyard, AGENT_LANYARD_AGENTS, AGENT_LANYARD_TEMPLATES } from "@/components/blocks/agent-lanyard";`,
	usage: `import { AgentLanyard, AGENT_LANYARD_AGENTS, AGENT_LANYARD_TEMPLATES } from "@/components/blocks/agent-lanyard";

<AgentLanyard
	agent={AGENT_LANYARD_AGENTS[0]}
	perspectiveTilt
	animateGrid
	onAction={(agent) => openAgent(agent.id)}
	starred={isStarred}
	menuActions={{
		onViewProfile: (agent) => openAgentProfile(agent.id),
		onToggleStar: (agent) => toggleStar(agent.id),
		onCopyLink: (agent) => copyAgentLink(agent.id),
		onDuplicate: (agent) => duplicateAgent(agent.id),
	}}
/>

<AgentLanyard
	variant="template"
	template={AGENT_LANYARD_TEMPLATES[0]}
/>`,
	demoLayout: { previewContentWidth: "full", examplesContentWidth: "full", previewHeight: "fit" },
	examples: [
		{ title: "Templates", id: "templates", description: "Template cards with outlined hexagon artwork and shared TWG Appstack connected apps.", demoSlug: "agent-lanyard-demo-template" },
		{ title: "Custom 1P agents", id: "custom-first-party", description: "Five custom-agent collection badges from Figma, with connected apps and optional tilt/grid motion. Use createCustomFirstPartyAgent to provide your own name, description, publisher, collection, and app sources.", demoSlug: "agent-lanyard-demo-custom-first-party" },
		{ title: "Named 1P agents", id: "named-first-party", description: "The ten named Atlassian agent identities from the Figma reference. Names, logos, and colors match the reference; descriptions are illustrative demo copy.", demoSlug: "agent-lanyard-demo-named-first-party" },
	],
	subComponents: [{
		name: "AgentLanyardFirstParty",
		description: "The 1P card variant shares Agent Lanyard's layout, cutout, and perspective tilt. It renders transparent Figma logo glyphs inside the shared hexagon Avatar with collection colors, and uses the shared TWG Appstack footer. Import it with AGENT_LANYARD_CUSTOM_AGENTS, AGENT_LANYARD_FIRST_PARTY_AGENTS, or createCustomFirstPartyAgent from the same block.",
		props: [
			{ name: "agent", type: "AgentLanyardFirstPartyAgent", required: true, description: "Identity, transparent logo glyph, collection color, verification, and connected app sources." },
			{ name: "perspectiveTilt", type: "boolean", default: "true", description: "Enables the shared hover tilt, respecting reduced motion." },
			{ name: "animateGrid", type: "boolean", default: "false", description: "Enables the hover wave. The static grid backdrop remains visible when animation is off or reduced motion is enabled." },
		],
	}],
	adsLinks: [{ label: "Source prototype", url: "https://bitbucket.org/atlassian/prototyping/branch/studio/main/agent-lifecycle" }],
	props: [
		{ name: "variant", type: '"agent" | "template"', default: '"agent"', description: "Agent cards show chat/connect actions; template cards show an outlined avatar and TWG Appstack." },
		{ name: "agent", type: "AgentLanyardAgent", description: "Required for the agent variant. Identity, complete badge artwork, description, verification, action kind, and decorative accent color." },
		{ name: "template", type: "AgentLanyardTemplate", description: "Required with variant=\"template\". Name, description, template icon artwork, and connected app sources." },
		{ name: "perspectiveTilt", type: "boolean", default: "true", description: "Enables the reference perspective tilt on hover. Disabled under reduced motion." },
		{ name: "animateGrid", type: "boolean", default: "true", description: "Agent variant only: enables one colored, distorted grid wave on hover. The static grid remains when disabled; reduced motion also disables the wave." },
		{ name: "showGrid", type: "boolean", default: "true", description: "Agent variant only: controls the decorative backdrop independently of tilt and grid animation. The 1P wrapper keeps the backdrop visible." },
		{ name: "footer", type: "ReactNode", description: "Agent variant only: replaces the action row with a consumer-owned footer. AgentLanyardFirstParty supplies the shared connected-app stack." },
		{ name: "avatar", type: "ReactNode", description: "Agent variant only: overrides the avatar presentation. The 1P wrapper composes the original transparent Figma SVG layers." },
		{ name: "onAction", type: "(agent: AgentLanyardAgent) => void", description: "Handles the chat or connect action. The button is disabled when absent. The catalog demo reports the selected action." },
		{ name: "menuActions", type: "AgentLanyardMenuActions", description: "Callbacks for View profile, Star/Unstar, Copy link, and Duplicate. Missing callbacks disable the matching menu items. An empty object disables the menu trigger." },
		{ name: "starred", type: "boolean", default: "false", description: "Controlled star state. Changes the menu option from Star to Unstar." },
		{ name: "onMoreActions", type: "(agent: AgentLanyardAgent) => void", description: "Opens consumer-owned actions when menuActions is omitted. The button is disabled when both capabilities are absent." },
		{ name: "className", type: "string", description: "Additional layout classes on the stable outer card wrapper." },
	],
};
