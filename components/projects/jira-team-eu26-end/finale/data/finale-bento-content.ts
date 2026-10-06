import type { ThirdPartyLogoName } from "@/components/ui/logo-third-party";

/*
 * What the bento's product slices show, verbatim from the Founder Keynote
 * Figma "Bento" (node 10774:6028). Colours are ADS light-mode chart values:
 * the slide is a fixed brand surface.
 */

/** One stacked segment, top to bottom; no height shares what the bar has left. */
export interface BentoBarSegment {
	readonly color: string;
	readonly height?: number;
}

export interface BentoBar {
	readonly height: number;
	readonly segments: readonly BentoBarSegment[];
}

const GRAY = "#E5E7EB";
const BLUE = "#487CE1";
const SKY = "#42B2D7";
const LIME = "#82B536";
const PURPLE = "#BF63F3";
const AMBER = "#FCA700";
const ORANGE = "#E88F36";
const COBALT = "#1558BC";
const SILVER = "#DDDEE1";

/** Agent Effectiveness: "Agent work by session", Jul–Oct 2026. */
export const BENTO_SESSION_BARS: readonly BentoBar[] = [
	{ height: 81.283, segments: [{ color: GRAY, height: 25 }, { color: SKY, height: 20 }, { color: COBALT }] },
	{ height: 71.813, segments: [{ color: GRAY, height: 21 }, { color: PURPLE, height: 40 }, { color: LIME }] },
	// Taller than its bar: the grey runs off the top, as the Figma crops it.
	{ height: 67.078, segments: [{ color: GRAY, height: 59 }, { color: SKY, height: 22 }] },
	{ height: 93.91, segments: [{ color: GRAY, height: 29 }, { color: LIME, height: 29 }, { color: COBALT }] },
	{ height: 108.904, segments: [{ color: GRAY, height: 36 }, { color: SKY }, { color: PURPLE, height: 21 }, { color: ORANGE, height: 16.993 }] },
];

export const BENTO_SESSION_AXIS = ["16K", "12K", "8K", "4K", "0"] as const;

/** The legend's first five kinds of work; the tile's fade takes the fifth. */
export const BENTO_SESSION_LEGEND: readonly { readonly label: string; readonly color: string; readonly sessions: string }[] = [
	{ label: "Bug fixes", color: BLUE, sessions: "40.3K" },
	{ label: "Refactors and rewrites", color: PURPLE, sessions: "40.0K" },
	{ label: "Documentation", color: AMBER, sessions: "37.5K" },
	{ label: "Code reviews", color: SKY, sessions: "28.5K" },
	{ label: "Architecture design & planning", color: COBALT, sessions: "27.1K" },
];

/** A cost legend row: its key colour, its brand (or ADS's App tile for the rest) and its spend. */
export interface BentoCostRow {
	readonly label: string;
	readonly color: string;
	readonly logo: ThirdPartyLogoName | "app";
	readonly cost: string;
}

/** AI Capital Management: "Cost by provider" ($5.6m in all). */
export const BENTO_PROVIDER_COSTS: readonly BentoCostRow[] = [
	{ label: "Anthropic", color: LIME, logo: "claude", cost: "$185.6K" },
	{ label: "OpenAI", color: PURPLE, logo: "openai", cost: "$148.2K" },
	{ label: "Cursor", color: AMBER, logo: "cursor", cost: "$135.6K" },
	{ label: "Canva", color: SKY, logo: "canva", cost: "$000.0K" },
	{ label: "Other", color: SILVER, logo: "app", cost: "$000.0K" },
];

/** AI Capital Management: "Cost by model", led by Opus 4.6, as one bar of each model's width at the 1920 stage. */
export const BENTO_MODEL_SPLIT: readonly { readonly color: string; readonly width: number }[] = [
	{ color: LIME, width: 99.9 },
	{ color: PURPLE, width: 87.413 },
	{ color: AMBER, width: 59.94 },
	{ color: SKY, width: 29.97 },
	{ color: SILVER, width: 152.348 },
];

/** Artifacts: three Rovo artifacts as their cards show them, bottom of the pile first. */
export interface BentoArtifact {
	readonly title: string;
	readonly author: string;
	readonly authorAvatar: string;
}

export const BENTO_ARTIFACTS = {
	report: { title: "AI Usage Report", author: "Tamar Yehoshua", authorAvatar: "/illustration/jira-team-eu26-end/bento/artifacts-avatar-reviewer.png" },
	concept: { title: "Design Studio Concept.html", author: "Mike Cannon Brookes", authorAvatar: "/avatar-user/mike.png" },
	studio: { title: "Design Studio", author: "Tamar Yehoshua", authorAvatar: "/avatar-user/tamar.png" },
} as const satisfies Record<string, BentoArtifact>;
