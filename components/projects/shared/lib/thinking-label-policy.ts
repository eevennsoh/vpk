import type { ReasoningPhase } from "@/components/projects/shared/hooks/use-reasoning-phase";
import { getCyclingWorkingLabel, getDefaultThinkingLabel } from "@/components/ui-custom/lib/reasoning-labels";

interface ResolveThinkingLabelForSurfaceOptions {
	baseLabel: string;
	surface: "sidebar" | "fullscreen";
	reasoningPhase: ReasoningPhase;
}

const GENERIC_THINKING_LABELS = new Set([
	"thinking",
	"rovo is thinking",
	"rovo is tihking",
]);

/**
 * Step labels whose names also surface as the active trigger/parent header.
 * For these scripted, multi-step traces (e.g. Studio agent creation) the latest
 * step label is identical to the collapsed header, producing a repetitive
 * "Saving agent profile" / "Saving agent profile" parent-child echo. Mapping
 * them to a generic working header keeps the parent general while the per-step
 * rows keep their specific names. The generic header still cycles through a
 * pool of working synonyms (keyed off the step) so it never sits stale on a
 * single persistent word as the flow advances. Other specific labels (e.g.
 * "Generating image", "Inspecting files") are intentionally preserved.
 */
const STEP_SPECIFIC_HEADER_LABELS = new Set([
	"reading agent brief",
	"preparing clarification questions",
	"reviewing agent details",
	"selecting agent tools",
	"drafting agent instructions",
	"naming agent profile",
	"saving agent profile",
]);

function normalizeLabelKey(label: string): string {
	return label.trim().replace(/\s+/g, " ").toLowerCase();
}

export function resolveThinkingLabelForSurface({
	baseLabel,
}: Readonly<ResolveThinkingLabelForSurfaceOptions>): string {
	const trimmedLabel = baseLabel.trim();
	if (!trimmedLabel) {
		return getDefaultThinkingLabel();
	}

	const normalized = normalizeLabelKey(trimmedLabel);

	if (GENERIC_THINKING_LABELS.has(normalized)) {
		return getDefaultThinkingLabel();
	}

	if (STEP_SPECIFIC_HEADER_LABELS.has(normalized)) {
		return getCyclingWorkingLabel(normalized);
	}

	return trimmedLabel;
}
