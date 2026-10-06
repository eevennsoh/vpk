import type { LanyardAssets } from "./renderer/lanyard-renderer";
import type { AgentCardArt, CardTheme, LanyardFormat } from "./renderer/types";

const ROOT = "/illustration/3d-lanyard";

export const LANYARD_3D_ASSETS: LanyardAssets = {
	lanyard: `${ROOT}/lanyard.png`,
	headerPattern: `${ROOT}/header-pattern.png`,
	rovoMark: `${ROOT}/agents/rovo-mark.svg`,
	agents: {
		claude: `${ROOT}/agents/claude.svg`,
		codex: `${ROOT}/agents/codex.svg`,
		cursor: `${ROOT}/agents/cursor.svg`,
		copilot: `${ROOT}/agents/copilot.svg`,
		rovo: `${ROOT}/agents/rovo.svg`,
	},
};

export interface Lanyard3DProfile {
	id: string;
	/** Supports line breaks; each line wraps onto its own row of the card. */
	name: string;
	role: string;
	/** Portrait URL, or null to draw initials. */
	photo: string | null;
}

export const LANYARD_3D_PROFILES: readonly Lanyard3DProfile[] = [
	{ id: "tamar", name: "Tamar\nYehoshua", role: "Chief Product\nand AI Officer", photo: "/avatar-user/tamar-pro.jpg" },
	{ id: "sherif", name: "Sherif\nMansour", role: "Head of AI", photo: "/avatar-user/sherif-pro.jpg" },
	{ id: "mike", name: "Mike\nCannon-Brookes", role: "CEO and Co-Founder", photo: "/avatar-user/mike-pro.jpg" },
	{ id: "taroon", name: "Taroon\nMandhana", role: "CTO, AI and Teamwork", photo: "/avatar-user/taroon-pro.jpg" },
];

export type Lanyard3DAgent = AgentCardArt;

export const LANYARD_3D_AGENTS: readonly Lanyard3DAgent[] = [
	{ id: "claude", name: "Claude", role: "Anthropic", asset: "claude", description: "Hand Claude a bug fix,\ntest, or multi-day migration." },
	{ id: "codex", name: "Codex", role: "OpenAI", asset: "codex", description: "Move faster, go further, and\nbring your biggest ideas to life." },
	{ id: "cursor", name: "Cursor", role: "Cursor", asset: "cursor", description: "Delegate your Jira work\nitems to Cloud Agents." },
	{ id: "copilot", name: "Github Copilot", role: "Github", asset: "copilot", description: "Assign Jira issues, get\ndraft pull requests." },
	{ id: "rovo", name: "Rovo", role: "Atlassian", asset: "rovo", description: "AI that understands\nyour business" },
];

export interface Lanyard3DScene {
	background: string;
	format: LanyardFormat;
	/** 0 to 1.6; scales the drop and swing energy. */
	swing: number;
	/** Degrees each card fans open during the drop, 0 to 45. */
	revealAngle: number;
	agentTheme: CardTheme;
}

export const LANYARD_3D_DEFAULT_SCENE: Lanyard3DScene = {
	background: "#f4f4f4",
	format: "wide",
	swing: 1,
	revealAngle: 15,
	agentTheme: "dark",
};

export const LANYARD_3D_BACKGROUNDS = [
	{ label: "Soft gray", value: "#f4f4f4" },
	{ label: "White", value: "#ffffff" },
	{ label: "Pale blue", value: "#dce7fa" },
	{ label: "Charcoal", value: "#22252b" },
] as const;

export const LANYARD_3D_FORMATS: readonly { value: LanyardFormat; label: string }[] = [
	{ value: "portrait", label: "Portrait · 3:4" },
	{ value: "wide", label: "Widescreen · 16:9" },
	{ value: "square", label: "Square · 1:1" },
];
