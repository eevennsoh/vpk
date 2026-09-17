import fs from "node:fs";
import path from "node:path";

/** Add the canonical deploy inputs without replacing extracted application source. */
export function writeBackendDeploymentHarness({ repoRoot, targetDir, packageManager, buildPolicy }) {
	if (!packageManager?.startsWith("pnpm@") || !buildPolicy) {
		throw new Error("Backend-backed extraction requires source pnpm version and build policy");
	}
	const packagePath = path.join(targetDir, "package.json");
	const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
	pkg.packageManager = packageManager;
	Object.assign(pkg.scripts, {
		dev: "node scripts/dev-backend-backed.mjs",
		start: "node backend/extracted-server.js",
		build: "next build",
		"build:export": "node scripts/build-static-export.mjs",
		"deploy:micros": "./scripts/dev-deploy-fast.sh",
	});
	fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, "\t")}\n`);
	fs.writeFileSync(path.join(targetDir, "pnpm-workspace.yaml"), buildPolicy);
	fs.mkdirSync(path.join(targetDir, "scripts"), { recursive: true });
	for (const name of ["build-static-export.mjs", "dev-deploy-fast.sh"]) {
		const destination = path.join(targetDir, "scripts", name);
		fs.copyFileSync(path.join(repoRoot, "scripts", name), destination);
		if (name.endsWith(".sh")) fs.chmodSync(destination, 0o755);
	}
	const configPath = path.join(targetDir, "next.config.ts");
	const config = fs.readFileSync(configPath, "utf8");
	fs.writeFileSync(configPath, config.replace(
		'output: "export",',
		'output: process.env.NEXT_OUTPUT === "export" ? "export" : undefined,',
	));
}
