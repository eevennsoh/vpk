#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const environments = ["pdev-west2", "pdev-apse2"];
const successful = new Set(["CREATE_COMPLETE", "UPDATE_COMPLETE"]);

function matchStack(stacks, id, label) {
	const matches = stacks.filter(stack => stack.deploymentId === id);
	if (matches.length !== 1) throw new Error(`${label} deployment reference is missing or ambiguous`);
	const stack = matches[0];
	const rawVersion = stack.sd?.buildNumber ?? stack.version ?? null;
	if (typeof stack.status !== "string" || (rawVersion !== null && typeof rawVersion !== "string")) throw new Error("Invalid deployment status metadata");
	const version = rawVersion === null ? null : String(rawVersion);
	return { deploymentId: id, status: stack.status, version };
}

export function resolveDeploymentStatus(snapshot, { environment, deploymentId, version } = {}) {
	if (!environments.includes(environment)) throw new Error("Unsupported Micros environment");
	const stacks = snapshot?.stacks?.[environment] ?? [];
	if (!Array.isArray(stacks)) throw new Error("Invalid Micros stack snapshot");
	const stableId = snapshot?.environments?.[environment]?.stable?.deploymentId;
	const stable = stableId ? matchStack(stacks, stableId, "Stable") : null;
	if (!stableId && stacks.length && !deploymentId) throw new Error("Stable deployment reference is missing");
	const requested = deploymentId ? matchStack(stacks, deploymentId, "Requested") : stable;
	const ready = Boolean(stable && requested && stable.deploymentId === requested.deploymentId && successful.has(requested.status) && (version === undefined || requested.version === version));
	return { environment, stable, requested, ready };
}

export function main(args) {
	let snapshotPath = "-", environment, deploymentId, version, requireReady = false;
	for (let index = 0; index < args.length; index++) {
		const flag = args[index];
		if (flag === "--require-ready") { requireReady = true; continue; }
		const value = args[++index];
		if (!value || value.startsWith("--")) throw new Error("Deployment status option value is required");
		if (flag === "--snapshot") snapshotPath = value;
		else if (flag === "--env") environment = value;
		else if (flag === "--deployment-id") deploymentId = value;
		else if (flag === "--version") version = value;
		else throw new Error("Unsupported deployment status option");
	}
	let snapshot;
	try {
		snapshot = JSON.parse(fs.readFileSync(snapshotPath === "-" ? 0 : snapshotPath, "utf8"), (key, value, context) => {
			if ((key === "buildNumber" || key === "version") && typeof value === "number") {
				if (typeof context?.source !== "string") throw new Error("Numeric deployment version source is unavailable");
				return context.source;
			}
			return value;
		});
	}
	catch { throw new Error("Invalid Micros service snapshot JSON"); }
	const status = resolveDeploymentStatus(snapshot, { environment, deploymentId, version });
	console.log(JSON.stringify(status, null, 2));
	if (requireReady && !status.ready) process.exitCode = 2;
}

if (process.argv[1] && fs.existsSync(process.argv[1]) && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try { main(process.argv.slice(2)); }
	catch (error) { console.error(error.message); process.exitCode = 2; }
}
