import type { ComponentDetail } from "@/app/data/component-detail-types";

export const CHAT_DETAIL: ComponentDetail = {
	description:
		"The thread. Each turn is a Message inside Message Scroller. The person's message is the scroll anchor, so a new question settles near the top and the reply streams in under it.",
	importStatement: `import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Message, MessageContent } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";`,
	usage: `<MessageScroller autoScroll>
  <MessageScrollerViewport>
    <MessageScrollerContent>
      <MessageScrollerItem messageId={id} scrollAnchor>
        <Message align="end">
          <MessageContent>
            <Bubble align="end">
              <BubbleContent>{text}</BubbleContent>
            </Bubble>
          </MessageContent>
        </Message>
      </MessageScrollerItem>
    </MessageScrollerContent>
  </MessageScrollerViewport>
  <MessageScrollerButton />
</MessageScroller>`,
	props: [
		{
			name: "scrollAnchor",
			type: "boolean",
			default: "false",
			description: "Set on the person's turn so a new question settles near the top of the viewport.",
		},
		{
			name: "autoScroll",
			type: "boolean",
			description: "Follows the reply while the person stays at the live edge.",
		},
	],
	subComponents: [
		{ name: "MessageScroller", description: "Scroll owner for the thread. See Message Scroller." },
		{ name: "Message", description: "One turn, aligned to the start (agent) or end (person)." },
		{ name: "Bubble", description: "The person's message." },
		{ name: "InputGroup", description: "The field the person types into." },
	],
	demoLayout: {
		previewContentWidth: "full",
	},
};
