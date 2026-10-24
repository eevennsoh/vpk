#!/usr/bin/env node

// Turns `claude -p --output-format stream-json --verbose` on stdin into a live,
// one-line-per-step feed on stdout, while keeping the full trail and the report.
//
//   claude -p ... --output-format stream-json --verbose \
//     | node scripts/agent-stream-format.js --events <file> --report <file> [--cwd <dir>]
//
//   --events  every JSON event, one per line (truncated at start, appended live)
//   --report  the final `result` text of a successful run (emptied at start, then
//             replaced atomically via a temp file + rename once the result arrives)
//   --cwd     base for relative paths in the feed; defaults to the session's cwd
//
// Exits 0 only for a successful `result` with both files written. An error result,
// a stream without a result (including empty input), or a failed write prints an
// `error` line and exits 1, so `set -o pipefail` fails the pipeline even when claude
// exited 0. Bad arguments exit 2 after draining stdin.

const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");

const DEFAULT_WIDTH = 120;
const KIND_WIDTH = 6;

function parseArgs(argv) {
	const options = {};
	for (let index = 0; index < argv.length; index += 1) {
		const flag = argv[index];
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
	if (typeof event.num_turns === "number") stats.push(`${event.num_turns} turn${event.num_turns === 1 ? "" : "s"}`);
	return stats;
}

function isFailedResult(event) {
	return event.is_error === true || (event.subtype !== undefined && event.subtype !== "success");
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
			const reason = event.terminal_reason ?? event.subtype;
			const detail = [reason, firstLine(event.result), ...resultStats(event)].filter(Boolean);
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

function createFormatter({ eventsFile, reportFile, cwd, width = DEFAULT_WIDTH, now = () => new Date(), print = (line) => process.stdout.write(`${line}\n`) }) {
	fs.writeFileSync(eventsFile, "");
	fs.writeFileSync(reportFile, "");
	let sessionCwd = cwd;
	let result = null;
	let failed = false;
	let eventsBroken = false;

	const fail = (text) => {
		failed = true;
		print(formatLine({ time: now(), kind: "error", text, width }));
	};

	return {
		line(raw) {
			const trimmed = raw.trim();
			if (!trimmed) return;
			let event;
			try {
				event = JSON.parse(trimmed);
			} catch {
				// Partial or non-JSON output: show it, but keep events.jsonl parseable.
				print(formatLine({ time: now(), kind: "?", text: oneLine(trimmed), width }));
				return;
			}
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
			const nested = Boolean(event?.parent_tool_use_id);
			for (const [kind, text] of describeEvent(event, sessionCwd)) {
				print(formatLine({ time: now(), kind, text, nested, width }));
			}
			if (event?.type === "result") {
				result = event;
				if (!isFailedResult(event) && typeof event.result === "string") {
					try {
						writeFileAtomic(reportFile, event.result.endsWith("\n") ? event.result : `${event.result}\n`);
					} catch (error) {
						fail(`report.md write failed: ${error.message}`);
					}
				}
			}
		},
		// Returns the process exit code.
		end() {
			if (!result) fail("stream ended without a result event");
			return failed || isFailedResult(result) ? 1 : 0;
		},
	};
}

function main() {
	let formatter;
	try {
		const options = parseArgs(process.argv.slice(2));
		formatter = createFormatter({ ...options, width: process.stdout.columns || DEFAULT_WIDTH });
	} catch (error) {
		console.error(`agent-stream-format: ${error.message}`);
		// Drain stdin so the upstream writer is not killed by SIGPIPE mid-run.
		process.exitCode = 2;
		process.stdin.resume();
		return;
	}
	const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
	input.on("line", (raw) => {
		// An unexpected event shape must not stop the reader: claude would die of SIGPIPE.
		try {
			formatter.line(raw);
		} catch (error) {
			console.error(`agent-stream-format: ${error.message}`);
		}
	});
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
};
