"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import QuestionCircleFilledIcon from "@atlaskit/icon-lab/core/question-circle-filled";
import StatusSuccessIcon from "@atlaskit/icon/core/status-success";
import StatusWarningIcon from "@atlaskit/icon/core/status-warning";

import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { Spinner } from "@/components/ui/spinner";
import { Shimmer } from "@/components/ui-custom/shimmer";
import { cn } from "@/lib/utils";

import type { AgentSessionItem } from "./agent-session-types";

/**
 * Enter is the attention-getting beat, exit gets out of the way. Resolved token
 * values because Motion cannot read `var()` — `duration-normal` +
 * `ease-out-practical` in, `duration-fast` + `ease-in` out. The exit timing
 * lives in the exit variant's own transition; a lone `transition` prop would
 * silently run the exit at the enter timing.
 */
const INDICATOR_ENTER = { duration: 0.15, ease: [0.4, 1, 0.6, 1] } as const;
const INDICATOR_EXIT = { duration: 0.1, ease: [0.6, 0, 0.8, 0.6] } as const;

const LIFECYCLE_LABELS = {
	running: "Working",
	"needs-input": "Needs input",
	attention: "Needs attention",
	complete: "Finished",
} as const satisfies Record<AgentSessionItem["state"], string>;

function IndicatorGlyph({ state }: Readonly<{ state: AgentSessionItem["state"] }>) {
	switch (state) {
		case "running":
			// Same 24×24 slot + Spinner `xl` as `JiraIssueActiveAgentStatusIcon`.
			// IconTile `[&_svg]:size-4!` would shrink the orb to a speck.
			return (
				<Spinner
					className="group-aria-pressed/button:text-icon-selected!"
					label=""
					pulse
					size="xl"
					variant="experimental"
				/>
			);
		case "needs-input":
			return (
				<IconTile
					aria-hidden="true"
					className="text-icon-information"
					icon={<QuestionCircleFilledIcon color="currentColor" label="" size="small" />}
					iconSize="medium"
					label=""
					size="small"
					title="Needs input"
					variant="transparent"
				/>
			);
		case "attention":
			return (
				<IconTile
					aria-hidden="true"
					className="text-icon-warning"
					icon={<StatusWarningIcon color="currentColor" label="" size="small" />}
					iconSize="medium"
					label=""
					size="small"
					title="Needs attention"
					variant="transparent"
				/>
			);
		case "complete":
			return (
				<IconTile
					aria-hidden="true"
					className="text-icon-success"
					icon={<StatusSuccessIcon color="currentColor" label="" size="small" />}
					iconSize="medium"
					label=""
					size="small"
					title="Finished"
					variant="transparent"
				/>
			);
		default: {
			const exhaustiveState: never = state;
			return exhaustiveState;
		}
	}
}

/**
 * Resting status mark for short rows. Settled states occupy the shared trailing
 * slot so the hover/focus more-actions button can replace them in place.
 */
export function AgentSessionShortLifecycleIcon({
	state,
}: Readonly<{ state: AgentSessionItem["state"] }>) {
	switch (state) {
		case "needs-input":
			return (
				<span
					aria-label="Needs input"
					className="grid size-6 shrink-0 place-items-center text-icon-information"
					role="img"
				>
					<QuestionCircleFilledIcon color="currentColor" label="" size="small" />
				</span>
			);
		case "complete":
			return (
				<span
					aria-label="Finished"
					className="grid size-6 shrink-0 place-items-center text-icon-success"
					role="img"
				>
					<StatusSuccessIcon color="currentColor" label="" size="small" />
				</span>
			);
		case "attention":
		case "running":
			return null;
		default: {
			const exhaustiveState: never = state;
			return exhaustiveState;
		}
	}
}

function LifecycleState({
	showLabel,
	state,
}: Readonly<{
	showLabel: boolean;
	state: AgentSessionItem["state"];
}>) {
	const label = LIFECYCLE_LABELS[state];

	return (
		<div className="flex shrink-0 items-center gap-1 text-xs text-text-subtle">
			{showLabel
				? state === "running"
					? (
						<Shimmer as="span" className="text-xs text-text-subtle" duration={1.4} spread={2}>
							{label}
						</Shimmer>
					)
					: <span>{label}</span>
				: null}
			<IndicatorGlyph state={state} />
		</div>
	);
}

/**
 * Trailing lifecycle indicator for a long-form session row.
 *
 * Unlike Agent List's built-in indicator this one covers `complete` too, with a
 * success check — a title-led row has no other place to say the work landed.
 * Each state grows in and out on the swap so a session moving from working to
 * finished reads as a transition rather than a substitution.
 *
 * The glyph is a ghost icon button so a click gets the shared selected chrome
 * (blue border, selected background, selected icon) instead of falling through
 * to the row.
 */
export function AgentSessionLifecycle({
	showLabel = true,
	state,
}: Readonly<{
	showLabel?: boolean;
	state: AgentSessionItem["state"];
}>) {
	const shouldReduceMotion = useReducedMotion();
	const [pressed, setPressed] = useState(false);
	const label = LIFECYCLE_LABELS[state];

	return (
		<Button
			aria-label={label}
			aria-pressed={pressed}
			className={cn(
				"h-6 w-auto min-w-6 gap-1 py-0 pr-0 text-xs shadow-none focus-visible:ring-0 aria-pressed:[&_svg]:text-icon-selected [&_svg:not([class*='size-'])]:size-4!",
				showLabel ? "pl-1" : "pl-0",
			)}
			onClick={(event) => {
				event.stopPropagation();
				setPressed((current) => !current);
			}}
			onPointerDown={(event) => event.stopPropagation()}
			size="icon-compact"
			type="button"
			variant="ghost"
		>
			<AnimatePresence initial={false} mode="popLayout">
				<motion.div
					animate={shouldReduceMotion ? undefined : { opacity: 1, scale: 1 }}
					className="grid place-items-center"
					exit={shouldReduceMotion
						? undefined
						: { opacity: 0, scale: 0.6, transition: INDICATOR_EXIT }}
					initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.6 }}
					key={state}
					style={shouldReduceMotion ? undefined : { willChange: "opacity, transform" }}
					transition={shouldReduceMotion ? { duration: 0 } : INDICATOR_ENTER}
				>
					<LifecycleState showLabel={showLabel} state={state} />
				</motion.div>
			</AnimatePresence>
		</Button>
	);
}
