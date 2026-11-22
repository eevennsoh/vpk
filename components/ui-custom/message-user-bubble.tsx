import { Bubble, BubbleContent, type BubbleProps } from "@/components/ui/bubble";

export type MessageUserBubbleProps = Omit<BubbleProps, "align" | "variant">;

/**
 * The person's turn in a VPK chat: the default `Bubble` (VPK's neutral user bubble) aligned
 * to the end, with stacked children. Render it inside `<Message align="end"><MessageContent>`.
 */
export function MessageUserBubble({ children, ...props }: Readonly<MessageUserBubbleProps>) {
	return (
		<Bubble align="end" {...props}>
			<BubbleContent className="flex flex-col gap-2">{children}</BubbleContent>
		</Bubble>
	);
}
