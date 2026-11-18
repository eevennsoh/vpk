const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");
const { test } = require("node:test");
const { subscribeProcessSignals } = require("./rovo-supervisor");

// Substitute local OS dependencies at the implementation's require seam. Tests
// invoke the same complete launch operation as both CLI entry points.
// loopbackOccupied: ports held on 127.0.0.1 only (a dev backend). On macOS, 0.0.0.0 and :: still
// bind then, so only a probe that includes loopback sees them. claimed: port -> another worktree
// whose port files record it. foreignListeners: ports whose listener runs in another worktree.
function harness({ recorded, lock = false, occupied = [], loopbackOccupied = [], claimed = {}, foreignListeners = [], healthy = true, owned = false, failRecord = false, portless = false } = {}) {
	const files = new Map(Object.entries(recorded ?? {}).map(([name, value]) => [`/worktree/${name}`, value]));
	if (lock) files.set("/worktree/.next/dev/lock", "locked");
	const busyPorts = new Set(occupied);
	const loopbackPorts = new Set(loopbackOccupied);
	const children = [];
	const spawns = [];
	const probes = [];
	const exits = [];
	const killed = [];
	const logs = [];
	// The stack record, reduced to what the launcher writes: each entry and its port-file mirror.
	const stackRecords = [];
	const signalTarget = new EventEmitter();
	Object.assign(signalTarget, {
		env: { PORT_SEARCH_MAX: "4", VPK_TMUX_OWNED: owned ? "1" : "0", ...(portless ? { PORT: "4000", PORTLESS_URL: "https://fixture.localhost" } : {}) },
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
			child.pid = 500 + children.length;
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
		"./worktree-ports": {
			findAvailableWorktreePort: require("./worktree-ports").findAvailableWorktreePort,
			getFrontendBasePort: () => 4000,
			getBackendBasePort: () => 8000,
			getPortsClaimedByOtherWorktrees: () => new Map(Object.entries(claimed).map(([port, worktree]) => [Number(port), worktree])),
		},
		"./rovo-utils": { isPortAvailable: async (port, options = {}) => {
			probes.push({ port, ...options });
			if (busyPorts.has(port)) return false;
			return !(loopbackPorts.has(port) && options.includeLoopback !== false);
		} },
		"./rovo-supervisor": { subscribeProcessSignals },
		"./dev-stack-state": {
			readProcessIdentity: (pid) => ({ state: "alive", start: `start-${pid}`, command: `command-${pid}` }),
			listenerInWorktree: (port) => (foreignListeners.includes(port) ? false : true),
			recordService: (cwd, service, entry) => {
				if (failRecord) throw new Error("lock timed out");
				stackRecords.push({ service, ...entry });
				files.set(path.join(cwd, `.dev-${service}-port`), String(entry.port));
			},
			clearService: (cwd, service, options = {}) => {
				stackRecords.push({ service, cleared: true, ...(options.exit ? { exit: { ...options.exit } } : {}) });
				files.delete(path.join(cwd, `.dev-${service}-port`));
			},
		},
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
	return { launch: loadedModule.exports.launchDevService, files, stackRecords, busyPorts, children, spawns, probes, exits, killed, logs, signalTarget };
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
		// The stack record names the launcher and the server it spawned.
		assert.deepEqual(h.stackRecords.at(-1), { service, port: base + 1, pid: 100, pidStart: "start-100", pidCommand: "command-100", childPid: 500, childStart: "start-500", childCommand: "command-500" });
		assert.equal(h.probes.every((probe) => probe.includeLoopback !== false), true, "every probe includes loopback");
		h.signalTarget.emit("SIGHUP");
		assert.equal(h.killed[0].signal, "SIGHUP");
		h.children[0].emit("exit", null, "SIGHUP");
		await settle();
		assert.equal(h.files.has(`/worktree/.dev-${service}-port`), false);
		assert.equal(h.signalTarget.listenerCount("SIGHUP"), 0);
		assert.deepEqual(h.killed.at(-1), { pid: 100, signal: "SIGHUP" });
		assert.deepEqual(h.stackRecords.at(-1), { service, cleared: true, exit: { signal: "SIGHUP" } });
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
		assert.deepEqual(h.stackRecords.at(-1), { service, cleared: true, exit: { code: 7 } }, "the record keeps how the launcher left");
		assert.equal(h.files.has(`/worktree/.dev-${service}-port`), false);
	});
}

test("backend reuses only a healthy recorded server and rejects reuse for session ownership", async () => {
	const options = { recorded: { ".dev-backend-port": "8001" }, occupied: [8001] };
	const reused = harness(options);
	await reused.launch("backend");
	assert.equal(reused.spawns.length, 0);
	assert.equal(reused.files.get("/worktree/.dev-backend-port"), "8001");
	// A server this launcher did not start is recorded by port only, so a stop never signals it by pid.
	assert.deepEqual(reused.stackRecords.at(-1), { service: "backend", port: 8001, pid: null, pidStart: null, pidCommand: null, childPid: null, childStart: null, childCommand: null });
	assert.equal(reused.logs.some((log) => log.message.includes("Reuse does not reload")), true);
	const owned = harness({ ...options, owned: true });
	await assert.rejects(owned.launch("backend"), /tmux-owned session/);
	assert.equal(owned.spawns.length, 0);
});

// Regression: the backend probed 0.0.0.0 and :: only. Another worktree's backend holds
// 127.0.0.1:<port> (the dev backend binds loopback), so the port looked free, the new stack
// recorded it, and its frontend talked to the other worktree's backend.
test("backend skips a port another worktree's backend holds on loopback only", async () => {
	const h = harness({ loopbackOccupied: [8000] });
	await h.launch("backend");
	assert.equal(h.files.get("/worktree/.dev-backend-port"), "8001");
	assert.equal(h.spawns[0].options.env.PORT, "8001");
});

for (const service of ["frontend", "backend"]) {
	test(`${service} skips ports another worktree's stack has recorded, even before they listen`, async () => {
		const base = service === "frontend" ? 4000 : 8000;
		const h = harness({ claimed: { [base]: "/other-worktree", [base + 1]: "/other-worktree" } });
		await h.launch(service);
		assert.equal(h.files.get(`/worktree/.dev-${service}-port`), String(base + 2), "the first port neither listening nor recorded elsewhere");
		assert.equal(h.probes.some((probe) => probe.port === base || probe.port === base + 1), false);
		assert.equal(h.logs.some((log) => log.message.includes(`Port ${base} is recorded by another worktree's stack (/other-worktree)`)), true);
	});
}

test("backend never reuses a healthy server whose listener runs in another worktree", async () => {
	const h = harness({ recorded: { ".dev-backend-port": "8001" }, occupied: [8001], foreignListeners: [8001] });
	await h.launch("backend");
	assert.equal(h.spawns.length, 1, "started its own backend");
	assert.equal(h.files.get("/worktree/.dev-backend-port"), "8000");
});

test("frontend refuses a claimed Portless port instead of silently breaking its route", async () => {
	const h = harness({ portless: true, claimed: { 4000: "/other-worktree" } });
	await assert.rejects(h.launch("frontend"), /No available port/);
	assert.equal(h.spawns.length, 0);
	assert.equal(h.files.has("/worktree/.dev-frontend-port"), false);
});

test("frontend keeps the Portless port on an address race instead of retrying elsewhere", async () => {
	const h = harness({ portless: true });
	await h.launch("frontend");
	assert.equal(h.files.get("/worktree/.dev-frontend-port"), "4000");
	h.children[0].stderr.emit("data", Buffer.from("EADDRINUSE"));
	h.children[0].emit("exit", 1, null);
	await settle();
	assert.equal(h.spawns.length, 1);
	assert.deepEqual(h.exits, [1]);
	assert.equal(h.files.has("/worktree/.dev-frontend-port"), false);
});

test("frontend does not reuse a lock on a different port from its Portless route", async () => {
	const h = harness({ portless: true, recorded: { ".dev-frontend-port": "4001" }, lock: true, occupied: [4001] });
	await h.launch("frontend");
	assert.equal(h.files.get("/worktree/.dev-frontend-port"), "4000");
	assert.equal(h.spawns[0].options.env.PORT, "4000");
	h.children[0].stderr.emit("data", Buffer.from("Unable to acquire lock"));
	h.children[0].emit("exit", 1, null);
	await settle();
	assert.deepEqual(h.exits, [1]);
	assert.equal(h.files.has("/worktree/.dev-frontend-port"), false);
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
		if (!owned) {
			// The failed attempt's own entry is dropped before the reused server is recorded.
			assert.deepEqual(h.stackRecords.slice(-2), [
				{ service: "frontend", cleared: true },
				{ service: "frontend", port: 4000, pid: null, pidStart: null, pidCommand: null, childPid: null, childStart: null, childCommand: null },
			]);
		}
		assert.equal(h.signalTarget.listenerCount("SIGHUP"), 0);
	}
});

test("port exhaustion fails without spawning or keeping stale records", async () => {
	const h = harness({ occupied: [8000, 8001, 8002, 8003] });
	await assert.rejects(h.launch("backend"), /8000 to 8003/);
	assert.equal(h.spawns.length, 0);
	assert.equal(h.files.has("/worktree/.dev-backend-port"), false);
});

for (const service of ["frontend", "backend"]) {
	test(`${service} keeps running with a port file when the stack record cannot be written`, async () => {
		const base = service === "frontend" ? 4000 : 8000;
		const h = harness({ failRecord: true });
		await h.launch(service);
		assert.equal(h.spawns.length, 1, "the server was started");
		assert.equal(h.exits.length, 0, "the launcher did not exit and leave its server behind");
		assert.equal(h.files.get(`/worktree/.dev-${service}-port`), String(base));
		assert.equal(h.logs.some((log) => log.level === "warn" && log.message.includes("Could not record the dev stack state")), true);
	});
}
