const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");
const { test } = require("node:test");
const { subscribeProcessSignals } = require("./rovo-supervisor");

// Substitute local OS dependencies at the implementation's require seam. Tests
// invoke the same complete launch operation as both CLI entry points.
function harness({ recorded, lock = false, occupied = [], healthy = true, owned = false } = {}) {
	const files = new Map(Object.entries(recorded ?? {}).map(([name, value]) => [`/worktree/${name}`, value]));
	if (lock) files.set("/worktree/.next/dev/lock", "locked");
	const busyPorts = new Set(occupied);
	const children = [];
	const spawns = [];
	const probes = [];
	const exits = [];
	const killed = [];
	const logs = [];
	const signalTarget = new EventEmitter();
	Object.assign(signalTarget, {
		env: { PORT_SEARCH_MAX: "4", VPK_TMUX_OWNED: owned ? "1" : "0" },
		cwd: () => "/worktree", execPath: "/node", pid: 100,
		exit: (code) => exits.push(code),
		kill: (pid, signal) => killed.push({ pid, signal }),
		stderr: { write: () => {} },
	});
	const dependencies = {
		"node:fs": {
			existsSync: (file) => files.has(file),
			readFileSync: (file) => { if (!files.has(file)) throw new Error("ENOENT"); return files.get(file); },
			writeFileSync: (file, value) => files.set(file, value),
			unlinkSync: (file) => { if (!files.delete(file)) throw new Error("ENOENT"); },
		},
		"node:path": path,
		"node:child_process": { spawn: (bin, args, options) => {
			spawns.push({ bin, args, options });
			const child = new EventEmitter();
			child.stderr = new EventEmitter();
			child.kill = (signal) => killed.push({ child: children.indexOf(child), signal });
			children.push(child);
			return child;
		} },
		"node:http": { request: (_options, respond) => {
			const request = new EventEmitter();
			request.destroy = () => request.emit("error", new Error("closed"));
			request.end = () => queueMicrotask(() => {
				const response = new EventEmitter();
				response.statusCode = healthy ? 200 : 503;
				response.setEncoding = () => {};
				response.resume = () => {};
				respond(response);
				response.emit("data", JSON.stringify({ status: healthy ? "OK" : "FAIL" }));
				response.emit("end");
			});
			return request;
		} },
		"./next-dev-env": {
			getNextDevHostname: () => "localhost",
			getNextDevEnv: ({ port, backendPort }) => ({ PORT: String(port), NEXT_PUBLIC_BACKEND_PORT: backendPort }),
		},
		"./worktree-ports": { getFrontendBasePort: () => 4000, getBackendBasePort: () => 8000 },
		"./rovo-utils": { isPortAvailable: async (port, options) => { probes.push({ port, ...options }); return !busyPorts.has(port); } },
		"./rovo-supervisor": { subscribeProcessSignals },
	};
	const requireDependency = (name) => {
		assert.equal(name in dependencies, true, `Unexpected dependency ${name}`);
		return dependencies[name];
	};
	requireDependency.resolve = () => "/next/bin/next";
	const loadedModule = { exports: {} };
	vm.runInNewContext(fs.readFileSync(path.join(__dirname, "dev-service-launcher.js"), "utf8"), {
		module: loadedModule, require: requireDependency, process: signalTarget,
		console: Object.fromEntries(["log", "warn", "error"].map((level) => [level, (...values) => logs.push({ level, message: values.join(" ") })])),
	});
	return { launch: loadedModule.exports.launchDevService, files, busyPorts, children, spawns, probes, exits, killed, logs, signalTarget };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

for (const service of ["frontend", "backend"]) {
	test(`${service} launch selects a free worktree port, forwards signals, and cleans up`, async () => {
		const base = service === "frontend" ? 4000 : 8000;
		const h = harness({ occupied: [base], recorded: { ".dev-backend-port": "8002" } });
		await h.launch(service);
		assert.equal(h.files.get(`/worktree/.dev-${service}-port`), String(base + 1));
		assert.equal(h.spawns.length, 1);
		assert.equal(h.spawns[0].options.env.PORT, String(base + 1));
		if (service === "frontend") assert.equal(h.spawns[0].options.env.NEXT_PUBLIC_BACKEND_PORT, "8002");
		assert.equal(h.probes.every((probe) => probe.includeLoopback === (service === "frontend")), true);
		h.signalTarget.emit("SIGHUP");
		assert.equal(h.killed[0].signal, "SIGHUP");
		h.children[0].emit("exit", null, "SIGHUP");
		await settle();
		assert.equal(h.files.has(`/worktree/.dev-${service}-port`), false);
		assert.equal(h.signalTarget.listenerCount("SIGHUP"), 0);
		assert.deepEqual(h.killed.at(-1), { pid: 100, signal: "SIGHUP" });
	});

	test(`${service} spawn errors clean records and every signal listener`, async () => {
		const h = harness();
		await h.launch(service);
		h.children[0].emit("error", new Error("spawn failed"));
		assert.equal(h.files.has(`/worktree/.dev-${service}-port`), false);
		assert.deepEqual(h.exits, [1]);
		for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) assert.equal(h.signalTarget.listenerCount(signal), 0);
	});

	test(`${service} exit codes propagate after cleanup`, async () => {
		const h = harness();
		await h.launch(service);
		h.children[0].emit("exit", 7, null);
		await settle();
		assert.deepEqual(h.exits, [7]);
		assert.equal(h.files.has(`/worktree/.dev-${service}-port`), false);
	});
}

test("backend reuses only a healthy recorded server and rejects reuse for session ownership", async () => {
	const options = { recorded: { ".dev-backend-port": "8001" }, occupied: [8001] };
	const reused = harness(options);
	await reused.launch("backend");
	assert.equal(reused.spawns.length, 0);
	assert.equal(reused.files.get("/worktree/.dev-backend-port"), "8001");
	assert.equal(reused.logs.some((log) => log.message.includes("Reuse does not reload")), true);
	const owned = harness({ ...options, owned: true });
	await assert.rejects(owned.launch("backend"), /tmux-owned session/);
	assert.equal(owned.spawns.length, 0);
});

test("backend skips unhealthy listeners and ignores out-of-range records", async () => {
	for (const port of [8000, 9000]) {
		const h = harness({ recorded: { ".dev-backend-port": String(port) }, occupied: [8000], healthy: false });
		await h.launch("backend");
		assert.equal(h.files.get("/worktree/.dev-backend-port"), "8001");
		assert.equal(h.spawns.length, 1);
		assert.equal(h.probes.some((probe) => probe.port === 9000), false);
	}
});

test("frontend reuses a legitimate lock and refuses session-owned reuse", async () => {
	const options = { recorded: { ".dev-frontend-port": "4001" }, lock: true, occupied: [4001] };
	const reused = harness(options);
	await reused.launch("frontend");
	assert.equal(reused.spawns.length, 0);
	assert.equal(reused.files.get("/worktree/.dev-frontend-port"), "4001");
	const owned = harness({ ...options, owned: true });
	await assert.rejects(owned.launch("frontend"), /tmux-owned session/);
	assert.equal(owned.spawns.length, 0);
});

test("frontend removes only stale locks and starts within the worktree range", async () => {
	const h = harness({ recorded: { ".dev-frontend-port": "9000" }, lock: true });
	await h.launch("frontend");
	assert.equal(h.files.has("/worktree/.next/dev/lock"), false);
	assert.equal(h.files.get("/worktree/.dev-frontend-port"), "4000");
	assert.equal(h.probes.some((probe) => probe.port === 9000), false);
});

test("frontend retries address races without retaining old child signal listeners", async () => {
	const h = harness();
	await h.launch("frontend");
	h.children[0].stderr.emit("data", Buffer.from("EADDRINUSE"));
	h.children[0].emit("exit", 1, null);
	await settle();
	assert.equal(h.spawns.length, 2);
	assert.equal(h.files.get("/worktree/.dev-frontend-port"), "4001");
	for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) assert.equal(h.signalTarget.listenerCount(signal), 1);
	h.signalTarget.emit("SIGTERM");
	assert.deepEqual(h.killed, [{ child: 1, signal: "SIGTERM" }]);
});

test("frontend handles a lock acquired during spawn by locating the running server", async () => {
	for (const owned of [false, true]) {
		const h = harness({ owned });
		await h.launch("frontend");
		h.busyPorts.add(4000);
		h.children[0].stderr.emit("data", Buffer.from("Unable to acquire lock"));
		h.children[0].emit("exit", 1, null);
		await settle();
		assert.deepEqual(h.exits, [owned ? 1 : 0]);
		assert.equal(h.files.has("/worktree/.dev-frontend-port"), !owned);
		assert.equal(h.signalTarget.listenerCount("SIGHUP"), 0);
	}
});

test("port exhaustion fails without spawning or keeping stale records", async () => {
	const h = harness({ occupied: [8000, 8001, 8002, 8003] });
	await assert.rejects(h.launch("backend"), /8000 to 8003/);
	assert.equal(h.spawns.length, 0);
	assert.equal(h.files.has("/worktree/.dev-backend-port"), false);
});
