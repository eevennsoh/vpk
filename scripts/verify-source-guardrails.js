#!/usr/bin/env node

"use strict";

const { spawnSync } = require("node:child_process");
const { existsSync, readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const ALLOWLIST_PATH = path.join(__dirname, "source-guardrails-allowlist.json");
const SOURCE_EXTENSIONS = new Set([
	".cjs",
	".js",
	".jsx",
	".mjs",
	".ts",
	".tsx",
]);
const DEFAULT_TARGETS = [
	"app",
	"components",
	"backend",
	"hooks",
	"lib",
	"rovo",
	"scripts",
	"tests",
	"types",
	"next.config.ts",
	"tailwind.config.ts",
	"twg-install.test.js",
];
const BROAD_ANY_PATTERNS = [
	/:\s*any\b/u,
	/\bas\s+any\b/u,
	/<\s*any\b/u,
	/\bArray\s*<\s*any\b/u,
	/\bRecord\s*<[^>\n]*\bany\b/u,
	/\bPromise\s*<\s*any\b/u,
];
const FORBIDDEN_IMPORT_RULES = [
	{
		filePathPattern: /^components\/(?:projects\/shared|ui(?:-custom)?)\//u,
		modulePathPattern: /^@\/components\/.*\/experimental(?:-|\/)/u,
	},
	{
		filePathPattern: /^app\/contexts\/context-rovo-chat\.tsx$/u,
		modulePath: "@/components/projects/rovo-core/lib/agent-records/agent-versioning",
	},
	{
		filePathPattern: /^app\/contexts\/context-rovo-chat\.tsx$/u,
		modulePath: "@/components/projects/rovo-core/lib/agent-records/session-agent-storage",
	},
	{
		filePathPattern: /^app\/contexts\/context-rovo-chat\.tsx$/u,
		modulePath: "@/components/projects/rovo-core/lib/agent-records/session-agent-entry",
		forbiddenSpecifiers: [
			"buildSessionAgentProfileFromResult",
			"createSessionAgentEntriesFromRecords",
			"createSessionAgentEntryFromResult",
			"getStudioSessionAgentResultDisplayName",
			"normalizeSessionAgentResult",
		],
	},
];

function compareStrings(left, right) {
	return left.localeCompare(right);
}

function isSourceFile(filePath) {
	return SOURCE_EXTENSIONS.has(path.extname(filePath));
}

function listSourceFiles({ cwd = process.cwd(), targets = DEFAULT_TARGETS } = {}) {
	const result = spawnSync("git", [
		"ls-files",
		"--cached",
		"--others",
		"--exclude-standard",
		"--",
		...targets,
	], {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "inherit"],
	});

	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}

	return result.stdout
		.split("\n")
		.map((filePath) => filePath.trim())
		.filter(Boolean)
		.filter(isSourceFile)
		.sort(compareStrings);
}

function hasBroadAny(line) {
	return BROAD_ANY_PATTERNS.some((pattern) => pattern.test(line));
}

function hasLegacyReactContext(line) {
	return /\b(?:React\.)?useContext\s*\(/u.test(line);
}

function hasPersistentFocusReveal(line) {
	if (!/\bopacity-0\b/u.test(line)) return false;
	const variantScopes = (variant, utility) => new Set(
		[...line.matchAll(new RegExp(`\\bgroup-${variant}(?:/([^:\\s"']+))?:${utility}\\b`, "gu"))]
			.map((match) => match[1] ?? "default"),
	);
	const hoverScopes = variantScopes("hover", "opacity-100");
	const focusScopes = variantScopes("focus-within", "opacity-100");
	const focusPointerScopes = variantScopes("focus-within", "pointer-events-auto");
	const hasInteractiveCue = /\bpointer-events-none\b|\bcursor-pointer\b|\bfocus-visible:opacity-100\b/u.test(line);
	if (!hasInteractiveCue) return false;
	return [...focusScopes].some((scope) => {
		return hoverScopes.has(scope) && (
			focusPointerScopes.has(scope) ||
			/\bcursor-pointer\b|\bfocus-visible:opacity-100\b/u.test(line)
		);
	});
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function getLineNumber(source, index) {
	return source.slice(0, index).split(/\r?\n/u).length;
}


function getScriptKind(filePath) {
	switch (path.extname(filePath)) {
		case ".jsx":
			return ts.ScriptKind.JSX;
		case ".tsx":
			return ts.ScriptKind.TSX;
		case ".ts":
			return ts.ScriptKind.TS;
		default:
			return ts.ScriptKind.JS;
	}
}

function isLexicalScope(node) {
	return ts.isSourceFile(node) ||
		ts.isFunctionLike(node) ||
		ts.isBlock(node) ||
		ts.isCaseBlock(node) ||
		ts.isModuleBlock(node) ||
		ts.isForStatement(node) ||
		ts.isForInStatement(node) ||
		ts.isForOfStatement(node);
}

function getNearestLexicalScope(node) {
	let current = node;
	while (current && !isLexicalScope(current)) current = current.parent;
	return current ?? null;
}

function getParentLexicalScope(scope) {
	return scope.parent ? getNearestLexicalScope(scope.parent) : null;
}

function getNearestFunctionOrSourceScope(node) {
	let current = node;
	while (current && !ts.isSourceFile(current) && !ts.isFunctionLike(current)) {
		current = current.parent;
	}
	return current ?? null;
}

function collectBindingIdentifiers(name, callback) {
	if (ts.isIdentifier(name)) {
		callback(name.text);
		return;
	}
	for (const element of name.elements) {
		if (ts.isOmittedExpression(element)) continue;
		collectBindingIdentifiers(element.name, callback);
	}
}

function collectLexicalBindings(sourceFile) {
	const bindingsByScope = new Map();
	const addBinding = (scope, name, binding) => {
		if (!scope) return;
		const scopeBindings = bindingsByScope.get(scope) ?? new Map();
		scopeBindings.set(name, { ...binding, scope });
		bindingsByScope.set(scope, scopeBindings);
	};
	const visit = (node) => {
		if (ts.isVariableDeclaration(node) && ts.isVariableDeclarationList(node.parent)) {
			const declarationList = node.parent;
			const blockScoped = (declarationList.flags & ts.NodeFlags.BlockScoped) !== 0;
			const scope = blockScoped
				? getNearestLexicalScope(node)
				: getNearestFunctionOrSourceScope(node);
			const expandable = ts.isIdentifier(node.name) &&
				(declarationList.flags & ts.NodeFlags.Const) !== 0 &&
				Boolean(node.initializer);
			collectBindingIdentifiers(node.name, (name) => addBinding(scope, name, {
				declaration: node,
				expandable,
				initializer: expandable ? node.initializer : null,
			}));
		} else if (ts.isParameter(node)) {
			const scope = getNearestLexicalScope(node.parent);
			collectBindingIdentifiers(node.name, (name) => addBinding(scope, name, {
				declaration: node,
				expandable: false,
				initializer: null,
			}));
		} else if (ts.isCatchClause(node) && node.variableDeclaration) {
			collectBindingIdentifiers(node.variableDeclaration.name, (name) => addBinding(
				node.block,
				name,
				{
					declaration: node.variableDeclaration,
					expandable: false,
					initializer: null,
				},
			));
		} else if (ts.isImportClause(node) && node.name) {
			addBinding(sourceFile, node.name.text, {
				declaration: node,
				expandable: false,
				initializer: null,
			});
		} else if (ts.isImportSpecifier(node) || ts.isNamespaceImport(node)) {
			addBinding(sourceFile, node.name.text, {
				declaration: node,
				expandable: false,
				initializer: null,
			});
		} else if (
			(ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isEnumDeclaration(node)) &&
			node.name
		) {
			addBinding(getNearestLexicalScope(node.parent), node.name.text, {
				declaration: node,
				expandable: false,
				initializer: null,
			});
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
	return bindingsByScope;
}

function resolveLexicalBinding(identifier, scope, bindingsByScope) {
	let currentScope = scope;
	while (currentScope) {
		const binding = bindingsByScope.get(currentScope)?.get(identifier);
		if (binding) return binding;
		currentScope = getParentLexicalScope(currentScope);
	}
	return null;
}

function unwrapClassExpression(expression) {
	let current = expression;
	while (
		ts.isParenthesizedExpression(current) ||
		ts.isAsExpression(current) ||
		ts.isTypeAssertionExpression(current) ||
		ts.isSatisfiesExpression(current)
	) {
		current = current.expression;
	}
	return current;
}

function isClassBearingConstExpression(expression) {
	const unwrapped = unwrapClassExpression(expression);
	return ts.isStringLiteralLike(unwrapped) ||
		ts.isIdentifier(unwrapped) ||
		(
			ts.isCallExpression(unwrapped) &&
			ts.isIdentifier(unwrapped.expression) &&
			unwrapped.expression.text === "cn"
		);
}

function isReferencedIdentifier(node) {
	if (ts.isDeclarationName(node)) return false;
	const parent = node.parent;
	if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
	if (
		(
			ts.isPropertyAssignment(parent) ||
			ts.isMethodDeclaration(parent) ||
			ts.isPropertyDeclaration(parent)
		) &&
		parent.name === node
	) {
		return false;
	}
	return true;
}

function collectReferencedIdentifiers(expression) {
	const references = [];
	const visit = (node) => {
		if (ts.isIdentifier(node) && isReferencedIdentifier(node)) {
			const scope = getNearestLexicalScope(node);
			if (scope) references.push({ identifier: node.text, scope });
		}
		ts.forEachChild(node, visit);
	};
	visit(expression);
	return references;
}

function collectReferencedProperties(expression) {
	const properties = [];
	const visit = (node) => {
		if (
			ts.isPropertyAccessExpression(node) &&
			ts.isIdentifier(node.expression)
		) {
			const scope = getNearestLexicalScope(node);
			if (scope) {
				properties.push({
					identifier: node.expression.text,
					propertyName: node.name.text,
					scope,
				});
			}
		} else if (
			ts.isElementAccessExpression(node) &&
			ts.isIdentifier(node.expression) &&
			node.argumentExpression &&
			ts.isStringLiteralLike(node.argumentExpression)
		) {
			const scope = getNearestLexicalScope(node);
			if (scope) {
				properties.push({
					identifier: node.expression.text,
					propertyName: node.argumentExpression.text,
					scope,
				});
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(expression);
	return properties;
}

function getStaticPropertyName(name) {
	if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) {
		return name.text;
	}
	if (
		ts.isComputedPropertyName(name) &&
		ts.isStringLiteralLike(name.expression)
	) {
		return name.expression.text;
	}
	return null;
}

function getSelectedObjectPropertyInitializer(expression, propertyName) {
	const objectExpression = unwrapClassExpression(expression);
	if (!ts.isObjectLiteralExpression(objectExpression)) return null;
	for (let index = objectExpression.properties.length - 1; index >= 0; index -= 1) {
		const property = objectExpression.properties[index];
		if (ts.isSpreadAssignment(property)) return null;
		if (!property.name || getStaticPropertyName(property.name) !== propertyName) continue;
		if (ts.isPropertyAssignment(property)) return property.initializer;
		if (ts.isShorthandPropertyAssignment(property)) return property.name;
		return null;
	}
	return null;
}

function expandClassNameExpression(record, sourceFile, bindingsByScope) {
	const parts = [record.text];
	const pending = [
		...collectReferencedIdentifiers(record.expression)
			.map((reference) => ({ ...reference, kind: "identifier" })),
		...collectReferencedProperties(record.expression)
			.map((property) => ({ ...property, kind: "property" })),
	];
	const visitedDeclarations = new Set();
	const visitedProperties = new Map();
	while (pending.length > 0) {
		const reference = pending.pop();
		if (!reference) continue;
		const binding = resolveLexicalBinding(
			reference.identifier,
			reference.scope,
			bindingsByScope,
		);
		if (!binding || !binding.expandable) continue;
		if (reference.kind === "property") {
			const seenProperties = visitedProperties.get(binding.declaration) ?? new Set();
			if (seenProperties.has(reference.propertyName)) continue;
			seenProperties.add(reference.propertyName);
			visitedProperties.set(binding.declaration, seenProperties);
			const initializer = unwrapClassExpression(binding.initializer);
			if (ts.isIdentifier(initializer)) {
				pending.push({
					identifier: initializer.text,
					kind: "property",
					propertyName: reference.propertyName,
					scope: binding.scope,
				});
				continue;
			}
			const selectedInitializer = getSelectedObjectPropertyInitializer(
				initializer,
				reference.propertyName,
			);
			if (!selectedInitializer) continue;
			parts.push(selectedInitializer.getText(sourceFile));
			for (const identifier of collectReferencedIdentifiers(selectedInitializer)) {
				pending.push({ ...identifier, kind: "identifier" });
			}
			for (const property of collectReferencedProperties(selectedInitializer)) {
				pending.push({ ...property, kind: "property" });
			}
			continue;
		}
		if (visitedDeclarations.has(binding.declaration)) continue;
		visitedDeclarations.add(binding.declaration);
		const initializer = binding.initializer;
		if (!initializer || !isClassBearingConstExpression(initializer)) continue;
		parts.push(initializer.getText(sourceFile));
		for (const identifier of collectReferencedIdentifiers(initializer)) {
			pending.push({ ...identifier, kind: "identifier" });
		}
		for (const property of collectReferencedProperties(initializer)) {
			pending.push({ ...property, kind: "property" });
		}
	}
	return parts.join(" ");
}

function assertCandidateSourceParses(sourceFile, filePath) {
	const diagnostic = sourceFile.parseDiagnostics[0];
	if (!diagnostic) return;
	const position = sourceFile.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
	const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")
		.replace(/\s+/gu, " ")
		.trim();
	throw new Error(
		`${filePath}:${position.line + 1}: source guardrail could not parse candidate className syntax (TS${diagnostic.code}): ${message}`,
	);
}

function collectClassNameExpressionRecords(source, filePath) {
	if (
		!source.includes("className") ||
		!source.includes("group-focus-within") ||
		!source.includes("opacity-0")
	) {
		return [];
	}
	const sourceFile = ts.createSourceFile(
		filePath,
		source,
		ts.ScriptTarget.Latest,
		true,
		getScriptKind(filePath),
	);
	assertCandidateSourceParses(sourceFile, filePath);
	const bindingsByScope = collectLexicalBindings(sourceFile);
	const records = [];
	const visit = (node) => {
		if (
			ts.isJsxAttribute(node) &&
			node.name.text === "className" &&
			node.initializer
		) {
			const expression = ts.isJsxExpression(node.initializer)
				? node.initializer.expression
				: node.initializer;
			const scope = expression ? getNearestLexicalScope(expression) : null;
			if (expression && scope) {
				const text = node.getText(sourceFile).replace(/\s+/gu, " ").trim();
				const record = {
					expression,
					line: sourceFile.getLineAndCharacterOfPosition(
						node.getStart(sourceFile),
					).line + 1,
					scope,
					text,
				};
				records.push({
					...record,
					expandedText: expandClassNameExpression(
						record,
						sourceFile,
						bindingsByScope,
					),
				});
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
	return records;
}

function addViolation(violations, occurrenceCounts, violation) {
	const baseKey = `${violation.type}|${violation.filePath}|${violation.text}`;
	const occurrence = (occurrenceCounts.get(baseKey) ?? 0) + 1;
	occurrenceCounts.set(baseKey, occurrence);
	violations.push({
		...violation,
		occurrence,
	});
}

function collectStaticImports(source) {
	return [...source.matchAll(/import\s+(?:type\s+)?([\s\S]*?)\s+from\s+["']([^"']+)["'];/gu)]
		.map((match) => ({
			line: getLineNumber(source, match.index ?? 0),
			modulePath: match[2],
			source: match[0].replace(/\s+/gu, " ").trim(),
			specifiers: match[1],
		}));
}

function collectForbiddenImportViolationsFromSource(source, filePath) {
	const violations = [];
	const occurrenceCounts = new Map();
	const imports = collectStaticImports(source);
	const rules = FORBIDDEN_IMPORT_RULES.filter((rule) => rule.filePathPattern.test(filePath));

	for (const importDeclaration of imports) {
		for (const rule of rules) {
			const matchesModule = rule.modulePath
				? importDeclaration.modulePath === rule.modulePath
				: rule.modulePathPattern?.test(importDeclaration.modulePath) ?? false;
			if (!matchesModule) {
				continue;
			}

			const forbiddenSpecifiers = rule.forbiddenSpecifiers ?? [];
			if (forbiddenSpecifiers.length === 0) {
				addViolation(violations, occurrenceCounts, {
					filePath,
					line: importDeclaration.line,
					text: `forbidden import from ${rule.modulePath ?? importDeclaration.modulePath}`,
					type: "forbidden-import",
				});
				continue;
			}

			for (const specifier of forbiddenSpecifiers) {
				const specifierPattern = new RegExp(`\\b${escapeRegExp(specifier)}\\b`, "u");
				if (!specifierPattern.test(importDeclaration.specifiers)) {
					continue;
				}

				addViolation(violations, occurrenceCounts, {
					filePath,
					line: importDeclaration.line,
					text: `forbidden import ${specifier} from ${rule.modulePath}`,
					type: "forbidden-import",
				});
			}
		}
	}

	return violations;
}

function isPlaywrightSource(filePath) {
	return /^tests\//u.test(filePath.replaceAll("\\", "/"));
}

function collectSourceGuardrailViolationsFromSource(source, filePath) {
	const violations = [];
	const occurrenceCounts = new Map();
	const lines = source.split(/\r?\n/u);

	lines.forEach((rawLine, index) => {
		const line = rawLine.trim();
		if (!line) {
			return;
		}

		const baseViolation = {
			filePath,
			line: index + 1,
			text: line,
		};

		if (/eslint-disable(?:-next-line|-line)?/u.test(line)) {
			addViolation(violations, occurrenceCounts, {
				...baseViolation,
				type: "eslint-disable",
			});
		}

		if (/@ts-ignore\b/u.test(line)) {
			addViolation(violations, occurrenceCounts, {
				...baseViolation,
				type: "ts-ignore",
			});
		}

		if (hasBroadAny(line)) {
			addViolation(violations, occurrenceCounts, {
				...baseViolation,
				type: "broad-any",
			});
		}

		if (hasLegacyReactContext(line)) {
			addViolation(violations, occurrenceCounts, {
				...baseViolation,
				type: "legacy-react-context",
			});
		}

		// A fixed sleep in a browser spec passes or fails with machine speed; wait on the
		// observable condition instead (expect(...).toBeVisible(), toHaveAttribute, waitForResponse).
		if (isPlaywrightSource(filePath) && /\.waitForTimeout\s*\(/u.test(line)) {
			addViolation(violations, occurrenceCounts, {
				...baseViolation,
				type: "playwright-fixed-wait",
			});
		}

	});

	for (const expression of collectClassNameExpressionRecords(source, filePath)) {
		if (!hasPersistentFocusReveal(expression.expandedText)) continue;
		addViolation(violations, occurrenceCounts, {
			filePath,
			line: expression.line,
			text: expression.text,
			type: "persistent-focus-reveal",
		});
	}

	return [
		...violations,
		...collectForbiddenImportViolationsFromSource(source, filePath),
	];
}

function collectSourceGuardrailViolations({ cwd = process.cwd(), files = listSourceFiles({ cwd }) } = {}) {
	return files
		.filter((filePath) => existsSync(path.join(cwd, filePath)))
		.flatMap((filePath) => {
			const source = readFileSync(path.join(cwd, filePath), "utf8");
			return collectSourceGuardrailViolationsFromSource(source, filePath);
		})
		.sort((left, right) => {
			return compareStrings(left.filePath, right.filePath) ||
				left.line - right.line ||
				compareStrings(left.type, right.type) ||
				left.occurrence - right.occurrence;
		});
}

function readAllowlist(filePath = ALLOWLIST_PATH) {
	if (!existsSync(filePath)) {
		return {
			version: 1,
			items: [],
		};
	}
	return JSON.parse(readFileSync(filePath, "utf8"));
}

function getFingerprint(item) {
	return `${item.type}|${item.filePath}|${item.occurrence ?? 1}|${item.text}`;
}

function buildUpdatedAllowlist(violations) {
	return {
		version: 1,
		items: violations.map((violation) => ({
			filePath: violation.filePath,
			occurrence: violation.occurrence,
			reason: "existing baseline",
			text: violation.text,
			type: violation.type,
		})),
	};
}

function evaluateSourceGuardrails(violations, allowlist) {
	const allowlistItems = allowlist.items ?? [];
	const allowedByFingerprint = new Map(
		allowlistItems.map((item) => [getFingerprint(item), item]),
	);
	const currentFingerprints = new Set(violations.map(getFingerprint));
	const failures = [];

	for (const item of allowlistItems) {
		if (!item.reason) {
			failures.push({
				...item,
				type: "allowlist-entry-missing-reason",
				violationType: item.type,
			});
		}
	}

	for (const violation of violations) {
		if (!allowedByFingerprint.has(getFingerprint(violation))) {
			failures.push({
				...violation,
				type: "new-source-guardrail-violation",
				violationType: violation.type,
			});
		}
	}

	for (const item of allowlistItems) {
		if (!currentFingerprints.has(getFingerprint(item))) {
			failures.push({
				...item,
				type: "stale-source-guardrail-allowlist-entry",
				violationType: item.type,
			});
		}
	}

	return failures;
}

function formatFailure(failure) {
	if (failure.type === "allowlist-entry-missing-reason") {
		return `${failure.filePath}: allowlisted ${failure.violationType} entry is missing a reason: ${failure.text}`;
	}

	if (failure.type === "stale-source-guardrail-allowlist-entry") {
		return `${failure.filePath}: stale ${failure.violationType} allowlist entry can be removed: ${failure.text}`;
	}

	if (failure.type === "new-source-guardrail-violation") {
		return `${failure.filePath}:${failure.line}: new ${failure.violationType} requires removal or an allowlist reason: ${failure.text}`;
	}

	return `${failure.filePath}: unknown source guardrail failure.`;
}

function main() {
	const shouldUpdate = process.argv.includes("--update");
	const violations = collectSourceGuardrailViolations();

	if (shouldUpdate) {
		const updatedAllowlist = buildUpdatedAllowlist(violations);
		writeFileSync(ALLOWLIST_PATH, `${JSON.stringify(updatedAllowlist, null, "\t")}\n`);
		console.log(`Updated ${path.relative(process.cwd(), ALLOWLIST_PATH)} with ${updatedAllowlist.items.length} source guardrail baseline entries.`);
		return;
	}

	const failures = evaluateSourceGuardrails(violations, readAllowlist());
	if (failures.length === 0) {
		console.log("Verified source guardrail ratchets");
		return;
	}

	console.error("Source guardrail ratchets failed:");
	for (const failure of failures) {
		console.error(`- ${formatFailure(failure)}`);
	}
	console.error("Remove the pattern, or run `node scripts/verify-source-guardrails.js --update` after an intentional architecture-budget change.");
	process.exitCode = 1;
}

if (require.main === module) {
	main();
}

module.exports = {
	buildUpdatedAllowlist,
	collectSourceGuardrailViolations,
	collectForbiddenImportViolationsFromSource,
	collectSourceGuardrailViolationsFromSource,
	evaluateSourceGuardrails,
	formatFailure,
	hasBroadAny,
	hasLegacyReactContext,
	hasPersistentFocusReveal,
	isSourceFile,
	listSourceFiles,
};
