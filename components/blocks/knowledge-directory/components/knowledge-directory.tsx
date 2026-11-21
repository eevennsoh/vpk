"use client";

// oxlint-disable react-doctor/prefer-tag-over-role -- This file uses ARIA roles for custom generated visuals or composite widgets where the suggested native tag would change semantics or behavior.

import Image from "next/image";
import {
	useMemo,
	useState,
} from "react";
import ArrowLeftIcon from "@atlaskit/icon/core/arrow-left";
import CrossIcon from "@atlaskit/icon/core/cross";
import DeleteIcon from "@atlaskit/icon/core/delete";
import SearchIcon from "@atlaskit/icon/core/search";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { InputGroup, InputGroupSearchAddon, InputGroupInput } from "@/components/ui/input-group";
import { EntityCardKnowledgeCard } from "@/components/ui-custom/entity-card";
import { RichTextMentionVisualMark } from "@/components/ui-custom/rich-text-editor/mention-visual";
import { cn } from "@/lib/utils";

import {
	DEFAULT_KNOWLEDGE_APPS,
	getKnowledgeAppIcon,
	type KnowledgeDirectoryApp,
	type KnowledgeDirectoryContent,
	type KnowledgeDirectoryMode,
} from "@/app/data/directory/knowledge";
import { resolveDirectoryVisual } from "@/app/data/directory/visual";

export type {
	KnowledgeDirectoryApp,
	KnowledgeDirectoryContent,
	KnowledgeDirectoryMode,
} from "@/app/data/directory/knowledge";

export interface KnowledgeDirectoryAddPayload {
	appId: string;
	contentIds: "all" | readonly string[];
	mode: KnowledgeDirectoryMode;
}

export interface KnowledgeDirectoryDialogProps {
	/**
	 * Knowledge apps already contributing knowledge to the agent, as ids. Drives
	 * the persistent "added" check on each browse card so they can be scanned at
	 * a glance.
	 */
	addedAppIds?: readonly string[];
	apps?: readonly KnowledgeDirectoryApp[];
	defaultSelectedAppId?: string | null;
	defaultSelectedContentIds?: readonly string[];
	defaultSelectedMode?: KnowledgeDirectoryMode;
	onAddKnowledge?: (payload: KnowledgeDirectoryAddPayload) => void;
	onBrowseFiles?: () => void;
	onOpenChange: (open: boolean) => void;
	onSelectApp?: (app: KnowledgeDirectoryApp) => void;
	onSelectedAppIdChange?: (appId: string | null) => void;
	onSelectedContentIdsChange?: (contentIds: readonly string[]) => void;
	onSelectMode?: (mode: KnowledgeDirectoryMode) => void;
	open: boolean;
	selectedAppId?: string | null;
	selectedContentIds?: readonly string[];
	selectedMode?: KnowledgeDirectoryMode;
	title?: string;
}

type SortMode = "latest" | "name";

const EMPTY_CONTENT_IDS: readonly string[] = [];

function getContentIds(app: KnowledgeDirectoryApp | null): readonly string[] {
	return app?.contents.map((content) => content.id) ?? EMPTY_CONTENT_IDS;
}

function normalize(value: string): string {
	return value.trim().toLowerCase();
}

function filterApps(
	apps: readonly KnowledgeDirectoryApp[],
	query: string,
	sortMode: SortMode,
): readonly KnowledgeDirectoryApp[] {
	const normalizedQuery = normalize(query);
	const filteredApps = normalizedQuery
		? apps.filter((app) => {
			const haystack = [
				app.name,
				app.description,
				app.providerName,
			].join(" ").toLowerCase();
			return haystack.includes(normalizedQuery);
		})
		: [...apps];

	if (sortMode === "name") {
		return [...filteredApps].sort((first, second) => first.name.localeCompare(second.name));
	}

	return filteredApps;
}

function filterContent(
	contents: readonly KnowledgeDirectoryContent[],
	selectedIds: readonly string[],
	query: string,
): readonly KnowledgeDirectoryContent[] {
	const selectedIdSet = new Set(selectedIds);
	const normalizedQuery = normalize(query);

	return contents.filter((content) => {
		if (!selectedIdSet.has(content.id)) return false;
		if (!normalizedQuery) return true;

		return [content.name, content.description, content.type].join(" ").toLowerCase().includes(normalizedQuery);
	});
}

export function KnowledgeDirectoryDialog({
	addedAppIds,
	apps = DEFAULT_KNOWLEDGE_APPS,
	defaultSelectedAppId = null,
	defaultSelectedContentIds = EMPTY_CONTENT_IDS,
	defaultSelectedMode = "all",
	onAddKnowledge,
	onBrowseFiles,
	onOpenChange,
	onSelectApp,
	onSelectedAppIdChange,
	onSelectedContentIdsChange,
	onSelectMode,
	open,
	selectedAppId,
	selectedContentIds,
	selectedMode,
	title = "Browse knowledge",
}: Readonly<KnowledgeDirectoryDialogProps>) {
	const addedAppIdSet = useMemo(() => new Set(addedAppIds ?? []), [addedAppIds]);
	const [appQuery, setAppQuery] = useState("");
	const [contentQuery, setContentQuery] = useState("");
	const [sortMode, setSortMode] = useState<SortMode>("latest");
	const [uncontrolledAppId, setUncontrolledAppId] = useState<string | null>(defaultSelectedAppId);
	const [uncontrolledMode, setUncontrolledMode] = useState<KnowledgeDirectoryMode>(defaultSelectedMode);
	const [uncontrolledContentIds, setUncontrolledContentIds] = useState<readonly string[]>(defaultSelectedContentIds);
	const isAppControlled = typeof selectedAppId !== "undefined";
	const isModeControlled = typeof selectedMode !== "undefined";
	const isContentControlled = typeof selectedContentIds !== "undefined";
	const resolvedAppId = isAppControlled ? selectedAppId : uncontrolledAppId;
	const resolvedMode = isModeControlled ? selectedMode : uncontrolledMode;
	const resolvedContentIds = isContentControlled ? selectedContentIds : uncontrolledContentIds;
	const selectedApp = useMemo(
		() => apps.find((app) => app.id === resolvedAppId) ?? null,
		[apps, resolvedAppId],
	);
	const filteredApps = useMemo(
		() => filterApps(apps, appQuery, sortMode),
		[apps, appQuery, sortMode],
	);
	const filteredContent = useMemo(
		() => filterContent(selectedApp?.contents ?? [], resolvedContentIds, contentQuery),
		[selectedApp, resolvedContentIds, contentQuery],
	);

	function commitAppId(nextAppId: string | null): void {
		if (!isAppControlled) {
			setUncontrolledAppId(nextAppId);
		}

		onSelectedAppIdChange?.(nextAppId);
	}

	function commitMode(nextMode: KnowledgeDirectoryMode): void {
		if (!isModeControlled) {
			setUncontrolledMode(nextMode);
		}

		onSelectMode?.(nextMode);
	}

	function commitContentIds(nextContentIds: readonly string[]): void {
		if (!isContentControlled) {
			setUncontrolledContentIds(nextContentIds);
		}

		onSelectedContentIdsChange?.(nextContentIds);
	}

	function handleOpenChange(nextOpen: boolean): void {
		if (!nextOpen) {
			commitAppId(null);
			setAppQuery("");
			setContentQuery("");
		}

		onOpenChange(nextOpen);
	}

	function handleSelectApp(app: KnowledgeDirectoryApp): void {
		commitAppId(app.id);
		commitMode("all");
		commitContentIds(getContentIds(app));
		setContentQuery("");
		onSelectApp?.(app);
	}

	function handleBack(): void {
		commitAppId(null);
		setContentQuery("");
	}

	function handleSelectMode(nextMode: KnowledgeDirectoryMode): void {
		commitMode(nextMode);

		if (nextMode === "custom" && selectedApp && resolvedContentIds.length === 0) {
			commitContentIds(getContentIds(selectedApp));
		}
	}

	function handleRemoveContent(contentId: string): void {
		commitContentIds(resolvedContentIds.filter((id) => id !== contentId));
	}

	function handleAdd(): void {
		if (!selectedApp) return;

		onAddKnowledge?.({
			appId: selectedApp.id,
			contentIds: resolvedMode === "all" ? "all" : resolvedContentIds,
			mode: resolvedMode,
		});
		handleOpenChange(false);
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent
				className={cn(
					"max-h-[calc(100svh-2rem)] gap-0 overflow-hidden p-0 shadow-xl",
					selectedApp ? "sm:max-w-[640px]" : "h-[min(768px,calc(100svh-2rem))] sm:max-w-[960px]",
				)}
				showCloseButton={false}
			>
				<KnowledgeDirectoryHeader
					onBack={selectedApp ? handleBack : undefined}
					title={title}
				/>
				{selectedApp ? (
					<AppContentStep
						app={selectedApp}
						contentQuery={contentQuery}
						filteredContent={filteredContent}
						mode={resolvedMode}
						onAdd={handleAdd}
						onCancel={() => handleOpenChange(false)}
						onRemoveContent={handleRemoveContent}
						onSelectMode={handleSelectMode}
						selectedContentCount={resolvedContentIds.length}
						setContentQuery={setContentQuery}
					/>
				) : (
					<BrowseAppsStep
						addedAppIds={addedAppIdSet}
						appQuery={appQuery}
						apps={filteredApps}
						onBrowseFiles={onBrowseFiles}
						onSelectApp={handleSelectApp}
						setAppQuery={setAppQuery}
						setSortMode={setSortMode}
						sortMode={sortMode}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}

interface KnowledgeDirectoryHeaderProps {
	onBack?: () => void;
	title: string;
}

function KnowledgeDirectoryHeader({ onBack, title }: Readonly<KnowledgeDirectoryHeaderProps>) {
	return (
		<div className="flex items-center justify-between px-6 py-6">
			<div className="flex min-w-0 items-center gap-2">
				{onBack ? (
					<Button
						aria-label="Back to knowledge apps"
						className="-ml-2 text-icon-subtle"
						onClick={onBack}
						size="icon"
						type="button"
						variant="ghost"
					>
						<ArrowLeftIcon label="" color="currentColor" />
					</Button>
				) : null}
				<DialogTitle className="truncate text-xl font-semibold leading-6 text-text">
					{title}
				</DialogTitle>
			</div>
			<DialogClose render={<Button aria-label="Close knowledge directory" variant="ghost" size="icon" />}>
				<CrossIcon label="" />
				<span className="sr-only">Close</span>
			</DialogClose>
		</div>
	);
}

interface BrowseAppsStepProps {
	addedAppIds: ReadonlySet<string>;
	appQuery: string;
	apps: readonly KnowledgeDirectoryApp[];
	onBrowseFiles?: () => void;
	onSelectApp: (app: KnowledgeDirectoryApp) => void;
	setAppQuery: (query: string) => void;
	setSortMode: (sortMode: SortMode) => void;
	sortMode: SortMode;
}

function BrowseAppsStep({
	addedAppIds,
	appQuery,
	apps,
	onBrowseFiles,
	onSelectApp,
	setAppQuery,
	setSortMode,
	sortMode,
}: Readonly<BrowseAppsStepProps>) {
	return (
		<div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 pb-6">
			<UploadDropZone onBrowseFiles={onBrowseFiles} />
			<div className="flex flex-col gap-4">
				<SearchField
					ariaLabel="Search knowledge apps"
					onChange={setAppQuery}
					placeholder="Search for an app by name, or describe it"
					value={appQuery}
				/>
				<div className="flex items-center justify-between gap-3">
					<Button
						onClick={() => setSortMode(sortMode === "latest" ? "name" : "latest")}
						type="button"
						variant="outline"
					>
						Sort by {sortMode === "latest" ? "Latest" : "Name"}
					</Button>
					<p className="text-sm text-text-subtlest">Showing {apps.length} results</p>
				</div>
				{apps.length > 0 ? (
					<ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
						{apps.map((app) => (
							<li key={app.id}>
								<EntityCardKnowledgeCard
									added={addedAppIds.has(app.id)}
									description={app.description}
									icon={getKnowledgeAppIcon(app)}
									name={app.name}
									onSelect={() => onSelectApp(app)}
									publisher={app.providerName}
									starCount={app.starCount}
									teammateCount={app.teammateCount}
									verified={app.verified}
								/>
							</li>
						))}
					</ul>
				) : (
					<p className="rounded-md border border-border px-4 py-6 text-sm text-text-subtlest">
						No knowledge apps match &ldquo;{appQuery}&rdquo;.
					</p>
				)}
			</div>
		</div>
	);
}

function UploadDropZone({ onBrowseFiles }: Readonly<{ onBrowseFiles?: () => void }>) {
	return (
		<div
			aria-label="Upload knowledge files"
			className="flex min-h-[120px] items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-surface-sunken px-6 py-5"
			role="group"
		>
			<Image
				alt=""
				className="dark:hidden [[data-color-mode=dark]_&]:hidden"
				height={88}
				src="/illustration-spot/empty-state/upload/light.svg"
				width={88}
			/>
			<Image
				alt=""
				className="hidden dark:block [[data-color-mode=dark]_&]:block"
				height={88}
				src="/illustration-spot/empty-state/upload/dark.svg"
				width={88}
			/>
			<div className="flex flex-col items-start gap-2">
				<Button onClick={onBrowseFiles} type="button" variant="outline">
					<SearchIcon label="" size="small" color="currentColor" />
					Click to browse
				</Button>
				<p className="text-sm text-text">Drag and drop a file here</p>
			</div>
		</div>
	);
}

interface AppContentStepProps {
	app: KnowledgeDirectoryApp;
	contentQuery: string;
	filteredContent: readonly KnowledgeDirectoryContent[];
	mode: KnowledgeDirectoryMode;
	onAdd: () => void;
	onCancel: () => void;
	onRemoveContent: (contentId: string) => void;
	onSelectMode: (mode: KnowledgeDirectoryMode) => void;
	selectedContentCount: number;
	setContentQuery: (query: string) => void;
}

function AppContentStep({
	app,
	contentQuery,
	filteredContent,
	mode,
	onAdd,
	onCancel,
	onRemoveContent,
	onSelectMode,
	selectedContentCount,
	setContentQuery,
}: Readonly<AppContentStepProps>) {
	return (
		<>
			<div className={cn("flex flex-col gap-6 px-6 pb-6", mode === "custom" && "gap-4")}>
				<ContentModeSelector mode={mode} onSelectMode={onSelectMode} />
				{mode === "custom" ? (
					<div className="flex flex-col gap-4">
						<SearchField
							ariaLabel={`Search selected ${app.name} content`}
							onChange={setContentQuery}
							placeholder="Search for content by name, or describe it"
							value={contentQuery}
						/>
						<SelectedContentList
							contents={filteredContent}
							onRemoveContent={onRemoveContent}
							selectedContentCount={selectedContentCount}
						/>
					</div>
				) : null}
			</div>
			<KnowledgeDirectoryFooter onAdd={onAdd} onCancel={onCancel} />
		</>
	);
}

interface ContentModeSelectorProps {
	mode: KnowledgeDirectoryMode;
	onSelectMode: (mode: KnowledgeDirectoryMode) => void;
}

function ContentModeSelector({ mode, onSelectMode }: Readonly<ContentModeSelectorProps>) {
	return (
		<div className="grid grid-cols-2 gap-4">
			<Button
				aria-pressed={mode === "all"}
				onClick={() => onSelectMode("all")}
				type="button"
				variant="outline"
			>
				All content
			</Button>
			<Button
				aria-pressed={mode === "custom"}
				onClick={() => onSelectMode("custom")}
				type="button"
				variant="outline"
			>
				{mode === "custom" ? "Select content" : "Custom content"}
			</Button>
		</div>
	);
}

interface SelectedContentListProps {
	contents: readonly KnowledgeDirectoryContent[];
	onRemoveContent: (contentId: string) => void;
	selectedContentCount: number;
}

function SelectedContentList({
	contents,
	onRemoveContent,
	selectedContentCount,
}: Readonly<SelectedContentListProps>) {
	return (
		<div className="overflow-hidden rounded-xl border border-border">
			{contents.length > 0 ? (
				<ul>
					{contents.map((content, index) => (
						<li
							className={cn("border-border bg-surface", index < contents.length - 1 && "border-b")}
							key={content.id}
						>
							<div className="flex h-14 items-center gap-3 px-3">
								<KnowledgeContentVisual content={content} />
								<span className="min-w-0 flex-1">
									<span className="block truncate text-sm font-medium leading-5 text-text">{content.name}</span>
									<span className="block truncate text-xs leading-4 text-text-subtlest">{content.type}</span>
								</span>
								<Button
									aria-label={`Remove ${content.name}`}
									onClick={() => onRemoveContent(content.id)}
									size="icon"
									type="button"
									variant="ghost"
								>
									<DeleteIcon label="" size="small" color="currentColor" />
								</Button>
							</div>
						</li>
					))}
				</ul>
			) : (
				<p className="px-4 py-6 text-sm text-text-subtlest">
					{selectedContentCount === 0 ? "No custom content selected." : "No selected content matches this search."}
				</p>
			)}
		</div>
	);
}

function KnowledgeContentVisual({ content }: Readonly<{ content: KnowledgeDirectoryContent }>) {
	const visual = resolveDirectoryVisual(content.visual);

	return visual ? (
		<RichTextMentionVisualMark
			label={content.name}
			size="menu"
			visual={visual}
		/>
	) : null;
}

interface SearchFieldProps {
	ariaLabel: string;
	onChange: (query: string) => void;
	placeholder: string;
	value: string;
}

function SearchField({
	ariaLabel,
	onChange,
	placeholder,
	value,
}: Readonly<SearchFieldProps>) {
	return (
		<InputGroup>
			<InputGroupSearchAddon>
				<SearchIcon label="" />
			</InputGroupSearchAddon>
			<InputGroupInput
				aria-label={ariaLabel}
				placeholder={placeholder}
				value={value}
				onChange={(event) => onChange(event.target.value)}
			/>
		</InputGroup>
	);
}

interface KnowledgeDirectoryFooterProps {
	onAdd: () => void;
	onCancel: () => void;
}

function KnowledgeDirectoryFooter({ onAdd, onCancel }: Readonly<KnowledgeDirectoryFooterProps>) {
	return (
		<div className="flex items-center justify-end gap-2 border-t border-border bg-surface-overlay px-6 py-6">
			<Button onClick={onCancel} type="button" variant="ghost">
				Cancel
			</Button>
			<Button onClick={onAdd} type="button">
				Add
			</Button>
		</div>
	);
}
