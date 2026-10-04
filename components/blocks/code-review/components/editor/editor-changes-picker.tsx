"use client";

import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

import type { ChangedFile, CodeReviewCommit } from "@/components/blocks/code-review/data/types";
import {
	canApplyChangesScope,
	filterChangedFilesByScope,
	isFixedChangesScope,
	type ChangesScope,
	type FixedChangesScope,
} from "@/components/blocks/code-review/lib/filter-changed-files-by-scope";
import { sumChangedFileDiffStats } from "@/components/blocks/code-review/lib/sum-changed-file-diff-stats";
import { DiffStats } from "../diff-stats";

const CHANGES_SCOPE_LABELS: Record<FixedChangesScope, string> = {
	"all-changes": "All changes",
	uncommitted: "Uncommitted",
	staged: "Staged",
	unstaged: "Unstaged",
	"all-commits": "All commits",
};

const EMPTY_COMMITS = [] as const satisfies readonly CodeReviewCommit[];

function resolveScopeLabel(
	scope: ChangesScope,
	commits: readonly CodeReviewCommit[],
): string {
	if (isFixedChangesScope(scope)) {
		return CHANGES_SCOPE_LABELS[scope];
	}
	const commitId = scope.slice("commit:".length);
	const commit = commits.find((entry) => entry.id === commitId);
	return commit?.shortSha ?? CHANGES_SCOPE_LABELS["all-commits"];
}

function ScopeMenuLabel({
	label,
	additions,
	deletions,
	emphasized,
}: Readonly<{
	label: string;
	additions?: number;
	deletions?: number;
	emphasized?: boolean;
}>) {
	const hasStats = additions !== undefined && deletions !== undefined
		&& (additions > 0 || deletions > 0);

	return (
		<span className="flex min-w-0 items-center gap-2">
			<span className="truncate">{label}</span>
			{hasStats ? (
				<DiffStats
					additions={additions}
					deletions={deletions}
					emphasized={emphasized}
				/>
			) : null}
		</span>
	);
}

interface EditorChangesPickerProps {
	files: readonly ChangedFile[];
	commits?: readonly CodeReviewCommit[];
	scope: ChangesScope;
	onScopeChange: (scope: ChangesScope) => void;
	className?: string;
}

export function EditorChangesPicker({
	files,
	commits = EMPTY_COMMITS,
	scope,
	onScopeChange,
	className,
}: Readonly<EditorChangesPickerProps>) {
	const visibleFiles = filterChangedFilesByScope(files, commits, scope);
	const { additions, deletions } = sumChangedFileDiffStats(visibleFiles);
	const fileCount = visibleFiles.length;
	const fileCountLabel = `${fileCount} ${fileCount === 1 ? "file" : "files"}`;
	const scopeLabel = resolveScopeLabel(scope, commits);
	const allStats = sumChangedFileDiffStats(files);

	const selectScope = (next: ChangesScope) => {
		if (!canApplyChangesScope(next, commits)) return;
		onScopeChange(next);
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				aria-label={`${scopeLabel}, ${fileCountLabel}, +${additions} −${deletions}`}
				data-code-review-changes-picker
				render={
					<Button
						className={cn(
							// Idle ghost uses text-text-subtle; keep body text at text-text.
							// Selected chrome (incl. border-border-selected) comes from Button —
							// both toolbar buttons already paint a transparent border when idle,
							// so expanding this trigger doesn’t change the gap-1 footprint.
							"text-text",
							className,
						)}
						size="compact"
						type="button"
						variant="ghost"
					/>
				}
			>
				<span>{scopeLabel}</span>
				<span className="font-normal text-text-subtle group-aria-expanded/button:text-text-selected group-aria-pressed/button:text-text-selected">
					{fileCountLabel}
				</span>
				<DiffStats additions={additions} deletions={deletions} emphasized />
				<Icon
					aria-hidden
					className="text-icon-subtle group-aria-expanded/button:text-icon-selected group-aria-pressed/button:text-icon-selected"
					render={<ChevronDownIcon label="" size="small" />}
				/>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="min-w-56">
				<DropdownMenuGroup>
					<DropdownMenuItem
						onSelect={() => selectScope("all-changes")}
						selected={scope === "all-changes"}
					>
						<ScopeMenuLabel
							additions={allStats.additions}
							deletions={allStats.deletions}
							emphasized={scope === "all-changes"}
							label={CHANGES_SCOPE_LABELS["all-changes"]}
						/>
					</DropdownMenuItem>
					<DropdownMenuItem
						disabled={!canApplyChangesScope("uncommitted", commits)}
						onSelect={() => selectScope("uncommitted")}
						selected={scope === "uncommitted"}
					>
						<ScopeMenuLabel
							additions={allStats.additions}
							deletions={allStats.deletions}
							emphasized={scope === "uncommitted"}
							label={CHANGES_SCOPE_LABELS.uncommitted}
						/>
					</DropdownMenuItem>
					<DropdownMenuItem
						disabled={!canApplyChangesScope("staged", commits)}
						onSelect={() => selectScope("staged")}
						selected={scope === "staged"}
					>
						{CHANGES_SCOPE_LABELS.staged}
					</DropdownMenuItem>
					<DropdownMenuItem
						disabled={!canApplyChangesScope("unstaged", commits)}
						onSelect={() => selectScope("unstaged")}
						selected={scope === "unstaged"}
					>
						<ScopeMenuLabel
							additions={allStats.additions}
							deletions={allStats.deletions}
							emphasized={scope === "unstaged"}
							label={CHANGES_SCOPE_LABELS.unstaged}
						/>
					</DropdownMenuItem>
					<DropdownMenuSub>
						<DropdownMenuSubTrigger>Commits</DropdownMenuSubTrigger>
						<DropdownMenuSubContent className="min-w-56 max-w-80">
							{commits.map((commit) => {
								const commitScope = `commit:${commit.id}` as const;
								const commitFiles = filterChangedFilesByScope(files, commits, commitScope);
								const commitStats = canApplyChangesScope(commitScope, commits)
									? sumChangedFileDiffStats(commitFiles)
									: { additions: commit.additions, deletions: commit.deletions };
								return (
									<DropdownMenuItem
										disabled={!canApplyChangesScope(commitScope, commits)}
										key={commit.id}
										onSelect={() => selectScope(commitScope)}
										selected={scope === commitScope}
									>
										<ScopeMenuLabel
											additions={commitStats.additions}
											deletions={commitStats.deletions}
											emphasized={scope === commitScope}
											label={`${commit.title} · ${commit.shortSha}`}
										/>
									</DropdownMenuItem>
								);
							})}
							{commits.length > 0 ? <DropdownMenuSeparator /> : null}
							<DropdownMenuItem
								disabled={!canApplyChangesScope("all-commits", commits)}
								onSelect={() => selectScope("all-commits")}
								selected={scope === "all-commits"}
							>
								{CHANGES_SCOPE_LABELS["all-commits"]}
							</DropdownMenuItem>
						</DropdownMenuSubContent>
					</DropdownMenuSub>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
