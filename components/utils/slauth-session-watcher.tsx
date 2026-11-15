"use client";

import { useEffect } from "react";
import { createSlauthWatchedFetch } from "@/lib/slauth-session";

function readSessionStorage(): Storage | null {
	try {
		return window.sessionStorage;
	} catch {
		return null;
	}
}

/**
 * In production builds, sends the page through the SLAuth sidecar's `/saml/login` when a
 * background fetch shows the session has expired (see `lib/slauth-session.ts`). Renders
 * nothing. Mount this once at the root (in `app/providers.tsx`).
 */
export function SlauthSessionWatcher() {
	useEffect(() => {
		if (process.env.NODE_ENV !== "production") return;
		const originalFetch = window.fetch;
		const watchedFetch = createSlauthWatchedFetch(originalFetch.bind(window), {
			location: window.location,
			now: () => Date.now(),
			storage: readSessionStorage(),
		});
		window.fetch = watchedFetch;
		return () => {
			if (window.fetch === watchedFetch) window.fetch = originalFetch;
		};
	}, []);

	return null;
}
