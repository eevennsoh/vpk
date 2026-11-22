"use client";

import {
	useEffect,
	useMemo,
	useRef,
	useState,
	type DragEvent as ReactDragEvent,
	type HTMLAttributes,
	type KeyboardEvent,
	type ReactNode,
} from "react";

import { Input } from "@/components/ui/input";
import {
	ChevronRightIcon,
	SearchIcon,
} from "@/components/ui/vpk-icons";
import {
	FileExplorerFileIcon,
	FileExplorerIconSprite,
	type FileExplorerIcons,
} from "@/components/ui-custom/file-explorer-file-icon";
import {
	createFileExplorerModel,
	getFileExplorerMovePath,
	getVisibleFileExplorerNodes,
	normalizeFileExplorerPath,
	type FileExplorerItemType,
	type FileExplorerSearchMode,
} from "@/components/ui-custom/file-explorer-model";
import { cn } from "@/lib/utils";

export type { FileExplorerIcons };

export type FileExplorerGitStatus = "added" | "deleted" | "ignored" | "modified" | "renamed" | "untracked";

export interface FileExplorerItem {
	annotation?: ReactNode;
	disabled?: boolean;
	icon?: ReactNode;
	path: string;
	status?: FileExplorerGitStatus;
	type?: FileExplorerItemType;
}

export interface FileExplorerMoveEvent {
	destinationPath: string | null;
	nextPath: string;
	sourcePath: string;
}

export interface FileExplorerProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
	canDrag?: (path: string, item: FileExplorerItem) => boolean;
	defaultExpandedPaths?: Iterable<string>;
	defaultSelectedPath?: string;
	dragAndDrop?: boolean;
	emptyMessage?: string;
	expandedPaths?: ReadonlySet<string>;
	flattenEmptyDirectories?: boolean;
	icons?: FileExplorerIcons;
	items: readonly FileExplorerItem[];
	onExpandedPathsChange?: (paths: ReadonlySet<string>) => void;
	onMove?: (event: FileExplorerMoveEvent) => void;
	onSelectedPathChange?: (path: string, item: FileExplorerItem) => void;
	openOnDropDelay?: number;
	searchable?: boolean;
	searchMode?: FileExplorerSearchMode;
	searchPlaceholder?: string;
	/** Controlled filter query. When set, drives filtering even if `searchable` is false. */
	searchQuery?: string;
	selectedPath?: string;
}

const statusStyles: Record<Exclude<FileExplorerGitStatus, "ignored">, { className: string; label: string; shortLabel: string }> = {
	added: { className: "text-icon-success", label: "Added", shortLabel: "A" },
	deleted: { className: "text-icon-danger", label: "Deleted", shortLabel: "D" },
	modified: { className: "text-icon-information", label: "Modified", shortLabel: "M" },
	renamed: { className: "text-icon-warning", label: "Renamed", shortLabel: "R" },
	untracked: { className: "text-icon-success", label: "Untracked", shortLabel: "U" },
};

const FILE_EXPLORER_DRAG_MIME_TYPE = "application/x-file-explorer-path";
const FILE_EXPLORER_ROOT_DROP_TARGET = "__file-explorer-root__";

function normalizePathSet(paths: Iterable<string>): Set<string> {
	return new Set([...paths].map(normalizeFileExplorerPath).filter(Boolean));
}

function getChangedAncestorPaths(items: readonly FileExplorerItem[]): Set<string> {
	const ancestorPaths = new Set<string>();

	for (const item of items) {
		if (!item.status || item.status === "ignored") {
			continue;
		}

		let path = normalizeFileExplorerPath(item.path);
		let separatorIndex = path.lastIndexOf("/");
		while (separatorIndex !== -1) {
			path = path.slice(0, separatorIndex);
			ancestorPaths.add(path);
			separatorIndex = path.lastIndexOf("/");
		}
	}

	return ancestorPaths;
}

export function FileExplorer({
	"aria-label": ariaLabel = "File tree",
	canDrag,
	className,
	defaultExpandedPaths = [],
	defaultSelectedPath,
	dragAndDrop = false,
	emptyMessage = "No files found.",
	expandedPaths: controlledExpandedPaths,
	flattenEmptyDirectories = false,
	icons = "complete",
	items,
	onExpandedPathsChange,
	onMove,
	onSelectedPathChange,
	openOnDropDelay = 600,
	searchable = false,
	searchMode = "hide-non-matches",
	searchPlaceholder = "Search files",
	searchQuery: controlledSearchQuery,
	selectedPath: controlledSelectedPath,
	...props
}: Readonly<FileExplorerProps>) {
	const model = useMemo(() => createFileExplorerModel(items), [items]);
	const itemsByPath = useMemo(
		() => new Map(items.map((item) => [normalizeFileExplorerPath(item.path), item])),
		[items],
	);
	const changedAncestorPaths = useMemo(() => getChangedAncestorPaths(items), [items]);
	const [internalExpandedPaths, setInternalExpandedPaths] = useState(() =>
		normalizePathSet(defaultExpandedPaths),
	);
	const [internalSelectedPath, setInternalSelectedPath] = useState(() =>
		defaultSelectedPath ? normalizeFileExplorerPath(defaultSelectedPath) : undefined,
	);
	const [focusedPath, setFocusedPath] = useState<string>();
	const [internalQuery, setInternalQuery] = useState("");
	const query = controlledSearchQuery ?? internalQuery;
	const [draggedPath, setDraggedPath] = useState<string>();
	const [dropTargetPath, setDropTargetPath] = useState<string>();
	const draggedPathRef = useRef<string | undefined>(undefined);
	const expandOnDropTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const rowRefs = useRef(new Map<string, HTMLButtonElement>());
	const expandedPaths = useMemo(
		() => controlledExpandedPaths ? normalizePathSet(controlledExpandedPaths) : internalExpandedPaths,
		[controlledExpandedPaths, internalExpandedPaths],
	);
	const selectedPath = controlledSelectedPath !== undefined
		? normalizeFileExplorerPath(controlledSelectedPath)
		: internalSelectedPath;
	const visibleNodes = useMemo(
		() => getVisibleFileExplorerNodes(model, expandedPaths, query, flattenEmptyDirectories, searchMode),
		[expandedPaths, flattenEmptyDirectories, model, query, searchMode],
	);
	const activePath = focusedPath && visibleNodes.some((node) => node.path === focusedPath)
		? focusedPath
		: (selectedPath && visibleNodes.some((node) => node.path === selectedPath) ? selectedPath : visibleNodes[0]?.path);
	const isDragAndDropEnabled = dragAndDrop && !query.trim();

	useEffect(() => () => {
		if (expandOnDropTimerRef.current) {
			clearTimeout(expandOnDropTimerRef.current);
		}
	}, []);

	const focusPath = (path: string | undefined) => {
		if (!path) {
			return;
		}
		setFocusedPath(path);
		rowRefs.current.get(path)?.focus();
	};

	const setExpanded = (path: string, isExpanded: boolean) => {
		const nextPaths = new Set(expandedPaths);
		if (isExpanded) {
			nextPaths.add(path);
		} else {
			nextPaths.delete(path);
		}
		if (!controlledExpandedPaths) {
			setInternalExpandedPaths(nextPaths);
		}
		onExpandedPathsChange?.(nextPaths);
	};

	const selectPath = (path: string) => {
		const item = itemsByPath.get(path) ?? { path, type: "folder" as const };
		if (item.disabled) {
			return;
		}
		if (!controlledSelectedPath) {
			setInternalSelectedPath(path);
		}
		onSelectedPathChange?.(path, item);
	};

	const getItem = (path: string): FileExplorerItem =>
		itemsByPath.get(path) ?? { path, type: "folder" as const };

	const isDraggablePath = (path: string): boolean => {
		const item = getItem(path);
		return isDragAndDropEnabled && !item.disabled && (canDrag?.(path, item) ?? true);
	};

	const canDropOn = (sourcePath: string | undefined, destinationPath: string | null): boolean => {
		if (!sourcePath || !isDraggablePath(sourcePath)) {
			return false;
		}
		return getFileExplorerMovePath(model, sourcePath, destinationPath) !== null;
	};

	const clearDragState = () => {
		if (expandOnDropTimerRef.current) {
			clearTimeout(expandOnDropTimerRef.current);
			expandOnDropTimerRef.current = undefined;
		}
		draggedPathRef.current = undefined;
		setDraggedPath(undefined);
		setDropTargetPath(undefined);
	};

	const queueFolderExpansion = (path: string) => {
		if (expandedPaths.has(path)) {
			return;
		}
		if (expandOnDropTimerRef.current) {
			clearTimeout(expandOnDropTimerRef.current);
		}
		expandOnDropTimerRef.current = setTimeout(() => {
			setExpanded(path, true);
			expandOnDropTimerRef.current = undefined;
		}, openOnDropDelay);
	};

	const movePath = (sourcePath: string | undefined, destinationPath: string | null) => {
		if (!canDropOn(sourcePath, destinationPath) || !sourcePath) {
			clearDragState();
			return;
		}
		const nextPath = getFileExplorerMovePath(model, sourcePath, destinationPath);
		if (!nextPath) {
			clearDragState();
			return;
		}
		if (destinationPath) {
			setExpanded(destinationPath, true);
		}
		setFocusedPath(undefined);
		onMove?.({ destinationPath, nextPath, sourcePath });
		clearDragState();
	};

	const getDraggedPath = (event: ReactDragEvent): string | undefined =>
		event.dataTransfer.getData(FILE_EXPLORER_DRAG_MIME_TYPE) || draggedPathRef.current;

	const handleRowKeyDown = (event: KeyboardEvent<HTMLButtonElement>, path: string) => {
		const currentIndex = visibleNodes.findIndex((node) => node.path === path);
		const node = visibleNodes[currentIndex];
		if (!node) {
			return;
		}

		switch (event.key) {
			case "ArrowDown":
				event.preventDefault();
				focusPath(visibleNodes[Math.min(currentIndex + 1, visibleNodes.length - 1)]?.path);
				break;
			case "ArrowUp":
				event.preventDefault();
				focusPath(visibleNodes[Math.max(currentIndex - 1, 0)]?.path);
				break;
			case "ArrowRight":
				event.preventDefault();
				if (node.type === "folder" && !expandedPaths.has(path)) {
					setExpanded(path, true);
				} else if (node.type === "folder") {
					focusPath(node.children[0]);
				}
				break;
			case "ArrowLeft":
				event.preventDefault();
				if (node.type === "folder" && expandedPaths.has(path)) {
					setExpanded(path, false);
				} else {
					focusPath(node.parentPath ?? undefined);
				}
				break;
			case "End":
				event.preventDefault();
				focusPath(visibleNodes.at(-1)?.path);
				break;
			case "Home":
				event.preventDefault();
				focusPath(visibleNodes[0]?.path);
				break;
			case "Enter":
			case " ":
				event.preventDefault();
				selectPath(path);
				break;
		}
	};

	return (
		<div
			className={cn("group/file-explorer overflow-hidden rounded-lg border border-border bg-surface font-sans text-[13px]", className)}
			data-slot="file-explorer"
			{...props}
		>
			<FileExplorerIconSprite icons={icons} />
			{searchable ? (
				<div className="relative border-b border-border px-2 py-2">
					<SearchIcon className="pointer-events-none absolute left-4 top-1/2 z-10 size-4 -translate-y-1/2 text-icon-subtlest" />
					<Input
						aria-label="Search files"
						className="pl-8"
						isCompact
						onChange={(event) => setInternalQuery(event.target.value)}
						placeholder={searchPlaceholder}
						value={query}
					/>
				</div>
			) : null}
			<div
				aria-label={ariaLabel}
				className={cn(
					"max-h-96 min-h-12 overflow-y-auto p-2 transition-colors duration-normal",
					dropTargetPath === FILE_EXPLORER_ROOT_DROP_TARGET && "bg-bg-selected",
				)}
				data-drop-target={dropTargetPath === FILE_EXPLORER_ROOT_DROP_TARGET ? "root" : undefined}
				onDragEnter={(event) => {
					const sourcePath = getDraggedPath(event);
					if (canDropOn(sourcePath, null)) {
						event.preventDefault();
						event.dataTransfer.dropEffect = "move";
						setDropTargetPath(FILE_EXPLORER_ROOT_DROP_TARGET);
					}
				}}
				onDragLeave={(event) => {
					if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
						setDropTargetPath(undefined);
					}
				}}
				onDragOver={(event) => {
					const sourcePath = getDraggedPath(event);
					if (canDropOn(sourcePath, null)) {
						event.preventDefault();
						event.dataTransfer.dropEffect = "move";
						setDropTargetPath(FILE_EXPLORER_ROOT_DROP_TARGET);
					}
				}}
				onDrop={(event) => {
					event.preventDefault();
					movePath(getDraggedPath(event), null);
				}}
				role="tree"
			>
				{visibleNodes.length === 0 ? (
					<p className="px-2 py-6 text-center text-text-subtle">{emptyMessage}</p>
				) : visibleNodes.map((node) => {
					const item = itemsByPath.get(node.path);
					const isExpanded = node.type === "folder" && (Boolean(query.trim()) || expandedPaths.has(node.path));
					const isSelected = selectedPath === node.path;
					const isIgnored = item?.status === "ignored";
					const status = item?.status && item.status !== "ignored" ? statusStyles[item.status] : undefined;
					const hasChangedDescendants = node.type === "folder" && changedAncestorPaths.has(node.path);
					const isRowDraggable = isDraggablePath(node.path);
					const isDropTarget = dropTargetPath === node.path;

					return (
						<button
							key={node.path}
							aria-disabled={item?.disabled || undefined}
							aria-expanded={node.type === "folder" ? Boolean(isExpanded) : undefined}
							aria-level={node.depth + 1}
							aria-selected={isSelected}
							className={cn(
								"group flex h-[30px] w-full min-w-0 items-center gap-1 rounded-md px-2 text-left text-text-subtle outline-none transition-colors duration-normal ease-out hover:bg-bg-neutral-subtle-hovered hover:text-text active:bg-bg-neutral-subtle-pressed focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
								isSelected && "bg-bg-selected text-text-selected hover:bg-bg-selected-hovered active:bg-bg-selected-pressed",
								isRowDraggable && "cursor-grab active:cursor-grabbing",
								draggedPath === node.path && "opacity-50",
								isDropTarget && "bg-bg-selected ring-1 ring-border-selected hover:bg-bg-selected-hovered",
								isIgnored && "text-text-disabled hover:text-text-disabled",
								item?.disabled && "pointer-events-none opacity-(--opacity-disabled)",
							)}
							data-dragging={draggedPath === node.path || undefined}
							data-drop-target={isDropTarget ? "directory" : undefined}
							data-path={node.path}
							data-flattened-paths={node.flattenedPaths.length > 1 ? node.flattenedPaths.join(",") : undefined}
							data-git-status={item?.status}
							data-type={node.type}
							draggable={isRowDraggable}
							onDragEnd={clearDragState}
							onDragEnter={(event) => {
								event.stopPropagation();
								const sourcePath = getDraggedPath(event);
								if (node.type === "folder" && canDropOn(sourcePath, node.path)) {
									event.preventDefault();
									event.dataTransfer.dropEffect = "move";
									setDropTargetPath(node.path);
									queueFolderExpansion(node.path);
								}
							}}
							onDragLeave={(event) => {
								event.stopPropagation();
								if (!event.currentTarget.contains(event.relatedTarget as Node | null) && dropTargetPath === node.path) {
									if (expandOnDropTimerRef.current) {
										clearTimeout(expandOnDropTimerRef.current);
										expandOnDropTimerRef.current = undefined;
									}
									setDropTargetPath(undefined);
								}
							}}
							onDragOver={(event) => {
								event.stopPropagation();
								const sourcePath = getDraggedPath(event);
								if (node.type === "folder" && canDropOn(sourcePath, node.path)) {
									event.preventDefault();
									event.dataTransfer.dropEffect = "move";
									setDropTargetPath(node.path);
									queueFolderExpansion(node.path);
								}
							}}
							onDragStart={(event) => {
								if (!isRowDraggable) {
									event.preventDefault();
									return;
								}
								event.dataTransfer.effectAllowed = "move";
								event.dataTransfer.setData(FILE_EXPLORER_DRAG_MIME_TYPE, node.path);
								event.dataTransfer.setData("text/plain", node.path);
								draggedPathRef.current = node.path;
								setDraggedPath(node.path);
							}}
							onDrop={(event) => {
								event.stopPropagation();
								if (node.type === "folder") {
									event.preventDefault();
									movePath(getDraggedPath(event), node.path);
								}
							}}
							onClick={() => {
								setFocusedPath(node.path);
								selectPath(node.path);
								if (node.type === "folder") {
									setExpanded(node.path, !expandedPaths.has(node.path));
								}
							}}
							onFocus={() => setFocusedPath(node.path)}
							onKeyDown={(event) => handleRowKeyDown(event, node.path)}
							ref={(element) => {
								if (element) {
									rowRefs.current.set(node.path, element);
								} else {
									rowRefs.current.delete(node.path);
								}
							}}
							role="treeitem"
							tabIndex={activePath === node.path ? 0 : -1}
							type="button"
						>
							<span className="flex h-full shrink-0" data-slot="file-explorer-spacing">
								{Array.from({ length: node.depth }, (_, depth) => (
									<span className="flex h-full w-4 shrink-0 justify-center" data-slot="file-explorer-spacing-item" key={depth}>
										<span className="h-full translate-x-1 border-l border-border opacity-0 transition-opacity duration-normal group-hover/file-explorer:opacity-75" />
									</span>
								))}
							</span>
							<span className="inline-flex size-4 shrink-0 items-center justify-center">
								{node.type === "folder" ? (
									<ChevronRightIcon className={cn("size-4 text-icon-subtle transition-transform duration-normal ease-out", isExpanded && "rotate-90")} size="small" />
								) : (item?.icon ?? (
									<FileExplorerFileIcon
										className={cn(status?.className, isIgnored && "text-icon-disabled")}
										icons={icons}
										path={node.path}
									/>
								))}
							</span>
							<span className={cn("min-w-0 flex-1 truncate", status?.className, isIgnored && "text-text-disabled")}>{node.name}</span>
							{item?.annotation ? <span className="shrink-0 text-xs text-text-subtle">{item.annotation}</span> : null}
							{hasChangedDescendants ? (
								<span aria-label="Contains changed files" className="w-4 shrink-0 text-right text-icon-information" title="Contains changed files">
									●
								</span>
							) : status ? (
								<span aria-label={status.label} className={cn("w-4 shrink-0 text-right font-mono text-xs", status.className)} title={status.label}>
									{status.shortLabel}
								</span>
							) : null}
						</button>
					);
				})}
			</div>
		</div>
	);
}
