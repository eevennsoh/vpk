const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const { mkdtempSync, readdirSync, rmSync, writeFileSync } = require("node:fs");
const { createServer } = require("node:http");
const { tmpdir } = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { promisify } = require("node:util");

const { resolveAgentBrowserBin } = require("./lib/browser.js");

const exec = promisify(execFile);
const CONTROL = path.join(__dirname, "control-vpk");
const REPO_ROOT = path.resolve(__dirname, "../../../..");

function processExists(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		if (error.code === "ESRCH") return false;
		throw error;
	}
}

test("real Chrome lifecycle: headless defaults, release, restore, visible opt-in and chat isolation", { timeout: 180_000 }, async (t) => {
	const root = mkdtempSync(path.join(tmpdir(), "vpk-browser-lifecycle-"));
	const config = path.join(root, "agent-browser.json");
	const registry = path.join(root, "registry");
	writeFileSync(config, JSON.stringify({ headed: true }));
	const namespace = `vpk-lifecycle-${process.pid}`;
	const environments = ["primary", "other"].map((chat) => ({
		...process.env,
		AGENT_BROWSER_CONFIG: config,
		AGENT_BROWSER_HEADED: "true",
		AGENT_BROWSER_NAMESPACE: namespace,
		CODEX_THREAD_ID: `${namespace}-${chat}`,
		VPK_BROWSER_REGISTRY_DIR: registry,
	}));
	const control = async (args, env = environments[0]) => {
		const result = await exec(process.execPath, [CONTROL, ...args], { cwd: REPO_ROOT, env, timeout: 45_000 });
		return result.stdout.trim();
	};
	const sessions = await Promise.all(environments.map((env) => control(["session"], env)));
	const browser = async (index, args) => {
		const result = await exec(resolveAgentBrowserBin(), ["--session", sessions[index], ...args], {
			cwd: REPO_ROOT, env: environments[index], timeout: 45_000,
		});
		return result.stdout.trim();
	};
	const info = async (index = 0) => JSON.parse(await browser(index, ["session", "info", "--json"])).data;
	const records = () => {
		try { return readdirSync(registry).filter((name) => name.endsWith(".json")); }
		catch (error) { if (error.code === "ENOENT") return []; throw error; }
	};
	const chrome = async () => {
		const state = await info();
		assert.equal(state.runtime.browserLaunched, true);
		const { stdout } = await exec("ps", ["-axo", "pid=,ppid=,command="]);
		const children = stdout.split("\n").map((row) => /^\s*(\d+)\s+(\d+)\s+(.*)$/u.exec(row))
			.filter((row) => row && Number(row[2]) === state.pid && /chrom(?:e|ium)/iu.test(row[3]));
		assert.equal(children.length, 1, "the daemon must own one Chrome process");
		return { daemonPid: state.pid, browserPid: Number(children[0][1]), command: children[0][3] };
	};
	const assertReleased = async (processes) => {
		assert.equal((await info()).active, false);
		if (processes) {
			assert.equal(processExists(processes.daemonPid), false, "daemon must have exited");
			assert.equal(processExists(processes.browserPid), false, "Chrome must have exited");
		}
	};
	const server = createServer((_request, response) => response.end("VPK browser lifecycle fixture"));
	t.after(async () => {
		try {
			await Promise.all(environments.map((env) => control(["cleanup", "--browser"], env)));
		} finally {
			await new Promise((resolve) => server.close(resolve));
			rmSync(root, { recursive: true, force: true });
		}
	});
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const url = `http://127.0.0.1:${server.address().port}/lifecycle`;

	await t.test("parking a missing browser twice starts no browser or daemon", async () => {
		await control(["park"]);
		await control(["park"]);
		await assertReleased();
		assert.deepEqual(records(), []);
	});

	await t.test("routine verification stays headless despite headed config and environment", async () => {
		await control(["browser", "open", url]);
		assert.match((await chrome()).command, /--headless(?:\s|=)/u);
		assert.equal(await control(["browser", "get", "url"]), url);
		await control(["browser", "wait", "--text", "VPK browser lifecycle fixture"]);
		await control(["browser", "eval", "localStorage.setItem('vpk-lifecycle-proof', 'saved')"]);
		assert.match((await chrome()).command, /--headless(?:\s|=)/u);
	});

	await t.test("parking releases Chrome, preserves saved state and leaves another chat running", async () => {
		await control(["browser", "open", url], environments[1]);
		const processes = await chrome();
		await control(["park"]);
		await assertReleased(processes);
		assert.equal((await info(1)).runtime.browserLaunched, true);
		assert.equal(records().length, 1);
		await control(["browser", "open", url]);
		assert.match((await chrome()).command, /--headless(?:\s|=)/u);
		assert.equal(await control(["browser", "eval", "localStorage.getItem('vpk-lifecycle-proof')"]), '"saved"');
		await control(["park"]);
	});

	await t.test("explicit visible verification closes on park and never leaves a parked window", async () => {
		await control(["browser", "open", "--headed", url]);
		assert.equal(await control(["browser", "get", "url"]), url);
		const processes = await chrome();
		assert.doesNotMatch(processes.command, /--headless(?:\s|=)/u);
		await control(["park"]);
		await assertReleased(processes);
		await control(["park"]);
		await assertReleased();
		assert.equal((await info(1)).runtime.browserLaunched, true);
	});

	await t.test("finished verification leaves no test sessions or registry records", async () => {
		for (const env of environments) await control(["cleanup", "--browser"], env);
		assert.equal((await info()).active, false);
		assert.equal((await info(1)).active, false);
		assert.deepEqual(records(), []);
	});
});
