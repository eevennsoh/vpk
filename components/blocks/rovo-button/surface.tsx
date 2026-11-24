"use client";

// oxlint-disable react-doctor/exhaustive-deps -- Effects in this file intentionally coordinate refs, external animation loops, timers, subscriptions, or measured DOM state; dependencies are constrained to avoid restarting those bridges.
// oxlint-disable react-doctor/no-derived-state -- These components maintain local derived display state for controlled animations, measurements, or draft editing that cannot be represented as render-only values without changing UX.
// oxlint-disable react-doctor/no-event-handler -- Effects in this file bridge external systems, animation/media state, timers, or parent-controlled state rather than user event handlers.

/* eslint-disable react-hooks/exhaustive-deps -- These callbacks/effects intentionally read stable refs that bridge external animation, drag, preview, and editor state. */

import { useLazyRef } from "@/lib/use-lazy-ref";
import {
	type MouseEvent as ReactMouseEvent,
	type PointerEvent as ReactPointerEvent,
	type ReactNode,
	type Ref,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	AnimatePresence,
	animate,
	motion,
	useIsPresent,
	useMotionValue,
	useTransform,
	type MotionStyle,
} from "motion/react";
import { AnimatedRovo } from "@/components/ui-custom/animated-rovo";
import { RovoColorIcon } from "@/components/ui/logo";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import {
	armClickSuppression,
	createInitialClickSuppressionState,
	handleClickWithSuppression,
	type FloatingRovoButtonClickSuppressionState,
} from "./floating-rovo-button-click-suppression";
import {
	clampFloatingRovoButtonValue,
	getClampedFloatingRovoButtonTarget,
	getDefaultFloatingRovoButtonSnapTarget,
	getFloatingRovoButtonDragConstraints,
	getFloatingRovoButtonLocalMeasurement,
	getNearestFloatingRovoButtonSnapTarget,
	resolveFloatingRovoButtonPersistentBarSide,
	resolveFloatingRovoButtonPlacement,
	FLOATING_ROVO_BUTTON_DRAG_CLICK_THRESHOLD,
	FLOATING_ROVO_BUTTON_END_INSET_VAR,
	type FloatingRovoButtonDragConstraints,
	type FloatingRovoButtonDragStart,
	type FloatingRovoButtonSnapTarget,
} from "./geometry";
import {
	FloatingRovoButtonDailyInsightsPanelInner,
	FloatingRovoButtonDailyInsightsPill,
} from "./daily-insights-panel";
import { restoreFloatingRovoButtonFocus } from "./focus-restore";
import {
	FLOATING_ROVO_BUTTON_CARD_ENTER,
	FLOATING_ROVO_BUTTON_CONTENT_EXIT,
	FLOATING_ROVO_BUTTON_MORPH_SPRING,
} from "./motion";
import { FloatingRovoButtonOnboardingPanelInner } from "./onboarding-panel";
import { FloatingRovoButtonPersistentBarRail } from "./persistent-bar";
import { NOTIFICATION_PANEL_CONTENT_ENTER, NotificationPanelMorph } from "./notification-panel-morph";
import { measureToolbarActionOrigin, type FloatingRovoButtonIndicatorOrigin } from "./indicator-origin";
import type {
	FloatingRovoButtonInsightsConfig,
	FloatingRovoButtonInsightsStage,
	FloatingRovoButtonOnboardingConfig,
	FloatingRovoButtonPanel,
	FloatingRovoButtonPersistentBar,
	FloatingRovoButtonPlacement,
	FloatingRovoButtonPositioning,
} from "./types";
import { motionDuration, motionEase } from "@/lib/motion";

const FLOATING_ROVO_BUTTON_CLICK_SUPPRESSION_MS = 1000;
const FLOATING_ROVO_BUTTON_LOGO_CYCLE_S = 2.5;
const FLOATING_ROVO_BUTTON_LOGO_CYCLE_MS = FLOATING_ROVO_BUTTON_LOGO_CYCLE_S * 1000;

function FloatingRovoButtonInner({
	onClick,
	onDragMouseDown,
	onDragPointerDown,
	onLogoPointerEnter,
	ariaLabel,
	opensDialog,
	logo,
	shouldReduceMotion,
	transitioning,
	ref,
}: Readonly<{
	onClick: () => void;
	onDragMouseDown: (event: ReactMouseEvent<HTMLButtonElement>) => void;
	onDragPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
	onLogoPointerEnter: (event: ReactPointerEvent<HTMLButtonElement>) => void;
	ariaLabel: string;
	opensDialog: boolean;
	logo: ReactNode;
	shouldReduceMotion: boolean;
	transitioning: boolean;
	ref?: Ref<HTMLButtonElement>;
}>) {
	const isPresent = useIsPresent();
	if (opensDialog && !isPresent) return null;

	return (
		<motion.button
			key="floating-rovo-button-icon"
			ref={ref}
			aria-haspopup={opensDialog ? "dialog" : undefined}
			aria-label={ariaLabel}
			// Keep the native click target mounted when first-hover animation swaps logos.
			className="flex h-full w-full items-center justify-center rounded-2xl bg-bg-neutral-bold *:pointer-events-none"
			onClick={onClick}
			onMouseDownCapture={onDragMouseDown}
			onPointerEnter={onLogoPointerEnter}
			onPointerDownCapture={onDragPointerDown}
			type="button"
			initial={transitioning ? false : shouldReduceMotion
				? { opacity: 0 }
				: { opacity: 0, filter: "blur(6px)" }}
			animate={shouldReduceMotion
				? { opacity: 1 }
				: { opacity: 1, filter: "blur(0px)" }}
			exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transition: FLOATING_ROVO_BUTTON_CONTENT_EXIT }}
			transition={shouldReduceMotion
				? { duration: 0 }
				: { duration: 0.2, delay: 0.24, ease: motionEase.out }}
			style={{
				boxShadow: token("elevation.shadow.overlay"),
				willChange: "opacity, filter",
			}}
		>
			{logo}
		</motion.button>
	);
}

export function FloatingRovoButtonSurface({
	animateLogoOnMount,
	panel,
	onboardingOpen,
	onboarding,
	onOpenChange,
	insights,
	insightsStage,
	onInsightsDismiss,
	onInsightsPrimaryAction,
	onInsightsSecondaryAction,
	placement,
	positioning = "viewport",
	ariaLabel,
	onButtonClick,
	persistentBar,
	shouldReduceMotion,
	logoAnimationTrigger,
}: Readonly<{
	animateLogoOnMount: boolean;
	panel?: FloatingRovoButtonPanel;
	onboardingOpen: boolean;
	onboarding: FloatingRovoButtonOnboardingConfig | null | undefined;
	onOpenChange: (open: boolean) => void;
	insights: FloatingRovoButtonInsightsConfig | null | undefined;
	insightsStage: FloatingRovoButtonInsightsStage;
	onInsightsDismiss: () => void;
	onInsightsPrimaryAction: () => void;
	onInsightsSecondaryAction: () => void;
	placement?: FloatingRovoButtonPlacement;
	positioning?: FloatingRovoButtonPositioning;
	ariaLabel: string;
	onButtonClick: () => void;
	persistentBar: FloatingRovoButtonPersistentBar | null | undefined;
	shouldReduceMotion: boolean;
	logoAnimationTrigger?: string;
}>) {
	const resolvedPlacement = resolveFloatingRovoButtonPlacement(placement);
	const [indicatorOrigin, setIndicatorOrigin] = useState<FloatingRovoButtonIndicatorOrigin | null>(null);
	const [indicatorMorphComplete, setIndicatorMorphComplete] = useState(false);
	// The toolbar action measured where it last came to rest. The button and its rail unmount while Rovo chat is open,
	// so a panel opened from there cannot measure the action; it opens from and closes into this instead.
	const [restingOrigin, setRestingOrigin] = useState<FloatingRovoButtonIndicatorOrigin | null>(null);
	const [wasPanelOpen, setWasPanelOpen] = useState(Boolean(panel?.open));
	if (Boolean(panel?.open) !== wasPanelOpen) {
		setWasPanelOpen(Boolean(panel?.open));
		if (panel?.open && restingOrigin) {
			if (panel.openFrom) {
				// Another surface (Rovo chat) condenses into the panel, which later closes into the action.
				setIndicatorOrigin({ ...restingOrigin, bounds: panel.openFrom, variant: "surface", returnTo: restingOrigin });
				setIndicatorMorphComplete(false);
			} else if (!panel.openFromIndicator) {
				// A plain open has no flight in, but still closes into the action like every other panel.
				setIndicatorOrigin(restingOrigin);
				setIndicatorMorphComplete(true);
			}
		}
	}
	const finishIndicatorMorph = useCallback(() => {
		if (panel?.closingToIndicator) panel.onCloseComplete?.();
		else {
			// Having landed, a panel that flew in from another surface closes back into its toolbar action.
			setIndicatorOrigin((origin) => origin?.returnTo ?? origin);
			setIndicatorMorphComplete(true);
		}
	}, [panel?.closingToIndicator, panel?.onCloseComplete]);
	const cardOpen = Boolean(panel?.open || onboardingOpen || insightsStage === "card");
	const opensFromIndicator = Boolean(panel?.open && !panel.closingToIndicator && (panel.openFromIndicator || panel.openFrom) && indicatorOrigin && !shouldReduceMotion);
	const closingToIndicator = Boolean(panel?.open && panel.closingToIndicator && indicatorOrigin && indicatorMorphComplete && !shouldReduceMotion);
	const indicatorTransition = opensFromIndicator || closingToIndicator;
	const morphingIndicator = closingToIndicator || (opensFromIndicator && !indicatorMorphComplete);
	const surfaceOwnsElevation = cardOpen;
	const configuredBarSide = persistentBar?.side ?? "auto";
	const [barSide, setBarSide] = useState<"top" | "bottom">(
		configuredBarSide === "bottom" ? "bottom" : "top",
	);
	useEffect(() => {
		if (panel?.closingToIndicator && (!indicatorOrigin || !indicatorMorphComplete)) panel.onCloseComplete?.();
	}, [indicatorMorphComplete, indicatorOrigin, panel?.closingToIndicator, panel?.onCloseComplete]);
	// Drives the persistent bar's exit/enter: it tucks away once a drag actually
	// moves the button and springs back when the drag is released.
	const [isDragging, setIsDragging] = useState(false);
	if (cardOpen && isDragging) setIsDragging(false);
	const surfaceRef = useRef<HTMLDivElement | null>(null);
	const launchersRef = useRef<HTMLDivElement>(null);
	const buttonX = useMotionValue(0);
	const buttonY = useMotionValue(0);
	const pinnedLauncherX = useTransform(buttonX, (value) => -value);
	const pinnedLauncherY = useTransform(buttonY, (value) => -value);
	const [dragOrigin, setDragOrigin] = useState<FloatingRovoButtonSnapTarget | null>(null);
	const [dragConstraints, setDragConstraints] = useState<FloatingRovoButtonDragConstraints>({
		bottom: 0,
		left: 0,
		right: 0,
		top: 0,
	});
	const initializedPositionKeyRef = useRef<string | null>(null);
	const skipNextSnapToGridRef = useRef(false);
	// The button only leaves the bottom-right corner once the user has actually
	// dragged it. Until then every re-measure (mount, onboarding expand/collapse,
	// viewport/container resize) re-anchors to the default corner instead of
	// snapping to the nearest grid cell, so it never drifts on its own.
	//
	// The ref drives the measurement callbacks; the state drives `surfaceStyle`.
	// Before the first drag the surface is pinned with CSS `right`/`bottom` so a
	// live window/container resize keeps it glued to the corner every frame —
	// re-measuring `left`/`top` through React state cannot keep up with a
	// continuous drag of the window edge and visibly lags behind.
	const hasUserDraggedRef = useRef(false);
	const [hasUserDragged, setHasUserDragged] = useState(false);
	const dragPointerStartRef = useRef<FloatingRovoButtonDragStart | null>(null);
	const suppressDragClickStateRef = useLazyRef<FloatingRovoButtonClickSuppressionState>(() =>
		createInitialClickSuppressionState(),
	);
	const suppressDragClickTimeoutRef = useRef<number | null>(null);
	const logoAnimationPlayedRef = useRef(false);
	const logoAnimationTimeoutRef = useRef<number | null>(null);
	// Separate refs rather than one shared ref: `AnimatePresence` keeps the
	// outgoing control mounted while the incoming one mounts, so a single ref
	// would be cleared by the loser of that overlap.
	const insightsPillRef = useRef<HTMLButtonElement | null>(null);
	const collapsedButtonRef = useRef<HTMLButtonElement | null>(null);
	const previousCardOpenRef = useRef<boolean>(cardOpen);
	const [logoAnimating, setLogoAnimating] = useState(false);
	const [logoAnimationRun, setLogoAnimationRun] = useState(0);
	const [endInset, setEndInset] = useState("");
	const surfaceTransition = shouldReduceMotion
		? { duration: 0 }
		: FLOATING_ROVO_BUTTON_MORPH_SPRING;
	const radiusTransition = shouldReduceMotion
		? { duration: 0 }
		: { duration: 0.28, ease: "linear" as const };
	const surfaceStyle: MotionStyle = {
		// Un-dragged: pin with CSS so the browser re-anchors the corner on every
		// resize frame — including `--untracked-panel-width` changes, which the
		// default `right` calc reads without a React re-measure. Dragged: use
		// the measured origin the drag math owns. Promoting to `left`/`top` at
		// drag start measures the already-inset box, so it does not jump.
		...(dragOrigin && hasUserDragged
			? {
					left: dragOrigin.left,
					top: dragOrigin.top,
				}
			: {
					right: resolvedPlacement.right,
					bottom: resolvedPlacement.bottom,
				}),
		x: buttonX,
		y: buttonY,
		transformOrigin: "center",
		willChange: "transform, opacity",
		backfaceVisibility: "hidden",
		touchAction: cardOpen ? undefined : "none",
		visibility: dragOrigin ? undefined : "hidden",
	};
	const hoverScale = !cardOpen && !shouldReduceMotion ? { scale: 1.1 } : undefined;
	const tapScale = !cardOpen && !shouldReduceMotion ? { scale: 0.98 } : undefined;
	const dragSnapTransition = useMemo(() => (
		shouldReduceMotion
			? { duration: 0 }
			: { type: "spring" as const, bounce: 0, stiffness: 540, damping: 42, mass: 0.7 }
	), [shouldReduceMotion]);
	const clearDragClickSuppressionTimeout = useCallback(() => {
		if (suppressDragClickTimeoutRef.current !== null) {
			window.clearTimeout(suppressDragClickTimeoutRef.current);
			suppressDragClickTimeoutRef.current = null;
		}
	}, []);
	const clearLogoAnimationTimeout = useCallback(() => {
		if (logoAnimationTimeoutRef.current !== null) {
			window.clearTimeout(logoAnimationTimeoutRef.current);
			logoAnimationTimeoutRef.current = null;
		}
	}, []);
	const startLogoAnimation = useCallback(() => {
		if (shouldReduceMotion) return;
		setLogoAnimationRun((run) => run + 1);
		setLogoAnimating(true);
		clearLogoAnimationTimeout();
		logoAnimationTimeoutRef.current = window.setTimeout(() => {
			logoAnimationTimeoutRef.current = null;
			setLogoAnimating(false);
		}, FLOATING_ROVO_BUTTON_LOGO_CYCLE_MS);
	}, [clearLogoAnimationTimeout, shouldReduceMotion]);
	const handleLogoPointerEnter = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
		if (event.pointerType !== "mouse" || shouldReduceMotion || logoAnimationPlayedRef.current) return;
		logoAnimationPlayedRef.current = true;
		startLogoAnimation();
	}, [shouldReduceMotion, startLogoAnimation]);
	useEffect(() => {
		if (!animateLogoOnMount || shouldReduceMotion) return;
		logoAnimationPlayedRef.current = true;
		const frame = window.requestAnimationFrame(startLogoAnimation);
		return () => {
			window.cancelAnimationFrame(frame);
			clearLogoAnimationTimeout();
			logoAnimationPlayedRef.current = false;
		};
	}, [animateLogoOnMount, clearLogoAnimationTimeout, shouldReduceMotion, startLogoAnimation]);
	useEffect(() => {
		if (!logoAnimationTrigger || shouldReduceMotion) return undefined;
		const frame = window.requestAnimationFrame(startLogoAnimation);
		return () => window.cancelAnimationFrame(frame);
	}, [logoAnimationTrigger, shouldReduceMotion, startLogoAnimation]);
	// Arm suppression when a drag actually moves the button.
	const armDragClickSuppression = useCallback(() => {
		suppressDragClickStateRef.current = armClickSuppression();
	}, []);
	// Safety net armed at drag end: if no trailing click ever arrives (e.g. the
	// drag ends away from the button), the suppression state still clears on its
	// own. It is intentionally NOT re-armed by clicks — see handleSuppressibleClick.
	const scheduleDragClickSuppressionReset = useCallback(() => {
		clearDragClickSuppressionTimeout();

		suppressDragClickTimeoutRef.current = window.setTimeout(() => {
			suppressDragClickStateRef.current = createInitialClickSuppressionState();
			suppressDragClickTimeoutRef.current = null;
		}, FLOATING_ROVO_BUTTON_CLICK_SUPPRESSION_MS);
	}, [clearDragClickSuppressionTimeout]);
	// Run a click through the one-shot suppression state machine. The browser
	// fires exactly one synthetic click at the end of a drag gesture; that single
	// click is swallowed and suppression is immediately cleared so the very next
	// click works normally. Re-arming the timer here would let rapid repeated
	// clicks keep suppression alive forever, which made the dragged button
	// impossible to open.
	const handleSuppressibleClick = useCallback(() => {
		const decision = handleClickWithSuppression(suppressDragClickStateRef.current);
		suppressDragClickStateRef.current = decision.next;

		if (decision.suppress) {
			clearDragClickSuppressionTimeout();
		}

		return decision.suppress;
	}, [clearDragClickSuppressionTimeout]);

	// Re-measures and parks the button at its default home — the bottom-right
	// corner (or the clamped `placement` when a consumer pins one). Clears any
	// live drag offset so the button sits exactly on the origin.
	const anchorToDefaultTarget = useCallback(() => {
		const surface = surfaceRef.current;

		if (!surface) {
			return;
		}

		const { rect, space } = getFloatingRovoButtonLocalMeasurement(surface, positioning);
		const target = placement
			? getClampedFloatingRovoButtonTarget(rect, space.width, space.height)
			: getDefaultFloatingRovoButtonSnapTarget(rect, space.width, space.height);

		buttonX.set(0);
		buttonY.set(0);
		setDragOrigin(target);
		setDragConstraints(getFloatingRovoButtonDragConstraints(target, rect, space.width, space.height));
		setBarSide(resolveFloatingRovoButtonPersistentBarSide(configuredBarSide, target.top, rect.height, space.height));
		skipNextSnapToGridRef.current = true;
	}, [buttonX, buttonY, configuredBarSide, placement, positioning]);

	useEffect(() => {
		const root = document.documentElement;
		const readEndInset = () => {
			setEndInset(
				getComputedStyle(root).getPropertyValue(FLOATING_ROVO_BUTTON_END_INSET_VAR).trim(),
			);
		};
		readEndInset();
		const observer = new MutationObserver(readEndInset);
		observer.observe(root, { attributes: true, attributeFilter: ["style"] });
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		const positionKey = `${positioning}:${resolvedPlacement.right}:${resolvedPlacement.bottom}:${endInset}`;

		if (initializedPositionKeyRef.current === positionKey) {
			return;
		}

		if (!surfaceRef.current) {
			return;
		}

		initializedPositionKeyRef.current = positionKey;
		if (hasUserDraggedRef.current) {
			return;
		}
		anchorToDefaultTarget();
	}, [anchorToDefaultTarget, endInset, positioning, resolvedPlacement.bottom, resolvedPlacement.right]);

	useEffect(() => {
		return () => {
			if (suppressDragClickTimeoutRef.current !== null) {
				window.clearTimeout(suppressDragClickTimeoutRef.current);
			}

			if (logoAnimationTimeoutRef.current !== null) {
				window.clearTimeout(logoAnimationTimeoutRef.current);
			}
		};
	}, []);

	useEffect(() => {
		const handleDocumentClick = (event: MouseEvent) => {
			if (handleSuppressibleClick()) {
				event.preventDefault();
				event.stopPropagation();
			}
		};

		document.addEventListener("click", handleDocumentClick, true);

		return () => {
			document.removeEventListener("click", handleDocumentClick, true);
		};
	}, [handleSuppressibleClick]);

	useEffect(() => {
		if (cardOpen) {
			dragPointerStartRef.current = null;
			suppressDragClickStateRef.current = createInitialClickSuppressionState();
			clearDragClickSuppressionTimeout();
		}
	}, [cardOpen, clearDragClickSuppressionTimeout]);

	// Closing either card hands focus back to the control that replaced it,
	// instead of letting the browser drop it on `<body>`. Keyed on `cardOpen`
	// rather than the insights stage so the onboarding panel gets the same
	// treatment — it had the identical defect. This runs after the transition
	// has committed because the pill and the collapsed launcher are different
	// nodes; during the close handler the replacement does not exist yet.
	useEffect(() => {
		const previousCardOpen = previousCardOpenRef.current;
		previousCardOpenRef.current = cardOpen;

		restoreFloatingRovoButtonFocus(
			previousCardOpen,
			cardOpen,
			insightsStage === "pill" ? insightsPillRef.current : collapsedButtonRef.current,
		);
	}, [cardOpen, insightsStage]);

	const snapToNearestGridTarget = useCallback(() => {
		if (!dragOrigin) {
			return;
		}

		const surface = surfaceRef.current;

		if (!surface) {
			return;
		}

		const { rect, space } = getFloatingRovoButtonLocalMeasurement(surface, positioning);
		const target = getNearestFloatingRovoButtonSnapTarget(rect, space.width, space.height);

		setDragConstraints(getFloatingRovoButtonDragConstraints(dragOrigin, rect, space.width, space.height));
		setBarSide(resolveFloatingRovoButtonPersistentBarSide(configuredBarSide, target.top, rect.height, space.height));
		buttonX.jump(buttonX.get());
		buttonY.jump(buttonY.get());
		animate(buttonX, target.left - dragOrigin.left, dragSnapTransition);
		animate(buttonY, target.top - dragOrigin.top, dragSnapTransition);
	}, [buttonX, buttonY, configuredBarSide, dragOrigin, dragSnapTransition, positioning]);

	useEffect(() => {
		if (!dragOrigin) {
			return;
		}

		if (skipNextSnapToGridRef.current) {
			skipNextSnapToGridRef.current = false;
			return;
		}

		// Onboarding expand/collapse and each insights stage change the surface
		// size. Re-fit to the nearest grid cell only if the user has positioned
		// the button; otherwise keep it pinned to the default corner.
		if (hasUserDraggedRef.current) {
			snapToNearestGridTarget();
		} else {
			anchorToDefaultTarget();
		}
	}, [anchorToDefaultTarget, cardOpen, dragOrigin, insightsStage, snapToNearestGridTarget]);

	useEffect(() => {
		if (!dragOrigin) {
			return undefined;
		}

		const handleResize = () => {
			// A resize never moves the button off the default corner unless the
			// user has dragged it — then we keep it on the nearest grid cell.
			// While un-dragged the corner is held by CSS, so this only refreshes
			// the measured origin and constraints the drag math reads later.
			if (hasUserDraggedRef.current) {
				snapToNearestGridTarget();
			} else {
				anchorToDefaultTarget();
			}
		};

		window.addEventListener("resize", handleResize);

		// `positioning="container"` hosts resize without a window resize (side
		// panel opening, rail collapsing), which would otherwise leave the
		// measured origin stale and make the first drag jump.
		const coordinateSpace = positioning === "container"
			? surfaceRef.current?.offsetParent
			: null;
		const observer = coordinateSpace instanceof HTMLElement && typeof ResizeObserver !== "undefined"
			? new ResizeObserver(handleResize)
			: null;

		if (observer && coordinateSpace instanceof HTMLElement) {
			observer.observe(coordinateSpace);
		}

		return () => {
			window.removeEventListener("resize", handleResize);
			observer?.disconnect();
		};
	}, [anchorToDefaultTarget, dragOrigin, positioning, snapToNearestGridTarget]);

	const handleDragPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
		if (cardOpen || !dragOrigin) {
			return;
		}

		event.currentTarget.setPointerCapture(event.pointerId);
		buttonX.stop();
		buttonY.stop();

		dragPointerStartRef.current = {
			offsetX: buttonX.get(),
			offsetY: buttonY.get(),
			pointerId: event.pointerId,
			x: event.clientX,
			y: event.clientY,
		};
	}, [buttonX, buttonY, cardOpen, dragOrigin]);
	const handleDragMouseDown = useCallback((event: ReactMouseEvent<HTMLElement>) => {
		if (event.button !== 0 || cardOpen || !dragOrigin || dragPointerStartRef.current) {
			return;
		}

		buttonX.stop();
		buttonY.stop();

		dragPointerStartRef.current = {
			offsetX: buttonX.get(),
			offsetY: buttonY.get(),
			pointerId: null,
			x: event.clientX,
			y: event.clientY,
		};
	}, [buttonX, buttonY, cardOpen, dragOrigin]);
	const updateDragPosition = useCallback((clientX: number, clientY: number, pointerId?: number) => {
		const start = dragPointerStartRef.current;

		if (!start || (pointerId !== undefined && start.pointerId !== null && pointerId !== start.pointerId)) {
			return;
		}

		const deltaX = clientX - start.x;
		const deltaY = clientY - start.y;
		const dragDistance = Math.hypot(deltaX, deltaY);

		if (dragDistance <= FLOATING_ROVO_BUTTON_DRAG_CLICK_THRESHOLD) {
			return;
		}

		// The user has intentionally moved the button; from now on resizes and
		// onboarding toggles snap to the nearest grid cell instead of re-homing.
		hasUserDraggedRef.current = true;
		setHasUserDragged(true);
		armDragClickSuppression();
		setIsDragging(true);
		buttonX.set(clampFloatingRovoButtonValue(start.offsetX + deltaX, dragConstraints.left, dragConstraints.right));
		buttonY.set(clampFloatingRovoButtonValue(start.offsetY + deltaY, dragConstraints.top, dragConstraints.bottom));
	}, [armDragClickSuppression, buttonX, buttonY, dragConstraints]);
	const endDrag = useCallback((pointerId?: number) => {
		const start = dragPointerStartRef.current;

		if (!start || (pointerId !== undefined && start.pointerId !== null && pointerId !== start.pointerId)) {
			return;
		}

		dragPointerStartRef.current = null;
		setIsDragging(false);

		if (!suppressDragClickStateRef.current.active) {
			return;
		}

		scheduleDragClickSuppressionReset();
		snapToNearestGridTarget();
	}, [scheduleDragClickSuppressionReset, snapToNearestGridTarget]);

	useEffect(() => {
		const handleDocumentPointerMove = (event: PointerEvent) => {
			updateDragPosition(event.clientX, event.clientY, event.pointerId);
		};
		const handleDocumentPointerEnd = (event: PointerEvent) => {
			updateDragPosition(event.clientX, event.clientY, event.pointerId);
			endDrag(event.pointerId);
		};
		const handleDocumentMouseMove = (event: MouseEvent) => {
			updateDragPosition(event.clientX, event.clientY);
		};
		const handleDocumentMouseEnd = (event: MouseEvent) => {
			updateDragPosition(event.clientX, event.clientY);
			endDrag();
		};

		document.addEventListener("pointermove", handleDocumentPointerMove, true);
		document.addEventListener("pointerup", handleDocumentPointerEnd, true);
		document.addEventListener("pointercancel", handleDocumentPointerEnd, true);
		document.addEventListener("mousemove", handleDocumentMouseMove, true);
		document.addEventListener("mouseup", handleDocumentMouseEnd, true);

		return () => {
			document.removeEventListener("pointermove", handleDocumentPointerMove, true);
			document.removeEventListener("pointerup", handleDocumentPointerEnd, true);
			document.removeEventListener("pointercancel", handleDocumentPointerEnd, true);
			document.removeEventListener("mousemove", handleDocumentMouseMove, true);
			document.removeEventListener("mouseup", handleDocumentMouseEnd, true);
		};
	}, [endDrag, updateDragPosition]);
	const handleClickCapture = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
		if (handleSuppressibleClick()) {
			event.preventDefault();
			event.stopPropagation();
		}
	}, [handleSuppressibleClick]);
	const handleButtonClick = useCallback(() => {
		if (handleSuppressibleClick()) {
			return;
		}

		const surface = surfaceRef.current;
		const origin = surface ? measureToolbarActionOrigin(surface, panel?.indicatorActionId, positioning, persistentBar?.panelTransition === "dot") : null;
		if (origin) {
			setIndicatorOrigin(origin);
			setIndicatorMorphComplete(true);
		}
		onButtonClick();
	}, [handleSuppressibleClick, onButtonClick, panel?.indicatorActionId, persistentBar?.panelTransition, positioning]);
	const logo = logoAnimating && !shouldReduceMotion ? (
		<AnimatedRovo.Root key={`animated-rovo-logo-${logoAnimationRun}`} size={24} preset="full-cycle" cycleDurationS={FLOATING_ROVO_BUTTON_LOGO_CYCLE_S} />
	) : <RovoColorIcon key="static-rovo-logo" size="small" />;

	return (
		<motion.div
			ref={surfaceRef}
			key="floating-rovo-button-surface"
			layout={!indicatorTransition}
			data-notification-opening={morphingIndicator || undefined}
			className={cn(
				"z-[510]",
				surfaceOwnsElevation && !morphingIndicator ? "shadow-2xl" : null,
				morphingIndicator ? "bg-transparent" : panel?.open ? "bg-surface-overlay" : panel || (insightsStage === "pill" && !cardOpen) ? "bg-transparent" : "bg-bg-neutral-bold",
				shouldReduceMotion || indicatorTransition ? null : "transition-[background-color] duration-slow ease-out",
				positioning === "container" ? "absolute" : "fixed",
				!cardOpen ? "cursor-grab active:cursor-grabbing" : null,
				// Three geometries, one `layout` element: the 48px button grows into
				// the pill, and the pill grows into the card.
				cardOpen
					? cn(!morphingIndicator && "overflow-hidden", panel?.open ? "w-fit" : "w-[295px] max-w-[calc(100vw-32px)]")
					: insightsStage === "pill"
						? "h-12 w-fit max-w-[calc(100vw-32px)]"
						: "size-12",
			)}
			initial={{ opacity: 0, borderRadius: cardOpen ? 8 : 16 }}
			animate={{
				opacity: 1,
				borderRadius: cardOpen ? 8 : 16,
			}}
			exit={{ opacity: 0 }}
			transition={{
				default: surfaceTransition,
				layout: panel?.open && !shouldReduceMotion ? { duration: motionDuration.slow, ease: motionEase.out } : undefined,
				borderRadius: radiusTransition,
			}}
			style={surfaceStyle}
			onClickCapture={handleClickCapture}
		>
			{morphingIndicator && indicatorOrigin ? (
				<NotificationPanelMorph
					origin={indicatorOrigin.bounds}
					variant={indicatorOrigin.variant}
					actionId={panel?.indicatorActionId}
					closing={closingToIndicator}
					launcherOrigin={indicatorOrigin.launcher}
					anchor={indicatorOrigin.anchor}
					launchersRef={launchersRef}
					surfaceRef={surfaceRef}
					launcherX={pinnedLauncherX}
					launcherY={pinnedLauncherY}
					onComplete={finishIndicatorMorph}
				/>
			) : null}
			{panel?.open ? (
				<motion.div
					key={panel.id}
					className={indicatorTransition ? "relative z-20" : undefined}
					initial={shouldReduceMotion ? false : opensFromIndicator ? { opacity: 0, filter: "blur(5px)" } : { opacity: 0 }}
					animate={indicatorTransition ? { opacity: morphingIndicator ? 0 : 1, filter: morphingIndicator ? "blur(5px)" : "blur(0px)" } : { opacity: 1 }}
					onAnimationComplete={() => { if (!morphingIndicator && !panel.closingToIndicator) panel.onOpenComplete?.(); }}
					transition={shouldReduceMotion ? { duration: 0 } : indicatorTransition ? NOTIFICATION_PANEL_CONTENT_ENTER : FLOATING_ROVO_BUTTON_CARD_ENTER}
				>
					{panel.content}
				</motion.div>
			) : null}
			<motion.div
				ref={launchersRef}
				className={morphingIndicator ? "pointer-events-none absolute z-20 size-12 rounded-2xl" : "contents"}
				data-notification-launchers={morphingIndicator || undefined}
				inert={morphingIndicator || undefined}
				style={morphingIndicator ? { x: pinnedLauncherX, y: pinnedLauncherY } : { borderRadius: "inherit" }}
			>
				{/* Hover/tap scale lives on this inner wrapper, not the surface, so the
				    persistent bar (a sibling below) is not dragged around by the
				    button's hover animation. */}
				<motion.div
					className="h-full w-full"
					style={{ borderRadius: "inherit", transformOrigin: "center", willChange: "transform" }}
					whileHover={hoverScale}
					whileTap={tapScale}
				>
					<AnimatePresence mode="popLayout" initial={false}>
						{panel?.open && !morphingIndicator ? null : onboardingOpen && onboarding ? (
							<FloatingRovoButtonOnboardingPanelInner
								key="panel"
								onboarding={onboarding}
								onOpenChange={onOpenChange}
								shouldReduceMotion={shouldReduceMotion}
							/>
						) : insightsStage === "card" && insights ? (
							<FloatingRovoButtonDailyInsightsPanelInner
								key="insights-card"
								insights={insights}
								onDismiss={onInsightsDismiss}
								onPrimaryAction={onInsightsPrimaryAction}
								onSecondaryAction={onInsightsSecondaryAction}
								shouldReduceMotion={shouldReduceMotion}
							/>
						) : insightsStage === "pill" && insights ? (
							<FloatingRovoButtonDailyInsightsPill
								key="insights-pill"
								ref={insightsPillRef}
								insights={insights}
								logo={logo}
								onClick={handleButtonClick}
								onLogoPointerEnter={handleLogoPointerEnter}
								onDragMouseDown={handleDragMouseDown}
								onDragPointerDown={handleDragPointerDown}
								shouldReduceMotion={shouldReduceMotion}
							/>
						) : (
							<FloatingRovoButtonInner
								key="button"
								ref={collapsedButtonRef}
								onClick={handleButtonClick}
								onDragMouseDown={handleDragMouseDown}
								onDragPointerDown={handleDragPointerDown}
								onLogoPointerEnter={handleLogoPointerEnter}
								ariaLabel={ariaLabel}
								opensDialog={Boolean(panel)}
								logo={logo}
								shouldReduceMotion={shouldReduceMotion}
								transitioning={morphingIndicator}
							/>
						)}
					</AnimatePresence>
				</motion.div>
				<AnimatePresence custom={indicatorTransition}>
					{persistentBar && persistentBar.items.length > 0 && dragOrigin && (!cardOpen || morphingIndicator) && !isDragging ? (
						<FloatingRovoButtonPersistentBarRail
							key="persistent-bar"
							bar={persistentBar}
							indicatorActionId={panel?.indicatorActionId}
							indicatorInFlight={morphingIndicator}
							onIndicatorPress={() => {
								const surface = surfaceRef.current;
								const origin = surface ? measureToolbarActionOrigin(surface, panel?.indicatorActionId, positioning, persistentBar.panelTransition === "dot") : null;
								if (!origin) return;
								setIndicatorOrigin(origin);
								setIndicatorMorphComplete(false);
							}}
							onSettled={() => {
								const surface = surfaceRef.current;
								const origin = surface ? measureToolbarActionOrigin(surface, panel?.indicatorActionId, positioning, false) : null;
								if (origin) setRestingOrigin(origin);
							}}
							side={morphingIndicator && indicatorOrigin ? indicatorOrigin.side : barSide}
							shouldReduceMotion={shouldReduceMotion}
						/>
					) : null}
				</AnimatePresence>
			</motion.div>
		</motion.div>
	);
}
