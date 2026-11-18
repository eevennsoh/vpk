import type { ComponentDetail } from "@/app/data/component-detail-types";

export const QUEUE_DETAIL: ComponentDetail = {
	description:
		"A composable queue/task list with collapsible sections, status indicators, hover-revealed actions, and attachment badges. The default composer variant is the prompt queue that sits on top of a prompt input; variant=\"inline\" renders the agent's todo list inside its reply on Trace, like the shadcn Queue.",
	usage: `import {
  Queue,
  QueueSection,
  QueueSectionTrigger,
  QueueSectionLabel,
  QueueSectionContent,
  QueueList,
  QueueItem,
  QueueItemDragHandle,
  QueueItemIndicator,
  QueueItemContent,
  QueueItemDescription,
  QueueItemActions,
  QueueItemAction,
  QueueItemAttachment,
  QueueItemFile,
} from "@/components/ui/queue";

<Queue>
  <QueueSection>
    <QueueSectionTrigger>
      <QueueSectionLabel label="Pending" count={2} />
    </QueueSectionTrigger>
    <QueueSectionContent>
      <QueueList>
        <QueueItem>
          <div className="flex items-center gap-2">
            <QueueItemDragHandle />
            <QueueItemIndicator />
            <QueueItemContent>Write API endpoints</QueueItemContent>
          </div>
          <QueueItemDescription>REST endpoints for user CRUD</QueueItemDescription>
        </QueueItem>
      </QueueList>
    </QueueSectionContent>
  </QueueSection>
</Queue>`,
	props: [
		{
			name: "variant",
			type: '"composer" | "inline"',
			default: '"composer"',
			description: "Queue only. Composer is the prompt-input queue; inline renders the parts on Trace inside a message.",
		},
		{
			name: "status",
			type: '"running" | "error" | "pending"',
			description: "QueueItem, inline variant only. TraceLine status, such as running for the current todo.",
		},
		{
			name: "className",
			type: "string",
			description: "Additional classes applied to the root container.",
		},
	],
	subComponents: [
		{ name: "Queue", description: "Root container with border, background, and rounded styling." },
		{ name: "QueueSection", description: "Collapsible section wrapper with defaultOpen control." },
		{ name: "QueueSectionTrigger", description: "Clickable trigger button to toggle section visibility." },
		{ name: "QueueSectionLabel", description: "Label content with optional count and icon." },
		{ name: "QueueSectionContent", description: "Animated content area within a collapsible section." },
		{ name: "QueueList", description: "Scrollable list container (max-h-40) wrapping items in a ul." },
		{ name: "QueueItem", description: "Individual list item with hover highlight and group context for actions." },
		{ name: "QueueItemDragHandle", description: "Hover-revealed drag affordance that expands the row content to the right." },
		{ name: "QueueItemIndicator", description: "VPK-wrapped status dot icon. Pending uses icon subtle; completed uses icon disabled." },
		{ name: "QueueItemContent", description: "Primary item text with line-clamp. Accepts completed prop for strikethrough." },
		{ name: "QueueItemDescription", description: "Secondary descriptive text aligned under item content, including drag-handle hover offset." },
		{ name: "QueueItemActions", description: "Container for hover-revealed action buttons." },
		{ name: "QueueItemAction", description: "Ghost icon button that appears on item hover." },
		{ name: "QueueItemAttachment", description: "Flex-wrap container for file and image attachments." },
		{ name: "QueueItemFile", description: "File badge with paperclip icon and truncated filename." },
		{ name: "QueueItemImage", description: "Small thumbnail image (32x32) with rounded border." },
	],
	examples: [
		{ title: "Inline", description: "The agent's todo list inside its reply, split into to do and completed (shadcn Queue).", demoSlug: "queue-demo-inline" },
		{ title: "Prompt queue", description: "Chat-style prompt queue with removable items, as used in agent team composers.", demoSlug: "queue-demo-prompt-queue" },
		{ title: "With actions", description: "Items with hover-revealed edit, send-immediately, and delete action buttons.", demoSlug: "queue-demo-with-actions" },
		{ title: "With attachments", description: "Items with file attachment badges.", demoSlug: "queue-demo-with-attachments" },
		{ title: "Minimal", description: "Simple flat list without collapsible sections.", demoSlug: "queue-demo-minimal" },
	],
};
