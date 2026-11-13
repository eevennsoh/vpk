"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const LEDGER_PATH = path.join(__dirname, "ts-check-ledger.json");
const SKIPPED_DIRECTORIES = new Set(["node_modules", "public", "data"]);

// Every backend .js file whose first line is `// @ts-check`, relative to backend/.
function listCheckedFiles(directory = __dirname, prefix = "") {
	const checked = [];
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (!SKIPPED_DIRECTORIES.has(entry.name) && !entry.name.startsWith(".")) {
				checked.push(...listCheckedFiles(path.join(directory, entry.name), `${prefix}${entry.name}/`));
			}
			continue;
		}
		if (!entry.isFile() || !entry.name.endsWith(".js")) continue;
		const firstLine = fs.readFileSync(path.join(directory, entry.name), "utf8").split("\n", 1)[0].trim();
		if (firstLine === "// @ts-check") checked.push(`${prefix}${entry.name}`);
	}
	return checked.sort();
}

test("the count of type-checked backend files only goes up", () => {
	const { minimum } = JSON.parse(fs.readFileSync(LEDGER_PATH, "utf8"));
	const checked = listCheckedFiles();
	assert.ok(
		checked.length >= minimum,
		`${checked.length} backend files start with // @ts-check; backend/ts-check-ledger.json requires at least ${minimum}. Keep // @ts-check on the files that have it.`,
	);
	assert.equal(
		checked.length,
		minimum,
		`${checked.length} backend files start with // @ts-check; raise "minimum" in backend/ts-check-ledger.json to ${checked.length} so the count cannot drop back.`,
	);
});

test("tsconfig.backend.json checks backend JS only where a file opts in", () => {
	const config = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "tsconfig.backend.json"), "utf8"));
	assert.equal(config.compilerOptions.allowJs, true);
	assert.equal(config.compilerOptions.checkJs, false);
	assert.deepEqual(config.include, ["backend/**/*.js"]);
});
