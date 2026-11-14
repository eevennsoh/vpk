const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { cleanDevOutput, describeNextDir, measureNextDir } = require("./next-dev-output");

const SCRIPT = path.join(__dirname, "next-dev-output.js");

// A worktree with dev output, a dev cache and a production build, each holding `kib` KiB.
function fixture(t) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "next-dev-output-"));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	const file = (relative, kib) => {
		const target = path.join(root, ".next", relative);
		fs.mkdirSync(path.dirname(target), { recursive: true });
		fs.writeFileSync(target, Buffer.alloc(kib * 1024, 1));
	};
	file("dev/static/chunks/app.js", 256);
	file("dev/static/media/font.woff2", 16);
	file("dev/server/app/page.js", 64);
	file("dev/cache/turbopack/v16/00001.sst", 512);
	file("cache/turbopack/v16/00001.sst", 128);
	file("server/app/index.html", 32);
	return root;
}

test("sizes split .next into dev output, dev cache, build cache and build output", (t) => {
	const root = fixture(t);
	const sizes = measureNextDir(root);
	const kib = (bytes) => Math.round(bytes / 1024);
	// du counts allocated blocks, so each part is at least its file size.
	assert.ok(kib(sizes.devOutputBytes) >= 336, JSON.stringify(sizes));
	assert.ok(kib(sizes.devCacheBytes) >= 512);
	assert.ok(kib(sizes.buildCacheBytes) >= 128);
	assert.ok(kib(sizes.buildOutputBytes) >= 32);
	assert.ok(sizes.totalBytes >= sizes.devOutputBytes + sizes.devCacheBytes + sizes.buildCacheBytes + sizes.buildOutputBytes);
	assert.equal(measureNextDir(path.join(root, "missing")), null);
	assert.equal(describeNextDir(null), "no .next");
});

test("cleaning removes the dev output and keeps the dev cache and the build", (t) => {
	const root = fixture(t);
	const result = cleanDevOutput(root);
	assert.deepEqual(result.removed, ["dev/static", "dev/server"]);
	assert.ok(result.freedBytes >= 336 * 1024);
	assert.equal(fs.existsSync(path.join(root, ".next/dev/static")), false);
	assert.equal(fs.existsSync(path.join(root, ".next/dev/server")), false);
	for (const kept of ["dev/cache/turbopack/v16/00001.sst", "cache/turbopack/v16/00001.sst", "server/app/index.html"]) {
		assert.ok(fs.existsSync(path.join(root, ".next", kept)), kept);
	}
	assert.deepEqual(cleanDevOutput(root).removed, []);
});

test("the clean command refuses while the stack runs, and cleans once it is stopped", (t) => {
	const root = fixture(t);
	const bin = fs.mkdtempSync(path.join(os.tmpdir(), "next-dev-output-bin-"));
	t.after(() => fs.rmSync(bin, { recursive: true, force: true }));
	const tmux = path.join(bin, "tmux");
	fs.writeFileSync(tmux, '#!/bin/sh\n[ "$FAKE_SESSION" = 1 ] && [ "$3" = "has-session" ] && exit 0\nexit 1\n');
	fs.chmodSync(tmux, 0o755);
	const clean = (session) =>
		spawnSync(process.execPath, [SCRIPT, "clean", "--worktree", root, "--socket", "vpk-dev", "--session", "vpk-dev-x"], {
			encoding: "utf8",
			env: { ...process.env, VPK_TMUX_BIN: tmux, FAKE_SESSION: session },
		});

	const running = clean("1");
	assert.equal(running.status, 1);
	assert.match(running.stderr, /Not removing the dev output: the stack is degraded/);
	assert.ok(fs.existsSync(path.join(root, ".next/dev/static")));

	const stopped = clean("0");
	assert.equal(stopped.status, 0, stopped.stderr);
	assert.match(stopped.stdout, /Removed \.next\/dev\/static and \.next\/dev\/server \(\d+\.\d GiB\); kept \.next\/dev\/cache\./);
	assert.equal(fs.existsSync(path.join(root, ".next/dev/static")), false);
	assert.ok(fs.existsSync(path.join(root, ".next/dev/cache/turbopack/v16/00001.sst")));
});

function cleanCli(root, env) {
	return spawnSync(process.execPath, [SCRIPT, "clean", "--worktree", root, "--socket", "vpk-dev", "--session", "vpk-dev-x"], { encoding: "utf8", env });
}

function noSessionTmux(t) {
	const bin = fs.mkdtempSync(path.join(os.tmpdir(), "next-dev-output-nosession-"));
	t.after(() => fs.rmSync(bin, { recursive: true, force: true }));
	fs.writeFileSync(path.join(bin, "tmux"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
	return bin;
}

test("clean refuses while next dev holds its lock, even with no session, no record and no lsof", (t) => {
	const root = fixture(t);
	const bin = noSessionTmux(t);
	// A foreground \`pnpm run dev\`: Next's lock names a live pid (this test process stands in for it).
	fs.writeFileSync(path.join(root, ".next/dev/lock"), JSON.stringify({ pid: process.pid, port: 4999 }));
	// PATH holds only the fake tmux and node: no lsof, no ps.
	fs.symlinkSync(process.execPath, path.join(bin, "node"));
	const held = cleanCli(root, { ...process.env, PATH: bin, VPK_TMUX_BIN: path.join(bin, "tmux") });
	assert.equal(held.status, 1);
	assert.match(held.stderr, new RegExp(`next dev \\(pid ${process.pid}\\) holds its dev lock`));
	assert.ok(fs.existsSync(path.join(root, ".next/dev/static")), "nothing was removed");

	// A lock left by a server that has exited does not block.
	fs.writeFileSync(path.join(root, ".next/dev/lock"), JSON.stringify({ pid: 2 ** 22 + 9, port: 4999 }));
	const stale = cleanCli(root, { ...process.env, VPK_TMUX_BIN: path.join(bin, "tmux") });
	assert.equal(stale.status, 0, stale.stderr);
	assert.equal(fs.existsSync(path.join(root, ".next/dev/static")), false);
});

test("clean refuses when a recorded process cannot be confirmed gone", (t) => {
	const root = fixture(t);
	const bin = noSessionTmux(t);
	// Recorded without an identity (it cannot be verified), on a live pid.
	fs.writeFileSync(path.join(root, ".dev-stack.json"), JSON.stringify({ version: 1, worktree: fs.realpathSync(root), session: null, phase: "stopped", phaseAt: new Date().toISOString(), services: { frontend: { port: 4998, pid: process.pid, childPid: null } } }));
	const result = cleanCli(root, { ...process.env, VPK_TMUX_BIN: path.join(bin, "tmux") });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /frontend has a recorded process that cannot be confirmed gone/);
	assert.ok(fs.existsSync(path.join(root, ".next/dev/static")));
});

test("sizes come from one du pass over .next", (t) => {
	const root = fixture(t);
	const calls = [];
	const { spawnSync: realSpawnSync } = require("node:child_process");
	const sizes = measureNextDir(root, {
		tree: (nextDir) => {
			calls.push(nextDir);
			const { duTree } = require("./next-dev-output");
			return duTree(nextDir, { spawnSyncImpl: realSpawnSync });
		},
	});
	assert.equal(calls.length, 1);
	assert.ok(sizes.devOutputBytes > 0 && sizes.devCacheBytes > 0 && sizes.buildCacheBytes > 0);
});
