const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createFormatter, parseArgs, summarizeTool, writeFileAtomic } = require("./agent-stream-format.js");

const CWD = "/repo/wt";
const SESSION = { session_id: "4e2e29d1-0000-0000-0000-000000000000" };

// Trimmed from a real `claude -p --output-format stream-json --verbose` run through
// the gateway (2.1.309); ids shortened, large fields such as tool lists dropped.
const SUCCESS_EVENTS = [
	{ type: "system", subtype: "hook_started", hook_name: "SessionStart:startup", ...SESSION },
	{ type: "system", subtype: "init", cwd: CWD, model: "claude-haiku-5-5", permissionMode: "bypassPermissions", tools: ["Bash", "Read"], ...SESSION },
	{ type: "system", subtype: "per_turn_effort_changed", per_turn_effort_active: false, ...SESSION },
	{ type: "assistant", message: { model: "claude-haiku-5-5", role: "assistant", content: [{ type: "thinking", thinking: "", signature: "redacted" }] }, parent_tool_use_id: null, ...SESSION },
	{ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "Hi!\nLet me look\naround." }] }, parent_tool_use_id: null, ...SESSION },
	{ type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", id: "toolu_1", name: "Bash", input: { command: "pnpm run typecheck\necho second", description: "Typecheck" } }] }, parent_tool_use_id: null, ...SESSION },
	{ type: "user", message: { role: "user", content: [{ tool_use_id: "toolu_1", type: "tool_result", content: "ok", is_error: false }] }, parent_tool_use_id: null, tool_use_result: { stdout: "ok", stderr: "" }, ...SESSION },
	{ type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", id: "toolu_2", name: "Read", input: { file_path: `${CWD}/components/visual/x/index.tsx` } }] }, parent_tool_use_id: null, ...SESSION },
	{ type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", id: "toolu_3", name: "Edit", input: { file_path: "/tmp/elsewhere/SKILL.md", old_string: "a", new_string: "b" } }] }, parent_tool_use_id: null, ...SESSION },
	{ type: "user", message: { role: "user", content: [{ tool_use_id: "toolu_3", type: "tool_result", content: "<tool_use_error>String to replace not found\nin file</tool_use_error>", is_error: true }] }, parent_tool_use_id: null, ...SESSION },
	{ type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", id: "toolu_4", name: "Agent", input: { description: "Find owners", prompt: "long prompt" } }] }, parent_tool_use_id: null, ...SESSION },
	{ type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", id: "toolu_5", name: "Grep", input: { pattern: "useFoo", path: `${CWD}/hooks` } }] }, parent_tool_use_id: "toolu_4", ...SESSION },
	{ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "Hi! I ran `echo ok` and it printed `ok`." }] }, parent_tool_use_id: null, ...SESSION },
	{ type: "result", subtype: "success", is_error: false, terminal_reason: "completed", duration_ms: 6769, num_turns: 2, total_cost_usd: 0.008406275, result: "Hi! I ran `echo ok` and it printed `ok`.", ...SESSION },
];

// Shape of a real invalid-model run: a synthetic assistant message, then an error result.
const ERROR_EVENTS = [
	{ type: "system", subtype: "init", cwd: CWD, model: "claude-nope-1", permissionMode: "plan", ...SESSION },
	{ type: "assistant", message: { model: "<synthetic>", role: "assistant", content: [{ type: "text", text: "API Error: 400 Model Id [claude-nope-1] not found" }] }, parent_tool_use_id: null, ...SESSION },
	{ type: "result", subtype: "success", is_error: true, terminal_reason: "api_error", api_error_status: 400, duration_ms: 0, num_turns: 1, total_cost_usd: 0, result: "API Error: 400 Model Id [claude-nope-1] not found", ...SESSION },
];

function tempFiles() {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-stream-format-"));
	return { dir, eventsFile: path.join(dir, "events.jsonl"), reportFile: path.join(dir, "report.md") };
}

function format(lines, options = {}) {
	const files = tempFiles();
	const printed = [];
	const formatter = createFormatter({
		...files,
		width: 200,
		now: () => new Date(2026, 9, 24, 12, 7, 31),
		print: (line) => printed.push(line),
		...options,
	});
	for (const line of lines) formatter.line(line);
	const exitCode = formatter.end();
	return { ...files, printed, exitCode };
}

const asLines = (events) => events.map((event) => JSON.stringify(event));

test("a successful run prints one line per step and writes the report from the result", () => {
	const { printed, eventsFile, reportFile, exitCode } = format(asLines(SUCCESS_EVENTS));
	assert.equal(exitCode, 0);
	assert.deepEqual(printed, [
		`12:07:31  start  claude-haiku-5-5 · bypassPermissions · ${CWD}`,
		"12:07:31  text   Hi! Let me look around.",
		"12:07:31  Bash   pnpm run typecheck",
		"12:07:31  Read   components/visual/x/index.tsx",
		"12:07:31  Edit   /tmp/elsewhere/SKILL.md",
		"12:07:31  fail   <tool_use_error>String to replace not found in file</tool_use_error>",
		"12:07:31  Agent  Find owners",
		"12:07:31    Grep   useFoo  in hooks",
		"12:07:31  text   Hi! I ran `echo ok` and it printed `ok`.",
		"12:07:31  done   6.8s · $0.0084 · 2 turns",
	]);
	assert.equal(fs.readFileSync(reportFile, "utf8"), "Hi! I ran `echo ok` and it printed `ok`.\n");
	const saved = fs.readFileSync(eventsFile, "utf8").trim().split("\n").map((line) => JSON.parse(line));
	assert.deepEqual(saved, SUCCESS_EVENTS);
});

test("an error result prints an error line, leaves the report empty, and fails", () => {
	const { printed, reportFile, exitCode } = format(asLines(ERROR_EVENTS));
	assert.equal(exitCode, 1);
	assert.equal(printed.at(-1), "12:07:31  error  api_error · API Error: 400 Model Id [claude-nope-1] not found · 0.0s · $0.0000 · 1 turn");
	assert.equal(printed.length, 3);
	assert.equal(fs.readFileSync(reportFile, "utf8"), "");
});

test("malformed and partial lines are shown but never crash or reach events.jsonl", () => {
	const lines = asLines(SUCCESS_EVENTS.slice(0, 2));
	const { printed, eventsFile, exitCode } = format(["", "not json at all", '{"type":"assistant","mess', ...lines, "null", "[]"]);
	assert.equal(printed[0], "12:07:31  ?      not json at all");
	assert.equal(printed[1], '12:07:31  ?      {"type":"assistant","mess');
	assert.equal(fs.readFileSync(eventsFile, "utf8").trim().split("\n").length, 4);
	// No result event: the feed says so, because an empty report is otherwise silent.
	assert.equal(printed.at(-1), "12:07:31  error  stream ended without a result event");
	assert.equal(exitCode, 1);
});

test("empty input fails with an error line", () => {
	const { printed, exitCode } = format([]);
	assert.deepEqual(printed, ["12:07:31  error  stream ended without a result event"]);
	assert.equal(exitCode, 1);
});

test("a failed events.jsonl write fails the run but still writes the report", () => {
	const { eventsFile, reportFile } = tempFiles();
	const printed = [];
	const formatter = createFormatter({ eventsFile, reportFile, width: 200, print: (line) => printed.push(line) });
	// A directory cannot be appended to, the same way a full disk refuses the write.
	fs.rmSync(eventsFile);
	fs.mkdirSync(eventsFile);
	for (const line of asLines(SUCCESS_EVENTS)) formatter.line(line);
	assert.equal(formatter.end(), 1);
	assert.equal(printed.filter((line) => line.includes("events.jsonl write failed")).length, 1);
	assert.equal(fs.readFileSync(reportFile, "utf8"), "Hi! I ran `echo ok` and it printed `ok`.\n");
});

// Every write fails after the target exists with half its content, as on a full disk.
function failWritesMidway(t) {
	const write = fs.writeFileSync;
	t.mock.method(fs, "writeFileSync", (file, content) => {
		write(file, String(content).slice(0, Math.floor(String(content).length / 2)));
		throw Object.assign(new Error("ENOSPC: no space left on device, write"), { code: "ENOSPC" });
	});
}

function failRenames(t) {
	t.mock.method(fs, "renameSync", () => {
		throw Object.assign(new Error("EXDEV: cross-device link not permitted, rename"), { code: "EXDEV" });
	});
}

for (const [name, inject] of [["a write that fails after creating the temp file", failWritesMidway], ["a failed rename", failRenames]]) {
	test(`writeFileAtomic: ${name} keeps the old report and removes the temp file`, (t) => {
		const { dir, reportFile } = tempFiles();
		fs.writeFileSync(reportFile, "old report\n");
		inject(t);
		assert.throws(() => writeFileAtomic(reportFile, "new report, long enough to cut in half\n"), /ENOSPC|EXDEV/u);
		t.mock.restoreAll();
		assert.equal(fs.readFileSync(reportFile, "utf8"), "old report\n");
		assert.deepEqual(fs.readdirSync(dir), ["report.md"]);
	});

	test(`writeFileAtomic: ${name} leaves an absent report absent`, (t) => {
		const { dir, reportFile } = tempFiles();
		inject(t);
		assert.throws(() => writeFileAtomic(reportFile, "new report, long enough to cut in half\n"), /ENOSPC|EXDEV/u);
		t.mock.restoreAll();
		assert.deepEqual(fs.readdirSync(dir), []);
	});
}

test("a report that cannot be published fails the run and leaves report.md empty", (t) => {
	const { dir, reportFile } = tempFiles();
	const lines = asLines(SUCCESS_EVENTS);
	const printed = [];
	const formatter = createFormatter({ eventsFile: path.join(dir, "events.jsonl"), reportFile, width: 200, print: (line) => printed.push(line) });
	for (const line of lines.slice(0, -1)) formatter.line(line);
	failRenames(t);
	formatter.line(lines.at(-1));
	t.mock.restoreAll();
	assert.equal(formatter.end(), 1);
	assert.ok(printed.some((line) => line.includes("report.md write failed: EXDEV")));
	assert.equal(fs.readFileSync(reportFile, "utf8"), "");
	assert.deepEqual(fs.readdirSync(dir).sort(), ["events.jsonl", "report.md"]);
});

test("an event the formatter cannot handle fails the run but keeps reading", () => {
	const bad = { type: "assistant", message: { role: "assistant", content: "plain string, not blocks" }, ...SESSION };
	const { printed, reportFile, exitCode } = format(asLines([bad, SUCCESS_EVENTS.at(-1)]));
	assert.equal(exitCode, 1);
	assert.match(printed[0], /^12:07:31 {2}error {2}could not handle assistant event: /u);
	// Later events are still shown and the report is still written.
	assert.equal(printed.at(-1), "12:07:31  done   6.8s · $0.0084 · 2 turns");
	assert.equal(fs.readFileSync(reportFile, "utf8"), "Hi! I ran `echo ok` and it printed `ok`.\n");
});

for (const [name, value] of [["missing", undefined], ["non-string", 42]]) {
	test(`a success result with ${name} result text fails and leaves no report`, () => {
		const { result: _, ...rest } = SUCCESS_EVENTS.at(-1);
		const malformed = value === undefined ? rest : { ...rest, result: value };
		// A good result first: the malformed one that follows must not leave it standing.
		const { printed, reportFile, exitCode } = format(asLines([SUCCESS_EVENTS.at(-1), malformed]));
		assert.equal(exitCode, 1);
		assert.equal(printed.at(-1), "12:07:31  error  result event has no result text");
		assert.equal(fs.readFileSync(reportFile, "utf8"), "");
	});
}

test("a successful report leaves no temp file behind", () => {
	const { dir } = format(asLines(SUCCESS_EVENTS));
	assert.deepEqual(fs.readdirSync(dir).sort(), ["events.jsonl", "report.md"]);
});

test("lines are truncated to the terminal width", () => {
	const longCommand = { ...SUCCESS_EVENTS[5], message: { content: [{ type: "tool_use", name: "Bash", input: { command: "x".repeat(200) } }] } };
	const { printed } = format([JSON.stringify(longCommand)], { width: 40 });
	assert.equal(printed[0].length, 40);
	assert.ok(printed[0].endsWith("…"));
});

test("tool summaries pick the key input and fall back to the first string", () => {
	assert.equal(summarizeTool("WebFetch", { url: "https://example.com", prompt: "p" }), "https://example.com");
	assert.equal(summarizeTool("Glob", { pattern: "**/*.ts" }), "**/*.ts");
	assert.equal(summarizeTool("Write", { file_path: "/r/a/b.ts", content: "x" }, "/r"), "a/b.ts");
	assert.equal(summarizeTool("mcp__x__y", { count: 3, query: "find me" }), "find me");
});

test("parseArgs requires both output files", () => {
	assert.throws(() => parseArgs(["--report", "r.md"]), /--events is required/u);
	assert.throws(() => parseArgs(["--events", "e.jsonl"]), /--report is required/u);
	assert.equal(parseArgs(["--events", "e", "--report", "r", "--cwd", "/x"]).cwd, "/x");
});

test("the CLI streams stdin to the feed and fails the pipeline under pipefail", () => {
	const { dir, eventsFile, reportFile } = tempFiles();
	const input = path.join(dir, "stream.jsonl");
	fs.writeFileSync(input, `${asLines(SUCCESS_EVENTS).join("\n")}\n`);
	const script = path.join(__dirname, "agent-stream-format.js");
	const run = (producer) => spawnSync("bash", ["-c", `set -o pipefail; ${producer} | node "$0" --events "$1" --report "$2"`, script, eventsFile, reportFile], { encoding: "utf8" });

	const ok = run(`cat '${input}'`);
	assert.equal(ok.status, 0);
	assert.match(ok.stdout, /^\d\d:\d\d:\d\d {2}Bash {3}pnpm run typecheck$/mu);
	assert.equal(fs.readFileSync(reportFile, "utf8"), "Hi! I ran `echo ok` and it printed `ok`.\n");

	const failed = run(`{ cat '${input}'; exit 7; }`);
	assert.equal(failed.status, 7);

	// claude exiting 0 is not enough: the formatter's own failures reach the wrapper.
	const empty = run("true");
	assert.equal(empty.status, 1);
	assert.match(empty.stdout, /error {2}stream ended without a result event$/mu);

	const truncated = run(`head -n 3 '${input}'`);
	assert.equal(truncated.status, 1);

	fs.writeFileSync(input, `${asLines(ERROR_EVENTS).join("\n")}\n`);
	const errorResult = run(`cat '${input}'`);
	assert.equal(errorResult.status, 1);
	assert.match(errorResult.stdout, /error {2}api_error/u);
});

test("the CLI fails when report.md cannot be replaced", () => {
	const { dir, eventsFile } = tempFiles();
	const input = path.join(dir, "stream.jsonl");
	fs.writeFileSync(input, `${asLines(SUCCESS_EVENTS).join("\n")}\n`);
	const outDir = path.join(dir, "out");
	fs.mkdirSync(outDir);
	const reportFile = path.join(outDir, "report.md");
	fs.writeFileSync(reportFile, "stale");
	// The existing report can be emptied, but no temp file can be created beside it.
	fs.chmodSync(outDir, 0o500);
	const script = path.join(__dirname, "agent-stream-format.js");
	let run;
	try {
		run = spawnSync("bash", ["-c", `set -o pipefail; cat "$3" | node "$0" --events "$1" --report "$2"`, script, eventsFile, reportFile, input], { encoding: "utf8" });
	} finally {
		fs.chmodSync(outDir, 0o700);
	}
	assert.equal(run.status, 1);
	assert.match(run.stdout, /error {2}report\.md write failed/u);
	assert.equal(fs.readFileSync(reportFile, "utf8"), "");
});
