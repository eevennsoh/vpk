"use client";

import {
	type FocusEvent as ReactFocusEvent,
	type KeyboardEvent as ReactKeyboardEvent,
	type RefObject,
	useCallback,
	useId,
	useState,
} from "react";
import {
	PREVIEW_KEY_CAPTURE_RELEASED_MESSAGE,
	PREVIEW_KEY_CAPTURE_STARTED_MESSAGE,
	resolvePreviewKeyCaptureKey,
} from "@/lib/preview-keyboard";

export interface PreviewKeyCapture {
	/** True while every key, including Tab, is forwarded to the remote page. */
	captured: boolean;
	/** Polite status text for the live region; empty until capture first changes. */
	announcement: string;
	/** DOM id for the toggle button, so moving focus from the viewport to it is not a release. */
	toggleId: string;
	/** Toggle button activation: starts capture (focusing the viewport) or releases it. */
	toggle: () => void;
	/**
	 * Runs first in the viewport's keydown handler. Returns true when the key belongs to the
	 * capture mode or to host focus navigation, so the caller must not forward it.
	 */
	interceptKey: (event: ReactKeyboardEvent<HTMLElement>) => boolean;
	/** Viewport blur handler: moving focus anywhere but the toggle releases capture. */
	handleViewportBlur: (event: ReactFocusEvent<HTMLElement>) => void;
}

/**
 * Explicit "capture keys" mode for remote-preview viewports. Capture is off by default, so
 * plain Tab leaves the viewport (WCAG 2.1.2). Enter on the focused viewport or the toggle
 * starts capture; Escape, blur or the toggle releases it and focus stays on the viewport.
 */
export function usePreviewKeyCapture(
	viewportRef: RefObject<HTMLElement | null>,
): PreviewKeyCapture {
	const [captured, setCaptured] = useState(false);
	const [announcement, setAnnouncement] = useState("");
	const toggleId = useId();

	const start = useCallback(() => {
		setCaptured(true);
		setAnnouncement(PREVIEW_KEY_CAPTURE_STARTED_MESSAGE);
	}, []);

	const release = useCallback(() => {
		setCaptured(false);
		setAnnouncement(PREVIEW_KEY_CAPTURE_RELEASED_MESSAGE);
	}, []);

	const toggle = useCallback(() => {
		if (captured) {
			release();
			return;
		}
		start();
		viewportRef.current?.focus();
	}, [captured, release, start, viewportRef]);

	const interceptKey = useCallback(
		(event: ReactKeyboardEvent<HTMLElement>) => {
			const resolution = resolvePreviewKeyCaptureKey(event, captured);
			if (resolution === "forward") {
				return false;
			}
			if (resolution === "start") {
				event.preventDefault();
				start();
			} else if (resolution === "release") {
				event.preventDefault();
				release();
			}
			// "leave": let the browser move focus out of the viewport.
			return true;
		},
		[captured, release, start],
	);

	const handleViewportBlur = useCallback(
		(event: ReactFocusEvent<HTMLElement>) => {
			if (!captured || (event.relatedTarget instanceof Element && event.relatedTarget.id === toggleId)) {
				return;
			}
			release();
		},
		[captured, release, toggleId],
	);

	return { announcement, captured, handleViewportBlur, interceptKey, toggle, toggleId };
}
