"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { JiraListRowFlash } from "@/components/blocks/jira-list/jira-list-types";

export const NO_JIRA_LIST_ROW_FLASH: JiraListRowFlash = { issueKeys: [], token: 0 };

const NO_FLASHING_KEYS: ReadonlySet<string> = new Set<string>();

/**
 * Has to outlast the `jira-list-row-flash` utility in `app/globals.css`, which
 * runs for `--duration-slowest` (600ms). Holding the class a beat longer lets
 * the animation finish before the row hands its background back to the cell's
 * own classes.
 */
export const JIRA_LIST_ROW_FLASH_HOLD_MS = 700;

export function appendRowFlash(
	current: JiraListRowFlash,
	issueKeys: readonly string[],
	color?: string,
): JiraListRowFlash {
	return issueKeys.length === 0
		? current
		: { issueKeys: [...issueKeys], token: current.token + 1, ...(color ? { color } : {}) };
}

/**
 * Owner side of the acknowledgement.
 *
 * A drop calls `flashRow` once per session, synchronously, from inside the same
 * event. Collecting those keys and publishing them from a microtask turns that
 * run of calls into a single flash, so a three-session drop lights three rows
 * together instead of replacing the flash twice on its way to the last one.
 */
export function useJiraListRowFlashSource(): Readonly<{
	flash: JiraListRowFlash;
	flashRow: (issueKey: string, color?: string) => void;
}> {
	const [flash, setFlash] = useState<JiraListRowFlash>(NO_JIRA_LIST_ROW_FLASH);
	const batchRef = useRef<string[]>([]);
	const colorRef = useRef<string | undefined>(undefined);

	const flashRow = useCallback((issueKey: string, color?: string) => {
		const isFirstOfBatch = batchRef.current.length === 0;
		batchRef.current.push(issueKey);
		if (isFirstOfBatch) colorRef.current = color;
		if (!isFirstOfBatch) {
			return;
		}

		queueMicrotask(() => {
			const issueKeys = batchRef.current;
			batchRef.current = [];
			const color = colorRef.current;
			colorRef.current = undefined;
			setFlash((current) => appendRowFlash(current, issueKeys, color));
		});
	}, []);

	return { flash, flashRow };
}

/**
 * Consumer side: the keys currently flashing.
 *
 * The class has to be absent before it can be applied again, otherwise the CSS
 * animation never restarts — so the keys are held for one flash and dropped,
 * rather than mirrored from the prop for as long as it is set.
 *
 * Two effects rather than one. Adopting a publish and expiring it are separate
 * jobs with separate triggers, and folding them together would tie the expiry
 * timer's lifetime to the prop's identity: a re-render that changed `flash`
 * without changing its token would cancel the running timer on cleanup and
 * leave the row lit for good.
 */
export function useJiraListRowFlashKeys(
	flash: JiraListRowFlash | undefined,
): ReadonlySet<string> {
	const [flashedKeys, setFlashedKeys] = useState<ReadonlySet<string>>(NO_FLASHING_KEYS);
	// The token already seen. A ref, not state: it is bookkeeping for the effect
	// below, never something the row treatment renders from.
	const adoptedTokenRef = useRef(flash?.token ?? NO_JIRA_LIST_ROW_FLASH.token);

	useEffect(() => {
		if (flash === undefined || flash.token === adoptedTokenRef.current) {
			return;
		}

		adoptedTokenRef.current = flash.token;
		setFlashedKeys(new Set(flash.issueKeys));
	}, [flash]);

	useEffect(() => {
		if (flashedKeys.size === 0) {
			return;
		}

		const timer = window.setTimeout(() => setFlashedKeys(NO_FLASHING_KEYS), JIRA_LIST_ROW_FLASH_HOLD_MS);

		return () => window.clearTimeout(timer);
	}, [flashedKeys]);

	return flashedKeys;
}
