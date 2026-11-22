"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { LockIcon, RefreshCwIcon } from "@/components/ui/vpk-icons";
import {
	FileExplorer,
	type FileExplorerItem,
	type FileExplorerMoveEvent,
} from "@/components/ui-custom/file-explorer";

const projectItems: readonly FileExplorerItem[] = [
	{ path: "public", type: "folder" },
	{ path: "src/components/Button.tsx", status: "added" },
	{ path: "src/components/Card.tsx" },
	{ path: "src/components/Header.tsx" },
	{ path: "src/lib/api.ts" },
	{ path: "src/styles/globals.css" },
	{ path: "src/index.ts", status: "modified" },
	{ path: ".browserslistrc", status: "ignored" },
	{ path: ".gitignore", status: "deleted" },
	{ path: "package.json", status: "renamed" },
	{ path: "README.md", status: "untracked" },
];

const flatteningItems: readonly FileExplorerItem[] = [
	{ path: ".github/workflows/ci.yml" },
	{ path: "build/assets/images/social/logo.png" },
	{ path: "build/index.mjs" },
	{ path: "build/scripts.js" },
	{ path: "config/project/settings.json" },
	{ path: "node_modules/react/index.js" },
	{ path: "public/favicon.ico" },
	{ path: "scripts/release.mjs" },
	{ path: "src/index.ts" },
	{ path: ".browserslistrc" },
	{ path: ".gitignore" },
	{ path: "package.json" },
	{ path: "README.md" },
	{ path: "stylelint.config.js" },
];

function moveFileExplorerItems(
	items: readonly FileExplorerItem[],
	{ nextPath, sourcePath }: FileExplorerMoveEvent,
): FileExplorerItem[] {
	return items.map((item) => {
		if (item.path === sourcePath) {
			return { ...item, path: nextPath };
		}
		if (item.path.startsWith(`${sourcePath}/`)) {
			return { ...item, path: `${nextPath}${item.path.slice(sourcePath.length)}` };
		}
		return item;
	});
}

export default function FileExplorerDemo() {
	const [selectedPath, setSelectedPath] = useState("src/components/Card.tsx");

	return (
		<FileExplorer
			className="w-full max-w-sm"
			defaultExpandedPaths={["src", "src/components"]}
			items={projectItems}
			onSelectedPathChange={setSelectedPath}
			searchable
			selectedPath={selectedPath}
		/>
	);
}

export function FileExplorerDemoPathFirst() {
	return (
		<FileExplorer
			className="w-full max-w-sm"
			defaultExpandedPaths={["app", "app/api"]}
			items={[
				{ path: "app/api/chat/route.ts" },
				{ path: "app/api/search/route.ts" },
				{ path: "app/layout.tsx" },
				{ path: "app/page.tsx" },
				{ path: "lib/utils.ts" },
				{ path: "next.config.ts" },
			]}
		/>
	);
}

export function FileExplorerDemoFlattenEmptyDirectories() {
	return (
		<div className="grid w-full max-w-3xl gap-4 md:grid-cols-2">
			<div className="space-y-2">
				<p className="text-sm font-semibold text-text">Default expanded</p>
				<FileExplorer
					defaultExpandedPaths={[
						"build",
						"build/assets",
						"build/assets/images",
						"build/assets/images/social",
					]}
					items={flatteningItems}
				/>
			</div>
			<div className="space-y-2">
				<p className="text-sm font-semibold text-text">Flattened directories</p>
				<FileExplorer
					defaultExpandedPaths={["build", "build/assets/images/social"]}
					defaultSelectedPath="build/assets/images/social"
					flattenEmptyDirectories
					items={flatteningItems}
				/>
			</div>
		</div>
	);
}

export function FileExplorerDemoGitStatus() {
	return (
		<FileExplorer
			className="w-full max-w-sm"
			defaultExpandedPaths={["src", "src/components"]}
			items={[
				{ path: "src/components/Button.tsx", status: "added" },
				{ path: "src/components/Card.tsx" },
				{ path: "src/components/LegacyPanel.tsx", status: "deleted" },
				{ path: "src/lib/api.ts" },
				{ path: "src/styles/globals.css" },
				{ path: "src/index.ts", status: "modified" },
				{ path: ".browserslistrc", status: "ignored" },
				{ path: ".gitignore" },
				{ path: "package.json", status: "renamed" },
				{ path: "README.md", status: "untracked" },
			]}
		/>
	);
}

export function FileExplorerDemoDragAndDrop() {
	const [items, setItems] = useState(() => [...flatteningItems]);
	const [isPackageLocked, setIsPackageLocked] = useState(true);

	return (
		<div className="w-full max-w-3xl space-y-3">
			<div className="flex flex-wrap items-center gap-2">
				<div className="flex h-8 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-text-subtle">
					<LockIcon className="size-4 text-icon-subtle" />
					<span>Lock package.json</span>
					<Switch
						checked={isPackageLocked}
						label="Lock package.json"
						onCheckedChange={setIsPackageLocked}
						size="sm"
					/>
				</div>
				<Button
					onClick={() => setItems([...flatteningItems])}
					size="compact"
					variant="outline"
				>
					<RefreshCwIcon />
					Reset
				</Button>
			</div>
			<FileExplorer
				canDrag={(path) => !isPackageLocked || path !== "package.json"}
				dragAndDrop
				flattenEmptyDirectories
				items={items}
				onMove={(event) => setItems((currentItems) => moveFileExplorerItems(currentItems, event))}
			/>
		</div>
	);
}

export function FileExplorerDemoIconRules() {
	return (
		<FileExplorer
			className="w-full max-w-sm"
			defaultExpandedPaths={["config", "src"]}
			icons={{
				set: "complete",
				byFileExtension: { log: "file-tree-builtin-text" },
			}}
			items={[
				{ path: "src/App.tsx" },
				{ path: "src/styles.scss" },
				{ path: "config/biome.json" },
				{ path: "config/vite.config.ts" },
				{ path: "Dockerfile" },
				{ path: "schema.graphql" },
				{ path: "release.log" },
			]}
		/>
	);
}
