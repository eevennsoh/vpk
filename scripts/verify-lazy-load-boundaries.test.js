const assert = require("node:assert/strict");
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { gateRunsScript } = require("./lib/package-gates.js");

const {
	DEFAULT_DEFERRED_MODULE_RULES,
	DEFAULT_ROUTE_SHELL_FILES,
	collectHeavyStaticImportsFromSource,
	createHeavyImportRule,
	formatFailure,
	getRuleForImport,
	parseArgs,
	verifyLazyLoadBoundaries,
} = require("./verify-lazy-load-boundaries");

test("parseArgs supports route shell and heavy import overrides", () => {
	assert.deepEqual(parseArgs(["--file", "app/page.tsx", "--heavy-import", "three"]), {
		help: false,
		heavyImportRules: [{
			match: "exact",
			reason: "configured heavy runtime",
			source: "three",
		}],
		routeShellFiles: ["app/page.tsx"],
	});
	assert.deepEqual(parseArgs(["--file=app/studio/page.tsx", "--heavy-import=@tiptap/*"]), {
		help: false,
		heavyImportRules: [{
			match: "prefix",
			reason: "configured heavy runtime",
			source: "@tiptap/",
		}],
		routeShellFiles: ["app/studio/page.tsx"],
	});
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
			routeShellFiles: [],
		}), []);

		writeFileSync(path.join(cwd, boundaryFile), 'import Deferred from "@/components/deferred";\nexport default Deferred;\n');
		const failures = verifyLazyLoadBoundaries({
			cwd,
			deferredModuleRules: rule,
			heavyImportRules: [],
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
			entryFile: "components/projects/jira-golden-journeys-v2/page.tsx",
			reason: "the Jira pull request review subtree must stay out of the initial project bundle",
			targetFile: "components/blocks/jira-work-item/experimental-v2/components/pull-request-detail/pull-request-detail-view.tsx",
		},
		{
			entryFile: "components/projects/jira-golden-journeys-v2/page.tsx",
			reason: "the contextual pull request rail must stay out of the initial project bundle",
			targetFile: "components/blocks/jira-work-item/experimental-v2/components/pull-request-detail/pull-request-context-rail.tsx",
		},
		{
			entryFile: "components/projects/jira-golden-journeys-v3/page.tsx",
			reason: "the Jira pull request review subtree must stay out of the initial project bundle",
			targetFile: "components/blocks/jira-work-item/experimental-v3/components/pull-request-detail/pull-request-detail-view.tsx",
		},
		{
			entryFile: "components/projects/jira-golden-journeys-v3/page.tsx",
			reason: "the contextual pull request rail must stay out of the initial project bundle",
			targetFile: "components/blocks/jira-work-item/experimental-v3/components/pull-request-detail/pull-request-context-rail.tsx",
		},
{
			entryFile: "components/projects/jira-golden-journeys-v4/page.tsx",
			reason: "the Jira pull request review subtree must stay out of the initial project bundle",
			targetFile: "components/blocks/jira-work-item/experimental-v4/components/pull-request-detail/pull-request-detail-view.tsx",
		},
{
			entryFile: "components/projects/jira-golden-journeys-v4/page.tsx",
			reason: "the contextual pull request rail must stay out of the initial project bundle",
			targetFile: "components/blocks/jira-work-item/experimental-v4/components/pull-request-detail/pull-request-context-rail.tsx",
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
