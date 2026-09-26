import { existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const pnpmBin = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const temporaryMoves = [
	{
		source: join(rootDir, "app", "api"),
		backup: join(rootDir, ".api-routes-backup"),
	},
];

const movedPaths = [];
let buildProcess = null;

function restoreMovedPaths() {
	for (const move of [...movedPaths].reverse()) {
		if (!existsSync(move.backup)) {
			continue;
		}
		renameSync(move.backup, move.source);
	}

	movedPaths.length = 0;
}

function handleTermination(signal) {
	buildProcess?.kill(signal);
	restoreMovedPaths();
	process.exit(signal === "SIGINT" ? 130 : 143);
}

process.once("SIGINT", handleTermination);
process.once("SIGTERM", handleTermination);

try {
	for (const move of temporaryMoves) {
		if (!existsSync(move.source)) {
			continue;
		}

		if (existsSync(move.backup)) {
			throw new Error(`${move.backup} already exists; restore or remove it before exporting`);
		}

		renameSync(move.source, move.backup);
		movedPaths.push(move);
	}

	const result = await new Promise((resolve) => {
		buildProcess = spawn(pnpmBin, ["run", "build"], {
			env: {
				...process.env,
				NEXT_OUTPUT: "export",
			},
			stdio: "inherit",
		});

		buildProcess.on("exit", (status, signal) => {
			resolve({ status, signal });
		});

		buildProcess.on("error", (error) => {
			console.error(error);
			resolve({ status: 1, signal: null });
		});
	});
	buildProcess = null;

	if (result.signal) {
		process.kill(process.pid, result.signal);
	}

	if (result.status !== 0) {
		process.exitCode = result.status ?? 1;
	}
} finally {
	restoreMovedPaths();
}
