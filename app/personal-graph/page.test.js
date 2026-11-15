const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

function loadPage() {
	const result = esbuild.buildSync({
		entryPoints: [path.join(__dirname, "page.tsx")],
		bundle: true,
		external: ["next", "react", "react-dom"],
		format: "cjs",
		jsx: "automatic",
		loader: { ".css": "empty" },
		logLevel: "silent",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	});
	return loadCjsModuleFromText(result.outputFiles[0].text, path.join(__dirname, "page.cjs")).default;
}

test("PersonalGraphPage redirects the legacy route to /arts/personal-graph", () => {
	const PersonalGraphPage = loadPage();
	assert.throws(
		() => PersonalGraphPage(),
		(error) => {
			// next/navigation redirect() throws an error whose digest carries the target URL and status.
			assert.equal(typeof error?.digest, "string");
			assert.deepEqual(error.digest.split(";").slice(0, 4), ["NEXT_REDIRECT", "replace", "/arts/personal-graph", "307"]);
			return true;
		},
	);
});
