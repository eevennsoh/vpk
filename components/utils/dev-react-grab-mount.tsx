"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { resolveReactGrabScriptSources, shouldDisableReactGrab } from "@/components/utils/dev-react-grab";

const REACT_GRAB_SCRIPT_ID = "vpk-dev-react-grab-script";
const REACT_GRAB_MCP_SCRIPT_ID = "vpk-dev-react-grab-mcp-script";
const REACT_GRAB_SCRIPT_SOURCES = resolveReactGrabScriptSources(process.env.NEXT_PUBLIC_REACT_GRAB_SRC);
const REACT_GRAB_MCP_SCRIPT_SRC = "//unpkg.com/@react-grab/mcp/dist/client.global.js";
type ReactGrabWindow = Window & {
	__REACT_GRAB__?: {
		activate?: () => void;
		deactivate?: () => void;
		setEnabled?: (enabled: boolean) => void;
	};
};

function ensureScript({
	id,
	src,
	crossOrigin,
}: Readonly<{
	id: string;
	src: string;
	crossOrigin?: string;
}>): Promise<void> {
	const existingScript = window.document.getElementById(id) as HTMLScriptElement | null;
	if (existingScript) {
		return Promise.resolve();
	}

	return new Promise((resolve, reject) => {
		const script = window.document.createElement("script");
		script.id = id;
		script.src = src;
		script.async = true;
		if (crossOrigin) {
			script.crossOrigin = crossOrigin;
		}

		script.onload = () => resolve();
		script.onerror = () => {
			// A failed tag left in place would make the next attempt look already loaded.
			script.remove();
			reject(new Error(`Failed to load script: ${src}`));
		};

		window.document.head.appendChild(script);
	});
}

async function ensureFirstAvailableScript({
	id,
	sources,
	crossOrigin,
}: Readonly<{
	id: string;
	sources: readonly string[];
	crossOrigin?: string;
}>): Promise<void> {
	const [src, ...fallbackSources] = sources;
	try {
		await ensureScript({ id, src, crossOrigin });
	} catch (error) {
		if (fallbackSources.length === 0) {
			throw error;
		}
		console.warn(`[vpk] React Grab did not load from ${src}; falling back to ${fallbackSources[0]}.`);
		await ensureFirstAvailableScript({ id, sources: fallbackSources, crossOrigin });
	}
}

export function DevReactGrabMount() {
	const pathname = usePathname();

	useEffect(() => {
		if (process.env.NODE_ENV !== "development") {
			return;
		}

		if (shouldDisableReactGrab({ hostname: window.location.hostname, pathname })) {
			const reactGrab = (window as ReactGrabWindow).__REACT_GRAB__;
			reactGrab?.deactivate?.();
			reactGrab?.setEnabled?.(false);
			return;
		}

		let cancelled = false;

		const loadScripts = async () => {
			try {
				await ensureFirstAvailableScript({
					id: REACT_GRAB_SCRIPT_ID,
					sources: REACT_GRAB_SCRIPT_SOURCES,
					crossOrigin: "anonymous",
				});

				if (cancelled) {
					return;
				}

				await ensureScript({
					id: REACT_GRAB_MCP_SCRIPT_ID,
					src: REACT_GRAB_MCP_SCRIPT_SRC,
				});

				if (cancelled) {
					return;
				}

				const reactGrab = (window as ReactGrabWindow).__REACT_GRAB__;
				reactGrab?.setEnabled?.(true);
			} catch {
				// Ignore script loading errors in local dev helper tooling.
			}
		};

		void loadScripts();

		return () => {
			cancelled = true;
		};
	}, [pathname]);

	return null;
}
