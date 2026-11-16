"use strict";

// Auto-stop for the dev-stack budget (scripts/lib/dev-stack-budget.js). When starting would go
// over the stack count, `pnpm run dev:tmux:start` first stops the fewest idle stacks that gets it
// back under budget, then starts. A stack is safe to stop only when all of these hold:
//   - it is a linked worktree that `git worktree list` names for this repo (never another repo's
//     server, and never the primary checkout, which holds the owner's work);
//   - it is not a Codex worktree;
//   - it is not the worktree being started;
//   - nothing shows it in use: no agent or tool process with its cwd there, no attached tmux
//     client, and no recent dev log, stack record or git index write (dev-stack-activity.js).
//
// Order: stacks with no recorded activity first, then the longest idle (oldest newest activity),
// then by path, so the same machine state always stops the same stacks.
//
// Each stop re-checks activity first, then runs the target worktree's own stop through the same
// path `pnpm ports kill` uses (scripts/lib/worktree-stop.js), naming this start as the requester
// so the target's guard can still refuse and its dev-stops.log records who stopped it. If the safe
// stacks cannot get the start under budget, nothing is stopped and the refusal lists every stack.

const path = require("node:path");

const { assessActivity } = require("./dev-stack-activity.js");
const { listTmuxSessions, realPath, stackLabels } = require("./dev-stack-budget.js");

function describeIdle(lastActivityMs, now) {
	if (lastActivityMs === null || lastActivityMs === undefined) return "no recorded activity";
	const minutes = Math.max(0, Math.round((now - lastActivityMs) / 60_000));
	return `last activity ${minutes < 120 ? `${minutes}m` : `${Math.round(minutes / 60)}h`} ago`;
}

function isSafeToStop(stack, ownRoot) {
	return stack.linkedWorktree && !stack.external && !stack.codex && !stack.inUse && stack.worktree !== ownRoot;
}

function idlestFirst(left, right) {
	const leftMs = left.lastActivityMs ?? Number.NEGATIVE_INFINITY;
	const rightMs = right.lastActivityMs ?? Number.NEGATIVE_INFINITY;
	if (leftMs !== rightMs) return leftMs - rightMs;
	return left.worktree < right.worktree ? -1 : left.worktree > right.worktree ? 1 : 0;
}

/**
 * Which stacks to stop for an over-budget verdict: { needed, candidates } where candidates are the
 * safe stacks in stop order, or null when auto-stop cannot clear the refusal (memory pressure with
 * other stacks still running after the stops, or fewer safe stacks than needed).
 */
function planAutoStop(verdict, { worktree }) {
	const ownRoot = realPath(worktree);
	const needed = verdict.overBy ?? 0;
	const candidates = verdict.otherStacks.filter((stack) => isSafeToStop(stack, ownRoot)).sort(idlestFirst);
	const pressureRemains = (verdict.pressure ?? []).length > 0 && verdict.otherStacks.length - needed > 0;
	const enough = needed > 0 && !pressureRemains && candidates.length >= needed;
	return { needed, candidates, enough };
}

// Fresh evidence that a stack is in use, read just before stopping it, or null.
function defaultRecheck(stack, { env }) {
	const activity = assessActivity({ worktreePath: stack.worktree });
	if (activity.inUse) return activity.evidence;
	const attached = listTmuxSessions(env).find((session) => session.attached && realPath(session.path) === stack.worktree);
	return attached ? `a tmux client is attached to ${attached.name}` : null;
}

function defaultStop(stack, { ownRoot }) {
	const { stopWorktree } = require("./worktree-stop.js");
	return stopWorktree(
		{ path: stack.worktree },
		{
			quiet: true,
			requester: { VPK_DEV_STOP_BY: `auto-stopped by dev:tmux:start from ${ownRoot}`, VPK_DEV_STOP_FROM: ownRoot },
		},
	);
}

/**
 * Stop the planned stacks until the start fits, then re-evaluate the budget without them.
 * Returns the new verdict with `autoStop: { needed, safe, stopped }` attached.
 */
function autoStopOverBudget(verdict, {
	evaluate,
	inventory,
	worktree,
	env = process.env,
	log = (line) => process.stderr.write(`${line}\n`),
	now = Date.now(),
	recheck = (stack) => defaultRecheck(stack, { env }),
	stop = (stack) => defaultStop(stack, { ownRoot: realPath(worktree) }),
}) {
	const plan = planAutoStop(verdict, { worktree });
	const summary = { needed: plan.needed, safe: plan.candidates.length, stopped: 0 };
	if (!plan.enough) return { ...verdict, autoStop: summary };

	const labels = new Map(stackLabels(verdict.otherStacks.map((stack) => stack.worktree)).map((label, index) => [verdict.otherStacks[index].worktree, label]));
	const stopped = [];
	for (const stack of plan.candidates) {
		if (stopped.length >= plan.needed) break;
		const label = labels.get(stack.worktree) ?? path.basename(stack.worktree);
		const evidence = recheck(stack);
		if (evidence) {
			log(`[dev:tmux] Not auto-stopping ${label} (${stack.worktree}): in use now (${evidence}).`);
			continue;
		}
		const status = stop(stack);
		if (status !== 0) {
			log(`[dev:tmux] Could not auto-stop ${label} (${stack.worktree}): its stop exited ${status}.`);
			continue;
		}
		stopped.push(stack);
		log(`[dev:tmux] Auto-stopped ${label} (${stack.worktree}): a linked worktree of this repo with no agent, tool or attached tmux client, ${describeIdle(stack.lastActivityMs, now)}.`);
	}

	const stoppedPids = new Set(stopped.flatMap((stack) => stack.servers.map((server) => server.pid)));
	const next = evaluate({ ...inventory, servers: inventory.servers.filter((server) => !stoppedPids.has(server.pid)) });
	return { ...next, autoStop: { ...summary, stopped: stopped.length } };
}

module.exports = { autoStopOverBudget, idlestFirst, isSafeToStop, planAutoStop };
