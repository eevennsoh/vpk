"use strict";

const express = require("express");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
	resolveDevTmuxSessionName,
} = require("../../scripts/lib/dev-tmux-session");
const {
	createRequireLocalDevRequest,
	passThrough,
} = require("../middleware/local-only");

const MAX_PROMPT_BYTES = 64 * 1024;
const DEFAULT_REPO_ROOT = path.resolve(__dirname, "..", "..");
const TOKENS_PATH = path.join(DEFAULT_REPO_ROOT, ".agents", "skills", "vpk-html", "references", "tokens.json");

const AGENT_ARGV = {
	claude: ["claude-gw"],
	codex: ["codex-gw"],
	cursor: ["cursor-agent"],
	rovo: ["rovo", "run", "--yolo"],
};

function isProduction(env) {
	return env.NODE_ENV === "production";
}

function shellQuote(value) {
	return "'" + String(value).replace(/'/g, "'\\''") + "'";
}

function formatWindowTimestamp(date) {
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");
	const seconds = String(date.getSeconds()).padStart(2, "0");
	return `${hours}${minutes}${seconds}`;
}

function execFileAsync(execFileImpl, file, args) {
	return new Promise((resolve, reject) => {
		execFileImpl(file, args, (error, stdout, stderr) => {
			if (error) {
				reject(error);
				return;
			}
			resolve({ stdout, stderr });
		});
	});
}

async function ensureTmuxSession({
	execFileImpl,
	repoRoot,
	sessionName,
}) {
	try {
		await execFileAsync(execFileImpl, "tmux", ["has-session", "-t", sessionName]);
		return;
	} catch {
		await execFileAsync(execFileImpl, "tmux", [
			"new-session",
			"-d",
			"-s",
			sessionName,
			"-n",
			"agents",
			"-c",
			repoRoot,
		]);
	}
}

function validateDispatchBody(body) {
	const agent = body && typeof body.agent === "string" ? body.agent : "";
	const prompt = body && typeof body.prompt === "string" ? body.prompt : "";

	if (!Object.hasOwn(AGENT_ARGV, agent)) {
		return { error: "Unknown agent" };
	}
	if (!prompt.trim()) {
		return { error: "Prompt is required" };
	}
	if (Buffer.byteLength(prompt, "utf8") > MAX_PROMPT_BYTES) {
		return { error: "Prompt exceeds 64KB" };
	}

	return { agent, prompt };
}

function createHtmlSelectorRouter({
	env = process.env,
	execFileImpl = execFile,
	fsImpl = fs,
	now = () => new Date(),
	repoRoot = DEFAULT_REPO_ROOT,
	requireRuntimeAdmin = passThrough,
	resolveSessionNameImpl = resolveDevTmuxSessionName,
} = {}) {
	const router = express.Router();
	const requireLocalDevRequest = createRequireLocalDevRequest({ env });

	router.post("/dispatch", requireLocalDevRequest, requireRuntimeAdmin, async (req, res) => {
		const validation = validateDispatchBody(req.body);
		if (validation.error) {
			return res.status(400).json({ error: validation.error });
		}

		const tempDir = fsImpl.mkdtempSync(path.join(os.tmpdir(), "vpk-html-selector-"));
		const promptPath = path.join(tempDir, "prompt.txt");
		fsImpl.writeFileSync(promptPath, validation.prompt, "utf8");

		const sessionName = resolveSessionNameImpl({ env });
		const windowName = `hs-${validation.agent}-${formatWindowTimestamp(now())}`;
		const agentArgv = AGENT_ARGV[validation.agent];
		// Agent CLIs may be shell functions or aliases from the user's zsh
		// config (claude-gw/codex-gw are), which never resolve in the
		// non-interactive `sh -c` that a tmux new-window command uses. So the
		// window is created with the user's default interactive shell and the
		// command line is typed into it via send-keys. Every interpolated
		// string below is server-controlled; the prompt itself only ever
		// travels through the temp file.
		const windowCommand = [
			"cd",
			shellQuote(repoRoot),
			"&&",
			agentArgv.join(" "),
			"--",
			`"$(cat ${shellQuote(promptPath)})"`,
		].join(" ");

		try {
			await ensureTmuxSession({ execFileImpl, repoRoot, sessionName });
			const created = await execFileAsync(execFileImpl, "tmux", [
				"new-window",
				"-P",
				"-F",
				"#{window_id}",
				"-t",
				`${sessionName}:`,
				"-n",
				windowName,
				"-c",
				repoRoot,
			]);
			const windowTarget = String(created.stdout || "").trim() || `${sessionName}:${windowName}`;
			await execFileAsync(execFileImpl, "tmux", [
				"send-keys",
				"-t",
				windowTarget,
				windowCommand,
				"Enter",
			]);
		} catch (error) {
			return res.status(500).json({
				error: error instanceof Error ? error.message : String(error),
			});
		}

		return res.json({
			ok: true,
			agent: validation.agent,
			sessionName,
			windowName,
		});
	});

	router.get("/tokens", (_req, res) => {
		if (isProduction(env)) {
			return res.status(404).json({ error: "Not available" });
		}

		try {
			return res.json(JSON.parse(fsImpl.readFileSync(TOKENS_PATH, "utf8")));
		} catch (error) {
			return res.status(500).json({
				error: error instanceof Error ? error.message : String(error),
			});
		}
	});

	return router;
}

function registerHtmlSelectorRoutes(app, dependencies = {}) {
	app.use("/api/html-selector", createHtmlSelectorRouter(dependencies));
}

module.exports = {
	AGENT_ARGV,
	MAX_PROMPT_BYTES,
	createHtmlSelectorRouter,
	registerHtmlSelectorRoutes,
	shellQuote,
	validateDispatchBody,
};
