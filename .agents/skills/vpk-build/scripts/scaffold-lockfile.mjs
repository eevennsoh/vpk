import fs from "node:fs";
import path from "node:path";

function readSourceLockfileVersions(repoRoot) {
	const lockfilePath = path.join(repoRoot, "pnpm-lock.yaml");
	if (!fs.existsSync(lockfilePath)) return new Map();
	const lockfile = fs.readFileSync(lockfilePath, "utf8");
	const rootVersions = new Map();
	const otherVersions = new Map();
	let inImporters = false;
	let importer = null;
	let section = null;
	let dependency = null;

	for (const line of lockfile.split(/\r?\n/u)) {
		if (!inImporters) {
			if (line === "importers:") inImporters = true;
			continue;
		}
		if (line && !line.startsWith(" ")) {
			if (line === "packages:" || line === "snapshots:") break;
			inImporters = false;
			continue;
		}

		const importerMatch = line.match(/^ {2}([^ ].*):\s*$/u);
		if (importerMatch) {
			importer = importerMatch[1].replace(/^(['"])(.*)\1$/u, "$2");
			section = null;
			dependency = null;
			continue;
		}

		const sectionMatch = line.match(/^ {4}(dependencies|devDependencies|optionalDependencies):\s*$/u);
		if (sectionMatch) {
			section = sectionMatch[1];
			dependency = null;
			continue;
		}
		if (/^ {4}\S/u.test(line)) {
			section = null;
			dependency = null;
			continue;
		}
		if (!section) continue;

		const dependencyMatch = line.match(/^ {6}(.+):\s*$/u);
		if (dependencyMatch) {
			dependency = dependencyMatch[1].replace(/^(['"])(.*)\1$/u, "$2");
			continue;
		}

		const resolvedMatch = line.match(/^ {8}version:\s*(\S+)/u);
		if (!dependency || !resolvedMatch) continue;
		const exactVersion = resolvedMatch[1].match(/^(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/u)?.[1];
		if (!exactVersion) continue;
		if (importer === ".") rootVersions.set(dependency, exactVersion);
		else if (!otherVersions.has(dependency)) otherVersions.set(dependency, exactVersion);
	}

	return new Map([...otherVersions, ...rootVersions]);
}

export function pinDependenciesToSourceLockfile(repoRoot, dependencies) {
	const lockfileVersions = readSourceLockfileVersions(repoRoot);
	for (const name of Object.keys(dependencies)) {
		const exactVersion = lockfileVersions.get(name);
		if (exactVersion) dependencies[name] = exactVersion;
	}
}

