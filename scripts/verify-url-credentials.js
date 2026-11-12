#!/usr/bin/env node

// Fails when a tracked file embeds a credential in a URL query (`?token=<value>`,
// `&key=<value>`, `?auth=<value>`, `?secret=<value>`). The repository is public: a credential that reaches a
// tracked file is published, so registry and API auth belong in user-level config.

const { spawnSync } = require("node:child_process");

const CREDENTIAL_QUERY_PATTERN = "[?&](token|key|auth|secret)=";
const CREDENTIAL_QUERY = /[?&](token|key|auth|secret)=([^\s"'`<>&#)\]]*)/giu;

// Values that are code, not a literal: template or JSX interpolation, placeholders, escapes.
const NON_LITERAL_VALUE = /^(?:$|\$|\{|\\|<|%|\[)/u;

// Test fixtures that need a credential-shaped URL to prove a guard rejects it.
const ALLOWED_FILES = new Map([
	["scripts/verify-pnpm-lockfile.test.js", "fixture proving the lockfile check rejects a token-bearing registry URL"],
	["scripts/verify-url-credentials.test.js", "fixtures for this check"],
	[".agents/skills/vpk-deploy/scripts/verify-runtime.test.js", "fixture proving runtime reports redact query values"],
]);

function findUrlCredentials(lines, { allowedFiles = ALLOWED_FILES } = {}) {
	const findings = [];
	for (const { filePath, lineNumber, text } of lines) {
		if (allowedFiles.has(filePath)) continue;
		for (const match of text.matchAll(CREDENTIAL_QUERY)) {
			if (NON_LITERAL_VALUE.test(match[2])) continue;
			findings.push({ filePath, lineNumber, parameter: match[1].toLowerCase() });
		}
	}
	return findings;
}

function grepTrackedFiles(cwd = process.cwd()) {
	const result = spawnSync("git", ["grep", "-z", "-n", "-I", "-i", "-E", "-e", CREDENTIAL_QUERY_PATTERN], {
		cwd,
		encoding: "utf8",
		maxBuffer: 256 * 1024 * 1024,
	});
	// git grep exits 1 when nothing matches.
	if (result.status === 1) return [];
	if (result.status !== 0) {
		throw new Error(`git grep failed: ${result.stderr.trim()}`);
	}
	return result.stdout
		.split("\n")
		.filter(Boolean)
		.map((record) => {
			const [filePath, lineNumber, ...rest] = record.split("\0");
			return { filePath, lineNumber: Number(lineNumber), text: rest.join("\0") };
		});
}

function main() {
	const findings = findUrlCredentials(grepTrackedFiles());
	if (findings.length === 0) {
		console.log("Verified tracked files contain no URL-embedded credentials.");
		return;
	}
	console.error("URL-embedded credentials found in tracked files (values not shown):");
	for (const { filePath, lineNumber, parameter } of findings) {
		console.error(`- ${filePath}:${lineNumber} (${parameter}=)`);
	}
	console.error("Move the credential to user-level config (for example ~/.npmrc or an environment variable) and rotate it: this repository is public.");
	process.exitCode = 1;
}

if (require.main === module) {
	main();
}

module.exports = {
	ALLOWED_FILES,
	findUrlCredentials,
	grepTrackedFiles,
};
