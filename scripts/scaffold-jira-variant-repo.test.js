const assert = require("node:assert/strict");
const { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

// End-to-end scaffolds against this repository's real sources, so manifest drift (a moved
// registration file, a variant that already exists, a new generated file) fails here
// instead of on the next real scaffold. Fixture-shape coverage lives in
// scaffold-jira-variant.test.js.

const DEFAULT_MANIFEST_PATH = path.join(process.cwd(), "scripts/fixtures/jira-variant-manifest.json");

function writeFixtureFile(root, relativePath, content) {
	const absolutePath = path.join(root, relativePath);
	mkdirSync(path.dirname(absolutePath), { recursive: true });
	writeFileSync(absolutePath, content);
}

function versionIdentity(number) {
	return { slug: `jira-golden-journey-v${number}`, version: `v${number}` };
}

async function loadGenerator() {
	return import("./scaffold-jira-variant.mjs");
}

function latestRepoVariantVersion() {
	const versions = readdirSync(path.join(process.cwd(), "components/projects"))
		.map((name) => name.match(/^jira-golden-journey-v(\d+)$/u)?.[1])
		.filter(Boolean)
		.map(Number);
	return Math.max(...versions);
}

// Copies only what the real plan reads (sources, registration files, reusable targets and
// the generated files the post-apply steps declare) so the end-to-end run stays fast.
function copyRepoPlanInputs(plan, manifest) {
	const root = mkdtempSync(path.join(os.tmpdir(), "vpk-jira-variant-repo-"));
	const paths = new Set([
		...plan.copyOperations.map((entry) => entry.source),
		...manifest.registrations.map((entry) => entry.file),
		...plan.reusedTargets.map((entry) => entry.path),
		...plan.postApplyCommands.flatMap((entry) => entry.writes),
	]);
	for (const relativePath of paths) {
		const source = path.join(process.cwd(), relativePath);
		if (!existsSync(source)) continue;
		cpSync(source, path.join(root, relativePath), { recursive: true });
	}
	return root;
}

function stubRepoCommands(root, manifest, { failValidation }) {
	const writes = manifest.postApplyCommands.flatMap((entry) => entry.writes);
	writeFixtureFile(root, "scripts/stub-generate.js", [
		'const fs = require("node:fs");',
		`for (const file of ${JSON.stringify(writes)}) fs.appendFileSync(file, "// regenerated\\n");`,
		"",
	].join("\n"));
	writeFixtureFile(root, "scripts/stub-validate.js", `process.exit(${failValidation ? 9 : 0});\n`);
	return {
		...manifest,
		postApplyCommands: manifest.postApplyCommands.map((entry) => ({
			...entry,
			command: ["node", "scripts/stub-generate.js"],
		})),
		validationCommands: [{ command: ["node", "scripts/stub-validate.js"], id: "stub-validate" }],
	};
}

test("the next variant scaffolds end to end from this repository's current sources", async () => {
	const { applyJiraVariantPlan, createJiraVariantPlan, loadVariantManifest, summarizePlan } = await loadGenerator();
	const manifest = loadVariantManifest(DEFAULT_MANIFEST_PATH);
	const source = `v${latestRepoVariantVersion()}`;
	const target = versionIdentity(Number(source.slice(1)) + 1);
	const repoPlan = createJiraVariantPlan({ manifest, root: process.cwd(), source, target: target.version });
	const root = copyRepoPlanInputs(repoPlan, manifest);
	try {
		const stubbed = stubRepoCommands(root, manifest, { failValidation: false });
		const plan = createJiraVariantPlan({ manifest: stubbed, root, source, target: target.version });
		assert.equal(
			summarizePlan({ ...plan, postApplyCommands: [], validationCommands: [] }).planFingerprint,
			summarizePlan({ ...repoPlan, postApplyCommands: [], validationCommands: [] }).planFingerprint,
		);
		const report = applyJiraVariantPlan(plan);
		assert.equal(report.status, "applied");
		assert.ok(existsSync(path.join(root, `components/projects/${target.slug}/page.tsx`)));
		assert.ok(existsSync(path.join(root, `app/${target.slug}/page.tsx`)));
		for (const operation of plan.copyOperations.filter((entry) => !entry.binary)) {
			const written = readFileSync(path.join(root, operation.target), "utf8");
			assert.doesNotMatch(written, new RegExp(`jira-golden-journey-${source}\\b`, "u"), operation.target);
		}
		const baseline = JSON.parse(readFileSync(path.join(root, "scripts/lazy-load-heavy-baseline.json"), "utf8").replace(/\/\/ regenerated\n$/u, ""));
		assert.ok(Object.keys(baseline.entries).some((key) => key.includes(target.slug)));
		assert.match(readFileSync(path.join(root, "scripts/lib/lazy-load-rules.js"), "utf8"), new RegExp(`\\n\\t\\{\\n\\t\\tentryFile: "components/projects/${target.slug}/page\\.tsx"`, "u"));
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});

test("a failed end-to-end scaffold restores every registration and generated registry", async () => {
	const { applyJiraVariantPlan, createJiraVariantPlan, loadVariantManifest } = await loadGenerator();
	const manifest = loadVariantManifest(DEFAULT_MANIFEST_PATH);
	const source = `v${latestRepoVariantVersion()}`;
	const target = versionIdentity(Number(source.slice(1)) + 1);
	const repoPlan = createJiraVariantPlan({ manifest, root: process.cwd(), source, target: target.version });
	const root = copyRepoPlanInputs(repoPlan, manifest);
	try {
		const stubbed = stubRepoCommands(root, manifest, { failValidation: true });
		const plan = createJiraVariantPlan({ manifest: stubbed, root, source, target: target.version });
		const guarded = [
			...plan.registrationOperations.map((entry) => entry.file),
			...plan.postApplyCommands.flatMap((entry) => entry.writes),
		].filter((file) => existsSync(path.join(root, file)));
		assert.ok(guarded.includes("components/website/registry/projects.ts"));
		const before = new Map(guarded.map((file) => [file, readFileSync(path.join(root, file), "utf8")]));

		assert.throws(() => applyJiraVariantPlan(plan), /command stub-validate failed with status 9/u);
		for (const targetRoot of plan.targetRoots) {
			assert.equal(existsSync(path.join(root, targetRoot)), false, targetRoot);
		}
		for (const [file, content] of before) {
			assert.equal(readFileSync(path.join(root, file), "utf8"), content, file);
		}
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});
