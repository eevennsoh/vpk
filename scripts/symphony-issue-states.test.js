const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");

const SYMPHONY_DOC = read(".agents/docs/symphony.md");
const WORKFLOW = read("WORKFLOW.md");
const LIFECYCLE = read(".agents/skills/vpk-symphony/references/lifecycle.md");

function backticked(text) {
	return [...text.matchAll(/`([^`]+)`/gu)].map((match) => match[1]);
}

function section(markdown, startHeading, endPattern = /^#{1,2} /mu) {
	const start = markdown.indexOf(startHeading);
	assert.notEqual(start, -1, `missing section ${startHeading}`);
	const rest = markdown.slice(start + startHeading.length);
	const end = rest.search(endPattern);
	return end === -1 ? rest : rest.slice(0, end);
}

// The one table: "Issue states" in .agents/docs/symphony.md.
function readStateTable() {
	const table = new Map();
	const rows = section(SYMPHONY_DOC, "### Issue states", /^#{1,3} /mu);
	for (const match of rows.matchAll(/^\| `([^`]+)` \| (active|terminal|none) \| [^|]+ \| (.+) \|$/gmu)) {
		table.set(match[1], { list: match[2], moves: match[3] === "none" ? [] : backticked(match[3]) });
	}
	return table;
}

const TABLE = readStateTable();
const STATES = new Set(TABLE.keys());
const statesIn = (list) => [...TABLE].filter(([, row]) => row.list === list).map(([state]) => state);

function readFrontMatterList(key) {
	const frontMatter = WORKFLOW.match(/^---\n([\s\S]*?)\n---\n/u)?.[1] ?? "";
	const block = frontMatter.match(new RegExp(`^  ${key}:\\n((?:    - .+\\n?)+)`, "mu"))?.[1] ?? "";
	return [...block.matchAll(/- (.+)/gu)].map((match) => match[1].trim());
}

// A state-keyed bullet list: "- `A`, `B` -> text" or "- `A`: text". Continuation lines
// belong to the bullet; nested bullets do not (they describe a different step).
function readStateBullets(text) {
	const entries = [];
	let current = null;
	let inNested = false;
	for (const line of text.split("\n")) {
		const bullet = line.match(/^(\s*)- (.*)$/u);
		const indent = line.match(/^\s*/u)[0].length;
		if (bullet && (!current || bullet[1].length <= current.indent)) {
			const prefix = bullet[2].match(/^((?:`[^`]+`(?:, )?)+)\s*(?:->|:)(.*)$/u);
			const keys = prefix ? backticked(prefix[1]) : [];
			current = keys.length > 0 && keys.every((key) => STATES.has(key)) ? { indent: bullet[1].length, keys, text: prefix[2] } : null;
			if (current) entries.push(current);
			inNested = false;
		} else if (current && bullet) {
			inNested = true;
		} else if (current && !inNested && line.trim() !== "" && indent > current.indent) {
			current.text += ` ${line.trim()}`;
		} else if (line.trim() !== "" && current && indent <= current.indent) {
			current = null;
		}
	}
	return entries;
}

function assertMovesAllowed(entries, label) {
	for (const { keys, text } of entries) {
		const targets = backticked(text).filter((name) => STATES.has(name) && !keys.includes(name));
		for (const key of keys) {
			for (const target of targets) {
				assert.ok(TABLE.get(key).moves.includes(target), `${label}: \`${key}\` -> \`${target}\` is not in the Issue states table`);
			}
		}
	}
}

const keysOf = (entries) => entries.flatMap((entry) => entry.keys).sort();

test("the Issue states table is well formed", () => {
	assert.ok(TABLE.size >= 5, "the Issue states table must parse");
	for (const [state, { list, moves }] of TABLE) {
		for (const target of moves) assert.ok(STATES.has(target), `${state} moves to unknown state ${target}`);
		assert.equal(list === "terminal", moves.length === 0, `${state}: terminal states, and only they, have no moves`);
	}
	const flow = SYMPHONY_DOC.match(/Recommended Linear flow:\n\n```text\n(.+)\n```/u)?.[1].split(" -> ") ?? [];
	assert.ok(flow.length > 1, "the recommended flow must parse");
	for (let index = 1; index < flow.length; index += 1) {
		assert.ok(TABLE.get(flow[index - 1])?.moves.includes(flow[index]), `recommended flow step ${flow[index - 1]} -> ${flow[index]}`);
	}
});

test("WORKFLOW.md tracker lists equal the table", () => {
	assert.deepEqual(readFrontMatterList("active_states"), statesIn("active"));
	assert.deepEqual(readFrontMatterList("terminal_states").sort(), statesIn("terminal").sort());
});

test("WORKFLOW.md status map names every state and only allowed moves", () => {
	const entries = readStateBullets(section(WORKFLOW, "## Status map"));
	assert.deepEqual(keysOf(entries), [...STATES].sort());
	assertMovesAllowed(entries, "WORKFLOW.md status map");
});

test("WORKFLOW.md Step 0 routes every state and only along allowed moves", () => {
	const routing = section(section(WORKFLOW, "## Step 0"), "3. Route to the matching flow:", /^4\. /mu);
	const entries = readStateBullets(routing);
	assert.deepEqual(keysOf(entries), [...STATES].sort());
	assertMovesAllowed(entries, "WORKFLOW.md Step 0");
});

test("WORKFLOW.md has a phase prompt for every state that is not terminal", () => {
	const headings = [...section(WORKFLOW, "## Phase prompts").matchAll(/^### (.+)$/gmu)].map((match) => match[1]);
	for (const state of STATES) {
		if (TABLE.get(state).list !== "terminal") assert.ok(headings.includes(state), `missing ### ${state}`);
	}
	for (const heading of headings) {
		assert.ok(STATES.has(heading) || /terminal/u.test(heading), `phase prompt for unknown state ${heading}`);
	}
});

test("lifecycle.md phase prompts move only along allowed moves", () => {
	const entries = readStateBullets(section(LIFECYCLE, "## Phase Prompts"));
	assert.ok(entries.length >= 4, "lifecycle.md phase prompts must parse");
	assertMovesAllowed(entries, "lifecycle.md phase prompts");
});
