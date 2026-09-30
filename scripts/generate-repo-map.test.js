const assert = require("node:assert/strict");
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
	buildComponentMap,
	buildRepoMap,
	buildTestSliceMap,
	checkRepoMap,
	collectAppPageOwnerErrors,
	collectAppPageRoutes,
	collectLocalSkills,
	extractExplicitNodeTestFiles,
	extractPrefixSelections,
	routePathFromPageFile,
	serializeRepoMap,
	stripSourceLocation,
	writeRepoMap,
} = require("./generate-repo-map");

const ROUTE_MANIFEST = {
	version: 1,
	backendRoutes: [
		{
			method: "POST",
			path: "/api/jobs",
			runtimeAdmin: true,
			source: "backend/routes/jobs.js:42",
		},
		{
			method: "GET",
			path: "/api/jobs",
			runtimeAdmin: false,
			source: "backend/routes/jobs.js:12",
		},
	],
	nextApiRoutes: [
		{
			method: "POST",
			nextPath: "/api/jobs",
			source: "app/api/jobs/route.ts:9",
			targets: [
				{
					method: "POST",
					path: "/api/jobs",
					source: "app/api/jobs/route.ts:18",
				},
			],
		},
	],
};

const COMPONENTS = [
	{
		category: "ui",
		importPath: "@/components/ui/button",
		name: "Button",
		slug: "button",
	},
	{
		category: "blocks",
		importPath: "@/components/blocks/agent",
		name: "Agent",
		slug: "agent",
	},
];

const APP_PAGE_ROUTES = [
	{
		ownerCount: 1,
		owners: [{
			importPath: "@/components/projects/rovo/page",
			source: "components/projects/rovo/page",
			symbols: ["RovoPage"],
		}],
		primaryOwner: {
			kind: "shell",
			sources: ["components/projects/rovo/page"],
		},
		routePath: "/rovo/[[...id]]",
		shellOwnerCount: 1,
		shellOwners: [{
			importPath: "@/components/projects/rovo/page",
			source: "components/projects/rovo/page",
			symbols: ["RovoPage"],
		}],
		source: "app/rovo/[[...id]]/page.tsx",
	},
];

const PACKAGE_JSON = {
	scripts: {
		"test:backend": "node scripts/run-js-unit-tests.mjs --prefix backend/",
		"test:catalog": "node --test scripts/verify-component-catalog.test.js && node scripts/run-js-unit-tests.mjs --prefix app/data/",
		"test:unit:js": "node scripts/run-js-unit-tests.mjs",
	},
};

const LOCAL_SKILLS = [
	{
		description: "Tidy VPK components.",
		name: "vpk-tidy",
		path: ".agents/skills/vpk-tidy/SKILL.md",
		validationCommand: "node scripts/validate-skills.js --target .agents/skills/vpk-tidy",
	},
];

test("strips line and column suffixes from source locations", () => {
	assert.equal(stripSourceLocation("backend/server.js:10"), "backend/server.js");
	assert.equal(stripSourceLocation("app/api/demo/route.ts:10:2"), "app/api/demo/route.ts");
	assert.equal(stripSourceLocation("backend/server.js"), "backend/server.js");
});

test("builds deterministic route owners and component categories", () => {
	const repoMap = buildRepoMap({
		appPageRoutes: APP_PAGE_ROUTES,
		componentManifestEntry: "app/data/component-manifest.ts",
		components: COMPONENTS,
		localSkills: LOCAL_SKILLS,
		packageJson: PACKAGE_JSON,
		routeManifest: ROUTE_MANIFEST,
		routeManifestPath: "backend/routes/route-manifest.json",
	});

	assert.deepEqual(repoMap.routes.summary, {
		backendRouteCount: 2,
		nextApiRouteCount: 1,
		ownerCount: 2,
		runtimeAdminRouteCount: 1,
	});
	assert.deepEqual(repoMap.routes.owners.map((owner) => `${owner.kind}:${owner.owner}`), [
		"backend:backend/routes/jobs.js",
		"next-api:app/api/jobs/route.ts",
	]);
	assert.deepEqual(repoMap.routes.owners[0].routes.map((route) => `${route.method} ${route.path}`), [
		"GET /api/jobs",
		"POST /api/jobs",
	]);
	assert.deepEqual(repoMap.components.categories.map((category) => `${category.category}:${category.entryCount}`), [
		"blocks:1",
		"ui:1",
	]);
	assert.deepEqual(repoMap.components.summary.statusCounts, { live: 2, frozen: 0, superseded: 0 });
	assert.deepEqual(repoMap.appPages.summary, {
		ownerImportCount: 1,
		pageCount: 1,
		primaryOwnerKinds: { shell: 1 },
	});
	assert.equal(repoMap.testSlices.summary.sliceCount, 3);
	assert.deepEqual(repoMap.testSlices.slices.find((slice) => slice.name === "test:backend").prefixes, ["backend/"]);
	assert.deepEqual(repoMap.testSlices.slices.find((slice) => slice.name === "test:catalog").files, ["scripts/verify-component-catalog.test.js"]);
	assert.equal(
		repoMap.validationCommands.some((command) => command.command === "pnpm run perf:budget:warn"),
		true,
	);
	assert.deepEqual(repoMap.skills.summary, {
		localSkillCount: 1,
	});
});

test("records catalog lifecycle status (default live) with basedOn and note only when declared", () => {
	const componentMap = buildComponentMap([
		{
			category: "projects",
			importPath: "@/components/projects/jira-golden-journeys-v4",
			name: "Jira Golden Journeys v4",
			slug: "jira-golden-journeys-v4",
			status: "superseded",
			basedOn: "jira-golden-journeys-v3",
			note: "Superseded by jira-team-eu26.",
		},
		{
			category: "projects",
			importPath: "@/components/projects/jira-golden-journeys-v3",
			name: "Jira Golden Journeys v3",
			slug: "jira-golden-journeys-v3",
			status: "frozen",
		},
		...COMPONENTS,
	]);

	assert.deepEqual(componentMap.summary.statusCounts, { live: 2, frozen: 1, superseded: 1 });
	assert.deepEqual(componentMap.categories.find((group) => group.category === "projects").entries, [
		{
			category: "projects",
			slug: "jira-golden-journeys-v3",
			name: "Jira Golden Journeys v3",
			importPath: "@/components/projects/jira-golden-journeys-v3",
			status: "frozen",
		},
		{
			category: "projects",
			slug: "jira-golden-journeys-v4",
			name: "Jira Golden Journeys v4",
			importPath: "@/components/projects/jira-golden-journeys-v4",
			status: "superseded",
			basedOn: "jira-golden-journeys-v3",
			note: "Superseded by jira-team-eu26.",
		},
	]);
	assert.deepEqual(componentMap.categories.find((group) => group.category === "ui").entries, [{
		category: "ui",
		slug: "button",
		name: "Button",
		importPath: "@/components/ui/button",
		status: "live",
	}]);
});

test("extracts test-slice selections from package scripts", () => {
	assert.deepEqual(extractPrefixSelections("node scripts/run-js-unit-tests.mjs --prefix backend/,app/api/"), [
		"app/api/",
		"backend/",
	]);
	assert.deepEqual(extractExplicitNodeTestFiles("node --test scripts/a.test.js scripts/b.test.ts && node other.js"), [
		"scripts/a.test.js",
		"scripts/b.test.ts",
	]);
	assert.deepEqual(buildTestSliceMap(PACKAGE_JSON).slices.map((slice) => slice.name), [
		"test:backend",
		"test:catalog",
		"test:unit:js",
	]);
});

test("collects app page owners from local page imports", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-repo-map-pages-"));
	try {
		const pageDir = path.join(cwd, "app/rovo/[[...id]]");
		mkdirSync(pageDir, { recursive: true });
		writeFileSync(path.join(pageDir, "page.tsx"), [
			'import RovoPage from "@/components/projects/rovo/page";',
			'import { HOME_COMPONENTS } from "@/app/data/components";',
			'import { getProjectPageTitle } from "@/lib/project-page-title";',
			"",
			"export default function Page() {",
			"\treturn <RovoPage components={HOME_COMPONENTS} title={getProjectPageTitle('Rovo')} />;",
			"}",
			"",
		].join("\n"));

		assert.equal(routePathFromPageFile("app/rovo/[[...id]]/page.tsx"), "/rovo/[[...id]]");
		assert.deepEqual(collectAppPageRoutes({ cwd }), [{
			ownerCount: 2,
			owners: [{
				importPath: "@/app/data/components",
				source: "app/data/components",
				symbols: ["HOME_COMPONENTS"],
			}, {
				importPath: "@/components/projects/rovo/page",
				source: "components/projects/rovo/page",
				symbols: ["RovoPage"],
			}],
			primaryOwner: {
				kind: "shell",
				sources: ["components/projects/rovo/page"],
			},
			routePath: "/rovo/[[...id]]",
			shellOwnerCount: 1,
			shellOwners: [{
				importPath: "@/components/projects/rovo/page",
				source: "components/projects/rovo/page",
				symbols: ["RovoPage"],
			}],
			source: "app/rovo/[[...id]]/page.tsx",
		}]);
	} finally {
		rmSync(cwd, { force: true, recursive: true });
	}
});

const CATALOG_COMPONENTS = [
	{
		category: "projects",
		importPath: "@/components/projects/jira-team-eu26-end",
		name: "Jira Team EU26 End",
		slug: "jira-team-eu26-end",
		basedOn: "jira-team-eu26",
		note: "Keynote closing board.",
	},
	{
		category: "arts",
		importPath: "@/components/arts/awake",
		name: "Awake",
		slug: "awake",
	},
];

const CATALOG_REGISTRY_DATA = {
	primary: {
		projects: {
			"jira-team-eu26-end": {
				imports: [{
					importPath: "../demos/projects/jira-team-eu26-end-demo",
					sourceFile: "components/website/registry/projects.ts",
				}],
			},
		},
	},
	variants: {},
};

function writeFixtureFile(cwd, relativePath, lines) {
	mkdirSync(path.dirname(path.join(cwd, relativePath)), { recursive: true });
	writeFileSync(path.join(cwd, relativePath), `${lines.join("\n")}\n`);
}

function writeLoaderPage(cwd, pageDir, loaderCall) {
	writeFixtureFile(cwd, `${pageDir}/page.tsx`, [
		'"use client";',
		'import { Suspense, createElement, use } from "react";',
		'import { loadDemoComponent as loadDemo } from "@/components/website/demo-registry-loader";',
		"",
		"function Content() {",
		`\tconst Demo = use(${loaderCall});`,
		"\treturn Demo ? createElement(Demo) : null;",
		"}",
		"",
		"export default function Page() {",
		"\treturn <Suspense><Content /></Suspense>;",
		"}",
	]);
}

test("resolves literal demo loader pages to their catalog source and registry demo", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-repo-map-loader-"));
	try {
		writeLoaderPage(cwd, "app/jira-team-eu26-end", 'loadDemo("jira-team-eu26-end", "projects")');
		writeFixtureFile(cwd, "components/projects/jira-team-eu26-end/page.tsx", ["export default function Page() { return null; }"]);
		writeFixtureFile(cwd, "components/website/demos/projects/jira-team-eu26-end-demo.tsx", ["export default function Demo() { return null; }"]);

		const [page] = collectAppPageRoutes({
			components: CATALOG_COMPONENTS,
			cwd,
			registryData: CATALOG_REGISTRY_DATA,
		});

		assert.equal(page.routePath, "/jira-team-eu26-end");
		assert.deepEqual(page.shellOwners, []);
		assert.deepEqual(page.owners.map((owner) => owner.source), ["components/website/demo-registry-loader"]);
		assert.deepEqual(page.primaryOwner, {
			kind: "catalog",
			category: "projects",
			slug: "jira-team-eu26-end",
			status: "live",
			basedOn: "jira-team-eu26",
			loader: "loadDemoComponent",
			source: "components/projects/jira-team-eu26-end",
			entry: "components/projects/jira-team-eu26-end/page.tsx",
			demo: "components/website/demos/projects/jira-team-eu26-end-demo.tsx",
		});
		assert.deepEqual(collectAppPageOwnerErrors([page]), []);
	} finally {
		rmSync(cwd, { force: true, recursive: true });
	}
});

test("fails generation and check when a literal loader slug has no catalog entry", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-repo-map-unknown-slug-"));
	try {
		writeFixtureFile(cwd, "backend/routes/route-manifest.json", [JSON.stringify(ROUTE_MANIFEST)]);
		writeLoaderPage(cwd, "app/missing-demo", 'loadDemo("missing-demo", "projects")');

		const pages = collectAppPageRoutes({ components: CATALOG_COMPONENTS, cwd, registryData: CATALOG_REGISTRY_DATA });
		assert.deepEqual(collectAppPageOwnerErrors(pages), [
			'app/missing-demo/page.tsx: loadDemoComponent(slug: "missing-demo", category: "projects") has no matching catalog entry in app/data/component-manifest.ts.',
		]);

		const options = {
			components: CATALOG_COMPONENTS,
			cwd,
			localSkills: [],
			outputPath: ".agents/knowledge/repo-map.json",
			packageJson: PACKAGE_JSON,
			registryData: CATALOG_REGISTRY_DATA,
		};
		const expectedError = /Cannot resolve 1 catalog-backed app page owner\(s\)[\s\S]*app\/missing-demo\/page\.tsx: loadDemoComponent\(slug: "missing-demo", category: "projects"\)/u;
		assert.throws(() => checkRepoMap(options), expectedError);
		assert.throws(() => writeRepoMap(options), expectedError);
	} finally {
		rmSync(cwd, { force: true, recursive: true });
	}
});

test("marks dynamic catalog routes without guessing a slug and classifies redirect and inline pages", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-repo-map-dynamic-"));
	try {
		writeFixtureFile(cwd, "app/preview/projects/[slug]/page.tsx", [
			'import { RenderPreviewCategoryPage } from "@/app/preview/_shared/render-preview-category-page";',
			"",
			"export default async function Page({ params }: { params: Promise<{ slug: string }> }) {",
			"\tconst { slug } = await params;",
			'\treturn <RenderPreviewCategoryPage slug={slug} category="projects" />;',
			"}",
		]);
		writeLoaderPage(cwd, "app/preview/arts/[slug]", 'loadDemo(slug, "arts")');
		writeFixtureFile(cwd, "app/weather/page.tsx", [
			'import { redirect } from "next/navigation";',
			"",
			"export default function Page() {",
			'\tredirect("/awake");',
			"}",
		]);
		writeFixtureFile(cwd, "app/shadows/page.tsx", [
			"export default function Page() {",
			'\treturn <div className="shadow-md" />;',
			"}",
		]);

		const pages = collectAppPageRoutes({ components: CATALOG_COMPONENTS, cwd, registryData: CATALOG_REGISTRY_DATA });
		assert.deepEqual(
			Object.fromEntries(pages.map((page) => [page.routePath, page.primaryOwner])),
			{
				"/preview/arts/[slug]": { kind: "dynamic", dynamic: "catalog", category: "arts", loader: "loadDemoComponent" },
				"/preview/projects/[slug]": { kind: "dynamic", dynamic: "catalog", category: "projects", loader: "RenderPreviewCategoryPage" },
				"/shadows": { kind: "inline", source: "app/shadows/page.tsx" },
				"/weather": { kind: "redirect", to: "/awake" },
			},
		);
		assert.deepEqual(collectAppPageOwnerErrors(pages), []);

		writeFixtureFile(cwd, "app/preview/unknown/[slug]/page.tsx", [
			'import { RenderPreviewCategoryPage } from "@/app/preview/_shared/render-preview-category-page";',
			"",
			"export default function Page({ slug }: { slug: string }) {",
			'\treturn <RenderPreviewCategoryPage slug={slug} category="not-a-category" />;',
			"}",
		]);
		assert.deepEqual(collectAppPageOwnerErrors(collectAppPageRoutes({ components: CATALOG_COMPONENTS, cwd })), [
			'app/preview/unknown/[slug]/page.tsx: RenderPreviewCategoryPage(slug: <dynamic>, category: "not-a-category") references a category with no entries in app/data/component-manifest.ts.',
		]);
	} finally {
		rmSync(cwd, { force: true, recursive: true });
	}
});

test("collects local skill metadata from skill frontmatter", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-repo-map-skills-"));
	try {
		const skillDir = path.join(cwd, ".agents/skills/vpk-tidy");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(path.join(skillDir, "SKILL.md"), [
			"---",
			"name: vpk-tidy",
			"description: Tidy VPK components.",
			"---",
			"",
			"# VPK Tidy",
			"",
		].join("\n"));

		assert.deepEqual(collectLocalSkills({ cwd }), LOCAL_SKILLS);
	} finally {
		rmSync(cwd, { force: true, recursive: true });
	}
});

test("collects block-scalar skill descriptions for the repo map", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-repo-map-skills-block-"));
	try {
		const blockSkillDir = path.join(cwd, ".agents/skills/vpk-setup");
		const inlineSkillDir = path.join(cwd, ".agents/skills/vpk-system-clean");
		mkdirSync(blockSkillDir, { recursive: true });
		mkdirSync(inlineSkillDir, { recursive: true });
		writeFileSync(path.join(blockSkillDir, "SKILL.md"), [
			"---",
			"name: vpk-setup",
			"description: >-",
			"  Set up a VPK worktree with the right package manager, env files,",
			"  and local validation commands.",
			"---",
			"",
			"# VPK Setup",
			"",
		].join("\n"));
		writeFileSync(path.join(inlineSkillDir, "SKILL.md"), [
			"---",
			"name: vpk-system-clean",
			"description: Diagnose local-dev CPU/RAM issues,",
			"  clear oversized caches, and restart runaway dev servers.",
			"---",
			"",
			"# VPK System Clean",
			"",
		].join("\n"));

		assert.deepEqual(collectLocalSkills({ cwd }), [{
			description: "Set up a VPK worktree with the right package manager, env files, and local validation commands.",
			name: "vpk-setup",
			path: ".agents/skills/vpk-setup/SKILL.md",
			validationCommand: "node scripts/validate-skills.js --target .agents/skills/vpk-setup",
		}, {
			description: "Diagnose local-dev CPU/RAM issues, clear oversized caches, and restart runaway dev servers.",
			name: "vpk-system-clean",
			path: ".agents/skills/vpk-system-clean/SKILL.md",
			validationCommand: "node scripts/validate-skills.js --target .agents/skills/vpk-system-clean",
		}]);
	} finally {
		rmSync(cwd, { force: true, recursive: true });
	}
});

test("check mode compares generated output without rewriting", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-repo-map-check-"));
	try {
		mkdirSync(path.join(cwd, "backend/routes"), { recursive: true });
		mkdirSync(path.join(cwd, ".agents/knowledge"), { recursive: true });
		writeFileSync(
			path.join(cwd, "backend/routes/route-manifest.json"),
			`${JSON.stringify(ROUTE_MANIFEST, null, "\t")}\n`,
		);

		writeRepoMap({
			appPageRoutes: APP_PAGE_ROUTES,
			components: COMPONENTS,
			cwd,
			localSkills: LOCAL_SKILLS,
			outputPath: ".agents/knowledge/repo-map.json",
			packageJson: PACKAGE_JSON,
			routeManifestPath: "backend/routes/route-manifest.json",
		});

		assert.equal(checkRepoMap({
			appPageRoutes: APP_PAGE_ROUTES,
			components: COMPONENTS,
			cwd,
			localSkills: LOCAL_SKILLS,
			outputPath: ".agents/knowledge/repo-map.json",
			packageJson: PACKAGE_JSON,
			routeManifestPath: "backend/routes/route-manifest.json",
		}).isCurrent, true);

		writeFileSync(path.join(cwd, ".agents/knowledge/repo-map.json"), serializeRepoMap({ stale: true }));

		assert.equal(checkRepoMap({
			appPageRoutes: APP_PAGE_ROUTES,
			components: COMPONENTS,
			cwd,
			localSkills: LOCAL_SKILLS,
			outputPath: ".agents/knowledge/repo-map.json",
			packageJson: PACKAGE_JSON,
			routeManifestPath: "backend/routes/route-manifest.json",
		}).isCurrent, false);
	} finally {
		rmSync(cwd, { force: true, recursive: true });
	}
});
