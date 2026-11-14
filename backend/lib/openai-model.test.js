const test = require("node:test");
const assert = require("node:assert/strict");

const {
	DEFAULT_OPENAI_MODEL,
	classifyOpenAiModelOverride,
	describeOpenAiModelWarnings,
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
	assert.equal(resolution.source, "shell");
	assert.equal(resolution.shadowsEnvFile, true);
	const warnings = describeOpenAiModelWarnings(resolution);
	assert.equal(warnings.length, 2);
	assert.match(warnings[0], /shell overrides the value in \.env\.local/u);
	assert.match(warnings[1], /from your shell names an older model than the built-in default gpt-6\.1-sol/u);
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
	assert.equal(resolution.source, "shell");
	assert.equal(resolution.status, "override-newer-than-default");
	assert.deepEqual(describeOpenAiModelWarnings(resolution), []);
	resetOpenAiModelEnvOrigin();
	assert.equal(resolveOpenAiModel({ OPENAI_MODEL: "gpt-6.2-sol" }).source, "environment");
});
