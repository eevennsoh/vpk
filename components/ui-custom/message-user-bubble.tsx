import { Bubble, BubbleContent, type BubbleProps } from "@/components/ui/bubble";
import { cn } from "@/lib/utils";

export type MessageUserBubbleProps = Omit<BubbleProps, "align" | "variant">;

/**
 * The person's turn in a VPK chat: shadcn's `Bubble align="end" variant="muted"`, kept on
 * VPK's neutral fill, 16x12 padding and squared bottom-right corner. Render it inside
 * `<Message align="end"><MessageContent>`.
 */
export function MessageUserBubble({ className, children, ...props }: Readonly<MessageUserBubbleProps>) {
	return (
		<Bubble
			align="end"
			variant="muted"
			className={cn(
				"*:data-[slot=bubble-content]:bg-bg-neutral *:data-[slot=bubble-content]:hover:bg-bg-neutral-hovered",
				className,
			)}
			{...props}
		>
			<BubbleContent className="flex flex-col gap-2 rounded-br-none px-4 py-3 leading-5">{children}</BubbleContent>
		</Bubble>
	);
}
