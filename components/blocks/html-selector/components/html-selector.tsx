"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { getDispatchErrorMessage, parseDispatchResponseBody } from "@/components/blocks/html-selector/lib/dispatch-error";
import { getBridge } from "../lib/bridge";
import { getDiskPathForPage, resolveIframePage } from "../lib/page-path";
import { composeHtmlSelectorPrompt } from "../lib/prompt-composer";
import { useAgentPreference } from "../hooks/use-agent-preference";
import { useSelectorBridge } from "../hooks/use-selector-bridge";
import { useSelectorPins } from "../hooks/use-selector-pins";
import { useVpkReviewHost } from "../hooks/use-vpk-review-host";
import { ArtifactActionBar } from "./artifact-action-bar";
import type {
	AgentId,
	ElementContextPayload,
	HtmlSelectorBridgeState,
	HtmlSelectorNotification,
	SelectorPin,
	SelectorPinSavePayload,
	SelectorPinsMeta,
	SelectorStyleEdit,
} from "../lib/types";

const EMPTY_PINS: SelectorPin[] = [];

export interface HtmlSelectorProps {
	className?: string;
	repoRoot?: string;
	src?: string;
	srcDoc?: string;
	title?: string;
}

function mergeStyleEdits(
	current: ReadonlyArray<SelectorStyleEdit> | undefined,
	next: ReadonlyArray<SelectorStyleEdit> | undefined,
): SelectorStyleEdit[] | undefined {
	if (!next || next.length === 0) {
		return current ? [...current] : undefined;
	}

	const edits = new Map<string, SelectorStyleEdit>();
	for (const edit of current ?? []) {
		edits.set(edit.property, { ...edit });
	}
	for (const edit of next) {
		edits.set(edit.property, { ...edit });
	}
	return [...edits.values()];
}

async function copyText(text: string): Promise<void> {
	if (!text) {
		return;
	}
	await navigator.clipboard.writeText(text);
}

export function HtmlSelector({
	className,
	repoRoot = process.env.NEXT_PUBLIC_VPK_REPO_ROOT,
	src,
	srcDoc,
	title = "HTML selector preview",
}: Readonly<HtmlSelectorProps>) {
	const iframeRef = useRef<HTMLIFrameElement | null>(null);
	const [pagePath, setPagePath] = useState("srcdoc");
	const [bridgeState, setBridgeState] = useState<HtmlSelectorBridgeState>({
		active: false,
		activationMode: "toggle",
		enabled: false,
		hoveredSelector: null,
	});
	const { agent, setAgent } = useAgentPreference();
	const {
		addPin,
		markStalePins,
		pinsByPage,
		removePin,
		updatePinComment,
		updatePinScope,
		updatePinStyleEdits,
		updatePinStyleFindings,
	} = useSelectorPins();

	const currentPins = pinsByPage[pagePath] ?? EMPTY_PINS;
	const allPins = useMemo(() => Object.values(pinsByPage).flat(), [pinsByPage]);
	const pinMeta = useMemo<SelectorPinsMeta>(() => {
		const otherPages = Object.entries(pinsByPage)
			.filter(([candidatePagePath, pins]) => candidatePagePath !== pagePath && pins.length > 0);
		return {
			agent,
			otherPagesCount: otherPages.length,
			otherPagesPinCount: otherPages.reduce((total, [, pins]) => total + pins.length, 0),
		};
	}, [agent, pagePath, pinsByPage]);

	const notifyBridge = useCallback((notification: HtmlSelectorNotification) => {
		getBridge(iframeRef.current)?.notify(notification);
	}, []);

	// A reviewable page's Send carries the review plus this page's selector pins (ws1 §4.14).
	const getSelectorPrompt = useCallback(
		(reviewPagePath: string) => composeHtmlSelectorPrompt(pinsByPage[reviewPagePath] ?? EMPTY_PINS),
		[pinsByPage],
	);
	const { getReviewCounts } = useVpkReviewHost({
		agent,
		enabled: process.env.NODE_ENV === "development",
		getSelectorPrompt,
		iframeRef,
		onNotify: notifyBridge,
	});

	const savePinFromPayload = useCallback((payload: SelectorPinSavePayload): SelectorPin => {
		const resolvedPagePath = payload.pagePath || pagePath;
		const existingPin = (pinsByPage[resolvedPagePath] ?? []).find((pin) => pin.selector === payload.selector);
		if (existingPin) {
			const nextComment = payload.comment ?? existingPin.comment;
			const nextScope = payload.scope ?? existingPin.scope;
			const nextStyleEdits = mergeStyleEdits(existingPin.styleEdits, payload.styleEdits);
			if (nextComment !== existingPin.comment) {
				updatePinComment(existingPin.id, nextComment);
			}
			if (nextScope !== existingPin.scope) {
				updatePinScope(existingPin.id, nextScope);
			}
			if (payload.styleFindings) {
				updatePinStyleFindings(existingPin.id, payload.styleFindings);
			}
			if (nextStyleEdits) {
				updatePinStyleEdits(existingPin.id, nextStyleEdits);
			}
			return {
				...existingPin,
				comment: nextComment,
				scope: nextScope,
				styleEdits: nextStyleEdits,
				styleFindings: payload.styleFindings ?? existingPin.styleFindings,
			};
		}

		return addPin({
			comment: payload.comment ?? "",
			diskPath: getDiskPathForPage(resolvedPagePath),
			outerHtmlSnippet: payload.outerHtmlSnippet,
			pagePath: resolvedPagePath,
			scope: payload.scope ?? "element",
			selector: payload.selector,
			styleEdits: payload.styleEdits,
			styleFindings: payload.styleFindings,
			tagSummary: payload.tagSummary,
		});
	}, [
		addPin,
		pagePath,
		pinsByPage,
		updatePinComment,
		updatePinScope,
		updatePinStyleEdits,
		updatePinStyleFindings,
	]);

	const handlePromptCopy = useCallback(() => {
		const prompt = composeHtmlSelectorPrompt(allPins);
		if (!prompt) {
			notifyBridge({ type: "error", message: "No HTML selector pins to copy." });
			return;
		}

		void copyText(prompt).then(() => {
			notifyBridge({ type: "success", message: "Copied composed prompt." });
		}).catch((error) => {
			notifyBridge({ type: "error", message: error instanceof Error ? error.message : String(error) });
		});
	}, [allPins, notifyBridge]);

	const handleSend = useCallback(() => {
		const prompt = composeHtmlSelectorPrompt(allPins);
		if (!prompt) {
			notifyBridge({ type: "error", message: "No HTML selector pins to send." });
			return;
		}

		notifyBridge({ type: "pending", message: "Opening agent window..." });
		void fetch("/api/html-selector/dispatch", {
			body: JSON.stringify({ agent, prompt }),
			headers: { "Content-Type": "application/json" },
			method: "POST",
		})
			.then(async (response) => {
				if (!response.ok) {
					const payload = parseDispatchResponseBody(await response.text());
					throw new Error(getDispatchErrorMessage(payload.error ?? "Failed to dispatch prompt."));
				}
				const payload = parseDispatchResponseBody(await response.text());
				const openReviewComments = getReviewCounts(pagePath)?.open ?? 0;
				const reviewNote = openReviewComments > 0
					? ` This page also has ${openReviewComments} open review comment${openReviewComments === 1 ? "" : "s"}. Send them from Review → Share → Send to agent; that send includes your pins.`
					: "";
				notifyBridge({
					type: "success",
					message: `Opened tmux window ${payload.windowName} in ${payload.sessionName}.${reviewNote}`,
				});
			})
			.catch((error) => {
				notifyBridge({
					type: "error",
					message: getDispatchErrorMessage(error instanceof Error ? error.message : String(error)),
				});
			});
	}, [agent, allPins, getReviewCounts, notifyBridge, pagePath]);

	const callbacks = useMemo(() => ({
		onAgentChange: ({ agent: nextAgent }: { agent: AgentId }) => setAgent(nextAgent),
		onCopyAllRequested: handlePromptCopy,
		onElementContextCopied: (payload: ElementContextPayload) => {
			void copyText(`${payload.selector}\n\n${payload.outerHtmlSnippet}`)
				.then(() => notifyBridge({ type: "success", message: "Copied element context." }))
				.catch((error) => notifyBridge({ type: "error", message: error instanceof Error ? error.message : String(error) }));
		},
		onPageChange: (page: { diskPath?: string; pagePath: string; url: string }) => {
			setPagePath(page.pagePath);
		},
		onPinRemoved: ({ id }: { id: string }) => {
			removePin(id);
		},
		onPinSaved: savePinFromPayload,
		onSendRequested: handleSend,
		onStaleSelectorsChange: markStalePins,
		onStateChange: setBridgeState,
	}), [
		handlePromptCopy,
		handleSend,
		markStalePins,
		notifyBridge,
		removePin,
		savePinFromPayload,
		setAgent,
	]);

	useSelectorBridge({
		agent,
		callbacks,
		enabled: process.env.NODE_ENV === "development",
		iframeRef,
		pagePins: currentPins,
		pinMeta,
	});

	if (process.env.NODE_ENV === "production") {
		return (
			<div className={cn("flex h-dvh min-h-[560px] flex-col bg-surface", className)}>
				<div className="border-b border-border bg-bg-neutral px-3 py-2 text-sm text-text-subtle">
					HTML Selector is a dev-only tool.
				</div>
				<iframe sandbox="allow-scripts" src={src} srcDoc={srcDoc} title={title} className="min-h-0 flex-1 border-0 bg-surface" />
			</div>
		);
	}

	return (
		<div className={cn("relative h-dvh min-h-[560px] bg-surface", className)}>
			<iframe
				ref={iframeRef}
				src={src}
				srcDoc={srcDoc}
				title={title}
				data-html-selector-active={bridgeState.enabled ? "true" : "false"}
				className="block h-full w-full border-0 bg-surface"
				onLoad={() => {
					const page = resolveIframePage(iframeRef.current);
					setPagePath(page.pagePath);
				}}
			/>
			<ArtifactActionBar
				key={pagePath}
				agent={agent}
				iframeRef={iframeRef}
				onNotify={notifyBridge}
				pagePath={pagePath}
				repoRoot={repoRoot}
			/>
		</div>
	);
}
