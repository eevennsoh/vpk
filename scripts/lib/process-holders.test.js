"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { findFileHolders, listProcessCwds, parseLsofFields, processesUnder } = require("./process-holders");

const darwin = { platform: "darwin" };

test("lsof field output parses into processes with their names", () => {
	assert.deepEqual(parseLsofFields("p12\ncnode\nfcwd\nn/repo/a\np13\ncgit\nn/repo/b\n"), [
		{ pid: 12, command: "node", names: ["/repo/a"] },
		{ pid: 13, command: "git", names: ["/repo/b"] },
	]);
});

test("an lsof that cannot run, or reports an error, is unknown (null), never 'no process'", async () => {
	const refused = async () => ({ code: null, stdout: "", stderr: "spawn EPERM" });
	const failed = async () => ({ code: 1, stdout: "", stderr: "lsof: status error on /x: Operation not permitted" });
	assert.equal(await listProcessCwds({ ...darwin, lsof: refused }), null);
	assert.equal(await findFileHolders(["/x"], { ...darwin, lsof: failed }), null);
	assert.equal(processesUnder(null, "/repo"), null);
});

test("lsof's exit 1 with output (some files unheld) still reports the holders it found", async () => {
	const partial = async () => ({ code: 1, stdout: "p7\ncgit\nf4\nn/repo/.git/b.lock\n", stderr: "" });
	const holders = await findFileHolders(["/repo/.git/a.lock", "/repo/.git/b.lock"], { ...darwin, lsof: partial });
	assert.deepEqual(Object.fromEntries(holders), { "/repo/.git/a.lock": [], "/repo/.git/b.lock": [{ pid: 7, command: "git" }] });
});

test("processesUnder matches the directory and its descendants only", () => {
	const cwds = [
		{ pid: 1, command: "zsh", cwd: "/repo/wt" },
		{ pid: 2, command: "node", cwd: "/repo/wt/backend" },
		{ pid: 3, command: "node", cwd: "/repo/wt-other" },
		{ pid: 4, command: "node", cwd: "/repo" },
	];
	assert.deepEqual(processesUnder(cwds, "/repo/wt").map(({ pid }) => pid), [1, 2]);
	assert.deepEqual(processesUnder(cwds, "/repo/wt", { exclude: [1] }).map(({ pid }) => pid), [2]);
});

// A fake /proc: pid 10 is ours and holds the lock; pid 1 belongs to root.
function fakeProc({ rootReadable }) {
	const denied = () => Object.assign(new Error("EACCES"), { code: "EACCES" });
	const gone = () => Object.assign(new Error("ENOENT"), { code: "ENOENT" });
	return {
		readdirSync(dir) {
			if (dir === "/proc") return ["1", "10", "20"];
			if (dir === "/proc/10/fd") return ["3"];
			if (dir === "/proc/1/fd") {
				if (!rootReadable) throw denied();
				return [];
			}
			throw gone(); // pid 20 exited
		},
		readFileSync(file) {
			if (file === "/proc/20/comm") throw gone();
			return file === "/proc/1/comm" ? "systemd\n" : "git\n";
		},
		readlinkSync(file) {
			if (file === "/proc/10/fd/3") return "/repo/.git/index.lock";
			if (file === "/proc/10/cwd") return "/repo";
			if (file === "/proc/1/cwd") {
				if (!rootReadable) throw denied();
				return "/";
			}
			throw gone();
		},
	};
}

test("on Linux, a process whose descriptors or cwd cannot be read makes the reading unknown; one that exited does not", async () => {
	const linux = { platform: "linux" };
	const readable = await findFileHolders(["/repo/.git/index.lock"], { ...linux, fsImpl: fakeProc({ rootReadable: true }) });
	assert.deepEqual(Object.fromEntries(readable), { "/repo/.git/index.lock": [{ pid: 10, command: "git" }] });
	assert.equal(await findFileHolders(["/repo/.git/index.lock"], { ...linux, fsImpl: fakeProc({ rootReadable: false }) }), null);
	assert.deepEqual(await listProcessCwds({ ...linux, fsImpl: fakeProc({ rootReadable: true }) }), [
		{ pid: 1, command: "systemd", cwd: "/" },
		{ pid: 10, command: "git", cwd: "/repo" },
	]);
	assert.equal(await listProcessCwds({ ...linux, fsImpl: fakeProc({ rootReadable: false }) }), null);
});
