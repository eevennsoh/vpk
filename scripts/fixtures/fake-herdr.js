#!/usr/bin/env node

// A stateful stand-in for the herdr CLI, for agent-surface tests that run real pane
// runners. State lives in $FAKE_HERDR_DIR: config.json (read), and calls.jsonl,
// reports.jsonl and panes.jsonl (append-only, so concurrent calls never lose a write).
// Like herdr, a pane's state is its highest-seq report. `pane run` really starts the
// command, detached, with HERDR_PANE_ID set, so the runner's own herdr calls come back
// here. Tabs get panes <workspace>:p100, p101, … in creation order.
//
// config.json: { workspace, rootPane, alreadyOpen, rootHeld,
//                delayMs: { "<group> <verb>" or "<caller pane> <group> <verb>": ms },
//                hang: ["<group> <verb>", …] }
//
// A delayed call answers from the state when it was called, as a slow herdr would: the
// caller then acts on a stale answer. A hung call never answers (for HANG_MS).

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const dir = process.env.FAKE_HERDR_DIR;
const config = JSON.parse(fs.readFileSync(path.join(dir, "config.json"), "utf8"));
const [group, verb, ...rest] = process.argv.slice(2);
const key = `${group} ${verb}`;
const caller = process.env.HERDR_PANE_ID ?? null;
const flag = (name) => rest[rest.indexOf(name) + 1];

const readLines = (file) => (fs.existsSync(path.join(dir, file)) ? fs.readFileSync(path.join(dir, file), "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line)) : []);
const append = (file, record) => fs.appendFileSync(path.join(dir, file), `${JSON.stringify(record)}\n`);
const closed = (pane) => readLines("panes.jsonl").some((event) => event.pane === pane && event.event === "close");
const latest = (pane) => readLines("reports.jsonl").filter((report) => report.pane === pane).sort((a, b) => a.seq - b.seq).at(-1) ?? null;
const HANG_MS = 10_000;
const ok = (result) => ({ code: 0, stdout: result === undefined ? "" : JSON.stringify({ result }) });
const fail = (message) => ({ code: 1, stderr: `${message}\n` });

function handle() {
	const workspace = config.workspace;
	switch (key) {
		case "worktree open":
			return ok({ already_open: config.alreadyOpen, workspace: { workspace_id: workspace }, root_pane: { pane_id: config.rootPane, tab_id: `${workspace}:t1`, workspace_id: workspace } });
		case "tab list":
			return ok({ tabs: [] });
		case "tab create": {
			const pane = `${workspace}:p${100 + readLines("panes.jsonl").filter((event) => event.event === "open").length}`;
			append("panes.jsonl", { pane, event: "open" });
			return ok({ root_pane: { pane_id: pane, tab_id: `${workspace}:t-${pane}`, workspace_id: workspace } });
		}
		case "pane get": {
			const pane = rest[0];
			if (closed(pane)) return fail(`{"error":{"code":"pane_not_found"}}`);
			return ok({ pane: { pane_id: pane, workspace_id: workspace, agent: latest(pane) ? "vpk-worker" : undefined } });
		}
		case "pane process-info":
			return ok({ process_info: { foreground_processes: config.rootHeld ? [{ argv: ["bash", "/o/run.sh.pane.sh"] }] : [{ argv: ["-zsh"] }] } });
		case "pane list": {
			const panes = [config.rootPane, ...readLines("panes.jsonl").filter((event) => event.event === "open").map((event) => event.pane)]
				.filter((pane) => !closed(pane))
				.map((pane) => ({ pane_id: pane, workspace_id: workspace, agent: latest(pane) ? "vpk-worker" : undefined, agent_status: latest(pane)?.state }));
			return ok({ panes });
		}
		case "pane report-agent":
			append("reports.jsonl", { pane: rest[0], state: flag("--state"), message: rest.includes("--message") ? flag("--message") : null, seq: Number(flag("--seq")) });
			return ok({});
		case "pane run": {
			const [pane, command] = rest;
			spawn("bash", ["-c", command], { detached: true, stdio: "ignore", env: { ...process.env, HERDR_PANE_ID: pane } }).unref();
			return ok();
		}
		case "pane close":
			append("panes.jsonl", { pane: rest[0], event: "close" });
			return ok({});
		default:
			return ok({});
	}
}

append("calls.jsonl", { caller, key, args: rest, at: Date.now() });
if ((config.hang ?? []).includes(key)) {
	setTimeout(() => {}, HANG_MS);
} else {
	const { code, stdout = "", stderr = "" } = handle();
	setTimeout(() => {
		process.stdout.write(stdout);
		process.stderr.write(stderr);
		process.exitCode = code;
	}, config.delayMs?.[`${caller} ${key}`] ?? config.delayMs?.[key] ?? 0);
}
