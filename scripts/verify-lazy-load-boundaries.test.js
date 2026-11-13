const assert = require("node:assert/strict");
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { gateRunsScript } = require("./lib/package-gates.js");

const {
	DEFAULT_DEFERRED_MODULE_RULES,
	DEFAULT_FILE_IMPORT_RULES,
	DEFAULT_LAZY_ONLY_MODULES,
	DEFAULT_REACH_TRACKED_RULES,
	DEFAULT_ROUTE_SHELL_FILES,
	DEFAULT_SINGLE_OWNER_IMPORTS,
	collectHeavyStaticImportsFromSource,
	collectReachableHeavyImports,
	discoverRouteEntryFiles,
	resolveDemoEntryFiles,
	createHeavyImportRule,
	formatFailure,
	getRuleForImport,
	parseArgs,
	verifyLazyLoadBoundaries,
} = require("./verify-lazy-load-boundaries");

// The repository-wide rules, switched off for workspaces that test one rule kind.
const NO_TREE_RULES = { fileImportRules: [], lazyOnlyModules: [], singleOwnerImports: [] };

function withWorkspace(files, run) {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-lazy-tree-"));
	try {
		for (const [filePath, source] of Object.entries(files)) {
			mkdirSync(path.dirname(path.join(cwd, filePath)), { recursive: true });
			writeFileSync(path.join(cwd, filePath), source);
		}
		return run(cwd);
	} finally {
		rmSync(cwd, { force: true, recursive: true });
	}
}

test("parseArgs supports route shell and heavy import overrides", () => {
	assert.deepEqual(parseArgs(["--file", "app/page.tsx", "--heavy-import", "three"]), {
		help: false,
		heavyImportRules: [{
			match: "exact",
			reason: "configured heavy runtime",
			source: "three",
		}],
		routeShellFiles: ["app/page.tsx"],
		updateBaseline: false,
	});
	assert.deepEqual(parseArgs(["--file=app/studio/page.tsx", "--heavy-import=@tiptap/*"]), {
		help: false,
		heavyImportRules: [{
			match: "prefix",
			reason: "configured heavy runtime",
			source: "@tiptap/",
		}],
		routeShellFiles: ["app/studio/page.tsx"],
		updateBaseline: false,
	});
	assert.equal(parseArgs(["--update-baseline"]).updateBaseline, true);
	assert.throws(() => parseArgs(["--file"]), /requires a value/u);
});

test("matches exact and prefix heavy import rules", () => {
	assert.equal(getRuleForImport("three")?.source, "three");
	assert.equal(getRuleForImport("@tiptap/react")?.source, "@tiptap/");
	assert.equal(getRuleForImport("@tiptap/react", [createHeavyImportRule("@tiptap/*")])?.source, "@tiptap/");
	assert.equal(getRuleForImport("@tiptapness/not-real"), null);
});

test("detects runtime static imports, exports, and requires", () => {
	const failures = collectHeavyStaticImportsFromSource([
		'import { Canvas } from "@react-three/fiber";',
		'export { Player } from "@remotion/player";',
		'const three = require("three");',
	].join("\n"), "app/page.tsx");

	assert.deepEqual(failures.map((failure) => ({
		filePath: failure.filePath,
		importPath: failure.importPath,
		kind: failure.kind,
		line: failure.line,
		type: failure.type,
	})), [
		{
			filePath: "app/page.tsx",
			importPath: "@react-three/fiber",
			kind: "import",
			line: 1,
			type: "heavy-static-import",
		},
		{
			filePath: "app/page.tsx",
			importPath: "@remotion/player",
			kind: "export",
			line: 2,
			type: "heavy-static-import",
		},
		{
			filePath: "app/page.tsx",
			importPath: "three",
			kind: "require",
			line: 3,
			type: "heavy-static-import",
		},
	]);
	assert.match(formatFailure(failures[0]), /Use a route-owned dynamic import/u);
});

test("allows type-only and dynamic imports", () => {
	assert.deepEqual(collectHeavyStaticImportsFromSource([
		'import type { CanvasProps } from "@react-three/fiber";',
		'import { type Editor } from "@tiptap/react";',
		'export type { PlayerRef } from "@remotion/player";',
		'const module = await import("three");',
	].join("\n"), "app/page.tsx"), []);
});

test("verifies configured route shell files in a workspace", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-lazy-boundary-"));
	try {
		const shellPath = "app/page.tsx";
		mkdirSync(path.join(cwd, "app"), { recursive: true });
		writeFileSync(path.join(cwd, shellPath), 'import { Canvas } from "@react-three/fiber";\n');

		const failures = verifyLazyLoadBoundaries({
			cwd,
			deferredModuleRules: [],
			...NO_TREE_RULES,
			routeShellFiles: [shellPath, "app/missing/page.tsx"],
		});

		assert.deepEqual(failures.map((failure) => failure.type), [
			"heavy-static-import",
			"missing-route-shell",
		]);
		assert.match(formatFailure(failures[1]), /configured route shell does not exist/u);
	} finally {
		rmSync(cwd, { force: true, recursive: true });
	}
});

test("detects a deferred module pulled into an entry's static dependency graph", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-deferred-boundary-"));
	try {
		const entryFile = "app/page.tsx";
		const boundaryFile = "components/boundary.tsx";
		const targetFile = "components/deferred.tsx";
		mkdirSync(path.join(cwd, "app"), { recursive: true });
		mkdirSync(path.join(cwd, "components"), { recursive: true });
		writeFileSync(path.join(cwd, entryFile), 'import Boundary from "@/components/boundary";\nexport default Boundary;\n');
		writeFileSync(path.join(cwd, targetFile), "export default function Deferred() { return null; }\n");
		writeFileSync(path.join(cwd, boundaryFile), 'const Deferred = import("@/components/deferred");\nexport default Deferred;\n');

		const rule = [{
			entryFile,
			reason: "the deferred subtree must stay split",
			targetFile,
		}];
		assert.deepEqual(verifyLazyLoadBoundaries({
			cwd,
			deferredModuleRules: rule,
			heavyImportRules: [],
			...NO_TREE_RULES,
			routeShellFiles: [],
		}), []);

		writeFileSync(path.join(cwd, boundaryFile), 'import Deferred from "@/components/deferred";\nexport default Deferred;\n');
		const failures = verifyLazyLoadBoundaries({
			cwd,
			deferredModuleRules: rule,
			heavyImportRules: [],
			...NO_TREE_RULES,
			routeShellFiles: [],
		});

		assert.equal(failures.length, 1);
		assert.equal(failures[0].type, "deferred-module-statically-reachable");
		assert.deepEqual(failures[0].dependencyPath, [entryFile, boundaryFile, targetFile]);
		assert.match(formatFailure(failures[0]), /statically reachable/u);
	} finally {
		rmSync(cwd, { force: true, recursive: true });
	}
});

test("default route shell list covers the measured app shells", () => {
	assert.deepEqual(DEFAULT_ROUTE_SHELL_FILES, [
		"app/page.tsx",
		"app/components/layout.tsx",
		"app/components/[category]/[slug]/page.tsx",
		"app/visual/[slug]/page.tsx",
		"app/rovo/[[...id]]/page.tsx",
		"app/studio/[[...id]]/page.tsx",
	]);
});

test("default deferred module rules cover the Jira pull request review subtree", () => {
	assert.deepEqual(DEFAULT_DEFERRED_MODULE_RULES, [
		{
			entryFile: "components/projects/studio/components/rovo-app-shell.tsx",
			reason: "the Studio Ask Rovo chat panel must stay out of the initial project bundle",
			targetFile: "components/projects/sidebar-chat/page.tsx",
		},
		{
			entryFile: "components/projects/jira-golden-journey-v2/page.tsx",
			reason: "the Jira pull request review subtree must stay out of the initial project bundle",
			targetFile: "components/blocks/jira-work-item/experimental-v2/components/pull-request-detail/pull-request-detail-view.tsx",
		},
		{
			entryFile: "components/projects/jira-golden-journey-v2/page.tsx",
			reason: "the contextual pull request rail must stay out of the initial project bundle",
			targetFile: "components/blocks/jira-work-item/experimental-v2/components/pull-request-detail/pull-request-context-rail.tsx",
		},
		{
			entryFile: "components/projects/jira-golden-journey-v3/page.tsx",
			reason: "the Jira pull request review subtree must stay out of the initial project bundle",
			targetFile: "components/blocks/jira-work-item/experimental-v3/components/pull-request-detail/pull-request-detail-view.tsx",
		},
		{
			entryFile: "components/projects/jira-golden-journey-v3/page.tsx",
			reason: "the contextual pull request rail must stay out of the initial project bundle",
			targetFile: "components/blocks/jira-work-item/experimental-v3/components/pull-request-detail/pull-request-context-rail.tsx",
		},
{
			entryFile: "components/projects/jira-golden-journey-v4/page.tsx",
			reason: "the Jira pull request review subtree must stay out of the initial project bundle",
			targetFile: "components/blocks/jira-work-item/experimental-v3/components/pull-request-detail/pull-request-detail-view.tsx",
		},
{
			entryFile: "components/projects/jira-golden-journey-v4/page.tsx",
			reason: "the contextual pull request rail must stay out of the initial project bundle",
			targetFile: "components/blocks/jira-work-item/experimental-v3/components/pull-request-detail/pull-request-context-rail.tsx",
		},
	]);
});

test("package scripts expose and run the lazy-load verifier", () => {
	const packageJson = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8"));

	assert.equal(packageJson.scripts["verify:lazy-load"], "node scripts/verify-lazy-load-boundaries.js");
	for (const gate of ["validate:local", "ci:pr", "verify:fast"]) {
		assert.ok(gateRunsScript(packageJson.scripts, gate, "verify:lazy-load"), `${gate} must run verify:lazy-load`);
	}
});

test("route entries are every app page, layout and template and every project entry page", () => {
	withWorkspace({
		"app/page.tsx": "export default function Home() { return null; }\n",
		"app/rovo/[[...id]]/page.tsx": "export default function Rovo() { return null; }\n",
		"app/api/health/page.tsx": "export default function NotARoute() { return null; }\n",
		"app/rovo/layout.tsx": "export default function Layout() { return null; }\n",
		"app/rovo/template.tsx": "export default function Template() { return null; }\n",
		"app/rovo/rovo-shell.tsx": "export default function NotAnEntry() { return null; }\n",
		"components/projects/butter/page.tsx": "export default function Butter() { return null; }\n",
		"components/projects/butter/components/page.tsx": "export default function Nested() { return null; }\n",
	}, (cwd) => {
		assert.deepEqual(discoverRouteEntryFiles(cwd), [
			"app/page.tsx",
			"app/rovo/[[...id]]/page.tsx",
			"app/rovo/layout.tsx",
			"app/rovo/template.tsx",
			"components/projects/butter/page.tsx",
		]);
	});
});

test("a lazy-only module reached by a static import from any route entry fails", () => {
	const lazyOnlyModules = [{ reason: "the runtime loads on first render", targetFile: "components/runtime.ts" }];
	const files = {
		"components/projects/demo/page.tsx": 'import Preview from "@/components/preview";\nexport default Preview;\n',
		"components/runtime.ts": "export const runtime = 1;\n",
		"components/preview.tsx": 'export default function Preview() { void import("@/components/runtime"); return null; }\n',
	};
	withWorkspace(files, (cwd) => {
		const options = { cwd, deferredModuleRules: [], fileImportRules: [], heavyImportRules: [], lazyOnlyModules, routeShellFiles: ["components/projects/demo/page.tsx"], singleOwnerImports: [] };
		assert.deepEqual(verifyLazyLoadBoundaries(options), []);

		writeFileSync(path.join(cwd, "components/preview.tsx"), 'import { runtime } from "@/components/runtime";\nexport default function Preview() { return runtime; }\n');
		const failures = verifyLazyLoadBoundaries(options);
		assert.equal(failures.length, 1);
		assert.equal(failures[0].type, "deferred-module-statically-reachable");
		assert.deepEqual(failures[0].dependencyPath, ["components/projects/demo/page.tsx", "components/preview.tsx", "components/runtime.ts"]);
	});
});

test("a stylesheet with one owner may not be imported by another module or stylesheet", () => {
	const singleOwnerImports = [
		{ ownerFile: "components/math.ts", reason: "KaTeX CSS loads with the math plugin", source: "katex/dist/katex.min.css" },
		{ ownerFile: "components/diagram.css", reason: "diagram CSS loads with the runtime", source: "diagram-lib/dist/index.css" },
	];
	const files = {
		"app/globals.css": '@import "tailwindcss";\n',
		"app/layout.tsx": 'import "./globals.css";\nexport default function Layout() { return null; }\n',
		"components/diagram.css": '@import "../node_modules/diagram-lib/dist/index.css";\n',
		"components/math.ts": 'import "katex/dist/katex.min.css";\nexport const math = 1;\n',
	};
	withWorkspace(files, (cwd) => {
		const options = { cwd, deferredModuleRules: [], fileImportRules: [], heavyImportRules: [], lazyOnlyModules: [], routeShellFiles: [], singleOwnerImports };
		assert.deepEqual(verifyLazyLoadBoundaries(options), []);

		writeFileSync(path.join(cwd, "app/layout.tsx"), 'import "./globals.css";\nimport "katex/dist/katex.min.css";\nexport default function Layout() { return null; }\n');
		writeFileSync(path.join(cwd, "app/globals.css"), '@import "tailwindcss";\n@import "../node_modules/diagram-lib/dist/index.css";\n');
		const failures = verifyLazyLoadBoundaries(options);
		assert.deepEqual(failures.map((failure) => [failure.type, failure.filePath, failure.ownerFile]), [
			["single-owner-import", "app/globals.css", "components/diagram.css"],
			["single-owner-import", "app/layout.tsx", "components/math.ts"],
		]);
		assert.match(formatFailure(failures[1]), /only components\/math\.ts may import/u);
	});
});

test("the icon registry may not import an icon statically", () => {
	const fileImportRules = [{ filePath: "components/registry.tsx", rules: [{ match: "prefix", reason: "registry icons load on first render", source: "@atlaskit/icon/" }] }];
	withWorkspace({
		"components/registry.tsx": 'import type { NewCoreIconProps } from "@atlaskit/icon/base-new";\nexport const REGISTRY = new Map([["add", () => import("@atlaskit/icon/core/add")]]);\n',
	}, (cwd) => {
		const options = { cwd, deferredModuleRules: [], fileImportRules, heavyImportRules: [], lazyOnlyModules: [], routeShellFiles: [], singleOwnerImports: [] };
		assert.deepEqual(verifyLazyLoadBoundaries(options), []);

		writeFileSync(path.join(cwd, "components/registry.tsx"), 'import AddIcon from "@atlaskit/icon/core/add";\nexport const REGISTRY = new Map([["add", AddIcon]]);\n');
		const failures = verifyLazyLoadBoundaries(options);
		assert.deepEqual(failures.map((failure) => [failure.type, failure.importPath]), [["file-static-import", "@atlaskit/icon/core/add"]]);
		assert.match(formatFailure(failures[0]), /registry icons load on first render/u);
	});
});

test("default tree rules cover the C-8a stylesheets and the C-8d icon registry", () => {
	assert.deepEqual(DEFAULT_LAZY_ONLY_MODULES.map((rule) => rule.targetFile), [
		"components/projects/shared/components/excalidraw-runtime.ts",
		"lib/json-render/map-widget-canvas.tsx",
	]);
	assert.deepEqual(DEFAULT_SINGLE_OWNER_IMPORTS.map((rule) => [rule.match, rule.source, rule.ownerFile]), [
		["stylesheet", "katex", "components/ui-custom/streamdown-math.ts"],
		["exact", "@streamdown/math", "components/ui-custom/streamdown-math.ts"],
		["stylesheet", "leaflet", "lib/json-render/map-widget-canvas.tsx"],
		["stylesheet", "@excalidraw/excalidraw", "components/projects/shared/components/excalidraw-runtime.css"],
	]);
	assert.deepEqual(DEFAULT_FILE_IMPORT_RULES.map((rule) => [rule.filePath, rule.rules.map((entry) => entry.source)]), [
		["components/projects/shared/components/icon-registry.tsx", ["@atlaskit/icon/", "@atlaskit/icon-lab/"]],
	]);
});

const THREE_RULE = [{ match: "exact", reason: "WebGL runtime", source: "three" }];

function reachOptions(cwd, overrides) {
	return { cwd, deferredModuleRules: [], heavyImportRules: THREE_RULE, ...NO_TREE_RULES, routeShellFiles: ["app/page.tsx"], ...overrides };
}

test("a heavy runtime reached through any depth of static imports fails unless the baseline lists it", () => {
	withWorkspace({
		"app/page.tsx": 'import Shell from "@/components/shell";\nexport default Shell;\n',
		"components/shell.tsx": 'import Scene from "./scene";\nexport default function Shell() { void import("./later"); return Scene; }\n',
		"components/scene.tsx": 'import * as THREE from "three";\nexport default THREE;\n',
		"components/later.tsx": 'import "three";\n',
	}, (cwd) => {
		const failures = verifyLazyLoadBoundaries(reachOptions(cwd, { heavyReachBaseline: {} }));
		assert.deepEqual(failures.map((failure) => [failure.type, failure.filePath, failure.source]), [["heavy-reach-new", "app/page.tsx", "three"]]);
		assert.deepEqual(failures[0].dependencyPath, ["app/page.tsx", "components/shell.tsx", "components/scene.tsx", "three"]);
		assert.match(formatFailure(failures[0]), /now reaches WebGL runtime/u);

		assert.deepEqual(verifyLazyLoadBoundaries(reachOptions(cwd, { heavyReachBaseline: { "app/page.tsx": ["three"] } })), []);

		writeFileSync(path.join(cwd, "components/shell.tsx"), 'export default function Shell() { void import("./scene"); return null; }\n');
		const stale = verifyLazyLoadBoundaries(reachOptions(cwd, { heavyReachBaseline: { "app/page.tsx": ["three"] } }));
		assert.deepEqual(stale.map((failure) => [failure.type, failure.source]), [["heavy-reach-stale", "three"]]);
		assert.match(formatFailure(stale[0]), /--update-baseline/u);
	});
});

test("the transitive walk survives import cycles and fails instead of truncating past its bound", () => {
	withWorkspace({
		"app/page.tsx": 'import "@/components/a";\n',
		"components/a.ts": 'import "./b";\nexport const a = 1;\n',
		"components/b.ts": 'import "./a";\nimport "three";\nexport const b = 1;\n',
	}, (cwd) => {
		const readSpecifiers = (filePath) => {
			const source = require("node:fs").readFileSync(path.join(cwd, filePath), "utf8");
			return [...source.matchAll(/import "([^"]+)"/gu)].map((match) => match[1]);
		};
		const result = collectReachableHeavyImports({ cwd, entryFile: "app/page.tsx", heavyImportRules: THREE_RULE, readSpecifiers });
		assert.equal(result.exceeded, false);
		assert.equal(result.visited, 3);
		assert.deepEqual(result.reached.get("three").chain, ["app/page.tsx", "components/a.ts", "components/b.ts", "three"]);

		const bounded = verifyLazyLoadBoundaries(reachOptions(cwd, { heavyReachBaseline: {}, maxReachableModules: 2 }));
		assert.deepEqual(bounded.map((failure) => failure.type), ["heavy-reach-bound-exceeded"]);
	});
});

test("a page that renders a demo through loadDemoComponent is checked through the demo's module", () => {
	withWorkspace({
		"app/butter/page.tsx": 'const Demo = use(loadDemoComponent("butter", "projects"));\n',
		"app/missing/page.tsx": 'const Demo = use(loadDemoComponent("missing", "projects"));\n',
		"components/website/registry/projects.ts": 'export const PROJECT_DEMOS = {\n\tbutter: dynamic(() => import("../demos/projects/butter-demo"), { ssr: false }),\n};\n',
		"components/website/demos/projects/butter-demo.tsx": 'import "three";\nexport default function ButterDemo() { return null; }\n',
	}, (cwd) => {
		assert.deepEqual(resolveDemoEntryFiles({ cwd, entryFiles: ["app/butter/page.tsx", "app/missing/page.tsx"] }), {
			resolved: [{ demoFile: "components/website/demos/projects/butter-demo.tsx", entryFile: "app/butter/page.tsx" }],
			unresolved: [{ category: "projects", entryFile: "app/missing/page.tsx", slug: "missing" }],
		});
		const failures = verifyLazyLoadBoundaries(reachOptions(cwd, { heavyReachBaseline: {}, routeShellFiles: ["app/butter/page.tsx", "app/missing/page.tsx"] }));
		assert.deepEqual(failures.map((failure) => [failure.type, failure.filePath]), [
			["unresolved-demo-entry", "app/missing/page.tsx"],
			["heavy-reach-new", "app/butter/page.tsx -> components/website/demos/projects/butter-demo.tsx"],
		]);
	});
});

test("a package's stylesheet rule covers every .css path it ships, from TS and from CSS", () => {
	const singleOwnerImports = [{ match: "stylesheet", ownerFile: "components/math.ts", reason: "KaTeX CSS loads with the math plugin", source: "katex" }];
	withWorkspace({
		"app/layout.tsx": 'import "katex/dist/katex.css";\nimport katex from "katex";\nexport default function Layout() { return katex; }\n',
		"app/globals.css": '@import "../node_modules/katex/dist/contrib/copy-tex.css";\n',
		"components/math.ts": 'import "katex/dist/katex.min.css";\n',
		"components/not-katex.ts": 'import "katex-extra/style.css";\n',
	}, (cwd) => {
		const failures = verifyLazyLoadBoundaries({ cwd, deferredModuleRules: [], fileImportRules: [], heavyImportRules: [], lazyOnlyModules: [], routeShellFiles: [], singleOwnerImports });
		assert.deepEqual(failures.map((failure) => [failure.filePath, failure.importPath]), [
			["app/globals.css", "../node_modules/katex/dist/contrib/copy-tex.css"],
			["app/layout.tsx", "katex/dist/katex.css"],
		]);
	});
});

test("a package rule matches the package and its subpaths, not a package that shares its prefix", () => {
	const rules = [{ match: "package", reason: "charting runtime", source: "recharts" }];
	assert.equal(getRuleForImport("recharts", rules)?.source, "recharts");
	assert.equal(getRuleForImport("recharts/lib/util", rules)?.source, "recharts");
	assert.equal(getRuleForImport("recharts-scale", rules), null);
});

test("reach-tracked runtimes are baselined on reach but stay allowed in a shell's own imports", () => {
	const reachTrackedRules = [{ match: "package", reason: "charting runtime", source: "recharts" }];
	withWorkspace({
		"app/rovo/page.tsx": 'import { LineChart } from "recharts";\nexport default LineChart;\n',
		"app/page.tsx": 'import Home from "@/components/home";\nexport default Home;\n',
		"components/home.tsx": "export default function Home() { return null; }\n",
	}, (cwd) => {
		const options = { cwd, deferredModuleRules: [], heavyImportRules: [], ...NO_TREE_RULES, reachTrackedRules, routeShellFiles: ["app/page.tsx", "app/rovo/page.tsx"] };
		assert.deepEqual(verifyLazyLoadBoundaries({ ...options, heavyReachBaseline: { "app/rovo/page.tsx": ["recharts"] } }), []);

		writeFileSync(path.join(cwd, "components/home.tsx"), 'import "recharts";\nexport default function Home() { return null; }\n');
		const failures = verifyLazyLoadBoundaries({ ...options, heavyReachBaseline: { "app/rovo/page.tsx": ["recharts"] } });
		assert.deepEqual(failures.map((failure) => [failure.type, failure.filePath, failure.source]), [["heavy-reach-new", "app/page.tsx", "recharts"]]);
	});
});

test("the C-8f reach-tracked runtimes are streamdown and its plugins, katex, mermaid, recharts and the logo maps", () => {
	assert.deepEqual(DEFAULT_REACH_TRACKED_RULES.map((rule) => `${rule.match}:${rule.source}`), [
		"package:streamdown",
		"prefix:@streamdown/",
		"package:katex",
		"package:mermaid",
		"package:recharts",
		"package:@atlassian/logo-third-party",
		"package:@atlaskit/logo",
	]);
	assert.equal(getRuleForImport("@atlaskit/logo-extra", DEFAULT_REACH_TRACKED_RULES), null);
});

test("a ui demo resolves through the ui registry's primary table", () => {
	withWorkspace({
		"app/button/page.tsx": 'const Demo = use(loadDemoComponent("button", "ui"));\n',
		"components/website/registry/ui.ts": 'import { UI_PRIMARY_DEMOS } from "./ui/primary";\nexport const UI_DEMO = { ...UI_PRIMARY_DEMOS };\n',
		"components/website/registry/ui/primary.ts": 'export const UI_PRIMARY_DEMOS = {\n\tbutton: dynamic(() => import("../../demos/ui/button-demo"), { ssr: false }),\n};\n',
		"components/website/demos/ui/button-demo.tsx": "export default function ButtonDemo() { return null; }\n",
	}, (cwd) => {
		assert.deepEqual(resolveDemoEntryFiles({ cwd, entryFiles: ["app/button/page.tsx"] }), {
			resolved: [{ demoFile: "components/website/demos/ui/button-demo.tsx", entryFile: "app/button/page.tsx" }],
			unresolved: [],
		});
	});
});
