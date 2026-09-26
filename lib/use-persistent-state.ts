"use client";

import { useCallback, useSyncExternalStore } from "react";

function readJsonValue<T>(key: string, fallback: T): T {
	if (typeof window === "undefined") {
		return fallback;
	}

	try {
		const rawValue = window.localStorage.getItem(key);
		if (!rawValue) {
			return fallback;
		}

		return JSON.parse(rawValue) as T;
	} catch {
		return fallback;
	}
}

function writeJsonValue<T>(key: string, value: T) {
	if (typeof window === "undefined") {
		return;
	}

	try {
		window.localStorage.setItem(key, JSON.stringify(value));
		window.dispatchEvent(new Event(`vpk-persistent-state:${key}`));
	} catch {
		// Ignore storage failures in private/incognito or hardened contexts.
	}
}

export function usePersistentState<T>(key: string, fallback: T) {
	const subscribe = useCallback(
		(listener: () => void) => {
			if (typeof window === "undefined") {
				return () => {};
			}

			const handleStorage = (event: StorageEvent) => {
				if (event.key === key || event.key === null) {
					listener();
				}
			};
			const handleCustomEvent = () => {
				listener();
			};
			const eventName = `vpk-persistent-state:${key}`;

			window.addEventListener("storage", handleStorage);
			window.addEventListener(eventName, handleCustomEvent);

			return () => {
				window.removeEventListener("storage", handleStorage);
				window.removeEventListener(eventName, handleCustomEvent);
			};
		},
		[key],
	);

	const value = useSyncExternalStore(
		subscribe,
		() => readJsonValue(key, fallback),
		() => fallback,
	);

	const setValue = useCallback(
		(nextValue: T | ((current: T) => T)) => {
			const current = readJsonValue(key, fallback);
			const resolvedValue =
				typeof nextValue === "function"
					? (nextValue as (current: T) => T)(current)
					: nextValue;

			writeJsonValue(key, resolvedValue);
		},
		[fallback, key],
	);

	return [value, setValue] as const;
}

