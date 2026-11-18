"use client";

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import type { NewCoreIconProps } from "@atlaskit/icon/base-new";
import SearchIcon from "@atlaskit/icon/core/search";
import QuestionCircleIcon from "@atlaskit/icon/core/question-circle";
import ListChecklistIcon from "@atlaskit/icon/core/list-checklist";
import EditIcon from "@atlaskit/icon/core/edit";
import LinkIcon from "@atlaskit/icon/core/link";
import CheckCircleIcon from "@atlaskit/icon/core/check-circle";
import PageIcon from "@atlaskit/icon/core/page";
import SkillIcon from "@atlaskit/icon-lab/core/skill";

import { ChainOfThoughtScenario, type ChainOfThoughtScenarioState, type ChainOfThoughtScenarioStep } from "@/components/ui/chain-of-thought";
import { SkillTag } from "@/components/ui-custom/skill-tag";
import { getSkillIcon } from "@/app/data/directory/skills";
import type { SkillCreationTracePayload } from "../lib/create-skill-flow";

// Distinct icon per step so the trace isn't a single repeated glyph.
const STEP_ICONS: Record<string, ComponentType<NewCoreIconProps>> = {
	search: SearchIcon,
	skill: SkillIcon,
	question: QuestionCircleIcon,
	review: ListChecklistIcon,
	draft: EditIcon,
	wire: LinkIcon,
	save: CheckCircleIcon,
};

function stepIcon(iconKey: string): ComponentType<NewCoreIconProps> {
	return STEP_ICONS[iconKey] ?? PageIcon;
}

/** "Invoking /create-skill" — the skill mention rendered as a tag inside the step. */
function invokingSkillLabel(skillId: string): ReactNode {
	return (
		<span className="inline-flex min-w-0 items-center gap-1.5">
			<span>Invoking</span>
			<SkillTag color="platform" icon={getSkillIcon("skill")}>
				{skillId}
			</SkillTag>
		</span>
	);
}

const ACTIVE_BYLINE_CYCLE_MS = 1200;

function getActiveStepBylines(payload: SkillCreationTracePayload): readonly string[] {
	const activeStep = payload.steps.find((step) => step.status === "active");
	if (!activeStep) {
		return [];
	}
	const bylines = activeStep.bylines?.filter((byline) => byline.trim().length > 0);
	return bylines && bylines.length > 0 ? bylines : [activeStep.byline];
}

interface SkillCreationTraceCardProps {
	payload: SkillCreationTracePayload;
	/** Flow ids whose question card has been answered. The awaiting trace flips
	 *  its header to "Questions answered" when its own flow id is in this set, so
	 *  multiple create-skill flows in one transcript stay independent. */
	answeredFlowIds?: ReadonlySet<string>;
}

/**
 * Renders the create-skill chain-of-thought using the canonical
 * `ChainOfThoughtScenario`, so styling (header, per-step icons, bylines) matches
 * the design-system component exactly. The header is general (not parroting the
 * active step) and reflects awaiting/answered/duration states.
 */
export function SkillCreationTraceCard({ payload, answeredFlowIds }: Readonly<SkillCreationTraceCardProps>) {
	const isAwaiting = payload.awaiting === true;
	const answered = isAwaiting && payload.flowId ? Boolean(answeredFlowIds?.has(payload.flowId)) : false;
	const activeStepBylines = useMemo(() => getActiveStepBylines(payload), [payload]);
	const [activeBylineIndex, setActiveBylineIndex] = useState(0);
	const state: ChainOfThoughtScenarioState =
		isAwaiting ? (answered ? "completed" : "thinking") : payload.headerState;
	const headerLabel: ReactNode = isAwaiting
		? answered
			? "Questions answered"
			: "Awaiting user response"
		: payload.headerLabel;
	const traceLifecycleKey = isAwaiting
		? answered ? "answered" : "awaiting"
		: state === "completed" ? "completed" : "active";
	const shouldAutoOpen = state === "thinking" && !isAwaiting;
	const [isTraceOpen, setTraceOpen] = useState(shouldAutoOpen);

	useEffect(() => {
		setTraceOpen(shouldAutoOpen);
	}, [shouldAutoOpen, traceLifecycleKey]);

	useEffect(() => {
		setActiveBylineIndex(0);
		if (activeStepBylines.length <= 1) {
			return;
		}
		const intervalId = window.setInterval(() => {
			setActiveBylineIndex((currentIndex) => (currentIndex + 1) % activeStepBylines.length);
		}, ACTIVE_BYLINE_CYCLE_MS);

		return () => {
			window.clearInterval(intervalId);
		};
	}, [activeStepBylines]);

	const steps: ChainOfThoughtScenarioStep[] = payload.steps.map((step) => {
		const byline = step.status === "active"
			? activeStepBylines[activeBylineIndex % Math.max(activeStepBylines.length, 1)] ?? step.byline
			: step.byline;
		const hasByline = byline != null && byline.trim().length > 0;

		return {
			id: step.id,
			label: step.skillMention ? invokingSkillLabel(step.skillMention) : step.label,
			description: step.status === "complete" ? null : byline,
			status: step.status,
			icon: stepIcon(step.iconKey),
			collapsible: hasByline,
			defaultOpen: step.status === "active",
			children: hasByline ? (
				<p className="text-xs leading-4 text-text-subtle">{byline}</p>
			) : undefined,
		};
	});

	return (
		<ChainOfThoughtScenario
			key={traceLifecycleKey}
			animateStepEntrance
			state={state}
			open={isTraceOpen}
			onOpenChange={setTraceOpen}
			headerLabel={headerLabel}
			duration={payload.durationSeconds}
			steps={steps}
		/>
	);
}
