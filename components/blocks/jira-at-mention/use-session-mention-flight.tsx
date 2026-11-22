"use client";

import { useEffectEvent, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { createPortal } from "react-dom";
import { DEFAULT_MENTION_FLIGHT_OPTIONS, planSessionMentionFlight, type MentionFlightOptions } from "@/components/blocks/jira-at-mention/session-mention-flight";
import { activityScrollport } from "@/components/blocks/jira-activity/activity-scrollport";
import { motionDuration } from "@/lib/motion";

export type MentionFlightSource = Readonly<{ chip: HTMLElement; rect: DOMRect }>;
export type MentionFlightRequest = Readonly<{ entryId: string; id: number; source: MentionFlightSource | null; options?: MentionFlightOptions }>;
export type MentionFlightSettlement = "landed" | "interrupted";
const reducedQuery = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (callback: () => void) => {
	const query = window.matchMedia(reducedQuery);
	query.addEventListener("change", callback);
	return () => query.removeEventListener("change", callback);
};
const reducedSnapshot = () => window.matchMedia(reducedQuery).matches;
const serverSnapshot = () => true;
const sameRect = (a: DOMRect, b: DOMRect) => Math.abs(a.left - b.left) < 0.75 && Math.abs(a.top - b.top) < 0.75 && Math.abs(a.width - b.width) < 0.75 && Math.abs(a.height - b.height) < 0.75;

export function useSessionMentionFlight(bodyRef: RefObject<HTMLDivElement | null>, request: MentionFlightRequest | null, active: boolean, onTraceStart: (id: number) => void, onSettled: (id: number, reason?: MentionFlightSettlement) => void) {
	const overlayRef = useRef<HTMLDivElement>(null);
	const completed = useRef<number | null>(null);
	const [completedId, setCompletedId] = useState<number | null>(null);
	const reduced = useSyncExternalStore(subscribeMotion, reducedSnapshot, serverSnapshot);
	const trace = useEffectEvent(onTraceStart);
	const settled = useEffectEvent(onSettled);
	useLayoutEffect(() => {
		if (!request || completed.current === request.id) return;
		const { id, entryId, source, options = DEFAULT_MENTION_FLIGHT_OPTIONS } = request;
		let disposed = false;
		let done = false;
		let frame = 0;
		let animation: Animation | null = null;
		let shadow: Animation | null = null;
		let target: HTMLElement | null = null;
		let destination: DOMRect | null = null;
		let tracing = false;
		let settling = false;
		let flying = false;
		let scrollport: HTMLElement | null = null;
		let scrollTarget: number | null = null;
		let scrollStarted = 0;
		let previousRect: DOMRect | null = null;
		let stableFrames = 0;
		let previousComposerRect: DOMRect | null = null;
		let stableComposerFrames = 0;
		let stop: (preserveFill?: boolean) => void = () => {};
		let planDuration = 0;
		let planSettle = 0;
		let planTrace = 0;
		const started = performance.now();
		const node = overlayRef.current;
		function finish(reason: MentionFlightSettlement) {
			if (disposed || done) return;
			done = true;
			completed.current = id;
			if (reason === "interrupted") { animation?.pause(); shadow?.pause(); }
			stop(true);
			setCompletedId(id);
			settled(id, reason);
		}
		if (!active) {
			finish("interrupted");
			return;
		}
		const instant = !source || reduced;
		if (!node && !instant) return;
		const flightSource = source;
		const overlay = node;
		function interrupted() { finish("interrupted"); }
		function scrolled() { if (flying) interrupted(); }
		function validTarget() {
			return target?.isConnected && bodyRef.current?.contains(target) && destination && sameRect(destination, target.getBoundingClientRect()) && bodyRef.current.getClientRects().length > 0;
		}
		function monitor() {
			if (disposed || done || !overlay) return;
			if (!validTarget()) { interrupted(); return; }
			const elapsed = Number(animation?.currentTime ?? 0);
			if (!settling && elapsed >= planDuration * planSettle) { settling = true; overlay.dataset.flightPhase = "settle"; }
			if (!tracing && elapsed >= planDuration * planTrace) { tracing = true; trace(id); }
			frame = requestAnimationFrame(monitor);
		}
		function prepare() {
			if (disposed || done) return;
			const entry = [...(bodyRef.current?.querySelectorAll<HTMLElement>("[data-jira-activity-entry-id]") ?? [])].find((item) => item.dataset.jiraActivityEntryId === entryId);
			const composer = entry?.querySelector<HTMLElement>("[data-project-butter-comment-editor]");
			const editor = composer?.querySelector<HTMLElement>('[contenteditable="true"]');
			const editorRect = editor?.getBoundingClientRect();
			target = flightSource ? [...(composer?.querySelectorAll<HTMLElement>(".rich-text-mention-chip") ?? [])].find((chip) => chip.textContent === flightSource.chip.textContent) ?? null : null;
			if (!composer || !editorRect?.width || !editorRect.height || (!instant && (!target || target.getBoundingClientRect().width === 0))) {
				if (performance.now() - started < motionDuration.slowest * 1_000) frame = requestAnimationFrame(prepare);
				else interrupted();
				return;
			}
			const composerRect = composer.getBoundingClientRect();
			if (instant) {
				stableComposerFrames = previousComposerRect && sameRect(previousComposerRect, composerRect) ? stableComposerFrames + 1 : 0;
				previousComposerRect = composerRect;
				if (stableComposerFrames < 2) {
					if (performance.now() - started < (motionDuration.slowest + motionDuration.slower) * 1_000) frame = requestAnimationFrame(prepare);
					else interrupted();
					return;
				}
			}
			if (scrollTarget === null) {
				scrollport = activityScrollport(composer);
				const bounds = scrollport?.getBoundingClientRect();
				const bar = bodyRef.current?.querySelector<HTMLElement>("[data-project-butter-comment-bar]")?.getBoundingClientRect();
				const header = bodyRef.current?.querySelector<HTMLElement>("[data-project-butter-activity-header]")?.getBoundingClientRect();
				const top = Math.max(bounds?.top ?? 0, header?.bottom ?? 0) + 12;
				const bottom = Math.min(bounds?.bottom ?? window.innerHeight, bar?.top ?? window.innerHeight) - 12;
				const delta = composerRect.top < top ? composerRect.top - top : composerRect.bottom > bottom ? composerRect.bottom - bottom : 0;
				if (scrollport && Math.abs(delta) > 1) {
					scrollTarget = Math.max(0, Math.min(scrollport.scrollHeight - scrollport.clientHeight, scrollport.scrollTop + delta));
					scrollStarted = performance.now();
					scrollport.scrollTo({ top: scrollTarget, behavior: instant ? "instant" : "smooth" });
					if (!instant) { frame = requestAnimationFrame(prepare); return; }
				}
			} else if (scrollport && Math.abs(scrollport.scrollTop - scrollTarget) > 0.75) {
				if (performance.now() - scrollStarted < motionDuration.slower * 1_000) frame = requestAnimationFrame(prepare);
				else { scrollport.scrollTo({ top: scrollport.scrollTop, behavior: "instant" }); interrupted(); }
				return;
			}
			if (instant) { finish("landed"); return; }
			if (!target || !flightSource || !overlay) { interrupted(); return; }
			const measured = target.getBoundingClientRect();
			stableFrames = previousRect && sameRect(previousRect, measured) ? stableFrames + 1 : 0;
			previousRect = measured;
			if (stableFrames < 2) {
				if (performance.now() - started < (motionDuration.slowest + motionDuration.slower) * 1_000) frame = requestAnimationFrame(prepare);
				else interrupted();
				return;
			}
			destination = measured;
			resize.observe(target);
			const plan = planSessionMentionFlight({ source: flightSource.rect, destination, viewport: { width: window.innerWidth, height: window.innerHeight } }, options);
			if (!plan) { finish("landed"); return; }
			planDuration = plan.durationMs; planSettle = plan.settleOffset; planTrace = plan.traceOffset;
			overlay.dataset.flightPhase = "travel";
			animation = overlay.animate(plan.frames.map(({ offset, transform }) => ({ offset, transform })), { duration: plan.durationMs, easing: "linear", fill: "forwards" });
			shadow = options.shadow ? overlay.querySelector("[data-project-butter-mention-flight-shadow]")?.animate([{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], { duration: plan.durationMs, easing: "linear", fill: "forwards" }) ?? null : null;
			flying = true;
			animation.onfinish = () => finish(validTarget() ? "landed" : "interrupted");
			animation.oncancel = interrupted;
			frame = requestAnimationFrame(monitor);
		}
		const resize = new ResizeObserver(() => { if (flying && !validTarget()) interrupted(); });
		if (bodyRef.current) resize.observe(bodyRef.current);
		const mutation = new MutationObserver(() => { if (flying && !target?.isConnected) interrupted(); });
		if (bodyRef.current) mutation.observe(bodyRef.current, { childList: true, subtree: true });
		window.addEventListener("wheel", interrupted, { passive: true });
		window.addEventListener("touchstart", interrupted, { passive: true });
		window.addEventListener("scroll", scrolled, true);
		window.addEventListener("resize", interrupted);
		window.visualViewport?.addEventListener("resize", interrupted);
		window.visualViewport?.addEventListener("scroll", interrupted);
		stop = (preserveFill = false) => {
			cancelAnimationFrame(frame);
			if (!preserveFill) { animation?.cancel(); shadow?.cancel(); }
			if (!flying && !instant && scrollport && scrollTarget !== null) scrollport.scrollTo({ top: scrollport.scrollTop, behavior: "instant" });
			resize.disconnect(); mutation.disconnect();
			window.removeEventListener("wheel", interrupted);
			window.removeEventListener("touchstart", interrupted);
			window.removeEventListener("scroll", scrolled, true);
			window.removeEventListener("resize", interrupted);
			window.visualViewport?.removeEventListener("resize", interrupted);
			window.visualViewport?.removeEventListener("scroll", interrupted);
		};
		prepare();
		return () => { disposed = true; stop(); };
	}, [active, bodyRef, completedId, reduced, request]);
	if (!active || !request?.source || reduced || completedId === request.id || typeof document === "undefined") return null;
	const { source } = request;
	return createPortal(
		<div
			aria-hidden
			className="pointer-events-none fixed left-0 top-0 z-[10000] inline-flex rounded-full bg-surface-raised"
			data-project-butter-mention-flight
			data-flight-phase="preparing"
			inert
			ref={(node) => { overlayRef.current = node; if (node && !node.contains(source.chip)) node.append(source.chip); }}
			style={{ width: source.rect.width, height: source.rect.height, transform: `translate3d(${source.rect.left}px, ${source.rect.top}px, 0)`, transformOrigin: "0 0", willChange: "transform" }}
		>
			<span aria-hidden className="pointer-events-none absolute inset-0 rounded-full opacity-0 shadow-2xl" data-project-butter-mention-flight-shadow style={{ willChange: "opacity" }} />
		</div>,
		document.body,
		String(request.id),
	);
}
