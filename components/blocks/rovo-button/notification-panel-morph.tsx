"use client";

import { animate, type MotionValue } from "motion/react";
import { useLayoutEffect, useRef, type RefObject } from "react";
import { motionDuration, motionEase } from "@/lib/motion";
import { token } from "@/lib/tokens";

import type { FloatingRovoButtonMorphVariant } from "./indicator-origin";

const SHELL_DURATION = motionDuration.slowest;
const PANEL_RADIUS = 8;
const MORPH_TIMES = [0, 0.16, 0.4, 0.52, 0.64, 0.76, 0.9, 1];

export const NOTIFICATION_PANEL_CONTENT_ENTER = {
	duration: motionDuration.fast,
	ease: motionEase.outPractical,
} as const;

export type NotificationPanelAnchor = Readonly<{
	element: HTMLElement;
	x: number;
	y: number;
	scrollLeft: number;
	scrollTop: number;
}>;

function frameAt(x: number, y: number, width: number, height: number, radius: number) {
	return { left: x - width / 2, top: y - height / 2, width, height, radius };
}

function getMorphFrames(origin: DOMRect, target: DOMRect, variant: FloatingRovoButtonMorphVariant) {
	const x = origin.left + origin.width / 2;
	const y = origin.top + origin.height / 2;
	const targetX = target.left + target.width / 2;
	const targetY = target.top + target.height / 2;
	const rise = targetY - y;
	const lift = Math.sign(rise) * Math.min(64, Math.abs(rise) * 0.55);
	const dotRadius = Math.min(origin.width, origin.height) / 2;
	const grow = (widthProgress: number, heightProgress: number, riseProgress: number) =>
		frameAt(x + (targetX - x) * widthProgress, y + rise * riseProgress, origin.width + (target.width - origin.width) * widthProgress, origin.height + (target.height - origin.height) * heightProgress, PANEL_RADIUS);
	if (variant === "surface") {
		// Another panel (Rovo chat) condenses into this one: it draws in a touch first, then gathers into place, with
		// height leading width so it reads as the content settling rather than a box resizing.
		return [
			frameAt(x, y, origin.width, origin.height, 12),
			frameAt(x, y, origin.width * 0.98, origin.height * 0.98, 12),
			grow(0.08, 0.14, 0.1),
			grow(0.24, 0.38, 0.3),
			grow(0.48, 0.64, 0.56),
			grow(0.74, 0.86, 0.8),
			grow(0.93, 0.97, 0.95),
			grow(1, 1, 1),
		];
	}
	if (variant === "button") {
		return [
			frameAt(x, y, origin.width, origin.height, 16),
			frameAt(x, y, origin.width, origin.height, 16),
			frameAt(x + (targetX - x) * 0.04, y + rise * 0.04, origin.width * 1.15, origin.height * 1.15, 14),
			frameAt(x + (targetX - x) * 0.1, y + rise * 0.1, origin.width * 1.5, origin.height * 1.4, 12),
			grow(0.28, 0.16, 0.27),
			grow(0.61, 0.43, 0.72),
			grow(0.89, 0.83, 0.92),
			grow(1, 1, 1),
		];
	}

	return [
		frameAt(x, y, origin.width, origin.height, dotRadius),
		frameAt(x, y + lift * 0.42, origin.width, origin.height, dotRadius),
		frameAt(x, y + lift, origin.width, origin.height * 1.1, dotRadius),
		frameAt(x + (targetX - x) * 0.07, y + lift * 1.16, origin.width * 3, origin.height * 2, PANEL_RADIUS * 0.75),
		grow(0.24, 0.09, 0.47),
		grow(0.61, 0.43, 0.72),
		grow(0.89, 0.83, 0.92),
		grow(1, 1, 1),
	];
}

export function NotificationPanelMorph({
	origin, launcherOrigin, anchor, launchersRef, surfaceRef, launcherX, launcherY, actionId, variant, closing = false, onComplete,
}: Readonly<{
	origin: DOMRect;
	launcherOrigin: DOMRect;
	anchor: NotificationPanelAnchor | null;
	launchersRef: RefObject<HTMLDivElement | null>;
	surfaceRef: RefObject<HTMLDivElement | null>;
	launcherX: MotionValue<number>;
	launcherY: MotionValue<number>;
	actionId?: string;
	variant: FloatingRovoButtonMorphVariant;
	closing?: boolean;
	onComplete: () => void;
}>) {
	const overlayRef = useRef<HTMLDivElement>(null);
	const shapeRef = useRef<HTMLDivElement>(null);
	const shadowRef = useRef<HTMLSpanElement>(null);

	useLayoutEffect(() => {
		const overlay = overlayRef.current;
		const shape = shapeRef.current;
		const shadow = shadowRef.current;
		const surface = surfaceRef.current;
		const launchers = launchersRef.current;
		if (!overlay || !shape || !shadow || !surface || !launchers) return;
		const target = surface.getBoundingClientRect();
		if (!target.width || !target.height) { onComplete(); return; }

		const anchorBounds = anchor?.element.getBoundingClientRect();
		const offsetX = anchor && anchorBounds ? anchorBounds.x - anchor.x - (anchor.element.scrollLeft - anchor.scrollLeft) : 0;
		const offsetY = anchor && anchorBounds ? anchorBounds.y - anchor.y - (anchor.element.scrollTop - anchor.scrollTop) : 0;
		const currentOrigin = new DOMRect(origin.x + offsetX, origin.y + offsetY, origin.width, origin.height);
		const frames = getMorphFrames(currentOrigin, target, variant);
		const left = Math.min(...frames.map((frame) => frame.left));
		const top = Math.min(...frames.map((frame) => frame.top));
		const right = Math.max(...frames.map((frame) => frame.left + frame.width));
		const bottom = Math.max(...frames.map((frame) => frame.top + frame.height));
		const masks = frames.map((frame) => `inset(${frame.top - top}px ${right - frame.left - frame.width}px ${bottom - frame.top - frame.height}px ${frame.left - left}px round ${frame.radius}px)`);
		const sequence = <T,>(values: T[]) => closing ? [...values].reverse() : values;
		const times = (values: number[]) => closing ? values.map((time) => 1 - time).reverse() : values;
		const animateControls = (duration: number, includeToolbar: boolean) => {
			const launcher = launchers.firstElementChild;
			const toolbar = includeToolbar ? launchers.querySelector('[role="toolbar"]') : null;
			const targets = [launcher, toolbar].filter((element): element is HTMLElement => element instanceof HTMLElement);
			const keyframes = sequence([
				{ opacity: 1, transform: "scale(1)" },
				{ opacity: 1, transform: "scale(1)" },
				{ opacity: 0, transform: "scale(0.92)" },
			]).map((frame, index) => ({ ...frame, offset: times([0, 0.68, 1])[index] }));
			return targets.map((target) => target.animate(target === toolbar ? keyframes.map(({ opacity, offset }) => ({ opacity, offset })) : keyframes, { duration: duration * 1000, easing: "linear", fill: "both" }));
		};

		// Pin the compact controls to the measured launcher position while the panel lays out behind them.
		launchers.style.left = `${launcherOrigin.left + offsetX - target.left - launcherX.get()}px`;
		launchers.style.top = `${launcherOrigin.top + offsetY - target.top - launcherY.get()}px`;
		Object.assign(overlay.style, {
			left: `${left - target.left}px`,
			top: `${top - target.top}px`,
			width: `${right - left}px`,
			height: `${bottom - top}px`,
		});
		shape.style.clipPath = closing ? masks.at(-1)! : masks[0];
		Object.assign(shadow.style, {
			left: `${target.left - left}px`,
			top: `${target.top - top}px`,
			width: `${target.width}px`,
			height: `${target.height}px`,
		});

		const blue = token("color.background.information.bold");
		const panel = token("elevation.surface.overlay");
		const action = variant === "button" ? [...launchers.querySelectorAll<HTMLElement>("[data-toolbar-action-id]")].find((element) => element.dataset.toolbarActionId === actionId) : undefined;
		if (action && action.parentElement) {
			const rail = action.parentElement;
			const actionStyle = action.style.cssText;
			const railStyle = rail.style.cssText;
			const icon = action.firstElementChild as HTMLElement | null;
			const actionBounds = action.getBoundingClientRect();
			const baseLeft = action.offsetLeft;
			const baseTop = action.offsetTop;
			Object.assign(rail.style, { width: `${rail.offsetWidth}px`, height: `${rail.offsetHeight}px` });
			Object.assign(action.style, { position: "absolute", left: `${baseLeft}px`, top: `${baseTop}px`, width: `${origin.width}px`, height: `${origin.height}px`, transform: "none", transition: "none" });
			action.dataset.buttonMorph = "true";
			shape.style.visibility = "hidden";
			const duration = motionDuration.slow + motionDuration.xxshort;
			const colors = [token("elevation.surface.raised"), token("elevation.surface.raised"), panel, panel, panel, panel, panel, panel];
			const geometry = action.animate(sequence(frames.map((frame, index) => ({
				left: `${baseLeft + frame.left - actionBounds.left}px`,
				top: `${baseTop + frame.top - actionBounds.top}px`,
				width: `${frame.width}px`,
				height: `${frame.height}px`,
				borderRadius: `${frame.radius}px`,
				backgroundColor: colors[index],
			}))).map((frame, index) => ({ ...frame, offset: times(MORPH_TIMES)[index] })), { duration: duration * 1000, easing: "linear", fill: "both" });
			const iconFade = icon ? animate(icon, { opacity: sequence([1, 1, 0, 0]) }, { duration, times: times([0, 0.12, 0.42, 1]), ease: motionEase.linear }) : undefined;
			const controls = animateControls(duration, false);
			let active = true;
			geometry.finished.then(() => { if (active) onComplete(); }).catch(() => {});
			return () => {
				active = false;
				geometry.cancel();
				iconFade?.stop();
				controls.forEach((animation) => animation.cancel());
				if (icon) icon.style.removeProperty("opacity");
				action.style.cssText = actionStyle;
				rail.style.cssText = railStyle;
				delete action.dataset.buttonMorph;
				launchers.style.removeProperty("opacity");
				launchers.style.removeProperty("left");
				launchers.style.removeProperty("top");
			};
		}
		const initialColor = variant === "dot" ? blue : panel;
		// A whole panel travelling into another is a large transition, so it takes the page-level duration.
		const duration = variant === "dot" ? SHELL_DURATION : variant === "surface" ? motionDuration.slower : motionDuration.slow + motionDuration.xxshort;
		shape.style.backgroundColor = closing ? panel : initialColor;
		shadow.style.opacity = closing ? "1" : "0";
		const geometry = animate(shape, {
			clipPath: sequence(masks),
			backgroundColor: sequence(variant === "dot" ? [blue, blue, blue, token("color.background.information.subtle"), panel, panel, panel, panel] : Array(8).fill(panel)),
		}, { duration, times: times(MORPH_TIMES), ease: motionEase.linear });
		const blur = animate(overlay, { filter: sequence(variant === "dot" ? ["blur(0px)", "blur(0px)", "blur(6px)", "blur(0px)", "blur(0px)"] : ["blur(0px)", "blur(0px)", "blur(2px)", "blur(0px)", "blur(0px)"]) }, {
			duration, times: times([0, 0.4, 0.64, 0.9, 1]), ease: motionEase.linear,
		});
		const elevation = animate(shadow, { opacity: sequence([0, 0, 1]) }, {
			duration, times: times([0, 0.92, 1]), ease: motionEase.linear,
		});
		const controls = animateControls(duration, true);
		let active = true;
		geometry.then(() => { if (active) onComplete(); });
		return () => {
			active = false;
			geometry.stop();
			elevation.stop();
			blur.stop();
			controls.forEach((animation) => animation.cancel());
			launchers.style.removeProperty("opacity");
			launchers.style.removeProperty("left");
			launchers.style.removeProperty("top");
		};
	}, [actionId, anchor, closing, launcherOrigin, launchersRef, launcherX, launcherY, onComplete, origin, surfaceRef, variant]);

	return (
		<div aria-hidden="true" className="pointer-events-none absolute z-10 will-change-[filter]" ref={overlayRef}>
			<span className="absolute rounded-lg opacity-0 shadow-2xl" ref={shadowRef} />
			<div className="absolute inset-0 bg-info will-change-[clip-path]" data-notification-morph ref={shapeRef} />
		</div>
	);
}
