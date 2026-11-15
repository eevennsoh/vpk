#!/usr/bin/env node
// @ts-check
"use strict";

// One-off: give every Rovo thread stored before owners were recorded (no `owner`) an
// owner, so the SLAuth caller who created them can see them again
// (lib/caller-identity.js: an ownerless thread is visible only to the local owner).
//
//   node backend/scripts/backfill-rovo-thread-owner.js --owner <slauth-subject> --data-dir <dir>
//       prints what it would do (the default, --dry-run) and writes nothing
//   ... --apply
//       writes, with the thread manager the backend uses (atomic temp-file + rename)
//
// --apply takes the backend data directory lock (lib/backend-data-dir.js) first, so it
// refuses while a backend runs on that directory, and a backend cannot start until it
// finishes. It never replaces an existing owner, so running it again changes nothing.
// The owner's SLAuth subject is what GET /api/whoami returns to them on the deployment.
// Micros steps: .agents/skills/vpk-deploy/references/guide-deployment.md.

const fs = require("node:fs");
const path = require("node:path");

const { acquireBackendDataDirLock } = require("../lib/backend-data-dir");
const { LOCAL_CALLER_OWNER, readSlauthSubject } = require("../lib/caller-identity");
const { isStorageId } = require("../lib/input-schemas");
const { getRovoAppThreadsRootDir } = require("../lib/rovo-app-storage-paths");
const { RETENTION_LIMIT, createRovoAppThreadManager } = require("../lib/rovo-app-threads");

const USAGE = `Usage: node backend/scripts/backfill-rovo-thread-owner.js --owner <slauth-subject> --data-dir <dir> [--dry-run | --apply]

Sets <slauth-subject> as the owner of every Rovo thread in <dir> that has no owner.
  --owner      the SLAuth subject (X-Slauth-Subject) to assign; GET /api/whoami shows yours
  --data-dir   the backend data directory (backend/data, or VPK_BACKEND_DATA_DIR)
  --dry-run    print the counts and write nothing (default)
  --apply      write; refuses while a backend holds the data directory lock`;

class UsageError extends Error {}

/**
 * @param {string[]} argv - arguments after the script path
 * @returns {{ help: true } | { help: false, owner: string, dataDir: string, apply: boolean }}
 */
function parseArgs(argv) {
	/** @type {{ owner?: string, dataDir?: string, apply?: boolean, dryRun?: boolean }} */
	const options = {};
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		const [flag, inline] = arg.startsWith("--") && arg.includes("=") ? [arg.slice(0, arg.indexOf("=")), arg.slice(arg.indexOf("=") + 1)] : [arg, undefined];
		const takeValue = () => {
			const value = inline ?? argv[++index];
			if (value === undefined || (inline === undefined && value.startsWith("--"))) {
				throw new UsageError(`${flag} needs a value`);
			}
			return value;
		};
		switch (flag) {
			// pnpm run passes its `--` separator through to the script.
			case "--":
				break;
			case "-h":
			case "--help":
				return { help: true };
			case "--owner":
				options.owner = takeValue();
				break;
			case "--data-dir":
				options.dataDir = takeValue();
				break;
			case "--apply":
				options.apply = true;
				break;
			case "--dry-run":
				options.dryRun = true;
				break;
			default:
				throw new UsageError(`Unknown argument: ${arg}`);
		}
	}
	if (options.apply && options.dryRun) {
		throw new UsageError("Pass --dry-run or --apply, not both");
	}
	if (options.owner === undefined) {
		throw new UsageError("--owner <slauth-subject> is required");
	}
	// Store exactly what the backend reads from X-Slauth-Subject, or no caller could match it.
	const owner = readSlauthSubject({ "x-slauth-subject": options.owner });
	if (!owner) {
		throw new UsageError("--owner must be a non-empty SLAuth subject of at most 256 characters, without control characters");
	}
	if (owner === LOCAL_CALLER_OWNER) {
		throw new UsageError(`--owner "${LOCAL_CALLER_OWNER}" is the local owner, not an SLAuth subject; local callers already see ownerless threads`);
	}
	if (!options.dataDir?.trim()) {
		throw new UsageError("--data-dir <dir> is required");
	}
	return { help: false, owner, dataDir: path.resolve(options.dataDir), apply: Boolean(options.apply) };
}

/**
 * @typedef {{
 *   threads: number,
 *   ownerless: number,
 *   alreadyOwner: number,
 *   otherOwners: number,
 *   unreadable: number,
 *   assigned: number,
 *   skipped: number,
 * }} BackfillCounts
 */

/**
 * @param {{
 *   owner: string,
 *   dataDir: string,
 *   apply?: boolean,
 *   log?: (line: string) => void,
 *   acquireLock?: typeof acquireBackendDataDirLock,
 * }} options
 * @returns {Promise<BackfillCounts>}
 */
async function runBackfill({ owner, dataDir, apply = false, log = (line) => console.log(line), acquireLock = acquireBackendDataDirLock }) {
	if (!fs.existsSync(dataDir) || !fs.statSync(dataDir).isDirectory()) {
		throw new Error(`Data directory ${dataDir} does not exist`);
	}

	// Taken before reading, so the counts --apply reports are the ones it acts on.
	const lock = apply
		? acquireLock({ dataDir, onExit: () => {}, log })
		: null;
	try {
		const threadManager = createRovoAppThreadManager({ baseDir: dataDir, logger: console });
		const threadsRootDir = getRovoAppThreadsRootDir(dataDir);
		const storedIds = fs.existsSync(threadsRootDir)
			? fs.readdirSync(threadsRootDir).filter(isStorageId)
			: [];
		// The backend's own reader: a record it cannot read is not a thread to it either.
		const threads = await threadManager.listThreads({ limit: Number.MAX_SAFE_INTEGER });
		const ownerless = threads.filter((thread) => !thread.owner);
		/** @type {BackfillCounts} */
		const counts = {
			threads: threads.length,
			ownerless: ownerless.length,
			alreadyOwner: threads.filter((thread) => thread.owner === owner).length,
			otherOwners: threads.filter((thread) => thread.owner && thread.owner !== owner).length,
			unreadable: storedIds.length - threads.length,
			assigned: 0,
			skipped: 0,
		};

		if (apply) {
			for (const thread of ownerless) {
				const result = await threadManager.assignOwnerIfMissing(String(thread.id), owner);
				if (result.status === "assigned") counts.assigned += 1;
				else counts.skipped += 1;
			}
		}

		log(`Rovo thread owner backfill (${apply ? "apply" : "dry run"}) in ${dataDir}`);
		log(`  threads:                ${counts.threads}`);
		log(`  without an owner:       ${counts.ownerless}${apply ? "" : ` (would be assigned to ${owner})`}`);
		log(`  already the owner's:   ${counts.alreadyOwner}`);
		log(`  owned by someone else:  ${counts.otherOwners} (left as they are)`);
		if (counts.unreadable > 0) {
			log(`  unreadable records:     ${counts.unreadable} (left as they are)`);
		}
		if (apply) {
			log(`  assigned:               ${counts.assigned}`);
			if (counts.skipped > 0) log(`  skipped (owned or gone): ${counts.skipped}`);
		}
		const ownedAfter = counts.alreadyOwner + counts.ownerless;
		if (ownedAfter > RETENTION_LIMIT) {
			log(
				`Warning: ${owner} will own ${ownedAfter} threads. The backend keeps each owner's ${RETENTION_LIMIT} newest, ` +
					`so their next new thread deletes the oldest ${ownedAfter - RETENTION_LIMIT} (lib/rovo-app-threads.js).`,
			);
		}
		if (!apply) {
			log(counts.ownerless > 0 ? "Nothing written. Run again with --apply to assign them." : "Nothing to assign.");
		}
		return counts;
	} finally {
		lock?.release();
	}
}

/**
 * @param {string[]} argv
 * @param {{ log?: (line: string) => void, error?: (line: string) => void }} [io]
 * @returns {Promise<number>} exit code
 */
async function main(argv, { log = (line) => console.log(line), error = (line) => console.error(line) } = {}) {
	let parsed;
	try {
		parsed = parseArgs(argv);
	} catch (problem) {
		if (problem instanceof UsageError) {
			error(`${problem.message}\n\n${USAGE}`);
			return 2;
		}
		throw problem;
	}
	if (parsed.help) {
		log(USAGE);
		return 0;
	}
	try {
		await runBackfill({ owner: parsed.owner, dataDir: parsed.dataDir, apply: parsed.apply, log });
		return 0;
	} catch (problem) {
		error(problem instanceof Error ? problem.message : String(problem));
		return 1;
	}
}

if (require.main === module) {
	main(process.argv.slice(2)).then((code) => {
		process.exitCode = code;
	});
}

module.exports = {
	USAGE,
	main,
	parseArgs,
	runBackfill,
};
