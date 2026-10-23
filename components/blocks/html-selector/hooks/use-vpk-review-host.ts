"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useLatestRef } from "@/lib/use-latest-ref";
import { getDispatchErrorMessage, parseDispatchResponseBody } from "../lib/dispatch-error";
import { resolveIframePage } from "../lib/page-path";
import type { AgentId, HtmlSelectorNotification } from "../lib/types";
import {
	composeVpkReviewPrompt,
	createHostHelloMessage,
	createSendResultMessage,
	MAX_VPK_REVIEW_PROMPT_BYTES,
	parseVpkReviewRuntimeMessage,
	utf8Bytes,
	type VpkReviewCounts,
	type VpkReviewSendMessage,
} from "../lib/vpk-review-messages";

const AGENTS: AgentId[] = ["claude", "codex", "cursor", "rovo"];

interface UseVpkReviewHostOptions {
	agent: AgentId;
	enabled: boolean;
	getSelectorPrompt: (pagePath: string) => string;
	iframeRef: RefObject<HTMLIFrameElement | null>;
	onNotify: (notification: HtmlSelectorNotification) => void;
}

// Host side of the vpk-review postMessage contract (ws1 §4.14, C6). Only messages whose
// source is the iframe's own window are handled. The host says host-hello on mount, on every
// iframe load, and once in reply to the first hello; it never answers later hellos, so the
// runtime's hello-on-host-hello cannot loop. Send composes the combined prompt (review plus
// the page's selector pins) and dispatches it through /api/html-selector/dispatch.
export function useVpkReviewHost({
	agent,
	enabled,
	getSelectorPrompt,
	iframeRef,
	onNotify,
}: Readonly<UseVpkReviewHostOptions>) {
	const countsRef = useRef(new Map<string, VpkReviewCounts>());
	const agentRef = useLatestRef(agent);
	const notifyRef = useLatestRef(onNotify);
	const selectorPromptRef = useLatestRef(getSelectorPrompt);

	useEffect(() => {
		if (!enabled) {
			return () => {};
		}
		const iframe = iframeRef.current;
		if (!iframe) {
			return () => {};
		}
		let saidHello = false;
		const post = (message: unknown) => {
			try {
				iframe.contentWindow?.postMessage(message, "*");
			} catch {
				// The frame navigated away; the next load says hello again.
			}
		};
		const sayHello = () => {
			saidHello = true;
			post(createHostHelloMessage({ agent: agentRef.current, agents: AGENTS, canSend: true }));
		};
		const reply = (requestId: string, ok: boolean, message: string, windowName?: string) => {
			post(createSendResultMessage({ message, ok, requestId, windowName }));
		};
		const send = async (message: VpkReviewSendMessage) => {
			const page = resolveIframePage(iframe);
			const prompt = composeVpkReviewPrompt({
				commentIds: message.commentIds,
				docId: message.docId,
				markdown: message.markdown,
				openCount: message.counts.open,
				page,
				revision: message.revision,
				selectorPrompt: selectorPromptRef.current(page.pagePath),
				title: message.title,
			});
			if (utf8Bytes(prompt) > MAX_VPK_REVIEW_PROMPT_BYTES) {
				const text = "Too large to send (over 64 KB); use Download review";
				reply(message.requestId, false, text);
				notifyRef.current({ type: "error", message: text });
				return;
			}
			const selectedAgent = agentRef.current;
			notifyRef.current({ type: "pending", message: `Sending review to ${selectedAgent}...` });
			try {
				const response = await fetch("/api/html-selector/dispatch", {
					body: JSON.stringify({ agent: selectedAgent, prompt }),
					headers: { "Content-Type": "application/json" },
					method: "POST",
				});
				const payload = parseDispatchResponseBody(await response.text());
				if (!response.ok) {
					throw new Error(getDispatchErrorMessage(payload.error ?? "Failed to dispatch review."));
				}
				const text = `Sent to ${selectedAgent}${payload.windowName ? `: tmux window ${payload.windowName}` : ""}`;
				reply(message.requestId, true, text, payload.windowName);
				notifyRef.current({ type: "success", message: text });
			} catch (error) {
				const text = getDispatchErrorMessage(error instanceof Error ? error.message : String(error));
				reply(message.requestId, false, text);
				notifyRef.current({ type: "error", message: text });
			}
		};
		const onMessage = (event: MessageEvent) => {
			if (!iframe.contentWindow || event.source !== iframe.contentWindow) {
				return;
			}
			const message = parseVpkReviewRuntimeMessage(event.data);
			if (!message) {
				return;
			}
			if (message.type === "vpk-review:hello") {
				countsRef.current.set(resolveIframePage(iframe).pagePath, message.counts);
				if (!saidHello) {
					sayHello();
				}
				return;
			}
			void send(message);
		};
		window.addEventListener("message", onMessage);
		iframe.addEventListener("load", sayHello);
		sayHello();
		return () => {
			window.removeEventListener("message", onMessage);
			iframe.removeEventListener("load", sayHello);
		};
	}, [agentRef, enabled, iframeRef, notifyRef, selectorPromptRef]);

	const getReviewCounts = useCallback((pagePath: string): VpkReviewCounts | undefined => countsRef.current.get(pagePath), []);

	return { getReviewCounts };
}
