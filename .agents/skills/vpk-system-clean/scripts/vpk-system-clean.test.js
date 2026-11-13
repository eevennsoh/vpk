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
	memory = { swapUsed: "1024.00M", level: "1" },
	nextServer = null,
	args = [],
	oldNode = false,
	clockStart = null,
	pressureState = null,
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

	// A next-server's cumulative CPU time (`ps -o time=`) is read at the start and
	// end of the bloat window; each fake read returns the next value in cpuTimes.
	const server = typeof nextServer === "function" ? nextServer(home) : nextServer;
	const cpuSequence = join(root, "cpu-sequence");
	const cpuCounter = join(root, "cpu-counter");
	if (server) writeFileSync(cpuSequence, `${server.cpuTimes.join("\n")}\n`);
	// The clock only moves when the script sleeps: `date +%s` is FAKE_NOW plus every
	// second slept so far. No real time passes.
	const sleptFile = join(root, "slept");
	writeFileSync(sleptFile, "0\n");
	const fakeNow = clockStart ?? Math.floor(Date.now() / 1000);
	const pressureStatePath = join(home, ".config/vpk-system-clean/pressure-last-run");
	if (pressureState !== null) {
		mkdirSync(dirname(pressureStatePath), { recursive: true });
		writeFileSync(pressureStatePath, `${pressureState(fakeNow)}\n`);
	}
	writeExecutable(
		join(fakeBin, "sysctl"),
		`#!/bin/sh
case "$*" in
	"-n vm.swapusage") echo "total = 38912.00M  used = ${memory.swapUsed}  free = 1024.00M  (encrypted)" ;;
	"-n kern.memorystatus_vm_pressure_level") echo "${memory.level}" ;;
	*) exit 1 ;;
esac
`,
	);
	writeExecutable(
		join(fakeBin, "vmmap"),
		server ? `#!/bin/sh\nprintf 'Physical footprint:         %sG\\n' "${server.gb}"\n` : "#!/bin/sh\nexit 1\n",
	);

	const operatorPids = resolvedOperators
		.map((operator) => `	"-x ${operator.name}") echo ${operator.pid} ;;`)
		.join("\n");
	writeExecutable(
		join(fakeBin, "pgrep"),
		`#!/bin/sh
case "$*" in
	"-x almd") ${almd ? "echo 4242" : "exit 1"} ;;
	"-f next-server") ${server ? `echo ${server.pid}` : "exit 1"} ;;
${operatorPids}
	*) exit 1 ;;
esac
`,
	);
	writeExecutable(
		join(fakeBin, "ps"),
		`#!/bin/sh
case "$*" in
${
	server
		? `	*time=*"-p ${server.pid}"*)
		n=$(( $(cat "${cpuCounter}" 2>/dev/null || echo 0) + 1 ))
		echo "$n" > "${cpuCounter}"
		line=$(sed -n "\${n}p" "${cpuSequence}")
		[ -n "$line" ] || line=$(tail -n 1 "${cpuSequence}")
		echo "$line"
		;;
	*%cpu=*"-p ${server.pid}"*) echo "0.0" ;;`
		: ""
}
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
${
	server
		? `	*"-p ${server.pid}"*)
		printf 'p${server.pid}\\nfcwd\\nn${server.cwd}\\n'
		exit 0
		;;`
		: ""
}
esac
exit 0
`,
	);
	writeExecutable(join(fakeBin, "sleep"), `#!/bin/sh\necho $(( $(cat "${sleptFile}") + \${1%.*} )) > "${sleptFile}"\n`);
	writeExecutable(
		join(fakeBin, "date"),
		`#!/bin/sh\nif [ "$*" = "+%s" ]; then echo $(( ${fakeNow} + $(cat "${sleptFile}") )); else exec /bin/date "$@"; fi\n`,
	);
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

	const result = spawnSync(ZSH_PATH, [SCRIPT_PATH, ...args], {
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
		pressureState: existsSync(pressureStatePath) ? readFileSync(pressureStatePath, "utf8").trim() : null,
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

const PRESSURE = { swapUsed: "37580.80M", level: "2" };
const bloatedServer = (overrides) => (home) => ({
	pid: 7001,
	gb: "9.2",
	cwd: join(home, "wt-bloated"),
	...overrides,
});
// Cumulative CPU time (ps -o time=) at the start and end of the 30s settle window.
const cpuOver30s = (busySeconds) => ["12:00.00", `12:${String(busySeconds).padStart(2, "0")}.00`];

test("an idle 9GB server is restarted on its true CPU average over the window", ZSH_TEST_OPTIONS, () => {
	// 0.45 CPU-seconds in 30s is 1.5%, the live idle main-checkout reading on
	// 2026-11-13, while ps's decaying %cpu read 7-10% for the same server.
	const { cleanupLog, killLog, result } = runSweep({
		almd: false,
		nextServer: bloatedServer({ cpuTimes: ["12:00.00", "12:00.45"] }),
	});

	assert.equal(result.status, 0, result.stderr);
	assert.equal(killLog.trim(), "7001");
	assert.match(cleanupLog, /mode: normal mode \(swap 1GB in use, memory-pressure level 1\); bloat limit 6GB, idle below 20% CPU over the window/);
	assert.match(cleanupLog, /killed bloated next-server pid 7001 \(~9GB physical footprint, idle: 1\.5% CPU averaged over 30s < 20%/);
	assert.match(cleanupLog, /summary: normal mode; killed 0 runaway server\(s\); bloated 1 server\(s\)/);
});

test("a bloated server busy across the window is kept and says why", ZSH_TEST_OPTIONS, () => {
	const { cleanupLog, killLog, result } = runSweep({
		almd: false,
		nextServer: bloatedServer({ cpuTimes: ["1:12:00.00", "1:12:36.00"] }),
	});

	assert.equal(result.status, 0, result.stderr);
	assert.equal(killLog, "");
	assert.match(cleanupLog, /kept next-server pid 7001 \(~9GB but busy: 120\.0% CPU averaged over 30s >= 20%; .*wt-bloated\) — deferred to next sweep/);
});

test("a server averaging 22% is deferred normally and restarted under pressure", ZSH_TEST_OPTIONS, () => {
	const cpuTimes = ["12:00.00", "12:06.60"];
	const normal = runSweep({ almd: false, nextServer: bloatedServer({ cpuTimes }) });
	assert.equal(normal.result.status, 0, normal.result.stderr);
	assert.equal(normal.killLog, "");
	assert.match(normal.cleanupLog, /kept next-server pid 7001 \(~9GB but busy: 22\.0% CPU averaged over 30s/);

	const pressured = runSweep({ almd: false, memory: PRESSURE, nextServer: bloatedServer({ cpuTimes }) });
	assert.equal(pressured.result.status, 0, pressured.result.stderr);
	assert.equal(pressured.killLog.trim(), "7001");
	assert.match(pressured.cleanupLog, /mode: pressure mode \(swap 36GB in use >= 16GB\); bloat limit 4GB, idle below 50% CPU over the window/);
	assert.match(pressured.cleanupLog, /killed bloated next-server pid 7001 .*idle: 22\.0% CPU averaged over 30s < 50%.*; pressure mode\)/);
});

test("pressure mode restarts a 5GB idle server only when its worktree shows no live task", ZSH_TEST_OPTIONS, () => {
	const idle5 = (cwd) => (home) => ({ pid: 7001, gb: "5.1", cwd: cwd(home), cpuTimes: cpuOver30s(0) });
	const levelCritical = { swapUsed: "2048.00M", level: "4" };

	const normal = runSweep({ almd: false, nextServer: idle5((home) => join(home, "wt-bloated")) });
	assert.equal(normal.killLog, "");
	assert.match(normal.cleanupLog, /kept next-server pid 7001 \(~5GB < 6GB bloat limit; .*wt-bloated\)/);

	const free = runSweep({ almd: false, memory: levelCritical, nextServer: idle5((home) => join(home, "wt-bloated")) });
	assert.equal(free.killLog.trim(), "7001", "no live task: restarted");
	assert.match(free.cleanupLog, /mode: pressure mode \(memory-pressure level 4 >= 4\)/);

	const operated = runSweep({
		almd: false,
		memory: levelCritical,
		nextServer: idle5((home) => join(home, "wt-bloated")),
		operators: (home) => [{ name: "claude", pid: "99", cwd: join(home, "wt-bloated/app") }],
	});
	assert.equal(operated.killLog, "");
	assert.match(operated.cleanupLog, /kept next-server pid 7001 \(~5GB, 0\.0% CPU averaged over 30s, below the 6GB normal limit and its worktree is in use: a tool process has its cwd in .*wt-bloated;/);

	const primary = runSweep({ almd: false, memory: levelCritical, nextServer: idle5((home) => join(home, "Labs/project")) });
	assert.equal(primary.killLog, "");
	assert.match(primary.cleanupLog, /its worktree is in use: primary checkout;/);

	for (const [ageHours, verdict] of [[0, "active"], [2, "recent"]]) {
		const codex = runSweep({
			almd: false,
			memory: levelCritical,
			nextServer: idle5((home) => join(home, ".codex/worktrees/89b2/project")),
			codexThreads: (home) => [{ cwd: join(home, ".codex/worktrees/89b2/project"), ageHours }],
		});
		assert.equal(codex.killLog, "", `Codex ${verdict}: kept`);
		assert.match(codex.cleanupLog, new RegExp(`its worktree is in use: Codex threads ${verdict}:`, "u"));
	}

	const codexIdle = runSweep({
		almd: false,
		memory: levelCritical,
		nextServer: idle5((home) => join(home, ".codex/worktrees/89b2/project")),
		codexThreads: (home) => [{ cwd: join(home, ".codex/worktrees/89b2/project"), ageHours: 13 }],
	});
	assert.equal(codexIdle.killLog.trim(), "7001", "Codex threads idle past the pressure threshold: restarted");
});

test("a server at or above the normal limit is restarted under pressure as before, live task or not", ZSH_TEST_OPTIONS, () => {
	const pressured = runSweep({
		almd: false,
		memory: PRESSURE,
		nextServer: (home) => ({ pid: 7001, gb: "9.2", cwd: join(home, "Labs/project"), cpuTimes: cpuOver30s(0) }),
	});
	assert.equal(pressured.result.status, 0, pressured.result.stderr);
	assert.match(pressured.cleanupLog, /killed bloated next-server pid 7001 .*; primary checkout .*Labs\/project; pressure mode\)/);
});

test("--pressure-check skips a run inside the cool-down unless swap grew, and logs nothing", ZSH_TEST_OPTIONS, () => {
	// Swap at 36 GB now; the last pressure run was 5 minutes ago at 34 GB.
	const skipped = runSweep({ almd: false, memory: PRESSURE, args: ["--pressure-check"], pressureState: (now) => `${now - 300} 34` });
	assert.equal(skipped.result.status, 0, skipped.result.stderr);
	assert.equal(skipped.cleanupLog, "");
	assert.match(skipped.pressureState, / 34$/u, "the state is left as it was");

	const grown = runSweep({ almd: false, memory: PRESSURE, args: ["--pressure-check"], pressureState: (now) => `${now - 300} 30` });
	assert.match(grown.cleanupLog, /run start/, "swap grew by 6 GB >= 4 GB: run");
	assert.match(grown.pressureState, / 36$/u);

	const cooled = runSweep({ almd: false, memory: PRESSURE, args: ["--pressure-check"], pressureState: (now) => `${now - 901} 36`, clockStart: 2_000_000_000 });
	assert.match(cooled.cleanupLog, /run start/, "past the 15-minute cool-down: run");
	assert.equal(cooled.pressureState, "2000000000 36");

	const scheduled = runSweep({ almd: false, memory: PRESSURE, pressureState: (now) => `${now - 60} 36` });
	assert.match(scheduled.cleanupLog, /run start/, "the scheduled full sweep is never skipped");
});

test("pressure mode stops a Codex stack idle for the shorter threshold", ZSH_TEST_OPTIONS, () => {
	const threads = (home) => [{ cwd: join(home, ".codex/worktrees/89b2/project"), ageHours: 13 }];
	const normal = runSweep({ almd: false, sessions: codexSession, codexThreads: threads });
	assert.equal(normal.stopLog, "");
	assert.match(normal.cleanupLog, /kept tmux session vpk-dev-codex on vpk-dev socket \(Codex threads recent: newest Codex thread is younger than 24h\)/);

	const pressured = runSweep({ almd: false, memory: PRESSURE, sessions: codexSession, codexThreads: threads });
	assert.match(pressured.stopLog, /stop session=vpk-dev-codex/);
	assert.match(pressured.cleanupLog, /stopped idle tmux session vpk-dev-codex .*Codex threads idle: every Codex thread is at least 6h old/);
});

test("--pressure-check exits quietly without pressure and runs the sweep under it", ZSH_TEST_OPTIONS, () => {
	const calm = runSweep({ almd: false, args: ["--pressure-check"] });
	assert.equal(calm.result.status, 0, calm.result.stderr);
	assert.equal(calm.cleanupLog, "");

	const pressured = runSweep({ almd: false, memory: PRESSURE, args: ["--pressure-check"] });
	assert.equal(pressured.result.status, 0, pressured.result.stderr);
	assert.match(pressured.cleanupLog, /run start/);
	assert.match(pressured.cleanupLog, /summary: pressure mode;/);
});

test("--print-mode reports the mode without running the sweep", ZSH_TEST_OPTIONS, () => {
	const calm = runSweep({ almd: false, args: ["--print-mode"] });
	assert.equal(calm.result.stdout.trim(), "normal|swap 1GB in use, memory-pressure level 1");
	assert.equal(calm.cleanupLog, "");

	const pressured = runSweep({ almd: false, memory: { swapUsed: "20.5G", level: "4" }, args: ["--print-mode"] });
	assert.equal(pressured.result.stdout.trim(), "pressure|swap 20GB in use >= 16GB, memory-pressure level 4 >= 4");
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
