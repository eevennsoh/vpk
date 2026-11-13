// Starts a real agent-browser through control-vpk, ends the session that owns it, and checks that
// `control-vpk cleanup --orphaned-browsers` leaves no daemon or Chrome process behind. Every
// browser it touches lives in a namespace this test creates, and the registry is a temp dir.

const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { mkdtempSync, readdirSync, rmSync } = require("node:fs");
const { homedir, tmpdir } = require("node:os");
const { join } = require("node:path");
const test = require("node:test");

const { resolveAgentBrowserBin } = require("./lib/browser.js");
const { listBrowserRecords } = require("./lib/browser-registry.js");

const CONTROL_VPK = join(__dirname, "control-vpk");
const WAIT_LIMIT_MS = 20_000;

function agentBrowserBin() {
	try {
		return resolveAgentBrowserBin();
	} catch {
		return null;
	}
}

function alive(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

function childPids(pid) {
	const result = spawnSync("pgrep", ["-P", String(pid)], { encoding: "utf8" });
	return result.stdout.split("\n").map(Number).filter(Boolean);
}

function descendants(pid) {
	const found = [];
	for (const child of childPids(pid)) found.push(child, ...descendants(child));
	return found;
}

// Waits for a condition, bounded; never a fixed sleep.
async function waitFor(condition, label) {
	const deadline = Date.now() + WAIT_LIMIT_MS;
	while (!condition()) {
		if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
		await new Promise((resolve) => setImmediate(resolve));
	}
}

function skipReason() {
	if (agentBrowserBin() === null) return "needs agent-browser (pnpm install)";
	let browsers = [];
	try {
		browsers = readdirSync(join(homedir(), ".agent-browser/browsers"));
	} catch {
		// Not installed.
	}
	if (!browsers.some((name) => name.startsWith("chrome"))) return "needs agent-browser's Chrome (agent-browser install)";
	// Owner tracking and this test read the process table; agent sandboxes deny it.
	if (spawnSync("ps", ["-o", "pid=", "-p", String(process.pid)], { encoding: "utf8" }).status !== 0) return "needs ps (process inspection is blocked here)";
	return false;
}

const bin = agentBrowserBin();

test("cleanup closes a browser whose owner session ended and leaves no daemon or Chrome process", {
	skip: skipReason(),
	timeout: 120_000,
}, async (t) => {
	// Short: the daemon socket path under the namespace must stay within 103 bytes.
	const namespace = `vt-${randomUUID().slice(0, 6)}`;
	const registry = mkdtempSync(join(tmpdir(), "control-vpk-registry-"));
	const owner = spawn(process.execPath, ["-e", "setInterval(() => {}, 1 << 30)"], { stdio: "ignore" });
	const ownerExited = new Promise((resolve) => owner.once("exit", resolve));
	const env = {
		...process.env,
		AGENT_BROWSER_NAMESPACE: namespace,
		CLAUDE_CODE_SESSION_ID: `browser-cleanup-test-${randomUUID()}`,
		VPK_BROWSER_OWNER_PID: String(owner.pid),
		VPK_BROWSER_REGISTRY_DIR: registry,
	};
	delete env.CODEX_THREAD_ID;
	const browserPids = [];
	let session = "";
	t.after(() => {
		if (session) spawnSync(bin, ["--session", session, "close"], { env, stdio: "ignore", timeout: 15_000 });
		for (const pid of browserPids) if (alive(pid)) process.kill(pid, "SIGKILL");
		if (owner.exitCode === null && owner.signalCode === null) owner.kill("SIGKILL");
		rmSync(registry, { recursive: true, force: true });
		rmSync(join(homedir(), ".agent-browser/namespaces", namespace), { recursive: true, force: true });
	});
	const controlVpk = (...args) => spawnSync(process.execPath, [CONTROL_VPK, ...args], { encoding: "utf8", env, timeout: 60_000 });

	const opened = controlVpk("browser", "open", "data:text/html,%3Ctitle%3Ecleanup%20test%3C%2Ftitle%3E");
	assert.equal(opened.status, 0, opened.stderr);

	const [entry] = listBrowserRecords({ dir: registry });
	assert.ok(entry, "control-vpk recorded the browser it started");
	session = entry.record.session;
	assert.equal(entry.record.namespace, namespace);
	assert.equal(entry.record.owner.pid, owner.pid);

	const info = JSON.parse(spawnSync(bin, ["--session", session, "session", "info", "--json"], { encoding: "utf8", env }).stdout);
	const daemonPid = info.data.pid;
	assert.ok(alive(daemonPid), "the agent-browser daemon is running");
	browserPids.push(daemonPid, ...descendants(daemonPid));
	assert.ok(browserPids.length > 1, "Chrome runs under the daemon");

	const kept = controlVpk("cleanup", "--orphaned-browsers");
	assert.equal(kept.status, 0, kept.stderr);
	assert.match(kept.stdout, /kept browser .* is alive/u);
	assert.ok(alive(daemonPid), "a browser with a live owner is left running");

	owner.kill("SIGTERM");
	await ownerExited;

	const cleaned = controlVpk("cleanup", "--orphaned-browsers");
	assert.equal(cleaned.status, 0, cleaned.stderr);
	assert.match(cleaned.stdout, /closed browser .* is gone/u);
	await waitFor(() => browserPids.every((pid) => !alive(pid)), "the daemon and Chrome to exit");
	assert.deepEqual(listBrowserRecords({ dir: registry }), []);
	session = "";
});
