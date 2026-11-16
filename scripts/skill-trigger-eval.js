#!/usr/bin/env node

// Runs skill-creator's official `run_eval` on a VPK skill's `evals/triggers.json` in an
// environment where its numbers mean something. This file only prepares that environment and
// then calls run_eval unchanged; it never scores a query itself.
//
// Why each piece exists (details: .agents/docs/skill-trigger-evals.md):
// - run_eval writes its temporary skill into `<nearest dir with .claude/>/.claude/commands` and
//   runs `claude -p` there. Run from the repo, the real skill of the same name wins the Skill call
//   and run_eval scores a miss; run from skill-creator's own folder, the nearest `.claude/` is
//   $HOME, so it writes into ~/.claude/commands. A throwaway project outside the repo fixes both.
// - That project links every sibling VPK skill (not the one under test), so siblings still compete.
// - A throwaway CLAUDE_CONFIG_DIR drops the user's 300+ skills, plugins and hooks. With them
//   loaded, the model starts with Bash or ToolSearch and run_eval counts any first tool other
//   than Skill or Read as "not triggered".
// - One worker by default. run_eval's parallel workers share the project, so each query sees every
//   in-flight worker's temporary command (same description, different id) and often calls another
//   worker's copy, which scores as a miss.
// - `--loop` runs skill-creator's `run_loop` (description tuning) the same way. It imports the same
//   root lookup and also defaults to 10 workers, so plain `run_loop` scores 0.0 for the same reasons.

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
const SKILLS_DIR = path.join(REPO_ROOT, ".agents", "skills");
const AUTH_ENV_KEYS = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_CODE_OAUTH_TOKEN"];
// Pass-through flags for run_eval with this wrapper's defaults.
const RUN_EVAL_DEFAULTS = { "--runs-per-query": "3", "--timeout": "60", "--num-workers": "1" };
const VALUE_FLAGS = { "--eval-set": "evalSet", "--out": "out", "--skill-creator": "skillCreator" };

const USAGE = `Usage: pnpm run eval:skill-triggers -- <skill> [options] [run_eval/run_loop flags]

Runs skill-creator's run_eval on .agents/skills/<skill>/evals/triggers.json from an isolated
project and Claude config, and saves its JSON under output/skill-evals/.

Options:
  --loop               Run run_loop (description tuning; needs --model) instead of run_eval.
  --keep-user-config   Keep your own Claude config (skills, plugins, hooks). Numbers drop to ~0.
  --eval-set <file>    Use another {query, should_trigger} file.
  --out <file>         Where to save the JSON (a failed run writes <file>.failed instead).
  --skill-creator <dir> skill-creator folder (default: the installed plugin).
Any other flag (--runs-per-query, --timeout, --num-workers, --model, --description,
--trigger-threshold, and for --loop --max-iterations, --holdout, --report, --results-dir)
goes to skill-creator unchanged. Pass --model so runs are comparable.`;

function parseArgs(argv) {
	const options = {
		skill: null,
		loop: false,
		keepUserConfig: false,
		evalSet: null,
		out: null,
		skillCreator: null,
		runEvalArgs: [],
	};
	const passthrough = {};
	for (let index = 0; index < argv.length; index += 1) {
		const raw = argv[index];
		if (raw === "--") continue;
		if (raw === "--help" || raw === "-h") return { ...options, help: true };
		// `--flag=value` and `--flag value` are the same flag.
		const [arg, inline] = raw.startsWith("--") && raw.includes("=") ? raw.split(/=(.*)/s) : [raw, undefined];
		const takeValue = () => {
			if (inline !== undefined) return inline;
			const next = argv[index + 1];
			if (next === undefined || next.startsWith("--")) throw new Error(`${arg} needs a value`);
			index += 1;
			return next;
		};
		if (arg === "--keep-user-config") options.keepUserConfig = true;
		else if (arg === "--loop") options.loop = true;
		else if (VALUE_FLAGS[arg]) options[VALUE_FLAGS[arg]] = takeValue();
		else if (arg === "--verbose") continue;
		else if (arg.startsWith("--")) {
			const next = argv[index + 1];
			if (inline !== undefined) passthrough[arg] = inline;
			else passthrough[arg] = next !== undefined && !next.startsWith("--") ? argv[++index] : null;
		} else if (!options.skill) options.skill = arg;
		else throw new Error(`Unexpected argument: ${arg}`);
	}
	const merged = { ...RUN_EVAL_DEFAULTS, ...passthrough };
	for (const [flag, value] of Object.entries(merged)) {
		options.runEvalArgs.push(flag);
		if (value !== null) options.runEvalArgs.push(value);
	}
	options.runEvalArgs.push("--verbose");
	options.numWorkers = Number(merged["--num-workers"]);
	options.model = merged["--model"] ?? null;
	return options;
}

function listSkillNames(skillsDir = SKILLS_DIR) {
	return fs
		.readdirSync(skillsDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && fs.existsSync(path.join(skillsDir, entry.name, "SKILL.md")))
		.map((entry) => entry.name)
		.sort();
}

// Throwaway project: `.claude/skills/<sibling>` links for every skill except the one under test,
// plus AGENTS.md so rows that name the VPK app keep their context.
function createSandboxProject({ skill, skillsDir = SKILLS_DIR, repoRoot = REPO_ROOT, tmpRoot = os.tmpdir() }) {
	const projectDir = fs.realpathSync(fs.mkdtempSync(path.join(tmpRoot, `vpk-skill-eval-${skill}-`)));
	const linkedSkillsDir = path.join(projectDir, ".claude", "skills");
	fs.mkdirSync(linkedSkillsDir, { recursive: true });
	const siblings = listSkillNames(skillsDir).filter((name) => name !== skill);
	for (const name of siblings) fs.symlinkSync(path.join(skillsDir, name), path.join(linkedSkillsDir, name));
	const agentsMd = path.join(repoRoot, "AGENTS.md");
	if (fs.existsSync(agentsMd)) fs.symlinkSync(agentsMd, path.join(projectDir, "AGENTS.md"));
	return { projectDir, siblings };
}

// Mirrors run_eval's find_project_root(): nearest ancestor of cwd holding a .claude/ directory.
function resolveRunEvalProjectRoot(cwd) {
	let current = path.resolve(cwd);
	for (;;) {
		if (fs.existsSync(path.join(current, ".claude")) && fs.statSync(path.join(current, ".claude")).isDirectory()) return current;
		const parent = path.dirname(current);
		if (parent === current) return path.resolve(cwd);
		current = parent;
	}
}

function buildEvalEnv({ baseEnv, skillCreatorDir, configDir }) {
	const env = { ...baseEnv };
	delete env.CLAUDECODE;
	env.PYTHONPATH = [skillCreatorDir, baseEnv.PYTHONPATH].filter(Boolean).join(path.delimiter);
	if (configDir) env.CLAUDE_CONFIG_DIR = configDir;
	return env;
}

function hasHeadlessAuth(env) {
	return AUTH_ENV_KEYS.some((key) => Boolean(env[key]));
}

function findSkillCreatorDir({ env = process.env, home = os.homedir() } = {}) {
	const configDir = env.CLAUDE_CONFIG_DIR ?? path.join(home, ".claude");
	const installed = path.join(configDir, "plugins", "installed_plugins.json");
	if (fs.existsSync(installed)) {
		const plugins = JSON.parse(fs.readFileSync(installed, "utf8")).plugins ?? {};
		for (const [id, installs] of Object.entries(plugins)) {
			if (!id.startsWith("skill-creator@")) continue;
			for (const install of installs) {
				const dir = path.join(install.installPath, "skills", "skill-creator");
				if (fs.existsSync(path.join(dir, "scripts", "run_eval.py"))) return dir;
			}
		}
	}
	return null;
}

function describeModel(options, env) {
	if (options.model) return `${options.model} (--model)`;
	if (env.ANTHROPIC_MODEL) return `${env.ANTHROPIC_MODEL} (ANTHROPIC_MODEL)`;
	return "Claude Code default (pass --model for comparable numbers)";
}

// Paths given on the command line are relative to where the user ran `pnpm run`, not the repo root.
function resolveUserPath(file, env = process.env) {
	return path.resolve(env.INIT_CWD ?? process.cwd(), file);
}

function displayPath(file) {
	const relative = path.relative(REPO_ROOT, file);
	return relative.startsWith("..") || path.isAbsolute(relative) ? file : relative;
}

// Only a clean exit with output replaces `out`; anything else goes next to it, so a failed or
// interrupted run never overwrites an earlier good result.
function writeResult({ out, code, stdout }) {
	const ok = code === 0 && stdout.length > 0;
	const target = ok ? out : `${out}.failed`;
	if (ok || stdout.length > 0) fs.writeFileSync(target, stdout);
	return { ok, target: ok || stdout.length > 0 ? target : null };
}

function main() {
	const options = parseArgs(process.argv.slice(2));
	if (options.help || !options.skill) {
		console.log(USAGE);
		process.exitCode = options.help ? 0 : 1;
		return;
	}
	const skillPath = path.join(SKILLS_DIR, options.skill);
	if (!fs.existsSync(path.join(skillPath, "SKILL.md"))) throw new Error(`No skill at ${path.relative(REPO_ROOT, skillPath)}`);
	const evalSet = options.evalSet ? resolveUserPath(options.evalSet) : path.join(skillPath, "evals", "triggers.json");
	if (!fs.existsSync(evalSet)) throw new Error(`No eval set at ${evalSet}`);
	const skillCreatorDir = options.skillCreator ? resolveUserPath(options.skillCreator) : findSkillCreatorDir();
	if (!skillCreatorDir) throw new Error("skill-creator is not installed; run `claude plugin install skill-creator@claude-plugins-official`.");
	if (options.loop && !options.model) throw new Error("--loop needs --model (run_loop uses it to rewrite the description).");

	if (!options.keepUserConfig && !hasHeadlessAuth(process.env)) {
		throw new Error(
			`An isolated Claude config has no login. Set one of ${AUTH_ENV_KEYS.join(", ")} ` +
				"(a claude-gw session already exports ANTHROPIC_API_KEY; on a subscription run `claude setup-token` and export CLAUDE_CODE_OAUTH_TOKEN).",
		);
	}

	const { projectDir, siblings } = createSandboxProject({ skill: options.skill });
	const configDir = options.keepUserConfig ? null : fs.mkdtempSync(path.join(os.tmpdir(), "vpk-skill-eval-config-"));
	let cleaned = false;
	const cleanup = () => {
		if (cleaned) return;
		cleaned = true;
		fs.rmSync(projectDir, { recursive: true, force: true });
		if (configDir) fs.rmSync(configDir, { recursive: true, force: true });
	};
	const projectRoot = resolveRunEvalProjectRoot(projectDir);
	if (projectRoot !== projectDir) {
		cleanup();
		throw new Error(`skill-creator would resolve ${projectRoot}, not the sandbox ${projectDir}`);
	}
	const mode = options.loop ? "run_loop" : "run_eval";
	const out = options.out
		? resolveUserPath(options.out)
		: path.join(
				REPO_ROOT,
				"output",
				"skill-evals",
				`${new Date().toISOString().slice(0, 10)}-${options.skill}`,
				options.loop ? "loop.json" : "triggers.json",
			);
	fs.mkdirSync(path.dirname(out), { recursive: true });

	console.error(`skill-creator: ${skillCreatorDir} (${mode})`);
	console.error(`sandbox project: ${projectDir} (${siblings.length} sibling skills linked, ${options.skill} left out)`);
	console.error(`claude config: ${configDir ?? "your own (--keep-user-config)"}`);
	console.error(`model: ${describeModel(options, process.env)}`);
	console.error(`results: ${displayPath(out)}`);
	if (options.numWorkers > 1) {
		console.error(`warning: ${options.numWorkers} workers share one sandbox and steal each other's triggers; expect false misses.`);
	}

	const args = ["-m", `scripts.${mode}`, "--eval-set", evalSet, "--skill-path", skillPath, ...options.runEvalArgs];
	const child = spawn("python3", args, {
		cwd: projectDir,
		env: buildEvalEnv({ baseEnv: process.env, skillCreatorDir, configDir }),
		stdio: ["ignore", "pipe", "inherit"],
	});
	const chunks = [];
	const onSignal = (signal) => {
		child.kill(signal);
		cleanup();
		process.exitCode = 130;
	};
	process.once("SIGINT", onSignal);
	process.once("SIGTERM", onSignal);
	child.stdout.on("data", (chunk) => chunks.push(chunk));
	child.on("error", (error) => {
		console.error(`could not start python3: ${error.message}`);
		cleanup();
		process.exitCode = 1;
	});
	child.on("close", (code) => {
		process.off("SIGINT", onSignal);
		process.off("SIGTERM", onSignal);
		const { ok, target } = writeResult({ out, code, stdout: Buffer.concat(chunks) });
		if (!ok) console.error(`${mode} exited ${code}; ${target ? `partial output in ${displayPath(target)}` : "no output"}, ${displayPath(out)} left as it was.`);
		cleanup();
		process.exitCode = ok ? 0 : code || 1;
	});
}

if (require.main === module) {
	try {
		main();
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}

module.exports = {
	AUTH_ENV_KEYS,
	buildEvalEnv,
	createSandboxProject,
	describeModel,
	findSkillCreatorDir,
	hasHeadlessAuth,
	listSkillNames,
	parseArgs,
	resolveRunEvalProjectRoot,
	resolveUserPath,
	writeResult,
};
