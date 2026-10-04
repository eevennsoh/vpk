const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function fixture(t, manifest = {}, catalog = "", css = "") {
	const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-extraction-dependencies-"));
	t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
	fs.writeFileSync(path.join(repoRoot, "package.json"), JSON.stringify(manifest));
	if (catalog) fs.writeFileSync(path.join(repoRoot, "pnpm-workspace.yaml"), catalog);
	if (css) {
		fs.mkdirSync(path.join(repoRoot, "app"));
		fs.writeFileSync(path.join(repoRoot, "app", "globals.css"), css);
	}
	return repoRoot;
}

const loadResolver = () => import("./extraction-dependencies.mjs");

test("trace resolver reports catalog versions, host peers and normalized CSS prerequisites", async (t) => {
	const { resolveTraceDependencies } = await loadResolver();
	const repoRoot = fixture(t, {
		dependencies: { "@tiptap/core": "catalog:", "react-leaflet": "^5.0.0", leaflet: "^1.9.4", three: "^0.185.1", "@atlaskit/tokens": "8.0.0" },
		devDependencies: { "@types/leaflet": "^1.9.22", "@types/three": "catalog:" },
	}, "packages:\n  - .\ncatalog:\n  '@tiptap/core': '3.30.0' # pinned family\n  '@types/three': 0.185.4\noverrides:\n  unrelated: 99.0.0\n", [
		'@import "./theme/../typeset.css";',
		"@import '../components/shared.css';",
		'@import "tailwindcss";',
	].join("\n"));
	assert.deepEqual(resolveTraceDependencies({ repoRoot, packageNames: ["three", "react-leaflet", "@tiptap/core"], cssImports: ["app/demo/panel.css", "app/typeset.css"] }), {
		npmPackages: { "@tiptap/core": "3.30.0", "react-leaflet": "^5.0.0", three: "^0.185.1", leaflet: "^1.9.4", "@types/leaflet": "^1.9.22", "@types/three": "0.185.4", "@atlaskit/tokens": "8.0.0" },
		cssImports: ["@atlaskit/tokens/css-reset.css", "app/demo/panel.css", "app/tailwind-theme.css", "app/typeset.css", "components/shared.css"],
		warnings: [],
	});
});

test("trace resolver preserves ordered diagnostics and core fallbacks without a workspace catalog", async (t) => {
	const { resolveTraceDependencies } = await loadResolver();
	const repoRoot = fixture(t, { dependencies: { "react-leaflet": "^5.0.0", missingCatalog: "catalog:" } });
	const result = resolveTraceDependencies({ repoRoot, packageNames: ["unknown", "typescript", "react", "next", "missingCatalog", "react-leaflet"], cssImports: [] });
	assert.deepEqual(result.npmPackages, { missingCatalog: "catalog:", next: "latest", react: "latest", "react-leaflet": "^5.0.0", typescript: "latest" });
	assert.deepEqual(result.warnings, [
		'Host package "react-leaflet" is in the graph but peer "leaflet" is missing from source package.json',
		'Host package "react-leaflet" is in the graph but peer "@types/leaflet" is missing from source package.json',
		'npm dep "unknown" not found in root package.json — extraction may fail',
		'npm dep "missingCatalog" uses catalog: but has no entry in pnpm-workspace.yaml',
	]);
});

test("scaffold resolver uses the same catalog and peers while preserving plan overrides", async (t) => {
	const { resolveScaffoldDependencies } = await loadResolver();
	const repoRoot = fixture(t, {
		packageManager: "pnpm@10.0.0",
		dependencies: { three: "^0.185.1", shadcn: "~4.0.0", "tw-animate-css": "^1.4.1" },
		devDependencies: { "@types/three": "catalog:" },
	}, "catalog:\n  '@types/three': 0.185.4\n  '@tiptap/core': 3.30.0\n");
	assert.deepEqual(resolveScaffoldDependencies({ repoRoot, planPackages: { "@tiptap/core": "catalog:", three: "^0.185.2", "tw-animate-css": "^1.5.0" } }), {
		npmPackages: { "@tiptap/core": "3.30.0", three: "^0.185.2", "tw-animate-css": "^1.5.0", shadcn: "~4.0.0", "@types/three": "0.185.4" },
		packageManager: "pnpm@10.0.0",
	});
});

test("scaffold resolver keeps the existing animation fallback and unresolved route catalogs", async (t) => {
	const { resolveScaffoldDependencies } = await loadResolver();
	const repoRoot = fixture(t);
	assert.deepEqual(resolveScaffoldDependencies({ repoRoot, planPackages: { future: "catalog:" } }), {
		npmPackages: { future: "catalog:", "tw-animate-css": "^1.4.0" }, packageManager: undefined,
	});
	fs.unlinkSync(path.join(repoRoot, "package.json"));
	assert.deepEqual(resolveScaffoldDependencies({ repoRoot, planPackages: {} }), {
		npmPackages: { "tw-animate-css": "^1.4.0" }, packageManager: undefined,
	});
});

test("backend scaffold dependencies retain overrides and reject missing catalog versions", async (t) => {
	const { resolveScaffoldDependencies } = await loadResolver();
	const repoRoot = fixture(t, { dependencies: { express: "4.0.0", "motion-plus": "1.0.0", "ansi-to-react": "1.0.0" } }, "catalog:\n  '@json-render/core': 0.19.0\n");
	const result = resolveScaffoldDependencies({ repoRoot, planPackages: { react: "19.0.0" }, backendManifest: { dependencies: { express: "5.0.0", "@json-render/core": "catalog:" } } });
	assert.deepEqual(result.npmPackages, { react: "19.0.0", "tw-animate-css": "^1.4.0", express: "5.0.0", "@json-render/core": "0.19.0" });
	assert.throws(() => resolveScaffoldDependencies({ repoRoot, planPackages: {}, backendManifest: { dependencies: { unresolved: "catalog:" } } }), {
		message: "Backend dependency unresolved has no catalog version",
	});
});
