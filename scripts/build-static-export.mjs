import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const JOURNAL_SCHEMA = 1;
const rootDir = process.cwd();
const pnpmBin = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const journalPath = join(rootDir, ".static-export-journal.json");
const temporaryMoves = [
	{
		source: join(rootDir, "app", "api"),
		backup: join(rootDir, ".api-routes-backup"),
	},
];
const TERMINATION_EXIT_CODES = { SIGHUP: 129, SIGINT: 130, SIGTERM: 143 };

let buildProcess = null;

function isProcessAlive(pid) {
	if (!Number.isInteger(pid) || pid <= 0) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return error?.code === "EPERM";
	}
}

function readJournal() {
	if (!existsSync(journalPath)) return null;
	try {
		const journal = JSON.parse(readFileSync(journalPath, "utf8"));
		if (journal?.schema === JOURNAL_SCHEMA && Array.isArray(journal.moves)) return journal;
	} catch {
		// Fall through: an unreadable journal is treated like a journal from a dead run.
	}
	return { schema: JOURNAL_SCHEMA, moves: temporaryMoves, pid: null, startedAt: null };
}

function writeJournal(moves) {
	writeFileSync(journalPath, `${JSON.stringify({
		schema: JOURNAL_SCHEMA,
		moves,
		pid: process.pid,
		startedAt: new Date().toISOString(),
	}, null, "\t")}\n`);
}

// Move every backup that is still aside back to its source, newest first. Safe to repeat.
function restoreMoves(moves) {
	const restored = [];
	for (const move of [...moves].reverse()) {
		if (!existsSync(move.backup)) continue;
		if (existsSync(move.source)) {
			throw new Error(`Both ${move.source} and ${move.backup} exist; keep the right one and delete the other before exporting`);
		}
		renameSync(move.backup, move.source);
		restored.push(move.source);
	}
	return restored;
}

function finishRun(moves) {
	restoreMoves(moves);
	rmSync(journalPath, { force: true });
}

function describeState() {
	const journal = readJournal();
	const leftovers = temporaryMoves.filter((move) => existsSync(move.backup)).map((move) => move.backup);
	if (journal && isProcessAlive(journal.pid) && journal.pid !== process.pid) {
		return { state: "running", pid: journal.pid, startedAt: journal.startedAt, leftovers };
	}
	if (journal || leftovers.length > 0) {
		return { state: "interrupted", pid: journal?.pid ?? null, startedAt: journal?.startedAt ?? null, leftovers };
	}
	return { state: "clean", leftovers };
}

// A run that died (SIGKILL, crash, closed terminal) leaves its routes aside. Put them back
// before starting, unless the run that moved them is still alive.
function recoverInterruptedRun() {
	const status = describeState();
	if (status.state === "running") {
		throw new Error(`Another static export (pid ${status.pid}) is running; wait for it or stop it first`);
	}
	if (status.state === "clean") return [];
	const journal = readJournal();
	const restored = restoreMoves(journal?.moves ?? temporaryMoves);
	rmSync(journalPath, { force: true });
	return restored;
}

function handleTermination(signal) {
	buildProcess?.kill(signal);
	finishRun(temporaryMoves);
	process.exit(TERMINATION_EXIT_CODES[signal] ?? 1);
}

async function runExport() {
	const restored = recoverInterruptedRun();
	for (const source of restored) {
		console.log(`[build:export] Restored ${source} left aside by an interrupted export.`);
	}

	for (const signal of Object.keys(TERMINATION_EXIT_CODES)) {
		process.once(signal, handleTermination);
	}

	const moves = temporaryMoves.filter((move) => existsSync(move.source));
	writeJournal(moves);
	try {
		for (const move of moves) {
			renameSync(move.source, move.backup);
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
		finishRun(moves);
	}
}

const args = new Set(process.argv.slice(2));
if (args.has("--status")) {
	console.log(JSON.stringify(describeState(), null, "\t"));
} else if (args.has("--restore")) {
	const restored = recoverInterruptedRun();
	console.log(restored.length > 0 ? `Restored: ${restored.join(", ")}` : "Nothing to restore.");
} else {
	await runExport();
}
