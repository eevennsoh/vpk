"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import AddIcon from "@atlaskit/icon/core/add";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CopyIcon from "@atlaskit/icon/core/copy";
import CustomizeIcon from "@atlaskit/icon/core/customize";
import DeleteIcon from "@atlaskit/icon/core/delete";
import FolderClosedIcon from "@atlaskit/icon/core/folder-closed";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { usePersistentState } from "@/lib/use-persistent-state";
import { cn } from "@/lib/utils";
import { CopyFeedbackIcon } from "@/components/ui-custom/copy-feedback-icon";

const WORKSPACES_KEY = "butter-local-agent-workspaces";
const EMPTY_WORKSPACES = '{"paths":[],"selected":null}';
type Workspaces = { paths: string[]; selected: string | null };

function readWorkspaces(raw: string): Workspaces {
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

export function ProjectButterLocalAgentMenu({
	onPointerEnter, onPointerLeave, onSelectingFolderChange, workspacePositionerClassName,
}: Readonly<{
	onPointerEnter: () => void;
	onPointerLeave: () => void;
	onSelectingFolderChange: (selecting: boolean) => void;
	workspacePositionerClassName?: string;
}>) {
	const [stored, setStored] = usePersistentState(WORKSPACES_KEY, EMPTY_WORKSPACES);
	const { paths, selected } = readWorkspaces(stored);
	const [draft, setDraft] = useState<string | null>(null);
	const [open, setOpen] = useState(false);
	const [directoryVisible, setDirectoryVisible] = useState(false);
	const [copied, setCopied] = useState(false);
	const [selecting, setSelecting] = useState(false);
	const [folderError, setFolderError] = useState<string | null>(null);
	const currentWorkspaces = useRef({ paths, selected });
	useEffect(() => { currentWorkspaces.current = { paths, selected }; }, [paths, selected]);
	const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(() => () => { if (copiedTimer.current !== null) clearTimeout(copiedTimer.current); }, []);
	const anchor = useRef<HTMLDivElement | null>(null);
	const input = useRef<HTMLInputElement | null>(null);
	const workspacePopup = useRef<HTMLDivElement | null>(null);
	const configureButton = useRef<HTMLButtonElement | null>(null);
	const selectedWorkspace = useRef<HTMLButtonElement | null>(null);
	const chevronWasOpen = useRef(false);
	const focusCreatedWorkspace = useRef(false);
	useLayoutEffect(() => {
		if (!focusCreatedWorkspace.current) return;
		focusCreatedWorkspace.current = false;
		selectedWorkspace.current?.focus();
	}, [stored]);
	const inputId = useId();
	const query = draft?.trim() ?? "";
	const filtered = query ? paths.filter((path) => path.toLowerCase().includes(query.toLowerCase())) : paths;
	const canCreate = query.length > 0 && !paths.includes(query);
	const save = (next: Workspaces) => setStored(JSON.stringify(next));
	const choose = (path: string | null) => {
		save({ paths, selected: path });
		setDraft(null);
		setOpen(false);
		configureButton.current?.focus();
	};
	const create = () => {
		if (!canCreate) return;
		focusCreatedWorkspace.current = true;
		save({ paths: [...paths, query], selected: query });
		setDraft(null);
		setOpen(true);
	};
	const remove = (path: string) => {
		save({ paths: paths.filter((candidate) => candidate !== path), selected: selected === path ? null : selected });
		input.current?.focus();
	};
	const addWorkspace = async () => {
		if (!["localhost", "127.0.0.1"].includes(window.location.hostname) && !window.location.hostname.endsWith(".localhost")) {
			setFolderError("Folder selection is available in the local macOS preview.");
			return;
		}
		setFolderError(null);
		setSelecting(true);
		onSelectingFolderChange(true);
		try {
			const backendResponse = await fetch("/api/realtime/ws-url");
			if (!backendResponse.ok) throw new Error("Backend unavailable");
			const backend: unknown = await backendResponse.json();
			if (typeof backend !== "object" || backend === null || !("wsUrl" in backend) || typeof backend.wsUrl !== "string") throw new Error("Invalid backend URL");
			const backendUrl = new URL(backend.wsUrl);
			if (backendUrl.protocol !== "ws:" || !["localhost", "127.0.0.1"].includes(backendUrl.hostname) || !backendUrl.port) throw new Error("Backend is not local");
			const response = await fetch(`http://127.0.0.1:${backendUrl.port}/api/local-folder`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
			if (!response.ok) throw new Error("Folder selection unavailable");
			const result: unknown = await response.json();
			if (typeof result !== "object" || result === null || !("path" in result) || result.path === null) return;
			if (typeof result.path !== "string" || !result.path.startsWith("/")) throw new Error("Invalid folder path");
			const path = result.path;
			const existing = currentWorkspaces.current.paths;
			focusCreatedWorkspace.current = true;
			save({ paths: existing.includes(path) ? existing : [...existing, path], selected: path });
			setDraft(null);
			setOpen(true);
			requestAnimationFrame(() => selectedWorkspace.current?.focus());
		} catch {
			setFolderError("Could not open the folder chooser. You can still type a path.");
		} finally {
			setSelecting(false);
			onSelectingFolderChange(false);
		}
	};

	return (
		<Collapsible data-butter-local-menu className="min-w-0" open={directoryVisible} onOpenChange={(nextOpen) => { setDirectoryVisible(nextOpen); if (!nextOpen) { setOpen(false); setDraft(null); } }}>
			<div className="group/copy-command relative">
				<Button aria-label={copied ? "Command copied" : "Copy command"} className="h-8 w-full justify-start gap-3 pl-2 pr-10 text-sm font-normal group-hover/copy-command:bg-bg-neutral-subtle-hovered" variant="ghost" onClick={() => {
					setCopied(true);
					if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
					copiedTimer.current = setTimeout(() => setCopied(false), 1800);
				}}>
					<CopyFeedbackIcon copied={copied} idleIcon={<CopyIcon label="" size="small" />} />
					<span aria-hidden className="grid min-w-0 text-left">
						<span className={cn("col-start-1 row-start-1 transition-opacity duration-normal ease-out-practical", copied ? "opacity-0" : "opacity-100")}>Copy command</span>
						<span className={cn("col-start-1 row-start-1 transition-opacity duration-normal ease-out-practical", copied ? "opacity-100" : "opacity-0")}>Command copied</span>
					</span>
				</Button>
				<CollapsibleTrigger render={<Button ref={configureButton} aria-label="Configure directory" className="absolute right-1 top-1" size="icon-compact" variant="ghost" />}>
					<Icon aria-hidden render={<CustomizeIcon label="" size="small" />} />
				</CollapsibleTrigger>
			</div>
			<span className="sr-only" role="status">{copied ? "Command copied" : ""}</span>
			<CollapsibleContent hiddenUntilFound={false} className="overflow-hidden h-(--collapsible-panel-height) transition-[height,opacity] duration-normal ease-out-practical data-starting-style:h-0 data-starting-style:opacity-0 data-ending-style:h-0 data-ending-style:opacity-0 data-ending-style:duration-fast data-ending-style:ease-in">
			<div className="mt-1 border-t border-border">
				<div className="px-2 pt-3 pb-2 text-xs font-semibold text-text-subtlest">
					<label htmlFor={inputId}>Choose your directory</label>
				</div>
				<div className="px-2 pb-2">
					<Popover open={open} onOpenChange={setOpen}>
						<InputGroup ref={anchor}>
							<InputGroupInput ref={input} id={inputId} placeholder="No workspace" value={draft ?? selected ?? ""} onFocus={() => { onPointerEnter(); setOpen(true); }} onClick={() => setOpen(true)} onChange={(event) => { setDraft(event.target.value); setOpen(true); }} onKeyDown={(event) => {
								if (event.key === "Enter" && query) { event.preventDefault(); if (canCreate) create(); else if (paths.includes(query)) choose(query); }
								if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); requestAnimationFrame(() => workspacePopup.current?.querySelector<HTMLButtonElement>("button")?.focus()); }
								if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); setDraft(null); configureButton.current?.focus(); }
							}} />
							<InputGroupAddon align="inline-end" className="pr-3" onPointerDown={() => { chevronWasOpen.current = open; }} onClick={() => { if (chevronWasOpen.current) { setOpen(false); setDraft(null); configureButton.current?.focus(); } else { input.current?.focus(); setOpen(true); } }}>
								<ChevronDownIcon aria-hidden label="" size="small" />
							</InputGroupAddon>
						</InputGroup>
						<PopoverContent ref={workspacePopup} anchor={anchor} aria-label="Codebase workspaces" initialFocus={false} finalFocus={false} side="bottom" align="start" sideOffset={4} className="w-(--anchor-width) min-w-0 gap-0 p-1" positionerClassName={workspacePositionerClassName} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => {
								if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); setDraft(null); configureButton.current?.focus(); }
								if (event.key === "ArrowDown" || event.key === "ArrowUp") {
									event.preventDefault();
									const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
									const current = buttons.indexOf(document.activeElement instanceof HTMLButtonElement ? document.activeElement : buttons[0]);
									buttons[(current + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
								}
							}}>
							<Button variant="ghost" className="h-8 w-full justify-start gap-2 px-2 text-sm font-normal" disabled={selecting} onClick={() => { void addWorkspace(); }}><Icon aria-hidden render={<AddIcon label="" size="small" />} />{selecting ? "Choosing workspace…" : "Add workspace"}</Button>
							{!query ? <Button aria-current={selected === null ? "true" : undefined} variant="ghost" className="h-8 w-full justify-start gap-2 px-2 text-sm font-normal" onClick={() => choose(null)}><Icon aria-hidden className="shrink-0" render={<FolderClosedIcon label="" size="small" />} />No workspace{selected === null ? <Icon aria-hidden className="ml-auto shrink-0 text-icon-subtle" render={<CheckMarkIcon label="" size="small" />} /> : null}</Button> : null}
							{filtered.map((path) => (
								<div className="group/workspace-row relative flex min-w-0 items-center rounded-md hover:bg-bg-neutral-subtle-hovered" key={path}>
									<Button ref={selected === path ? selectedWorkspace : undefined} aria-current={selected === path ? "true" : undefined} variant="ghost" className="h-8 w-full min-w-0 justify-start gap-2 px-2 text-sm font-normal" onClick={() => choose(path)}><Icon aria-hidden className="shrink-0" render={<FolderClosedIcon label="" size="small" />} /><span className="min-w-0 flex-1 truncate pr-8 text-left">{path}</span>{selected === path ? <Icon aria-hidden className="ml-auto shrink-0 text-icon-subtle" render={<CheckMarkIcon label="" size="small" />} /> : null}</Button>
									<Button aria-label={`Remove ${path}`} className={cn("absolute top-1 opacity-0 pointer-events-none transition-opacity duration-fast ease-out-practical group-hover/workspace-row:opacity-100 group-hover/workspace-row:pointer-events-auto group-has-[:focus-visible]/workspace-row:opacity-100 group-has-[:focus-visible]/workspace-row:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto [@media(hover:none)]:opacity-100 [@media(hover:none)]:pointer-events-auto hover:bg-bg-neutral-hovered active:bg-bg-neutral-pressed", selected === path ? "right-6" : "right-1")} size="icon-compact" variant="ghost" onClick={() => remove(path)}><Icon aria-hidden render={<DeleteIcon label="" size="small" />} /></Button>
								</div>
							))}
							{canCreate ? <Button variant="ghost" className="h-8 w-full justify-start px-2 text-sm font-normal" onClick={() => create()}>Create “{query}”</Button> : null}
							{folderError ? <p role="alert" className="px-2 py-1 text-xs text-text-danger">{folderError}</p> : null}
						</PopoverContent>
					</Popover>
				</div>
			</div>
			</CollapsibleContent>
		</Collapsible>
	);
}
