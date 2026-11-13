const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const test = require("node:test");

const { UNIT_BATCH_MARKER_ENV, findMarkedProcesses, groupAlive, killGroup, spawnInGroup } = require("./test-process.js");

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
