"use client";

import { useEffect } from "react";

import { preloadMessageMarkdown } from "@/components/ui-custom/message-markdown";

// The markdown runtime loads with the first message. A thread opened by URL renders messages as
// soon as the thread arrives, so start the runtime load at mount, in parallel with the thread
// request, instead of after it. A new chat (no thread in the URL) waits for the composer.
const THREAD_URL_PATTERN = /^\/(?:rovo|studio)\/[^/]+/u;

function isThreadUrl() {
	return typeof window !== "undefined" && THREAD_URL_PATTERN.test(window.location.pathname);
}

export function usePreloadMessageMarkdownForThread(initialThreadId: string | null) {
	useEffect(() => {
		if (initialThreadId || isThreadUrl()) {
			void preloadMessageMarkdown().catch(() => {});
		}
	}, [initialThreadId]);
}

// Called from the composer's first change: the reply to what is being typed needs the runtime.
export function preloadMessageMarkdownForReply() {
	void preloadMessageMarkdown().catch(() => {});
}
