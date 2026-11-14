"use client";

import { useCallback, useMemo, useReducer, useState } from "react";
import StatusSuccessIcon from "@atlaskit/icon/core/status-success";

import { getAppById, type DirectoryApp } from "@/app/data/directory/apps";
import type { AgentTemplateAgent } from "@/components/blocks/agent-template";
import type {
	AgentBrowserTemplateBuildOptions,
	AgentBrowserTemplateBuildResult,
} from "@/components/blocks/agent-browser";
import { GreetingPromptRow } from "@/components/projects/shared/components/greeting-prompt-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AtlassianLogoMark, BrandLogoMark } from "@/components/ui/logo-mark";
import type { AtlassianLogoName } from "@/components/ui/logo";
import { ProgressTracker, type ProgressTrackerStep } from "@/components/ui/progress-tracker";
import { useHasVerticalOverflow } from "@/components/hooks/use-has-vertical-overflow";
import { useTimedTransition } from "@/components/hooks/use-timed-transition";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import {
	selectTemplateBuildActiveStep,
	selectTemplateBuildTimerKey,
	TEMPLATE_BUILD_INITIAL_STATE,
	TEMPLATE_BUILD_STEP_LABELS,
	TEMPLATE_BUILD_TIMERS,
	templateBuildReducer,
	type TemplateBuildState,
} from "./template-build-machine";

function getTemplateBuildSteps(state: TemplateBuildState): ProgressTrackerStep[] {
	const activeIndex = selectTemplateBuildActiveStep(state);
	return TEMPLATE_BUILD_STEP_LABELS.map((label, index) => ({
		id: label.toLowerCase().replace(/\s+/gu, "-"),
		label,
		state: state.phase === "built" || index < activeIndex
			? "done"
			: index === activeIndex && state.phase === "building"
				? "current"
				: "todo",
	}));
}

function getTemplateDirectoryAppLogo(app: DirectoryApp) {
	if (app.logoName || app.id === "atlassian") {
		return <AtlassianLogoMark label={app.name} name={app.logoName ?? "atlassian"} size="medium" />;
	}

	if (app.brandName) {
		return <BrandLogoMark frame="tile" label={app.name} name={app.brandName} size="medium" />;
	}

	const src = app.logoSrc ?? app.avatarSrc;
	return src ? <BrandLogoMark frame="tile" label={app.name} size="medium" src={src} /> : null;
}

function getTemplateSourceLogo(
	source: NonNullable<AgentTemplateAgent["sources"]>[number],
) {
	const directoryApp = getAppById(source.id);

	if (directoryApp) {
		return getTemplateDirectoryAppLogo(directoryApp);
	}

	if (source.name) {
		return <BrandLogoMark frame="tile" label={source.label} name={source.name} size="medium" />;
	}

	if (source.iconSrc) {
		return <BrandLogoMark frame="tile" label={source.label} size="medium" src={source.iconSrc} />;
	}

	if (source.provider === "google-drive" || source.provider === "salesforce") {
		return (
			<BrandLogoMark
				frame="tile"
				label={source.label}
				name={source.provider}
				size="medium"
			/>
		);
	}

	if (source.provider === "twg") {
		return <AtlassianLogoMark label={source.label} name="jira-service-management" size="medium" />;
	}

	return <AtlassianLogoMark label={source.label} name={source.provider as AtlassianLogoName} size="medium" />;
}

export interface UseTemplateBuildFlowOptions {
	agent: AgentTemplateAgent;
	onBuildAgent?: (
		agent: AgentTemplateAgent,
		options: AgentBrowserTemplateBuildOptions
	) => AgentBrowserTemplateBuildResult | null;
	onCancel: () => void;
}

export function useTemplateBuildFlow({
	agent,
	onBuildAgent,
	onCancel,
}: Readonly<UseTemplateBuildFlowOptions>) {
	const [state, dispatch] = useReducer(templateBuildReducer, TEMPLATE_BUILD_INITIAL_STATE);
	const [selectedAppIds, setSelectedAppIds] = useState<ReadonlySet<string>>(() => new Set());
	const buildSteps = useMemo(() => getTemplateBuildSteps(state), [state]);

	// Steps are a staged reveal with no reduced-motion variant today, so the hold is kept.
	useTimedTransition(selectTemplateBuildTimerKey(state), TEMPLATE_BUILD_TIMERS, {
		onAdvance: (next) => {
			if (next !== "finish") {
				dispatch({ type: "step-elapsed" });
				return;
			}
			if (state.phase !== "building") {
				return;
			}
			// A host's null means the build failed. Without a host (a docs preview) the flow
			// finishes on a demo profile so the walkthrough still ends on "ready".
			const result = onBuildAgent
				? onBuildAgent(agent, state.options)
				: { profileId: `demo-template-${agent.id}` };
			dispatch({ type: "build-finished", result });
		},
		reducedMotion: false,
		restartKey: state.phase === "building" ? state.options : null,
	});

	const startBuild = useCallback((connectApps: boolean) => {
		const appIds = connectApps ? [...selectedAppIds] : [];
		dispatch({
			type: "start",
			options: { appIds, connectApps: connectApps && appIds.length > 0 },
		});
	}, [selectedAppIds]);

	const builtAgentCancel = state.phase === "built" ? state.onCancel : null;
	const cancel = useCallback(() => {
		builtAgentCancel?.();
		onCancel();
	}, [builtAgentCancel, onCancel]);

	const toggleApp = useCallback((sourceId: string) => {
		setSelectedAppIds((currentAppIds) => {
			const nextAppIds = new Set(currentAppIds);
			if (nextAppIds.has(sourceId)) {
				nextAppIds.delete(sourceId);
			} else {
				nextAppIds.add(sourceId);
			}

			return nextAppIds;
		});
	}, []);

	return {
		buildSteps,
		builtProfileId: state.phase === "built" ? state.profileId : null,
		cancel,
		phase: state.phase,
		state,
		selectedAppCount: selectedAppIds.size,
		selectedAppIds,
		startBuild,
		toggleApp,
	};
}

export interface TemplateBuildFlowProps {
	agent: AgentTemplateAgent;
	onBuildAgent?: (
		agent: AgentTemplateAgent,
		options: AgentBrowserTemplateBuildOptions
	) => AgentBrowserTemplateBuildResult | null;
	onCancel: () => void;
	onOpenBuiltAgent: (agent: AgentTemplateAgent, profileId: string) => void;
}

export function TemplateBuildFlow({
	agent,
	onCancel,
	onBuildAgent,
	onOpenBuiltAgent,
}: Readonly<TemplateBuildFlowProps>) {
	const {
		buildSteps,
		cancel,
		phase,
		selectedAppCount,
		selectedAppIds,
		startBuild,
		state,
		toggleApp,
	} = useTemplateBuildFlow({ agent, onBuildAgent, onCancel });
	const appSources = agent.sources ?? [];
	const appListOverflow = useHasVerticalOverflow<HTMLDivElement>();

	if (phase === "building" || phase === "built" || phase === "error") {
		return (
			<section
				aria-label={`Build ${agent.name}`}
				className="flex h-[515px] w-full flex-col rounded-2xl border border-border bg-surface-raised p-5"
			>
				<div className="flex min-h-0 flex-1 flex-col">
					<p style={{ font: token("font.heading.small") }} className="text-text">
						{phase === "built" ? `${agent.name} is ready` : "Build your agent"}
					</p>
					<p className="mt-1 text-sm leading-5 text-text-subtle">
						{phase === "error"
							? "We couldn't create this draft. Try again or start from another template."
							: phase === "built"
								? "Review agent before publishing."
								: "Setting up your agent."}
					</p>
					<div className="mt-8">
						<ProgressTracker
							aria-label={`${agent.name} build progress`}
							className="template-build-progress-spinner gap-1.5"
							labelClassName="text-sm leading-5"
							steps={buildSteps}
						/>
					</div>
				</div>
				<div className="mt-6 grid gap-2">
					{state.phase === "built" ? (
						<>
							<Button
								onClick={() => onOpenBuiltAgent(agent, state.profileId)}
								type="button"
							>
								See agent
							</Button>
							<Button onClick={cancel} type="button" variant="ghost">
								Cancel
							</Button>
						</>
					) : phase === "error" ? (
						<>
							<Button onClick={() => startBuild(true)} type="button">
								Try again
							</Button>
							<Button onClick={cancel} type="button" variant="ghost">
								Cancel
							</Button>
						</>
					) : (
						<>
							<Button disabled type="button">
								Building...
							</Button>
							<Button onClick={cancel} type="button" variant="ghost">
								Cancel
							</Button>
						</>
					)}
				</div>
			</section>
		);
	}

	return (
		<section
			aria-label={`Connect apps for ${agent.name}`}
			className="flex h-[515px] w-full flex-col rounded-2xl border border-border bg-surface-raised p-5"
		>
			<div className="flex min-h-0 flex-1 flex-col">
				<p style={{ font: token("font.heading.small") }} className="text-text">
					Connect your apps
				</p>
				<p className="mt-1 text-sm leading-5 text-text-subtle">
					Pick your apps, you can adjust later too.
				</p>
				<div
					className={cn(
						"mt-6 flex max-h-[304px] flex-col gap-1 overflow-y-auto pr-1",
						appListOverflow.showBottomScrollMask && "scroll-mask-bottom overscroll-contain",
					)}
					ref={appListOverflow.ref}
				>
					{appSources.length > 0 ? (
						appSources.map((source) => {
							const isSelected = selectedAppIds.has(source.id);

							return (
								<GreetingPromptRow
									className="group/template-app-row shrink-0"
									description={`Use ${source.label} context while setting up ${agent.name}.`}
									key={source.id}
									label={source.label}
									onClick={() => toggleApp(source.id)}
									selected={isSelected}
									shortcut={
										<span
											aria-hidden="true"
											className={cn(
												"opacity-0 transition-opacity duration-fast",
												"text-icon-subtle [&_svg]:text-icon-subtle!",
												"group-hover/template-app-row:opacity-100 group-focus-visible/template-app-row:opacity-100",
												isSelected && "opacity-100",
											)}
										>
											<StatusSuccessIcon
												color="currentColor"
												label=""
												size="small"
												spacing="none"
											/>
										</span>
									}
									visual={getTemplateSourceLogo(source)}
								/>
							);
						})
					) : (
						<p className="rounded-lg bg-surface-sunken px-3 py-2 text-sm leading-5 text-text-subtle">
							This template does not require app setup.
						</p>
					)}
				</div>
			</div>
			<div className="mt-6 grid gap-2">
				<Button onClick={() => startBuild(true)} type="button">
					Continue
					{selectedAppCount > 0 ? <Badge variant="inverse">{selectedAppCount}</Badge> : null}
				</Button>
				<Button onClick={cancel} type="button" variant="ghost">
					Cancel
				</Button>
			</div>
		</section>
	);
}
