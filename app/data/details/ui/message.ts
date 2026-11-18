import type { ComponentDetail } from "@/app/data/component-detail-types";

export const MESSAGE_DETAIL: ComponentDetail = {
    description:
      "A composable message row primitive for chat layouts, with avatar, header, content, footer, grouping, start/end alignment, and AI chat actions (tooltip action buttons plus Copy, Edit, Vote, and Regenerate presets).",
    usage: `import { Message, MessageContent } from "@/components/ui/message";
import { Bubble, BubbleContent } from "@/components/ui/bubble";

<Message align="end">
  <MessageContent>
    <Bubble align="end">
      <BubbleContent>Ship it.</BubbleContent>
    </Bubble>
  </MessageContent>
</Message>`,
    props: [
      {
        name: "align",
        type: '"start" | "end"',
        default: '"start"',
        description: "Message row alignment. Use \"end\" for the person's turn.",
      },
      {
        name: "reveal",
        type: '"hover" | "always"',
        default: '"always"',
        description: "MessageActions only: hide the actions on md+ screens until the message is hovered or an action has focus.",
      },
      {
        name: "label / tooltip",
        type: "string",
        description: "MessageAction only: accessible name and tooltip text (tooltip falls back to label).",
      },
    ],
    subComponents: [
      { name: "MessageGroup", description: "Stack of message rows." },
      { name: "MessageAvatar", description: "Avatar slot aligned with the message." },
      { name: "MessageContent", description: "Container for header, bubbles, and footer." },
      { name: "MessageHeader", description: "Metadata above message content." },
      { name: "MessageFooter", description: "Metadata below message content." },
      { name: "MessageActions", description: "MessageFooter row for action buttons, with optional hover reveal." },
      { name: "MessageAction", description: "Ghost icon button with a tooltip." },
      { name: "MessageCopyAction", description: "Preset: copies the given text." },
      { name: "MessageEditAction", description: "Preset: edit button." },
      { name: "MessageVoteActions", description: "Preset: like/dislike toggles with aria-pressed." },
      { name: "MessageRegenerateAction", description: "Preset: regenerate button." },
    ],
    examples: [
      { title: "Message", demoSlug: "message-demo-message" },
      { title: "Avatar", demoSlug: "message-demo-avatar" },
      { title: "Group", demoSlug: "message-demo-group" },
      { title: "Group Chat", demoSlug: "message-demo-group-chat" },
      { title: "Header and Footer", demoSlug: "message-demo-header-and-footer" },
      { title: "Actions", demoSlug: "message-demo-actions" },
      { title: "Attachment", demoSlug: "message-demo-attachment" },
      { title: "Attachment Group", demoSlug: "message-demo-attachment-group" },
      {
        title: "AI chat turn",
        description: "shadcn's AI Elements Message pattern: a muted user bubble, then a markdown reply with tooltip actions.",
        demoSlug: "message-demo-pattern",
      },
      {
        title: "Preset actions",
        description: "VPK's user bubble (MessageUserBubble) with hover-revealed Copy/Edit, and the Copy, Vote, and Regenerate presets on the reply.",
        demoSlug: "message-demo-preset-actions",
      },
    ],
  };
