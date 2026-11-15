"use client";

import ArrowLeftIcon from "@atlaskit/icon/core/arrow-left";
import { WorkItemModalProvider, type WorkItemData } from "@/app/contexts/context-work-item-modal";
import { Button } from "@/components/ui/button";
import WorkItemModal from "./work-item-modal";

interface AgentsWorkItemInlinePageProps {
	workItem: WorkItemData;
	onBackToBoard: () => void;
	highlightedAttachmentId?: string | null;
	highlightedAttachmentKey?: number;
}

export function AgentsWorkItemInlinePage({
	workItem,
	onBackToBoard,
	highlightedAttachmentId,
	highlightedAttachmentKey,
}: Readonly<AgentsWorkItemInlinePageProps>) {
	return (
		<WorkItemModalProvider
			isOpen
			onClose={onBackToBoard}
			highlightedAttachmentId={highlightedAttachmentId}
			highlightedAttachmentKey={highlightedAttachmentKey}
			workItem={workItem}
		>
			<div className="flex h-full min-h-0 flex-col bg-surface">
				<div className="px-6 pt-4">
					<Button className="gap-2" variant="ghost" onClick={onBackToBoard}>
						<ArrowLeftIcon label="" size="small" />
						Back to board
					</Button>
				</div>
				<WorkItemModal.Header />
				<div className="flex min-h-0 flex-1 overflow-hidden">
					<div className="min-w-0 flex-1 overflow-y-auto px-10 py-6">
						<div className="mx-auto max-w-[900px]">
							<WorkItemModal.Title />
							<div className="mt-4">
								<WorkItemModal.Description />
								<WorkItemModal.ChildItems />
								<WorkItemModal.AgentPanel />
								<WorkItemModal.Attachments />
								<WorkItemModal.Activity />
							</div>
						</div>
					</div>
					<aside className="w-[408px] shrink-0 overflow-y-auto border-l border-border px-4 pb-6">
						<WorkItemModal.StatusHeader />
						<WorkItemModal.SidebarStack>
							<WorkItemModal.DetailsAccordion />
							<WorkItemModal.MoreFieldsAccordion />
							<WorkItemModal.AutomationAccordion />
						</WorkItemModal.SidebarStack>
					</aside>
				</div>
			</div>
		</WorkItemModalProvider>
	);
}
