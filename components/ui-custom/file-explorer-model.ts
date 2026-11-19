export type FileExplorerItemType = "file" | "folder";
export type FileExplorerSearchMode = "collapse-non-matches" | "expand-matches" | "hide-non-matches";

export interface FileExplorerModelItem {
	path: string;
	type?: FileExplorerItemType;
}

export interface FileExplorerNode {
	children: readonly string[];
	depth: number;
	name: string;
	parentPath: string | null;
	path: string;
	type: FileExplorerItemType;
}

export interface FileExplorerVisibleNode extends FileExplorerNode {
	flattenedPaths: readonly string[];
}

export interface FileExplorerModel {
	nodes: ReadonlyMap<string, FileExplorerNode>;
	roots: readonly string[];
}

interface MutableFileExplorerNode extends Omit<FileExplorerNode, "children"> {
	children: string[];
}

const fileExplorerCollator = new Intl.Collator("en-US", {
	numeric: true,
	sensitivity: "base",
});

export function normalizeFileExplorerPath(path: string): string {
	return path.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/gu, "").replace(/\/{2,}/gu, "/");
}

function getParentPath(path: string): string | null {
	const separatorIndex = path.lastIndexOf("/");
	return separatorIndex === -1 ? null : path.slice(0, separatorIndex);
}

function getName(path: string): string {
	return path.slice(path.lastIndexOf("/") + 1);
}

function compareNodes(
	nodes: ReadonlyMap<string, MutableFileExplorerNode>,
	leftPath: string,
	rightPath: string,
): number {
	const left = nodes.get(leftPath);
	const right = nodes.get(rightPath);

	if (left?.type !== right?.type) {
		return left?.type === "folder" ? -1 : 1;
	}

	return fileExplorerCollator.compare(left?.name ?? leftPath, right?.name ?? rightPath);
}

export function createFileExplorerModel(items: readonly FileExplorerModelItem[]): FileExplorerModel {
	const nodes = new Map<string, MutableFileExplorerNode>();

	const ensureNode = (path: string, type: FileExplorerItemType): MutableFileExplorerNode => {
		const existing = nodes.get(path);
		if (existing) {
			if (type === "folder") {
				existing.type = "folder";
			}
			return existing;
		}

		const parentPath = getParentPath(path);
		const node: MutableFileExplorerNode = {
			children: [],
			depth: path.split("/").length - 1,
			name: getName(path),
			parentPath,
			path,
			type,
		};
		nodes.set(path, node);
		return node;
	};

	for (const item of items) {
		const path = normalizeFileExplorerPath(item.path);
		if (!path) {
			continue;
		}

		ensureNode(path, item.type ?? (item.path.trim().endsWith("/") ? "folder" : "file"));

		let parentPath = getParentPath(path);
		while (parentPath) {
			ensureNode(parentPath, "folder");
			parentPath = getParentPath(parentPath);
		}
	}

	for (const node of nodes.values()) {
		if (!node.parentPath) {
			continue;
		}
		const parent = nodes.get(node.parentPath);
		if (parent && !parent.children.includes(node.path)) {
			parent.children.push(node.path);
		}
	}

	for (const node of nodes.values()) {
		node.children.sort((left, right) => compareNodes(nodes, left, right));
	}

	const roots = [...nodes.values()]
		.filter((node) => node.parentPath === null)
		.map((node) => node.path)
		.sort((left, right) => compareNodes(nodes, left, right));

	return { nodes, roots };
}

export function getFileExplorerMovePath(
	model: FileExplorerModel,
	sourcePath: string,
	destinationPath: string | null,
): string | null {
	const source = normalizeFileExplorerPath(sourcePath);
	const destination = destinationPath ? normalizeFileExplorerPath(destinationPath) : null;
	if (!model.nodes.has(source)) {
		return null;
	}
	if (destination && model.nodes.get(destination)?.type !== "folder") {
		return null;
	}
	if (destination === source || destination?.startsWith(`${source}/`)) {
		return null;
	}

	const sourceName = source.slice(source.lastIndexOf("/") + 1);
	const nextPath = destination ? `${destination}/${sourceName}` : sourceName;
	if (nextPath === source || model.nodes.has(nextPath)) {
		return null;
	}

	return nextPath;
}

export function getVisibleFileExplorerNodes(
	model: FileExplorerModel,
	expandedPaths: ReadonlySet<string>,
	query = "",
	flattenEmptyDirectories = false,
	searchMode: FileExplorerSearchMode = "hide-non-matches",
): readonly FileExplorerVisibleNode[] {
	const normalizedQuery = query.trim().toLocaleLowerCase("en-US");
	const matches = new Map<string, boolean>();

	const subtreeMatches = (path: string): boolean => {
		const node = model.nodes.get(path);
		if (!node) {
			return false;
		}
		const matchesSelf = node.name.toLocaleLowerCase("en-US").includes(normalizedQuery);
		const matchesChild = node.children.some((childPath) => subtreeMatches(childPath));
		const result = matchesSelf || matchesChild;
		matches.set(path, result);
		return result;
	};

	if (normalizedQuery) {
		for (const rootPath of model.roots) {
			subtreeMatches(rootPath);
		}
	}

	const getFlattenedPaths = (path: string): readonly string[] => {
		const paths = [path];
		let node = model.nodes.get(path);

		while (node?.type === "folder" && node.children.length === 1) {
			const child = model.nodes.get(node.children[0]);
			if (child?.type !== "folder") {
				break;
			}
			paths.push(child.path);
			node = child;
		}

		return paths;
	};

	const visibleNodes: FileExplorerVisibleNode[] = [];
	const visit = (path: string, depth: number, parentPath: string | null) => {
		const node = model.nodes.get(path);
		if (!node || (normalizedQuery && searchMode === "hide-non-matches" && !matches.get(path))) {
			return;
		}

		const flattenedPaths = flattenEmptyDirectories ? getFlattenedPaths(path) : [path];
		const terminalNode = model.nodes.get(flattenedPaths.at(-1) ?? path) ?? node;
		const rowHasMatch = flattenedPaths.some((flattenedPath) => matches.get(flattenedPath));
		visibleNodes.push({
			...terminalNode,
			depth,
			flattenedPaths,
			name: flattenedPaths.map((flattenedPath) => model.nodes.get(flattenedPath)?.name).filter(Boolean).join(" / "),
			parentPath,
		});
		const isExpanded = !normalizedQuery
			? expandedPaths.has(terminalNode.path)
			: searchMode === "collapse-non-matches"
				? rowHasMatch
				: searchMode === "expand-matches"
					? rowHasMatch || expandedPaths.has(terminalNode.path)
					: true;
		if (terminalNode.type === "folder" && isExpanded) {
			for (const childPath of terminalNode.children) {
				visit(childPath, depth + 1, terminalNode.path);
			}
		}
	};

	for (const rootPath of model.roots) {
		visit(rootPath, 0, null);
	}

	return visibleNodes;
}
