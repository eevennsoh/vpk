#!/usr/bin/env node

// Turns `claude -p --output-format stream-json --verbose` on stdin into a quiet
// status on stdout, while keeping the full trail and the report.
//
//   claude -p ... --output-format stream-json --verbose \
//     | node scripts/agent-stream-format.js --events <file> --report <file> [--cwd <dir>] [--feed]
//
//   --events  every JSON event, one per line (truncated at start, appended live)
//   --report  the final `result` text of a successful run (emptied at start, then
//             replaced atomically via a temp file + rename once the result arrives)
//   --cwd     base for relative paths in the feed; defaults to the session's cwd
//   --feed    print one timestamped line per step instead of the status (debugging)
//
// The default status is `working · <model> · started HH:MM`, then, on a TTY only, one
// line rewritten in place at most once per second, then `done · …` or `failed · …`.
//
// Exits 0 only for a successful `result` with text and both files written. An error
// result, a result without text, a stream without a result (including empty input),
// an event the formatter could not handle, or a failed write ends in `failed` (an
// `error` line under --feed) and exits 1, so `set -o pipefail` fails the pipeline
// even when claude exited 0. Bad arguments exit 2 after draining stdin.

const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");

const DEFAULT_WIDTH = 120;
const KIND_WIDTH = 6;
const STATUS_INTERVAL_MS = 1000;

function parseArgs(argv) {
	const options = {};
	for (let index = 0; index < argv.length; index += 1) {
		const flag = argv[index];
		if (flag === "--feed") {
			options.feed = true;
			continue;
		}
		const value = argv[index + 1];
		if (value === undefined) throw new Error(`${flag} needs a value`);
		index += 1;
		switch (flag) {
			case "--events": options.eventsFile = path.resolve(value); break;
			case "--report": options.reportFile = path.resolve(value); break;
			case "--cwd": options.cwd = path.resolve(value); break;
			default: throw new Error(`unknown option ${flag}`);
		}
	}
	if (!options.eventsFile) throw new Error("--events is required");
	if (!options.reportFile) throw new Error("--report is required");
	return options;
}

function oneLine(text) {
	return String(text ?? "").replace(/\s+/gu, " ").trim();
}

function firstLine(text) {
	return String(text ?? "").trim().split("\n")[0].trim();
}

function truncate(text, width) {
	return text.length > width ? `${text.slice(0, Math.max(0, width - 1))}…` : text;
}

function clock(date) {
	return date.toTimeString().slice(0, 8);
}

function elapsed(ms) {
	const total = Math.max(0, Math.round(ms / 1000));
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const seconds = total % 60;
	if (hours) return `${hours}h${String(minutes).padStart(2, "0")}m`;
	if (minutes) return `${minutes}m${String(seconds).padStart(2, "0")}s`;
	return `${seconds}s`;
}

function plural(count, noun) {
	return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function relative(filePath, cwd) {
	if (typeof filePath !== "string") return "";
	if (cwd && filePath.startsWith(`${cwd}/`)) return filePath.slice(cwd.length + 1);
	return filePath;
}

function summarizeTool(name, input = {}, cwd) {
	switch (name) {
		case "Bash": return firstLine(input.command);
		case "Read":
		case "Write":
		case "Edit":
		case "MultiEdit": return relative(input.file_path, cwd);
		case "NotebookEdit": return relative(input.notebook_path, cwd);
		case "Grep":
		case "Glob": return input.path ? `${input.pattern}  in ${relative(input.path, cwd)}` : String(input.pattern ?? "");
		case "Agent":
		case "Task": return oneLine(input.description);
		case "WebFetch": return String(input.url ?? "");
		case "WebSearch": return oneLine(input.query);
		case "Skill": return String(input.skill ?? "");
		default: {
			const value = Object.values(input).find((entry) => typeof entry === "string");
			return oneLine(value);
		}
	}
}

function toolResultText(content) {
	if (Array.isArray(content)) return content.map((part) => part?.text ?? "").join(" ");
	return String(content ?? "");
}

function resultStats(event) {
	const stats = [];
	if (typeof event.duration_ms === "number") stats.push(`${(event.duration_ms / 1000).toFixed(1)}s`);
	if (typeof event.total_cost_usd === "number") stats.push(`$${event.total_cost_usd.toFixed(4)}`);
	if (typeof event.num_turns === "number") stats.push(plural(event.num_turns, "turn"));
	return stats;
}

function isFailedResult(event) {
	return event.is_error === true || (event.subtype !== undefined && event.subtype !== "success");
}

function failureReason(event) {
	return [event.terminal_reason ?? event.subtype, firstLine(event.result)].filter(Boolean).join(" · ") || "error result";
}

function doneLine(event, fallbackMs) {
	const parts = ["done", elapsed(typeof event.duration_ms === "number" ? event.duration_ms : fallbackMs)];
	if (typeof event.total_cost_usd === "number") parts.push(`$${event.total_cost_usd.toFixed(2)}`);
	if (typeof event.num_turns === "number") parts.push(plural(event.num_turns, "turn"));
	return parts.join(" · ");
}

function countToolUses(event) {
	if (event?.type !== "assistant") return 0;
	return (event.message?.content ?? []).filter((block) => block?.type === "tool_use").length;
}

// Returns [kind, text] pairs for one stream-json event; noise events return none.
function describeEvent(event, cwd) {
	switch (event?.type) {
		case "system":
			if (event.subtype === "init") {
				return [["start", [event.model, event.permissionMode, event.cwd].filter(Boolean).join(" · ")]];
			}
			return /error|retry/u.test(event.subtype ?? "") ? [["warn", String(event.subtype)]] : [];
		case "assistant":
			return (event.message?.content ?? []).flatMap((block) => {
				if (block?.type === "text" && oneLine(block.text)) return [["text", oneLine(block.text)]];
				if (block?.type === "tool_use") return [[String(block.name), summarizeTool(block.name, block.input, cwd)]];
				return [];
			});
		case "user":
			return (event.message?.content ?? [])
				.filter((block) => block?.type === "tool_result" && block.is_error === true)
				.map((block) => ["fail", oneLine(toolResultText(block.content))]);
		case "result": {
			if (!isFailedResult(event)) return [["done", resultStats(event).join(" · ")]];
			const detail = [event.terminal_reason ?? event.subtype, firstLine(event.result), ...resultStats(event)].filter(Boolean);
			return [["error", detail.join(" · ")]];
		}
		default:
			return [];
	}
}

function formatLine({ time, kind, text, nested = false, width = DEFAULT_WIDTH }) {
	const line = `${clock(time)}  ${nested ? "  " : ""}${kind.padEnd(KIND_WIDTH)} ${text}`.trimEnd();
	return truncate(line, width);
}

// Writes to a temp file beside `file`, then renames over it: readers see the old
// content or the complete new content, never a fragment.
function writeFileAtomic(file, content) {
	const temp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
	try {
		fs.writeFileSync(temp, content);
		fs.renameSync(temp, file);
	} catch (error) {
		fs.rmSync(temp, { force: true });
		throw error;
	}
}

// `status`, when given, rewrites the current terminal line in place (TTY only).
function createFormatter({ eventsFile, reportFile, cwd, feed = false, width = DEFAULT_WIDTH, now = () => new Date(), print = (line) => process.stdout.write(`${line}\n`), status = null }) {
	fs.writeFileSync(eventsFile, "");
	fs.writeFileSync(reportFile, "");
	const startedAt = now().getTime();
	let sessionCwd = cwd;
	let result = null;
	const failures = [];
	let eventsBroken = false;
	let started = false;
	let steps = 0;
	let statusShown = false;
	let statusAt = -Infinity;

	const emit = (line) => {
		if (statusShown) {
			status("");
			statusShown = false;
		}
		print(truncate(line, width));
	};

	const fail = (text) => {
		failures.push(text);
		if (feed) emit(formatLine({ time: now(), kind: "error", text, width }));
	};

	const showStatus = (event) => {
		const time = now();
		if (event?.type === "system" && event.subtype === "init" && !started) {
			started = true;
			emit(["working", event.model, `started ${clock(time).slice(0, 5)}`].filter(Boolean).join(" · "));
		}
		steps += countToolUses(event);
		// The rewritten line follows the start line, and the result's own line replaces it.
		if (!status || !started || event?.type === "result") return;
		if (time.getTime() - statusAt < STATUS_INTERVAL_MS) return;
		statusAt = time.getTime();
		status(truncate(`working · ${elapsed(statusAt - startedAt)} · ${plural(steps, "step")}`, width));
		statusShown = true;
	};

	const handle = (event, trimmed) => {
		if (!eventsBroken) {
			try {
				fs.appendFileSync(eventsFile, `${trimmed}\n`);
			} catch (error) {
				// Stop appending: a gap would make events.jsonl look complete.
				eventsBroken = true;
				fail(`events.jsonl write failed: ${error.message}`);
			}
		}
		if (event?.type === "system" && event.subtype === "init" && !sessionCwd) sessionCwd = event.cwd;
		// Described in both modes, so an event the feed could not show fails a quiet run too.
		const lines = describeEvent(event, sessionCwd);
		if (feed) {
			const nested = Boolean(event?.parent_tool_use_id);
			for (const [kind, text] of lines) emit(formatLine({ time: now(), kind, text, nested, width }));
		} else {
			showStatus(event);
		}
		if (event?.type !== "result") return;
		result = event;
		if (isFailedResult(event)) {
			// The latest result decides the report; an earlier one must not survive it.
			fs.writeFileSync(reportFile, "");
			return;
		}
		if (typeof event.result !== "string") {
			fs.writeFileSync(reportFile, "");
			fail("result event has no result text");
			return;
		}
		try {
			writeFileAtomic(reportFile, event.result.endsWith("\n") ? event.result : `${event.result}\n`);
		} catch (error) {
			fail(`report.md write failed: ${error.message}`);
		}
	};

	return {
		line(raw) {
			const trimmed = raw.trim();
			if (!trimmed) return;
			let event;
			try {
				event = JSON.parse(trimmed);
			} catch {
				// Partial or non-JSON output: show it in the feed, but keep events.jsonl parseable.
				if (feed) emit(formatLine({ time: now(), kind: "?", text: oneLine(trimmed), width }));
				return;
			}
			// An unexpected event shape must not stop the reader (claude would die of
			// SIGPIPE), but the run can no longer be trusted, so it fails at the end.
			try {
				handle(event, trimmed);
			} catch (error) {
				fail(`could not handle ${String(event?.type)} event: ${error.message}`);
			}
		},
		// Returns the process exit code.
		end() {
			if (!result) fail("stream ended without a result event");
			const reasons = result && isFailedResult(result) ? [failureReason(result), ...failures] : failures;
			if (!feed) emit(reasons.length ? `failed · ${reasons.join("; ")}` : doneLine(result, now().getTime() - startedAt));
			return reasons.length ? 1 : 0;
		},
	};
}

function main() {
	let formatter;
	try {
		const options = parseArgs(process.argv.slice(2));
		const status = process.stdout.isTTY ? (text) => process.stdout.write(`\r\x1b[2K${text}`) : null;
		formatter = createFormatter({ ...options, status, width: process.stdout.columns || DEFAULT_WIDTH });
	} catch (error) {
		console.error(`agent-stream-format: ${error.message}`);
		// Drain stdin so the upstream writer is not killed by SIGPIPE mid-run.
		process.exitCode = 2;
		process.stdin.resume();
		return;
	}
	const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
	input.on("line", (raw) => formatter.line(raw));
	input.on("close", () => {
		process.exitCode = formatter.end();
	});
}

if (require.main === module) main();

module.exports = {
	createFormatter,
	describeEvent,
	formatLine,
	parseArgs,
	summarizeTool,
	writeFileAtomic,
};
