const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const test = require("node:test");

const { UNIT_BATCH_MARKER_ENV, findMarkedProcesses, groupAlive, groupMemberStates, isGroupTracked, killGroup, spawnInGroup } = require("./test-process.js");

const processTableReadable = findMarkedProcesses("probe") !== null;

function pidsWithTag(tag) {
	return spawnSync("pgrep", ["-f", tag], { encoding: "utf8" }).stdout.split("\n").filter(Boolean);
}

test("spawnInGroup kills the child and its grandchildren on cleanup", { skip: processTableReadable ? false : "needs pgrep" }, async (t) => {
	const tag = `group-test-${randomUUID()}`;
	// The child starts a grandchild in the same group, prints its pid, and stays alive.
	const script = `const { spawn } = require("node:child_process");
const g = spawn(process.execPath, ["-e", "setInterval(() => {}, 1 << 30)", ${JSON.stringify(tag)}], { stdio: "ignore" });
process.stdout.write(String(g.pid) + "\\n");
setInterval(() => {}, 1 << 30);`;
	const child = spawnInGroup(process.execPath, ["-e", script, tag], { stdio: ["ignore", "pipe", "ignore"] }, { t });
	const grandchild = await new Promise((resolve) => child.stdout.once("data", (chunk) => resolve(Number(String(chunk).trim()))));
	assert.equal(pidsWithTag(tag).length, 2);
	assert.ok(groupAlive(child.pid));

	await killGroup(child);
	assert.equal(groupAlive(child.pid), false);
	assert.equal(pidsWithTag(tag).length, 0);
	assert.throws(() => process.kill(grandchild, 0), { code: "ESRCH" });
});

test("findMarkedProcesses finds a process by the batch marker in its environment, even detached", { skip: processTableReadable ? false : "needs a readable process table" }, async (t) => {
	const marker = randomUUID();
	const child = spawnInGroup(process.execPath, ["-e", "setInterval(() => {}, 1 << 30)", `marked-${marker}`], {
		env: { ...process.env, [UNIT_BATCH_MARKER_ENV]: marker },
		stdio: "ignore",
	}, { t });
	const found = findMarkedProcesses(marker);
	assert.deepEqual(found.map((row) => row.pid), [child.pid]);
	assert.match(found[0].command, new RegExp(`marked-${marker}`, "u"));
	assert.deepEqual(findMarkedProcesses(randomUUID()), []);
	await killGroup(child);
	assert.deepEqual(findMarkedProcesses(marker), []);
});

test("a group whose only members are zombies counts as gone", () => {
	// Under a PID 1 that does not reap orphans, a killed grandchild stays a zombie in the group
	// forever and kill(-pgid, 0) keeps succeeding.
	const signalable = () => true;
	assert.equal(groupAlive(42, { signalable, states: () => ["Z"] }), false);
	assert.equal(groupAlive(42, { signalable, states: () => ["Z+", "Z"] }), false);
	assert.equal(groupAlive(42, { signalable, states: () => ["S", "Z"] }), true);
	assert.equal(groupAlive(42, { signalable, states: () => [] }), false);
	assert.equal(groupAlive(42, { signalable, states: () => null }), true, "an unreadable table falls back to the signal");
	assert.equal(groupAlive(42, { signalable: () => false, states: () => ["S"] }), false);
});

test("groupMemberStates reads this process's own group", { skip: processTableReadable ? false : "needs a readable process table" }, () => {
	const pgid = Number(spawnSync("ps", ["-o", "pgid=", "-p", String(process.pid)], { encoding: "utf8" }).stdout.trim());
	const states = groupMemberStates(pgid);
	assert.ok(states.length >= 1);
	assert.ok(states.some((state) => !state.startsWith("Z")));
});

test("a group that ended on its own is forgotten and never signalled again", async () => {
	const child = spawnInGroup(process.execPath, ["-e", "0"], { stdio: "ignore" });
	assert.equal(isGroupTracked(child.pid), true);
	await new Promise((resolve) => child.once("exit", resolve));
	// The exit listener spawnInGroup registered ran first: the group is no longer live.
	assert.equal(isGroupTracked(child.pid), false);
	const signals = [];
	await killGroup(child, { kill: (pgid, signal) => signals.push(`${signal} ${pgid}`) });
	assert.deepEqual(signals, [], "no signal to a group id that may now belong to someone else");
});

test("a group whose leader exited but whose member lives is still killed on cleanup", { skip: processTableReadable ? false : "needs a readable process table" }, async () => {
	const tag = `orphan-member-${randomUUID()}`;
	// The leader starts a member in its group and exits at once.
	const leader = spawnInGroup(process.execPath, ["-e", `require("node:child_process").spawn(process.execPath, ["-e", "setInterval(() => {}, 1 << 30)", ${JSON.stringify(tag)}], { stdio: "ignore" }).unref()`], { stdio: "ignore" });
	await new Promise((resolve) => leader.once("exit", resolve));
	assert.equal(isGroupTracked(leader.pid), true, "the id is still held by the member");
	assert.equal(pidsWithTag(tag).length, 1);
	await killGroup(leader);
	assert.equal(pidsWithTag(tag).length, 0);
	assert.equal(isGroupTracked(leader.pid), false);
});
