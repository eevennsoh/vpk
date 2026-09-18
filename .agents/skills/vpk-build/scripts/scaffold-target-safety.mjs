import fs from "node:fs";
import path from "node:path";

function isOwnedExistingTarget(targetDir) {
	if (fs.existsSync(path.join(targetDir, ".git")) || fs.existsSync(path.join(targetDir, ".deploy.local"))) return true;
	const descriptorPath = path.join(targetDir, "service-descriptor.yml");
	if (!fs.existsSync(descriptorPath)) return false;
	const descriptor = fs.readFileSync(descriptorPath, "utf8");
	return /image:\s*docker\.atl-paas\.net\/(?!YOUR-SERVICE-NAME\b)[a-z0-9-]+/u.test(descriptor);
}

/** Existing checkouts and deployments require a staged refresh that preserves local config. */
export function validateScaffoldTarget(targetDir, force) {
	if (!fs.existsSync(targetDir) || fs.readdirSync(targetDir).length === 0) return;
	if (!force) {
		throw new Error(
			`Target directory ${targetDir} is not empty. Use --force only for disposable scratch targets; refresh an existing checkout through staging.`,
		);
	}
	if (isOwnedExistingTarget(targetDir)) {
		throw new Error(
			`Target directory ${targetDir} is an existing checkout or configured deployment. ` +
			"Scaffold into a disposable staging directory and review a content-based refresh; " +
			"do not overwrite its descriptor, credentials, README, or backend launcher.",
		);
	}
}
