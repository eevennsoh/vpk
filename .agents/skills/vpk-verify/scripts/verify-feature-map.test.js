const assert = require("node:assert/strict");
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
	verifyFeatureMap,
} = require("./verify-feature-map");

const REQUIRED_SECTIONS = [
	"Sub-features",
	"How to get to it (user POV)",
	"Driving it with control-vpk",
	"Gotchas",
];

function writeFixture({
	features = {},
	indexEntries = Object.keys(features),
	routes = ["/", "/studio"],
	projects = [],
	catalogProjects = projects,
	uncoveredLines = [],
} = {}) {
	const root = mkdtempSync(path.join(os.tmpdir(), "vpk-feature-map-"));
	const featuresDir = path.join(root, "features");
	const projectsDir = path.join(root, "projects");
	mkdirSync(featuresDir, { recursive: true });
	mkdirSync(projectsDir, { recursive: true });
	for (const project of projects) {
		mkdirSync(path.join(projectsDir, project));
	}
	writeFileSync(path.join(projectsDir, "page.tsx"), "export {};\n");
	writeFileSync(
		path.join(featuresDir, "README.md"),
		[
			"# Fixture map",
			"",
			"## Features",
			"",
			...indexEntries.map((name) => `- [${name}](./${name}.md)`),
			"",
			"## Uncovered projects",
			"",
			...uncoveredLines,
			"",
		].join("\n"),
	);
	for (const [name, content] of Object.entries(features)) {
		writeFileSync(path.join(featuresDir, `${name}.md`), content);
	}
	const repoMapPath = path.join(root, "repo-map.json");
	writeFileSync(
		repoMapPath,
		`${JSON.stringify({
			appPages: {
				pages: routes.map((routePath) => ({ routePath })),
			},
			components: {
				categories: catalogProjects.length === 0 ? [] : [{
					category: "projects",
					entries: catalogProjects.map((slug) => ({
						category: "projects",
						importPath: `@/components/projects/${slug}`,
						slug,
					})),
				}],
			},
		})}\n`,
	);
	return { featuresDir, projectsDir, repoMapPath, root };
}

function feature({ id = "fixture-open", route = "/studio", sections = REQUIRED_SECTIONS } = {}) {
	const bodyBySection = {
		"Sub-features": `- \`${id}\` opens the fixture.`,
		"How to get to it (user POV)": `- Open \`${route}\`.`,
		"Driving it with control-vpk": "Preconditions:\n\n- Doctor is healthy.",
		Gotchas: "- None.",
	};
	return [
		"# Fixture feature",
		"",
		"Fixture behavior.",
		"",
		...sections.flatMap((section) => [
			`## ${section}`,
			"",
			bodyBySection[section] ?? "- Unexpected.",
			"",
		]),
	].join("\n");
}

test("accepts an indexed feature map with unique IDs and resolvable routes", () => {
	const fixture = writeFixture({
		features: {
			studio: feature(),
		},
	});
	try {
		const report = verifyFeatureMap(fixture);
		assert.equal(report.ok, true);
		assert.deepEqual(report.failures, []);
		assert.equal(report.featureCount, 1);
		assert.equal(report.subFeatureCount, 1);
		assert.deepEqual(report.entryRoutes, ["/studio"]);
	} finally {
		rmSync(fixture.root, { force: true, recursive: true });
	}
});

test("rejects missing, duplicate, and unindexed feature entries", () => {
	const fixture = writeFixture({
		features: {
			orphan: feature(),
		},
		indexEntries: ["missing", "missing"],
	});
	try {
		const report = verifyFeatureMap(fixture);
		assert.equal(report.ok, false);
		assert.deepEqual(
			new Set(report.failures.map((failure) => failure.type)),
			new Set(["feature-index-duplicate", "feature-index-missing-file", "feature-file-unindexed"]),
		);
	} finally {
		rmSync(fixture.root, { force: true, recursive: true });
	}
});

test("rejects malformed section order and duplicate sub-feature IDs", () => {
	const fixture = writeFixture({
		features: {
			alpha: feature({ id: "shared-id" }),
			beta: feature({
				id: "shared-id",
				sections: [
					"Sub-features",
					"Driving it with control-vpk",
					"How to get to it (user POV)",
					"Gotchas",
				],
			}),
		},
	});
	try {
		const report = verifyFeatureMap(fixture);
		assert.equal(report.ok, false);
		assert.deepEqual(
			new Set(report.failures.map((failure) => failure.type)),
			new Set(["feature-section-contract", "sub-feature-id-duplicate"]),
		);
	} finally {
		rmSync(fixture.root, { force: true, recursive: true });
	}
});

test("rejects a user-entry route that the generated repo map cannot resolve", () => {
	const fixture = writeFixture({
		features: {
			missing: feature({ route: "/not-a-vpk-route" }),
		},
	});
	try {
		const report = verifyFeatureMap(fixture);
		assert.equal(report.ok, false);
		assert.deepEqual(report.failures, [{
			file: "missing.md",
			message: "User-entry route is not present in the generated repo map: /not-a-vpk-route",
			type: "feature-entry-route-unresolved",
		}]);
	} finally {
		rmSync(fixture.root, { force: true, recursive: true });
	}
});

test("accepts concrete URLs matched by generated dynamic route patterns", () => {
	const fixture = writeFixture({
		features: {
			"skill-detail": feature({ id: "skill-detail", route: "/rovo/skills/app/my-skill" }),
			"studio-child": feature({ id: "studio-child", route: "/studio/foo" }),
		},
		routes: ["/studio/[[...id]]", "/rovo/skills/[category]/[name]"],
	});
	try {
		const report = verifyFeatureMap(fixture);
		assert.equal(report.ok, true);
		assert.deepEqual(report.failures, []);
	} finally {
		rmSync(fixture.root, { force: true, recursive: true });
	}
});

test("rejects a project directory that no recipe covers and the index does not list", () => {
	const fixture = writeFixture({
		features: { studio: feature() },
		projects: ["alpha", "studio"],
		routes: ["/", "/alpha", "/studio"],
	});
	try {
		const report = verifyFeatureMap(fixture);
		assert.equal(report.ok, false);
		assert.deepEqual(report.failures.map((failure) => [failure.file, failure.type]), [
			["components/projects/alpha", "project-coverage-missing"],
		]);
		assert.match(report.failures[0].message, /\/alpha, \/preview\/projects\/alpha/u);
		assert.match(report.failures[0].message, /## Uncovered projects in README\.md/u);
		assert.deepEqual(report.projects.covered, ["studio"]);
	} finally {
		rmSync(fixture.root, { force: true, recursive: true });
	}
});

test("accepts projects covered through a dynamic route or listed as uncovered with a reason", () => {
	const fixture = writeFixture({
		features: { studio: feature() },
		projects: ["alpha", "shared", "studio"],
		catalogProjects: ["alpha", "studio"],
		routes: ["/", "/studio/[[...id]]"],
		uncoveredLines: ["- `alpha`: Needs a backend-gated recipe."],
	});
	try {
		const report = verifyFeatureMap(fixture);
		assert.deepEqual(report.failures, []);
		assert.equal(report.ok, true);
		assert.deepEqual(report.projects, {
			covered: ["studio"],
			excluded: ["shared"],
			uncovered: ["alpha"],
		});
	} finally {
		rmSync(fixture.root, { force: true, recursive: true });
	}
});

test("rejects stale uncovered entries for covered, deleted, or library projects and reason-less entries", () => {
	const fixture = writeFixture({
		features: { studio: feature() },
		projects: ["beta", "studio"],
		uncoveredLines: [
			"- `studio`: Was uncovered before its recipe landed.",
			"- `gone`: Deleted project.",
			"- `shared`: Library code.",
			"- `beta`",
		],
	});
	try {
		const report = verifyFeatureMap(fixture);
		assert.equal(report.ok, false);
		assert.deepEqual(report.failures.map((failure) => failure.type), [
			"uncovered-project-stale",
			"uncovered-project-stale",
			"uncovered-project-stale",
			"uncovered-project-reason-missing",
		]);
		assert.match(report.failures[0].message, /studio is now covered by studio\.md/u);
		assert.match(report.failures[1].message, /gone is not a project directory/u);
		assert.match(report.failures[2].message, /shared is not a project directory/u);
		assert.match(report.failures[3].message, /beta needs a one-line reason/u);
	} finally {
		rmSync(fixture.root, { force: true, recursive: true });
	}
});

test("rejects a library exclusion that gains a projects catalog entry", () => {
	const fixture = writeFixture({ catalogProjects: ["shared"], projects: ["shared"] });
	try {
		const report = verifyFeatureMap(fixture);
		assert.deepEqual(report.failures.map((failure) => failure.type), ["project-exclusion-invalid"]);
	} finally {
		rmSync(fixture.root, { force: true, recursive: true });
	}
});

test("repository validation gates run the feature-map verifier", () => {
	const repoRoot = path.resolve(__dirname, "../../../..");
	const packageJson = require(path.join(repoRoot, "package.json"));
	assert.equal(
		packageJson.scripts["verify:vpk-feature-map"],
		"node .agents/skills/vpk-verify/scripts/verify-feature-map.js",
	);
	const { gateRunsScript } = require(path.join(repoRoot, "scripts/lib/package-gates.js"));
	for (const gate of ["validate:local", "ci:pr"]) {
		assert.ok(gateRunsScript(packageJson.scripts, gate, "verify:vpk-feature-map"), `${gate} must run verify:vpk-feature-map`);
	}
});
