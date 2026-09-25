import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";

interface CodingAgentVisual {
	readonly artwork?: "local" | "glyph";
	readonly logoFrameSizePx?: number;
	readonly logoClassName?: string;
	readonly backgroundColor?: string;
	readonly whiteGlyph?: boolean;
}

const CODING_AGENT_VISUALS: Partial<Record<ThirdPartyLogoName, CodingAgentVisual>> = {
	claude: { backgroundColor: "#d97757", whiteGlyph: true },
	// The local asset's mark occupies only 60% of its viewBox; compensate optically.
	"openai-codex": { artwork: "local", logoClassName: "scale-125" },
	cursor: { artwork: "local", backgroundColor: "#14120B" },
	"github-copilot": { backgroundColor: "#000000", whiteGlyph: true },
};

const CODING_LOGO_FRAMES: Partial<Record<number, { readonly size: "xxsmall" | "small" | "medium" | "large" }>> = {
	20: { size: "xxsmall" },
	32: { size: "small" },
	40: { size: "medium" },
	48: { size: "large" },
};

const COMPACT_CODEX_VISUAL: CodingAgentVisual = {
	artwork: "glyph",
	logoFrameSizePx: 12,
};

/** Coding brand treatments are opt-in; other avatar consumers keep their defaults. */
export function getCodingAgentVisual(brandName: ThirdPartyLogoName | undefined, sizePx?: number) {
	// Compact chins use the glyph's authored bounds, without the tile's empty padding.
	if (brandName === "openai-codex" && sizePx === 20) return COMPACT_CODEX_VISUAL;
	return brandName ? CODING_AGENT_VISUALS[brandName] : undefined;
}

/** Compact chins keep an inset mark; larger coding demos use larger logo frames. */
export function getCodingAgentLogoFrame(sizePx: number) {
	return CODING_LOGO_FRAMES[sizePx];
}
