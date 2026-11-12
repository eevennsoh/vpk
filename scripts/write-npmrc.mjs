#!/usr/bin/env node
// Upserts the registry routing + atlassian-npm and Motion+ auth that `pnpm install`
// needs into the user-level npmrc. Each managed key ends up exactly once; every other
// line is preserved, so reruns and pre-existing machine config never stack
// duplicate entries. Runs before `pnpm install`, so it uses Node built-ins only.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Metadata resolves through `/artifactory/api/npm/`; the lockfile tarball URL for
// `@atlassian/logo-third-party` uses `/api/npm/`, so both need the token.
const AUTH_HOSTS = [
	"//packages.atlassian.com/artifactory/api/npm/atlassian-npm/",
	"//packages.atlassian.com/api/npm/atlassian-npm/",
];

// Motion+ (`motion-plus` → `@motionplus/core`) resolves from Motion's private
// registry. The scope routing lives in the tracked `.npmrc`; only the token is
// written here, because pnpm 11 ignores project-level auth settings.
const MOTION_AUTH_HOST = "//api.motion.dev/npm/";

export function managedEntries(token, motionToken) {
	return [
		["registry", "https://registry.npmjs.org/"],
		["@atlaskit:registry", "https://registry.npmjs.org/"],
		["@atlassian:registry", "https://packages.atlassian.com/artifactory/api/npm/atlassian-npm/"],
		...AUTH_HOSTS.map((host) => [`${host}:_authToken`, token]),
		...(motionToken ? [[`${MOTION_AUTH_HOST}:_authToken`, motionToken]] : []),
	];
}

function lineKey(line) {
	const trimmed = line.trim();
	if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith(";")) {
		return null;
	}
	const eq = trimmed.indexOf("=");
	return eq === -1 ? null : trimmed.slice(0, eq).trim();
}

export function upsertNpmrc(existingText, entries) {
	const managed = new Map(entries);
	const written = new Set();
	const lines = [];

	for (const line of existingText.split(/\r?\n/u)) {
		const key = lineKey(line);
		if (key === null || !managed.has(key)) {
			lines.push(line);
		} else if (!written.has(key)) {
			lines.push(`${key}=${managed.get(key)}`);
			written.add(key);
		}
	}

	while (lines.length > 0 && lines.at(-1).trim() === "") {
		lines.pop();
	}
	for (const [key, value] of entries) {
		if (!written.has(key)) {
			lines.push(`${key}=${value}`);
		}
	}
	return `${lines.join("\n")}\n`;
}

function main() {
	const token = process.env.ATLASSIAN_NPM_TOKEN?.trim();
	const motionToken = process.env.MOTION_TOKEN?.trim();
	const missing = [];
	if (!token) {
		missing.push(
			"ATLASSIAN_NPM_TOKEN is empty. Add it as a secret in this environment; without it " +
				"@atlassian/logo-third-party redirects to public npm and 404s.",
		);
	}
	if (!motionToken) {
		missing.push(
			"MOTION_TOKEN is empty. Add it as a secret in this environment; without it " +
				"motion-plus (@motionplus/core) fails with a 401 from api.motion.dev.",
		);
	}
	if (missing.length > 0) {
		for (const message of missing) {
			console.error(message);
		}
		process.exit(1);
	}

	const target = process.env.NPMRC_PATH || path.join(os.homedir(), ".npmrc");
	const existing = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
	fs.writeFileSync(target, upsertNpmrc(existing, managedEntries(token, motionToken)), { mode: 0o600 });
	fs.chmodSync(target, 0o600);
	console.log(`Updated ${target} (atlassian-npm + Motion+ auth, registry routing).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	main();
}
