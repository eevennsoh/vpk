#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectExport } from "../../../../scripts/prepare-static-export.mjs";

function readJson(file) {
	try { return JSON.parse(fs.readFileSync(file, "utf8")); }
	catch { throw new Error("Invalid packaging metadata JSON"); }
}

export function inspectPackaging(targetDirectory, plan) {
	const target = fs.realpathSync(targetDirectory);
	const read = relative => readJson(path.join(target, relative));
	const manifest = read("package.json");
	const source = fs.existsSync(path.join(target, ".vpk-source.json")) ? read(".vpk-source.json") : null;
	const inventory = inspectExport(path.join(target, "out"));
	const packages = Object.keys(manifest.dependencies ?? {}).sort();
	const route = plan ? Object.keys(plan.npmPackages ?? {}).sort() : source?.dependencyProvenance?.route ?? null;
	const backendDeclared = fs.existsSync(path.join(target, "backend/package.json")) ? Object.keys(read("backend/package.json").dependencies ?? {}).sort() : [];
	return {
		version: 1, target, measurement: "Packaged file bytes and declared dependency provenance; not browser latency or measured container disk use",
		export: { packagedFiles: inventory.packagedFiles, packagedBytes: inventory.packagedBytes, representationBytes: inventory.representationBytes, compressionOverheadBytes: inventory.compressionOverheadBytes, largestOriginalAssets: inventory.largestPackagedAssets },
		dependencies: {
			count: packages.length, route, backendDeclared,
			conservativeUnclassified: route ? packages.filter(name => !route.includes(name) && !backendDeclared.includes(name)) : null,
			note: "Unclassified dependencies are not proven unused. Preserve them until a backend import/runtime audit covers dynamic imports and optional capabilities.",
		},
	};
}

export function main(args) {
	let target = process.cwd(), planFile, reportFile;
	for (let index = 0; index < args.length; index++) {
		const flag = args[index], value = args[++index];
		if (!value || value.startsWith("--")) throw new Error("Packaging option value is required");
		if (flag === "--target") target = path.resolve(value);
		else if (flag === "--plan") planFile = path.resolve(value);
		else if (flag === "--report") reportFile = path.resolve(value);
		else throw new Error("Unsupported packaging report option");
	}
	const plan = planFile ? readJson(planFile) : undefined;
	const report = inspectPackaging(target, plan);
	if (reportFile) {
		const exported = path.join(report.target, "out");
		if (reportFile === exported || reportFile.startsWith(`${exported}${path.sep}`)) throw new Error("Store packaging reports outside the public export");
		fs.mkdirSync(path.dirname(reportFile), { recursive: true });
		fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
	}
	console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && fs.existsSync(process.argv[1]) && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try { main(process.argv.slice(2)); }
	catch (error) { console.error(error.message); process.exitCode = 2; }
}
