/**
 * Brand mark colours for agents.
 *
 * Keyed by the lowercased brand the transfer already carries in `tintSeed`
 * (`agent.brandName`, then `agent.vpkLogo`, then the name). These are the
 * literal hexes the rendered logos use, read from `@atlassian/logo-third-party`
 * and `public/3p`, not palette approximations: the goo, the link flash and the
 * session card's hover glow all exist to echo the mark the user is looking at,
 * and a hashed accent put a teal blob under Claude's orange asterisk.
 *
 * This is the single owner for that colour. It sits beside the session block
 * rather than inside `jira-kanban/experimental` because the shared session card
 * reads it too, and a shared owner must not import an experimental variant.
 *
 * Unlisted brands resolve to `undefined`, which leaves the fusion field on its
 * own deterministic ramp and every CSS consumer on {@link AGENT_BRAND_TINT_FALLBACK}.
 */

import {
	parseColor,
	// Relative leaf import with an explicit extension: this module is loaded raw
	// by a node:test suite, where the `@/` alias does not resolve. Keep every
	// import here in that shape, and keep this module dependency-light.
	// @ts-expect-error Node's strip-types test runner requires the explicit .ts extension here.
} from "../../ui-custom/lib/shimmer-colors.ts";

const BRAND_TINT_HEX: Readonly<Record<string, string>> = {
	claude: "#d97757",
	cursor: "#26251e",
	github: "#292a2e",
	"openai-codex": "#3941ff",
	rovo: "#1868db",
};

/**
 * Near-black marks need the same contrast swap as their rendered glyphs.
 * `--color-icon` resolves to near-black in light mode and light grey in dark
 * mode, so the linking field and release flash stay visible in either theme.
 */
const THEMEABLE_BRAND_TINT_VARIABLES: Readonly<Record<string, string>> = {
	cursor: "--color-icon",
	github: "--color-icon",
	"github copilot": "--color-icon",
	"github-copilot": "--color-icon",
};

/** Neutral stand-in when a brand has no mapped mark colour. */
export const AGENT_BRAND_TINT_FALLBACK = "var(--color-bg-accent-gray-bolder)";

/** The brand's mark colour as a CSS string, or `undefined` when unmapped. */
export function resolveAgentBrandTintHex(tintSeed: string | undefined): string | undefined {
	return tintSeed ? BRAND_TINT_HEX[tintSeed] : undefined;
}

/** The semantic theme variable used by near-black brand marks, when needed. */
export function resolveAgentBrandTintVariable(tintSeed: string | undefined): string | undefined {
	return tintSeed ? THEMEABLE_BRAND_TINT_VARIABLES[tintSeed] : undefined;
}

/** Brand tint suitable for CSS effects in both light and dark themes. */
export function resolveAgentBrandTintColor(tintSeed: string | undefined): string | undefined {
	const variable = resolveAgentBrandTintVariable(tintSeed);
	return variable ? `var(${variable})` : resolveAgentBrandTintHex(tintSeed);
}

/** The same colour as a 0-1 sRGB triple, for the shader's tint uniform. */
export function resolveAgentBrandTint(
	tintSeed: string | undefined,
): readonly [number, number, number] | undefined {
	const hex = resolveAgentBrandTintHex(tintSeed);
	const parsed = hex ? parseColor(hex) : null;
	if (!parsed) {
		return undefined;
	}

	return [parsed.r / 255, parsed.g / 255, parsed.b / 255];
}
