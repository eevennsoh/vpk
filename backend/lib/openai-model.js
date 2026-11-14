"use strict";

// The one owner of which OpenAI model the backend sends to the AI Gateway.
//
// The default lives here, in code, so a checkout needs no model config at all and a new model
// release is a one-line change. OPENAI_MODEL is an explicit override only. The gateway exposes no
// model list to this use case (its /models discovery answers 404/403), so there is no "newest"
// to resolve at runtime; instead every override is classified against this default and reported
// at startup, in /api/health, and by `pnpm run doctor`. /api/health and doctor print labels only,
// never the override's value; the startup log prints the effective model id, which is not a secret
// and is what an operator reading the log needs.

const DEFAULT_OPENAI_MODEL = "gpt-6.1-sol";

const OPENAI_MODEL_SOURCES = Object.freeze({
	DEFAULT: "default",
	ENV_FILE: ".env.local",
	// Set before .env.local loaded: a shell export, a launcher or tmux environment, or a deploy.
	PROCESS_ENV: "process-env",
	// The origin was never recorded (a caller other than backend/server.js), so file and process
	// environment cannot be told apart.
	UNKNOWN: "unknown",
});

// Labels, never values: they are safe to print from any report.
const OPENAI_MODEL_STATUSES = Object.freeze({
	DEFAULT: "default",
	MATCHES_DEFAULT: "override-matches-default",
	OLDER: "override-older-than-default",
	NEWER: "override-newer-than-default",
	CUSTOM: "override-custom",
});

function trimmedOrEmpty(value) {
	return typeof value === "string" ? value.trim() : "";
}

// "gpt-6.1-sol" -> { version: [6, 1], tier: "sol" }; null for ids outside the numbered GPT
// family (o-series, gpt-4o, provider-prefixed ids), which are reported as custom.
function parseGptModelVersion(model) {
	const match = /^gpt-(\d+)(?:\.(\d+))?(?:-([a-z][\w-]*))?$/u.exec(trimmedOrEmpty(model).toLowerCase());
	if (!match) {
		return null;
	}
	return {
		version: [Number(match[1]), Number(match[2] ?? 0)],
		tier: match[3] ?? "",
	};
}

function compareGptVersions(left, right) {
	return left.version[0] - right.version[0] || left.version[1] - right.version[1];
}

function classifyOpenAiModelOverride(model, defaultModel = DEFAULT_OPENAI_MODEL) {
	const override = trimmedOrEmpty(model);
	if (!override) {
		return OPENAI_MODEL_STATUSES.DEFAULT;
	}
	if (override.toLowerCase() === defaultModel.toLowerCase()) {
		return OPENAI_MODEL_STATUSES.MATCHES_DEFAULT;
	}
	const parsedOverride = parseGptModelVersion(override);
	const parsedDefault = parseGptModelVersion(defaultModel);
	if (!parsedOverride || !parsedDefault) {
		return OPENAI_MODEL_STATUSES.CUSTOM;
	}
	const order = compareGptVersions(parsedOverride, parsedDefault);
	if (order < 0) {
		return OPENAI_MODEL_STATUSES.OLDER;
	}
	return order > 0 ? OPENAI_MODEL_STATUSES.NEWER : OPENAI_MODEL_STATUSES.CUSTOM;
}

// Where OPENAI_MODEL came from. dotenv never overrides a variable that is already set (even to
// an empty string), so a value in the process environment silently wins over .env.local;
// loadEnvFileWithModelOrigin records both sides around loading the file so the report can say
// which one is in effect.
let recordedEnvOrigin = null;

function recordOpenAiModelEnvOrigin({ shellPresent, shellValue, envFileValue } = {}) {
	const trimmedShellValue = trimmedOrEmpty(shellValue);
	recordedEnvOrigin = {
		shellPresent: shellPresent ?? Boolean(trimmedShellValue),
		shellValue: trimmedShellValue,
		envFileValue: trimmedOrEmpty(envFileValue),
	};
	return recordedEnvOrigin;
}

// Loads .env.local into `env` with dotenv and records OPENAI_MODEL's origin around it. Returns
// dotenv's result ({ parsed } or { error } when the file is missing).
function loadEnvFileWithModelOrigin({ envPath, env = process.env, dotenv = require("dotenv") }) {
	const shellPresent = Object.hasOwn(env, "OPENAI_MODEL");
	const shellValue = env.OPENAI_MODEL;
	const result = dotenv.config({ path: envPath, processEnv: env });
	recordOpenAiModelEnvOrigin({ shellPresent, shellValue, envFileValue: result.parsed?.OPENAI_MODEL });
	return result;
}

function resetOpenAiModelEnvOrigin() {
	recordedEnvOrigin = null;
}

function resolveOpenAiModel(envVars = {}, { origin = recordedEnvOrigin, defaultModel = DEFAULT_OPENAI_MODEL } = {}) {
	const override = trimmedOrEmpty(envVars.OPENAI_MODEL);
	const shellValue = origin?.shellValue ?? "";
	const shellPresent = origin?.shellPresent ?? Boolean(shellValue);
	const envFileValue = origin?.envFileValue ?? "";
	let source = OPENAI_MODEL_SOURCES.DEFAULT;
	if (override) {
		if (shellValue && shellValue === override) {
			source = OPENAI_MODEL_SOURCES.PROCESS_ENV;
		} else if (envFileValue && envFileValue === override) {
			source = OPENAI_MODEL_SOURCES.ENV_FILE;
		} else {
			source = OPENAI_MODEL_SOURCES.UNKNOWN;
		}
	}
	return {
		model: override || defaultModel,
		defaultModel,
		source,
		status: classifyOpenAiModelOverride(override, defaultModel),
		// Any OPENAI_MODEL present before dotenv ran, even an empty one, keeps .env.local's value out.
		shadowsEnvFile: shellPresent && Boolean(envFileValue) && envFileValue !== shellValue,
	};
}

const PROCESS_ENV_LABEL = "the process environment (shell, launcher, or deploy)";
const SOURCE_LABELS = {
	[OPENAI_MODEL_SOURCES.ENV_FILE]: ".env.local",
	[OPENAI_MODEL_SOURCES.PROCESS_ENV]: PROCESS_ENV_LABEL,
	[OPENAI_MODEL_SOURCES.UNKNOWN]: "an unrecorded origin",
};

// Plain-language warnings for an override. They name the default (from code) and the source,
// never the override's own value, so doctor output stays free of environment values.
function describeOpenAiModelWarnings(resolution) {
	const warnings = [];
	const where = SOURCE_LABELS[resolution.source] ?? resolution.source;
	if (resolution.shadowsEnvFile) {
		warnings.push(`OPENAI_MODEL set in ${PROCESS_ENV_LABEL} overrides the value in .env.local (dotenv never replaces a variable that is already set, even to an empty value).`);
	}
	if (resolution.status === OPENAI_MODEL_STATUSES.OLDER) {
		warnings.push(`OPENAI_MODEL from ${where} names an older model than the built-in default ${resolution.defaultModel}; remove it to follow the default.`);
	} else if (resolution.status === OPENAI_MODEL_STATUSES.MATCHES_DEFAULT) {
		warnings.push(`OPENAI_MODEL from ${where} repeats the built-in default ${resolution.defaultModel}; remove it so future default updates apply.`);
	}
	return warnings;
}

module.exports = {
	DEFAULT_OPENAI_MODEL,
	OPENAI_MODEL_SOURCES,
	OPENAI_MODEL_STATUSES,
	classifyOpenAiModelOverride,
	describeOpenAiModelWarnings,
	loadEnvFileWithModelOrigin,
	parseGptModelVersion,
	recordOpenAiModelEnvOrigin,
	resetOpenAiModelEnvOrigin,
	resolveOpenAiModel,
};
