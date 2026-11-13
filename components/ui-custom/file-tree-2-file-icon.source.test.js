import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createFileTreeIconResolver } from "@pierre/trees";

const componentSource = readFileSync(new URL("./file-tree-2-file-icon.tsx", import.meta.url), "utf8");
const helpersSource = readFileSync(
	new URL("./file-tree-2-file-icon-helpers.ts", import.meta.url),
	"utf8",
);

test("FileTree2FileIcon resolves paths with the Pierre complete icon set", () => {
	const resolver = createFileTreeIconResolver("complete");

	assert.equal(resolver.resolveIcon("file-tree-icon-file", "PhotoUploader.tsx").token, "react");
	assert.equal(resolver.resolveIcon("file-tree-icon-file", "UserMenu.js").token, "javascript");
	assert.equal(resolver.resolveIcon("file-tree-icon-file", "UserProfileDialog.ts").token, "typescript");
	assert.match(componentSource, /createFileTreeIconResolver\(icons\)/u);
	assert.match(componentSource, /resolveIcon\("file-tree-icon-file", path\)/u);
	assert.match(helpersSource, /getBuiltInSpriteSheet/u);
	assert.match(helpersSource, /fileTree2IconColorStyles/u);
});
