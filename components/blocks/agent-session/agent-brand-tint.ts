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
 * Custom agents have no brand mark; their avatar family under
 * `/avatar-agent-new/<colour>/` is their collection accent (lime, purple, blue,
 * orange, yellow), so {@link resolveAgentTintSeed} turns the avatar into an
 * `accent:<colour>` seed. Every other unlisted 2p/3p agent resolves to the
 * platform-skill gray ({@link AGENT_BRAND_TINT_FALLBACK}), never a hashed hue.
 */

import {
	parseColor,
	// Relative leaf import with an explicit extension: this module is loaded raw
	// by a node:test suite, where the `@/` alias does not resolve. Keep every
	// import here in that shape, and keep this module dependency-light.
} from "../../ui-custom/lib/shimmer-colors.ts";
import { SOFTWARE_AGENT_COLOR } from "../../../lib/agent-avatar-visuals.ts";
import { AGENT_AVATAR_GROUP_ACCENTS, getAgentAvatarGroup } from "../../../lib/agent-avatars.ts";

const BRAND_TINT_HEX: Readonly<Record<string, string>> = {
	claude: "#d97757",
	canva: "#00c4cc",
	cursor: "#26251e",
	figma: "#a259ff",
	github: "#292a2e",
	"google-drive": "#00ac47",
	"openai-codex": "#3941ff",
	"jira coding agent": SOFTWARE_AGENT_COLOR,
	"jira-coding": SOFTWARE_AGENT_COLOR,
	atlassian: "#1868db",
	rovo: "#1868db",
	"rovo dev": "#1868db",
	slack: "#36c5f0",
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
	notion: "--color-icon",
};

/** The platform-skill gray accent, for 2p/3p agents with no defined colour. */
const AGENT_TINT_FALLBACK_VARIABLE = "--ds-icon-accent-gray";

/** Neutral stand-in when an agent has neither a brand mark nor a collection accent. */
export const AGENT_BRAND_TINT_FALLBACK = `var(${AGENT_TINT_FALLBACK_VARIABLE})`;

const AGENT_ACCENT_SEED_PREFIX = "accent:";

function hasBrandTint(seed: string): boolean {
	return seed in BRAND_TINT_HEX || seed in THEMEABLE_BRAND_TINT_VARIABLES;
}

/**
 * The tint seed for an agent: its brand mark when one is listed, else its
 * custom-agent collection accent (`accent:<colour>` from the avatar family),
 * else its first identifier, which resolves to the platform gray.
 */
export function resolveAgentTintSeed({ avatarSrc, brandName, id, logoName, name, vpkLogo }: Readonly<{
	avatarSrc?: string;
	brandName?: string;
	id?: string;
	logoName?: string;
	name?: string;
	vpkLogo?: string;
}>): string | undefined {
	const candidates = [brandName, vpkLogo, logoName, name, id]
		.map((candidate) => candidate?.trim().toLowerCase())
		.filter((candidate): candidate is string => Boolean(candidate));
	const brand = candidates.find(hasBrandTint);
	if (brand) return brand;
	const group = avatarSrc ? getAgentAvatarGroup(avatarSrc) : undefined;
	if (group && AGENT_AVATAR_GROUP_ACCENTS[group]) return `${AGENT_ACCENT_SEED_PREFIX}${group}`;
	return candidates[0];
}

/** The brand or collection accent as a CSS hex, or `undefined` when neither applies. */
export function resolveAgentBrandTintHex(tintSeed: string | undefined): string | undefined {
	if (!tintSeed) return undefined;
	if (tintSeed.startsWith(AGENT_ACCENT_SEED_PREFIX)) return AGENT_AVATAR_GROUP_ACCENTS[tintSeed.slice(AGENT_ACCENT_SEED_PREFIX.length)];
	return BRAND_TINT_HEX[tintSeed];
}

/**
 * The theme variable for a seed with no fixed hex: near-black brand marks swap
 * with the theme, and every other known agent takes the platform gray.
 */
export function resolveAgentBrandTintVariable(tintSeed: string | undefined): string | undefined {
	if (!tintSeed) return undefined;
	return THEMEABLE_BRAND_TINT_VARIABLES[tintSeed] ?? (resolveAgentBrandTintHex(tintSeed) ? undefined : AGENT_TINT_FALLBACK_VARIABLE);
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
