import assert from "node:assert/strict";
import test from "node:test";

import {
	createFileExplorerModel,
	getFileExplorerMovePath,
	getVisibleFileExplorerNodes,
	normalizeFileExplorerPath,
} from "./file-explorer-model.ts";

test("File Explorer normalizes canonical paths and creates implicit folders", () => {
	const model = createFileExplorerModel([
		{ path: "\\src\\components\\Button.tsx" },
		{ path: "/README.md" },
	]);

	assert.equal(normalizeFileExplorerPath(" /src//components/ "), "src/components");
	assert.equal(model.nodes.get("src")?.type, "folder");
	assert.equal(model.nodes.get("src/components")?.type, "folder");
	assert.deepEqual(model.roots, ["src", "README.md"]);
});

test("File Explorer follows expansion state and keeps folders before files", () => {
	const model = createFileExplorerModel([
		{ path: "src/index.ts" },
		{ path: "src/components", type: "folder" },
		{ path: "package.json" },
	]);

	assert.deepEqual(
		getVisibleFileExplorerNodes(model, new Set()).map((node) => node.path),
		["src", "package.json"],
	);
	assert.deepEqual(
		getVisibleFileExplorerNodes(model, new Set(["src"])).map((node) => node.path),
		["src", "src/components", "src/index.ts", "package.json"],
	);
});

test("File Explorer defaults to hiding non-matches while revealing matching ancestors", () => {
	const model = createFileExplorerModel([
		{ path: "src/components/Button.tsx" },
		{ path: "src/lib/api.ts" },
		{ path: "README.md" },
	]);

	assert.deepEqual(
		getVisibleFileExplorerNodes(model, new Set(), "button").map((node) => node.path),
		["src", "src/components", "src/components/Button.tsx"],
	);
});

test("File Explorer supports opt-in collapse and expand search modes", () => {
	const model = createFileExplorerModel([
		{ path: "src/components/Button.tsx" },
		{ path: "src/components/Card.tsx" },
		{ path: "src/lib/api.ts" },
		{ path: "README.md" },
	]);

	assert.deepEqual(
		getVisibleFileExplorerNodes(model, new Set(["src/lib"]), "button", false, "collapse-non-matches")
			.map((node) => node.path),
		["src", "src/components", "src/components/Button.tsx", "src/components/Card.tsx", "src/lib", "README.md"],
	);
	assert.deepEqual(
		getVisibleFileExplorerNodes(model, new Set(["src/lib"]), "button", false, "expand-matches")
			.map((node) => node.path),
		[
			"src",
			"src/components",
			"src/components/Button.tsx",
			"src/components/Card.tsx",
			"src/lib",
			"src/lib/api.ts",
			"README.md",
		],
	);
});

test("File Explorer flattens single-child folder chains with canonical terminal paths", () => {
	const model = createFileExplorerModel([
		{ path: "build/assets/images/social/logo.png" },
		{ path: "build/index.mjs" },
		{ path: "config/project/settings.json" },
	]);
	const visible = getVisibleFileExplorerNodes(
		model,
		new Set(["build", "build/assets/images/social"]),
		"",
		true,
	);

	assert.deepEqual(
		visible.map(({ depth, name, parentPath, path }) => ({ depth, name, parentPath, path })),
		[
			{ depth: 0, name: "build", parentPath: null, path: "build" },
			{ depth: 1, name: "assets / images / social", parentPath: "build", path: "build/assets/images/social" },
			{ depth: 2, name: "logo.png", parentPath: "build/assets/images/social", path: "build/assets/images/social/logo.png" },
			{ depth: 1, name: "index.mjs", parentPath: "build", path: "build/index.mjs" },
			{ depth: 0, name: "config / project", parentPath: null, path: "config/project" },
		],
	);
	assert.deepEqual(visible[1]?.flattenedPaths, [
		"build/assets",
		"build/assets/images",
		"build/assets/images/social",
	]);
});

test("File Explorer validates folder and root move destinations", () => {
	const model = createFileExplorerModel([
		{ path: "src/components/Button.tsx" },
		{ path: "src/index.ts" },
		{ path: "public/index.html" },
		{ path: "README.md" },
	]);

	assert.equal(getFileExplorerMovePath(model, "README.md", "public"), "public/README.md");
	assert.equal(getFileExplorerMovePath(model, "src/components", null), "components");
	assert.equal(getFileExplorerMovePath(model, "src", "src/components"), null);
	assert.equal(getFileExplorerMovePath(model, "src/index.ts", "src"), null);
	assert.equal(getFileExplorerMovePath(model, "missing.ts", "public"), null);
});
