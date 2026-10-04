const assert = require("node:assert/strict");
const { mkdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const CONTROL_VPK = path.join(__dirname, "control-vpk");
const { formatWhere, resolveWhere, whereCli } = require(CONTROL_VPK);
const { withTempDir } = require("./lib/test-fixtures.js");

function writeFixtureFile(root, relativePath, content) {
	const file = path.join(root, relativePath);
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, content);
}

const WHERE_REPO_MAP = {
	appPages: {
		pages: [
			{ routePath: "/", source: "app/page.tsx", owners: [{ source: "app/home-content" }] },
			{ routePath: "/[category]", source: "app/[category]/page.tsx", owners: [{ source: "app/home-content" }] },
			{
				routePath: "/fixture-project",
				source: "app/fixture-project/page.tsx",
				owners: [{ source: "components/website/demo-registry-loader" }],
			},
			{
				routePath: "/fixture-host",
				source: "app/fixture-host/page.tsx",
				owners: [{ source: "components/website/demo-registry-loader" }],
				primaryOwner: {
					kind: "catalog",
					category: "projects",
					slug: "fixture-host",
					loader: "loadDemoComponent",
					source: "components/projects/fixture-host",
				},
			},
			{ routePath: "/fixture-alias", source: "app/fixture-alias/page.tsx", primaryOwner: { kind: "redirect", to: "/fixture-project" } },
			{ routePath: "/components/[category]/[slug]", source: "app/components/[category]/[slug]/page.tsx" },
			{
				routePath: "/preview/projects/[slug]",
				source: "app/preview/projects/[slug]/page.tsx",
				primaryOwner: { kind: "dynamic", dynamic: "catalog", category: "projects" },
			},
			{ routePath: "/preview/blocks/[slug]", source: "app/preview/blocks/[slug]/page.tsx" },
		],
	},
	components: {
		categories: [
			{
				category: "projects",
				entries: [
					{ category: "projects", slug: "fixture-project", importPath: "@/components/projects/fixture-project" },
					{
						category: "projects",
						slug: "fixture-project-end",
						importPath: "@/components/projects/fixture-project-end",
						status: "frozen",
						basedOn: "fixture-project",
						note: "Closing copy of fixture-project.",
					},
					{
						category: "projects",
						slug: "fixture-host",
						importPath: "@/components/projects/fixture-host",
						status: "superseded",
						note: "Superseded by fixture-project.",
					},
				],
			},
			{
				category: "blocks",
				entries: [{ category: "blocks", slug: "fixture-board", importPath: "@/components/blocks/fixture-board" }],
			},
		],
	},
};

function withWhereFixture(run) {
	return withTempDir("control-vpk-where-", (root) => {
		const files = {
			"app/fixture-project/page.tsx": "const Demo = use(loadDemoComponent(\"fixture-project\", \"projects\"));\n",
			"app/fixture-host/page.tsx": "export default function Page() { return null; }\n",
			"components/projects/fixture-project/index.ts": "export * from \"./finale/card\";\n",
			"components/projects/fixture-project/finale/card.tsx": "export function Card() { return null; }\n",
			"components/projects/fixture-project-end/index.ts": "export {};\n",
			"components/projects/fixture-host/board.tsx": "import { Board } from \"@/components/blocks/fixture-board\";\n",
			"components/projects/fixture-host/board.test.js": "require(\"@/components/blocks/fixture-board\");\n",
			"components/blocks/fixture-board/index.tsx": "export function Board() { return null; }\n",
			"components/website/misc.tsx": "import { Board } from \"@/components/blocks/fixture-board/index\";\n",
			".agents/skills/vpk-verify/features/fixture-project.md": [
				"# Fixture project",
				"",
				"- Open `/fixture-project` directly.",
				"- Docs live at `/components/projects/fixture-project`.",
			].join("\n"),
			".agents/skills/vpk-verify/features/fixture-project-end.md": "- Open `/fixture-project-end`.\n",
			"tests/projects/fixture.spec.ts": "await page.goto(`${origin}/fixture-project`);\n",
			"tests/projects/fixture-end.spec.ts": "await page.goto(`${origin}/preview/projects/fixture-project-end?embedded=1`);\n",
			"tests/projects/fixture-host.spec.ts": "await page.goto(\"https://26b9.localhost/fixture-host\");\n",
			"tests/projects/fixture-source.spec.ts": "readFileSync(\"components/projects/fixture-project/finale/card.tsx\");\n",
		};
		for (const [file, content] of Object.entries(files)) writeFixtureFile(root, file, content);
		return run(root, (input) => resolveWhere(input, { repoMap: WHERE_REPO_MAP, repoRoot: root }));
	});
}

test("where walks a deep file up to its catalog owner and lists routes, recipes and specs", () => {
	withWhereFixture((root, where) => {
		const result = where("components/projects/fixture-project/finale/card.tsx");
		assert.equal(result.kind, "path");
		assert.equal(result.owner, "components/projects/fixture-project");
		assert.deepEqual(result.catalog, [{ category: "projects", slug: "fixture-project", name: "fixture-project", status: "live" }]);
		assert.equal(result.status, "live", "an entry without status defaults to live");
		assert.equal(result.warning, null);
		assert.deepEqual(result.routes.map(({ route, via }) => `${via} ${route}`), [
			"page /fixture-project",
			"doc /components/projects/fixture-project",
			"template /preview/projects/fixture-project",
			"redirect /fixture-alias",
		]);
		assert.deepEqual(result.features.map((item) => item.file), [".agents/skills/vpk-verify/features/fixture-project.md"]);
		assert.deepEqual(result.features[0].lines, [3, 4]);
		assert.deepEqual(result.specs.map((item) => item.file), [
			"tests/projects/fixture-source.spec.ts",
			"tests/projects/fixture.spec.ts",
		]);
		assert.equal(result.capture, "control-vpk capture /fixture-project");
		// Absolute paths inside the worktree resolve the same way.
		assert.deepEqual(where(path.join(root, "components/projects/fixture-project")).routes, result.routes);
	});
});

test("where resolves catalog slugs through primaryOwner and scans one level of importers", () => {
	withWhereFixture((_root, where) => {
		const host = where("projects/fixture-host");
		assert.equal(host.kind, "slug");
		assert.deepEqual(host.routes.map((route) => route.route), [
			"/fixture-host",
			"/components/projects/fixture-host",
			"/preview/projects/fixture-host",
		]);
		assert.deepEqual(host.specs.map((item) => item.file), ["tests/projects/fixture-host.spec.ts"]);

		const board = where("components/blocks/fixture-board");
		assert.deepEqual(board.routes.map((route) => route.route), [
			"/components/blocks/fixture-board",
			"/preview/blocks/fixture-board",
		]);
		assert.deepEqual(board.importers.map(({ owner, catalog, files }) => ({ owner, catalog, files })), [
			{ owner: "components/projects/fixture-host", catalog: ["projects/fixture-host"], files: 1 },
		]);
		assert.equal(board.unmappedImporterFiles, 1, "components/website/misc.tsx maps to no route");
		assert.deepEqual(board.specs.map((item) => item.file), ["tests/projects/fixture-host.spec.ts"]);

		const route = where("/fixture-project");
		assert.equal(route.kind, "route");
		assert.equal(route.owner, "components/projects/fixture-project");
		assert.throws(() => where("missing-slug"), /Unknown slug or path/u);
		assert.throws(() => where("/missing-route"), /Unknown route/u);
	});
});

test("where prints a human summary by default and JSON with --json", () => {
	withWhereFixture((_root, where) => {
		const human = formatWhere(where("fixture-project"));
		assert.match(human, /^where fixture-project \(slug\)$/mu);
		assert.match(human, /^ {2}\/fixture-project +page +app\/fixture-project\/page\.tsx$/mu);
		assert.match(human, /^next {4}control-vpk capture \/fixture-project$/mu);

		let written = "";
		const stdout = { write: (text) => { written += text; } };
		assert.equal(whereCli(["fixture-project", "--json"], { resolve: where, stdout }), 0);
		assert.equal(JSON.parse(written).owner, "components/projects/fixture-project");
		assert.throws(() => whereCli([], { resolve: where, stdout }), /exactly one/u);
		assert.throws(() => whereCli(["a", "--yaml"], { resolve: where, stdout }), /Unknown option/u);
	});
});

test("where prints the owner's lifecycle status and warns before a frozen or superseded variant", () => {
	withWhereFixture((_root, where) => {
		const frozen = where("components/projects/fixture-project-end/index.ts");
		assert.equal(frozen.owner, "components/projects/fixture-project-end");
		assert.equal(frozen.status, "frozen");
		assert.equal(frozen.basedOn, "fixture-project");
		assert.equal(frozen.note, "Closing copy of fixture-project.");
		assert.equal(frozen.warning, "frozen variant — confirm the user wants this one changed");
		const human = formatWhere(frozen);
		assert.match(human, /^owner {3}components\/projects\/fixture-project-end \[projects\/fixture-project-end\] status=frozen \(based on fixture-project\)$/mu);
		assert.match(human, /^warning frozen variant — confirm the user wants this one changed$/mu);
		assert.match(human, /^note {4}Closing copy of fixture-project\.$/mu);

		let written = "";
		assert.equal(whereCli(["projects/fixture-project-end", "--json"], { resolve: where, stdout: { write: (text) => { written += text; } } }), 0);
		const json = JSON.parse(written);
		assert.deepEqual(
			{ status: json.status, basedOn: json.basedOn, warning: json.warning, catalog: json.catalog },
			{
				status: "frozen",
				basedOn: "fixture-project",
				warning: "frozen variant — confirm the user wants this one changed",
				catalog: [{
					category: "projects",
					slug: "fixture-project-end",
					name: "fixture-project-end",
					status: "frozen",
					basedOn: "fixture-project",
					note: "Closing copy of fixture-project.",
				}],
			},
		);

		const superseded = where("/fixture-host");
		assert.equal(superseded.status, "superseded");
		assert.match(formatWhere(superseded), /^warning superseded variant — confirm the user wants this one changed, not its successor$/mu);

		const live = formatWhere(where("fixture-project"));
		assert.match(live, /^owner {3}components\/projects\/fixture-project \[projects\/fixture-project\] status=live$/mu);
		assert.doesNotMatch(live, /^(?:warning|note) /mu);

		// A non-catalog owner, or a directory that only contains entries, has no status to report.
		const unmapped = where("components/website/misc.tsx");
		assert.equal(unmapped.status, null);
		assert.doesNotMatch(formatWhere(unmapped), /status=/u);
		assert.equal(where("components/projects").status, null);
	});
});
