import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
	GENERATED_ARTIFACTS,
	artifactFiles,
	collectStatus,
	conflictedFiles,
	fixGenerated,
	formatStatus,
	parseArgs,
} from "./generated-artifacts.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NODE = process.execPath;

// A two-stage fake: `derived.txt` is generated from `source.txt`, and `index.txt` from
// `derived.txt`, so the dependency order of `fix` is observable. Each generator run is
// appended to `runs.log`.
function fixture() {
	const root = mkdtempSync(path.join(tmpdir(), "vpk-generated-"));
	const write = (name, text) => writeFileSync(path.join(root, name), text);
	write("gen.mjs", `import fs from "node:fs";
const [from, to, mode] = process.argv.slice(2);
const expected = "generated:" + fs.readFileSync(from, "utf8");
if (mode === "--check") {
	const actual = fs.existsSync(to) ? fs.readFileSync(to, "utf8") : "";
	if (actual !== expected) { console.error(to + " is out of date"); process.exit(1); }
} else {
	fs.appendFileSync("runs.log", to + "\\n");
	fs.writeFileSync(to, expected);
}
`);
	write("source.txt", "v1");
	const entry = (id, from, to) => ({
		check: [NODE, "gen.mjs", from, to, "--check"],
		generate: [NODE, "gen.mjs", from, to],
		id,
		paths: [to],
	});
	const registry = [entry("derived", "source.txt", "derived.txt"), entry("index", "derived.txt", "index.txt")];
	return {
		read: (name) => readFileSync(path.join(root, name), "utf8"),
		registry,
		root,
		runs: () => (existsSync(path.join(root, "runs.log")) ? readFileSync(path.join(root, "runs.log"), "utf8").trim().split("\n") : []),
		write,
	};
}

test("fix regenerates stale entries in dependency order, then a second fix is a no-op", async (t) => {
	const fake = fixture();
	t.after(() => rmSync(fake.root, { force: true, recursive: true }));
	fake.write("derived.txt", "generated:v1");
	fake.write("index.txt", "generated:generated:v1");
	assert.equal((await collectStatus({ cwd: fake.root, registry: fake.registry })).ok, true);

	// Seed staleness at the root of the chain only.
	fake.write("source.txt", "v2");
	const stale = await collectStatus({ cwd: fake.root, registry: fake.registry });
	assert.equal(stale.ok, false);
	assert.deepEqual(stale.results.map((result) => result.state), ["stale", "current"]);
	assert.match(formatStatus(stale), /stale derived {2}derived\.txt {2}fix: pnpm run fix:generated -- --only derived/u);
	assert.match(formatStatus(stale), /derived\.txt is out of date/u);

	const fixed = await fixGenerated({ cwd: fake.root, registry: fake.registry });
	assert.equal(fixed.ok, true);
	assert.deepEqual(fixed.results.map((result) => result.state), ["regenerated", "regenerated"]);
	assert.equal(fake.read("index.txt"), "generated:generated:v2");
	assert.deepEqual(fake.runs(), ["derived.txt", "index.txt"]);

	const again = await fixGenerated({ cwd: fake.root, registry: fake.registry });
	assert.deepEqual(again.results.map((result) => result.state), ["current", "current"]);
	assert.deepEqual(fake.runs(), ["derived.txt", "index.txt"], "a current tree runs no generator");
});

test("conflict markers make an artifact stale even when its checker passes, and fix clears them", async (t) => {
	const fake = fixture();
	t.after(() => rmSync(fake.root, { force: true, recursive: true }));
	fake.write("derived.txt", "generated:v1");
	fake.write("index.txt", "generated:generated:v1");
	const passingCheck = fake.registry.map((entry) => ({ ...entry, check: [NODE, "-e", ""] }));
	fake.write("index.txt", "<<<<<<< ours\ngenerated:a\n=======\ngenerated:b\n>>>>>>> theirs\n");
	const status = await collectStatus({ cwd: fake.root, registry: passingCheck });
	assert.deepEqual(status.results.map((result) => result.state), ["current", "stale"]);
	assert.match(status.results[1].output, /conflict markers in index\.txt/u);

	const fixed = await fixGenerated({ cwd: fake.root, registry: fake.registry });
	assert.equal(fixed.ok, true);
	assert.equal(fake.read("index.txt"), "generated:generated:v1");
	assert.deepEqual(conflictedFiles(["index.txt"], fake.root), []);
});

test("a checker that still fails after regeneration is reported as failing, not fixed", async (t) => {
	const fake = fixture();
	t.after(() => rmSync(fake.root, { force: true, recursive: true }));
	const broken = [{ ...fake.registry[0], check: [NODE, "-e", "console.error('parity failure'); process.exit(1)"] }];
	const result = await fixGenerated({ cwd: fake.root, registry: broken });
	assert.equal(result.ok, false);
	assert.equal(result.results[0].state, "failing");
	assert.match(result.results[0].output, /parity failure/u);

	fake.write("source.txt", "v3");
	const generatorFails = [{ ...fake.registry[0], generate: [NODE, "-e", "process.exit(3)"] }];
	assert.equal((await fixGenerated({ cwd: fake.root, registry: generatorFails })).results[0].state, "failing");
});

test("slow entries run only with --all or --only, and unknown ids are rejected", async () => {
	const calls = [];
	const run = async (command) => { calls.push(command.join(" ")); return { output: "", status: 0 }; };
	const registry = [
		{ check: ["fast-check"], generate: ["fast-gen"], id: "fast", paths: [] },
		{ check: ["slow-check"], generate: ["slow-gen"], id: "slow", paths: [], slow: true },
	];
	const status = await collectStatus({ registry, run });
	assert.deepEqual(calls, ["fast-check"]);
	assert.deepEqual(status.skipped, ["slow"]);
	assert.match(formatStatus(status), /skipped slow: slow; add --all/u);
	calls.length = 0;
	await collectStatus({ all: true, registry, run });
	assert.deepEqual(calls.sort(), ["fast-check", "slow-check"]);
	calls.length = 0;
	await fixGenerated({ only: ["slow"], registry, run });
	assert.deepEqual(calls, ["slow-check"]);
	await assert.rejects(collectStatus({ only: ["nope"], registry, run }), /Unknown generated artifact: nope/u);
	assert.deepEqual(parseArgs(["fix", "--only", "repo-map", "--json"]), { all: false, json: true, mode: "fix", only: ["repo-map"] });
	assert.throws(() => parseArgs(["regenerate"]), /Usage/u);
});

test("the real registry names existing scripts and files and covers every generator check in package.json", () => {
	const ids = GENERATED_ARTIFACTS.map((entry) => entry.id);
	assert.equal(new Set(ids).size, ids.length);
	for (const entry of GENERATED_ARTIFACTS) {
		for (const command of [entry.check, entry.generate]) {
			if (command[0] === NODE) assert.ok(existsSync(path.join(REPO_ROOT, command[1])), `${entry.id}: ${command[1]}`);
		}
		assert.ok(artifactFiles(entry.paths).length > 0, `${entry.id}: no files match ${entry.paths.join(", ")}`);
		for (const file of artifactFiles(entry.paths)) assert.ok(existsSync(path.join(REPO_ROOT, file)), file);
	}
	// A generator whose `--check` gates CI must be fixable through fix:generated.
	const { scripts } = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
	const gatedGenerators = Object.values(scripts).join(" && ").split("&&").map((part) => part.trim())
		.filter((part) => /^node \S*generate-\S+ --check$/u.test(part)).map((part) => part.split(" ")[1]);
	assert.ok(gatedGenerators.length >= 3);
	for (const script of gatedGenerators) {
		assert.ok(GENERATED_ARTIFACTS.some((entry) => entry.check[1] === script), `${script} is missing from GENERATED_ARTIFACTS`);
	}
	assert.equal(scripts["generated:status"], "node scripts/generated-artifacts.mjs status");
	assert.equal(scripts["fix:generated"], "node scripts/generated-artifacts.mjs fix");
});

test("baselines that may only shrink by fixing code are never regenerated", () => {
	const paths = GENERATED_ARTIFACTS.flatMap((entry) => entry.paths);
	assert.equal(paths.includes("scripts/file-size-allowlist.json"), false);
	assert.equal(paths.includes("scripts/js-unit-test-legacy-drift.mjs"), false);
	const suppressions = GENERATED_ARTIFACTS.find((entry) => entry.id === "eslint-suppressions");
	assert.deepEqual(suppressions.generate.slice(-2), ["--", "--prune-suppressions"]);
	assert.equal(suppressions.generate.includes("--suppress-all"), false);
	assert.equal(suppressions.slow, true);
});

test("directory patterns expand to sorted matching files", (t) => {
	const root = mkdtempSync(path.join(tmpdir(), "vpk-generated-glob-"));
	t.after(() => rmSync(root, { force: true, recursive: true }));
	mkdirSync(path.join(root, "rules"));
	for (const name of ["b.mdc", "a.mdc", "c.md"]) writeFileSync(path.join(root, "rules", name), "");
	assert.deepEqual(artifactFiles(["rules/*.mdc", "x.json"], root), ["rules/a.mdc", "rules/b.mdc", "x.json"]);
	assert.deepEqual(artifactFiles(["missing/*.mdc"], root), []);
});
