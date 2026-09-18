"use client";

import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { AgentSessionCohortChip } from "@/components/blocks/agent-session/agent-session-cohort-chip";
import { animateSessionChipDrop } from "@/components/blocks/jira-dropzone/lib/session-chip-drop-flight";

import { toJiraLinkingCohort } from "./drop-cohort";
import {
	JIRA_LINKING_GLOW_DEFAULT_COLOR,
	JIRA_LINKING_GLOW_DROP_DURATION_MS,
	JIRA_LINKING_GLOW_FADE_DURATION_MS,
	JIRA_LINKING_GLOW_PULSE_DURATION_MS,
	resolveJiraLinkingGlowColor,
	resolveJiraLinkingGlowPulseColor,
	resolveJiraLinkingGlowShadow,
} from "./glow-motion";
import type { JiraLinkingProps } from "./jira-linking";
import { resolveJiraLinkingIdentityTint } from "./use-jira-linking-atlas";
import type { JiraLinkingRelease } from "./use-jira-linking-frame";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const JIRA_ISSUE_AGENT_SHELL_SELECTOR = '[data-slot="jira-issue-agent-shell"]';
const JIRA_ISSUE_AGENT_BACKDROP_SELECTOR = '[data-slot="jira-issue-agent-backdrop"]';
const JIRA_ISSUE_SURFACE_SELECTOR = '[data-slot="jira-issue-surface"]';

interface JiraIssueGlowRoots {
	backdropRoot: Element | null;
	haloRoot: Element | null;
}

function resolveJiraIssueGlowRoots(anchor: Readonly<{ x: number; y: number }>): JiraIssueGlowRoots {
	if (typeof document === "undefined") return { backdropRoot: null, haloRoot: null };
	const hit = document.elementFromPoint(anchor.x, anchor.y);
	const shell = hit?.closest(JIRA_ISSUE_AGENT_SHELL_SELECTOR);
	return {
		backdropRoot: shell?.querySelector(JIRA_ISSUE_AGENT_BACKDROP_SELECTOR) ?? null,
		haloRoot: shell?.querySelector(JIRA_ISSUE_SURFACE_SELECTOR) ?? null,
	};
}

function subscribeToReducedMotion(onChange: () => void) {
	const media = window.matchMedia(REDUCED_MOTION_QUERY);
	media.addEventListener("change", onChange);
	return () => media.removeEventListener("change", onChange);
}
function readReducedMotion() {
	return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}
function serverReducedMotion() {
	return true;
}

interface JiraLinkingGlowSnapshot {
	backdropRoot: Element | null;
	glowColor: string;
	haloRoot: Element | null;
	portalRoot: HTMLElement;
	release: JiraLinkingRelease;
}

/** Retains the acknowledgement backdrop after the host clears its release. */
export function JiraLinkingGlow({ identities, release, onFuseSettled, zIndex = 290 }: Readonly<JiraLinkingProps>) {
	const shouldReduceMotion = useSyncExternalStore(subscribeToReducedMotion, readReducedMotion, serverReducedMotion);
	const [snapshot, setSnapshot] = useState<JiraLinkingGlowSnapshot | null>(null);
	const lastReleaseId = useRef<number | null>(null);
	const settledId = useRef<number | null>(null);
	const onSettledRef = useRef(onFuseSettled);

	useLayoutEffect(() => {
		onSettledRef.current = onFuseSettled;
	}, [onFuseSettled]);
	useLayoutEffect(() => {
		if (release && release.id !== lastReleaseId.current) {
			lastReleaseId.current = release.id;
			const backdrop = release.resolveTarget?.() ?? release.fromTarget ?? release.target;
			const roots = backdrop
				? resolveJiraIssueGlowRoots(backdrop.anchor)
				: { backdropRoot: null, haloRoot: null };
			const leadIdentity = identities?.[0];
			setSnapshot({
				...roots,
				glowColor: leadIdentity
					? resolveJiraLinkingGlowColor(resolveJiraLinkingIdentityTint(leadIdentity))
					: JIRA_LINKING_GLOW_DEFAULT_COLOR,
				portalRoot: document.body,
				release,
			});
		}
	}, [identities, release]);
	const settle = useCallback((id: number) => {
		if (settledId.current === id) return;
		settledId.current = id;
		onSettledRef.current?.();
	}, []);
	const complete = useCallback((id: number) => {
		setSnapshot((current) => current?.release.id === id ? null : current);
	}, []);

	return snapshot ? (
		<GlowRelease
			backdropRoot={snapshot.backdropRoot}
			glowColor={snapshot.glowColor}
			haloRoot={snapshot.haloRoot}
			key={snapshot.release.id}
			onComplete={complete}
			onSettled={settle}
			portalRoot={snapshot.portalRoot}
			release={snapshot.release}
			shouldReduceMotion={shouldReduceMotion}
			zIndex={zIndex}
		/>
	) : null;
}

function GlowRelease({ backdropRoot, glowColor, haloRoot, portalRoot, release, shouldReduceMotion, onSettled, onComplete, zIndex }: Readonly<{
	backdropRoot: Element | null;
	glowColor: string;
	haloRoot: Element | null;
	portalRoot: HTMLElement;
	release: JiraLinkingRelease;
	shouldReduceMotion: boolean;
	onSettled: (id: number) => void;
	onComplete: (id: number) => void;
	zIndex: number;
}>) {
	const flightRef = useRef<HTMLDivElement>(null);
	const haloRef = useRef<HTMLDivElement>(null);
	const pulseRef = useRef<HTMLDivElement>(null);
	const backdrop = release.fromTarget ?? release.target;
	const landing = release.target;
	const drop = release.drop;
	const resolveTarget = release.resolveTarget;

	useLayoutEffect(() => {
		if (shouldReduceMotion || !landing || !backdrop) {
			onSettled(release.id);
			onComplete(release.id);
			return;
		}
		const flight = drop ? flightRef.current : null;
		const halo = haloRef.current;
		const pulse = pulseRef.current;
		if (!halo || typeof halo.animate !== "function" || (drop && (!flight || typeof flight.animate !== "function"))) {
			onSettled(release.id);
			onComplete(release.id);
			return;
		}
		let cancelled = false;
		const animations: Animation[] = [];
		let haloAnimation: Animation | null = null;
		let pulseAnimation: Animation | null = null;
		const finish = () => {
			if (!cancelled) onComplete(release.id);
		};
		const playGlow = () => {
			if (cancelled) return;
			if (flight) {
				flight.style.visibility = "hidden";
			}
			haloAnimation = halo.animate([{ opacity: 1 }, { opacity: 0 }], {
				duration: JIRA_LINKING_GLOW_FADE_DURATION_MS,
				easing: "ease-out",
				fill: "forwards",
			});
			animations.push(haloAnimation);
			if (pulse) {
				pulseAnimation = pulse.animate([
					{ transform: "translateY(0)" },
					{ transform: "translateY(-200%)" },
				], {
					duration: JIRA_LINKING_GLOW_PULSE_DURATION_MS,
					easing: "cubic-bezier(0.4, 0, 0.2, 1)",
					fill: "forwards",
				});
				animations.push(pulseAnimation);
				pulseAnimation.addEventListener("finish", finish, { once: true });
				pulseAnimation.addEventListener("cancel", finish, { once: true });
			} else {
				haloAnimation.addEventListener("finish", finish, { once: true });
				haloAnimation.addEventListener("cancel", finish, { once: true });
			}
			onSettled(release.id);
		};
		const stopFlight = drop && flight ? animateSessionChipDrop(flight, {
			durationMs: JIRA_LINKING_GLOW_DROP_DURATION_MS,
			from: drop.from,
			onLanded: playGlow,
			resolveLandingPoint: () => resolveTarget ? resolveTarget()?.anchor ?? null : landing.anchor,
		}) : null;
		if (!stopFlight) playGlow();
		return () => {
			cancelled = true;
			stopFlight?.();
			haloAnimation?.removeEventListener("finish", finish);
			haloAnimation?.removeEventListener("cancel", finish);
			pulseAnimation?.removeEventListener("finish", finish);
			pulseAnimation?.removeEventListener("cancel", finish);
			for (const running of animations) running.cancel();
		};
	}, [backdrop, drop, landing, onComplete, onSettled, release.id, resolveTarget, shouldReduceMotion]);

	if (shouldReduceMotion || !backdrop || !landing) return null;
	const haloStyle = {
		left: landing.anchor.x - landing.width / 2,
		top: landing.anchor.y - landing.height / 2,
		width: landing.width,
		height: landing.height,
		borderRadius: landing.radius ?? 8,
		zIndex,
	};
	const showFlight = Boolean(drop);
	const showFallbackHalo = !haloRoot;
	return (
		<>
			{showFlight || showFallbackHalo ? createPortal(
				<div aria-hidden="true" data-slot="jira-linking" data-jira-linking-variant="glow" className="pointer-events-none">
					{showFallbackHalo ? (
							<div ref={haloRef} data-jira-linking-glow-halo="" className="fixed" style={{ ...haloStyle, opacity: 0, boxShadow: resolveJiraLinkingGlowShadow(glowColor) }} />
					) : null}
					{drop ? (
					<div
						ref={flightRef}
						data-jira-linking-flight=""
						data-jira-linking-flight-members={String(drop.members.length)}
						className="fixed left-0 top-0 w-fit"
						style={{ zIndex: zIndex + 110, transform: `translate3d(${drop.from.x}px, ${drop.from.y}px, 0)`, transformOrigin: "0 0" }}
					>
						<div className="flex w-fit -translate-x-1/2 -translate-y-1/2 items-center">
							<AgentSessionCohortChip cohort={toJiraLinkingCohort(drop.members)} elevated />
						</div>
					</div>
					) : null}
				</div>,
				portalRoot,
			) : null}
			{haloRoot ? createPortal(
				<div
					aria-hidden="true"
					className="absolute -inset-px rounded-[inherit]"
					data-jira-linking-glow-halo=""
					ref={haloRef}
						style={{ boxShadow: resolveJiraLinkingGlowShadow(glowColor), opacity: 0 }}
				/>,
				haloRoot,
			) : null}
			{backdropRoot ? createPortal(
				<div aria-hidden="true" className="absolute inset-0 overflow-hidden rounded-[inherit]" data-jira-linking-glow-backdrop="">
					<div ref={pulseRef} className="absolute inset-x-0 top-full h-full" style={{ background: `linear-gradient(0deg, transparent 0%, ${resolveJiraLinkingGlowPulseColor(glowColor)} 50%, transparent 100%)` }} />
				</div>,
				backdropRoot,
			) : null}
		</>
	);
}
