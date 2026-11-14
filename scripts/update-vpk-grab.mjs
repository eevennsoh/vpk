#!/usr/bin/env node
// Moves VPK to the latest vpk-grab release (github.com/eevennsoh/vpk-grab):
// the `react-grab` tarball in package.json and VPK_GRAB_VERSION, which picks the
// script tag the dev mount loads. Then installs. Run via `pnpm run update:vpk-grab`.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const VPK_GRAB_REPOSITORY = "eevennsoh/vpk-grab";
const PACKAGE_JSON_PATH = fileURLToPath(new URL("../package.json", import.meta.url));
const LOADER_PATH = fileURLToPath(new URL("../components/utils/dev-react-grab.ts", import.meta.url));

const VERSION_PATTERN = /export const VPK_GRAB_VERSION = "([^"]+)";/u;
const DEPENDENCY_PATTERN = /"react-grab": "([^"]+)"/u;

export function vpkGrabTarballUrl(version) {
	return `https://github.com/${VPK_GRAB_REPOSITORY}/releases/download/v${version}/react-grab-${version}.tgz`;
}

export function readPinnedVersions({ packageJsonText, loaderText }) {
	return {
		dependency: packageJsonText.match(DEPENDENCY_PATTERN)?.[1] ?? null,
		loaderVersion: loaderText.match(VERSION_PATTERN)?.[1] ?? null,
	};
}

export function pinVersion({ packageJsonText, loaderText }, version) {
	const pinned = readPinnedVersions({ packageJsonText, loaderText });
	if (pinned.dependency === null) throw new Error("package.json has no react-grab dependency");
	if (pinned.loaderVersion === null) throw new Error("dev-react-grab.ts has no VPK_GRAB_VERSION");
	return {
		packageJsonText: packageJsonText.replace(DEPENDENCY_PATTERN, `"react-grab": "${vpkGrabTarballUrl(version)}"`),
		loaderText: loaderText.replace(VERSION_PATTERN, `export const VPK_GRAB_VERSION = "${version}";`),
	};
}

async function latestReleaseVersion() {
	const response = await fetch(`https://api.github.com/repos/${VPK_GRAB_REPOSITORY}/releases/latest`, {
		headers: { accept: "application/vnd.github+json" },
	});
	if (!response.ok) throw new Error(`GitHub answered ${response.status} for the latest vpk-grab release`);
	const release = await response.json();
	const version = String(release.tag_name ?? "").replace(/^v/u, "");
	if (!version) throw new Error("the latest vpk-grab release has no tag");
	const assetName = `react-grab-${version}.tgz`;
	if (!(release.assets ?? []).some((asset) => asset.name === assetName)) {
		throw new Error(`release v${version} has no ${assetName} asset`);
	}
	return version;
}

async function main() {
	const version = process.argv[2]?.replace(/^v/u, "") || (await latestReleaseVersion());
	const current = { packageJsonText: readFileSync(PACKAGE_JSON_PATH, "utf8"), loaderText: readFileSync(LOADER_PATH, "utf8") };
	const next = pinVersion(current, version);
	if (next.packageJsonText === current.packageJsonText && next.loaderText === current.loaderText) {
		console.log(`update:vpk-grab: already on vpk-grab v${version}`);
		return;
	}
	writeFileSync(PACKAGE_JSON_PATH, next.packageJsonText);
	writeFileSync(LOADER_PATH, next.loaderText);
	const install = spawnSync("pnpm", ["install"], { stdio: "inherit" });
	if (install.status !== 0) process.exit(install.status ?? 1);
	console.log(`update:vpk-grab: moved to vpk-grab v${version}; ship package.json, pnpm-lock.yaml and dev-react-grab.ts`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	main().catch((error) => {
		console.error(`update:vpk-grab: ${error.message}`);
		process.exit(1);
	});
}
