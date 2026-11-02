"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence } from "motion/react";
import dynamic from "next/dynamic";
import { useRovoChatControls } from "@/app/contexts";
import { Button } from "@/components/ui/button";
import JiraWorkItemModal from "@/components/projects/jira/components/jira-work-item-modal";
import RovoFloatingChat from "@/components/projects/rovo-floating-chat/components/rovo-floating-chat";
import FloatingRovoButton from "@/components/projects/shared/components/floating-rovo-button";
import type { JiraWorkItemPreset } from "@/components/blocks/jira-work-item/data/session-state";
import type { ProjectButterPresentation } from "@/components/blocks/jira-work-item/project-butter/presentation";
import { ExperimentalJiraWorkItem } from "@/components/blocks/jira-work-item/experimental/experimental-jira-work-item";
import { ExperimentalV2JiraWorkItem } from "@/components/blocks/jira-work-item/experimental-v2/experimental-v2-jira-work-item";
import { ExperimentalV3JiraWorkItem } from "@/components/blocks/jira-work-item/experimental-v3/experimental-v3-jira-work-item";
import { ExperimentalV4JiraWorkItem } from "@/components/blocks/jira-work-item/experimental-v4/experimental-v4-jira-work-item";

const ExperimentalV5JiraWorkItem = dynamic(
	() => import("@/components/blocks/jira-work-item/experimental-v5/experimental-v5-jira-work-item")
		.then((module) => module.ExperimentalV5JiraWorkItem),
);

const TeamEu26JiraWorkItem = dynamic(
	() => import("@/components/blocks/jira-work-item/team-eu26/team-eu26-jira-work-item")
		.then((module) => module.TeamEu26JiraWorkItem),
);

const ProjectButterJiraWorkItem = dynamic(
	() => import("@/components/blocks/jira-work-item/project-butter/project-butter-jira-work-item")
		.then((module) => module.ProjectButterJiraWorkItem),
);

export type JiraWorkItemVariant = "default" | "experimental" | "experimental-v2" | "experimental-v3" | "experimental-v4" | "experimental-v5" | "team-eu26" | "project-butter";
export type JiraWorkItemExperimentalPreset = JiraWorkItemPreset;

/**
 * Experimental surfaces keyed by variant. `experimental-v2` is a full fork of
 * the v1 tree, with each later version continuing as a full fork so the
 * variants can diverge independently while sharing the model under `data/`.
 */
const EXPERIMENTAL_SURFACES = {
	experimental: ExperimentalJiraWorkItem,
	"experimental-v2": ExperimentalV2JiraWorkItem,
	"experimental-v3": ExperimentalV3JiraWorkItem,
	"experimental-v4": ExperimentalV4JiraWorkItem,
	"experimental-v5": ExperimentalV5JiraWorkItem,
	"team-eu26": TeamEu26JiraWorkItem,
	"project-butter": ProjectButterJiraWorkItem,
} as const;

type ExperimentalVariant = keyof typeof EXPERIMENTAL_SURFACES;

export interface JiraWorkItemProps {
	/** Opens the work item on initial render. Used by docs variant chooser entry points. */
	initialIssueOpen?: boolean;
	/** Called after the work item closes. */
	onIssueClose?: () => void;
	/** Opt-in layout variation. The default variant keeps the current Jira sessions surface. */
	variant?: JiraWorkItemVariant;
	/** Deterministic starting state for the experimental variants. */
	initialExperimentalPreset?: JiraWorkItemExperimentalPreset;
	/** Initial Project butter presentation; its header Settings can change it live. */
	projectButterPresentation?: ProjectButterPresentation;
	/** Opens Project butter in the suggestion state, with Teamwork Graph fills for empty fields. */
	projectButterSuggestion?: boolean;
}

export function JiraWorkItem({
	initialIssueOpen = false,
	onIssueClose,
	variant = "default",
	initialExperimentalPreset = "filled",
	projectButterPresentation = "full-screen",
	projectButterSuggestion = false,
}: Readonly<JiraWorkItemProps>) {
	return variant === "default" ? (
		<JiraWorkItemDefaultView initialIssueOpen={initialIssueOpen} onIssueClose={onIssueClose} />
	) : (
		<JiraWorkItemExperimentalView
			initialIssueOpen={initialIssueOpen}
			onIssueClose={onIssueClose}
			initialExperimentalPreset={initialExperimentalPreset}
			projectButterPresentation={projectButterPresentation}
			projectButterSuggestion={projectButterSuggestion}
			surface={variant}
		/>
	);
}

/** Shared open/close shell: the centered "Open work item" launcher container. */
function JiraWorkItemShell({ onOpen, children }: Readonly<{ onOpen: () => void; children: ReactNode }>) {
	return (
		<div className="flex h-full min-h-[400px] items-center justify-center p-4">
			<Button type="button" onClick={onOpen}>
				Open work item
			</Button>
			{children}
		</div>
	);
}

function JiraWorkItemDefaultView({
	initialIssueOpen,
	onIssueClose,
}: Readonly<{
	initialIssueOpen: boolean;
	onIssueClose?: () => void;
}>) {
	const [isIssueOpen, setIsIssueOpen] = useState(initialIssueOpen);
	const { chatSurface } = useRovoChatControls();

	function handleIssueClose() {
		setIsIssueOpen(false);
		onIssueClose?.();
	}

	return (
		<JiraWorkItemShell onOpen={() => setIsIssueOpen(true)}>
			<JiraWorkItemModal isOpen={isIssueOpen} onClose={handleIssueClose} />
			{isIssueOpen && chatSurface === null ? (
				<FloatingRovoButton ariaLabel="Open Rovo chat" product="jira" />
			) : null}
			<AnimatePresence>
				{chatSurface === "floating" ? <RovoFloatingChat key="floating-chat" /> : null}
			</AnimatePresence>
		</JiraWorkItemShell>
	);
}

function JiraWorkItemExperimentalView({
	initialIssueOpen,
	onIssueClose,
	initialExperimentalPreset,
	surface,
	projectButterPresentation,
	projectButterSuggestion,
}: Readonly<{
	initialIssueOpen: boolean;
	onIssueClose?: () => void;
	initialExperimentalPreset: JiraWorkItemExperimentalPreset;
	surface: ExperimentalVariant;
	projectButterPresentation: ProjectButterPresentation;
	projectButterSuggestion: boolean;
}>) {
	const [isIssueOpen, setIsIssueOpen] = useState(initialIssueOpen);
	const ExperimentalSurface = EXPERIMENTAL_SURFACES[surface];

	function handleIssueClose() {
		setIsIssueOpen(false);
		onIssueClose?.();
	}

	return (
		<JiraWorkItemShell onOpen={() => setIsIssueOpen(true)}>
			{surface === "project-butter" ? <ProjectButterJiraWorkItem initialPresentation={projectButterPresentation} initialPreset={initialExperimentalPreset} initialSuggestion={projectButterSuggestion} onClose={handleIssueClose} open={isIssueOpen} /> : <ExperimentalSurface
				open={isIssueOpen}
				onClose={handleIssueClose}
				initialPreset={initialExperimentalPreset}
			/>}
		</JiraWorkItemShell>
	);
}

export default JiraWorkItem;
