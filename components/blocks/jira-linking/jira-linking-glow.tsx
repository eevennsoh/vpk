"use client";

import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

import { animateSessionChipDrop } from "@/components/blocks/jira-dropzone/lib/session-chip-drop-flight";

import { createJiraLinkingCardGlow, type JiraCardGlowEffect } from "./card-glow";
import { JiraLinkingFlightChip } from "./jira-linking-flight-chip";
import {
	JIRA_LINKING_GLOW_DEFAULT_COLOR,
	JIRA_LINKING_GLOW_DROP_DURATION_MS,
	resolveJiraLinkingGlowColor,
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

function resolveJiraIssueGlowRoots(anchor: Readonly<{ x: number; y: number }>, targetElement?: Element | null): JiraIssueGlowRoots {
	if (typeof document === "undefined") return { backdropRoot: null, haloRoot: null };
	const hit = targetElement === undefined ? document.elementFromPoint(anchor.x, anchor.y) : targetElement;
	const shell = hit?.closest(JIRA_ISSUE_AGENT_SHELL_SELECTOR) ?? hit?.querySelector(JIRA_ISSUE_AGENT_SHELL_SELECTOR);
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
				? resolveJiraIssueGlowRoots(backdrop.anchor, release.resolveTargetElement?.())
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
	const backdrop = release.fromTarget ?? release.target;
	const landing = release.target;
	const drop = release.drop;
	const resolveTarget = release.resolveTarget;
	const resolveTargetElement = release.resolveTargetElement;

	useLayoutEffect(() => {
		if (shouldReduceMotion || !landing || !backdrop) {
			onSettled(release.id);
			onComplete(release.id);
			return;
		}
		const flight = drop ? flightRef.current : null;
		if (drop && (!flight || typeof flight.animate !== "function")) {
			onSettled(release.id);
			onComplete(release.id);
			return;
		}
		let cancelled = false;
		let revealFrame: number | undefined;
		let effects: JiraCardGlowEffect[] = [];
		const finish = () => {
			if (!cancelled) onComplete(release.id);
		};
		const playGlow = () => {
			if (cancelled) return;
			const targetElement = resolveTargetElement?.();
			if (targetElement?.closest("[data-issue-drop-reveal-pending]")) {
				revealFrame = requestAnimationFrame(playGlow);
				return;
			}
			const roots = resolveTargetElement
				? resolveJiraIssueGlowRoots(landing.anchor, targetElement)
				: { haloRoot, backdropRoot };
			if (resolveTargetElement && !roots.haloRoot) {
				onSettled(release.id);
				finish();
				return;
			}
			if (flight) {
				flight.style.visibility = "hidden";
			}
			effects = createJiraLinkingCardGlow({
				haloRoot: roots.haloRoot ?? portalRoot,
				backdropRoot: roots.backdropRoot,
				color: glowColor,
				fallbackStyle: roots.haloRoot ? undefined : {
					position: "fixed", left: `${landing.anchor.x - landing.width / 2}px`, top: `${landing.anchor.y - landing.height / 2}px`,
					width: `${landing.width}px`, height: `${landing.height}px`, borderRadius: `${landing.radius ?? 8}px`, zIndex: String(zIndex),
				},
			});
			const last = effects.at(-1);
			for (const effect of effects) {
				const settle = () => { effect.restore(); if (effect === last) finish(); };
				effect.animation.onfinish = settle;
				effect.animation.oncancel = settle;
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
			if (revealFrame !== undefined) cancelAnimationFrame(revealFrame);
			stopFlight?.();
			for (const effect of effects) {
				effect.animation.onfinish = null;
				effect.animation.oncancel = null;
				effect.animation.cancel();
				effect.restore();
			}
		};
	}, [backdrop, backdropRoot, drop, glowColor, haloRoot, landing, onComplete, onSettled, portalRoot, release.id, resolveTarget, resolveTargetElement, shouldReduceMotion, zIndex]);

	if (shouldReduceMotion || !backdrop || !landing) return null;
	return drop ? <JiraLinkingFlightChip drop={drop} ref={flightRef} portalRoot={portalRoot} zIndex={zIndex + 110} /> : null;
}
