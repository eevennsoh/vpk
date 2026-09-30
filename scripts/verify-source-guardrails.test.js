const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { gateRunsScript } = require("./lib/package-gates.js");

const {
	buildUpdatedAllowlist,
	collectForbiddenImportViolationsFromSource,
	collectSourceGuardrailViolationsFromSource,
	evaluateSourceGuardrails,
	formatFailure,
	hasBroadAny,
	hasLegacyReactContext,
	hasPersistentFocusReveal,
	isSourceFile,
	listSourceFiles,
} = require("./verify-source-guardrails");

test("detects source guardrail patterns with stable occurrences", () => {
	const violations = collectSourceGuardrailViolationsFromSource([
		"/* eslint-disable react-hooks/exhaustive-deps */",
		"// @ts-ignore legacy boundary",
		"const value = payload as any;",
		"const context = useContext(AppContext);",
		"const reactContext = React.useContext(AppContext);",
		"const other = payload as any;",
	].join("\n"), "components/example.tsx");

	assert.deepEqual(violations.map((violation) => ({
		line: violation.line,
		occurrence: violation.occurrence,
		text: violation.text,
		type: violation.type,
	})), [
		{
			line: 1,
			occurrence: 1,
			text: "/* eslint-disable react-hooks/exhaustive-deps */",
			type: "eslint-disable",
		},
		{
			line: 2,
			occurrence: 1,
			text: "// @ts-ignore legacy boundary",
			type: "ts-ignore",
		},
		{
			line: 3,
			occurrence: 1,
			text: "const value = payload as any;",
			type: "broad-any",
		},
		{
			line: 4,
			occurrence: 1,
			text: "const context = useContext(AppContext);",
			type: "legacy-react-context",
		},
		{
			line: 5,
			occurrence: 1,
			text: "const reactContext = React.useContext(AppContext);",
			type: "legacy-react-context",
		},
		{
			line: 6,
			occurrence: 1,
			text: "const other = payload as any;",
			type: "broad-any",
		},
	]);
});

test("matches broad any and legacy React context patterns narrowly", () => {
	assert.equal(hasBroadAny("type Item = Record<string, any>;"), true);
	assert.equal(hasBroadAny("const value = thing as unknown;"), false);
	assert.equal(hasLegacyReactContext("const context = use(Context);"), false);
	assert.equal(hasLegacyReactContext("const context = useContext(Context);"), true);
	const persistentFocusReveal = [
		"pointer-events-none opacity-0",
		"group-hover/card:pointer-events-auto",
		"group-hover/card:opacity-100",
		"group-focus-within/card:opacity-100",
		"group-focus-within/card:pointer-events-auto",
	].join(" ");
	assert.equal(hasPersistentFocusReveal(persistentFocusReveal), true);
	assert.equal(hasPersistentFocusReveal("group-has-[:focus-visible]/card:opacity-100"), false);
	assert.equal(
		hasPersistentFocusReveal(
			"pointer-events-none opacity-0 group-hover/card:opacity-100 " +
			"group-focus-within/toolbar:pointer-events-auto group-focus-within/toolbar:opacity-100",
		),
		false,
	);
});

test("detects forbidden session-agent provider imports", () => {
	const violations = collectForbiddenImportViolationsFromSource([
		'import { normalizeSessionAgentEntry } from "@/components/projects/rovo-core/lib/agent-records/session-agent-entry";',
		'import {',
		"\tcreateSessionAgentEntryFromResult,",
		"\tnormalizeSessionAgentResult,",
		'} from "@/components/projects/rovo-core/lib/agent-records/session-agent-entry";',
		'import { readSessionAgentRecords } from "@/components/projects/rovo-core/lib/agent-records/session-agent-storage";',
		'import { createStudioAgentVersionRecord } from "@/components/projects/rovo-core/lib/agent-records/agent-versioning";',
	].join("\n"), "app/contexts/context-rovo-chat.tsx");

	assert.deepEqual(violations.map((violation) => ({
		line: violation.line,
		text: violation.text,
		type: violation.type,
	})), [
		{
			line: 2,
			text: "forbidden import createSessionAgentEntryFromResult from @/components/projects/rovo-core/lib/agent-records/session-agent-entry",
			type: "forbidden-import",
		},
		{
			line: 2,
			text: "forbidden import normalizeSessionAgentResult from @/components/projects/rovo-core/lib/agent-records/session-agent-entry",
			type: "forbidden-import",
		},
		{
			line: 6,
			text: "forbidden import from @/components/projects/rovo-core/lib/agent-records/session-agent-storage",
			type: "forbidden-import",
		},
		{
			line: 7,
			text: "forbidden import from @/components/projects/rovo-core/lib/agent-records/agent-versioning",
			type: "forbidden-import",
		},
	]);

	assert.deepEqual(
		collectForbiddenImportViolationsFromSource(
			'import { createSessionAgentEntryFromResult } from "@/components/projects/rovo-core/lib/agent-records/session-agent-entry";',
			"components/projects/rovo-core/lib/agent-records/session-agent-registry.ts",
		),
		[],
	);
});

test("blocks shared UI surfaces from importing experimental implementations", () => {
	const violations = collectForbiddenImportViolationsFromSource(
		'import { runExperimentalCheck } from "@/components/blocks/jira-work-item/experimental-v3/lib/checks";',
		"components/ui-custom/context-bar/context-bar-pull-request-ci.tsx",
	);

	assert.deepEqual(violations.map((violation) => ({
		line: violation.line,
		text: violation.text,
		type: violation.type,
	})), [
		{
			line: 1,
			text: "forbidden import from @/components/blocks/jira-work-item/experimental-v3/lib/checks",
			type: "forbidden-import",
		},
	]);

	assert.deepEqual(
		collectForbiddenImportViolationsFromSource(
			'import { runExperimentalCheck } from "@/components/blocks/jira-work-item/experimental-v3/lib/checks";',
			"components/blocks/jira-work-item/experimental-v3/components/checks.tsx",
		),
		[],
	);
});

test("rejects persistent focus reveal when a focus-visible owner already exists", () => {
	const persistentFocusReveal = [
		"pointer-events-none opacity-0",
		"group-hover/card:pointer-events-auto",
		"group-hover/card:opacity-100",
		"group-focus-within/card:opacity-100",
		"group-focus-within/card:pointer-events-auto",
	].join(" ");
	const className = `className="opacity-0 group-hover/card:opacity-100 ${persistentFocusReveal}"`;
	const source = `function Example() { return <button ${className}>Open</button>; }`;
	const violations = collectSourceGuardrailViolationsFromSource(
		source,
		"components/example.tsx",
	);

	assert.deepEqual(violations.map((violation) => ({
		line: violation.line,
		text: violation.text,
		type: violation.type,
	})), [
		{
			line: 1,
			text: className,
			type: "persistent-focus-reveal",
		},
	]);

	assert.deepEqual(
		collectSourceGuardrailViolationsFromSource(
			'<button className="opacity-0 group-hover/card:opacity-100 group-has-[:focus-visible]/card:opacity-100">Open</button>',
			"components/example.tsx",
		),
		[],
	);
});

test("rejects persistent focus reveal split across a multiline className expression", () => {
	const source = [
		"function Example() {",
		"\treturn <button",
		'\t\tclassName={cn(',
		'\t\t\t"pointer-events-none opacity-0",',
		'\t\t\t"group-hover/row:pointer-events-auto group-hover/row:opacity-100",',
		'\t\t\t"group-focus-within/row:pointer-events-auto",',
		'\t\t\t"group-focus-within/row:opacity-100 focus-visible:opacity-100",',
		"\t\t)}",
		"\t>Open</button>;",
		"}",
	].join("\n");
	const violations = collectSourceGuardrailViolationsFromSource(
		source,
		"components/example.tsx",
	);

	assert.equal(violations.length, 1);
	assert.equal(violations[0].line, 3);
	assert.equal(violations[0].type, "persistent-focus-reveal");
	assert.match(violations[0].text, /className=\{cn\([\s\S]*group-focus-within\/row:opacity-100/u);
});

test("rejects persistent focus reveal stored in a class constant", () => {
	const source = [
		"const ACTION_CLASS =",
		'\t"pointer-events-none opacity-0 group-hover/row:pointer-events-auto group-hover/row:opacity-100 group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100 focus-visible:opacity-100";',
		"const UNUSED_CLASS =",
		'\t"pointer-events-none opacity-0 group-hover/unused:pointer-events-auto group-hover/unused:opacity-100 group-focus-within/unused:pointer-events-auto group-focus-within/unused:opacity-100";',
		"",
		"function Example() {",
		"\treturn <button className={ACTION_CLASS}>Open</button>;",
		"}",
	].join("\n");
	const violations = collectSourceGuardrailViolationsFromSource(
		source,
		"components/example.tsx",
	);

	assert.equal(violations.length, 1);
	assert.equal(violations[0].line, 7);
	assert.equal(violations[0].type, "persistent-focus-reveal");
	assert.match(violations[0].text, /className=\{ACTION_CLASS\}/u);
	assert.doesNotMatch(violations[0].text, /UNUSED_CLASS/u);
});

test("resolves shadowed class constants in lexical scope for either declaration order", () => {
	const persistentClass =
		'"pointer-events-none opacity-0 group-hover/row:pointer-events-auto group-hover/row:opacity-100 group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100"';
	const safeClass = '"rounded-sm"';
	const component = (name, classValue, kind) => [
		`function ${name}() {`,
		`\tconst ACTION_CLASS = ${classValue};`,
		`\treturn <button data-kind="${kind}" className={ACTION_CLASS}>Open</button>;`,
		"}",
	].join("\n");

	for (const source of [
		[component("Bad", persistentClass, "bad"), component("Safe", safeClass, "safe")].join("\n"),
		[component("Safe", safeClass, "safe"), component("Bad", persistentClass, "bad")].join("\n"),
	]) {
		const violations = collectSourceGuardrailViolationsFromSource(
			source,
			"components/example.tsx",
		).filter((violation) => violation.type === "persistent-focus-reveal");
		const badClassLine = source.split("\n")
			.findIndex((line) => line.includes('data-kind="bad"')) + 1;

		assert.equal(violations.length, 1);
		assert.equal(violations[0].line, badClassLine);
		assert.match(violations[0].text, /className=\{ACTION_CLASS\}/u);
	}
});

test("nearer parameters and let bindings block outer class constants", () => {
	const persistentClass =
		'"pointer-events-none opacity-0 group-hover/row:pointer-events-auto group-hover/row:opacity-100 group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100"';
	const sources = [
		[
			`const ACTION_CLASS = ${persistentClass};`,
			"function Example(ACTION_CLASS) {",
			"\treturn <button className={ACTION_CLASS}>Open</button>;",
			"}",
		].join("\n"),
		[
			`const ACTION_CLASS = ${persistentClass};`,
			"function Example() {",
			'\tlet ACTION_CLASS = "rounded-sm";',
			"\treturn <button className={ACTION_CLASS}>Open</button>;",
			"}",
		].join("\n"),
		[
			`const ACTION_CLASS = ${persistentClass};`,
			"function Example() {",
			"\treturn <button className={(() => {",
			'\t\tlet ACTION_CLASS = "rounded-sm";',
			"\t\treturn ACTION_CLASS;",
			"\t})()}>Open</button>;",
			"}",
		].join("\n"),
	];

	for (const source of sources) {
		assert.deepEqual(
			collectSourceGuardrailViolationsFromSource(source, "components/example.tsx"),
			[],
		);
	}
});

test("does not parse source-contract regex literals as JSX className expressions", () => {
	const source = String.raw`assert.match(
		uiSource,
		/className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"/u,
	);`;

	assert.deepEqual(
		collectSourceGuardrailViolationsFromSource(source, "components/example.test.js"),
		[],
	);
});

test("terminates cyclic class constant references without inventing class content", () => {
	const source = [
		"const ACTION_CLASS = OTHER_CLASS;",
		"const OTHER_CLASS = ACTION_CLASS;",
		"function Example() {",
		"\treturn <button className={ACTION_CLASS}>Open</button>;",
		"}",
	].join("\n");

	assert.deepEqual(
		collectSourceGuardrailViolationsFromSource(source, "components/example.tsx"),
		[],
	);
});

test("does not merge unrelated properties from a referenced class map", () => {
	const source = [
		"const ACTION_CLASSES = {",
		'\tsafe: "rounded-sm",',
		'\tpersistent: "pointer-events-none opacity-0 group-hover/row:pointer-events-auto group-hover/row:opacity-100 group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100",',
		"};",
		"",
		"function Example() {",
		"\treturn <button className={ACTION_CLASSES.safe}>Open</button>;",
		"}",
	].join("\n");

	assert.deepEqual(
		collectSourceGuardrailViolationsFromSource(source, "components/example.tsx"),
		[],
	);
});

test("resolves only the selected persistent property from a referenced class map", () => {
	const source = [
		"const ACTION_CLASSES = {",
		'\tsafe: "rounded-sm",',
		'\tpersistent: "pointer-events-none opacity-0 group-hover/row:pointer-events-auto group-hover/row:opacity-100 group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100",',
		"};",
		"",
		"function Example() {",
		"\treturn (",
		"\t\t<>",
		"\t\t\t<button className={ACTION_CLASSES.safe}>Safe</button>",
		"\t\t\t<button className={ACTION_CLASSES.persistent}>Open</button>",
		"\t\t</>",
		"\t);",
		"}",
	].join("\n");
	const violations = collectSourceGuardrailViolationsFromSource(
		source,
		"components/example.tsx",
	).filter((violation) => violation.type === "persistent-focus-reveal");

	assert.equal(violations.length, 1);
	assert.equal(violations[0].line, 10);
	assert.match(violations[0].text, /className=\{ACTION_CLASSES\.persistent\}/u);
});

test("fails closed with a deterministic diagnostic for malformed candidate JSX", () => {
	const source = [
		'const ACTION_CLASS = "pointer-events-none opacity-0 group-hover/row:pointer-events-auto group-hover/row:opacity-100 group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100";',
		"function Example() { return <button className=; }",
	].join("\n");

	assert.throws(
		() => collectSourceGuardrailViolationsFromSource(source, "components/example.tsx"),
		/components\/example\.tsx:2: source guardrail could not parse candidate className syntax \(TS\d+\):/u,
	);
});

test("evaluates new and stale source guardrail entries against an allowlist", () => {
	const violations = collectSourceGuardrailViolationsFromSource([
		"const allowed = value as any;",
		"const newValue = value as any;",
	].join("\n"), "components/example.tsx");
	const allowlist = buildUpdatedAllowlist([violations[0]]);

	allowlist.items.push({
		filePath: "components/deleted.tsx",
		occurrence: 1,
		reason: "existing baseline",
		text: "const deleted = value as any;",
		type: "broad-any",
	});
	allowlist.items.push({
		filePath: "components/missing-reason.tsx",
		occurrence: 1,
		text: "const missing = value as any;",
		type: "broad-any",
	});

	const failures = evaluateSourceGuardrails(violations, allowlist);
	assert.deepEqual(failures.map((failure) => failure.type), [
		"allowlist-entry-missing-reason",
		"new-source-guardrail-violation",
		"stale-source-guardrail-allowlist-entry",
		"stale-source-guardrail-allowlist-entry",
	]);
	assert.match(formatFailure(failures[1]), /components\/example\.tsx:2/u);
});

test("lists tracked and untracked source files only", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-source-guardrails-"));
	try {
		spawnSync("git", ["init"], { cwd, stdio: "ignore" });
		mkdirSync(path.join(cwd, "components"), { recursive: true });
		writeFileSync(path.join(cwd, ".gitignore"), "ignored.ts\n");
		writeFileSync(path.join(cwd, "components", "tracked.tsx"), "tracked\n");
		writeFileSync(path.join(cwd, "components", "untracked.ts"), "untracked\n");
		writeFileSync(path.join(cwd, "components", "notes.md"), "notes\n");
		writeFileSync(path.join(cwd, "ignored.ts"), "ignored\n");
		spawnSync("git", ["add", ".gitignore", "components/tracked.tsx"], { cwd, stdio: "ignore" });

		assert.deepEqual(listSourceFiles({ cwd, targets: ["components", "ignored.ts"] }), [
			"components/tracked.tsx",
			"components/untracked.ts",
		]);
	} finally {
		rmSync(cwd, { force: true, recursive: true });
	}
});

test("package scripts expose the source guardrail verifier", () => {
	const packageJson = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8"));

	assert.equal(packageJson.scripts["verify:source-guardrails"], "node scripts/verify-source-guardrails.js");
	for (const gate of ["validate:local", "ci:pr", "verify:fast"]) {
		assert.ok(gateRunsScript(packageJson.scripts, gate, "verify:source-guardrails"), `${gate} must run verify:source-guardrails`);
	}
});

test("recognizes configured source extensions", () => {
	assert.equal(isSourceFile("components/example.tsx"), true);
	assert.equal(isSourceFile("scripts/example.mjs"), true);
	assert.equal(isSourceFile("AGENTS.md"), false);
});
