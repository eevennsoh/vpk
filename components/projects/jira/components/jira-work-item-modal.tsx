"use client";

/**
 * JiraWorkItemModal - Compound Components Pattern
 *
 * This component uses composition to break a large modal
 * into smaller, reusable pieces.
 *
 * Benefits:
 * - Each component is small and focused
 * - State is managed via context (no prop drilling)
 * - Easy to customize by composing different pieces
 * - Better testability
 *
 * Usage:
 * ```tsx
 * <JiraWorkItemModal
 *   isOpen={isModalOpen}
 *   onClose={() => setIsModalOpen(false)}
 *   workItemTitle="My Task"
 *   workItemCode="PROJ-123"
 * />
 * ```
 */

import type { RefObject } from "react";

import { WorkItemModalProvider } from "@/app/contexts/context-work-item-modal";
import type { WorkItemAttachment, WorkItemData } from "@/app/contexts/context-work-item-modal";
import { getAgentsWorkItemForCard } from "../data/rfp-work-items";
import WorkItemModal from "./work-item-modal/index";

interface JiraWorkItemModalProps {
	isOpen: boolean;
	onClose: () => void;
	onAttachmentOpen?: (attachment: WorkItemAttachment) => void;
	highlightedAttachmentId?: string | null;
	highlightedAttachmentKey?: number;
	workItem?: WorkItemData | null;
	workItemTitle?: string;
	workItemCode?: string;
	/** Where focus goes on close when the modal opened with nothing focused (for example, mounted open). */
	finalFocusFallback?: RefObject<HTMLElement | null>;
}

export default function JiraWorkItemModal({
	isOpen,
	onClose,
	onAttachmentOpen,
	highlightedAttachmentId,
	highlightedAttachmentKey,
	workItem,
	workItemTitle = "Acmecorp: Prepare for bid recommendation for ESM RFP",
	workItemCode = "RFP-101",
	finalFocusFallback,
}: Readonly<JiraWorkItemModalProps>) {
	const resolvedWorkItem = workItem ?? getAgentsWorkItemForCard({
		title: workItemTitle,
		code: workItemCode,
	});

	return (
		<WorkItemModalProvider
			isOpen={isOpen}
			onClose={onClose}
			onAttachmentOpen={onAttachmentOpen}
			highlightedAttachmentId={highlightedAttachmentId}
			highlightedAttachmentKey={highlightedAttachmentKey}
			workItem={resolvedWorkItem}
		>
			<WorkItemModal.Root finalFocusFallback={finalFocusFallback}>
				<WorkItemModal.Backdrop />
				<WorkItemModal.Container>
					<WorkItemModal.Header />
					<WorkItemModal.TwoColumnLayout>
						<WorkItemModal.LeftColumn>
							<WorkItemModal.Title />
							<WorkItemModal.Description />
							<WorkItemModal.ChildItems />
							<WorkItemModal.AgentPanel />
							<WorkItemModal.Attachments />
							<WorkItemModal.Activity />
						</WorkItemModal.LeftColumn>
						<WorkItemModal.RightColumn>
							<WorkItemModal.StatusHeader />
							<WorkItemModal.SidebarStack>
								<WorkItemModal.DetailsAccordion />
								<WorkItemModal.MoreFieldsAccordion />
								<WorkItemModal.AutomationAccordion />
							</WorkItemModal.SidebarStack>
						</WorkItemModal.RightColumn>
					</WorkItemModal.TwoColumnLayout>
				</WorkItemModal.Container>
			</WorkItemModal.Root>
		</WorkItemModalProvider>
	);
}
