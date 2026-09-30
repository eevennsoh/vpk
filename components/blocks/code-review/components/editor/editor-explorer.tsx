"use client";

import { useState } from "react";

import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchIcon } from "@/components/ui/vpk-icons";
import { FileTree2 } from "@/components/ui-custom/file-tree-2";
import { cn } from "@/lib/utils";

import type { ChangedFile } from "@/components/blocks/code-review/data/types";
import { createCodeReviewTreeData } from "@/components/blocks/code-review/lib/create-code-review-tree-data";

/** Single path segment — matches `CODE_REVIEW_WORK_ITEM.repoName` without the org prefix. */
const CODE_REVIEW_ROOT_PATH = "rfp-response-platform";

interface EditorExplorerProps {
	className?: string;
	expandContent?: boolean;
	explorerRootLabel?: string;
	files: readonly ChangedFile[];
	id?: string;
	/** Opt into the full VS Code explorer fixture. Review surfaces leave this off. */
	includeDemoTree?: boolean;
	selectedFileId: string;
	showSearch?: boolean;
	onFileSelect: (fileId: string) => void;
}

export function EditorExplorer({
	className,
	expandContent = false,
	explorerRootLabel = CODE_REVIEW_ROOT_PATH,
	files,
	id,
	includeDemoTree = false,
	selectedFileId,
	showSearch = true,
	onFileSelect,
}: Readonly<EditorExplorerProps>) {
	const [searchQuery, setSearchQuery] = useState("");
	const { fileIdsByPath, items, pathsByFileId } = createCodeReviewTreeData(
		files,
		explorerRootLabel,
		includeDemoTree,
	);
	const defaultExpandedPaths = items
		.filter((item) => item.type === "folder")
		.map((item) => item.path);
	const handleSelect = (path: string) => {
		const fileId = fileIdsByPath.get(path);
		if (fileId) {
			onFileSelect(fileId);
		}
	};
	const ContentContainer = expandContent ? "div" : ScrollArea;

	return (
		<aside className={cn("flex min-h-0 flex-col border-r border-border bg-surface-raised", className)} id={id}>
			<ContentContainer
				className={cn(
					"px-1",
					expandContent
						? undefined
						: "min-h-0 flex-1 [&_[data-slot=scroll-area-scrollbar]]:opacity-0 [&_[data-slot=scroll-area-scrollbar]]:transition-opacity hover:[&_[data-slot=scroll-area-scrollbar]]:opacity-100 focus-within:[&_[data-slot=scroll-area-scrollbar]]:opacity-100",
					showSearch ? "pt-3" : undefined,
				)}
			>
				{showSearch ? (
					<div className="px-2 pb-1">
						<InputGroup>
							<InputGroupAddon align="inline-start">
								<SearchIcon label="" />
							</InputGroupAddon>
							<InputGroupInput
								aria-label="Search"
								onChange={(event) => setSearchQuery(event.currentTarget.value)}
								placeholder="Search"
								value={searchQuery}
							/>
						</InputGroup>
					</div>
				) : null}
				{/* Search filters within the changed-files item set (Trees hide-non-matches). */}
				<FileTree2
					aria-label="Code review files"
					className="rounded-none border-0 bg-transparent text-xs [&_[role=tree]]:max-h-none [&_[role=tree]]:overflow-visible"
					defaultExpandedPaths={defaultExpandedPaths}
					flattenEmptyDirectories
					items={items}
					onSelectedPathChange={handleSelect}
					searchQuery={showSearch ? searchQuery : undefined}
					selectedPath={pathsByFileId.get(selectedFileId)}
				/>
			</ContentContainer>
		</aside>
	);
}
