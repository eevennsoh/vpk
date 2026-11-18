"use client";

import { useCallback, useEffect, useState } from "react";

interface UseCopyToClipboardOptions {
	onCopy?: () => void;
	onError?: (error: Error) => void;
	/** How long `copied` stays true, in milliseconds. */
	timeout?: number;
}

/** Copies text to the clipboard and reports `copied` for `timeout` ms afterwards. */
export function useCopyToClipboard({ onCopy, onError, timeout = 2000 }: UseCopyToClipboardOptions = {}) {
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (!copied) {
			return;
		}

		const timer = window.setTimeout(() => setCopied(false), timeout);
		return () => window.clearTimeout(timer);
	}, [copied, timeout]);

	const copy = useCallback(
		async (value: string) => {
			if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
				onError?.(new Error("Clipboard API not available"));
				return;
			}

			try {
				await navigator.clipboard.writeText(value);
				setCopied(true);
				onCopy?.();
			} catch (error) {
				onError?.(error instanceof Error ? error : new Error(String(error)));
			}
		},
		[onCopy, onError],
	);

	return { copied, copy };
}
