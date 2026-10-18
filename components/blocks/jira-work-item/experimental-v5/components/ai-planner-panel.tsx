"use client";

import { useState, type ReactNode } from "react";

import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CrossIcon from "@atlaskit/icon/core/cross";

import {
	AGENT_PLANNER_SEARCH_PHASES,
	countPendingPlannerFields,
	type AgentPlannerSource,
} from "@/components/blocks/jira-work-item/data/planner-state";
import {
	useJiraWorkItemActions,
	useJiraWorkItemState,
} from "@/components/blocks/jira-work-item/experimental-v5/context-jira-work-item";
import { JiraWorkItemComposerMotion } from "@/components/blocks/jira-work-item/experimental-v5/components/jira-work-item-composer-motion";
import { FloatingComposer } from "@/components/projects/shared/components/floating-composer";
import { RovoComposerActionButton } from "@/components/projects/shared/components/rovo-composer-send-controls";
import { floatingComposerTextareaClassName } from "@/components/projects/shared/components/rovo-composer-styles";
import { Button } from "@/components/ui/button";
import { Tile } from "@/components/ui/tile";
import { PromptInputTextarea } from "@/components/ui-custom/prompt-input";
import { RovoGeneration } from "@/components/ui-custom/rovo-generation";
import { TwgTool, type TwgToolSource } from "@/components/ui-custom/twg-tool";
import { TWGLoader } from "@/components/ui-custom/twg-loader";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

const PLANNER_SOURCES = {
	twg: { id: "twg", label: "Teamwork Graph", provider: "twg" },
	jira: { id: "jira", label: "Jira", provider: "jira" },
	confluence: { id: "confluence", label: "Confluence", provider: "confluence" },
	"google-drive": { id: "google-drive", label: "Google Drive", provider: "google-drive" },
} as const satisfies Record<AgentPlannerSource, TwgToolSource>;

const ALL_PLANNER_SOURCES = [
	PLANNER_SOURCES.twg,
	PLANNER_SOURCES.jira,
	PLANNER_SOURCES.confluence,
	PLANNER_SOURCES["google-drive"],
] as const;

function TeamworkGraphLoaderTile() {
	return (
		<Tile
			className="relative z-10 bg-surface"
			hasBorder
			label="Teamwork Graph"
			size="large"
			variant="transparent"
		>
			<TWGLoader label="Teamwork Graph" size="small" />
		</Tile>
	);
}

/** Compact search/provenance banner; review controls live with the fields they affect. */
export function AiPlannerPanel() {
	const { planner } = useJiraWorkItemState();

	if (planner.status === "inactive" || planner.status === "applied") return null;

	if (planner.status === "searching") {
		const phase = AGENT_PLANNER_SEARCH_PHASES[planner.phaseIndex] ?? AGENT_PLANNER_SEARCH_PHASES[0];
		return (
			<div aria-busy="true" aria-live="polite" data-ai-planner-state="searching">
				<TwgTool
					description={phase.description}
					loader={<TeamworkGraphLoaderTile />}
					showChevron={false}
					sources={phase.sources.map((source) => PLANNER_SOURCES[source])}
					status="active"
					title="Teamwork Graph"
				/>
			</div>
		);
	}

	const isRefining = planner.status === "refining";
	const suggestionCount = countPendingPlannerFields(planner);
	const description = isRefining
		? `Updating the plan based on “${planner.lastPrompt ?? "your direction"}”`
		: `${suggestionCount} suggestions from 4 sources`;

	return (
		<div aria-busy={isRefining || undefined} aria-live="polite" data-ai-planner-state={planner.status}>
			<TwgTool
				description={description}
				loader={<TeamworkGraphLoaderTile />}
				showChevron={false}
				sources={ALL_PLANNER_SOURCES}
				status={isRefining ? "active" : "complete"}
				title="Teamwork Graph"
			/>
		</div>
	);
}

function AiPlannerActionBar() {
	const { planner } = useJiraWorkItemState();
	const actions = useJiraWorkItemActions();
	const [prompt, setPrompt] = useState("");
	const [realtimeVoiceActive, setRealtimeVoiceActive] = useState(false);
	const isRefining = planner.status === "refining";
	const canSubmit = Boolean(prompt.trim());

	return (
		<div
			className="relative z-20 mt-4"
			data-ai-planner-controls="floating"
		>
			<JiraWorkItemComposerMotion placement="planner">
				<FloatingComposer
					actions={(
						<div className="flex items-center gap-2">
							<Button
								disabled={isRefining}
								onClick={() => actions.rejectPlannerProposal()}
								size="default"
								type="button"
								variant="outline"
							>
								<CrossIcon label="" size="small" />
								Reject
							</Button>
							<Button
								disabled={isRefining}
								onClick={() => actions.applyPlannerProposal()}
								size="default"
								type="button"
								variant="outline"
							>
								<CheckMarkIcon label="" size="small" />
								Accept suggestions
							</Button>
							<RovoComposerActionButton
								canSubmit={canSubmit}
								composerStatus="ready"
								onStop={() => setRealtimeVoiceActive(false)}
								onToggleRealtimeVoice={() => setRealtimeVoiceActive((active) => !active)}
								realtimeVoiceActive={realtimeVoiceActive}
									submitDisabled={isRefining}
							/>
						</div>
					)}
					allowOverflow
					aria-label="Teamwork Graph controls"
					className="border-0 bg-surface-overlay"
					onSubmit={(message, event) => {
						const nextPrompt = message.text.trim();
						if (!nextPrompt || isRefining) return;
						actions.refinePlannerProposal(nextPrompt);
						setPrompt("");
						setRealtimeVoiceActive(false);
						event.currentTarget.reset();
					}}
					style={{ boxShadow: token("elevation.shadow.overlay") }}
				>
					<PromptInputTextarea
						aria-label="Tell Rovo what to change"
						autoResize
						className={cn(floatingComposerTextareaClassName, "text-sm leading-5")}
						disabled={isRefining}
						enableDirectoryAutocomplete={false}
						onChange={(event) => setPrompt(event.currentTarget.value)}
						placeholder="Tell Rovo what to change…"
						rows={1}
						value={prompt}
					/>
				</FloatingComposer>
			</JiraWorkItemComposerMotion>
		</div>
	);
}

/** One-shot Rovo highlight and floating controls scoped to the fields Rovo populated. */
export function AiPlannerScope({
	children,
	header,
}: Readonly<{ children: ReactNode; header: ReactNode }>) {
	const { planner } = useJiraWorkItemState();
	const isReviewing = planner.status === "ready" || planner.status === "refining";
	const hasPlanner = planner.status === "searching" || isReviewing;
	const content = (
		<div
			className={cn(
				"flex flex-col gap-3",
				hasPlanner ? "rounded-xl border border-border bg-bg-input p-1.5" : null,
			)}
		>
			{header}
			<div className={cn("group/description-scope flex flex-col gap-6", hasPlanner ? "px-2 pb-2" : null)}>
				{children}
			</div>
		</div>
	);

	return (
		<div
			className={hasPlanner ? "relative" : undefined}
			data-ai-planner-scope={hasPlanner ? "active" : undefined}
		>
			<RovoGeneration.Highlight active={isReviewing} className="block w-full">
				{content}
			</RovoGeneration.Highlight>
			{isReviewing ? <AiPlannerActionBar /> : null}
		</div>
	);
}
