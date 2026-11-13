"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
	FloatingRovoButtonOnboardingConfig,
	FloatingRovoButtonOnboardingStatus,
} from "@/components/blocks/rovo-button";

/**
 * One asset serves the 42x48 hex avatar and the 168x192 banner art.
 *
 * Read this before swapping it — two previous choices failed the same trap.
 *
 * The banner is not the drawing. `onboarding-panel.tsx` renders the art into a
 * 48px-tall strip with `overflow-hidden`, so you only ever see a thin slice cut
 * through the artwork's vertical middle, flush to the card's right edge. What
 * survives that crop depends entirely on the shape of the artwork's centre:
 *
 * - **Rectangular centre plate** — the plate's vertical edges become hard seams
 *   against the flat blue band, and any glyph poking outside the plate gets
 *   clipped mid-shape. The result reads as a broken or mis-tiled image, which
 *   caps the perceived quality of everything else on the card.
 * - **Circular centre** — blue flows continuously around the disc, so there are
 *   no straight edges to read as seams and the glyph stays contained. This is
 *   the only shape that survives.
 *
 * Two consequences worth stating plainly:
 *
 * 1. Every document-themed asset in this set has a rectangular centre, because
 *    a document icon is a rectangle. The assets that match "drafter" are exactly
 *    the ones that mis-tile — there is nothing that is both document-semantic
 *    and strip-clean. This choice trades semantic precision for a clean band,
 *    deliberately.
 * 2. The magnifier reads as "review", not "draft". Adjacent, not exact. It is
 *    acceptable because it carries no *wrong* signal — no prohibition (the
 *    original blocker-checker read as a no-entry sign), no premature checkmark —
 *    and because the card's own prompt line is "Repeating RFP review manually
 *    every time?", which a magnifier matches better than a document would.
 *
 * General lesson: judge the crop at the size and framing it ships in. Both bad
 * picks looked fine inside the whole card at 1x and only fell apart when the
 * 48px strip was viewed in isolation, magnified.
 */
const RFP_DRAFTER_ARTWORK_SRC = "/avatar-agent-new/blue/comms-drafter.svg";
const CREATION_DURATION_MS = 900;

function getDemoPrimaryActionLabel(status: FloatingRovoButtonOnboardingStatus): string {
	if (status === "creating") {
		return "Creating";
	}

	if (status === "created") {
		return "Created";
	}

	return "Create";
}

function getDemoStatusLabel(status: FloatingRovoButtonOnboardingStatus): string | undefined {
	if (status === "creating") {
		return "Creating...";
	}

	if (status === "created") {
		return "Created";
	}

	return undefined;
}

export interface RovoButtonDemoOnboarding {
	config: FloatingRovoButtonOnboardingConfig;
	/** Collapses the panel so another variant can take the stage. */
	close: () => void;
}

/**
 * Demo-only agent-creation panel. `onOpened` fires whenever the panel takes the
 * stage, so the caller can stand down any competing affordance.
 */
export function useRovoButtonDemoOnboarding({
	onOpened,
}: Readonly<{ onOpened: () => void }>): RovoButtonDemoOnboarding {
	const [isOpen, setIsOpen] = useState(false);
	const [status, setStatus] = useState<FloatingRovoButtonOnboardingStatus>("idle");

	useEffect(() => {
		if (status !== "creating") {
			return;
		}

		const completionTimer = window.setTimeout(() => setStatus("created"), CREATION_DURATION_MS);
		return () => window.clearTimeout(completionTimer);
	}, [status]);

	const close = useCallback(() => setIsOpen(false), []);

	const handleOpenChange = useCallback((open: boolean) => {
		setIsOpen(open);
		if (open) {
			setStatus("idle");
			onOpened();
		}
	}, [onOpened]);

	const handlePrimaryAction = useCallback(() => setStatus("creating"), []);
	const handleSecondaryAction = useCallback(() => setStatus("idle"), []);

	const config = useMemo<FloatingRovoButtonOnboardingConfig>(() => ({
		id: "rovo-button-rfp-drafter-onboarding-demo",
		title: "Create a new agent",
		agentName: "RFP Drafter",
		byline: "By you",
		description: "Proactively assists by automatically suggesting subtasks when you start adding one and providing comment summaries.",
		prompt: "Repeating RFP review manually every time? We can automate it.",
		primaryActionLabel: getDemoPrimaryActionLabel(status),
		secondaryActionLabel: "Not now",
		avatarSrc: RFP_DRAFTER_ARTWORK_SRC,
		coverSrc: RFP_DRAFTER_ARTWORK_SRC,
		avatarAlt: "",
		closeLabel: "Dismiss create agent preview",
		status,
		statusLabel: getDemoStatusLabel(status),
		primaryActionDisabled: status !== "idle",
		open: isOpen,
		openOnButtonClick: true,
		onOpenChange: handleOpenChange,
		onPrimaryAction: handlePrimaryAction,
		onSecondaryAction: handleSecondaryAction,
	}), [handleOpenChange, handlePrimaryAction, handleSecondaryAction, isOpen, status]);

	return useMemo(() => ({ config, close }), [close, config]);
}
