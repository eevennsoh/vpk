import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";

interface CodingAgentVisual {
	readonly logoSrc?: string;
	readonly logoClassName?: string;
	readonly backgroundColor?: string;
	readonly whiteGlyph?: boolean;
}

const CODING_AGENT_VISUALS: Partial<Record<ThirdPartyLogoName, CodingAgentVisual>> = {
	claude: { backgroundColor: "#d97757", whiteGlyph: true },
	// The local asset's mark occupies only 60% of its viewBox; compensate optically.
	"openai-codex": { logoSrc: "/3p/openai-codex/24.svg", logoClassName: "scale-125" },
	cursor: { logoSrc: "/3p/cursor/24.svg", backgroundColor: "#14120B" },
	"github-copilot": { backgroundColor: "#000000", whiteGlyph: true },
};

const CODING_LOGO_FRAMES: Partial<Record<number, { readonly size: "small" | "medium" | "large"; readonly className: string }>> = {
	32: { size: "small", className: "size-6" },
	40: { size: "medium", className: "size-8" },
	48: { size: "large", className: "size-10" },
};

/** Coding brand treatments are opt-in; other avatar consumers keep their defaults. */
export function getCodingAgentVisual(brandName: ThirdPartyLogoName | undefined) {
	return brandName ? CODING_AGENT_VISUALS[brandName] : undefined;
}

/** Local SVGs and package glyphs share the same enlarged coding-logo footprint. */
export function getCodingAgentLogoFrame(sizePx: number) {
	return CODING_LOGO_FRAMES[sizePx];
}
