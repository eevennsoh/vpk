import type { ComponentDetail } from "@/app/data/component-detail-types";

export const MESSAGE_SCROLLER_DETAIL: ComponentDetail = {
    description:
      "A headless @shadcn/react message-scroller wrapper with VPK styling for chat logs, anchored items, and scroll-to-start/end controls.",
    usage: `import { MessageScroller, MessageScrollerViewport, MessageScrollerContent, MessageScrollerItem } from "@/components/ui/message-scroller";

<MessageScroller>
  <MessageScrollerViewport>
    <MessageScrollerContent>
      <MessageScrollerItem>Message</MessageScrollerItem>
    </MessageScrollerContent>
  </MessageScrollerViewport>
</MessageScroller>`,
    props: [
      {
        name: "autoScroll",
        type: "boolean",
        description: "Provider option controlling automatic scrolling behavior.",
      },
      {
        name: "scrollAnchor",
        type: "boolean",
        default: "false",
        description: "Marks a MessageScrollerItem as a scroll anchor.",
      },
      {
        name: "direction",
        type: '"start" | "end"',
        default: '"end"',
        description: "MessageScrollerButton scroll target.",
      },
    ],
    subComponents: [
      { name: "MessageScrollerProvider", description: "Optional provider for scroll behavior configuration." },
      { name: "MessageScrollerViewport", description: "Scrollable viewport." },
      { name: "MessageScrollerContent", description: "Message list content area." },
      { name: "MessageScrollerItem", description: "Virtualized-friendly message item." },
      { name: "MessageScrollerButton", description: "Floating scroll button." },
    ],
    examples: [
      { title: "Chat", description: "An agent thread: the person's turn anchors, reasoning and tool calls stream in a Trace, and the reply renders as markdown.", demoSlug: "message-scroller-demo-chat" },
      { title: "Anchoring Turns", description: "Choose which role anchors the next turn.", demoSlug: "message-scroller-anchoring" },
      { title: "Group Chat", description: "Use a join marker as an anchor.", demoSlug: "message-scroller-group-chat" },
      { title: "Keeping Context Visible", description: "Adjust how much of the previous message remains in view.", demoSlug: "message-scroller-context" },
      { title: "Streaming Messages", description: "Follow a response as it grows or scroll away to read.", demoSlug: "message-scroller-streaming" },
      { title: "Opening Position", description: "Compare start, end, and last-anchor positions.", demoSlug: "message-scroller-opening" },
      { title: "Load History", description: "Prepend older messages while preserving the reader's place.", demoSlug: "message-scroller-history" },
      { title: "Animation", description: "Animate new messages without changing their layout.", demoSlug: "message-scroller-animation" },
      { title: "Commands", description: "Jump to the start, end, or a particular message.", demoSlug: "message-scroller-commands" },
      { title: "Transcript Outline", description: "Track and navigate the current anchored turn.", demoSlug: "message-scroller-outline" },
      { title: "Scroll Status", description: "Show which directions the transcript can scroll.", demoSlug: "message-scroller-status" },
    ],
    demoLayout: {
      previewContentWidth: "full",
      examplesContentWidth: "full",
    },
  };
