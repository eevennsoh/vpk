"use client";

import { MessageScrollerItem, type MessageScrollerItemProps } from "@/components/ui/message-scroller";
import { cn } from "@/lib/utils";

/**
 * Turns `MessageScrollerItem`'s default `content-visibility: auto` off for VPK chat rows.
 *
 * The shadcn item contains every row at a 10rem intrinsic-size estimate. VPK rows hold whole turns of mixed height,
 * widget cards that grow after mount, suggestion rows that bleed past the row with negative margins, focus rings
 * and the turn slide-up entrance, all of which that paint containment would clip or mis-measure. Each message
 * opts back into containment itself with `cv-auto` once it knows it is safe (no widget, not editing).
 */
const chatScrollerItemClassName = "[content-visibility:visible]";

/** `MessageScrollerItem` for VPK chat surfaces: same props and data-slot, without the item-level containment. */
export function ChatScrollerItem({ className, ...props }: Readonly<MessageScrollerItemProps>) {
	return <MessageScrollerItem className={cn(className, chatScrollerItemClassName)} {...props} />;
}
