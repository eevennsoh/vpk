const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

const SCRIPT = path.join(__dirname, "deployment-status.mjs");
const ENVIRONMENT = "pdev-west2";
const VERSION = "release-1";
const PRIVATE_FIXTURE_VALUE = "must-never-be-rendered";

function stack(deploymentId, status, version = VERSION) {
	return { deploymentId, status, sd: { buildNumber: version, environment: { ASAP_PRIVATE_KEY: PRIVATE_FIXTURE_VALUE } } };
}

function snapshot(stacks, stableId = "new") {
	return {
		environments: { [ENVIRONMENT]: { stable: stableId ? { deploymentId: stableId } : null } },
		stacks: { [ENVIRONMENT]: stacks },
	};
}

function summary(deploymentId, status, version = VERSION) {
	return { deploymentId, status, version };
}

async function resolve(data, options = {}) {
	const { resolveDeploymentStatus } = await import(pathToFileURL(SCRIPT).href);
	return resolveDeploymentStatus(data, { environment: ENVIRONMENT, ...options });
}

function runCli(t, data, args = []) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-deployment-status-"));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	const file = path.join(root, "snapshot with spaces.json");
	fs.writeFileSync(file, JSON.stringify(data));
	return spawnSync(process.execPath, [SCRIPT, "--snapshot", file, "--env", ENVIRONMENT, ...args], { encoding: "utf8" });
}

test("the stable deployment is ready when an older failed stack comes first with the same version", async () => {
	const data = snapshot([stack("old", "UPDATE_FAILED"), stack("new", "CREATE_COMPLETE")]);
	const result = await resolve(data, { version: VERSION });
	assert.deepEqual(result, {
		environment: ENVIRONMENT,
		stable: summary("new", "CREATE_COMPLETE"),
		requested: summary("new", "CREATE_COMPLETE"),
		ready: true,
	});
	assert.deepEqual(await resolve(snapshot([...data.stacks[ENVIRONMENT]].reverse()), { version: VERSION }), result);
});

test("an explicitly requested rollout stays separate from the old stable deployment", async () => {
	const result = await resolve(snapshot([stack("old", "UPDATE_COMPLETE", "release-0"), stack("new", "CREATE_IN_PROGRESS")], "old"), {
		deploymentId: "new", version: VERSION,
	});
	assert.deepEqual(result, {
		environment: ENVIRONMENT,
		stable: summary("old", "UPDATE_COMPLETE", "release-0"),
		requested: summary("new", "CREATE_IN_PROGRESS"),
		ready: false,
	});
});

test("a successful requested stack is not ready until it becomes stable even when versions match", async () => {
	const result = await resolve(snapshot([stack("old", "UPDATE_COMPLETE"), stack("new", "CREATE_COMPLETE")], "old"), {
		deploymentId: "new", version: VERSION,
	});
	assert.equal(result.stable.deploymentId, "old");
	assert.equal(result.requested.deploymentId, "new");
	assert.equal(result.ready, false);
});

for (const status of ["CREATE_COMPLETE", "UPDATE_COMPLETE"]) {
	test(`a stable ${status} deployment is ready without an expected version`, async () => {
		assert.equal((await resolve(snapshot([stack("new", status)]))).ready, true);
	});
}

for (const status of ["CREATE_IN_PROGRESS", "UPDATE_IN_PROGRESS", "UPDATE_FAILED", "ROLLBACK_COMPLETE", "DELETE_COMPLETE"]) {
	test(`a stable ${status} deployment is not ready`, async () => {
		assert.equal((await resolve(snapshot([stack("new", status)]))).ready, false);
	});
}

test("a stable successful deployment with the wrong requested version is not ready", async () => {
	const result = await resolve(snapshot([stack("new", "CREATE_COMPLETE")]), { version: "release-2" });
	assert.equal(result.requested.version, VERSION);
	assert.equal(result.ready, false);
});

test("a numeric Micros build number matches the CLI version string", (t) => {
	const result = runCli(t, snapshot([stack("new", "CREATE_COMPLETE", 123)]), ["--version", "123", "--require-ready"]);
	assert.equal(result.status, 0, result.stderr);
	assert.deepEqual(JSON.parse(result.stdout).requested, summary("new", "CREATE_COMPLETE", "123"));
});

test("an initial environment with no stable reference or stacks is not ready", async () => {
	assert.deepEqual(await resolve(snapshot([], null)), { environment: ENVIRONMENT, stable: null, requested: null, ready: false });
});

test("an initial requested rollout can be reported before a stable deployment exists", async () => {
	assert.deepEqual(await resolve(snapshot([stack("new", "CREATE_IN_PROGRESS")], null), { deploymentId: "new" }), {
		environment: ENVIRONMENT,
		stable: null,
		requested: summary("new", "CREATE_IN_PROGRESS"),
		ready: false,
	});
});

for (const [label, data, options] of [
	["missing stable stack", snapshot([stack("old", "UPDATE_COMPLETE")]), {}],
	["duplicate stable stacks", snapshot([stack("new", "CREATE_COMPLETE"), stack("new", "UPDATE_COMPLETE")]), {}],
	["missing requested stack", snapshot([stack("new", "CREATE_COMPLETE")]), { deploymentId: "absent" }],
	["duplicate requested stacks", snapshot([stack("new", "CREATE_COMPLETE"), stack("pending", "CREATE_IN_PROGRESS"), stack("pending", "CREATE_IN_PROGRESS")]), { deploymentId: "pending" }],
]) {
	test(`${label} is rejected instead of selecting a convenient stack`, async () => {
		await assert.rejects(resolve(data, options));
	});
}

test("the CLI emits only sanitized readiness fields for the selected stable deployment", (t) => {
	const result = runCli(t, snapshot([stack("old", "UPDATE_FAILED"), stack("new", "CREATE_COMPLETE")]), ["--deployment-id", "new", "--version", VERSION, "--require-ready"]);
	assert.equal(result.status, 0, result.stderr);
	assert.deepEqual(JSON.parse(result.stdout), {
		environment: ENVIRONMENT,
		stable: summary("new", "CREATE_COMPLETE"),
		requested: summary("new", "CREATE_COMPLETE"),
		ready: true,
	});
	assert.doesNotMatch(result.stdout + result.stderr, new RegExp(PRIVATE_FIXTURE_VALUE));
	assert.doesNotMatch(result.stdout + result.stderr, /ASAP_PRIVATE_KEY|"sd"/u);
});

test("the CLI reports a pending requested deployment without requiring readiness", (t) => {
	const result = runCli(t, snapshot([stack("old", "UPDATE_COMPLETE", "release-0"), stack("new", "CREATE_IN_PROGRESS")], "old"), ["--deployment-id", "new", "--version", VERSION]);
	assert.equal(result.status, 0, result.stderr);
	const report = JSON.parse(result.stdout);
	assert.equal(report.stable.deploymentId, "old");
	assert.equal(report.requested.deploymentId, "new");
	assert.equal(report.ready, false);
});

for (const [label, data, args] of [
	["pending requested rollout", snapshot([stack("old", "UPDATE_COMPLETE"), stack("new", "CREATE_IN_PROGRESS")], "old"), ["--deployment-id", "new"]],
	["wrong expected version", snapshot([stack("new", "CREATE_COMPLETE")]), ["--version", "release-2"]],
	["empty initial environment", snapshot([], null), []],
]) {
	test(`the CLI exits 2 when readiness is required for ${label}`, (t) => {
		const result = runCli(t, data, [...args, "--require-ready"]);
		assert.equal(result.status, 2, result.stderr);
		assert.equal(JSON.parse(result.stdout).ready, false);
		assert.doesNotMatch(result.stdout + result.stderr, new RegExp(PRIVATE_FIXTURE_VALUE));
	});
}

test("the CLI rejects an invalid reference without dumping descriptor data", (t) => {
	const result = runCli(t, snapshot([stack("old", "UPDATE_FAILED")]));
	assert.notEqual(result.status, 0);
	assert.doesNotMatch(result.stdout + result.stderr, new RegExp(PRIVATE_FIXTURE_VALUE));
	assert.doesNotMatch(result.stdout + result.stderr, /ASAP_PRIVATE_KEY/u);
});


test("malformed snapshot JSON never echoes environment content in parse errors", t => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-status-invalid-"));
	t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
	const file = path.join(directory, "invalid.json");
	fs.writeFileSync(file, '{"environment":"fixture-secret" invalid}');
	const result = spawnSync(process.execPath, [SCRIPT, "--snapshot", file, "--env", ENVIRONMENT], { encoding: "utf8" });
	assert.equal(result.status, 2);
	assert.match(result.stderr, /Invalid Micros service snapshot JSON/u);
	assert.doesNotMatch(result.stdout + result.stderr, /fixture-secret/u);
});
