const assert = require("node:assert/strict");
const {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} = require("node:fs");
const { tmpdir } = require("node:os");
const { dirname, join } = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const SCRIPT_PATH = join(__dirname, "vpk-system-clean.sh");
const INSTALL_SCRIPT_PATH = join(__dirname, "install.sh");
const ZSH_PATH = ["/bin/zsh", "/usr/bin/zsh"].find(existsSync);
const ZSH_TEST_OPTIONS = {
	skip: ZSH_PATH ? false : "requires zsh for the macOS maintenance script",
};

function writeCodexStateDb(path, threads) {
	const originalEmitWarning = process.emitWarning;
	process.emitWarning = () => {};
	const { DatabaseSync } = require("node:sqlite");
	process.emitWarning = originalEmitWarning;
	const db = new DatabaseSync(path);
	db.exec("CREATE TABLE threads (id TEXT PRIMARY KEY, cwd TEXT NOT NULL, updated_at INTEGER NOT NULL, updated_at_ms INTEGER)");
	const insert = db.prepare("INSERT INTO threads (id, cwd, updated_at, updated_at_ms) VALUES (?, ?, ?, ?)");
	threads.forEach((thread, index) => {
		const updatedMs = Date.now() - thread.ageHours * 3600 * 1000;
		insert.run(`t${index}`, thread.cwd, Math.floor(updatedMs / 1000), updatedMs);
	});
	db.close();
}

function writeExecutable(path, source) {
	writeFileSync(path, source);
	chmodSync(path, 0o755);
}

function runSweep({
	cpu = "75.0",
	elapsed = "01:00:00",
	executable = "/usr/local/bin/almd",
	almd = true,
	sessions = null,
	operators = [],
	codexThreads = null,
	oldNode = false,
} = {}) {
	const root = mkdtempSync(join(tmpdir(), "vpk-system-clean-test-"));
	const home = join(root, "home");
	const fakeBin = join(root, "bin");
	const zDotDir = join(root, "zdot");
	const killLog = join(root, "kill.log");
	const stopLog = join(root, "stop.log");
	const tmuxLog = join(root, "tmux.log");
	const sessionsFile = join(root, "tmux-sessions");
	const cleanupLog = join(home, "Library/Logs/vpk-system-clean.log");
	const repositoryRoot = join(home, "Labs/project");
	mkdirSync(join(home, "Library/Logs"), { recursive: true });
	mkdirSync(repositoryRoot, { recursive: true });
	mkdirSync(fakeBin, { recursive: true });
	mkdirSync(zDotDir, { recursive: true });
	writeFileSync(join(zDotDir, ".zshenv"), "disable kill\n");
	const codexHome = join(home, ".codex");
	if (codexThreads !== null) {
		mkdirSync(codexHome, { recursive: true });
		writeCodexStateDb(join(codexHome, "state_5.sqlite"), codexThreads(home));
	}

	const resolvedSessions = typeof sessions === "function" ? sessions(home) : sessions;
	const resolvedOperators = typeof operators === "function" ? operators(home) : operators;
	const now = Math.floor(Date.now() / 1000);
	const sessionLines = (resolvedSessions ?? []).map((session) => {
		const worktreePath = session.path;
		if (!session.missingPath) {
			mkdirSync(join(worktreePath, "scripts"), { recursive: true });
			writeExecutable(
				join(worktreePath, "scripts", "dev-tmux-plain.sh"),
				`#!/bin/bash
printf 'stop session=%s cwd=%s args=%s\\n' "\${VPK_DEV_TMUX_SESSION}" "$(pwd)" "$*" >> "${stopLog}"
`,
			);
		}
		const created = now - (session.createdAgoSecs ?? 3600);
		return [session.socket ?? "vpk-dev", session.name, worktreePath, session.attached ?? "0", String(created)].join(
			"|",
		);
	});
	writeFileSync(sessionsFile, `${sessionLines.join("\n")}${sessionLines.length ? "\n" : ""}`);

	const operatorPids = resolvedOperators
		.map((operator) => `	"-x ${operator.name}") echo ${operator.pid} ;;`)
		.join("\n");
	writeExecutable(
		join(fakeBin, "pgrep"),
		`#!/bin/sh
case "$*" in
	"-x almd") ${almd ? "echo 4242" : "exit 1"} ;;
${operatorPids}
	*) exit 1 ;;
esac
`,
	);
	writeExecutable(
		join(fakeBin, "ps"),
		`#!/bin/sh
case "$*" in
	*%cpu=*) echo "${cpu}" ;;
	*etime=*) echo "${elapsed}" ;;
	*) exit 1 ;;
esac
`,
	);

	const operatorCwdCases = resolvedOperators
		.map(
			(operator) => `	*"-p ${operator.pid}"*|*"-p${operator.pid}"*)
		printf 'p${operator.pid}\\nfcwd\\nn${operator.cwd}\\n'
		exit 0
		;;`,
		)
		.join("\n");
	writeExecutable(
		join(fakeBin, "lsof"),
		`#!/bin/sh
case " $* " in
	*" -d txt "*|*" -d txt")
		printf 'p4242\\nftxt\\nn${executable}\\n'
		exit 0
		;;
esac
case "$*" in
${operatorCwdCases}
esac
exit 0
`,
	);
	writeExecutable(join(fakeBin, "sleep"), "#!/bin/sh\nexit 0\n");
	if (oldNode) {
		// A node too old for node:sqlite, first on PATH.
		writeExecutable(
			join(fakeBin, "node"),
			`#!/bin/sh
[ "$1" = "--version" ] && { echo v20.11.0; exit 0; }
echo "Error [ERR_UNKNOWN_BUILTIN_MODULE]: No such built-in module: node:sqlite" >&2
exit 1
`,
		);
	}
	if (resolvedSessions === null) {
		writeExecutable(join(fakeBin, "tmux"), "#!/bin/sh\nexit 1\n");
	} else {
		writeExecutable(
			join(fakeBin, "tmux"),
			`#!/bin/sh
socket="default"
while [ "$#" -gt 0 ]; do
	case "$1" in
		-L)
			socket="$2"
			shift 2
			;;
		-F|-t|-p)
			shift 2
			;;
		list-sessions)
			awk -F'|' -v s="$socket" '$1==s { print $2"|"$3"|"$4"|"$5 }' "${sessionsFile}"
			exit 0
			;;
		kill-session)
			printf 'kill-session %s %s\\n' "$socket" "$*" >> "${tmuxLog}"
			exit 0
			;;
		send-keys)
			printf 'send-keys %s %s\\n' "$socket" "$*" >> "${tmuxLog}"
			exit 0
			;;
		*)
			shift
			;;
	esac
done
exit 1
`,
		);
	}
	writeExecutable(
		join(fakeBin, "kill"),
		`#!/bin/sh
if [ "\${1:-}" = "-0" ]; then
	exit 1
fi
printf '%s\\n' "$*" >> "$FAKE_KILL_LOG"
`,
	);

	const result = spawnSync(ZSH_PATH, [SCRIPT_PATH], {
		encoding: "utf8",
		env: {
			...process.env,
			FAKE_KILL_LOG: killLog,
			HOME: home,
			CODEX_HOME: codexHome,
			PATH: `${fakeBin}:${dirname(process.execPath)}:/usr/bin:/bin:/usr/sbin:/sbin`,
			VPK_REPO_ROOT: repositoryRoot,
			ZDOTDIR: zDotDir,
		},
	});
	const output = {
		cleanupLog: existsSync(cleanupLog) ? readFileSync(cleanupLog, "utf8") : "",
		killLog: existsSync(killLog) ? readFileSync(killLog, "utf8") : "",
		stopLog: existsSync(stopLog) ? readFileSync(stopLog, "utf8") : "",
		tmuxLog: existsSync(tmuxLog) ? readFileSync(tmuxLog, "utf8") : "",
		result,
	};
	rmSync(root, { recursive: true, force: true });
	return output;
}

test("resets an exact-path almd only after sustained high CPU", ZSH_TEST_OPTIONS, () => {
	const { cleanupLog, killLog, result } = runSweep();

	assert.equal(result.status, 0, result.stderr);
	assert.equal(killLog.trim(), "4242");
	assert.match(cleanupLog, /stopped runaway almd pid 4242 with TERM \(~75\.0% CPU, 3600s old/);
	assert.match(cleanupLog, /summary: .*; almd reset 1; fseventsd/);
});

test("keeps almd during its protected startup window", ZSH_TEST_OPTIONS, () => {
	const { cleanupLog, killLog, result } = runSweep({ elapsed: "00:05:00" });

	assert.equal(result.status, 0, result.stderr);
	assert.equal(killLog, "");
	assert.match(cleanupLog, /kept almd pid 4242 \(300s old < 900s minimum\)/);
});

test("keeps a same-named process from an unexpected executable path", ZSH_TEST_OPTIONS, () => {
	const { cleanupLog, killLog, result } = runSweep({ executable: "/tmp/almd" });

	assert.equal(result.status, 0, result.stderr);
	assert.equal(killLog, "");
	assert.match(cleanupLog, /unexpected executable '\/tmp\/almd', expected \/usr\/local\/bin\/almd/);
});

test("stops an old unattached leftover stack through the worktree stop script", ZSH_TEST_OPTIONS, () => {
	const { cleanupLog, stopLog, tmuxLog, result } = runSweep({
		almd: false,
		sessions: (home) => [
			{
				socket: "vpk-dev",
				name: "vpk-dev-leftover",
				path: join(home, "wt-leftover"),
				attached: "0",
				createdAgoSecs: 3600,
			},
		],
	});

	assert.equal(result.status, 0, result.stderr);
	assert.match(stopLog, /stop session=vpk-dev-leftover/);
	assert.match(stopLog, /args=stop/);
	assert.equal(tmuxLog, "");
	assert.match(cleanupLog, /stopped idle tmux session vpk-dev-leftover on vpk-dev socket/);
	assert.match(cleanupLog, /1 idle stack\(s\) stopped/);
});

test("stops an exact legacy default-socket stack without calling the private-socket launcher", ZSH_TEST_OPTIONS, () => {
	const { cleanupLog, stopLog, tmuxLog, result } = runSweep({
		almd: false,
		sessions: (home) => [
			{
				socket: "default",
				name: "vpk-dev-legacy",
				path: join(home, "wt-legacy"),
				attached: "0",
				createdAgoSecs: 3600,
			},
		],
	});

	assert.equal(result.status, 0, result.stderr);
	assert.match(tmuxLog, /send-keys default/);
	assert.match(tmuxLog, /kill-session default/);
	assert.equal(stopLog, "");
	assert.match(cleanupLog, /stopped idle tmux session vpk-dev-legacy on default socket/);
});

test("keeps the primary checkout even when old and unattached", ZSH_TEST_OPTIONS, () => {
	const { cleanupLog, stopLog, result } = runSweep({
		almd: false,
		sessions: (home) => [
			{
				socket: "vpk-dev",
				name: "vpk-dev-main",
				path: join(home, "Labs/project"),
				attached: "0",
				createdAgoSecs: 7200,
			},
		],
	});

	assert.equal(result.status, 0, result.stderr);
	assert.equal(stopLog, "");
	assert.match(cleanupLog, /kept tmux session vpk-dev-main on vpk-dev socket \(primary checkout\)/);
});

test("installer gives launchd an explicit repository context", () => {
	const installSource = readFileSync(INSTALL_SCRIPT_PATH, "utf8");

	assert.match(installSource, /git -C "\$SKILL_DIR" worktree list --porcelain/u);
	assert.match(installSource, /sed -n 's\/\^worktree \/\/p' \| head -1/u);
	assert.match(installSource, /<key>WorkingDirectory<\/key>[\s\S]*<string>\$\{REPO_ROOT\}<\/string>/u);
	assert.match(installSource, /<key>VPK_REPO_ROOT<\/key>[\s\S]*<string>\$\{REPO_ROOT\}<\/string>/u);
});

test("keeps a leftover stack still inside the grace window", ZSH_TEST_OPTIONS, () => {
	const { cleanupLog, stopLog, result } = runSweep({
		almd: false,
		sessions: (home) => [
			{
				socket: "vpk-dev",
				name: "vpk-dev-warming",
				path: join(home, "wt-warming"),
				attached: "0",
				createdAgoSecs: 60,
			},
		],
	});

	assert.equal(result.status, 0, result.stderr);
	assert.equal(stopLog, "");
	assert.match(cleanupLog, /kept tmux session vpk-dev-warming on vpk-dev socket \(\d+s old < 1800s minimum\)/);
});

test("keeps an old leftover stack that still has a claude operator", ZSH_TEST_OPTIONS, () => {
	const { cleanupLog, stopLog, result } = runSweep({
		almd: false,
		sessions: (home) => [
			{
				socket: "vpk-dev",
				name: "vpk-dev-operator",
				path: join(home, "wt-operator"),
				attached: "0",
				createdAgoSecs: 7200,
			},
		],
		operators: (home) => [{ name: "claude", pid: "99", cwd: join(home, "wt-operator") }],
	});

	assert.equal(result.status, 0, result.stderr);
	assert.equal(stopLog, "");
	assert.match(cleanupLog, /kept tmux session vpk-dev-operator on vpk-dev socket \(tool process cwd is /);
});

const codexSession = (home) => [
	{
		socket: "vpk-dev",
		name: "vpk-dev-codex",
		path: join(home, ".codex/worktrees/89b2/project"),
		attached: "0",
		createdAgoSecs: 7200,
	},
];

test("keeps a Codex Desktop worktree when the Codex state database is missing", ZSH_TEST_OPTIONS, () => {
	const { cleanupLog, stopLog, result } = runSweep({ almd: false, sessions: codexSession });

	assert.equal(result.status, 0, result.stderr);
	assert.equal(stopLog, "");
	assert.match(cleanupLog, /kept tmux session vpk-dev-codex on vpk-dev socket \(Codex threads unknown: Codex state database not found\)/);
});

test("keeps a Codex Desktop worktree with no thread in it (a sibling path does not count)", ZSH_TEST_OPTIONS, () => {
	const { cleanupLog, stopLog, result } = runSweep({
		almd: false,
		sessions: codexSession,
		codexThreads: (home) => [{ cwd: join(home, ".codex/worktrees/89b2/project-2"), ageHours: 48 }],
	});

	assert.equal(result.status, 0, result.stderr);
	assert.equal(stopLog, "");
	assert.match(cleanupLog, /kept tmux session vpk-dev-codex on vpk-dev socket \(Codex threads unknown: no Codex thread has this cwd\)/);
});

test("keeps a Codex Desktop worktree whose newest thread is recent", ZSH_TEST_OPTIONS, () => {
	const { cleanupLog, stopLog, result } = runSweep({
		almd: false,
		sessions: codexSession,
		codexThreads: (home) => [
			{ cwd: join(home, ".codex/worktrees/89b2/project"), ageHours: 40 },
			{ cwd: join(home, ".codex/worktrees/89b2/project"), ageHours: 3 },
		],
	});

	assert.equal(result.status, 0, result.stderr);
	assert.equal(stopLog, "");
	assert.match(cleanupLog, /kept tmux session vpk-dev-codex on vpk-dev socket \(Codex threads recent: newest Codex thread is younger than 24h\)/);
});

test("stops a Codex Desktop worktree once every thread for its cwd is idle", ZSH_TEST_OPTIONS, () => {
	const { cleanupLog, stopLog, result } = runSweep({
		almd: false,
		sessions: codexSession,
		codexThreads: (home) => [
			{ cwd: join(home, ".codex/worktrees/89b2/project"), ageHours: 26 },
			{ cwd: join(home, ".codex/worktrees/other/project"), ageHours: 0 },
		],
	});

	assert.equal(result.status, 0, result.stderr);
	assert.match(stopLog, /stop session=vpk-dev-codex/);
	assert.match(cleanupLog, /stopped idle tmux session vpk-dev-codex on vpk-dev socket \(.*; Codex threads idle: every Codex thread is at least 24h old\)/);
});

test("keeps an attached leftover stack", ZSH_TEST_OPTIONS, () => {
	const { cleanupLog, stopLog, result } = runSweep({
		almd: false,
		sessions: (home) => [
			{
				socket: "vpk-dev",
				name: "vpk-dev-attached",
				path: join(home, "wt-attached"),
				attached: "1",
				createdAgoSecs: 7200,
			},
		],
	});

	assert.equal(result.status, 0, result.stderr);
	assert.equal(stopLog, "");
	assert.match(cleanupLog, /kept tmux session vpk-dev-attached on vpk-dev socket \(attached\)/);
});

test("kills an unattached orphan whose worktree path is gone", ZSH_TEST_OPTIONS, () => {
	const { cleanupLog, tmuxLog, stopLog, result } = runSweep({
		almd: false,
		sessions: (home) => [
			{
				socket: "vpk-dev",
				name: "vpk-dev-orphan",
				path: join(home, "gone-worktree"),
				attached: "0",
				createdAgoSecs: 7200,
				missingPath: true,
			},
		],
	});

	assert.equal(result.status, 0, result.stderr);
	assert.equal(stopLog, "");
	assert.match(tmuxLog, /send-keys/);
	assert.match(tmuxLog, /kill-session/);
	assert.match(cleanupLog, /killed stale tmux session vpk-dev-orphan on vpk-dev socket/);
});

test("a node too old for node:sqlite keeps the Codex stack and logs why", ZSH_TEST_OPTIONS, () => {
	const { cleanupLog, stopLog, result } = runSweep({
		almd: false,
		sessions: codexSession,
		codexThreads: (home) => [{ cwd: join(home, ".codex/worktrees/89b2/project"), ageHours: 48 }],
		oldNode: true,
	});

	assert.equal(result.status, 0, result.stderr);
	assert.equal(stopLog, "");
	assert.match(cleanupLog, /kept tmux session vpk-dev-codex on vpk-dev socket \(Codex threads unknown: probe failed under .*\/node \(v20\.11\.0\): Error \[ERR_UNKNOWN_BUILTIN_MODULE\]: No such built-in module: node:sqlite\)/);
});
