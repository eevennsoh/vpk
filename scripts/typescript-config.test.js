const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const config = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "tsconfig.json"), "utf8"));

function sourceFixture(t, sources) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-typescript-config-"));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	for (const [relativePath, source] of Object.entries(sources)) {
		const file = path.join(root, relativePath);
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, source);
	}
	const parsed = ts.parseJsonConfigFileContent(config, ts.sys, root);
	assert.deepEqual(parsed.errors.map((error) => error.code), []);
	return { root, parsed };
}

test("TypeScript discovers project sources and generated route types without standalone output snapshots", (t) => {
	const sources = [
		"app/page.tsx",
		"components/example.tsx",
		"lib/example.ts",
		"scripts/example.mts",
		"artifacts/example.tsx",
		".next/types/routes.d.ts",
		".next/dev/types/routes.d.ts",
	];
	const snapshots = [
		"output/branch-cleanup/recovery/files/components/example.tsx",
		"output/branch-cleanup/recovery/files/lib/example.ts",
		"node_modules/example/index.ts",
		"public/1p/rovo-stage-kit/example.ts",
	];
	const { root, parsed } = sourceFixture(t, Object.fromEntries([...sources, ...snapshots].map((file) => [file, "export {};\n"])));
	const discovered = parsed.fileNames.map((file) => path.relative(root, file));
	assert.deepEqual(discovered.toSorted(), sources.toSorted());
});

test("TypeScript still follows output files explicitly imported by project sources", (t) => {
	const { root, parsed } = sourceFixture(t, {
		"lib/consumer.ts": 'import { value } from "../output/imported.ts";\nexport const result = value;\n',
		"output/imported.ts": "export const value = 1;\n",
		"output/standalone.ts": "export const unused = 1;\n",
	});
	const program = ts.createProgram(parsed.fileNames, parsed.options);
	assert.equal(program.getSourceFile(path.join(root, "output/imported.ts")) !== undefined, true);
	assert.equal(program.getSourceFile(path.join(root, "output/standalone.ts")) !== undefined, false);
});
