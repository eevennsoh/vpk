"use client";

/* eslint-disable @next/next/no-img-element -- These component primitives render arbitrary preview/avatar/image payloads where Next Image sizing/loading would change the public API. */

// oxlint-disable react-doctor/exhaustive-deps -- Effects in this file intentionally coordinate refs, external animation loops, timers, subscriptions, or measured DOM state; dependencies are constrained to avoid restarting those bridges.
// oxlint-disable react-doctor/no-initialize-state -- These components intentionally seed local interactive state from props once before user edits take ownership.
// oxlint-disable react-doctor/no-noninteractive-tabindex -- This viewport intentionally receives keyboard focus for application-style keyboard and paste handling without button semantics.
// oxlint-disable react-doctor/no-pass-live-state-to-parent -- Callbacks in this file intentionally stream live interaction state to the parent owner.

import type {
	ClipboardEvent,
	ComponentProps,
	KeyboardEvent,
	PointerEvent,
	ReactNode,
	WheelEvent,
} from "react";

import { Spinner } from "@/components/ui/spinner";
import {
	PreviewKeyCaptureStatus,
	PreviewKeyCaptureToggle,
	previewKeyCaptureViewportClassName,
} from "@/components/ui-custom/preview-key-capture";
import { TriangleAlertIcon } from "@/components/ui/vpk-icons";
import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { useReducedMotion } from "motion/react";
import { usePreviewKeyCapture } from "@/hooks/use-preview-key-capture";
import { API_ENDPOINTS } from "@/lib/api-config";
import { PREVIEW_KEYBOARD_HINT } from "@/lib/preview-keyboard";
import { cn } from "@/lib/utils";

export interface ChromiumPreviewState {
	ready: boolean;
	title: string;
	url: string;
	viewportWidth: number;
	viewportHeight: number;
	canGoBack: boolean;
	canGoForward: boolean;
}

export interface ChromiumPreviewControls {
	back: (() => Promise<void>) | null;
	forward: (() => Promise<void>) | null;
	reload: (() => Promise<void>) | null;
	canGoBack: boolean;
	canGoForward: boolean;
	busy: boolean;
}

interface ChromiumPreviewBodyProps extends ComponentProps<"div"> {
	targetUrl: string;
	loading?: ReactNode;
	onUrlChange: (url: string) => void;
	onControlsChange?: (controls: ChromiumPreviewControls | null) => void;
}

const DEFAULT_STATE: ChromiumPreviewState = {
	ready: false,
	title: "",
	url: "",
	viewportWidth: 1280,
	viewportHeight: 900,
	canGoBack: false,
	canGoForward: false,
};

const HTTP_URL_PATTERN = /^https?:\/\//i;
// A scheme-less external address such as `example.com/path` or `www.example.com`.
const BARE_HOST_PATTERN =
	/^(?:www\.|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,})(?:[/?#:].*)?$/i;

const SPECIAL_KEY_MAP: Record<string, string> = {
	" ": "Space",
	ArrowDown: "ArrowDown",
	ArrowLeft: "ArrowLeft",
	ArrowRight: "ArrowRight",
	ArrowUp: "ArrowUp",
	Backspace: "Backspace",
	Delete: "Delete",
	End: "End",
	Enter: "Enter",
	Escape: "Escape",
	Home: "Home",
	PageDown: "PageDown",
	PageUp: "PageUp",
	Tab: "Tab",
};

function isRelativePreviewUrl(url: string) {
	const trimmed = url.trim();
	return (
		!trimmed ||
		trimmed.startsWith("/") ||
		trimmed.startsWith("./") ||
		trimmed.startsWith("../") ||
		trimmed.startsWith("#") ||
		trimmed.startsWith("?")
	);
}

// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
export function isChromiumPreviewUrl(url: string) {
	if (isRelativePreviewUrl(url)) {
		return false;
	}

	const trimmed = url.trim();
	if (HTTP_URL_PATTERN.test(trimmed)) {
		return URL.canParse(trimmed) && new URL(trimmed).hostname !== "";
	}
	return BARE_HOST_PATTERN.test(trimmed);
}

function normalizeComparableUrl(url: string) {
	const trimmed = url.trim();
	if (!trimmed) {
		return "";
	}
	try {
		if (HTTP_URL_PATTERN.test(trimmed) || trimmed === "about:blank") {
			return new URL(trimmed).toString();
		}
		if (BARE_HOST_PATTERN.test(trimmed)) {
			return new URL(`https://${trimmed}`).toString();
		}
	} catch {
		return trimmed;
	}
	return trimmed;
}

async function readJsonResponse(response: Response) {
	if (!response.ok) {
		const text = await response.text();
		let errorMessage = "Chromium preview request failed.";

		if (text.trim()) {
			try {
				const parsed = JSON.parse(text) as {
					error?: unknown;
					details?: unknown;
				};
				if (typeof parsed.error === "string" && parsed.error.trim()) {
					errorMessage = parsed.error.trim();
				} else if (
					typeof parsed.details === "string" &&
					parsed.details.trim()
				) {
					errorMessage = parsed.details.trim();
				} else {
					errorMessage = text.trim();
				}
			} catch {
				errorMessage = text.trim();
			}
		}

		throw new Error(errorMessage);
	}

	return (await response.json()) as ChromiumPreviewState;
}

export function ChromiumPreviewBody({
	targetUrl,
	className,
	loading,
	onUrlChange,
	onControlsChange,
	...props
}: Readonly<ChromiumPreviewBodyProps>) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const keyboardHintId = useId();
	const keyCapture = usePreviewKeyCapture(containerRef);
	const { handleViewportPointerDown, interceptKey: interceptCaptureKey } = keyCapture;
	const wheelTimerRef = useRef<number | null>(null);
	const wheelDeltaRef = useRef({ deltaX: 0, deltaY: 0 });
	const [previewState, setPreviewState] = useState(DEFAULT_STATE);
	const [isBusy, setIsBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [viewportSize, setViewportSize] = useState(DEFAULT_STATE);
	const [screenshotVersion, setScreenshotVersion] = useState(0);
	const reduced = useReducedMotion();
	const [inView, setInView] = useState(false);
	const [tabVisible, setTabVisible] = useState(
		typeof document === "undefined" ? true : document.visibilityState === "visible",
	);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const io = new IntersectionObserver(
			([entry]) => setInView(entry.isIntersecting),
			{ rootMargin: "200px" },
		);
		io.observe(el);
		const onVis = () => setTabVisible(document.visibilityState === "visible");
		document.addEventListener("visibilitychange", onVis);
		return () => {
			io.disconnect();
			document.removeEventListener("visibilitychange", onVis);
		};
	}, []);

	const shouldAnimate = !reduced && inView && tabVisible;

	const screenshotSrc = useMemo(
		() =>
			API_ENDPOINTS.chromiumPreviewScreenshot(
				viewportSize.viewportWidth,
				viewportSize.viewportHeight,
				screenshotVersion,
			),
		[
			screenshotVersion,
			viewportSize.viewportHeight,
			viewportSize.viewportWidth,
		],
	);
	const shouldRenderScreenshot = screenshotVersion > 0 || previewState.ready;

	const applyState = useCallback(
		(nextState: ChromiumPreviewState) => {
			setPreviewState(nextState);
			setViewportSize(nextState);
			setError(null);

			if (
				nextState.url &&
				normalizeComparableUrl(nextState.url) !==
					normalizeComparableUrl(targetUrl)
			) {
				onUrlChange(nextState.url);
			}
		},
		[onUrlChange, targetUrl],
	);

	const refreshScreenshot = useCallback(() => {
		setScreenshotVersion((previousVersion) => previousVersion + 1);
	}, []);

	const fetchState = useCallback(
		async (options?: { busy?: boolean; refreshImage?: boolean }) => {
			if (!isChromiumPreviewUrl(targetUrl)) {
				return;
			}

			const showBusyState = options?.busy ?? false;
			if (showBusyState) {
				setIsBusy(true);
			}

			try {
				const response = await fetch(API_ENDPOINTS.CHROMIUM_PREVIEW, {
					cache: "no-store",
				});
				const nextState = await readJsonResponse(response);
				applyState(nextState);
				if (options?.refreshImage ?? true) {
					refreshScreenshot();
				}
			} catch (caughtError) {
				setError(
					caughtError instanceof Error
						? caughtError.message
						: "Failed to refresh Chromium preview.",
				);
			} finally {
				if (showBusyState) {
					setIsBusy(false);
				}
			}
		},
		[applyState, refreshScreenshot, targetUrl],
	);

	const postAction = useCallback(
		async (
			action:
				| "back"
				| "forward"
				| "reload"
				| "viewport"
				| "click"
				| "wheel"
				| "press"
				| "type",
			body?: Record<string, unknown>,
			options?: { busy?: boolean; refreshImage?: boolean },
		) => {
			if (!isChromiumPreviewUrl(targetUrl)) {
				return;
			}

			const showBusyState = options?.busy ?? true;
			if (showBusyState) {
				setIsBusy(true);
			}

			try {
				const response = await fetch(
					API_ENDPOINTS.chromiumPreviewAction(action),
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify(body ?? {}),
					},
				);
				const nextState = await readJsonResponse(response);
				applyState(nextState);
				if (options?.refreshImage ?? true) {
					refreshScreenshot();
				}
			} catch (caughtError) {
				setError(
					caughtError instanceof Error
						? caughtError.message
						: "Chromium preview action failed.",
				);
			} finally {
				if (showBusyState) {
					setIsBusy(false);
				}
			}
		},
		[applyState, refreshScreenshot, targetUrl],
	);

	const navigate = useCallback(
		async (url: string) => {
			if (!isChromiumPreviewUrl(url)) {
				return;
			}

			setIsBusy(true);
			try {
				const response = await fetch(API_ENDPOINTS.CHROMIUM_PREVIEW, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ url }),
				});
				const nextState = await readJsonResponse(response);
				applyState(nextState);
				refreshScreenshot();
			} catch (caughtError) {
				setError(
					caughtError instanceof Error
						? caughtError.message
						: "Failed to navigate Chromium preview.",
				);
			} finally {
				setIsBusy(false);
			}
		},
		[applyState, refreshScreenshot],
	);

	useEffect(() => {
		if (!isChromiumPreviewUrl(targetUrl)) {
			return;
		}

		if (
			previewState.ready &&
			normalizeComparableUrl(previewState.url) ===
				normalizeComparableUrl(targetUrl)
		) {
			return;
		}

		void navigate(targetUrl);
	}, [navigate, previewState.ready, previewState.url, targetUrl]);

	useEffect(() => {
		if (!isChromiumPreviewUrl(targetUrl)) {
			return;
		}
		if (!shouldAnimate) {
			return;
		}

		const intervalId = window.setInterval(() => {
			void fetchState({ busy: false, refreshImage: true });
		}, 2500);

		return () => {
			window.clearInterval(intervalId);
		};
	}, [fetchState, targetUrl, shouldAnimate]);

	useEffect(() => {
		const containerElement = containerRef.current;
		if (!containerElement || typeof ResizeObserver === "undefined") {
			return;
		}

		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) {
				return;
			}

			const nextWidth = Math.max(320, Math.round(entry.contentRect.width));
			const nextHeight = Math.max(240, Math.round(entry.contentRect.height));
			setViewportSize((currentState) => {
				if (
					currentState.viewportWidth === nextWidth &&
					currentState.viewportHeight === nextHeight
				) {
					return currentState;
				}

				return {
					...currentState,
					viewportWidth: nextWidth,
					viewportHeight: nextHeight,
				};
			});
		});

		observer.observe(containerElement);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		if (!isChromiumPreviewUrl(targetUrl)) {
			return;
		}

		void postAction(
			"viewport",
			{
				width: viewportSize.viewportWidth,
				height: viewportSize.viewportHeight,
			},
			{ busy: false, refreshImage: true },
		);
	}, [
		postAction,
		targetUrl,
		viewportSize.viewportHeight,
		viewportSize.viewportWidth,
	]);

	useEffect(() => {
		if (!onControlsChange) {
			return;
		}

		onControlsChange({
			back: async () => {
				await postAction("back", undefined, { busy: true, refreshImage: true });
			},
			forward: async () => {
				await postAction("forward", undefined, {
					busy: true,
					refreshImage: true,
				});
			},
			reload: async () => {
				await postAction("reload", undefined, {
					busy: true,
					refreshImage: true,
				});
			},
			canGoBack: previewState.canGoBack,
			canGoForward: previewState.canGoForward,
			busy: isBusy,
		});

		return () => onControlsChange(null);
	}, [
		isBusy,
		onControlsChange,
		postAction,
		previewState.canGoBack,
		previewState.canGoForward,
	]);

	const flushWheel = useCallback(() => {
		if (!wheelDeltaRef.current.deltaX && !wheelDeltaRef.current.deltaY) {
			wheelTimerRef.current = null;
			return;
		}

		const { deltaX, deltaY } = wheelDeltaRef.current;
		wheelDeltaRef.current = { deltaX: 0, deltaY: 0 };
		wheelTimerRef.current = null;
		void postAction(
			"wheel",
			{ deltaX, deltaY },
			{ busy: false, refreshImage: true },
		);
	}, [postAction]);

	useEffect(() => {
		return () => {
			if (wheelTimerRef.current !== null) {
				window.clearTimeout(wheelTimerRef.current);
			}
		};
	}, []);

	const handlePointerDown = useCallback(
		(event: PointerEvent<HTMLDivElement>) => {
			if (event.button !== 0) {
				return;
			}

			handleViewportPointerDown();
			const containerElement = containerRef.current;
			if (!containerElement) {
				return;
			}

			containerElement.focus();
			const bounds = containerElement.getBoundingClientRect();
			const relativeX =
				(event.clientX - bounds.left) /
				Math.max(bounds.width, 1);
			const relativeY =
				(event.clientY - bounds.top) /
				Math.max(bounds.height, 1);

			void postAction(
				"click",
				{
					x: Math.round(relativeX * viewportSize.viewportWidth),
					y: Math.round(relativeY * viewportSize.viewportHeight),
				},
				{ busy: true, refreshImage: true },
			);
		},
		[handleViewportPointerDown, postAction, viewportSize.viewportHeight, viewportSize.viewportWidth],
	);

	const handleWheel = useCallback(
		(event: WheelEvent<HTMLDivElement>) => {
			event.preventDefault();
			wheelDeltaRef.current.deltaX += event.deltaX;
			wheelDeltaRef.current.deltaY += event.deltaY;
			if (wheelTimerRef.current === null) {
				wheelTimerRef.current = window.setTimeout(flushWheel, 50);
			}
		},
		[flushWheel],
	);

	const handlePaste = useCallback(
		(event: ClipboardEvent<HTMLDivElement>) => {
			const pastedText = event.clipboardData.getData("text/plain");
			if (!pastedText) {
				return;
			}

			event.preventDefault();
			void postAction(
				"type",
				{ text: pastedText },
				{ busy: false, refreshImage: true },
			);
		},
		[postAction],
	);

	const handleKeyDown = useCallback(
		(event: KeyboardEvent<HTMLDivElement>) => {
			if (interceptCaptureKey(event)) {
				return;
			}

			const isPrintableKey =
				event.key.length === 1 &&
				!event.altKey &&
				!event.ctrlKey &&
				!event.metaKey;

			if (isPrintableKey) {
				event.preventDefault();
				void postAction(
					"type",
					{ text: event.key },
					{ busy: false, refreshImage: true },
				);
				return;
			}

			const mappedKey = SPECIAL_KEY_MAP[event.key];
			if (!mappedKey) {
				return;
			}

			const modifiers: string[] = [];
			if (event.ctrlKey) {
				modifiers.push("Control");
			}
			if (event.metaKey) {
				modifiers.push("Meta");
			}
			if (event.altKey) {
				modifiers.push("Alt");
			}
			if (event.shiftKey) {
				modifiers.push("Shift");
			}

			event.preventDefault();
			void postAction(
				"press",
				{
					key: modifiers.length
						? `${modifiers.join("+")}+${mappedKey}`
						: mappedKey,
				},
				{ busy: false, refreshImage: true },
			);
		},
		[interceptCaptureKey, postAction],
	);

	return (
		<div
			className={cn("relative flex size-full min-h-0 min-w-0 flex-col", className)}
			{...props}
		>
			{/* A reserved strip keeps the toggle off the remote page, so it never blocks clicks there. */}
			<div className="border-border flex shrink-0 justify-end border-b px-2 py-1">
				<PreviewKeyCaptureToggle capture={keyCapture} />
			</div>
			<div
				aria-busy={isBusy}
				aria-label={previewState.title || "Chromium preview"}
				aria-describedby={keyboardHintId}
				ref={containerRef}
				className={cn(
					"bg-surface flex size-full min-h-0 min-w-0 flex-col overflow-hidden",
					previewKeyCaptureViewportClassName(keyCapture.captured),
				)}
				onBlur={keyCapture.handleViewportBlur}
				onKeyDown={handleKeyDown}
				onPaste={handlePaste}
				onPointerDown={handlePointerDown}
				onWheel={handleWheel}
				tabIndex={0}
			>
				<span id={keyboardHintId} className="sr-only">
					{PREVIEW_KEYBOARD_HINT}
				</span>
				<div className="relative flex-1 overflow-hidden">
					<PreviewKeyCaptureStatus capture={keyCapture} />
					{shouldRenderScreenshot ? (
						<img
							alt={previewState.title || "Chromium preview"}
							className="size-full select-none object-fill"
							draggable={false}
							src={screenshotSrc}
						/>
					) : (
						<div className="bg-surface-raised text-text-subtle flex size-full items-center justify-center text-sm">
							Launching Chromium preview…
						</div>
					)}
					{isBusy ? (
							<div className="bg-surface absolute inset-0 flex items-center justify-center">
							<Spinner className="size-7" />
						</div>
					) : null}
					{error ? (
						<div
							aria-live="polite"
								className="absolute inset-x-4 bottom-4 flex items-start gap-3 rounded-lg border border-border bg-surface p-3 shadow-sm"
						>
							<TriangleAlertIcon className="text-text-warning mt-0.5 size-4 shrink-0" />
							<div className="min-w-0">
								<p className="text-text text-sm font-medium">
									Chromium preview unavailable
								</p>
								<p className="text-text-subtle mt-1 text-xs">{error}</p>
							</div>
						</div>
					) : null}
					{loading}
				</div>
			</div>
		</div>
	);
}
