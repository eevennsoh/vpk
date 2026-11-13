const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT_DIR = path.resolve(__dirname, "..");
const SOURCE_DIRS = ["app", "components"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const CSS_EXTENSIONS = new Set([".css"]);

const DISALLOWED_PATTERNS = [
	{
		name: "raw ADS color arbitrary utilities",
		pattern: /\b(?:bg|text|border)-\[var\(--ds-[^)]+\)\]/g,
		guidance: "Use mapped semantic classes such as bg-bg-neutral, text-text-subtle, or border-border-bold.",
	},
	{
		name: "raw ADS shadow arbitrary utilities",
		pattern: /\bshadow-\[var\(--ds-shadow-(?:overlay|raised|overflow)\)\]/g,
		guidance: "Use mapped shadow classes such as shadow-md, shadow-lg, or shadow-xl.",
	},
	{
		name: "arbitrary motion token utilities",
		pattern: /\b(?:duration-\[var\(--duration-(?:instant|fast|normal|medium|slow|slower|slowest)\)\]|ease-\[var\(--ease-(?:linear|in|out|in-out|cubic)\)\])/g,
		guidance: "Use mapped motion classes such as duration-normal, duration-medium, ease-out, or ease-in-out.",
	},
];

function listSourceFiles(dir, extensions = SOURCE_EXTENSIONS) {
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const entryPath = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			files.push(...listSourceFiles(entryPath, extensions));
			continue;
		}

		if (entry.isFile() && extensions.has(path.extname(entry.name))) {
			files.push(entryPath);
		}
	}

	return files;
}

function getLineNumber(source, index) {
	return source.slice(0, index).split("\n").length;
}

function findViolations() {
	const files = SOURCE_DIRS.flatMap((dir) => listSourceFiles(path.join(ROOT_DIR, dir)));
	const violations = [];

	for (const file of files) {
		const source = fs.readFileSync(file, "utf8");
		const relativePath = path.relative(ROOT_DIR, file);

		for (const { name, pattern, guidance } of DISALLOWED_PATTERNS) {
			for (const match of source.matchAll(pattern)) {
				violations.push({
					path: relativePath,
					line: getLineNumber(source, match.index),
					match: match[0],
					name,
					guidance,
				});
			}
		}
	}

	return violations;
}

test("VPK UI source uses mapped design token utilities for common token classes", () => {
	const violations = findViolations();

	assert.deepEqual(
		violations,
		[],
		violations
			.map(({ path: filePath, line, match, name, guidance }) => {
				return `${filePath}:${line} ${name}: ${match}\n${guidance}`;
			})
			.join("\n\n"),
	);
});

// token-priority.md: a hardcoded 200ms / 0.2s in CSS should be var(--duration-medium). Only times
// inside the token scale (1ms-600ms) count: shorter ones are reduced-motion hammers and longer ones
// are ambient loops that no token covers. Custom-property definitions (the tokens) are not scanned.
const MOTION_DECLARATION = /(?:^|[;{\s])(transition|transition-duration|transition-delay|animation|animation-duration|animation-delay)\s*:\s*([^;{}]*)/g;
const TIME_LITERAL = /(?<![\w.-])(\d*\.?\d+)(ms|s)\b/g;
const MAX_TOKEN_DURATION_MS = 600;

function findHardcodedCssDurations(source) {
	const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
	const findings = [];
	for (const declaration of withoutComments.matchAll(MOTION_DECLARATION)) {
		const value = declaration[2].replace(/var\([^)]*\)/g, "");
		for (const [literal, amount, unit] of value.matchAll(TIME_LITERAL)) {
			const milliseconds = unit === "s" ? Number(amount) * 1000 : Number(amount);
			if (milliseconds >= 1 && milliseconds <= MAX_TOKEN_DURATION_MS) {
				findings.push({ line: getLineNumber(withoutComments, declaration.index + declaration[0].indexOf(declaration[1])), literal });
			}
		}
	}
	return findings;
}

// Existing hits when the check landed. Shrink-only: fix one, then delete its entry.
const HARDCODED_CSS_DURATION_BASELINE = [
	"components/blocks/chat/chat.module.css 0.22s",
	"components/projects/shared/components/chat-messages.module.css 0.22s",
	"components/projects/sidebar-chat/chat.module.css 0.22s",
	"components/ui-custom/rich-text-editor/rich-text-editor.css 80ms",
];

test("hardcoded CSS durations inside the token scale are found, and token values are not", () => {
	const source = [
		".a { transition: opacity 200ms ease-out, transform 0.15s var(--ease-out); }",
		".b { animation: spin 1s linear infinite; transition-duration: var(--duration-medium); }",
		"/* 200ms in a comment */ .c { --duration-fake: 200ms; transition-delay: 0s; animation-duration: 0.01ms; }",
		".d { animation-delay: calc(var(--duration-fast, 100ms) * 2); transition: color 50ms; }",
	].join("\n");

	assert.deepEqual(findHardcodedCssDurations(source), [
		{ line: 1, literal: "200ms" },
		{ line: 1, literal: "0.15s" },
		{ line: 4, literal: "50ms" },
	]);
});

test("VPK CSS uses duration tokens instead of new hardcoded durations", () => {
	const files = SOURCE_DIRS.flatMap((dir) => listSourceFiles(path.join(ROOT_DIR, dir), CSS_EXTENSIONS));
	const hits = [];
	for (const file of files) {
		const relativePath = path.relative(ROOT_DIR, file);
		for (const { line, literal } of findHardcodedCssDurations(fs.readFileSync(file, "utf8"))) {
			hits.push({ key: `${relativePath} ${literal}`, where: `${relativePath}:${line} ${literal}` });
		}
	}

	const remaining = [...HARDCODED_CSS_DURATION_BASELINE];
	const added = [];
	for (const hit of hits) {
		const index = remaining.indexOf(hit.key);
		if (index === -1) added.push(hit.where);
		else remaining.splice(index, 1);
	}

	assert.deepEqual(added, [], `Use var(--duration-*) instead of a hardcoded duration (token-priority.md):\n${added.join("\n")}`);
	assert.deepEqual(remaining, [], `These baselined durations are gone; delete them from HARDCODED_CSS_DURATION_BASELINE:\n${remaining.join("\n")}`);
});
