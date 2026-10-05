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
const OLIVE = "#8DB44B";
const PURPLE = "#BF63F3";
const PLUM = "#8C4EBA";
const ORANGE = "#E88F36";
const COBALT = "#1558BC";

/** Agent Effectiveness: "Agent work by session", Jul–Oct 2026. */
export const BENTO_SESSION_BARS: readonly BentoBar[] = [
	{ height: 81.283, segments: [{ color: GRAY, height: 25 }, { color: SKY }, { color: OLIVE, height: 21 }, { color: BLUE }] },
	{ height: 71.813, segments: [{ color: GRAY, height: 11 }, { color: PURPLE }, { color: LIME }, { color: BLUE }] },
	{ height: 67.078, segments: [{ color: GRAY, height: 28 }, { color: SKY, height: 8 }, { color: PLUM, height: 17 }, { color: ORANGE }] },
	{ height: 93.91, segments: [{ color: GRAY, height: 29 }, { color: LIME, height: 17 }, { color: COBALT }] },
	{ height: 108.904, segments: [{ color: GRAY }, { color: SKY }, { color: PURPLE, height: 13 }, { color: ORANGE, height: 16.993 }, { color: BLUE }] },
	{ height: 100.223, segments: [{ color: GRAY }, { color: COBALT, height: 69 }] },
	{ height: 82.072, segments: [{ color: GRAY, height: 13 }, { color: SKY, height: 6.313 }, { color: LIME }, { color: BLUE }] },
];

export const BENTO_SESSION_AXIS = ["16K", "12K", "8K", "4K", "0"] as const;

export const BENTO_SESSION_LEGEND: readonly { readonly label: string; readonly color: string; readonly sessions: string }[] = [
	{ label: "Bug fixes", color: BLUE, sessions: "40.3K" },
	{ label: "Refactors and rewrites", color: OLIVE, sessions: "40.0K" },
	{ label: "Documentation", color: "#B368EC", sessions: "37.5K" },
	{ label: "Code reviews", color: ORANGE, sessions: "28.5K" },
	{ label: "Architecture design & planning", color: "#2957B6", sessions: "27.1K" },
	{ label: "New features", color: PLUM, sessions: "24.1K" },
	{ label: "Test updates", color: "#62B0D3", sessions: "19.9K" },
	{ label: "Other", color: "#D1D5DB", sessions: "31.7K" },
];

/** A cost legend row: its key colour, its brand (if any) and its spend. */
export interface BentoCostRow {
	readonly label: string;
	readonly color: string;
	readonly logo?: ThirdPartyLogoName | "rovo";
	readonly cost: string;
}

/** AI Capital Management: "Cost by provider" ($5.6m in all). */
export const BENTO_PROVIDER_COSTS: readonly BentoCostRow[] = [
	{ label: "Anthropic", color: LIME, logo: "claude", cost: "$185.6K" },
	{ label: "OpenAI", color: PURPLE, logo: "openai", cost: "$148.2K" },
	{ label: "Cursor", color: "#FCA700", logo: "cursor", cost: "$135.6K" },
	{ label: "Canva", color: SKY, logo: "canva", cost: "$000.0K" },
	{ label: "Other", color: "#DDDEE1", cost: "$135.6K" },
];

/** AI Capital Management: "Cost by model", led by Opus 4.6. */
export const BENTO_MODEL_COSTS: readonly BentoCostRow[] = [
	{ label: "Opus 4.6", color: LIME, logo: "claude", cost: "$1.1M" },
	{ label: "GPT-4o", color: PURPLE, logo: "openai", cost: "$1M" },
	{ label: "GPT-4", color: "#FCA700", logo: "cursor", cost: "$709K" },
	{ label: "Rovo", color: SKY, logo: "rovo", cost: "$609K" },
	{ label: "Other", color: "#B7B9BE", cost: "$2.2M" },
];

/** The model split as one bar: each model's width at the 1920 stage. */
export const BENTO_MODEL_SPLIT: readonly { readonly color: string; readonly width: number }[] = [
	{ color: LIME, width: 99.9 },
	{ color: PURPLE, width: 87.413 },
	{ color: "#FCA700", width: 59.94 },
	{ color: SKY, width: 29.97 },
	{ color: "#DDDEE1", width: 152.348 },
];

/** Artifacts: three Rovo artifacts as their cards show them, bottom of the pile first. */
export interface BentoArtifact {
	readonly title: string;
	readonly author: string;
	readonly authorAvatar: string;
}

export const BENTO_ARTIFACTS = {
	report: { title: "AI Usage Report", author: "Tamar Yehoshua", authorAvatar: "/illustration/jira-team-eu26-end/bento/artifacts-avatar-reviewer.png" },
	concept: { title: "Design Studio Concept.html", author: "Mike Cannon Brookes", authorAvatar: "/avatar-user/mcb.png" },
	studio: { title: "Design Studio", author: "Tamar Yehoshua", authorAvatar: "/avatar-user/tamar.png" },
} as const satisfies Record<string, BentoArtifact>;
