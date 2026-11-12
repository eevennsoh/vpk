"use client";

import { useEffect, useRef, useState } from "react";
import { usePersistentState } from "@/lib/use-persistent-state";

// Rovo CLI workspace selection and its launch command, shared by the local agent menu
// and the inline local agent picker. Kept out of the component file so Fast Refresh
// can preserve component state.

export const WORKSPACES_KEY = "butter-local-agent-workspaces";
export const EMPTY_WORKSPACES = '{"paths":[],"selected":null}';
export type Workspaces = { paths: string[]; selected: string | null };

export function readWorkspaces(raw: string): Workspaces {
	try {
		const value: unknown = JSON.parse(raw);
		if (typeof value === "object" && value !== null && "paths" in value && Array.isArray(value.paths)) {
			const paths = value.paths.filter((path): path is string => typeof path === "string");
			const selected = "selected" in value && typeof value.selected === "string" && paths.includes(value.selected) ? value.selected : null;
			return { paths, selected };
		}
	} catch {
		return { paths: [], selected: null };
	}
	return { paths: [], selected: null };
}

function quoteShellPath(path: string): string {
	const quote = (value: string) => `'${value.replace(/'/g, "'\\''")}'`;
	if (path === "~") return "~";
	return path.startsWith("~/") ? `~/${quote(path.slice(2))}` : quote(path);
}

export function getRovoCliCommand(workspace: string | null): string {
	return workspace ? `cd ${quoteShellPath(workspace)} && rovo` : "rovo";
}

/** Copies the Rovo CLI launch command for the selected workspace; "copied" shows only after the clipboard write succeeds. */
export function useRovoCliCommandCopy() {
	const [stored] = usePersistentState(WORKSPACES_KEY, EMPTY_WORKSPACES);
	const [copied, setCopied] = useState(false);
	const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(() => () => { if (copiedTimer.current !== null) clearTimeout(copiedTimer.current); }, []);
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(getRovoCliCommand(readWorkspaces(stored).selected));
		} catch {
			return;
		}
		setCopied(true);
		if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
		copiedTimer.current = setTimeout(() => setCopied(false), 1800);
	};
	return { copied, copy };
}
