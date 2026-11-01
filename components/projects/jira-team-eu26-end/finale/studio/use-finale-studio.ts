"use client";

import { useSyncExternalStore } from "react";

import savedFile from "../data/finale-studio.json";
import { normalizeFinaleStudio, type FinaleStudioConfig } from "./finale-studio-config";
import type { StudioVersion } from "./studio-versions";

/*
 * The wall's one source of truth is the saved file (`data/finale-studio.json`):
 * the flow, the film and every page show it. The studio edits a draft of it,
 * and its preview shows the draft; Save makes the draft the truth and a version.
 */

/** The wall as saved when this page was built (the dev server reloads it when Save writes the file). */
export const SAVED_FINALE_STUDIO = normalizeFinaleStudio(savedFile);

export const FINALE_SITE_ROOT = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`;
const STUDIO_PATH = `${FINALE_SITE_ROOT}studio`;
const ENDPOINT = `${FINALE_SITE_ROOT}api/finale-studio`;
const CHANNEL = "venn-finale-studio";
/** The studio's unsaved edit, for its own tab only (it survives a reload; no other page reads it). */
const DRAFT_KEY = "venn.finaleStudio.draft";
/** Each browser's own copy, from before there was one saved truth: cleared, never read. */
const LEGACY_KEY = "venn.finaleStudio";

type Role = "flow" | "studio" | "preview";
type Message = { readonly type: "saved"; readonly studio: FinaleStudioConfig } | { readonly type: "draft"; readonly studio: FinaleStudioConfig | null } | { readonly type: "hello" };

export interface FinaleStudioStatus {
	/** The studio holds changes it hasn't saved. */
	readonly dirty: boolean;
	readonly saving: boolean;
	readonly error: string | null;
	/** Every saved version, newest first (null until the studio has asked). */
	readonly versions: readonly StudioVersion[] | null;
}

let saved = SAVED_FINALE_STUDIO;
let draft: FinaleStudioConfig | null = null;
let role: Role | null = null;
let status: FinaleStudioStatus = { dirty: false, saving: false, error: null, versions: null };
let channel: BroadcastChannel | null = null;
const listeners = new Set<() => void>();
/** The dev server re-runs this module when Save rewrites the file: the old copy's channel is closed. */
const scope = globalThis as typeof globalThis & { __vennFinaleStudioChannel?: BroadcastChannel };

const same = (a: FinaleStudioConfig, b: FinaleStudioConfig) => JSON.stringify(a) === JSON.stringify(b);
const post = (message: Message) => channel?.postMessage(message);

function notify() {
	status = { ...status, dirty: draft !== null };
	for (const listener of listeners) listener();
}

function keepDraft() {
	try {
		if (draft) window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
		else window.sessionStorage.removeItem(DRAFT_KEY);
	} catch {
		// Storage can be off: the draft still lives in this page.
	}
}

/** What this page is: the studio (`/studio`), the studio's preview (`?preview=draft`), or the flow. */
function connect(): Role {
	if (role) return role;
	if (typeof window === "undefined") return "flow";
	const pathname = window.location.pathname;
	role = pathname === STUDIO_PATH || pathname.startsWith(`${STUDIO_PATH}/`) ? "studio" : new URLSearchParams(window.location.search).get("preview") === "draft" ? "preview" : "flow";
	try {
		window.localStorage.removeItem(LEGACY_KEY);
		if (role === "studio") {
			const kept = window.sessionStorage.getItem(DRAFT_KEY);
			draft = kept ? normalizeFinaleStudio(JSON.parse(kept)) : null;
		}
	} catch {
		draft = null;
	}
	status = { ...status, dirty: draft !== null };
	if ("BroadcastChannel" in window) {
		scope.__vennFinaleStudioChannel?.close();
		channel = new BroadcastChannel(CHANNEL);
		scope.__vennFinaleStudioChannel = channel;
		channel.onmessage = ({ data }: MessageEvent<Message>) => {
			if (data.type === "saved") {
				saved = normalizeFinaleStudio(data.studio);
				notify();
			} else if (data.type === "draft" && role === "preview") {
				draft = data.studio ? normalizeFinaleStudio(data.studio) : null;
				notify();
			} else if (data.type === "hello" && role === "studio") post({ type: "draft", studio: draft });
		};
		if (role === "preview") post({ type: "hello" });
	}
	if (role === "studio") {
		window.addEventListener("beforeunload", (event) => {
			if (draft) event.preventDefault();
		});
		// Every start of the studio's store (its first, or after a save re-ran it) asks for the versions.
		if (process.env.NODE_ENV === "development") queueMicrotask(() => void loadFinaleStudioVersions());
	}
	return role;
}

function subscribe(listener: () => void) {
	connect();
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/** The flow shows what is saved; the studio and its preview show the studio's draft over it. */
function snapshot(): FinaleStudioConfig {
	return connect() === "flow" ? saved : (draft ?? saved);
}

const serverSnapshot = () => SAVED_FINALE_STUDIO;
const statusSnapshot = () => status;

/** The wall's settings for this page, live: a save (or, in the studio, an edit) re-renders every reader. */
export function useFinaleStudio(): FinaleStudioConfig {
	return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

export function useFinaleStudioStatus(): FinaleStudioStatus {
	return useSyncExternalStore(subscribe, statusSnapshot, statusSnapshot);
}

/** The studio's edit: the draft, until it is saved (an edit back to the saved wall is no draft at all). */
export function editFinaleStudio(next: FinaleStudioConfig): void {
	draft = same(next, saved) ? null : next;
	keepDraft();
	post({ type: "draft", studio: draft });
	notify();
}

/** Drops the studio's draft: back to the saved wall. */
export function discardFinaleStudio(): void {
	editFinaleStudio(saved);
}

async function request<T>(init?: RequestInit, query = ""): Promise<T> {
	if (process.env.NODE_ENV !== "development") throw new Error("Saving and history require the local dev server.");
	const response = await fetch(`${ENDPOINT}${query}`, { cache: "no-store", ...init });
	const body = (await response.json()) as T & { error?: string };
	if (!response.ok) throw new Error(body.error ?? `The studio could not reach ${ENDPOINT} (${response.status}).`);
	return body;
}

/** Saves `studio` (the draft, made whole by the caller): it becomes the truth and a version of its own. */
export async function saveFinaleStudio(studio: FinaleStudioConfig): Promise<void> {
	status = { ...status, saving: true, error: null };
	notify();
	try {
		const result = await request<{ current: FinaleStudioConfig; versions: readonly StudioVersion[] }>({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(studio) });
		saved = normalizeFinaleStudio(result.current);
		draft = null;
		keepDraft();
		status = { ...status, saving: false, versions: result.versions };
		post({ type: "saved", studio: saved });
		post({ type: "draft", studio: null });
	} catch (error) {
		status = { ...status, saving: false, error: error instanceof Error ? error.message : String(error) };
	}
	notify();
}

/** Asks for the saved versions (and the file as it is now, should it have changed on disk). */
export async function loadFinaleStudioVersions(): Promise<void> {
	try {
		const result = await request<{ current: FinaleStudioConfig; versions: readonly StudioVersion[] }>();
		saved = normalizeFinaleStudio(result.current);
		if (draft && same(draft, saved)) draft = null;
		status = { ...status, versions: result.versions, error: null };
	} catch (error) {
		status = { ...status, error: error instanceof Error ? error.message : String(error) };
	}
	notify();
}

/** Opens a saved version as the studio's draft: Save makes it the truth again. */
export async function openFinaleStudioVersion(id: string): Promise<void> {
	try {
		const result = await request<{ studio: FinaleStudioConfig }>(undefined, `?version=${encodeURIComponent(id)}`);
		editFinaleStudio(normalizeFinaleStudio(result.studio));
	} catch (error) {
		status = { ...status, error: error instanceof Error ? error.message : String(error) };
		notify();
	}
}
