"use client";

// File-tree and tag-taxonomy parsing for json-render Accordion and FileTree content.
import type { ReactNode } from "react";
import { FileTreeFile as FileTreeFileRoot, FileTreeFolder as FileTreeFolderRoot } from "@/components/ui-custom/file-tree";

export type JsonRenderFileTreeNode = {
	path: string;
	name?: string | null;
	type?: "file" | "folder" | null;
};

type FileTreeRenderNode = {
	path: string;
	name: string;
	type: "file" | "folder";
	children: FileTreeRenderNode[];
};

type FileTreeRenderData = {
	defaultExpandedPaths: string[];
	roots: FileTreeRenderNode[];
};

type MutableFileTreeNode = {
	children: Set<string>;
	name: string;
	path: string;
	type: "file" | "folder";
};

type TagTaxonomyGroup = {
	color: "blue" | "teal" | "orange" | "purple" | "gray";
	label: string;
	tags: string[];
};

const DIRECTORY_TREE_BRANCH_PATTERN = /^((?:│   |    )*)(?:├── |└── )(.+)$/u;
const DIRECTORY_TREE_SECTION_PATTERN = /^(.+\/):$/u;
const FILE_TREE_INLINE_COMMENT_PATTERN = /\s+[←#].*$/u;
const TAG_TAXONOMY_LINE_PATTERN = /^([A-Za-z][A-Za-z /&-]*):\s*(.+)$/u;
const TAG_TAXONOMY_COLOR_MAP: Record<string, TagTaxonomyGroup["color"]> = {
	business: "orange",
	meta: "gray",
	people: "purple",
	platform: "teal",
	products: "blue",
};

function normalizeFileTreePath(value: string): string {
	const normalizedValue = value.trim().replace(/\\/g, "/");
	if (!normalizedValue) {
		return "";
	}

	const collapsedSeparators = normalizedValue.replace(/\/{2,}/g, "/");
	if (collapsedSeparators === "/") {
		return "/";
	}

	return collapsedSeparators.replace(/\/+$/u, "");
}

function getFileTreeParentPath(path: string): string | null {
	const normalizedPath = normalizeFileTreePath(path);
	if (!normalizedPath || normalizedPath === "/" || normalizedPath === "~") {
		return null;
	}

	if (normalizedPath.startsWith("~/")) {
		const segments = normalizedPath.slice(2).split("/").filter(Boolean);
		if (segments.length <= 1) {
			return null;
		}

		return `~/${segments.slice(0, -1).join("/")}`;
	}

	if (normalizedPath.startsWith("/")) {
		const segments = normalizedPath.split("/").filter(Boolean);
		if (segments.length <= 1) {
			return null;
		}

		return `/${segments.slice(0, -1).join("/")}`;
	}

	const segments = normalizedPath.split("/").filter(Boolean);
	if (segments.length <= 1) {
		return null;
	}

	return segments.slice(0, -1).join("/");
}

function getDefaultFileTreeNodeName(path: string): string {
	const parentPath = getFileTreeParentPath(path);
	if (parentPath === null && path.includes("/")) {
		return path;
	}

	return path.split("/").filter(Boolean).at(-1) ?? path;
}

function sanitizeFileTreeLabel(label: string): { name: string; type: "file" | "folder" } | null {
	const withoutInlineComment = label.replace(FILE_TREE_INLINE_COMMENT_PATTERN, "").trim();
	if (!withoutInlineComment) {
		return null;
	}

	const isFolder = withoutInlineComment.endsWith("/");
	const normalizedName = isFolder
		? withoutInlineComment.slice(0, -1).trim()
		: withoutInlineComment;
	if (!normalizedName) {
		return null;
	}

	return {
		name: normalizedName,
		type: isFolder ? "folder" : "file",
	};
}

function compareFileTreeNodes(a: MutableFileTreeNode, b: MutableFileTreeNode): number {
	if (a.type !== b.type) {
		return a.type === "folder" ? -1 : 1;
	}

	return a.name.localeCompare(b.name, undefined, {
		numeric: true,
		sensitivity: "base",
	});
}

function upsertFileTreeNode(
	nodeMap: Map<string, MutableFileTreeNode>,
	{
		name,
		path,
		type,
	}: Readonly<{
		name?: string | null;
		path: string;
		type: "file" | "folder";
	}>,
): MutableFileTreeNode {
	const existingNode = nodeMap.get(path);
	if (existingNode) {
		if (type === "folder") {
			existingNode.type = "folder";
		}
		if (name && name.trim()) {
			existingNode.name = name;
		}
		return existingNode;
	}

	const createdNode: MutableFileTreeNode = {
		children: new Set<string>(),
		name: name?.trim() || getDefaultFileTreeNodeName(path),
		path,
		type,
	};
	nodeMap.set(path, createdNode);
	return createdNode;
}

export function createFileTreeRenderData(nodes: ReadonlyArray<JsonRenderFileTreeNode>): FileTreeRenderData | null {
	const nodeMap = new Map<string, MutableFileTreeNode>();
	const childPaths = new Set<string>();

	for (const node of nodes) {
		const rawPath = typeof node.path === "string" ? node.path : "";
		const normalizedPath = normalizeFileTreePath(rawPath);
		if (!normalizedPath) {
			continue;
		}

		const explicitName = typeof node.name === "string" && node.name.trim()
			? node.name.trim()
			: undefined;
		const explicitType = node.type === "folder" || rawPath.trim().endsWith("/") || explicitName?.endsWith("/")
			? "folder"
			: "file";

		upsertFileTreeNode(nodeMap, {
			path: normalizedPath,
			name: explicitName,
			type: explicitType,
		});

		let currentPath = normalizedPath;
		let parentPath = getFileTreeParentPath(currentPath);
		while (parentPath) {
			const parentNode = upsertFileTreeNode(nodeMap, {
				path: parentPath,
				type: "folder",
			});
			parentNode.children.add(currentPath);
			childPaths.add(currentPath);
			currentPath = parentPath;
			parentPath = getFileTreeParentPath(currentPath);
		}
	}

	if (nodeMap.size === 0) {
		return null;
	}

	const buildNode = (path: string): FileTreeRenderNode => {
		const currentNode = nodeMap.get(path)!;
		const children = Array.from(currentNode.children)
			.map((childPath) => nodeMap.get(childPath))
			.filter((childNode): childNode is MutableFileTreeNode => childNode !== undefined)
			.sort(compareFileTreeNodes)
			.map((childNode) => buildNode(childNode.path));

		return {
			children,
			name: currentNode.name,
			path: currentNode.path,
			type: currentNode.type,
		};
	};

	const roots = Array.from(nodeMap.values())
		.filter((node) => !childPaths.has(node.path))
		.sort(compareFileTreeNodes)
		.map((node) => buildNode(node.path));

	if (roots.length === 0) {
		return null;
	}

	return {
		defaultExpandedPaths: Array.from(nodeMap.values())
			.filter((node) => node.type === "folder")
			.map((node) => node.path)
			.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })),
		roots,
	};
}

function parseAsciiDirectoryTree(value: string): FileTreeRenderData | null {
	const lines = value.split(/\r?\n/u).map((line) => line.trimEnd()).filter((line) => line.trim().length > 0);
	if (lines.length < 2) {
		return null;
	}

	const rootLine = lines[0].trim();
	if (DIRECTORY_TREE_BRANCH_PATTERN.test(rootLine) || !rootLine.endsWith("/")) {
		return null;
	}

	const rootPath = normalizeFileTreePath(rootLine);
	if (!rootPath) {
		return null;
	}

	const nodes: JsonRenderFileTreeNode[] = [
		{ path: rootPath, name: rootLine.replace(/\/+$/u, ""), type: "folder" },
	];
	const stack = new Map<number, string>([[0, rootPath]]);
	let matchedBranchCount = 0;

	for (const line of lines.slice(1)) {
		const branchMatch = line.match(DIRECTORY_TREE_BRANCH_PATTERN);
		if (!branchMatch) {
			continue;
		}

		const label = sanitizeFileTreeLabel(branchMatch[2] ?? "");
		if (!label) {
			continue;
		}

		const depth = (branchMatch[1] ?? "").length / 4 + 1;
		const parentPath = stack.get(depth - 1);
		if (!parentPath) {
			continue;
		}

		const nodePath = normalizeFileTreePath(`${parentPath}/${label.name}`);
		if (!nodePath) {
			continue;
		}

		nodes.push({
			path: nodePath,
			name: label.name,
			type: label.type,
		});
		stack.set(depth, nodePath);
		for (const existingDepth of Array.from(stack.keys())) {
			if (existingDepth > depth) {
				stack.delete(existingDepth);
			}
		}
		matchedBranchCount += 1;
	}

	return matchedBranchCount > 0 ? createFileTreeRenderData(nodes) : null;
}

function parseSectionedDirectoryTree(value: string): FileTreeRenderData | null {
	const lines = value.split(/\r?\n/u);
	const nodes: JsonRenderFileTreeNode[] = [];
	let currentFolderPath: string | null = null;
	let matchedEntryCount = 0;

	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (!line) {
			continue;
		}

		const sectionMatch = line.match(DIRECTORY_TREE_SECTION_PATTERN);
		if (sectionMatch?.[1]) {
			const folderPath = normalizeFileTreePath(sectionMatch[1]);
			if (!folderPath) {
				continue;
			}

			nodes.push({
				path: folderPath,
				name: getDefaultFileTreeNodeName(folderPath),
				type: "folder",
			});
			currentFolderPath = folderPath;
			continue;
		}

		if (!currentFolderPath) {
			continue;
		}

		const label = sanitizeFileTreeLabel(line);
		if (!label) {
			continue;
		}

		nodes.push({
			path: `${currentFolderPath}/${label.name}`,
			name: label.name,
			type: label.type,
		});
		matchedEntryCount += 1;
	}

	return matchedEntryCount > 0 ? createFileTreeRenderData(nodes) : null;
}

export function parseDirectoryTreeText(value: string): FileTreeRenderData | null {
	return parseAsciiDirectoryTree(value) ?? parseSectionedDirectoryTree(value);
}

export function parseTagTaxonomyText(value: string): TagTaxonomyGroup[] | null {
	const lines = value
		.split(/\r?\n/u)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
	if (lines.length < 2) {
		return null;
	}

	const groups: TagTaxonomyGroup[] = [];
	for (const line of lines) {
		const match = line.match(TAG_TAXONOMY_LINE_PATTERN);
		if (!match) {
			return null;
		}

		const label = match[1]?.trim();
		const rawTags = match[2] ?? "";
		if (!label) {
			return null;
		}

		const tags = rawTags
			.split(",")
			.map((tag) => tag.trim())
			.filter((tag) => tag.length > 0);
		if (tags.length === 0) {
			return null;
		}

		groups.push({
			color: TAG_TAXONOMY_COLOR_MAP[label.toLowerCase()] ?? "gray",
			label,
			tags,
		});
	}

	return groups.length >= 2 ? groups : null;
}

export function renderFileTreeNode(node: FileTreeRenderNode): ReactNode {
	if (node.type === "folder") {
		return (
			<FileTreeFolderRoot key={node.path} path={node.path} name={node.name}>
				{node.children.map((childNode) => renderFileTreeNode(childNode))}
			</FileTreeFolderRoot>
		);
	}

	return <FileTreeFileRoot key={node.path} path={node.path} name={node.name} />;
}
