import type { JiraLinkingPoint } from "./drop";
import {
	createSessionChipDropKeyframes,
	SESSION_CHIP_DROP_DURATION_MS,
	// @ts-expect-error Node's strip-types runner requires the explicit .ts extension.
} from "../jira-dropzone/lib/jira-dropzone-motion.ts";

/** Exact recipe from agentic-jira-board's animateUnattachedSessionDropToCard. */
export const JIRA_LINKING_GLOW_DROP_DURATION_MS = SESSION_CHIP_DROP_DURATION_MS;
export const JIRA_LINKING_GLOW_FADE_DURATION_MS = 420;
export const JIRA_LINKING_GLOW_PULSE_DURATION_MS = 800;
export const JIRA_LINKING_GLOW_DEFAULT_COLOR = "var(--ds-border-focused)";

/**
 * How long Glow waits before reporting settled.
 *
 * A drop waits for the travelling chip to land. A glow-only release — a click
 * assignment that omitted `drop` — has no chip, so it settles immediately and
 * the halo/pulse can start without that delay.
 */
export function resolveJiraLinkingGlowSettleMs(
	shouldReduceMotion: boolean | null,
	release?: Readonly<{ drop?: unknown }> | null,
): number {
	if (shouldReduceMotion || (release != null && release.drop == null)) {
		return 0;
	}
	return JIRA_LINKING_GLOW_DROP_DURATION_MS;
}

/** Centers are viewport coordinates; converge from the released cursor in both axes. */
export function createJiraLinkingGlowDropKeyframes(
	from: JiraLinkingPoint,
	landing: JiraLinkingPoint,
): Keyframe[] {
	return createSessionChipDropKeyframes(from, landing, "landing");
}

function clampChannel(channel: number): number {
	return Math.round(Math.min(1, Math.max(0, channel)) * 255);
}

/** Converts the shader's normalized sRGB identity tint into a CSS colour. */
export function resolveJiraLinkingGlowColor(
	tint: readonly [number, number, number],
): string {
	return `rgb(${clampChannel(tint[0])} ${clampChannel(tint[1])} ${clampChannel(tint[2])})`;
}

/** The two focused-border halos from getCardTransferGlow, tinted by the lead avatar. */
export function resolveJiraLinkingGlowShadow(
	color = JIRA_LINKING_GLOW_DEFAULT_COLOR,
): string {
	return [
		`0 0 6px color-mix(in srgb, ${color} 28%, transparent)`,
		`0 0 12px color-mix(in srgb, ${color} 14%, transparent)`,
	].join(", ");
}

/** Keeps the backdrop sweep subtle while preserving the lead avatar's hue. */
export function resolveJiraLinkingGlowPulseColor(color: string): string {
	return `color-mix(in srgb, ${color} 28%, transparent)`;
}
