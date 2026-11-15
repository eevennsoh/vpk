const test = require("node:test");
const assert = require("node:assert/strict");

const {
	DEFAULT_OPENAI_MODEL,
	classifyOpenAiModelOverride,
	describeOpenAiModelWarnings,
	loadEnvFileWithModelOrigin,
	parseGptModelVersion,
	recordOpenAiModelEnvOrigin,
	resetOpenAiModelEnvOrigin,
	resolveOpenAiModel,
} = require("./openai-model");

test("parseGptModelVersion reads numbered GPT ids and rejects everything else", () => {
	assert.deepEqual(parseGptModelVersion("gpt-6.1-sol"), { version: [6, 1], tier: "sol" });
	assert.deepEqual(parseGptModelVersion(" GPT-6-Sol "), { version: [6, 0], tier: "sol" });
	assert.deepEqual(parseGptModelVersion("gpt-5.6-terra"), { version: [5, 6], tier: "terra" });
	for (const model of ["o3", "gpt-4o", "openai/gpt-6.1-sol", "", null]) {
		assert.equal(parseGptModelVersion(model), null, String(model));
	}
});

test("with no override the code default wins and needs no config", () => {
	const resolution = resolveOpenAiModel({}, { origin: null });
	assert.equal(resolution.model, DEFAULT_OPENAI_MODEL);
	assert.equal(resolution.source, "default");
	assert.equal(resolution.status, "default");
	assert.deepEqual(describeOpenAiModelWarnings(resolution), []);
	assert.equal(resolveOpenAiModel({ OPENAI_MODEL: "   " }, { origin: null }).model, DEFAULT_OPENAI_MODEL);
});

test("overrides are classified against the default", () => {
	const def = "gpt-6.1-sol";
	assert.equal(classifyOpenAiModelOverride("gpt-5.6-sol", def), "override-older-than-default");
	assert.equal(classifyOpenAiModelOverride("gpt-6-sol", def), "override-older-than-default");
	assert.equal(classifyOpenAiModelOverride("gpt-5.6-terra", def), "override-older-than-default");
	assert.equal(classifyOpenAiModelOverride("GPT-6.1-SOL", def), "override-matches-default");
	assert.equal(classifyOpenAiModelOverride("gpt-6.2-sol", def), "override-newer-than-default");
	assert.equal(classifyOpenAiModelOverride("gpt-6.1-terra", def), "override-custom");
	assert.equal(classifyOpenAiModelOverride("o3", def), "override-custom");
});

// Regression: a shell export of an outdated model silently beat the newer .env.local value
// because dotenv never replaces a variable that is already set.
test("a stale shell export that shadows .env.local is named as the source and warned about", () => {
	const resolution = resolveOpenAiModel(
		{ OPENAI_MODEL: "gpt-5.6-sol" },
		{ origin: { shellValue: "gpt-5.6-sol", envFileValue: "gpt-6.1-sol" }, defaultModel: "gpt-6.1-sol" },
	);
	assert.equal(resolution.model, "gpt-5.6-sol");
	assert.equal(resolution.source, "process-env");
	assert.equal(resolution.shadowsEnvFile, true);
	const warnings = describeOpenAiModelWarnings(resolution);
	assert.equal(warnings.length, 2);
	assert.match(warnings[0], /process environment \(shell, launcher, or deploy\) overrides the value in \.env\.local/u);
	assert.match(warnings[1], /from the process environment \(shell, launcher, or deploy\) names an older model than the built-in default gpt-6\.1-sol/u);
	for (const warning of warnings) {
		assert.equal(warning.includes("gpt-5.6-sol"), false, "warnings never echo the override value");
	}
});

test("a .env.local override that repeats the default is flagged as removable", () => {
	const resolution = resolveOpenAiModel({ OPENAI_MODEL: DEFAULT_OPENAI_MODEL }, { origin: { shellValue: "", envFileValue: DEFAULT_OPENAI_MODEL } });
	assert.equal(resolution.source, ".env.local");
	assert.equal(resolution.shadowsEnvFile, false);
	assert.match(describeOpenAiModelWarnings(resolution)[0], /repeats the built-in default/u);
});

test("the recorded startup origin is used by default", (t) => {
	t.after(resetOpenAiModelEnvOrigin);
	recordOpenAiModelEnvOrigin({ shellValue: " gpt-6.2-sol ", envFileValue: undefined });
	const resolution = resolveOpenAiModel({ OPENAI_MODEL: "gpt-6.2-sol" });
	assert.equal(resolution.source, "process-env");
	assert.equal(resolution.status, "override-newer-than-default");
	assert.deepEqual(describeOpenAiModelWarnings(resolution), []);
	resetOpenAiModelEnvOrigin();
	assert.equal(resolveOpenAiModel({ OPENAI_MODEL: "gpt-6.2-sol" }).source, "unknown");
});

// Regression: an empty export still keeps dotenv from loading .env.local's value, but resolved to
// the default with no warning, so the dropped .env.local pin went unreported.
test("an empty process-environment OPENAI_MODEL that hides .env.local is warned about", () => {
	const resolution = resolveOpenAiModel(
		{ OPENAI_MODEL: "" },
		{ origin: { shellPresent: true, shellValue: "", envFileValue: "gpt-6.1-sol" } },
	);
	assert.equal(resolution.source, "default");
	assert.equal(resolution.shadowsEnvFile, true);
	assert.match(describeOpenAiModelWarnings(resolution)[0], /overrides the value in \.env\.local/u);
});

function withTempEnvFile(t, contents) {
	const fs = require("node:fs");
	const os = require("node:os");
	const path = require("node:path");
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "openai-model-env-"));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	const envPath = path.join(dir, ".env.local");
	if (contents !== null) {
		fs.writeFileSync(envPath, contents);
	}
	return envPath;
}

// Regression for the wiring backend/server.js relies on: the origin must be captured before dotenv
// populates the environment, or a stale export would be reported as coming from .env.local.
test("loadEnvFileWithModelOrigin records a stale export that shadows .env.local", (t) => {
	t.after(resetOpenAiModelEnvOrigin);
	const envPath = withTempEnvFile(t, "OPENAI_MODEL=gpt-6.1-sol\nOTHER=from-file\n");
	const env = { OPENAI_MODEL: "gpt-1.0-sol" };
	const result = loadEnvFileWithModelOrigin({ envPath, env });
	assert.equal(result.error, undefined);
	assert.equal(env.OPENAI_MODEL, "gpt-1.0-sol", "dotenv kept the existing value");
	assert.equal(env.OTHER, "from-file");
	const resolution = resolveOpenAiModel(env);
	assert.equal(resolution.source, "process-env");
	assert.equal(resolution.shadowsEnvFile, true);
	assert.equal(describeOpenAiModelWarnings(resolution).length, 2);
});

// dotenv 18 merges DOTENV_* env options into config(); a DOTENV_OVERRIDE left in the shell must
// not let .env.local replace the exported value the origin report says wins.
test("loadEnvFileWithModelOrigin keeps the exported value when DOTENV_OVERRIDE is set", (t) => {
	t.after(resetOpenAiModelEnvOrigin);
	const saved = {};
	for (const key of ["DOTENV_OVERRIDE", "DOTENV_CONFIG_OVERRIDE", "DOTENV_QUIET"]) {
		saved[key] = process.env[key];
		process.env[key] = "true";
	}
	t.after(() => {
		for (const [key, value] of Object.entries(saved)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	});
	const envPath = withTempEnvFile(t, "OPENAI_MODEL=gpt-6.1-sol\n");
	const env = { OPENAI_MODEL: "gpt-1.0-sol" };
	loadEnvFileWithModelOrigin({ envPath, env });
	assert.equal(env.OPENAI_MODEL, "gpt-1.0-sol");
	assert.equal(resolveOpenAiModel(env).source, "process-env");
});

test("loadEnvFileWithModelOrigin attributes a file-only value to .env.local", (t) => {
	t.after(resetOpenAiModelEnvOrigin);
	const envPath = withTempEnvFile(t, "OPENAI_MODEL=gpt-6.2-sol\n");
	const env = {};
	loadEnvFileWithModelOrigin({ envPath, env });
	const resolution = resolveOpenAiModel(env);
	assert.equal(resolution.model, "gpt-6.2-sol");
	assert.equal(resolution.source, ".env.local");
	assert.equal(resolution.shadowsEnvFile, false);
});

test("loadEnvFileWithModelOrigin tolerates a missing .env.local", (t) => {
	t.after(resetOpenAiModelEnvOrigin);
	const env = {};
	const result = loadEnvFileWithModelOrigin({ envPath: withTempEnvFile(t, null), env });
	assert.ok(result.error);
	assert.equal(resolveOpenAiModel(env).source, "default");
});
