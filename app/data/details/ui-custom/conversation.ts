import type { ComponentDetail } from "@/app/data/component-detail-types";

export const CONVERSATION_DETAIL: ComponentDetail = {
	description:
		"A bounded conversation surface with follow-to-latest behavior, user escape detection, empty-state scaffolding, a scroll-to-bottom affordance, and markdown export for transcript-style interfaces.",
	importStatement: `import {
  Conversation,
  ConversationContent,
  ConversationDownload,
  ConversationEmptyState,
  ConversationScrollButton,
  messagesToMarkdown,
} from "@/components/ui-custom/conversation";`,
	usage: `import {
  Conversation,
  ConversationContent,
  ConversationDownload,
  ConversationScrollButton,
} from "@/components/ui-custom/conversation";
import { Message, MessageContent } from "@/components/ui-custom/message";
import { MessageScrollerItem } from "@/components/ui/message-scroller";

const messages = [
  { role: "user", content: "Summarize the latest conversation changes." },
  { role: "assistant", content: "I added the markdown export and updated the follow-to-bottom behavior." },
];

<Conversation className="h-80 rounded-xl border bg-background">
  <ConversationContent className="min-h-full pr-20">
    {messages.map((message) => (
      <MessageScrollerItem
        key={\`\${message.role}-\${message.content}\`}
        messageId={\`\${message.role}-\${message.content}\`}
        scrollAnchor={message.role === "user"}
      >
        <Message from={message.role}>
          <MessageContent>{message.content}</MessageContent>
        </Message>
      </MessageScrollerItem>
    ))}
  </ConversationContent>
  <ConversationDownload messages={messages} />
  <ConversationScrollButton />
</Conversation>`,
	props: [
		{
			name: "followMode",
			type: '"bottom" | "target"',
			default:
				'"bottom" (or `"target"` when `targetScrollTop` is provided)',
			description:
				"Controls whether the surface follows the true bottom edge or a computed target scroll position.",
		},
		{
			name: "initial",
			type: 'boolean | ScrollBehavior | "instant" | { damping: number; stiffness: number; mass: number }',
			default: '"smooth"',
			description:
				"Starts at the bottom by default; false starts at the top.",
		},
		{
			name: "resize",
			type: 'boolean | ScrollBehavior | "instant" | { damping: number; stiffness: number; mass: number }',
			default: '"smooth"',
			description:
				"Enables follow while the transcript grows; false disables automatic follow.",
		},
		{
			name: "targetScrollTop",
			type: "(defaultTargetTop: number, options: ConversationScrollTargetOptions) => number",
			description:
				"Overrides the computed follow target used by auto-scroll and the scroll-to-bottom action.",
		},
		{
			name: "messages",
			type: "ConversationMessage[] | UIMessage[]",
			description:
				"Transcript entries serialized by ConversationDownload and messagesToMarkdown.",
		},
		{
			name: "filename",
			type: "string",
			default: '"conversation.md"',
			description: "Download filename used for the markdown export.",
		},
		{
			name: "formatMessage",
			type: "(message: ConversationMessage | UIMessage, index: number) => string",
			description:
				"Custom serializer used to turn each message into markdown output.",
		},
		{
			name: "className",
			type: "string",
			description:
				"Additional classes applied to the conversation root or action buttons.",
		},
	],
	subComponents: [
		{
			name: "ConversationContent",
			description:
				"Scrollable inner viewport and message stack with stable scrollbar gutter handling.",
		},
		{
			name: "ConversationEmptyState",
			description:
				"Centered placeholder for empty transcripts and first-run states.",
		},
		{
			name: "ConversationScrollButton",
			description:
				"Floating jump-to-latest action that appears once the user scrolls away from the follow target.",
		},
		{
			name: "ConversationDownload",
			description:
				"Floating export action that downloads the current transcript as markdown.",
		},
		{
			name: "messagesToMarkdown",
			description:
				"Helper for generating markdown outside the built-in download button.",
		},
		{
			name: "useConversationContext",
			description:
				"Hook exposing the scroll refs, current bottom state, and scrollToBottom() for custom controls.",
		},
	],
	demoLayout: {
		previewContentWidth: "full",
	},
};
