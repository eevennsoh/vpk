const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const { buildSync } = require("esbuild");
const { loadCjsModuleFromText } = require("../../../../scripts/lib/esbuild-cjs-loader.js");

const result = buildSync({
	stdin: {
		contents: `export * from "./components/website/component-doc/components/source-links.server";
export { getAllComponents } from "./app/data/component-manifest";`,
		resolveDir: process.cwd(),
		loader: "ts",
	},
	bundle: true,
	format: "cjs",
	platform: "node",
	tsconfig: path.join(process.cwd(), "tsconfig.json"),
	write: false,
});
const { getDocImportReferences, getDocReferenceLinks, getAllComponents } = loadCjsModuleFromText(result.outputFiles[0].text);

test("documentation source links resolve real files, directories, and multiline CSS references", () => {
	assert.deepEqual(getDocImportReferences("@/components/ui/lozenge"), [{
		path: "@/components/ui/lozenge",
		links: [
			{ label: "Bitbucket", href: "https://bitbucket.org/atlassian/vpk/src/main/components/ui/lozenge.tsx" },
			{ label: "GitHub", href: "https://github.com/eevennsoh/vpk/blob/main/components/ui/lozenge.tsx" },
		],
	}]);
	assert.equal(getDocImportReferences("@/components/projects/rovo-button")[0].links[1].href,
		"https://github.com/eevennsoh/vpk/tree/main/components/projects/rovo-button");
	assert.equal(getDocImportReferences("@/app/tailwind-theme.css\n@/app/shadcn-theme.css").length, 2);
	assert.deepEqual(getDocImportReferences("motion-plus/react"), [{ path: "motion-plus/react", links: [] }]);
	assert.deepEqual(getDocImportReferences("@/components/missing-component"), [{ path: "@/components/missing-component", links: [] }]);
});

test("every local catalog import has both repository source links", () => {
	for (const component of getAllComponents()) {
		for (const reference of getDocImportReferences(component.importPath)) {
			if (reference.path.startsWith("@/")) {
				assert.equal(reference.links.length, 2, `${component.category}/${component.slug}: ${reference.path}`);
			}
		}
	}
});

test("documentation reference links exclude ADS and Atlaskit while retaining third-party credits", () => {
	const credit = { label: "Source and MIT license", url: "https://github.com/JakubAntalik/thinking-orbs" };
	assert.deepEqual(getDocReferenceLinks([
		{ label: "@atlaskit/lozenge", url: "https://atlassian.design/components/lozenge" },
		{ label: "Badge", url: "https://atlassian.design/components/badge/" },
		{ label: "Third-party logo", url: "https://atlaskit.atlassian.com/packages/platform-labs/logo-third-party" },
		credit,
	]), [credit]);
});
