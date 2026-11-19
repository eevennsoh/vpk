"use client";

import {
	Children,
	createContext,
	isValidElement,
	use,
	useCallback,
	useId,
	useMemo,
	useState,
	type HTMLAttributes,
	type KeyboardEvent,
	type ReactNode,
} from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	ChevronRightIcon,
	FileIcon,
	FolderIcon,
	FolderOpenIcon,
} from "@/components/ui/vpk-icons";
import { cn } from "@/lib/utils";

interface FileTreeContextType {
	expandedPaths: Set<string>;
	togglePath: (path: string) => void;
	selectedPath?: string;
	onSelect?: (path: string) => void;
	onItemKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

// Default noop for context default value
// oxlint-disable-next-line eslint(no-empty-function)
const noop = () => {};

const FileTreeContext = createContext<FileTreeContextType>({
	// oxlint-disable-next-line eslint-plugin-unicorn(no-new-builtin)
	expandedPaths: new Set(),
	onItemKeyDown: noop,
	togglePath: noop,
});

/** Nesting depth of the rows rendered here, exposed as `aria-level`. */
const FileTreeLevelContext = createContext(1);

const TREE_ITEM_SELECTOR = '[role="treeitem"]';

/** Treeitems that are not inside a collapsed (hidden) folder, in document order. */
function getVisibleTreeItems(tree: HTMLElement): HTMLElement[] {
	return Array.from(tree.querySelectorAll<HTMLElement>(TREE_ITEM_SELECTOR)).filter(
		(item) => item.closest("[hidden]") === null
	);
}

function getTreeItemLevel(item: HTMLElement): number {
	return Number(item.getAttribute("aria-level") ?? 1);
}

/**
 * Rows are ghost Buttons. They inherit the tree's font size and default text
 * color, and let each icon keep its own color instead of the ghost variant's
 * blanket `[&_svg]` color.
 */
const rowClassName =
	"w-full min-w-0 justify-start px-2 text-left text-[length:inherit] font-normal text-text [&_svg]:text-inherit";

const selectedRowClassName =
	"bg-bg-selected text-text-selected hover:bg-bg-selected-hovered active:bg-bg-selected-pressed";

/** An open folder is not a selection: undo the Button's shared `aria-expanded` selected state. */
const expandedFolderRowClassName =
	"aria-expanded:border-transparent aria-expanded:bg-transparent aria-expanded:text-text aria-expanded:hover:bg-bg-neutral-subtle-hovered aria-expanded:active:bg-bg-neutral-subtle-pressed aria-expanded:[&_svg]:text-inherit aria-expanded:[&_[data-slot=icon]]:text-icon-subtle";

export type FileTreeProps = Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> & {
	expanded?: Set<string>;
	defaultExpanded?: Set<string>;
	selectedPath?: string;
	onSelect?: (path: string) => void;
	onExpandedChange?: (expanded: Set<string>) => void;
};

export function FileTree({
	expanded: controlledExpanded,
	defaultExpanded = new Set(),
	selectedPath,
	onSelect,
	onExpandedChange,
	className,
	children,
	...props
}: Readonly<FileTreeProps>) {
	const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
	const expandedPaths = controlledExpanded ?? internalExpanded;

	const togglePath = useCallback(
		(path: string) => {
			const newExpanded = new Set(expandedPaths);
			if (newExpanded.has(path)) {
				newExpanded.delete(path);
			} else {
				newExpanded.add(path);
			}
			setInternalExpanded(newExpanded);
			onExpandedChange?.(newExpanded);
		},
		[expandedPaths, onExpandedChange]
	);

	// Tree keyboard model: Up/Down/Home/End move between visible rows, Right
	// opens a folder or enters it, Left closes a folder or returns to its parent.
	// Enter/Space activate the focused row natively (it is a button). Each row
	// handles its own keys so focus and handler stay on the same element.
	const handleItemKeyDown = useCallback(
		(event: KeyboardEvent<HTMLElement>) => {
			const item = event.currentTarget;
			const tree = item.closest<HTMLElement>('[role="tree"]');
			if (event.defaultPrevented || tree === null) {
				return;
			}
			const items = getVisibleTreeItems(tree);
			const index = items.indexOf(item);
			const level = getTreeItemLevel(item);
			const expandedState = item.getAttribute("aria-expanded");
			const path = item.dataset.path;
			let next: HTMLElement | undefined;

			switch (event.key) {
				case "ArrowDown":
					next = items[index + 1];
					break;
				case "ArrowUp":
					next = items[index - 1];
					break;
				case "Home":
					next = items[0];
					break;
				case "End":
					next = items.at(-1);
					break;
				case "ArrowRight":
					if (expandedState === "false" && path) {
						togglePath(path);
					} else if (expandedState === "true") {
						const child = items[index + 1];
						next = child && getTreeItemLevel(child) > level ? child : undefined;
					}
					break;
				case "ArrowLeft":
					if (expandedState === "true" && path) {
						togglePath(path);
					} else {
						next = items.slice(0, index).findLast((candidate) => getTreeItemLevel(candidate) < level);
					}
					break;
				default:
					return;
			}

			event.preventDefault();
			next?.focus();
		},
		[togglePath]
	);

	const contextValue = useMemo(
		() => ({ expandedPaths, onItemKeyDown: handleItemKeyDown, onSelect, selectedPath, togglePath }),
		[expandedPaths, handleItemKeyDown, onSelect, selectedPath, togglePath]
	);

	return (
		<FileTreeContext value={contextValue}>
			<div
				className={cn("flex flex-col text-sm", className)}
				role="tree"
				{...props}
			>
				{children}
			</div>
		</FileTreeContext>
	);
}

interface FileTreeFolderContextType {
	path: string;
	name: string;
	isExpanded: boolean;
}

const FileTreeFolderContext = createContext<FileTreeFolderContextType>({
	isExpanded: false,
	name: "",
	path: "",
});

export type FileTreeFolderProps = HTMLAttributes<HTMLDivElement> & {
	path: string;
	name: string;
};

export function FileTreeFolder({
	path,
	name,
	className,
	children,
	...props
}: Readonly<FileTreeFolderProps>) {
	const { expandedPaths, togglePath, selectedPath, onSelect, onItemKeyDown } =
		use(FileTreeContext);
	const level = use(FileTreeLevelContext);
	const isExpanded = expandedPaths.has(path);
	// The child group renders beside the folder's treeitem (Collapsible owns
	// both), so aria-owns ties it to its folder for assistive technology.
	const groupId = useId();
	const isSelected = selectedPath === path;
	const iconClassName = isSelected ? "text-icon-selected" : "text-icon-subtle";

	const handleOpenChange = useCallback(() => {
		togglePath(path);
	}, [togglePath, path]);

	const handleSelect = useCallback(() => {
		onSelect?.(path);
	}, [onSelect, path]);

	const folderContextValue = useMemo(
		() => ({ isExpanded, name, path }),
		[isExpanded, name, path]
	);

	return (
		<FileTreeFolderContext value={folderContextValue}>
			<Collapsible
				className={cn("flex flex-col", className)}
				onOpenChange={handleOpenChange}
				open={isExpanded}
				{...props}
			>
				<CollapsibleTrigger
					aria-level={level}
					aria-owns={isExpanded ? groupId : undefined}
					aria-selected={isSelected}
					data-path={path}
					onClick={handleSelect}
					onKeyDown={onItemKeyDown}
					render={
						<Button
							className={cn(
								rowClassName,
								isSelected ? selectedRowClassName : expandedFolderRowClassName
							)}
							size="default"
							variant="ghost"
						/>
					}
					role="treeitem"
				>
					<ChevronRightIcon
						className={cn("transition-transform", iconClassName, isExpanded && "rotate-90")}
						size="small"
					/>
					<FileTreeIcon>
						{isExpanded ? (
							<FolderOpenIcon className={iconClassName} size="small" />
						) : (
							<FolderIcon className={iconClassName} size="small" />
						)}
					</FileTreeIcon>
					<FileTreeName>{name}</FileTreeName>
				</CollapsibleTrigger>
				<CollapsibleContent id={groupId} role="group">
					<div className="ml-4 flex flex-col">
						<FileTreeLevelContext value={level + 1}>{children}</FileTreeLevelContext>
					</div>
				</CollapsibleContent>
			</Collapsible>
		</FileTreeFolderContext>
	);
}

interface FileTreeFileContextType {
	path: string;
	name: string;
}

const FileTreeFileContext = createContext<FileTreeFileContextType>({
	name: "",
	path: "",
});

export type FileTreeFileProps = HTMLAttributes<HTMLDivElement> & {
	path: string;
	name: string;
	icon?: ReactNode;
};

/** Split custom row content so a row with FileTreeActions renders as a treeitem holding them, not as a Button. */
function splitFileTreeActions(children: ReactNode) {
	const content: ReactNode[] = [];
	const actions: ReactNode[] = [];
	for (const child of Children.toArray(children)) {
		if (isValidElement(child) && child.type === FileTreeActions) {
			actions.push(child);
		} else {
			content.push(child);
		}
	}
	return { actions, content };
}

export function FileTreeFile({
	path,
	name,
	icon,
	className,
	children,
	...props
}: Readonly<FileTreeFileProps>) {
	const { selectedPath, onSelect, onItemKeyDown } = use(FileTreeContext);
	const level = use(FileTreeLevelContext);
	const isSelected = selectedPath === path;
	const hasCustomContent = children != null;
	const { actions, content } = useMemo(() => splitFileTreeActions(children), [children]);

	const handleClick = useCallback(() => {
		onSelect?.(path);
	}, [onSelect, path]);

	const fileContextValue = useMemo(() => ({ name, path }), [name, path]);

	if (actions.length > 0) {
		// A tree may only own treeitems (axe treats role="group" as transparent),
		// so a row with actions is itself the treeitem and holds its buttons.
		const handleRowKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
			if ((event.key === "Enter" || event.key === " ") && event.target === event.currentTarget) {
				event.preventDefault();
				onSelect?.(path);
				return;
			}
			onItemKeyDown(event);
		};

		return (
			<FileTreeFileContext value={fileContextValue}>
				<div
					aria-label={name}
					aria-level={level}
					aria-selected={isSelected}
					className={cn(
						buttonVariants({ size: "default", variant: "ghost" }),
						rowClassName,
						"cursor-default",
						isSelected && selectedRowClassName,
						className
					)}
					data-path={path}
					onClick={handleClick}
					onKeyDown={handleRowKeyDown}
					role="treeitem"
					tabIndex={0}
					{...props}
				>
					{content}
					{actions}
				</div>
			</FileTreeFileContext>
		);
	}

	return (
		<FileTreeFileContext value={fileContextValue}>
			<div className={cn("flex min-w-0 items-center gap-1", className)} {...props}>
				<Button
					aria-level={level}
					aria-selected={isSelected}
					className={cn(
						rowClassName,
						"flex-1",
						isSelected && selectedRowClassName
					)}
					data-path={path}
					onClick={handleClick}
					onKeyDown={onItemKeyDown}
					role="treeitem"
					size="default"
					variant="ghost"
				>
					{hasCustomContent ? content : (
						<>
							<FileTreeIcon>
								{icon ?? (
									<FileIcon
										className={isSelected ? "text-icon-selected" : "text-icon-subtle"}
										size="small"
									/>
								)}
							</FileTreeIcon>
							<FileTreeName>{name}</FileTreeName>
						</>
					)}
				</Button>
				{actions}
			</div>
		</FileTreeFileContext>
	);
}

export type FileTreeIconProps = HTMLAttributes<HTMLSpanElement>;

export function FileTreeIcon({
	className,
	children,
	...props
}: Readonly<FileTreeIconProps>) {
	return (
		<span
			className={cn(
				"inline-flex size-4 shrink-0 items-center justify-center leading-none [&_img]:size-4 [&_svg]:size-4",
				className
			)}
			{...props}
		>
			{children}
		</span>
	);
}

export type FileTreeNameProps = HTMLAttributes<HTMLSpanElement>;

export function FileTreeName({
	className,
	children,
	...props
}: Readonly<FileTreeNameProps>) {
	return (
		<span className={cn("truncate", className)} {...props}>
			{children}
		</span>
	);
}

export type FileTreeActionsProps = HTMLAttributes<HTMLDivElement>;

const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

export function FileTreeActions({
	className,
	children,
	...props
}: Readonly<FileTreeActionsProps>) {
	return (
		<div
			className={cn("ml-auto flex items-center gap-1", className)}
			onClick={stopPropagation}
			onKeyDown={stopPropagation}
			role="group"
			{...props}
		>
			{children}
		</div>
	);
}
