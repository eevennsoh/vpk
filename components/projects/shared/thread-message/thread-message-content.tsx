"use client";

import { use, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
	getLatestDataPart,
} from "@/lib/rovo-ui-messages";
import { MessageResponse } from "@/components/ui-custom/message-markdown";
import { ThreadMessageContext } from "./thread-message-context";

export function ThreadMessageContent(): ReactNode {
	const {
		message,
		messageText,
		isStreaming,
		isWidgetLoading,
		shouldRenderMessageText,
		shouldRenderPlainTextWhileStreaming,
	} = use(ThreadMessageContext)!;

	if (!shouldRenderMessageText) {
		return null;
	}

	const widgetDataPart = getLatestDataPart(message, "data-widget-data");

	return (
		<div
			className={cn(
				"flex w-full min-w-0 flex-col gap-2 wrap-break-word text-text",
				(widgetDataPart || isWidgetLoading) && "mb-2"
			)}
		>
			{shouldRenderPlainTextWhileStreaming ? (
				<div className="whitespace-pre-wrap break-words text-sm leading-6 text-text">
					{messageText}
				</div>
			) : (
				<MessageResponse isAnimating={isStreaming}>
					{messageText}
				</MessageResponse>
			)}
		</div>
	);
}
