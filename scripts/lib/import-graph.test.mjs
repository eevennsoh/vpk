import assert from "node:assert/strict";
import test from "node:test";

import { buildReverseImports, directImporters, readSpecifiers, resolveSpecifier, selectRelatedTests } from "./import-graph.mjs";

const FILES = {
	"components/ui/button.tsx": "export function Button() {}",
	"components/ui/index.ts": 'export * from "./button";',
	"components/blocks/card/card.tsx": 'import { Button } from "@/components/ui/button";\nimport x from "react";',
	"components/blocks/card/card-model.ts": "export const model = 1;",
	"components/blocks/card/card-model.test.js": 'const test = require("node:test");\nconst { model } = require("./card-model.ts");',
	"components/blocks/card/card.behavior.test.js": 'import test from "node:test";',
	"components/blocks/card/card-source.test.js": 'const source = readFileSync(new URL("./card.tsx", import.meta.url));',
	"components/blocks/other/contract.test.js": 'const s = read("components/blocks/card/card.tsx");',
	"components/blocks/other/pkg.test.js": 'const pkg = read("package.json"); const readme = read("card/README.md");',
	"lib/esm.ts": 'export { a } from "../components/ui/index.js";\nconst lazy = () => import("./lazy");',
	"lib/lazy.ts": "export default 1;",
	"package.json": "{}",
	"components/blocks/card/README.md": "# Card",
};
const read = (file) => FILES[file];
const files = Object.keys(FILES);

test("reads static, dynamic, re-export and require specifiers", () => {
	assert.deepEqual(readSpecifiers('import a from "a";\nimport "./side";\nexport * from \'./b\';\nconst c = require("./c");\nawait import(`./d`);'),
		["a", "./side", "./b", "./c", "./d"]);
});

test("resolves relative, @/ and index paths, and .js written for a .ts source; packages resolve to null", () => {
	const tracked = new Set(files);
	assert.equal(resolveSpecifier("@/components/ui/button", "x.ts", tracked), "components/ui/button.tsx");
	assert.equal(resolveSpecifier("../components/ui", "lib/esm.ts", tracked), "components/ui/index.ts");
	assert.equal(resolveSpecifier("../components/ui/index.js", "lib/esm.ts", tracked), "components/ui/index.ts");
	assert.equal(resolveSpecifier("./card-model.ts", "components/blocks/card/x.test.js", tracked), "components/blocks/card/card-model.ts");
	assert.equal(resolveSpecifier("react", "x.ts", tracked), null);
	assert.equal(resolveSpecifier("./missing", "x.ts", tracked), null);
});

test("direct importers are found through every specifier form", () => {
	const importersOf = buildReverseImports(files, read);
	assert.deepEqual([...directImporters(["components/ui/button.tsx"], importersOf)].sort(), ["components/blocks/card/card.tsx", "components/ui/index.ts"]);
	assert.deepEqual([...directImporters(["lib/lazy.ts"], importersOf)], ["lib/esm.ts"]);
	assert.deepEqual([...directImporters(["components/ui/index.ts"], importersOf)], ["lib/esm.ts"]);
});

test("related suites: importers, same-stem suites and source-contract readers, but not mentions of non-source files", () => {
	const importersOf = buildReverseImports(files, read);
	const testFiles = files.filter((file) => file.includes(".test."));
	const related = (changed) => selectRelatedTests({ changed, importersOf, readSource: read, testFiles });
	assert.deepEqual(related(["components/blocks/card/card-model.ts"]), ["components/blocks/card/card-model.test.js"]);
	assert.deepEqual(related(["components/blocks/card/card.tsx"]), [
		"components/blocks/card/card-source.test.js",
		"components/blocks/card/card.behavior.test.js",
		"components/blocks/other/contract.test.js",
	]);
	assert.deepEqual(related(["package.json", "components/blocks/card/README.md"]), []);
	assert.deepEqual(related(["components/blocks/other/pkg.test.js"]), ["components/blocks/other/pkg.test.js"]);
});
