#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const BLOCKED_REGISTRY_PATTERNS = [
	{
		explanation:
			"Use npm-remote tarball URLs instead; atlassian-npm lockfile URLs have broken CI installs.",
		pattern: /packages\.atlassian\.com\/(?:artifactory\/)?api\/npm\/atlassian-npm\//u,
	},
	{
		explanation:
			"Use registry.npmjs.org tarball URLs for public npm packages; npm-remote URLs fail pnpm tarball policy when the repo registry is npmjs.",
		pattern: /packages\.atlassian\.com\/(?:artifactory\/)?api\/npm\/npm-remote\//u,
	},
	{
		explanation:
			"Never lock a URL that embeds a credential; this repo is public. Motion+ resolves as `npm:@motionplus/core` from api.motion.dev/npm with the token in user-level npmrc (see .npmrc).",
		pattern: /[?&]token=|api\.motion\.dev\/registry/u,
	},
];

// Packages that legitimately resolve from the internal atlassian-npm registry
// because they are NOT published to the public npm-remote mirror
// (`inPublicMirror: false`). These require atlassian-npm auth in CI — see
// `.github/workflows/ci.yml`. Keep this list as small as possible.
const ALLOWED_ATLASSIAN_NPM_PACKAGES = [
	// @atlassian/logo-third-party (Platform Labs) — third-party brand logos,
	// internal-only while the catalog/asset workflow is validated with early
	// consumers. Only the package tarball itself is exempt; its @atlaskit deps
	// still resolve from npm-remote.
	/\/atlassian-npm\/@atlassian\/logo-third-party\//u,
];

function findBlockedLockfileRegistryUrls(lockfileText) {
	const findings = [];
	const lines = lockfileText.split(/\r?\n/u);

	lines.forEach((line, index) => {
		if (ALLOWED_ATLASSIAN_NPM_PACKAGES.some((allowed) => allowed.test(line))) {
			return;
		}

		for (const registryPattern of BLOCKED_REGISTRY_PATTERNS) {
			if (registryPattern.pattern.test(line)) {
				findings.push({
					explanation: registryPattern.explanation,
					line: index + 1,
					text: line.trim(),
				});
			}
		}
	});

	return findings;
}

function main() {
	const lockfilePath = path.resolve(process.argv[2] ?? "pnpm-lock.yaml");
	const lockfileText = fs.readFileSync(lockfilePath, "utf8");
	const findings = findBlockedLockfileRegistryUrls(lockfileText);

	if (findings.length === 0) {
		console.log(`Verified ${path.relative(process.cwd(), lockfilePath) || lockfilePath}`);
		return;
	}

	console.error(`${path.relative(process.cwd(), lockfilePath) || lockfilePath} contains blocked registry URLs:`);
	for (const finding of findings) {
		console.error(`- line ${finding.line}: ${finding.text}`);
		console.error(`  ${finding.explanation}`);
	}
	process.exitCode = 1;
}

if (require.main === module) {
	main();
}

module.exports = {
	findBlockedLockfileRegistryUrls,
};
