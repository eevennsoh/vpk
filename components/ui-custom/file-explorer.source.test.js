import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createFileTreeIconResolver, getBuiltInSpriteSheet } from "@pierre/trees";

const source = readFileSync(new URL("./file-explorer.tsx", import.meta.url), "utf8");

test("File Explorer defaults to the complete colored icon set", () => {
	const resolver = createFileTreeIconResolver("complete");

	assert.equal(resolver.resolveIcon("file-tree-icon-file", "Button.tsx").token, "react");
	assert.equal(resolver.resolveIcon("file-tree-icon-file", "index.ts").token, "typescript");
	assert.equal(resolver.resolveIcon("file-tree-icon-file", ".gitignore").token, "git");
	assert.equal(resolver.resolveIcon("file-tree-icon-file", "package.json").token, "json");
	assert.equal(resolver.resolveIcon("file-tree-icon-file", "README.md").token, "markdown");
	assert.match(source, /icons = "complete"/u);
	assert.match(source, /<FileExplorerFileIcon/u);
	assert.match(source, /<FileExplorerIconSprite icons=\{icons\} \/>/u);
});

test("the complete sprite contains every documented built-in file icon", () => {
	const spriteSheet = getBuiltInSpriteSheet("complete");
	const tokens = [
		"astro", "babel", "bash", "biome", "bootstrap", "browserslist", "bun", "c", "claude",
		"cpp", "css", "database", "default", "docker", "eslint", "font", "git", "go", "graphql",
		"html", "image", "javascript", "json", "markdown", "mcp", "nextjs", "npm", "oxc", "postcss",
		"prettier", "python", "react", "ruby", "rust", "sass", "stylelint", "svelte", "svg", "svgo",
		"swift", "table", "tailwind", "terraform", "text", "typescript", "vite", "vscode", "vue", "wasm",
		"webpack", "yml", "zig", "zip",
	];

	for (const token of tokens) {
		assert.match(spriteSheet, new RegExp(`id="file-tree-builtin-${token}"`, "u"));
	}
});

test("File Explorer renders ancestor guide segments that reveal on tree hover", () => {
	assert.match(source, /data-slot="file-explorer-spacing-item"/u);
	assert.match(source, /group-hover\/file-explorer:opacity-75/u);
	assert.match(source, /translate-x-1 border-l border-border opacity-0/u);
	assert.match(source, /<ChevronRightIcon[^>]+size="small"/u);
});

test("File Explorer enables validated directory and root drag targets", () => {
	assert.match(source, /dragAndDrop = false/u);
	assert.match(source, /getFileExplorerMovePath/u);
	assert.match(source, /data-drop-target=\{isDropTarget \? "directory"/u);
	assert.match(source, /FILE_EXPLORER_ROOT_DROP_TARGET/u);
	assert.match(source, /const isDragAndDropEnabled = dragAndDrop && !query\.trim\(\)/u);
	assert.match(source, /draggedPathRef\.current = node\.path/u);
	assert.equal(source.match(/onDragEnter=/gu)?.length, 2);
});

test("File Explorer defaults search to hide non-matches", () => {
	assert.match(source, /searchMode = "hide-non-matches"/u);
});

test("File Explorer accepts a controlled searchQuery for external search UIs", () => {
	assert.match(source, /searchQuery\?: string/u);
	assert.match(source, /searchQuery: controlledSearchQuery/u);
	assert.match(source, /const query = controlledSearchQuery \?\? internalQuery/u);
});

test("File Explorer renders the complete Git status language", () => {
	assert.match(source, /"ignored" \| "modified" \| "renamed" \| "untracked"/u);
	assert.match(source, /untracked: \{[^}]+shortLabel: "U"/u);
	assert.match(source, /item\.status !== "ignored" \? statusStyles\[item\.status\]/u);
	assert.match(source, /data-git-status=\{item\?\.status\}/u);
});

test("File Explorer marks folders that contain changed descendants", () => {
	assert.match(source, /getChangedAncestorPaths/u);
	assert.match(source, /hasChangedDescendants/u);
	assert.match(source, /aria-label="Contains changed files"/u);
});

test("File Explorer forwards its accessible label to the tree role", () => {
	assert.match(source, /"aria-label": ariaLabel = "File tree"/u);
	assert.match(source, /aria-label=\{ariaLabel\}/u);
});
