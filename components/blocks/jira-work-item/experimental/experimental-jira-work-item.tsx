"use client";

import { LayoutGroup } from "motion/react";
import { useId, useMemo } from "react";

import { getAgentsWorkItemForCard } from "@/components/projects/jira/data/rfp-work-items";
import { WorkItemModalProvider } from "@/app/contexts/context-work-item-modal";
import { RovoChatProvider } from "@/app/contexts/context-rovo-chat";
import { useOptionalRovoChatControls } from "@/app/contexts/context-rovo-chat-controls";
import { ASX_CHAT_AGENT_PROFILES } from "@/components/projects/jira-golden-journey-v0/data/agent-chat-data";
import type { JiraWorkItemPreset } from "@/components/blocks/jira-work-item/data/session-state";
import type { JiraWorkItemState } from "@/components/blocks/jira-work-item/data/session-state";
import type { WorkItemData } from "@/app/contexts/context-work-item-modal";
import { JiraWorkItemProvider } from "@/components/blocks/jira-work-item/experimental/context-jira-work-item";
import { PanelLayoutProvider } from "@/components/blocks/jira-work-item/experimental/context-panel-layout";
import { ExperimentalWorkItemDialog } from "@/components/blocks/jira-work-item/experimental/components/experimental-work-item-dialog";
import { ExperimentalWorkItemLayout } from "@/components/blocks/jira-work-item/experimental/components/experimental-work-item-layout";
import { ContextPanel } from "@/components/blocks/jira-work-item/experimental/components/context-panel";
import { ActivityPanel } from "@/components/blocks/jira-work-item/experimental/components/activity-panel";
import { ActivityComposer } from "@/components/blocks/jira-work-item/experimental/components/activity-composer";
import { MetadataRail } from "@/components/blocks/jira-work-item/experimental/components/metadata-rail";
import { FloatingSessionSurface } from "@/components/blocks/jira-work-item/experimental/components/floating-session-surface";
import type { CodingAgentId } from "@/components/blocks/jira-work-item/experimental/components/context-title-actions";

interface ExperimentalJiraWorkItemBaseProps {
	defaultMetadataCollapsed?: boolean;
	initialPreset: JiraWorkItemPreset;
	initialState?: JiraWorkItemState;
	outputs?: readonly string[];
	primaryCodingAgentId?: CodingAgentId;
	workItem?: WorkItemData;
}

export type ExperimentalJiraWorkItemProps = ExperimentalJiraWorkItemBaseProps & (
	| { presentation?: "modal"; open: boolean; onClose: () => void }
	| {
		presentation: "inline";
		inlineSurface?: "card" | "fill";
		open?: never;
		onClose?: never;
	}
);

const NOOP = () => undefined;

/**
 * Composition root for the experimental Jira Work Item surface.
 *
 * Wraps the whole experience in the block-local `JiraWorkItemProvider` (one
 * shared session-state instance) so the launcher, the floating session panel,
 * and the Activity `@`-reply composer all act on the same sessions. The floating
 * session surface is mounted in the dialog portal but outside the popup, keeping
 * it interactive on the blanket without making the modal its positioning root.
 */
export function ExperimentalJiraWorkItem(props: Readonly<ExperimentalJiraWorkItemProps>) {
	const chatControls = useOptionalRovoChatControls();
	const composerLayoutGroupId = useId();
	const { initialPreset, initialState } = props;
	let presentation: "modal" | "inline";
	let inlineSurface: "card" | "fill" = "card";
	let open: boolean;
	let onClose: () => void;
	if (props.presentation === "inline") {
		presentation = "inline";
		inlineSurface = props.inlineSurface ?? "card";
		open = true;
		onClose = NOOP;
	} else {
		presentation = "modal";
		open = props.open;
		onClose = props.onClose;
	}
	const defaultWorkItem = useMemo(
		() => getAgentsWorkItemForCard({
				title: "Acmecorp: Prepare for bid recommendation for ESM RFP",
				code: "RFP-101",
			}),
		[],
	);
	const workItem = props.workItem ?? defaultWorkItem;

	const workItemSurface = (
		// Keep the WorkItemModalProvider mounted (isOpen always true) so the reused
		// standard ModalHeader has its context and the Base UI dialog owns its own
		// open/close lifecycle + enter/exit animation. Read-only reuse — the standard
		// modal itself is untouched.
		<WorkItemModalProvider isOpen onClose={onClose} workItem={workItem}>
			<JiraWorkItemProvider initialPreset={initialPreset} initialState={initialState} workItem={workItem} active={open}>
				<PanelLayoutProvider defaultMetadataCollapsed={props.defaultMetadataCollapsed ?? false}>
					<LayoutGroup id={composerLayoutGroupId}>
						<ExperimentalWorkItemDialog
							inlineSurface={inlineSurface}
							open={open}
							onClose={onClose}
							presentation={presentation}
							primaryCodingAgentId={props.primaryCodingAgentId}
							workItemCode={workItem.code}
							workItemTitle={workItem.title}
							blanketContent={
								<FloatingSessionSurface portalToViewport={presentation === "inline"} />
							}
						>
							<ExperimentalWorkItemLayout
								context={<ContextPanel outputs={props.outputs} />}
								activity={<ActivityPanel />}
								composer={<ActivityComposer />}
								fillContainer={inlineSurface === "fill"}
								metadata={<MetadataRail />}
							/>
						</ExperimentalWorkItemDialog>
					</LayoutGroup>
				</PanelLayoutProvider>
			</JiraWorkItemProvider>
		</WorkItemModalProvider>
	);

	return chatControls ? workItemSurface : <RovoChatProvider agentProfiles={ASX_CHAT_AGENT_PROFILES}>{workItemSurface}</RovoChatProvider>;
}

export default ExperimentalJiraWorkItem;
