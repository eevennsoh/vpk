import assert from "node:assert/strict";
import test from "node:test";

import { buildReverseImports, deepBundlingDependents, directImporters, readRepoPathStrings, readSpecifiers, resolveSpecifier, selectRelatedTests } from "./import-graph.mjs";

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

// A deeper graph: a data module, a component that uses it, a block that renders the component,
// and suites that reach them in the ways the gate missed before.
const DEEP = {
	"components/ui/data/logo-data.ts": "export const logos = {};",
	"components/ui/logo.tsx": 'import { logos } from "./data/logo-data";',
	"components/blocks/lanyard/lanyard.tsx": 'import { Logo } from "@/components/ui/logo";',
	"components/blocks/lanyard/index.ts": 'export * from "./lanyard";',
	"components/blocks/lanyard/page.tsx": 'import { Lanyard } from "./index";',
	// Reaches the block only through a renderComponent entry string.
	"components/blocks/lanyard/lanyard.test.js": 'const view = await renderComponent({ entry: "components/blocks/lanyard/index.ts" });',
	// Reaches the renderer only through an import inside esbuild stdin text, from another directory.
	"components/projects/shared/preview.tsx": 'import { Logo } from "@/components/ui/logo";',
	"components/projects/shared/preview-html.test.js": 'esbuild.buildSync({ stdin: { contents: \'import { Preview } from "./components/projects/shared/preview.tsx";\' } });',
	// A plain two-level import: suite → helper → changed module.
	"lib/format.ts": "export const format = 1;",
	"lib/report.ts": 'import { format } from "./format";',
	"lib/report.test.js": 'const { report } = require("./report.ts");',
	// Too deep for two levels, but bundles: announced, not run.
	"app/page.test.js": 'renderComponent({ entry: "components/blocks/lanyard/page.tsx" });',
};
const deepRead = (file) => DEEP[file];
const deepFiles = Object.keys(DEEP);

test("a test's repo-path strings are edges from the repo root: a renderComponent entry and an esbuild stdin import", () => {
	assert.deepEqual(readRepoPathStrings(DEEP["components/blocks/lanyard/lanyard.test.js"]), ["components/blocks/lanyard/index.ts"]);
	assert.deepEqual(readRepoPathStrings(DEEP["components/projects/shared/preview-html.test.js"]), ["components/projects/shared/preview.tsx"]);
	const importersOf = buildReverseImports(deepFiles, deepRead);
	assert.ok(importersOf.get("components/blocks/lanyard/index.ts").has("components/blocks/lanyard/lanyard.test.js"));
	assert.ok(importersOf.get("components/projects/shared/preview.tsx").has("components/projects/shared/preview-html.test.js"));
});

test("related suites reach two levels of imports, and deeper bundling suites are reported separately", () => {
	const importersOf = buildReverseImports(deepFiles, deepRead);
	const testFiles = deepFiles.filter((file) => file.includes(".test."));
	const related = (changed) => selectRelatedTests({ changed, importersOf, readSource: deepRead, testFiles });
	assert.deepEqual(related(["lib/format.ts"]), ["lib/report.test.js"], "a two-level import");
	assert.deepEqual(related(["components/projects/shared/preview.tsx"]), ["components/projects/shared/preview-html.test.js"]);
	assert.deepEqual(related(["components/blocks/lanyard/lanyard.tsx"]), ["components/blocks/lanyard/lanyard.test.js"], "entry string, then the barrel");
	const changed = ["components/ui/logo.tsx"];
	const selected = related(changed);
	assert.deepEqual(selected, ["components/projects/shared/preview-html.test.js"]);
	assert.deepEqual(deepBundlingDependents({ changed, importersOf, readSource: deepRead, selected }), ["app/page.test.js", "components/blocks/lanyard/lanyard.test.js"]);
	assert.deepEqual(deepBundlingDependents({ changed: ["lib/format.ts"], importersOf, readSource: deepRead, selected: related(["lib/format.ts"]) }), [], "nothing deeper: no line");
});
