import type { FileExplorerGitStatus, FileExplorerItem } from "@/components/ui-custom/file-explorer";

import { EXPLORER_TREE } from "../data/explorer-tree";
import type { ChangedFile, ExplorerNode } from "../data/types";

const DEMO_GIT_STATUSES: Readonly<Record<string, FileExplorerGitStatus>> = {
	".browserslistrc": "ignored",
	".gitignore": "deleted",
	"CONTRIBUTING.md": "added",
	"node_modules": "ignored",
	"package.json": "renamed",
	"yarn.lock": "untracked",
};

export interface CodeReviewTreeData {
	fileIdsByPath: ReadonlyMap<string, string>;
	items: readonly FileExplorerItem[];
	pathsByFileId: ReadonlyMap<string, string>;
}

/**
 * Builds a Trees/FileExplorer path-first item list for code review.
 *
 * By default only `files` (changed paths) are included; ancestor folders are
 * synthesized from those paths. Opt into `includeDemoTree` for the full VS Code
 * explorer fixture (unchanged folders, ignored paths, etc.).
 *
 * Search over the resulting FileExplorer items stays within this set.
 */
export function createCodeReviewTreeData(
	files: readonly ChangedFile[],
	rootPath: string,
	includeDemoTree = false,
): CodeReviewTreeData {
	const changedFilesRootPath = `${rootPath}/CHANGED FILES`;
	const itemsByPath = new Map<string, FileExplorerItem>([
		[rootPath, { path: rootPath, type: "folder" }],
	]);
	const fileIdsByPath = new Map<string, string>();
	const pathsByFileId = new Map<string, string>();
	if (includeDemoTree) {
		itemsByPath.set(changedFilesRootPath, { path: changedFilesRootPath, type: "folder" });
	}

	const addExplorerNode = (node: ExplorerNode, parentPath: string) => {
		const path = `${parentPath}/${node.name}`;
		itemsByPath.set(path, {
			disabled: node.kind === "file" && !node.fileId,
			path,
			status: DEMO_GIT_STATUSES[path.slice(rootPath.length + 1)],
			type: node.kind,
		});

		if (node.fileId) {
			fileIdsByPath.set(path, node.fileId);
			pathsByFileId.set(node.fileId, path);
		}
		for (const child of node.children ?? []) {
			addExplorerNode(child, path);
		}
	};

	if (includeDemoTree) {
		for (const node of EXPLORER_TREE.filter((node) => !node.fileId)) {
			addExplorerNode(node, rootPath);
		}
	}

	for (const file of files) {
		const fileName = file.path.split("/").at(-1) ?? file.path;
		const path = file.explorerPath
			? `${rootPath}/${file.explorerPath}`
			: includeDemoTree
				? `${changedFilesRootPath}/${fileName}`
				: `${rootPath}/${file.path}`;
		let parentPath = path.slice(0, path.lastIndexOf("/"));
		while (parentPath && parentPath !== rootPath) {
			if (!itemsByPath.has(parentPath)) {
				itemsByPath.set(parentPath, { path: parentPath, type: "folder" });
			}
			parentPath = parentPath.slice(0, parentPath.lastIndexOf("/"));
		}
		const existingItem = itemsByPath.get(path);
		itemsByPath.set(path, {
			...existingItem,
			disabled: false,
			path,
			status: file.additions > 0 || file.deletions > 0
				? file.status
				: existingItem?.status,
			type: "file",
		});
		fileIdsByPath.set(path, file.id);
		pathsByFileId.set(file.id, path);
	}

	return {
		fileIdsByPath,
		items: [...itemsByPath.values()],
		pathsByFileId,
	};
}
