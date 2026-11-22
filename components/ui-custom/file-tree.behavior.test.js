const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../scripts/lib/render-component.js");

const TREE_SOURCE = `
	import { useState } from "react";
	import { Button } from "@/components/ui/button";
	import { FileTree, FileTreeActions, FileTreeFile, FileTreeFolder, FileTreeIcon, FileTreeName } from "@/components/ui-custom/file-tree";
	export default function Probe({ onAction = () => {} }) {
		const [selected, setSelected] = useState("src/app.tsx");
		return <>
			<FileTree aria-label="Project files" defaultExpanded={new Set(["src"])} selectedPath={selected} onSelect={setSelected}>
				<FileTreeFolder path="src" name="src">
					<FileTreeFolder path="src/lib" name="lib">
						<FileTreeFile path="src/lib/utils.ts" name="utils.ts" />
					</FileTreeFolder>
					<FileTreeFile path="src/app.tsx" name="app.tsx" />
					<FileTreeFile path="src/index.ts" name="index.ts">
						<FileTreeIcon />
						<FileTreeName>index.ts</FileTreeName>
						<FileTreeActions>
							<Button aria-label="Delete index.ts" onClick={onAction}>x</Button>
						</FileTreeActions>
					</FileTreeFile>
				</FileTreeFolder>
				<FileTreeFile path="package.json" name="package.json" />
			</FileTree>
			<output>{selected}</output>
		</>;
	}
`;

test("file tree rows are treeitems with level, selection and expansion state", async () => {
	const view = await renderComponent({ source: TREE_SOURCE });
	const tree = view.getByRole("tree", { name: "Project files" });
	assert.equal(tree.getAttribute("role"), "tree");

	const src = view.getByRole("treeitem", { name: "src" });
	assert.equal(src.tagName, "BUTTON");
	assert.equal(src.getAttribute("aria-expanded"), "true");
	assert.equal(src.getAttribute("aria-level"), "1");

	const lib = view.getByRole("treeitem", { name: "lib" });
	assert.equal(lib.getAttribute("aria-expanded"), "false");
	assert.equal(lib.getAttribute("aria-level"), "2");

	const app = view.getByRole("treeitem", { name: "app.tsx" });
	assert.equal(app.getAttribute("aria-selected"), "true");
	assert.equal(view.getByRole("treeitem", { name: "package.json" }).getAttribute("aria-selected"), "false");
	assert.equal(view.getByRole("treeitem", { name: "package.json" }).getAttribute("aria-level"), "1");
});

test("an open folder owns its child group through aria-owns; a closed one owns nothing", async () => {
	const view = await renderComponent({ source: TREE_SOURCE });
	const src = view.getByRole("treeitem", { name: "src" });
	const ownedId = src.getAttribute("aria-owns") ?? "";
	assert.notEqual(ownedId, "");
	const group = document.getElementById(ownedId);
	assert.equal(group?.getAttribute("role"), "group");
	assert.equal(group?.textContent?.includes("app.tsx"), true);
	assert.equal(view.getByRole("treeitem", { name: "lib" }).hasAttribute("aria-owns"), false);
});

test("clicking a file selects it and clicking a folder toggles and selects it", async () => {
	const view = await renderComponent({ source: TREE_SOURCE });
	await view.click(view.getByRole("treeitem", { name: "package.json" }));
	assert.equal(view.container.querySelector("output").textContent, "package.json");

	const lib = view.getByRole("treeitem", { name: "lib" });
	await view.click(lib);
	assert.equal(lib.getAttribute("aria-expanded"), "true");
	assert.equal(view.container.querySelector("output").textContent, "src/lib");
	assert.equal(view.getByRole("treeitem", { name: "utils.ts" }).getAttribute("aria-level"), "3");
});

test("a row with actions is the treeitem that holds them, so the tree owns only treeitems", async () => {
	let actionCount = 0;
	const view = await renderComponent({ props: { onAction: () => { actionCount += 1; } }, source: TREE_SOURCE });
	const row = view.getByRole("treeitem", { name: "index.ts" });
	const action = view.getByRole("button", { name: "Delete index.ts" });
	assert.equal(row.contains(action), true);
	assert.equal(row.tagName, "DIV");
	assert.equal(row.getAttribute("aria-level"), "2");

	await view.click(action);
	assert.equal(actionCount, 1);
	// The action's click does not select the row.
	assert.equal(view.container.querySelector("output").textContent, "src/app.tsx");

	// Enter on the row itself selects it; Enter on an action does not.
	await view.press(action, "Enter");
	assert.equal(view.container.querySelector("output").textContent, "src/app.tsx");
	await view.press(row, "Enter");
	assert.equal(view.container.querySelector("output").textContent, "src/index.ts");
});

test("arrow keys move between visible rows and open or close folders", async () => {
	const view = await renderComponent({ source: TREE_SOURCE });
	const src = view.getByRole("treeitem", { name: "src" });
	const lib = view.getByRole("treeitem", { name: "lib" });

	await view.focus(src);
	await view.press(src, "ArrowDown");
	assert.ok(view.isFocused(lib));

	// The collapsed lib folder's file is skipped.
	await view.press(lib, "ArrowDown");
	assert.ok(view.isFocused(view.getByRole("treeitem", { name: "app.tsx" })));

	await view.press(view.getByRole("treeitem", { name: "app.tsx" }), "ArrowUp");
	assert.ok(view.isFocused(lib));

	await view.press(lib, "ArrowRight");
	assert.equal(lib.getAttribute("aria-expanded"), "true");
	await view.press(lib, "ArrowRight");
	const utils = view.getByRole("treeitem", { name: "utils.ts" });
	assert.ok(view.isFocused(utils));

	await view.press(utils, "ArrowLeft");
	assert.ok(view.isFocused(lib));
	await view.press(lib, "ArrowLeft");
	assert.equal(lib.getAttribute("aria-expanded"), "false");
	await view.press(lib, "ArrowLeft");
	assert.ok(view.isFocused(src));

	await view.press(src, "End");
	assert.ok(view.isFocused(view.getByRole("treeitem", { name: "package.json" })));
	await view.press(view.getByRole("treeitem", { name: "package.json" }), "Home");
	assert.ok(view.isFocused(src));
	// Arrow keys do not change the selection.
	assert.equal(view.container.querySelector("output").textContent, "src/app.tsx");
});
