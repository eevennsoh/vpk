import type { ComponentDetail } from "@/app/data/component-detail-types";

export const LANYARD_3D_DETAIL: ComponentDetail = {
	description: "An animated, physically simulated two-card lanyard. The badge drops, catches on the clasp and swings to rest, with the presenter's portrait on the front and an agent card on the back. Swap between four people and five agents and edit their names, roles and descriptions live.",
	importStatement: `import { Lanyard3D, Lanyard3DStage, LANYARD_3D_PROFILES, LANYARD_3D_AGENTS } from "@/components/blocks/3d-lanyard";`,
	usage: `import { Lanyard3D } from "@/components/blocks/3d-lanyard";

<Lanyard3D defaultProfileId="tamar" defaultAgentId="claude" />

// Stage only, driven by your own state:
<Lanyard3DStage
	config={{
		name: "Tamar\nYehoshua", role: "Chief Product\nand AI Officer", photo: "/people/tamar.jpg",
		background: "#f4f4f4", format: "wide", swing: 1, revealAngle: 15,
		backCard: LANYARD_3D_AGENTS[0], backCardTheme: "dark",
	}}
/>`,
	demoLayout: { previewContentWidth: "full", examplesContentWidth: "full", previewHeight: "fit" },
	props: [
		{ name: "profiles", type: "Lanyard3DProfile[]", default: "LANYARD_3D_PROFILES", description: "People who can wear the lanyard: Tamar, Sherif, Mike and Taroon by default. Each has a name (line breaks allowed), a role and a portrait URL, or null for initials." },
		{ name: "agents", type: "Lanyard3DAgent[]", default: "LANYARD_3D_AGENTS", description: "Agents for the back card: Claude, Codex, Cursor, Github Copilot and Rovo by default. The asset key selects the hexagon badge; name, provider and description are free text." },
		{ name: "defaultProfileId", type: "string", description: "Initially selected person. Defaults to the first profile." },
		{ name: "defaultAgentId", type: "string", description: "Initially selected agent. Defaults to the first agent." },
		{ name: "defaultScene", type: "Partial<Lanyard3DScene>", description: "Initial background, format (portrait, wide, square), swing (0 to 1.6), reveal angle (0 to 45 degrees) and agent card theme." },
		{ name: "showEditor", type: "boolean", default: "true", description: "Set to false to render only the animated stage and transport." },
		{ name: "className", type: "string", description: "Additional classes on the outer container." },
	],
	subComponents: [{
		name: "Lanyard3DStage",
		description: "The canvas and transport without the editor. It renders with WebGL2 (shadow-mapped metal hardware and cloth) and falls back to a Canvas 2D rasteriser. Playback is skipped to the settled pose under prefers-reduced-motion.",
		props: [
			{ name: "config", type: "LanyardConfig", required: true, description: "Front card text and portrait, back card agent and theme, background, format, swing and reveal angle. Changes redraw the current frame without restarting playback." },
			{ name: "autoPlay", type: "boolean", default: "true", description: "Plays the drop and swing on mount." },
		],
	}],
};
