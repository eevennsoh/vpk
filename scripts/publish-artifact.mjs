#!/usr/bin/env node
// Publishes a local file to Atlassian Artifacts through the TWG CLI (production), updating
// the artifact recorded for its slug instead of creating a duplicate.
//
//   node scripts/publish-artifact.mjs output/artifact-html/awake/awake.html --name Awake
//   node scripts/publish-artifact.mjs report.html --slug q3-report --access shared --description "…"
//   node scripts/publish-artifact.mjs <file> --dry-run   # print the twg command only
//   node scripts/publish-artifact.mjs <file> --new       # create even if the slug is recorded
//
// The registry at ~/.config/vpk/artifacts.json (override: VPK_ARTIFACT_REGISTRY) maps each
// slug to { id, name, artifactUrl, file, createdAt, updatedAt }. It lives outside the repo so
// it survives worktree cleanup and never writes under artifacts/. New artifacts default to
// private. twg also returns a signed raw-file URL that lets anyone holding it download the
// file; this script never prints or stores it.
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs, promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ACCESS_LEVELS = new Set(["private", "shared", "open"]);

export const registryPath = (env = process.env) => env.VPK_ARTIFACT_REGISTRY ?? path.join(homedir(), ".config/vpk/artifacts.json");

/** Slug for a file: its name without extension, which matches the builder's <slug>/<slug>.html. */
export function slugForFile(file) {
	return path.basename(file, path.extname(file));
}

/** Chooses create versus update and builds the twg arguments. Update always re-sends the name. */
export function planPublish({ access, description, entry, file, forceNew = false, name }) {
	if (access && !ACCESS_LEVELS.has(access)) {
		throw new Error(`--access must be one of ${[...ACCESS_LEVELS].join(", ")}`);
	}
	const update = Boolean(entry) && !forceNew;
	const resolvedName = name ?? (update ? entry.name : undefined) ?? path.basename(file);
	const args = update
		? ["artifacts", "file", "update", entry.id, file, "--name", resolvedName]
		: ["artifacts", "file", "create", file, "--name", resolvedName, "--access", access ?? "private"];
	if (update && access) args.push("--access", access);
	if (description) args.push("--description", description);
	return { args: ["--env", "prod", ...args, "-o", "json"], mode: update ? "update" : "create", name: resolvedName };
}

/** Parses twg JSON output (after any warning preamble) into the fields worth keeping. */
export function parseTwgResult(stdout) {
	const start = stdout.search(/^\{/mu);
	if (start < 0) {
		throw new Error(`twg returned no JSON:\n${stdout.slice(0, 500)}`);
	}
	const result = JSON.parse(stdout.slice(start));
	if (result.ok === false) {
		const message = result.error?.message ?? "twg reported an error";
		const hint = /401|organization|login|OAuth/iu.test(message) ? "\nSign in to production TWG: twg --env prod login --site hello" : "";
		throw new Error(`${message}${hint}`);
	}
	const { artifactUrl, id, name, type } = result.data ?? {};
	if (!id || !artifactUrl) {
		throw new Error("twg response is missing the artifact id or URL.");
	}
	return { artifactUrl, id, name, type };
}

async function readRegistry(file) {
	try {
		return JSON.parse(await readFile(file, "utf8"));
	} catch (error) {
		if (error.code === "ENOENT") return {};
		throw error;
	}
}

async function runTwg(args) {
	const candidates = ["twg", path.join(homedir(), ".local/bin/twg")];
	for (const binary of candidates) {
		try {
			const { stdout } = await execFileAsync(binary, args, { maxBuffer: 16 * 1024 * 1024 });
			return stdout;
		} catch (error) {
			if (error.code === "ENOENT") continue;
			// twg exits non-zero on API errors but still prints its JSON envelope.
			if (typeof error.stdout === "string" && error.stdout.includes("{")) return error.stdout;
			throw error;
		}
	}
	throw new Error("twg CLI not found on PATH or at ~/.local/bin/twg.");
}

async function main() {
	const { positionals, values } = parseArgs({
		allowPositionals: true,
		options: {
			access: { type: "string" },
			description: { type: "string" },
			"dry-run": { type: "boolean" },
			name: { type: "string" },
			new: { type: "boolean" },
			slug: { type: "string" },
		},
	});
	const file = positionals[0];
	if (!file) {
		throw new Error("Usage: node scripts/publish-artifact.mjs <file> [--name <name>] [--slug <slug>] [--access private|shared|open] [--description <text>] [--new] [--dry-run]");
	}
	const slug = values.slug ?? slugForFile(file);
	const registryFile = registryPath();
	const registry = await readRegistry(registryFile);
	const plan = planPublish({ access: values.access, description: values.description, entry: registry[slug], file, forceNew: values.new, name: values.name });

	if (values["dry-run"]) {
		console.log(`${plan.mode} "${plan.name}" (slug ${slug}):\ntwg ${plan.args.map((arg) => (/\s/u.test(arg) ? JSON.stringify(arg) : arg)).join(" ")}`);
		return;
	}

	const artifact = parseTwgResult(await runTwg(plan.args));
	const now = new Date().toISOString();
	registry[slug] = {
		artifactUrl: artifact.artifactUrl,
		createdAt: registry[slug] && plan.mode === "update" ? registry[slug].createdAt : now,
		file: path.resolve(file),
		id: artifact.id,
		name: artifact.name ?? plan.name,
		updatedAt: now,
	};
	await mkdir(path.dirname(registryFile), { recursive: true });
	await writeFile(registryFile, `${JSON.stringify(registry, null, "\t")}\n`);

	console.log(`${plan.mode === "update" ? "Updated" : "Created"} "${registry[slug].name}" (${artifact.type ?? "unknown type"})`);
	console.log(`Artifact URL: ${artifact.artifactUrl}`);
	console.log(`Recorded as "${slug}" in ${registryFile}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		await main();
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
