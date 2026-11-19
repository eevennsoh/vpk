"use client";

import { useState } from "react";
import {
	FileTree,
	FileTreeFolder,
	FileTreeFile,
	FileTreeActions,
	FileTreeIcon,
	FileTreeName,
} from "@/components/ui-custom/file-tree";
import {
	CodeIcon,
	ImageIcon,
	FileJsonIcon,
	FileTextIcon,
	SettingsIcon,
	CopyIcon,
	TrashIcon,
	DownloadIcon,
} from "@/components/ui/vpk-icons";
import { Button } from "@/components/ui/button";

type FileNode =
	| { type: "file"; name: string; path: string }
	| { type: "folder"; name: string; path: string; children: FileNode[] };

const files: FileNode[] = [
	{
		type: "folder",
		name: "app",
		path: "app",
		children: [
			{ type: "file", name: "layout.tsx", path: "app/layout.tsx" },
			{ type: "file", name: "page.tsx", path: "app/page.tsx" },
		],
	},
	{
		type: "folder",
		name: "components",
		path: "components",
		children: [
			{
				type: "folder",
				name: "ui",
				path: "components/ui",
				children: [
					{
						type: "file",
						name: "button.tsx",
						path: "components/ui/button.tsx",
					},
				],
			},
			{
				type: "file",
				name: "login-form.tsx",
				path: "components/login-form.tsx",
			},
		],
	},
];

function collectFolderPaths(nodes: readonly FileNode[]): string[] {
	return nodes.flatMap((node) =>
		node.type === "folder" ? [node.path, ...collectFolderPaths(node.children)] : [],
	);
}

function FileTreeNode({ node }: Readonly<{ node: FileNode }>) {
	switch (node.type) {
		case "folder":
			return (
				<FileTreeFolder path={node.path} name={node.name}>
					{node.children.map((child) => (
						<FileTreeNode key={child.path} node={child} />
					))}
				</FileTreeFolder>
			);
		case "file":
			return <FileTreeFile path={node.path} name={node.name} />;
		default: {
			const unreachable: never = node;
			return unreachable;
		}
	}
}

export default function FileTreeDemo() {
	const [selected, setSelected] = useState("components/ui/button.tsx");

	return (
		<FileTree
			aria-label="Changed files"
			defaultExpanded={new Set(collectFolderPaths(files))}
			selectedPath={selected}
			onSelect={setSelected}
			className="w-full max-w-xs py-6"
		>
			{files.map((node) => (
				<FileTreeNode key={node.path} node={node} />
			))}
		</FileTree>
	);
}

export function FileTreeDemoCustomIcons() {
	return (
		<FileTree
			aria-label="Project files"
			defaultExpanded={new Set(["src", "public"])}
			className="w-full max-w-xs"
		>
			<FileTreeFolder path="src" name="src">
				<FileTreeFile
					path="src/app.tsx"
					name="app.tsx"
					icon={<CodeIcon className="text-icon-accent-blue" />}
				/>
				<FileTreeFile
					path="src/utils.ts"
					name="utils.ts"
					icon={<SettingsIcon className="text-icon-accent-yellow" />}
				/>
			</FileTreeFolder>
			<FileTreeFolder path="public" name="public">
				<FileTreeFile
					path="public/logo.svg"
					name="logo.svg"
					icon={<ImageIcon className="text-icon-accent-green" />}
				/>
				<FileTreeFile
					path="public/favicon.ico"
					name="favicon.ico"
					icon={<ImageIcon className="text-icon-accent-green" />}
				/>
			</FileTreeFolder>
			<FileTreeFile
				path="package.json"
				name="package.json"
				icon={<FileJsonIcon className="text-icon-accent-orange" />}
			/>
			<FileTreeFile
				path="README.md"
				name="README.md"
				icon={<FileTextIcon className="text-icon-subtle" />}
			/>
		</FileTree>
	);
}

function FileTreeDemoActionRow({ path, name }: Readonly<{ path: string; name: string }>) {
	return (
		<FileTreeFile path={path} name={name}>
			<FileTreeIcon>
				<CodeIcon className="text-icon-accent-blue" />
			</FileTreeIcon>
			<FileTreeName>{name}</FileTreeName>
			<FileTreeActions>
				<Button aria-label={`Copy ${name}`} variant="ghost" size="icon-compact">
					<CopyIcon />
				</Button>
				<Button aria-label={`Download ${name}`} variant="ghost" size="icon-compact">
					<DownloadIcon />
				</Button>
				<Button aria-label={`Delete ${name}`} variant="ghost" size="icon-compact">
					<TrashIcon />
				</Button>
			</FileTreeActions>
		</FileTreeFile>
	);
}

export function FileTreeDemoWithActions() {
	return (
		<FileTree
			aria-label="Source files"
			defaultExpanded={new Set(["src"])}
			className="w-full max-w-xs"
		>
			<FileTreeFolder path="src" name="src">
				<FileTreeDemoActionRow path="src/index.ts" name="index.ts" />
				<FileTreeDemoActionRow path="src/utils.ts" name="utils.ts" />
			</FileTreeFolder>
			<FileTreeFile path="package.json" name="package.json" />
		</FileTree>
	);
}
