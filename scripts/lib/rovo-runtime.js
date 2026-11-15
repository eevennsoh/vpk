const fs = require("node:fs");

const { ensureEnvLocalExists: ensureEnvLocalExistsBase } = require("./env-local");
const { resolveRovoBin } = require("./rovo-utils");
const {
	ensureBrowserRuntimeEnvDefaults,
} = require("../../backend/lib/browser-runtime-config");
const {
	dedupeAllowedMcpServersInConfig,
	resolveRovoConfigPath,
	syncWorkspaceRovoConfig,
} = require("./rovo-config");

function ensureEnvLocalExists({ cwd = process.cwd(), logger = console } = {}) {
	const result = ensureEnvLocalExistsBase({ cwd });

	if (result.createdFrom === "main-worktree") {
		logger.log?.(`[rovo] Created .env.local from main worktree: ${result.mainWorktreePath}`);
	} else if (result.createdFrom === "example") {
		logger.log?.("[rovo] Created .env.local from .env.local.example");
	}

	return result;
}

function loadEnvLocal({ envLocalPath } = {}) {
	try {
		// dotenv 18 merges DOTENV_* env options (e.g. DOTENV_OVERRIDE) into config(); an explicit
		// override: false keeps exported variables winning over .env.local regardless.
		require("dotenv").config({ path: envLocalPath, override: false });
	} catch {
		// Ignore dotenv loading failures.
	}
}

function applyBrowserRuntimeDefaults({ logger = console } = {}) {
	const result = ensureBrowserRuntimeEnvDefaults();
	if (result.changed) {
		logger.log?.(
			`[rovo] Defaulted ROVO_BROWSER_MODE=${result.browserMode} (${result.reason})`
		);
	}

	return result;
}

function resolveRovoConfigState({ cwd = process.cwd(), dedupeConfig = true } = {}) {
	if (dedupeConfig) {
		dedupeAllowedMcpServersInConfig();
		return syncWorkspaceRovoConfig({ cwd });
	}

	const configPath = resolveRovoConfigPath();
	return {
		configPath,
		exists: fs.existsSync(configPath),
		changed: false,
		removed: 0,
	};
}

function prepareRovoRuntime({ cwd = process.cwd(), logger = console, dedupeConfig = true, logConfigState = true, logBillingSite = true } = {}) {
	const { envLocalPath } = ensureEnvLocalExists({ cwd, logger });
	loadEnvLocal({ envLocalPath });
	const browserRuntimeDefaults = applyBrowserRuntimeDefaults({ logger });

	const configuredBillingSiteUrl = (process.env.ROVO_BILLING_URL ?? "").trim();
	if (!configuredBillingSiteUrl) {
		throw new Error("[rovo] ROVO_BILLING_URL is not set in .env.local");
	}

	const configState = resolveRovoConfigState({ cwd, dedupeConfig });
	if (logConfigState) {
		if (configState.exists) {
			logger.log?.(`[rovo] Using config: ${configState.configPath}`);
		}
		if (configState.mcpConfigPath) {
			logger.log?.(`[rovo] Using MCP config: ${configState.mcpConfigPath}`);
		}
	}

	const { bin: rovoBin, servePrefix } = resolveRovoBin();
	if (logBillingSite) {
		logger.log?.(
			`[rovo] Billing site URL: ${configuredBillingSiteUrl} (override with ROVO_BILLING_URL)`
		);
	}

	return {
		browserRuntimeDefaults,
		configState,
		configuredBillingSiteUrl,
		rovoBin,
		servePrefix,
	};
}

function buildSpawnArgsForPort({ port, servePrefix, configState, configuredBillingSiteUrl }) {
	return [
		...servePrefix,
		"serve",
		...(configState?.exists ? ["--config-file", configState.configPath] : []),
		// "--disable-session-token",
		"--site-url",
		configuredBillingSiteUrl,
		String(port),
	];
}

module.exports = {
	buildSpawnArgsForPort,
	ensureEnvLocalExists,
	loadEnvLocal,
	prepareRovoRuntime,
	resolveRovoConfigState,
};
