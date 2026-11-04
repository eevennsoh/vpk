"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import { AGENT_BRAND_TINT_FALLBACK, resolveAgentBrandTintColor } from "@/components/blocks/agent-session/agent-brand-tint";
import { sessionTransferTintSeed } from "@/components/blocks/jira-issue/agent-session-drag";
import { createJiraLinkingCardGlow, type JiraCardGlowEffect } from "@/components/blocks/jira-linking/card-glow";
import type { JiraLinkingVariant } from "@/components/blocks/jira-linking";
import type { JiraKanbanCardData, JiraKanbanColumnData } from "@/components/blocks/jira-kanban";

export function useBulkAssignmentGlow({ boardColumns, boardRootRef, linkingVariant, shouldReduceMotion }: Readonly<{
	boardColumns: readonly JiraKanbanColumnData[];
	boardRootRef: RefObject<HTMLDivElement | null>;
	linkingVariant: JiraLinkingVariant;
	shouldReduceMotion: boolean | null;
}>) {
	const pendingRef = useRef<{ cards: ReadonlyMap<string, readonly string[]>; agent: AgentSelectorAgent } | null>(null);
	const effectsRef = useRef<JiraCardGlowEffect[]>([]);
	const frameRef = useRef<number | null>(null);
	const noteBulkAgentAssignment = useCallback((agent: AgentSelectorAgent, cards: readonly JiraKanbanCardData[]) => {
		const eligible = cards.filter((card) => ![
			...(card.agentActivities ?? []).map((activity) => ({ id: activity.id, name: activity.name })),
			...(card.agentDoneRuns ?? []).map((run) => ({ id: run.id, name: run.agentName })),
		].some((existing) => existing.id === agent.id || existing.id.endsWith(`:${agent.id}`) || existing.name.toLowerCase() === agent.name.toLowerCase()));
		pendingRef.current = eligible.length ? {
			agent,
			cards: new Map(eligible.map((card) => [card.code, (card.agentActivities ?? []).map((activity) => activity.id)])),
		} : null;
	}, []);
	useEffect(() => {
		const pending = pendingRef.current;
		if (!pending) return;
		const cards = boardColumns.flatMap((column) => column.cards);
		const codes = [...pending.cards].flatMap(([code, previousIds]) => {
			const card = cards.find((candidate) => candidate.code === code);
			return card?.agentActivities?.some((activity) => !previousIds.includes(activity.id)) ? [code] : [];
		});
		if (codes.length === 0) return;
		pendingRef.current = null;
		if (shouldReduceMotion || linkingVariant !== "glow") return;
		const color = resolveAgentBrandTintColor(sessionTransferTintSeed(pending.agent.brandName, pending.agent.vpkLogo, pending.agent.name, pending.agent.id)) ?? AGENT_BRAND_TINT_FALLBACK;
		frameRef.current = requestAnimationFrame(() => {
			frameRef.current = null;
			for (const code of codes) {
				const card = boardRootRef.current?.querySelector(`[data-issue-key="${CSS.escape(code)}"]`);
				const haloRoot = card?.querySelector('[data-slot="jira-issue-surface"]');
				if (!haloRoot) continue;
				const effects = createJiraLinkingCardGlow({ haloRoot, backdropRoot: card?.querySelector('[data-slot="jira-issue-agent-backdrop"]') ?? null, color });
				effectsRef.current.push(...effects);
				void Promise.allSettled(effects.map((effect) => effect.animation.finished)).then(() => {
					for (const effect of effects) effect.restore();
					effectsRef.current = effectsRef.current.filter((effect) => !effects.includes(effect));
				});
			}
		});
	}, [boardColumns, boardRootRef, linkingVariant, shouldReduceMotion]);
	useEffect(() => () => {
		if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
		for (const effect of effectsRef.current) { effect.animation.cancel(); effect.restore(); }
	}, []);
	return noteBulkAgentAssignment;
}
