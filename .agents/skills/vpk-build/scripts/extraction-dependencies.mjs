import fs from "node:fs";
import path from "node:path";

const HOST_PACKAGE_PEERS = [
	{ host: "react-leaflet", peers: ["leaflet", "@types/leaflet"] },
	{ host: "three", peers: ["@types/three"] },
];

function readManifest(repoRoot) {
	return JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
}

function readPnpmCatalog(repoRoot) {
	const yamlPath = path.join(repoRoot, "pnpm-workspace.yaml");
	if (!fs.existsSync(yamlPath)) return {};
	const catalog = {};
	let inCatalog = false;
	for (const rawLine of fs.readFileSync(yamlPath, "utf8").split("\n")) {
		const line = rawLine.replace(/\s+#.*$/, "");
		if (!inCatalog) {
			if (/^catalog:\s*$/.test(line)) inCatalog = true;
			continue;
		}
		if (/^\S/.test(line) && line.trim() !== "") break;
		const match = line.match(/^\s+['"]?([^'"#:]+)['"]?\s*:\s*['"]?([^'"#\s]+)['"]?\s*$/);
		if (match) catalog[match[1].trim()] = match[2].trim();
	}
	return catalog;
}

function resolveCatalogSpecifier(name, version, catalog) {
	return version === "catalog:" ? catalog[name] || version : version;
}

function sourceVersion(name, manifest, catalog) {
	const raw = manifest.dependencies?.[name] || manifest.devDependencies?.[name];
	return raw ? resolveCatalogSpecifier(name, raw, catalog) : null;
}

function addHostPeers(npmPackages, manifest, catalog) {
	const warnings = [];
	for (const { host, peers } of HOST_PACKAGE_PEERS) {
		if (!npmPackages[host]) continue;
		for (const peer of peers) {
			if (npmPackages[peer]) continue;
			const version = sourceVersion(peer, manifest, catalog);
			if (version) npmPackages[peer] = version;
			else warnings.push(`Host package "${host}" is in the graph but peer "${peer}" is missing from source package.json`);
		}
	}
	return warnings;
}

export function collectLocalCssImportsFromText(cssText, fromDir) {
	const found = [];
	const re = /@import\s+["'](\.\.?\/[^"']+\.css)["']/g;
	let match;
	while ((match = re.exec(cssText)) !== null) {
		found.push(path.posix.normalize(path.posix.join(fromDir, match[1])));
	}
	return found;
}

export function resolveTraceDependencies({ repoRoot, packageNames, cssImports }) {
	const manifest = readManifest(repoRoot);
	const catalog = readPnpmCatalog(repoRoot);
	const npmPackages = {};
	const unresolvedNpm = [];
	const unresolvedCatalog = [];
	for (const name of [...packageNames].sort()) {
		const version = sourceVersion(name, manifest, catalog);
		if (version) {
			npmPackages[name] = version;
			if (version === "catalog:") unresolvedCatalog.push(name);
		} else if (name.startsWith("react") || name === "next" || name === "typescript") {
			npmPackages[name] = "latest";
		} else unresolvedNpm.push(name);
	}
	const warnings = addHostPeers(npmPackages, manifest, catalog);
	const cssImportSet = new Set([...cssImports, "app/tailwind-theme.css", "@atlaskit/tokens/css-reset.css"]);
	const globalsCssPath = path.join(repoRoot, "app", "globals.css");
	if (fs.existsSync(globalsCssPath)) {
		for (const relative of collectLocalCssImportsFromText(fs.readFileSync(globalsCssPath, "utf8"), "app")) {
			cssImportSet.add(relative);
		}
	}
	if (!npmPackages["@atlaskit/tokens"]) {
		const version = sourceVersion("@atlaskit/tokens", manifest, catalog);
		if (version) npmPackages["@atlaskit/tokens"] = version;
	}
	for (const name of unresolvedNpm) {
		warnings.push(`npm dep "${name}" not found in root package.json — extraction may fail`);
	}
	for (const name of unresolvedCatalog) {
		warnings.push(`npm dep "${name}" uses catalog: but has no entry in pnpm-workspace.yaml`);
	}
	return { npmPackages, cssImports: [...cssImportSet].sort(), warnings };
}

export function resolveScaffoldDependencies({ repoRoot, planPackages, backendManifest }) {
	const manifest = fs.existsSync(path.join(repoRoot, "package.json")) ? readManifest(repoRoot) : {};
	const catalog = readPnpmCatalog(repoRoot);
	const npmPackages = {};
	for (const [name, version] of Object.entries(planPackages || {})) {
		npmPackages[name] = resolveCatalogSpecifier(name, version, catalog);
	}
	if (!npmPackages["tw-animate-css"]) {
		npmPackages["tw-animate-css"] = sourceVersion("tw-animate-css", manifest, catalog) || "^1.4.0";
	}
	if (!npmPackages.shadcn) {
		const version = sourceVersion("shadcn", manifest, catalog);
		if (version) npmPackages.shadcn = version;
	}
	addHostPeers(npmPackages, manifest, catalog);
	if (backendManifest) {
		for (const [name, version] of Object.entries({ ...manifest.dependencies, ...backendManifest.dependencies })) {
			if (["motion-plus", "ansi-to-react"].includes(name)) continue;
			const resolved = resolveCatalogSpecifier(name, version, catalog);
			if (resolved === "catalog:") throw new Error(`Backend dependency ${name} has no catalog version`);
			npmPackages[name] = resolved;
		}
	}
	return { npmPackages, packageManager: manifest.packageManager };
}
