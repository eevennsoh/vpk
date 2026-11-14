"use client";

import { preloadMessageMarkdown } from "@/components/ui-custom/message-markdown";

// The markdown runtime loads with the first message on routes that do not import it statically.
// Called when a reply is about to be needed (the composer's first input, the chat panel opening),
// so the runtime is usually loaded before the answer arrives.
export function preloadMessageMarkdownForReply() {
	void preloadMessageMarkdown().catch(() => {});
}
