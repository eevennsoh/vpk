const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const DEFAULT_MANIFEST_PATH = path.join(
	process.cwd(),
	"scripts/fixtures/jira-variant-manifest.json",
);

function writeFixtureFile(root, relativePath, content) {
	const absolutePath = path.join(root, relativePath);
	mkdirSync(path.dirname(absolutePath), { recursive: true });
	writeFileSync(absolutePath, content);
}

function versionIdentity(version) {
	const number = String(version).replace(/^v/u, "");
	return {
		experimentalPascal: `ExperimentalV${number}`,
		experimentalSlug: `experimental-v${number}`,
		number: Number(number),
		pascal: `JiraGoldenJourneysV${number}`,
		previousVersion: `v${Number(number) - 1}`,
		slug: `jira-golden-journeys-v${number}`,
		title: `Jira Golden Journeys v${number}`,
		version: `v${number}`,
	};
}

function writeStableWorkItemOwnerFixtures(root, identity) {
	const { experimentalPascal, experimentalSlug, number, previousVersion } = identity;
	writeFixtureFile(root, "components/blocks/jira-work-item/index.tsx", [
		`import { ${experimentalPascal}JiraWorkItem } from "@/components/blocks/jira-work-item/${experimentalSlug}/${experimentalSlug}-jira-work-item";`,
		`export type JiraWorkItemVariant = "default" | "experimental" | "${experimentalSlug}";`,
		"const EXPERIMENTAL_SURFACES = {",
		`\t"${experimentalSlug}": ${experimentalPascal}JiraWorkItem,`,
		"} as const;",
		"",
	].join("\n"));
	writeFixtureFile(root, "components/blocks/jira-work-item/page.tsx", [
		`\t\t\t<Button type="button" onClick={() => setActiveVariant("${experimentalSlug}")}>`,
		`\t\t\t\tOpen experimental v${number} session`,
		"\t\t\t</Button>",
		`export function JiraWorkItem${experimentalPascal}Page() {`,
		`\treturn <JiraWorkItem variant="${experimentalSlug}" initialExperimentalPreset="filled" />;`,
		"}",
		"",
	].join("\n"));
	writeFixtureFile(root, "components/website/demos/blocks/jira-work-item-demo.tsx", [
		`export function JiraWorkItemDemo${experimentalPascal}() {`,
		`\treturn <JiraWorkItem variant="${experimentalSlug}" initialExperimentalPreset="filled" />;`,
		"}",
		`export function JiraWorkItemDemo${experimentalPascal}Empty() {`,
		`\treturn <JiraWorkItem variant="${experimentalSlug}" initialExperimentalPreset="empty" />;`,
		"}",
		`export function JiraWorkItemDemo${experimentalPascal}Running() {`,
		`\treturn <JiraWorkItem variant="${experimentalSlug}" initialExperimentalPreset="running" />;`,
		"}",
		"",
	].join("\n"));
	const registryBlock = (suffix = "") => [
		`\t"jira-work-item-demo-${experimentalSlug}${suffix}": dynamic(`,
		"\t\t() =>",
		"\t\t\timport(\"../demos/blocks/jira-work-item-demo\").then((mod) => ({",
		`\t\t\t\tdefault: mod.JiraWorkItemDemo${experimentalPascal}${suffix === "-empty" ? "Empty" : suffix === "-running" ? "Running" : ""},`,
		"\t\t\t})),",
		"\t\t{ ssr: false },",
		"\t),",
	].join("\n");
	writeFixtureFile(root, "components/website/registry/blocks.ts", [
		"export const BLOCKS = {",
		registryBlock(),
		"};",
		"",
	].join("\n"));
	writeFixtureFile(root, "components/website/registry/blocks-variants.ts", [
		"export const BLOCK_VARIANT_DEMO_ENTRIES = {",
		registryBlock(),
		registryBlock("-empty"),
		registryBlock("-running"),
		"};",
		"",
	].join("\n"));
	writeFixtureFile(root, "app/data/details/blocks/jira-work-item.ts", [
		"export const DETAIL = {",
		`\tdescription: "Jira work-item surface plus experimental v2 and ${identity.version} forks of that surface for independent iteration.",`,
		"\texamples: [",
		...[
			["Filled context", ""],
			["Empty context", "-empty"],
			["Multiple agents running", "-running"],
		].flatMap(([title, suffix]) => [
			"\t\t{",
			`\t\t\ttitle: "Experimental v${number} · ${title}",`,
			`\t\t\tdescription: "Experimental v${number} starts identical to ${previousVersion}.",`,
			`\t\t\tdemoSlug: "jira-work-item-demo-${experimentalSlug}${suffix}",`,
			"\t\t},",
		]),
		"\t],",
		`\ttype: "\\"default\\" | \\"experimental\\" | \\"${experimentalSlug}\\"",`,
		`\tvariantDescription: "${experimentalSlug} is an independent fork of ${previousVersion}.",`,
		"};",
		"",
	].join("\n"));
	writeFixtureFile(root, "app/preview/blocks/[slug]/layout.tsx", [
		"const CHAT_CAPABLE_BLOCK_PREVIEWS = new Set([",
		`\t"jira-work-item-demo-${experimentalSlug}",`,
		"]);",
		"",
	].join("\n"));
	writeFixtureFile(root, "components/blocks/jira-work-item/jira-work-item.test.js", [
		`assert.match(SOURCE, /export type JiraWorkItemVariant = "default" \\| "experimental" \\| "${experimentalSlug}";/u);`,
		`assert.match(SOURCE, /"${experimentalSlug}": ${experimentalPascal}JiraWorkItem,\\s*\\} as const;/u);`,
		`assert.match(SOURCE, /import \\{ ${experimentalPascal}JiraWorkItem \\} from "@\\/components\\/blocks\\/jira-work-item\\/${experimentalSlug}\\/${experimentalSlug}-jira-work-item";/u);`,
		`assert.match(pageSource, /Open experimental v${number} session/u);`,
		`assert.equal((pageSource.match(/variant="outline"/gu) ?? []).length, ${number});`,
		`assert.match(pageSource, /onClick=\\{\\(\\) => setActiveVariant\\("${experimentalSlug}"\\)/u);`,
		`assert.match(pageSource, /<Button type="button" onClick=\\{\\(\\) => setActiveVariant\\("${experimentalSlug}"\\)\\}>/u);`,
		`assert.match(pageSource, /export function JiraWorkItem${experimentalPascal}Page/u);`,
		`assert.match(detailsSource, /title: "Experimental v${number} · Filled context"[\\s\\S]*demoSlug: "jira-work-item-demo-${experimentalSlug}"/u);`,
		`assert.match(detailsSource, /title: "Experimental v${number} · Empty context"[\\s\\S]*demoSlug: "jira-work-item-demo-${experimentalSlug}-empty"/u);`,
		`assert.match(detailsSource, /title: "Experimental v${number} · Multiple agents running"[\\s\\S]*demoSlug: "jira-work-item-demo-${experimentalSlug}-running"/u);`,
		`assert.match(detailsSource, /name: "variant"[\\s\\S]*type: "\\\\"default\\\\" \\| \\\\"experimental\\\\" \\| \\\\"${experimentalSlug}\\\\"/u);`,
		`assert.match(registrySource, /"jira-work-item-demo-${experimentalSlug}": dynamic/u);`,
		`assert.match(blockVariantRegistrySource, /"jira-work-item-demo-${experimentalSlug}": dynamic/u);`,
		`assert.match(blockVariantRegistrySource, /"jira-work-item-demo-${experimentalSlug}-empty": dynamic/u);`,
		`assert.match(blockVariantRegistrySource, /"jira-work-item-demo-${experimentalSlug}-running": dynamic/u);`,
		`assert.match(demoSource, /export function JiraWorkItemDemo${experimentalPascal}/u);`,
		`assert.match(demoSource, /<JiraWorkItem variant="${experimentalSlug}" initialExperimentalPreset="filled" \\/>/u);`,
		`assert.match(demoSource, /<JiraWorkItem variant="${experimentalSlug}" initialExperimentalPreset="empty" \\/>/u);`,
		`assert.match(demoSource, /<JiraWorkItem variant="${experimentalSlug}" initialExperimentalPreset="running" \\/>/u);`,
		`assert.match(previewLayoutSource, /"jira-work-item-demo-${experimentalSlug}"/u);`,
		"",
	].join("\n"));
	writeFixtureFile(root, "components/blocks/jira-work-item/jira-work-item-experimental-v2.test.js", [
		`assert.match(indexSource, /export type JiraWorkItemVariant = "default" \\| "experimental" \\| "${experimentalSlug}";/u);`,
		`assert.match(indexSource, /"${experimentalSlug}": ${experimentalPascal}JiraWorkItem,\\s*\\} as const;/u);`,
		"",
	].join("\n"));
	writeFixtureFile(root, "components/blocks/jira-work-item/activity-composer-context-bar.test.js", [
		`const TREES = ["experimental-v2", "${experimentalSlug}"];`,
		`if (tree === "${experimentalSlug}") {}`,
		"",
	].join("\n"));
}

function createFixtureWorkspace({
	includeDeferredRules = false,
	source = "v1",
} = {}) {
	const root = mkdtempSync(path.join(os.tmpdir(), "vpk-jira-variant-"));
	const identity = versionIdentity(source);
	const experimental = `experimental-${identity.version}`;
	const experimentalPascal = `ExperimentalV${identity.version.slice(1)}`;

	writeFixtureFile(root, `components/projects/${identity.slug}/page.tsx`, [
		`import { ${experimentalPascal}JiraWorkItem } from "@/components/blocks/jira-work-item/${experimental}/${experimental}-jira-work-item";`,
		`export default function ${identity.pascal}Page() {`,
		`\treturn <${experimentalPascal}JiraWorkItem title="${identity.title}" id="${identity.slug}" />;`,
		"}",
		"",
	].join("\n"));
	writeFixtureFile(root, `components/projects/${identity.slug}/${identity.slug}.test.js`, [
		'const test = require("node:test");',
		`test("${identity.title} stays isolated", () => {});`,
		"",
	].join("\n"));
	writeFixtureFile(root, `app/${identity.slug}/page.tsx`, [
		`const slug = "${identity.slug}";`,
		`export default function ${identity.pascal}Route() { return slug; }`,
		"",
	].join("\n"));
	writeFixtureFile(root, `components/website/demos/projects/${identity.slug}-demo.tsx`, [
		`import ${identity.pascal}Page from "@/components/projects/${identity.slug}/page";`,
		`export default function ${identity.pascal}Demo() { return <${identity.pascal}Page />; }`,
		"",
	].join("\n"));
	writeFixtureFile(root, `app/data/${identity.slug}-contract.test.js`, [
		'const test = require("node:test");',
		`test("${identity.slug} is registered", () => {});`,
		"",
	].join("\n"));
	writeFixtureFile(root, `tests/projects/${identity.slug}-story.spec.ts`, [
		`const route = "/${identity.slug}";`,
		"export { route };",
		"",
	].join("\n"));
	writeFixtureFile(
		root,
		`public/illustration/${identity.slug}/proof.png`,
		Buffer.from([0x89, 0x50, 0x4e, 0x47]),
	);
	writeFixtureFile(
		root,
		`components/blocks/jira-work-item/${experimental}/${experimental}-jira-work-item.tsx`,
		[
			`export const fixtureVersion = "${identity.version}";`,
			`export const ${experimentalPascal}JiraWorkItem = () => null;`,
			"",
		].join("\n"),
	);
	writeFixtureFile(
		root,
		`components/blocks/jira-work-item/${experimental}/lib/${experimental}-helper.test.js`,
		`const fixtureVersion = "${identity.version}";\nexport { fixtureVersion };\n`,
	);
	writeFixtureFile(
		root,
		`components/blocks/jira-work-item/jira-work-item-${experimental}-chrome.test.js`,
		`const fixtureVersion = "${identity.version}";\nexport { fixtureVersion };\n`,
	);

	for (const filePath of ["app/data/components.ts", "app/data/component-manifest.ts"]) {
		writeFixtureFile(root, filePath, [
			...(filePath.endsWith("component-manifest.ts")
				? ["export const CATALOG_LIFECYCLE: Readonly<Partial<Record<CatalogKey, ComponentLifecycle>>> = {", "};", ""]
				: []),
			"export const PROJECTS = [",
			`\tprojectComponent("${identity.slug}", "${identity.title}"),`,
			"];",
			"",
		].join("\n"));
	}

	writeFixtureFile(root, "app/data/details/projects.ts", [
		"export const PROJECT_DETAILS = {",
		`\t"${identity.slug}": {`,
		`\t\tdescription: "${identity.title} fixture.",`,
		`\t\timportStatement: \`import ${identity.pascal}Page from "@/components/projects/${identity.slug}";\`,`,
		"\t},",
		"};",
		"",
	].join("\n"));
	writeFixtureFile(root, "components/website/registry/projects.ts", [
		"export const PROJECT_DEMOS = {",
		`\t"${identity.slug}": dynamic(`,
		`\t\t() => import("../demos/projects/${identity.slug}-demo"),`,
		"\t\t{ ssr: false },",
		"\t),",
		"};",
		"",
	].join("\n"));
	writeFixtureFile(root, "scripts/js-unit-test-manifest.mjs", [
		"export const TESTS = [",
		`\t\t"components/projects/${identity.slug}/${identity.slug}.test.js",`,
		`\t\t"app/data/${identity.slug}-contract.test.js",`,
		`\t\t"components/blocks/jira-work-item/${experimental}/lib/${experimental}-helper.test.js",`,
		`\t\t"components/blocks/jira-work-item/jira-work-item-${experimental}-chrome.test.js",`,
		"];",
		"",
	].join("\n"));

	const deferredObject = [
		"\t{",
		`\t\tentryFile: "components/projects/${identity.slug}/page.tsx",`,
		`\t\ttargetFile: "components/blocks/jira-work-item/${experimental}/${experimental}-jira-work-item.tsx",`,
		"\t},",
	].join("\n");
	writeFixtureFile(root, "scripts/verify-lazy-load-boundaries.js", [
		"const DEFAULT_DEFERRED_MODULE_RULES = [",
		...(includeDeferredRules ? [deferredObject] : []),
		"];",
		"",
	].join("\n"));
	writeFixtureFile(root, "scripts/verify-lazy-load-boundaries.test.js", [
		"assert.deepEqual(DEFAULT_DEFERRED_MODULE_RULES, [",
		...(includeDeferredRules ? [deferredObject] : []),
		"]);",
		"",
	].join("\n"));
	writeStableWorkItemOwnerFixtures(root, identity);

	return root;
}

function addFixtureValidationCommands(root, { failValidation = false } = {}) {
	writeFixtureFile(root, ".agents/knowledge/repo-map.json", '{"state":"before"}\n');
	writeFixtureFile(root, "scripts/generate-repo-map.js", [
		'const fs = require("node:fs");',
		'fs.mkdirSync(".agents/knowledge", { recursive: true });',
		'fs.writeFileSync(".agents/knowledge/repo-map.json", JSON.stringify({ state: "generated" }) + "\\n");',
		"",
	].join("\n"));
	writeFixtureFile(root, "scripts/verify-fixture.js", [
		'const fs = require("node:fs");',
		'const [kind, target] = process.argv.slice(2);',
		'if (kind === "repo-map") {',
		'\tconst repoMap = JSON.parse(fs.readFileSync(".agents/knowledge/repo-map.json", "utf8"));',
		'\tif (repoMap.state !== "generated") process.exit(2);',
		'}',
		'if (kind === "catalog") {',
		'\tfor (const file of ["app/data/components.ts", "app/data/component-manifest.ts", "app/data/details/projects.ts", "components/website/registry/projects.ts", "scripts/js-unit-test-manifest.mjs"]) {',
		'\t\tconst source = fs.readFileSync(file, "utf8");',
		'\t\tif (!source.includes(target)) process.exit(3);',
		'\t}',
		'}',
		'if (kind === "lazy") {',
		'\tfor (const file of ["scripts/verify-lazy-load-boundaries.js", "scripts/verify-lazy-load-boundaries.test.js"]) {',
		'\t\tconst source = fs.readFileSync(file, "utf8");',
		'\t\tif (!source.includes(target)) process.exit(4);',
		'\t}',
		'}',
		"",
	].join("\n"));
	writeFixtureFile(root, "scripts/fail-validation.js", "process.exit(7);\n");

	return {
		postApplyCommands: [{
			command: ["node", "scripts/generate-repo-map.js"],
			id: "generate-repo-map",
			writes: [".agents/knowledge/repo-map.json"],
		}],
		validationCommands: [
			{
				command: ["node", "scripts/verify-fixture.js", "repo-map", "jira-golden-journeys-v3"],
				id: "verify-repo-map",
			},
			{
				command: failValidation
					? ["node", "scripts/fail-validation.js"]
					: ["node", "scripts/verify-fixture.js", "catalog", "jira-golden-journeys-v3"],
				id: "verify-catalog",
			},
			{
				command: ["node", "scripts/verify-fixture.js", "lazy", "jira-golden-journeys-v3"],
				id: "verify-lazy-load",
			},
		],
	};
}

async function loadGenerator() {
	return import("./scaffold-jira-variant.mjs");
}

test("dry-run planning is deterministic for the v1 to v2 fixture shape", async () => {
	const root = createFixtureWorkspace({ source: "v1" });
	try {
		const { createJiraVariantPlan, loadVariantManifest, summarizePlan } = await loadGenerator();
		const manifest = loadVariantManifest(DEFAULT_MANIFEST_PATH);
		const options = { manifest, root, source: "v1", target: "v2" };
		const first = summarizePlan(createJiraVariantPlan(options));
		const second = summarizePlan(createJiraVariantPlan(options));

		assert.deepEqual(first, second);
		assert.equal(first.source.slug, "jira-golden-journeys-v1");
		assert.equal(first.target.slug, "jira-golden-journeys-v2");
		assert.ok(first.copies.some((entry) => entry.target === "app/jira-golden-journeys-v2/page.tsx"));
		assert.ok(first.copies.some((entry) => entry.target === "app/data/jira-golden-journeys-v2-contract.test.js"));
		assert.ok(first.registrations.some((entry) => entry.file === "scripts/js-unit-test-manifest.mjs"));
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});

test("planner rejects targets that are not the immediate successor", async () => {
	const root = createFixtureWorkspace({ source: "v3" });
	try {
		const { createJiraVariantPlan, loadVariantManifest } = await loadGenerator();
		const manifest = loadVariantManifest(DEFAULT_MANIFEST_PATH);

		for (const target of ["v2", "v3", "v5"]) {
			assert.throws(
				() => createJiraVariantPlan({ manifest, root, source: "v3", target }),
				/target version must be the immediate successor of source version v3/u,
			);
		}
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});

test("dry-run planning covers v2 to v3 assets, browser tests, and lazy-load wiring", async () => {
	const root = createFixtureWorkspace({ includeDeferredRules: true, source: "v2" });
	try {
		const { createJiraVariantPlan, loadVariantManifest, summarizePlan } = await loadGenerator();
		const manifest = loadVariantManifest(DEFAULT_MANIFEST_PATH);
		const summary = summarizePlan(createJiraVariantPlan({
			manifest,
			root,
			source: "v2",
			target: "v3",
		}));

		assert.ok(summary.copies.some((entry) => entry.target === "tests/projects/jira-golden-journeys-v3-story.spec.ts"));
		assert.ok(summary.copies.some((entry) => entry.target === "public/illustration/jira-golden-journeys-v3/proof.png"));
		assert.ok(summary.copies.some((entry) => (
			entry.target === "components/blocks/jira-work-item/experimental-v3/experimental-v3-jira-work-item.tsx"
		)));
		assert.ok(summary.copies.some((entry) => (
			entry.target === "components/blocks/jira-work-item/experimental-v3/lib/experimental-v3-helper.test.js"
		)));
		assert.ok(summary.copies.some((entry) => (
			entry.target === "components/blocks/jira-work-item/jira-work-item-experimental-v3-chrome.test.js"
		)));
		assert.deepEqual(
			summary.registrations
				.filter((entry) => (
					entry.kind === "array-object-all" &&
					entry.file.startsWith("scripts/verify-lazy-load-boundaries")
				))
				.map((entry) => entry.insertedCount),
			[1, 1],
		);
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});

test("v3 to v4 planning includes every stable Work Item registration owner", async () => {
	const root = createFixtureWorkspace({ includeDeferredRules: true, source: "v3" });
	try {
		const { createJiraVariantPlan, loadVariantManifest, summarizePlan } = await loadGenerator();
		const manifest = loadVariantManifest(DEFAULT_MANIFEST_PATH);
		const plan = createJiraVariantPlan({ manifest, root, source: "v3", target: "v4" });
		const summary = summarizePlan(plan);
		const expectedOwners = [
			"app/data/details/blocks/jira-work-item.ts",
			"app/preview/blocks/[slug]/layout.tsx",
			"components/blocks/jira-work-item/activity-composer-context-bar.test.js",
			"components/blocks/jira-work-item/index.tsx",
			"components/blocks/jira-work-item/jira-work-item-experimental-v2.test.js",
			"components/blocks/jira-work-item/jira-work-item.test.js",
			"components/blocks/jira-work-item/page.tsx",
			"components/website/demos/blocks/jira-work-item-demo.tsx",
			"components/website/registry/blocks-variants.ts",
			"components/website/registry/blocks.ts",
		];

		for (const owner of expectedOwners) {
			assert.ok(
				summary.registrationFiles.some((entry) => entry.file === owner),
				`missing stable Work Item registration owner: ${owner}`,
			);
		}
		for (const owner of expectedOwners) {
			const operation = plan.registrationOperations.find((entry) => entry.file === owner);
			assert.match(operation.preparedContent.toString("utf8"), /experimental-v4|ExperimentalV4/u);
		}
		const prepared = (owner) => plan.registrationOperations
			.find((entry) => entry.file === owner)
			.preparedContent.toString("utf8");
		const indexSource = prepared("components/blocks/jira-work-item/index.tsx");
		assert.match(indexSource, /import \{ ExperimentalV4JiraWorkItem \} from [^\n]*experimental-v4-jira-work-item/u);
		assert.match(indexSource, /JiraWorkItemVariant = [^;]*"experimental-v3" \| "experimental-v4";/u);
		assert.match(indexSource, /"experimental-v4": ExperimentalV4JiraWorkItem/u);
		const chooserSource = prepared("components/blocks/jira-work-item/page.tsx");
		assert.match(chooserSource, /variant="outline" onClick=\{\(\) => setActiveVariant\("experimental-v3"\)\}/u);
		assert.match(chooserSource, /<Button type="button" onClick=\{\(\) => setActiveVariant\("experimental-v4"\)\}>/u);
		assert.match(chooserSource, /export function JiraWorkItemExperimentalV4Page/u);
		const demoSource = prepared("components/website/demos/blocks/jira-work-item-demo.tsx");
		assert.match(demoSource, /JiraWorkItemDemoExperimentalV4\(\)/u);
		assert.match(demoSource, /JiraWorkItemDemoExperimentalV4Empty\(\)/u);
		assert.match(demoSource, /JiraWorkItemDemoExperimentalV4Running\(\)/u);
		const blockRegistrySource = prepared("components/website/registry/blocks.ts");
		assert.match(blockRegistrySource, /"jira-work-item-demo-experimental-v4": dynamic[\s\S]*JiraWorkItemDemoExperimentalV4/u);
		const variantRegistrySource = prepared("components/website/registry/blocks-variants.ts");
		assert.match(variantRegistrySource, /jira-work-item-demo-experimental-v4-empty[\s\S]*JiraWorkItemDemoExperimentalV4Empty/u);
		assert.match(variantRegistrySource, /jira-work-item-demo-experimental-v4-running[\s\S]*JiraWorkItemDemoExperimentalV4Running/u);
		const detailOperation = plan.registrationOperations.find((entry) => (
			entry.file === "app/data/details/blocks/jira-work-item.ts"
		));
		assert.match(
			detailOperation.preparedContent.toString("utf8"),
			/independently versioned experimental forks/u,
		);
		assert.doesNotMatch(
			detailOperation.preparedContent.toString("utf8"),
			/experimental v2 and v3 forks|experimental-v3 is an independent fork of v2/u,
		);
		assert.match(detailOperation.preparedContent.toString("utf8"), /jira-work-item-demo-experimental-v4-empty/u);
		assert.match(detailOperation.preparedContent.toString("utf8"), /jira-work-item-demo-experimental-v4-running/u);
		assert.match(detailOperation.preparedContent.toString("utf8"), /\\"experimental-v3\\" \| \\"experimental-v4\\"/u);
		assert.match(
			prepared("app/preview/blocks/[slug]/layout.tsx"),
			/"jira-work-item-demo-experimental-v4"/u,
		);
		assert.match(
			prepared("components/blocks/jira-work-item/activity-composer-context-bar.test.js"),
			/TREES = \["experimental-v2", "experimental-v3", "experimental-v4"\]/u,
		);
		for (const contractOwner of [
			"components/blocks/jira-work-item/jira-work-item.test.js",
			"components/blocks/jira-work-item/jira-work-item-experimental-v2.test.js",
		]) {
			assert.match(prepared(contractOwner), /"experimental-v4": ExperimentalV4JiraWorkItem/u);
		}
		assert.equal(existsSync(path.join(root, "components/projects/jira-golden-journeys-v4")), false);
		assert.equal(existsSync(path.join(root, "components/blocks/jira-work-item/experimental-v4")), false);
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});

test("planner rewrites and detects bare source-version tokens", async () => {
	const root = createFixtureWorkspace({ source: "v1" });
	try {
		const { createJiraVariantPlan, loadVariantManifest } = await loadGenerator();
		const manifest = loadVariantManifest(DEFAULT_MANIFEST_PATH);
		const plan = createJiraVariantPlan({ manifest, root, source: "v1", target: "v2" });
		const workItem = plan.copyOperations.find((entry) => (
			entry.target === "components/blocks/jira-work-item/experimental-v2/experimental-v2-jira-work-item.tsx"
		));
		assert.ok(workItem);
		assert.match(workItem.preparedContent.toString("utf8"), /fixtureVersion = "v2"/u);
		assert.doesNotMatch(workItem.preparedContent.toString("utf8"), /fixtureVersion = "v1"/u);

		const incompleteManifest = structuredClone(manifest);
		incompleteManifest.rewrites = incompleteManifest.rewrites.filter((entry) => (
			entry.from !== "{sourceVersion}"
		));
		assert.throws(
			() => createJiraVariantPlan({
				manifest: incompleteManifest,
				root,
				source: "v1",
				target: "v2",
			}),
			/unresolved source identifier.*v1/u,
		);
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});

test("planner rejects symbolic links anywhere in a copied source chain", async () => {
	const root = createFixtureWorkspace({ source: "v1" });
	const external = mkdtempSync(path.join(os.tmpdir(), "vpk-jira-variant-external-"));
	try {
		writeFixtureFile(external, "outside.ts", "export const outside = true;\n");
		symlinkSync(
			path.join(external, "outside.ts"),
			path.join(root, "components/projects/jira-golden-journeys-v1/outside.ts"),
		);
		const { createJiraVariantPlan, loadVariantManifest } = await loadGenerator();
		const manifest = loadVariantManifest(DEFAULT_MANIFEST_PATH);
		assert.throws(
			() => createJiraVariantPlan({ manifest, root, source: "v1", target: "v2" }),
			/source path contains a symbolic link/u,
		);
	} finally {
		rmSync(root, { force: true, recursive: true });
		rmSync(external, { force: true, recursive: true });
	}
});

test("planner rejects symbolic links in target parent chains", async () => {
	const root = createFixtureWorkspace({ source: "v1" });
	const external = mkdtempSync(path.join(os.tmpdir(), "vpk-jira-variant-target-"));
	try {
		symlinkSync(external, path.join(root, "escape"), "dir");
		const { createJiraVariantPlan, loadVariantManifest } = await loadGenerator();
		const manifest = loadVariantManifest(DEFAULT_MANIFEST_PATH);
		manifest.copyTemplates = [{
			source: "components/projects/{sourceSlug}/page.tsx",
			target: "escape/{targetSlug}/page.tsx",
		}];
		manifest.registrations = [];
		assert.throws(
			() => createJiraVariantPlan({ manifest, root, source: "v1", target: "v2" }),
			/target path contains a symbolic link/u,
		);
	} finally {
		rmSync(root, { force: true, recursive: true });
		rmSync(external, { force: true, recursive: true });
	}
});

test("planner rejects a symbolic-link registration file", async () => {
	const root = createFixtureWorkspace({ source: "v1" });
	const external = mkdtempSync(path.join(os.tmpdir(), "vpk-jira-variant-registration-"));
	try {
		const registrationPath = path.join(root, "app/data/components.ts");
		const externalPath = path.join(external, "components.ts");
		writeFileSync(externalPath, readFileSync(registrationPath));
		rmSync(registrationPath);
		symlinkSync(externalPath, registrationPath);
		const { createJiraVariantPlan, loadVariantManifest } = await loadGenerator();
		const manifest = loadVariantManifest(DEFAULT_MANIFEST_PATH);
		assert.throws(
			() => createJiraVariantPlan({ manifest, root, source: "v1", target: "v2" }),
			/registration file contains a symbolic link/u,
		);
	} finally {
		rmSync(root, { force: true, recursive: true });
		rmSync(external, { force: true, recursive: true });
	}
});

test("scoped glob traversal ignores unrelated special files and broken links", async (context) => {
	const root = createFixtureWorkspace({ source: "v1" });
	try {
		mkdirSync(path.join(root, "node_modules"), { recursive: true });
		symlinkSync("missing-target", path.join(root, "node_modules/broken"));
		const fifoPath = path.join(root, "tests/projects/ignored-pipe");
		const mkfifo = spawnSync("mkfifo", [fifoPath], { encoding: "utf8" });
		if (mkfifo.status !== 0) {
			context.skip(`mkfifo unavailable: ${mkfifo.stderr}`);
			return;
		}
		const { createJiraVariantPlan, loadVariantManifest } = await loadGenerator();
		const manifest = loadVariantManifest(DEFAULT_MANIFEST_PATH);
		const plan = createJiraVariantPlan({ manifest, root, source: "v1", target: "v2" });
		assert.ok(plan.copyOperations.some((entry) => (
			entry.target === "tests/projects/jira-golden-journeys-v2-story.spec.ts"
		)));
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});

test("planner stops when any target path already exists", async () => {
	const root = createFixtureWorkspace({ source: "v1" });
	try {
		writeFixtureFile(root, "app/jira-golden-journeys-v2/page.tsx", "occupied\n");
		const { createJiraVariantPlan, loadVariantManifest } = await loadGenerator();
		const manifest = loadVariantManifest(DEFAULT_MANIFEST_PATH);
		assert.throws(
			() => createJiraVariantPlan({ manifest, root, source: "v1", target: "v2" }),
			/target path already exists: app\/jira-golden-journeys-v2/u,
		);
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});

test("planner rejects ambiguous source content that already contains the target identity", async () => {
	const root = createFixtureWorkspace({ source: "v1" });
	try {
		const sourcePath = path.join(root, "components/projects/jira-golden-journeys-v1/page.tsx");
		writeFileSync(sourcePath, `${readFileSync(sourcePath, "utf8")}\n// jira-golden-journeys-v2\n`);
		const { createJiraVariantPlan, loadVariantManifest } = await loadGenerator();
		const manifest = loadVariantManifest(DEFAULT_MANIFEST_PATH);
		assert.throws(
			() => createJiraVariantPlan({ manifest, root, source: "v1", target: "v2" }),
			/ambiguous rewrite.*already contains target identifier/u,
		);
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});

test("planner rejects duplicate rewrite sources and unresolved source identifiers", async () => {
	const root = createFixtureWorkspace({ source: "v1" });
	try {
		const { createJiraVariantPlan, loadVariantManifest } = await loadGenerator();
		const manifest = loadVariantManifest(DEFAULT_MANIFEST_PATH);
		const duplicateManifest = structuredClone(manifest);
		duplicateManifest.rewrites.push({ from: "{sourceSlug}", to: "conflicting-target" });
		assert.throws(
			() => createJiraVariantPlan({ manifest: duplicateManifest, root, source: "v1", target: "v2" }),
			/ambiguous rewrite source/u,
		);

		const incompleteManifest = structuredClone(manifest);
		incompleteManifest.rewrites = incompleteManifest.rewrites.filter((entry) => entry.from !== "{sourcePascal}");
		assert.throws(
			() => createJiraVariantPlan({ manifest: incompleteManifest, root, source: "v1", target: "v2" }),
			/unresolved source identifier.*JiraGoldenJourneysV1/u,
		);
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});

test("fixture helper does not create a target before the generator runs", () => {
	const root = createFixtureWorkspace({ source: "v1" });
	try {
		assert.equal(existsSync(path.join(root, "components/projects/jira-golden-journeys-v2")), false);
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});

test("mutation applies the approved plan and reports registration and validation results", async () => {
	const root = createFixtureWorkspace({ includeDeferredRules: true, source: "v2" });
	try {
		const {
			applyJiraVariantPlan,
			createJiraVariantPlan,
			loadVariantManifest,
		} = await loadGenerator();
		const manifest = loadVariantManifest(DEFAULT_MANIFEST_PATH);
		Object.assign(manifest, addFixtureValidationCommands(root));
		const plan = createJiraVariantPlan({ manifest, root, source: "v2", target: "v3" });
		const report = applyJiraVariantPlan(plan);

		assert.equal(report.status, "applied");
		assert.equal(report.copiedFileCount, plan.copyOperations.length);
		assert.deepEqual(report.commands.map((entry) => entry.id), [
			"generate-repo-map",
			"verify-repo-map",
			"verify-catalog",
			"verify-lazy-load",
		]);
		assert.ok(report.registrations.every((entry) => (
			entry.skipped || entry.insertedCount > 0
		)));
		const targetPage = readFileSync(
			path.join(root, "components/projects/jira-golden-journeys-v3/page.tsx"),
			"utf8",
		);
		assert.match(targetPage, /JiraGoldenJourneysV3Page/u);
		assert.match(targetPage, /ExperimentalV3JiraWorkItem/u);
		assert.doesNotMatch(targetPage, /jira-golden-journeys-v2|JiraGoldenJourneysV2|ExperimentalV2/u);
		// A fork records where it came from so `control-vpk where` can tell agents which variant is which.
		assert.match(
			readFileSync(path.join(root, "app/data/component-manifest.ts"), "utf8"),
			/"projects\/jira-golden-journeys-v3": \{\n\t\tbasedOn: "jira-golden-journeys-v2",\n\t\},/u,
		);
		assert.deepEqual(
			JSON.parse(readFileSync(path.join(root, ".agents/knowledge/repo-map.json"), "utf8")),
			{ state: "generated" },
		);
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});

test("mutation stops before writing when a planned source changes", async () => {
	const root = createFixtureWorkspace({ includeDeferredRules: true, source: "v2" });
	try {
		const {
			applyJiraVariantPlan,
			createJiraVariantPlan,
			loadVariantManifest,
		} = await loadGenerator();
		const manifest = loadVariantManifest(DEFAULT_MANIFEST_PATH);
		Object.assign(manifest, addFixtureValidationCommands(root));
		const plan = createJiraVariantPlan({ manifest, root, source: "v2", target: "v3" });
		writeFixtureFile(root, "components/projects/jira-golden-journeys-v2/page.tsx", "changed after planning\n");

		assert.throws(() => applyJiraVariantPlan(plan), /source changed after planning/u);
		assert.equal(existsSync(path.join(root, "components/projects/jira-golden-journeys-v3")), false);
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});

test("mutation rolls back copied paths, registrations, and generated files on validation failure", async () => {
	const root = createFixtureWorkspace({ includeDeferredRules: true, source: "v2" });
	try {
		const {
			applyJiraVariantPlan,
			createJiraVariantPlan,
			loadVariantManifest,
		} = await loadGenerator();
		const manifest = loadVariantManifest(DEFAULT_MANIFEST_PATH);
		Object.assign(manifest, addFixtureValidationCommands(root, { failValidation: true }));
		const componentsBefore = readFileSync(path.join(root, "app/data/components.ts"), "utf8");
		const repoMapBefore = readFileSync(path.join(root, ".agents/knowledge/repo-map.json"), "utf8");
		const plan = createJiraVariantPlan({ manifest, root, source: "v2", target: "v3" });

		assert.throws(() => applyJiraVariantPlan(plan), /command verify-catalog failed with status 7/u);
		assert.equal(existsSync(path.join(root, "components/projects/jira-golden-journeys-v3")), false);
		assert.equal(readFileSync(path.join(root, "app/data/components.ts"), "utf8"), componentsBefore);
		assert.equal(readFileSync(path.join(root, ".agents/knowledge/repo-map.json"), "utf8"), repoMapBefore);
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});

test("CLI dry-run JSON is stable and never creates the target", async () => {
	const root = createFixtureWorkspace({ includeDeferredRules: true, source: "v2" });
	try {
		const args = [
			"scripts/scaffold-jira-variant.mjs",
			"--root",
			root,
			"--source",
			"v2",
			"--target",
			"v3",
			"--json",
		];
		const first = spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: "utf8" });
		const second = spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: "utf8" });

		assert.equal(first.status, 0, first.stderr);
		assert.equal(second.status, 0, second.stderr);
		assert.equal(first.stdout, second.stdout);
		const summary = JSON.parse(first.stdout);
		assert.equal(summary.mode, "dry-run");
		assert.match(summary.planFingerprint, /^[a-f0-9]{64}$/u);
		assert.ok(summary.rewrites.some((entry) => entry.from === "v2" && entry.to === "v3"));
		assert.deepEqual(summary.postApplyCommands[0].command, ["node", "scripts/generate-repo-map.js"]);
		assert.deepEqual(summary.validationCommands[0].command, [
			"corepack",
			"pnpm",
			"run",
			"verify:repo-map",
		]);
		assert.equal(existsSync(path.join(root, "components/projects/jira-golden-journeys-v3")), false);
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});

test("argument parsing accepts one package-manager separator", async () => {
	const { parseArgs } = await loadGenerator();
	assert.deepEqual(
		parseArgs(["--", "--source", "v3", "--target", "v4", "--json"]),
		{
			apply: false,
			help: false,
			json: true,
			manifestPath: DEFAULT_MANIFEST_PATH,
			planFingerprint: null,
			root: process.cwd(),
			source: "v3",
			target: "v4",
		},
	);
});

test("CLI apply requires the exact reviewed plan fingerprint before writing", async () => {
	const root = createFixtureWorkspace({ includeDeferredRules: true, source: "v2" });
	try {
		const manifest = JSON.parse(readFileSync(DEFAULT_MANIFEST_PATH, "utf8"));
		Object.assign(manifest, addFixtureValidationCommands(root));
		const manifestPath = path.join(root, "fixture-manifest.json");
		writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
		const baseArgs = [
			"scripts/scaffold-jira-variant.mjs",
			"--root",
			root,
			"--manifest",
			manifestPath,
			"--source",
			"v2",
			"--target",
			"v3",
			"--json",
		];
		const missing = spawnSync(process.execPath, [...baseArgs, "--apply"], {
			cwd: process.cwd(),
			encoding: "utf8",
		});
		assert.equal(missing.status, 1);
		assert.match(missing.stderr, /--apply requires --plan-fingerprint/u);
		assert.equal(existsSync(path.join(root, "components/projects/jira-golden-journeys-v3")), false);

		const wrong = spawnSync(process.execPath, [
			...baseArgs,
			"--apply",
			"--plan-fingerprint",
			"0".repeat(64),
		], { cwd: process.cwd(), encoding: "utf8" });
		assert.equal(wrong.status, 1);
		assert.match(wrong.stderr, /reviewed plan fingerprint does not match/u);
		assert.equal(existsSync(path.join(root, "components/projects/jira-golden-journeys-v3")), false);

		const dryRun = spawnSync(process.execPath, baseArgs, {
			cwd: process.cwd(),
			encoding: "utf8",
		});
		assert.equal(dryRun.status, 0, dryRun.stderr);
		const { planFingerprint } = JSON.parse(dryRun.stdout);
		const applied = spawnSync(process.execPath, [
			...baseArgs,
			"--apply",
			"--plan-fingerprint",
			planFingerprint,
		], { cwd: process.cwd(), encoding: "utf8" });
		assert.equal(applied.status, 0, applied.stderr);
		assert.equal(JSON.parse(applied.stdout).planFingerprint, planFingerprint);
		assert.equal(existsSync(path.join(root, "components/projects/jira-golden-journeys-v3")), true);
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});
