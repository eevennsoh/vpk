"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import { useRovoChatControls } from "@/app/contexts/context-rovo-chat-controls";
import { FloatingRovoButtonNudge } from "./nudge";
import { FloatingRovoButtonSurface } from "./surface";
import type { FloatingRovoButtonInsightsStage, FloatingRovoButtonProps } from "./types";

export type {
	FloatingRovoButtonInsightRow,
	FloatingRovoButtonInsightsConfig,
	FloatingRovoButtonInsightsStage,
	FloatingRovoButtonOnboardingConfig,
	FloatingRovoButtonOnboardingStatus,
	FloatingRovoButtonPersistentBar,
	FloatingRovoButtonPersistentBarItem,
	FloatingRovoButtonPersistentBarSide,
	FloatingRovoButtonPlacement,
	FloatingRovoButtonPositioning,
	FloatingRovoButtonSuggestion,
} from "./types";

export default function FloatingRovoButton({
	product,
	embedded = false,
	forceVisible = false,
	ariaLabel,
	placement,
	positioning = "viewport",
	onButtonClick,
	suggestion,
	onboarding,
	insights,
	persistentBar,
}: Readonly<FloatingRovoButtonProps>) {
	const { isOpen, openChat } = useRovoChatControls();
	const shouldReduceMotion = Boolean(useReducedMotion());
	const [internalOnboardingOpen, setInternalOnboardingOpen] = useState(onboarding?.defaultOpen ?? false);
	// `onboarding` and `insights` morph the same surface, so a consumer that
	// supplies both gets onboarding and the insights config is ignored rather
	// than fighting it for the geometry.
	const activeInsights = onboarding ? null : insights ?? null;
	const [internalInsightsStage, setInternalInsightsStage] = useState<FloatingRovoButtonInsightsStage>(
		activeInsights?.defaultStage ?? "pill",
	);
	const shouldShowButton = forceVisible || !isOpen;
	const onboardingDefaultOpen = onboarding?.defaultOpen ?? false;
	const onboardingId = onboarding?.id;
	const onboardingOpen = Boolean(onboarding && (onboarding.open ?? internalOnboardingOpen));
	const shouldOpenOnboardingFromButton = Boolean(onboarding && (onboarding.openOnButtonClick ?? true));
	const insightsId = activeInsights?.id;
	const insightsDefaultStage = activeInsights?.defaultStage ?? "pill";
	// Nothing unread means nothing to announce: the affordance collapses and the
	// button goes back to being a plain chat launcher whatever `defaultStage` says.
	const insightsStage: FloatingRovoButtonInsightsStage = !activeInsights || activeInsights.count <= 0
		? "hidden"
		: activeInsights.stage ?? internalInsightsStage;
	const resolvedAriaLabel = ariaLabel ?? (shouldOpenOnboardingFromButton ? "Open onboarding" : "Open Rovo");
	const shouldSuppressSurface = embedded || product === "rovo" || product === "studio";
	// An open insights card holds the surface mounted for the same reason an open
	// onboarding panel does: the card is the surface, so letting `isOpen` unmount
	// it would tear the card away mid-read.
	const insightsCardOpen = insightsStage === "card";
	const shouldRenderSurface = (shouldShowButton || onboardingOpen || insightsCardOpen) && (forceVisible || !shouldSuppressSurface);

	useEffect(() => {
		if (onboardingId) {
			setInternalOnboardingOpen(onboardingDefaultOpen);
		}
	}, [onboardingDefaultOpen, onboardingId]);

	useEffect(() => {
		if (insightsId) {
			setInternalInsightsStage(insightsDefaultStage);
		}
	}, [insightsDefaultStage, insightsId]);

	const setOnboardingOpen = useCallback((open: boolean) => {
		if (onboarding?.open === undefined) {
			setInternalOnboardingOpen(open);
		}
		onboarding?.onOpenChange?.(open);
	}, [onboarding]);
	const setInsightsStage = useCallback((stage: FloatingRovoButtonInsightsStage) => {
		if (activeInsights?.stage === undefined) {
			setInternalInsightsStage(stage);
		}
		activeInsights?.onStageChange?.(stage);
	}, [activeInsights]);
	// Dismissing marks nothing read, so this deliberately never reaches for
	// `onPrimaryAction` — only the primary action advances the watermark.
	const handleInsightsDismiss = useCallback(() => {
		setInsightsStage("hidden");
		activeInsights?.onDismiss?.();
	}, [activeInsights, setInsightsStage]);
	const handleInsightsPrimaryAction = useCallback(() => {
		activeInsights?.onPrimaryAction?.();
	}, [activeInsights]);
	const handleInsightsSecondaryAction = useCallback(() => {
		// Same shape as the onboarding panel's secondary action: it closes the
		// card. It collapses to the pill rather than to `"hidden"` because asking
		// Rovo about the week does not mark the week read.
		setInsightsStage("pill");

		if (activeInsights?.onSecondaryAction) {
			activeInsights.onSecondaryAction();
			return;
		}

		openChat("floating");
	}, [activeInsights, openChat, setInsightsStage]);

	if (!forceVisible && (embedded || product === "rovo" || product === "studio")) {
		return null;
	}

	const handleButtonClick = () => {
		if (onButtonClick) {
			onButtonClick();
			return;
		}

		if (shouldOpenOnboardingFromButton) {
			setOnboardingOpen(true);
			return;
		}

		if (insightsStage === "pill") {
			setInsightsStage("card");
			return;
		}

		openChat("floating");
	};

	return (
		<>
			<AnimatePresence>
				{/* The nudge sits beside the button and the insights pill grows out of
				    it, both toward the same open space — they can never share it. */}
				{suggestion && shouldShowButton && !onboardingOpen && insightsStage === "hidden" ? (
					<FloatingRovoButtonNudge
						key={suggestion.id}
						placement={placement}
						positioning={positioning}
						shouldReduceMotion={shouldReduceMotion}
						suggestion={suggestion}
					/>
				) : null}
			</AnimatePresence>
			<AnimatePresence>
				{shouldRenderSurface ? (
					<FloatingRovoButtonSurface
						key="surface"
						onboardingOpen={onboardingOpen}
						onboarding={onboarding}
						onOpenChange={setOnboardingOpen}
						insights={activeInsights}
						insightsStage={insightsStage}
						onInsightsDismiss={handleInsightsDismiss}
						onInsightsPrimaryAction={handleInsightsPrimaryAction}
						onInsightsSecondaryAction={handleInsightsSecondaryAction}
						placement={placement}
						positioning={positioning}
						ariaLabel={resolvedAriaLabel}
						onButtonClick={handleButtonClick}
						persistentBar={persistentBar}
						shouldReduceMotion={shouldReduceMotion}
					/>
				) : null}
			</AnimatePresence>
		</>
	);
}
