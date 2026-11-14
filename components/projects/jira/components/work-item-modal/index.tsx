"use client";

/**
 * WorkItemModal - Compound Components Pattern
 *
 * This module exports a compound component object that allows flexible composition
 * of modal parts. Each sub-component is in its own file for maintainability.
 *
 * Usage:
 * ```tsx
 * import WorkItemModal from "./work-item-modal";
 *
 * <WorkItemModal.Backdrop />
 * <WorkItemModal.Container>
 *   <WorkItemModal.Header />
 *   ...
 * </WorkItemModal.Container>
 * ```
 */

import { ModalBackdrop } from "./modal-backdrop";
import { ModalContainer, TwoColumnLayout, LeftColumn, RightColumn } from "./modal-container";
import { ModalHeader, ModalTitle } from "@/components/blocks/jira-work-item/components/work-item-modal/modal-header";
import { Description } from "./description-section";
import { ChildItemsSection } from "./child-items-section";
import { AgentPanel } from "./agent-panel";
import { AttachmentsSection } from "./attachments-section";
import { ActivitySection } from "./activity-section";
import { CommentThread } from "./comment-thread";
import { CommentActions } from "./comment-actions";
import { DetailsAccordion } from "./details-accordion";
import { MoreFieldsAccordion } from "./more-fields-accordion";
import { AutomationAccordion } from "./automation-accordion";
import { SidebarStack, StatusHeader } from "./sidebar-stack";
import { DetailRow } from "./detail-row";

const WorkItemModal = {
	Backdrop: ModalBackdrop,
	Container: ModalContainer,
	Header: ModalHeader,
	TwoColumnLayout,
	LeftColumn,
	RightColumn,
	Title: ModalTitle,
	Description,
	ChildItems: ChildItemsSection,
	AgentPanel,
	Attachments: AttachmentsSection,
	Activity: ActivitySection,
	StatusHeader,
	DetailsAccordion,
	MoreFieldsAccordion,
	AutomationAccordion,
	SidebarStack,
	DetailRow,
	CommentThread,
	CommentActions,
};

export default WorkItemModal;
