"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useReducedMotion } from "motion/react";

import { resolveAgentBrandTint, resolveAgentBrandTintVariable } from "@/components/blocks/agent-session/agent-brand-tint";
import { agentSessionTintSeed } from "@/components/blocks/agent-session/agent-session-transfer-member";
import type { JiraLinkingIdentity, JiraLinkingRelease, JiraLinkingTarget } from "@/components/blocks/jira-linking";
import type { JiraIssueAgentSessionDragBinding, JiraIssueAgentSessionDragControl, JiraIssueAgentSessionDragState } from "@/components/blocks/jira-issue/agent-session-drag";
import { JIRA_ISSUE_AGENT_SESSION_DRAG_IDLE } from "@/components/blocks/jira-issue/agent-session-drag";
import { isJiraIssueAttachChinArmed, toJiraIssueAttachTracePointer } from "@/components/blocks/jira-issue/attach-proximity";
import { isWithinJiraIssueDropZoneHalo } from "@/components/blocks/jira-issue/agent-session-transfer-model";
import { resolveJiraLinkingNearness } from "@/components/blocks/jira-linking/lifecycle";
import { distanceFromPointToRect } from "@/components/blocks/jira-kanban/experimental/lib/create-work-item-exclusive-proximity";
import { SESSION_ATTACH_PROXIMITY_RANGE_PX } from "@/components/blocks/jira-kanban/experimental/lib/board-agent-session-drag";

import { PEEL_CLAUDE_SESSION, PEEL_SESSION_ACCENT } from "./peel-session-data";

const IDLE_PREVIEW = { state: JIRA_ISSUE_AGENT_SESSION_DRAG_IDLE as JiraIssueAgentSessionDragState, nearness: 0, trace: null as ReturnType<typeof toJiraIssueAttachTracePointer> };
const TINT_SEED = agentSessionTintSeed(PEEL_CLAUDE_SESSION);
const IDENTITIES: readonly JiraLinkingIdentity[] = [{
	id: PEEL_CLAUDE_SESSION.id,
	imageSrc: PEEL_CLAUDE_SESSION.agent.avatarSrc,
	tint: resolveAgentBrandTint(TINT_SEED),
	tintVariable: resolveAgentBrandTintVariable(TINT_SEED),
	tintSeed: TINT_SEED,
}];

function toTarget(rect: DOMRect, radius: number): JiraLinkingTarget {
	return { anchor: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, width: rect.width, height: rect.height, radius };
}

/** One local transfer transaction; continuous input publishes at most once per frame. */
export function usePeelSessionDemo(targetRef: RefObject<HTMLDivElement | null>) {
	const shouldReduceMotion = useReducedMotion();
	const [link, setLink] = useState({ attached: false, version: 0, resetVersion: 0 });
	const [release, setRelease] = useState<JiraLinkingRelease | null>(null);
	const releaseIdRef = useRef(0);
	const [preview, setPreview] = useState(IDLE_PREVIEW);
	const frameRef = useRef<number | null>(null);
	const pendingRef = useRef<JiraIssueAgentSessionDragState | null>(null);
	const cancelFrame = useCallback(() => {
		if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
		frameRef.current = null;
		pendingRef.current = null;
	}, []);
	useEffect(() => cancelFrame, [cancelFrame]);
	const measure = useCallback(() => targetRef.current?.querySelector<HTMLElement>('[data-slot="jira-issue-agent-shell"]')?.getBoundingClientRect(), [targetRef]);
	const commitLink = useCallback(() => {
		cancelFrame();
		setPreview(IDLE_PREVIEW);
		setRelease(null);
		setLink((current) => ({ ...current, attached: true, version: current.version + 1 }));
	}, [cancelFrame]);
	const beginLink = useCallback((from?: { x: number; y: number }) => {
		cancelFrame();
		setPreview(IDLE_PREVIEW);
		const shell = measure();
		const surface = targetRef.current?.querySelector<HTMLElement>('[data-slot="jira-issue-surface"]')?.getBoundingClientRect();
		if (shouldReduceMotion || !shell || !surface) {
			commitLink();
			return;
		}
		releaseIdRef.current += 1;
		setRelease({
			id: releaseIdRef.current,
			// Match the canonical Jira Issue shell (10px) and card surface (8px).
			fromTarget: toTarget(shell, 10),
			target: toTarget(surface, 8),
			drop: from ? {
				from,
				members: [{
					id: PEEL_CLAUDE_SESSION.id,
					name: PEEL_CLAUDE_SESSION.agent.name,
					brandName: PEEL_CLAUDE_SESSION.agent.brandName,
					avatarSrc: PEEL_CLAUDE_SESSION.agent.avatarSrc,
					vpkLogo: PEEL_CLAUDE_SESSION.agent.vpkLogo,
					invoker: PEEL_CLAUDE_SESSION.invokedBy,
				}],
				playback: "stagger",
			} : undefined,
		});
	}, [cancelFrame, commitLink, measure, shouldReduceMotion, targetRef]);
	const attach = useCallback(() => beginLink(), [beginLink]);
	const reset = useCallback(() => {
		cancelFrame();
		setPreview(IDLE_PREVIEW);
		setRelease(null);
		setLink((current) => ({ ...current, attached: false, resetVersion: current.resetVersion + 1 }));
	}, [cancelFrame]);
	const onDragStateChange = useCallback((state: JiraIssueAgentSessionDragState) => {
		if (!state.dragging) {
			cancelFrame();
			const rect = measure();
			if (!state.cancelled && state.pointer && rect && isWithinJiraIssueDropZoneHalo(state.pointer, rect, 0)) {
				const chip = document.querySelector<HTMLElement>("[data-session-drag-overlay] [data-session-fusion-chip]")?.getBoundingClientRect();
				beginLink(chip ? { x: chip.left + chip.width / 2, y: chip.top + chip.height / 2 } : state.pointer);
			} else setPreview(IDLE_PREVIEW);
			return;
		}
		pendingRef.current = state;
		if (frameRef.current !== null) return;
		frameRef.current = requestAnimationFrame(() => {
			frameRef.current = null;
			const next = pendingRef.current;
			const rect = measure();
			if (!next?.dragging || !rect) return;
			const distance = distanceFromPointToRect(next.pointer, rect);
			setPreview({ state: next, nearness: resolveJiraLinkingNearness(distance, SESSION_ATTACH_PROXIMITY_RANGE_PX), trace: toJiraIssueAttachTracePointer(next.pointer, rect) });
		});
	}, [beginLink, cancelFrame, measure]);
	const binding = useMemo<JiraIssueAgentSessionDragBinding>(() => ({
		previewEffect: "peel",
		previewPreparation: "eager",
		onDragStateChange,
		onFocusedActivitiesChange: (activities) => setPreview((current) => ({ ...current, state: { ...current.state, activities } })),
	}), [onDragStateChange]);
	const control: JiraIssueAgentSessionDragControl = {
		binding,
		state: preview.state,
		sourceActive: false,
		dropTarget: release !== null || (preview.state.dragging && isJiraIssueAttachChinArmed(preview.nearness)) ? "attach" : null,
		attachNearness: release ? 1 : preview.nearness,
		attachTrace: preview.trace ? { ...preview.trace, accent: PEEL_SESSION_ACCENT } : null,
	};
	return { attach, commitLink, control, identities: IDENTITIES, link, release, reset };
}
