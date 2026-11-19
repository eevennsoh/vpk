// VPK's AI SDK Elements copies were migrated to shadcn's AI Elements
// (https://ui.shadcn.com/docs/ai-elements): shadcn components live in components/ui, and
// patterns are rebuilt in components/ui-custom. This keeps the retired source from coming back.
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const SELF = path.relative(ROOT, __filename);

const RETIRED = [
	{ pattern: /"@ai-elements"\s*:/u, why: "the AI SDK Elements shadcn registry" },
	{ pattern: /elements\.ai-sdk\.dev/u, why: "an AI SDK Elements URL" },
	{ pattern: /["']@\/components\/ai-elements(?:\/|["'])/u, why: "an import from components/ai-elements" },
	{ pattern: /\.agents\/skills\/ai-elements\/references\//u, why: "the retired global ai-elements reference docs" },
];

function findRetiredReferences(files, read) {
	const hits = [];
	for (const file of files) {
		const lines = read(file).split("\n");
		lines.forEach((line, index) => {
			for (const { pattern, why } of RETIRED) {
				if (pattern.test(line)) hits.push(`${file}:${index + 1} ${why}`);
			}
		});
	}
	return hits;
}

test("retired AI SDK Elements references are found, and shadcn AI Elements links are not", () => {
	const fixtures = {
		"components.json": '  "@ai-elements": "https://elements.ai-sdk.dev/api/registry/{name}.json",',
		"a.tsx": 'import { Message } from "@/components/ai-elements/message";',
		"b.md": "[tool](~/.agents/skills/ai-elements/references/tool.md)",
		"ok.md": "[tool](https://ui.shadcn.com/docs/ai-elements/base/tool) and components/ui/variants-ai-elements.ts",
	};
	assert.deepEqual(findRetiredReferences(Object.keys(fixtures), (file) => fixtures[file]), [
		"components.json:1 the AI SDK Elements shadcn registry",
		"components.json:1 an AI SDK Elements URL",
		"a.tsx:1 an import from components/ai-elements",
		"b.md:1 the retired global ai-elements reference docs",
	]);
});

test("the repository does not reference the retired AI SDK Elements source", () => {
	const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: ROOT, encoding: "utf8" })
		.split("\n")
		.filter(Boolean)
		.filter((file) => file !== SELF && !file.startsWith("artifacts/") && !file.endsWith(".lock") && file !== "pnpm-lock.yaml")
		.filter((file) => /\.(?:[cm]?[jt]sx?|json|md|mdx|css)$/u.test(file))
		.filter((file) => fs.existsSync(path.join(ROOT, file)));
	const hits = findRetiredReferences(files, (file) => fs.readFileSync(path.join(ROOT, file), "utf8"));
	assert.deepEqual(hits, [], `Port from shadcn AI Elements (https://ui.shadcn.com/docs/ai-elements) instead:\n${hits.join("\n")}`);
});
