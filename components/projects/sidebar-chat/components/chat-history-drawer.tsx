"use client";

// oxlint-disable react-doctor/no-derived-state -- These components maintain local derived display state for controlled animations, measurements, or draft editing that cannot be represented as render-only values without changing UX.

// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- These components intentionally use slot/render-node props for icons, triggers, and adornments.

import { useReducer, useState, type ReactElement, type ReactNode } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import AddIcon from "@atlaskit/icon/core/add";
import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import CheckCircleIcon from "@atlaskit/icon/core/check-circle";
import CrossIcon from "@atlaskit/icon/core/cross";
import DeleteIcon from "@atlaskit/icon/core/delete";
import EditIcon from "@atlaskit/icon/core/edit";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import FolderAddIcon from "@atlaskit/icon-lab/core/folder-add";
import HistoryIcon from "@atlaskit/icon-lab/core/history";
import SortOptionsIcon from "@atlaskit/icon-lab/core/sort-options";
import { useRovoChat } from "@/app/contexts";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";
import { Icon } from "@/components/ui/icon";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { SidebarNavItem, SidebarNavItemAction, SidebarNavItemCount } from "@/components/ui-custom/sidebar-nav-item";
import { Spinner } from "@/components/ui/spinner";
import { ChevronDownIcon } from "@/components/ui/vpk-icons";
import { shouldShowRovoAppSidebarRunIndicator } from "@/components/projects/rovo-core/lib/rovo-app-sidebar-run-indicator";
import type { RovoAppThread } from "@/lib/rovo-app-types";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

const DRAWER_ID = "rovo-chat-history-drawer";
const CHATS_REGION_ID = "rovo-chat-history-chats-list";

interface ChatHistoryDrawerProps {
	active?: boolean;
}

type MaybePromise<T> = T | Promise<T>;

export type ChatHistorySortMode = "priority" | "last-updated" | "manual";

export interface ChatHistoryThreadPresentation {
	description?: ReactNode;
	meta?: ReactNode;
	title?: ReactNode;
}

export interface ControlledChatHistoryDrawerProps {
	active?: boolean;
	activeThreadId: string | null;
	cancelThreadRun: (threadId: string) => Promise<void>;
	closeHistory: () => void;
	deleteThread: (threadId: string) => Promise<void>;
	getThreadActions?: (thread: RovoAppThread) => ReactNode;
	getThreadPresentation?: (thread: RovoAppThread) => ChatHistoryThreadPresentation | undefined;
	isHistoryOpen: boolean;
	onNewChat: () => MaybePromise<void>;
	onSortModeChange?: (mode: ChatHistorySortMode) => void;
	pinnedThreadIds?: ReadonlySet<string>;
	selectThread: (threadId: string) => Promise<void>;
	sortMode?: ChatHistorySortMode;
	threads: ReadonlyArray<RovoAppThread>;
	threadsLoaded: boolean;
}

export interface ControlledChatHistoryPanelProps {
	activeThreadId: string | null;
	cancelThreadRun: (threadId: string) => Promise<void>;
	className?: string;
	deleteThread: (threadId: string) => Promise<void>;
	getThreadActions?: (thread: RovoAppThread) => ReactNode;
	getThreadPresentation?: (thread: RovoAppThread) => ChatHistoryThreadPresentation | undefined;
	onNewChat: () => MaybePromise<void>;
	onSortModeChange?: (mode: ChatHistorySortMode) => void;
	pinnedThreadIds?: ReadonlySet<string>;
	selectThread: (threadId: string) => Promise<void>;
	showNavigation?: boolean;
	sortMode?: ChatHistorySortMode;
	threads: ReadonlyArray<RovoAppThread>;
	threadsLoaded: boolean;
}

function HoverAddAction({ label, onClick }: Readonly<{ label: string; onClick?: () => void }>) {
	return (
		<SidebarNavItemAction
			aria-label={label}
			onClick={onClick}
			className="opacity-0 transition-opacity duration-fast ease-out group-hover/sidebar-nav-item:!opacity-100 focus-visible:opacity-100"
		>
			<AddIcon label="" />
		</SidebarNavItemAction>
	);
}

function ChatHistorySortAction({
	onSortModeChange,
	sortMode,
}: Readonly<{
	onSortModeChange: (mode: ChatHistorySortMode) => void;
	sortMode: ChatHistorySortMode;
}>) {
	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger
				render={(
					<SidebarNavItemAction
						aria-label="Sort chats"
						className="opacity-0 transition-opacity duration-fast ease-out group-hover/sidebar-nav-item:!opacity-100 focus-visible:opacity-100 data-[popup-open]:opacity-100"
						onClick={(event) => event.stopPropagation()}
					/>
				)}
			>
				<SortOptionsIcon label="" size="small" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-52" side="right" sideOffset={8}>
				<DropdownMenuGroup>
					<DropdownMenuLabel>Sort by</DropdownMenuLabel>
					<DropdownMenuRadioGroup
						value={sortMode}
						onValueChange={(value) => {
							if (value === "priority" || value === "last-updated" || value === "manual") {
								onSortModeChange(value);
							}
						}}
					>
						<DropdownMenuRadioItem value="priority">Priority</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="last-updated">Last updated</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="manual">Manual order</DropdownMenuRadioItem>
					</DropdownMenuRadioGroup>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function ChatHistorySectionHeading({
	chatCount,
	chatsOpen,
	controlsId,
	onCreateFolder,
	onRequestDeleteAll,
	onToggle,
}: Readonly<{
	chatCount: number;
	chatsOpen: boolean;
	controlsId: string;
	onCreateFolder?: () => void;
	onRequestDeleteAll?: () => void;
	onToggle: () => void;
}>) {
	const chatLabel = chatCount === 1 ? "chat" : "chats";

	return (
		<div className="group/section-heading flex h-8 shrink-0 items-center justify-between gap-1 py-px">
			<button
				type="button"
				className="group/section-toggle flex h-full min-w-0 flex-1 items-center justify-start rounded-md px-1.5 text-left text-xs font-semibold leading-4 text-text-subtlest outline-hidden hover:bg-bg-neutral-subtle focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focused"
				aria-expanded={chatsOpen}
				aria-controls={controlsId}
				onClick={onToggle}
			>
				<span className="inline-flex min-w-0 max-w-full items-center gap-1">
					<span className="truncate">Chats</span>
					<span aria-hidden className="inline-flex shrink-0 items-center self-center opacity-0 transition-opacity duration-medium ease-out group-hover/section-toggle:opacity-100 group-focus-visible/section-toggle:opacity-100">
						<ChevronDownIcon className={cn("size-3 text-icon-subtlest transition-transform duration-medium ease-out", chatsOpen ? "rotate-0" : "-rotate-90")} size={12} />
					</span>
				</span>
			</button>
			<div className="flex shrink-0 items-center gap-0.5 pr-1.5">
				{chatCount > 0 ? (
					<button
						type="button"
						aria-label={`Delete all ${chatLabel}`}
						onClick={onRequestDeleteAll}
						className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-icon-subtle opacity-0 outline-none transition-[opacity,background-color] duration-fast ease-out group-hover/section-heading:opacity-100 hover:bg-bg-neutral-subtle-hovered active:bg-bg-neutral-subtle-pressed focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50"
					>
						<DeleteIcon label="" size="small" />
					</button>
				) : null}
				<button
					type="button"
					aria-label="New folder"
					onClick={onCreateFolder}
					className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-icon-subtle outline-none transition-colors duration-fast ease-out hover:bg-bg-neutral-subtle-hovered active:bg-bg-neutral-subtle-pressed focus-visible:ring-3 focus-visible:ring-ring/50"
				>
					<FolderAddIcon label="" size="small" />
				</button>
			</div>
		</div>
	);
}

function ChatHistoryDeleteAllDialog({
	chatCount,
	isDeleting,
	onConfirm,
	onOpenChange,
	open,
}: Readonly<{
	chatCount: number;
	isDeleting: boolean;
	onConfirm: () => Promise<void>;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}>) {
	const chatLabel = chatCount === 1 ? "chat" : "chats";

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{`Delete ${chatCount} ${chatLabel}?`}</AlertDialogTitle>
					<AlertDialogDescription>
						This will permanently delete all your Rovo chats. This action cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						onClick={() => void onConfirm()}
						isLoading={isDeleting}
					>
						Delete all
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

function ChatHistoryThreadRow({
	activeThreadId,
	getThreadActions,
	getThreadPresentation,
	onCancelThreadRun,
	onDeleteThread,
	onSelectThread,
	thread,
}: Readonly<{
	activeThreadId: string | null;
	getThreadActions?: (thread: RovoAppThread) => ReactNode;
	getThreadPresentation?: (thread: RovoAppThread) => ChatHistoryThreadPresentation | undefined;
	onCancelThreadRun: (threadId: string) => Promise<void>;
	onDeleteThread: (threadId: string) => Promise<void>;
	onSelectThread: (threadId: string) => Promise<void>;
	thread: RovoAppThread;
}>) {
	const showRunIndicator = shouldShowRovoAppSidebarRunIndicator(thread.activeRun?.status ?? null);
	const isActive = thread.id === activeThreadId;
	const threadActions = getThreadActions?.(thread);
	const presentation = getThreadPresentation?.(thread);

	return (
		<div
			className={cn(
				"group/chat-history-thread relative rounded-lg",
				isActive ? "bg-bg-selected text-text-selected" : "text-text hover:bg-bg-neutral",
			)}
		>
			<button
				type="button"
				className={cn(
					"grid w-full grid-cols-[minmax(0,1fr)_24px] items-center gap-3 rounded-lg p-1.5 text-left outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focused",
					threadActions && "group-hover/chat-history-thread:grid-cols-[minmax(0,1fr)_52px] group-focus-within/chat-history-thread:grid-cols-[minmax(0,1fr)_52px]",
				)}
				onClick={() => void onSelectThread(thread.id)}
			>
				<span className="min-w-0">
					<span className="block truncate text-sm font-medium leading-5">{presentation?.title ?? thread.title}</span>
					{presentation?.description !== undefined ? (
						<span className="block truncate text-xs leading-4 text-text-subtlest">
							{presentation.description}
						</span>
					) : (
						<span className={cn("block truncate text-xs leading-4", isActive ? "text-text-selected" : "text-text-subtlest")}>
							{formatDistanceToNowStrict(new Date(thread.updatedAt), { addSuffix: true })}
						</span>
					)}
				</span>
				<span className={cn(
					"relative flex size-6 items-center justify-center justify-self-end",
					threadActions && "group-hover/chat-history-thread:hidden group-focus-within/chat-history-thread:hidden",
				)}>
					{presentation?.meta !== undefined ? presentation.meta : showRunIndicator ? (
						<Spinner size="xs" aria-hidden="true" className="shrink-0 text-icon-subtle" />
					) : null}
				</span>
			</button>
			{threadActions ? (
				<div className="pointer-events-none absolute top-1/2 right-1.5 z-10 flex -translate-y-1/2 items-center gap-1 group-hover/chat-history-thread:pointer-events-auto group-focus-within/chat-history-thread:pointer-events-auto">
					{threadActions}
				</div>
			) : (
				<DropdownMenu modal={false}>
					<DropdownMenuTrigger
						render={
							<Button
								aria-label={`More actions for ${thread.title}`}
								className="absolute top-1/2 right-1.5 size-6 -translate-y-1/2 opacity-0 transition-opacity duration-normal ease-out group-hover/chat-history-thread:opacity-100 focus-visible:opacity-100 data-[popup-open]:opacity-100"
								size="icon"
								variant="ghost"
								onClick={(event) => event.stopPropagation()}
							/>
						}
					>
						<ShowMoreHorizontalIcon label="" size="small" />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" positionerClassName="z-[760]">
						<DropdownMenuGroup>
							{showRunIndicator ? (
								<DropdownMenuItem
									elemBefore={<span aria-hidden className="size-3 rounded-xs bg-current" />}
									onSelect={() => void onCancelThreadRun(thread.id)}
								>
									Cancel run
								</DropdownMenuItem>
							) : null}
							<DropdownMenuItem variant="destructive" elemBefore={<DeleteIcon label="" />} onSelect={() => void onDeleteThread(thread.id)}>
								Delete
							</DropdownMenuItem>
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</div>
	);
}

function ChatHistoryPanelView({
	activeThreadId,
	cancelThreadRun,
	className,
	deleteThread,
	getThreadActions,
	getThreadPresentation,
	isChatsOpen,
	onNewChat,
	onRequestDeleteAll,
	onSortModeChange,
	onToggleChats,
	pinnedThreadIds,
	selectThread,
	showNavigation = true,
	sortMode,
	threads,
	threadsLoaded,
}: Readonly<ControlledChatHistoryPanelProps & {
	isChatsOpen: boolean;
	onRequestDeleteAll: () => void;
	onToggleChats: () => void;
}>): ReactElement {
	const handleNewChat = () => {
		void onNewChat();
	};

	const handleSelectThread = async (threadId: string) => {
		await selectThread(threadId);
	};
	const pinnedThreads = pinnedThreadIds
		? threads.filter((thread) => pinnedThreadIds.has(thread.id))
		: [];
	const unpinnedThreads = pinnedThreadIds
		? threads.filter((thread) => !pinnedThreadIds.has(thread.id))
		: threads;
	const renderThread = (thread: RovoAppThread) => (
		<ChatHistoryThreadRow
			key={thread.id}
			activeThreadId={activeThreadId}
			getThreadActions={getThreadActions}
			getThreadPresentation={getThreadPresentation}
			onCancelThreadRun={cancelThreadRun}
			onDeleteThread={deleteThread}
			onSelectThread={handleSelectThread}
			thread={thread}
		/>
	);

	return (
		<div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
			{showNavigation ? (
				<div className="flex shrink-0 flex-col">
					<SidebarNavItem
						label="New chat"
						leading={<EditIcon label="" />}
						leadingSize="medium"
						isSelected
						meta={
							<SidebarNavItemCount className="pointer-events-auto min-w-0 rounded-xs px-1 font-normal text-text hover:bg-bg-neutral active:bg-bg-neutral group-data-[selected=true]/sidebar-nav-item:bg-transparent">
								⌘⇧O
							</SidebarNavItemCount>
						}
						onClick={handleNewChat}
					/>
					<SidebarNavItem
						label="Tasks"
						leading={<CheckCircleIcon label="" />}
						leadingSize="medium"
						actions={<HoverAddAction label="New task" />}
					/>
					<SidebarNavItem
						label="Agents"
						leading={<AiAgentIcon label="" />}
						leadingSize="medium"
						actions={<HoverAddAction label="New agent" />}
					/>
					<SidebarNavItem
						label="Chats"
						leading={<HistoryIcon label="" />}
						leadingSize="medium"
						actions={(
							<>
								{sortMode && onSortModeChange ? (
									<ChatHistorySortAction
										onSortModeChange={onSortModeChange}
										sortMode={sortMode}
									/>
								) : null}
								<HoverAddAction label="New chat" onClick={handleNewChat} />
							</>
						)}
					/>
					<div className="h-3 shrink-0" aria-hidden />
				</div>
			) : null}
			{pinnedThreads.length > 0 ? (
				<section aria-label="Pinned" className="flex shrink-0 flex-col pb-3">
					<div className="px-1.5 py-1 text-xs font-semibold leading-4 text-text-subtlest">
						Pinned
					</div>
					{pinnedThreads.map(renderThread)}
				</section>
			) : null}
			<div className="flex shrink-0 flex-col">
				<ChatHistorySectionHeading
					chatCount={threads.length}
					chatsOpen={isChatsOpen}
					controlsId={CHATS_REGION_ID}
					onRequestDeleteAll={onRequestDeleteAll}
					onToggle={onToggleChats}
				/>
			</div>
			<section
				id={CHATS_REGION_ID}
				aria-label="Chats"
				className={cn(
					"min-h-0 flex-1 overflow-y-auto",
					threadsLoaded && threads.length === 0 && "flex items-center justify-center",
					!isChatsOpen && "hidden",
				)}
			>
				{!threadsLoaded ? (
					<div className="flex h-24 items-center justify-center text-text-subtle">
						<Spinner size="sm" aria-label="Loading chat history" />
					</div>
				) : threads.length === 0 ? (
					<Empty width="narrow" className="gap-4 px-3 py-0">
						<EmptyHeader>
							<EmptyTitle as="h3" style={{ font: token("font.heading.small") }}>No recent chats yet</EmptyTitle>
							<EmptyDescription>
								Start a new chat to see it here.
							</EmptyDescription>
						</EmptyHeader>
						<EmptyContent>
							<Button variant="outline" size="default" onClick={handleNewChat}>
								New chat
							</Button>
						</EmptyContent>
					</Empty>
				) : (
					<div className="flex flex-col">
						{unpinnedThreads.map(renderThread)}
					</div>
				)}
			</section>
		</div>
	);
}

function useChatHistoryPanelState({
	deleteThread,
	threads,
}: Readonly<{
	deleteThread: (threadId: string) => Promise<void>;
	threads: ReadonlyArray<RovoAppThread>;
}>) {
	const [isDeleteAllConfirmOpen, setIsDeleteAllConfirmOpen] = useState(false);
	const [isDeletingAll, setIsDeletingAll] = useState(false);
	const [isChatsOpen, setIsChatsOpen] = useState(true);

	const handleDeleteAllConfirm = async () => {
		if (threads.length === 0) {
			setIsDeleteAllConfirmOpen(false);
			return;
		}
		setIsDeletingAll(true);
		try {
			await Promise.all(threads.map((thread) => deleteThread(thread.id)));
		} finally {
			setIsDeletingAll(false);
			setIsDeleteAllConfirmOpen(false);
		}
	};

	const handleChatsToggle = () => {
		setIsChatsOpen((open) => !open);
	};

	return {
		handleChatsToggle,
		handleDeleteAllConfirm,
		isChatsOpen,
		isDeleteAllConfirmOpen,
		isDeletingAll,
		setIsDeleteAllConfirmOpen,
	};
}

export function ControlledChatHistoryPanel(props: Readonly<ControlledChatHistoryPanelProps>): ReactElement {
	const panelState = useChatHistoryPanelState({
		deleteThread: props.deleteThread,
		threads: props.threads,
	});

	return (
		<>
			<ChatHistoryPanelView
				{...props}
				isChatsOpen={panelState.isChatsOpen}
				onRequestDeleteAll={() => panelState.setIsDeleteAllConfirmOpen(true)}
				onToggleChats={panelState.handleChatsToggle}
			/>
			<ChatHistoryDeleteAllDialog
				chatCount={props.threads.length}
				isDeleting={panelState.isDeletingAll}
				onConfirm={panelState.handleDeleteAllConfirm}
				onOpenChange={panelState.setIsDeleteAllConfirmOpen}
				open={panelState.isDeleteAllConfirmOpen}
			/>
		</>
	);
}

export function ControlledChatHistoryDrawer({
	active = true,
	activeThreadId,
	cancelThreadRun,
	closeHistory,
	deleteThread,
	getThreadActions,
	getThreadPresentation,
	isHistoryOpen,
	onNewChat,
	onSortModeChange,
	pinnedThreadIds,
	selectThread,
	sortMode,
	threads,
	threadsLoaded,
}: Readonly<ControlledChatHistoryDrawerProps>): ReactElement | null {
	const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
	const [shouldRenderSheet, setShouldRenderSheet] = useReducer(
		(_current: boolean, next: boolean) => next,
		isHistoryOpen,
	);
	const panelState = useChatHistoryPanelState({ deleteThread, threads });

	if (active && isHistoryOpen && !shouldRenderSheet) {
		setShouldRenderSheet(true);
	}

	const handleOpenChange = (open: boolean) => {
		if (!open || !active) {
			closeHistory();
		}
	};

	const handleOpenChangeComplete = (open: boolean) => {
		if (!open) {
			setShouldRenderSheet(false);
		}
	};

	const handleNewChat = () => {
		closeHistory();
		void onNewChat();
	};

	const handleSelectThread = async (threadId: string) => {
		closeHistory();
		await selectThread(threadId);
	};

	if (!active || (!isHistoryOpen && !shouldRenderSheet)) {
		return null;
	}

	return (
		<div ref={setPortalContainer} className="absolute inset-0 z-20" data-chat-history-drawer-layer="">
			{portalContainer ? (
				<>
					<Sheet
						open={isHistoryOpen}
						onOpenChange={handleOpenChange}
						onOpenChangeComplete={handleOpenChangeComplete}
					>
						<SheetContent
							id={DRAWER_ID}
							aria-describedby="rovo-chat-history-description"
							aria-labelledby="rovo-chat-history-title"
							className="z-30 !w-80 max-w-[calc(100%_-_40px)] gap-0 overflow-hidden border-r border-border bg-surface-overlay p-0 shadow-xl"
							contained
							overlayClassName="z-20"
							portalContainer={portalContainer}
							side="left"
							showCloseButton={false}
						>
							<SheetHeader className="sr-only">
								<SheetTitle id="rovo-chat-history-title">Chat history</SheetTitle>
								<SheetDescription id="rovo-chat-history-description">
									Recent Rovo threads
								</SheetDescription>
							</SheetHeader>
							<SheetClose
								aria-label="Close history"
								className={cn(
									buttonVariants({ variant: "ghost", size: "icon", shape: "circle" }),
									"absolute top-3 left-3 z-10",
								)}
							>
								<Icon aria-hidden label="" render={<CrossIcon label="" />} />
							</SheetClose>
							<ChatHistoryPanelView
								activeThreadId={activeThreadId}
								cancelThreadRun={cancelThreadRun}
								className="p-3 pt-14"
								deleteThread={deleteThread}
								getThreadActions={getThreadActions}
								getThreadPresentation={getThreadPresentation}
								isChatsOpen={panelState.isChatsOpen}
								onNewChat={handleNewChat}
								onRequestDeleteAll={() => panelState.setIsDeleteAllConfirmOpen(true)}
								onSortModeChange={onSortModeChange}
								onToggleChats={panelState.handleChatsToggle}
								pinnedThreadIds={pinnedThreadIds}
								selectThread={handleSelectThread}
								sortMode={sortMode}
								threads={threads}
								threadsLoaded={threadsLoaded}
							/>
						</SheetContent>
					</Sheet>
					<ChatHistoryDeleteAllDialog
						chatCount={threads.length}
						isDeleting={panelState.isDeletingAll}
						onConfirm={panelState.handleDeleteAllConfirm}
						onOpenChange={panelState.setIsDeleteAllConfirmOpen}
						open={panelState.isDeleteAllConfirmOpen}
					/>
				</>
			) : null}
		</div>
	);
}

export function ChatHistoryDrawer({
	active = true,
}: Readonly<ChatHistoryDrawerProps>): ReactElement | null {
	const {
		activeThreadId,
		cancelThreadRun,
		closeHistory,
		deleteThread,
		isHistoryOpen,
		refreshThreads,
		resetChat,
		selectThread,
		threads,
		threadsLoaded,
	} = useRovoChat();

	const handleNewChat = () => {
		resetChat();
		void refreshThreads();
	};

	return (
		<ControlledChatHistoryDrawer
			active={active}
			activeThreadId={activeThreadId}
			cancelThreadRun={cancelThreadRun}
			closeHistory={closeHistory}
			deleteThread={deleteThread}
			isHistoryOpen={isHistoryOpen}
			onNewChat={handleNewChat}
			selectThread={selectThread}
			threads={threads}
			threadsLoaded={threadsLoaded}
		/>
	);
}
