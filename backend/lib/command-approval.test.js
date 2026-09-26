const assert = require("node:assert/strict");
const test = require("node:test");

const {
	isDangerousCommand,
	classifyCommand,
} = require("./command-approval");

test("detects rm -rf", () => {
	assert.equal(isDangerousCommand("rm -rf /tmp/stuff"), true);
});

test("detects rm -r", () => {
	assert.equal(isDangerousCommand("rm -r /some/dir"), true);
});

test("detects rm --recursive", () => {
	assert.equal(isDangerousCommand("rm --recursive /dir"), true);
});

test("detects sudo", () => {
	assert.equal(isDangerousCommand("sudo apt install nginx"), true);
});

test("detects DROP TABLE", () => {
	assert.equal(isDangerousCommand("DROP TABLE users;"), true);
});

test("detects DROP DATABASE", () => {
	assert.equal(isDangerousCommand("DROP DATABASE production;"), true);
});

test("detects TRUNCATE", () => {
	assert.equal(isDangerousCommand("TRUNCATE TABLE logs;"), true);
});

test("detects kill -9", () => {
	assert.equal(isDangerousCommand("kill -9 12345"), true);
});

test("detects chmod 777", () => {
	assert.equal(isDangerousCommand("chmod 777 /var/www"), true);
});

test("detects git push --force", () => {
	assert.equal(isDangerousCommand("git push origin main --force"), true);
});

test("detects git reset --hard", () => {
	assert.equal(isDangerousCommand("git reset --hard HEAD~5"), true);
});

test("allows ls -la", () => {
	assert.equal(isDangerousCommand("ls -la"), false);
});

test("allows cat", () => {
	assert.equal(isDangerousCommand("cat /etc/hosts"), false);
});

test("allows rm single file (no -r/-rf)", () => {
	assert.equal(isDangerousCommand("rm file.txt"), false);
});

test("allows git push without --force", () => {
	assert.equal(isDangerousCommand("git push origin main"), false);
});

test("classifyCommand returns matched pattern label", () => {
	const result = classifyCommand("rm -rf /important");
	assert.ok(result !== null);
	assert.equal(result.label, "Recursive delete");
});

test("classifyCommand returns null for safe commands", () => {
	const result = classifyCommand("echo hello");
	assert.equal(result, null);
});

test("isDangerousCommand respects allowlist", () => {
	const allowlist = new Set(["sudo apt update"]);
	assert.equal(isDangerousCommand("sudo apt update", undefined, allowlist), false);
	assert.equal(isDangerousCommand("sudo rm -rf /", undefined, allowlist), true);
});

test("isDangerousCommand with custom extra patterns", () => {
	const extra = [{ pattern: /format\s+[A-Z]:/giu, label: "Disk format" }];
	assert.equal(isDangerousCommand("format C:", extra), true);
	assert.equal(isDangerousCommand("ls -la", extra), false);
});

test("handles multiline commands", () => {
	const cmd = "cd /tmp && rm -rf *";
	assert.equal(isDangerousCommand(cmd), true);
});

test("detects mkfs", () => {
	assert.equal(isDangerousCommand("mkfs.ext4 /dev/sda1"), true);
});

test("detects dd if=", () => {
	assert.equal(isDangerousCommand("dd if=/dev/zero of=/dev/sda"), true);
});
