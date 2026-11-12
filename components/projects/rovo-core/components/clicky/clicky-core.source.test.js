const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT_DIR = process.cwd();

function readProjectFile(filePath) {
	return fs.readFileSync(path.join(ROOT_DIR, filePath), "utf8");
}

const CLICKY_HOOK_SOURCE = readProjectFile("components/projects/rovo-core/hooks/use-clicky.ts");
const CLICKY_OVERLAY_SOURCE = readProjectFile("components/projects/rovo-core/components/clicky/clicky-overlay.tsx");
const CLICKY_CURSOR_SOURCE = readProjectFile("components/projects/rovo-core/components/clicky/clicky-cursor.tsx");

test("Clicky state and overlay are owned by rovo-core", () => {
	assert.match(
		CLICKY_HOOK_SOURCE,
		/coordinateSpace\?: "screenshot" \| "viewport";/u,
	);
	assert.match(
		CLICKY_OVERLAY_SOURCE,
		/import type \{ ClickyState, ClickyPointTarget \} from "@\/components\/projects\/rovo-core\/hooks\/use-clicky";/u,
	);
	assert.match(
		CLICKY_CURSOR_SOURCE,
		/import type \{ ClickyState \} from "@\/components\/projects\/rovo-core\/hooks\/use-clicky";/u,
	);
	assert.equal(
		fs.existsSync(path.join(ROOT_DIR, "components/projects/rovo/hooks/use-clicky.ts")),
		false,
	);
	assert.equal(
		fs.existsSync(path.join(ROOT_DIR, "components/projects/studio/hooks/use-clicky.ts")),
		false,
	);
	assert.equal(
		fs.existsSync(path.join(ROOT_DIR, "components/projects/rovo/components/clicky/clicky-overlay.tsx")),
		false,
	);
	assert.equal(
		fs.existsSync(path.join(ROOT_DIR, "components/projects/studio/components/clicky/clicky-overlay.tsx")),
		false,
	);
});
