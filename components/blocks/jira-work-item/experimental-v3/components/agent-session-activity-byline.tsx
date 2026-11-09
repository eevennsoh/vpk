"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

import type { AgentSession } from "@/components/blocks/jira-work-item/data/session-state";
import { AnimatedDot } from "@/components/ui-custom/animated-dot";
import { CyclingByline } from "@/components/ui-custom/chain-of-thought";
import { Shimmer } from "@/components/ui-custom/shimmer";

export const NEEDS_INPUT_STATUS_LABEL = "Needs input";

const WORKING_SESSION_ACTIVITY_CYCLE_MS = 2_200;
const WORKING_SESSION_ACTIVITY_STAGGER_MS = 480;

const CI_REPAIR_ACTIVITY_SCRIPT = [
	"Inspect the failed PR checks",
	"Patch delivery-address nullability",
	"Rerun lint and typecheck",
] as const;

const WORKING_SESSION_ACTIVITY_SCRIPTS: Readonly<Record<string, readonly string[]>> = {
	"code-planner": [
		"Plan the guest checkout architecture",
		"Define the secure checkout API contract",
		"Review server-side validation boundaries",
		"Sequence the implementation handoff",
	],
	"claude-code": [
		"Implement and verify guest checkout",
		"Wire the storefront checkout flow",
		"Integrate the approved API contract",
		"Build deterministic checkout cases",
		"Check payment and inventory failures",
	],
};

function getWorkingSessionActivity(
	session: Readonly<AgentSession>,
	cycleIndex: number,
): string {
	if (session.status === "waiting") {
		return session.waitingOn?.kind === "agent"
			? `Waiting for ${session.waitingOn.agentName}`
			: NEEDS_INPUT_STATUS_LABEL;
	}

	const script = session.scriptId === "shop-4821-ci-fix"
		? CI_REPAIR_ACTIVITY_SCRIPT
		: WORKING_SESSION_ACTIVITY_SCRIPTS[session.agentId];
	if (!script?.length) return session.title ?? "Working";

	return script[cycleIndex % script.length];
}

/**
 * Keeps every agent's tool narration on its own quiet, staggered cadence.
 * The first frame is the authored task title; subsequent frames cross-fade in
 * place so opening the working-agents menu never makes every row move at once.
 *
 * Agents with no live session pass `fallbackLabel` instead (e.g. the resolved
 * `agentRowStatusTooltip` text): it renders through the same byline typography
 * as static text, with no timer and no shimmer.
 *
 * Timers only run while this component is mounted and `active`. Hosts must let
 * the surface unmount on close (no `keepMounted`) or pass `active={false}`.
 */
export function WorkingSessionActivityByline({
	active = true,
	fallbackLabel,
	session,
	sessionIndex = 0,
}: Readonly<{
	active?: boolean;
	fallbackLabel?: string;
	session?: AgentSession;
	sessionIndex?: number;
}>) {
	const shouldReduceMotion = Boolean(useReducedMotion());
	const [activityCycleIndex, setActivityCycleIndex] = useState(0);
	const cycleDelayMs = WORKING_SESSION_ACTIVITY_STAGGER_MS * (sessionIndex + 1);
	const sessionStatus = session?.status;
	const needsUserInput = sessionStatus === "waiting" && session?.waitingOn?.kind === "user";
	const activity: string | null = session
		? getWorkingSessionActivity(session, activityCycleIndex)
		: fallbackLabel ?? null;

	useEffect(() => {
		if (!active || shouldReduceMotion || sessionStatus === undefined || sessionStatus === "waiting") {
			return;
		}

		let intervalId: number | undefined;
		const timeoutId = window.setTimeout(() => {
			setActivityCycleIndex((index) => index + 1);
			intervalId = window.setInterval(() => {
				setActivityCycleIndex((index) => index + 1);
			}, WORKING_SESSION_ACTIVITY_CYCLE_MS);
		}, cycleDelayMs);

		return () => {
			window.clearTimeout(timeoutId);
			if (intervalId !== undefined) {
				window.clearInterval(intervalId);
			}
		};
	}, [active, cycleDelayMs, sessionStatus, shouldReduceMotion]);

	return (
		<CyclingByline className="menu-row-byline">
			{needsUserInput && activity !== null ? (
				<span className="inline-flex min-w-0 items-baseline">
					<Shimmer as="span">{activity}</Shimmer>
					<AnimatedDot />
				</span>
			) : activity}
		</CyclingByline>
	);
}
