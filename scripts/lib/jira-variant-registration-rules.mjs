// Registration rule kinds for the Jira variant scaffolder: each takes a registration
// file's content and returns it with the target variant wired in.

import {
	assertNoSourceIdentifiers,
	countOccurrences,
	rewriteText,
} from "./jira-variant-text.mjs";

function findMatchingDelimiter(content, startIndex, open, close) {
	let depth = 0;
	let quote = null;
	let escaped = false;
	let lineComment = false;
	let blockComment = false;
	for (let index = startIndex; index < content.length; index += 1) {
		const char = content[index];
		const next = content[index + 1];
		if (lineComment) {
			if (char === "\n") lineComment = false;
			continue;
		}
		if (blockComment) {
			if (char === "*" && next === "/") {
				blockComment = false;
				index += 1;
			}
			continue;
		}
		if (quote) {
			if (escaped) {
				escaped = false;
				continue;
			}
			if (char === "\\") {
				escaped = true;
				continue;
			}
			if (char === quote) quote = null;
			continue;
		}
		if (char === "/" && next === "/") {
			lineComment = true;
			index += 1;
			continue;
		}
		if (char === "/" && next === "*") {
			blockComment = true;
			index += 1;
			continue;
		}
		if (char === '"' || char === "'" || char === "`") {
			quote = char;
			continue;
		}
		if (char === open) depth += 1;
		if (char === close) {
			depth -= 1;
			if (depth === 0) return index;
		}
	}
	throw new Error(`unclosed ${open}${close} block at offset ${startIndex}`);
}

function extractArrayObjects(content, arrayStart) {
	const startCount = countOccurrences(content, arrayStart);
	if (startCount !== 1) {
		throw new Error(`registration array anchor must occur exactly once: ${arrayStart}`);
	}
	const anchorIndex = content.indexOf(arrayStart);
	const openIndex = content.indexOf("[", anchorIndex);
	const closeIndex = findMatchingDelimiter(content, openIndex, "[", "]");
	const objects = [];
	for (let cursor = openIndex + 1; cursor < closeIndex; cursor += 1) {
		if (content[cursor] !== "{") continue;
		const endBrace = findMatchingDelimiter(content, cursor, "{", "}");
		let end = endBrace + 1;
		while (end < closeIndex && /[ \t]/u.test(content[end])) end += 1;
		if (content[end] === ",") end += 1;
		const lineStart = content.lastIndexOf("\n", cursor) + 1;
		const leading = content.slice(lineStart, cursor);
		const indent = /^[ \t]*$/u.test(leading) ? leading : "";
		objects.push({ content: content.slice(cursor, end), end, indent, start: cursor });
		cursor = end - 1;
	}
	return { closeIndex, objects };
}

export function prepareRegistrationRule(content, rule, rewriteRules, source) {
	if (rule.kind === "replace") {
		const sourceCount = countOccurrences(content, rule.source);
		if (countOccurrences(content, rule.target) > 0) {
			if (rule.optional && sourceCount === 0) {
				return { content, insertedCount: 0 };
			}
			throw new Error(`target registration already exists in ${rule.file}`);
		}
		if (sourceCount === 0 && rule.optional) {
			return { content, insertedCount: 0 };
		}
		if (sourceCount !== 1) {
			throw new Error(
				`registration replacement is missing or ambiguous in ${rule.file}: ${rule.source}`,
			);
		}
		return {
			content: content.replace(rule.source, rule.target),
			insertedCount: 1,
		};
	}

	if (rule.kind === "line") {
		if (countOccurrences(content, rule.target) > 0) {
			throw new Error(`target registration already exists in ${rule.file}`);
		}
		if (countOccurrences(content, rule.source) !== 1) {
			throw new Error(`registration source is missing or ambiguous in ${rule.file}`);
		}
		return {
			content: content.replace(rule.source, `${rule.source}\n${rule.target}`),
			insertedCount: 1,
		};
	}

	if (rule.kind === "block") {
		if (countOccurrences(content, rule.targetStart) > 0) {
			throw new Error(`target registration already exists in ${rule.file}`);
		}
		if (countOccurrences(content, rule.start) !== 1) {
			throw new Error(`registration block is missing or ambiguous in ${rule.file}`);
		}
		const start = content.indexOf(rule.start);
		const endMarker = content.indexOf(rule.end, start);
		if (endMarker < 0) {
			throw new Error(`registration block end is missing in ${rule.file}`);
		}
		const end = endMarker + rule.end.length;
		const sourceBlock = content.slice(start, end);
		let targetBlock = rewriteText(sourceBlock, rewriteRules).content;
		for (const replacement of rule.postRewrites ?? []) {
			const replacementCount = countOccurrences(targetBlock, replacement.from);
			if (replacementCount === 0 && !replacement.optional) {
				throw new Error(`registration post-rewrite source is missing in ${rule.file}`);
			}
			targetBlock = targetBlock.replaceAll(replacement.from, replacement.to);
		}
		assertNoSourceIdentifiers(targetBlock, source, rule.file);
		return {
			content: `${content.slice(0, end)}\n${targetBlock}${content.slice(end)}`,
			insertedCount: 1,
		};
	}

	if (rule.kind === "matching-lines") {
		if (content.includes(rule.targetMarker)) {
			throw new Error(`target registration already exists in ${rule.file}`);
		}
		let insertedCount = 0;
		const lines = content.split("\n").flatMap((line) => {
			if (!line.includes(rule.sourceMarker)) return [line];
			insertedCount += 1;
			const targetLine = rewriteText(line, rewriteRules).content;
			return rule.replaceSource ? [targetLine] : [line, targetLine];
		});
		if (insertedCount === 0 && !rule.optional) {
			throw new Error(
				`registration source lines are missing in ${rule.file}: ${rule.sourceMarker}`,
			);
		}
		return { content: lines.join("\n"), insertedCount };
	}

	if (rule.kind === "array-object-all") {
		const { objects } = extractArrayObjects(content, rule.arrayStart);
		if (objects.some((entry) => entry.content.includes(rule.targetMarker))) {
			throw new Error(`target registration already exists in ${rule.file}`);
		}
		const matches = objects.filter((entry) => entry.content.includes(rule.sourceMarker));
		if (matches.length === 0) {
			if (rule.optional) return { content, insertedCount: 0 };
			throw new Error(`registration source objects are missing in ${rule.file}`);
		}
		const targetBlocks = matches.map((entry) => {
			let targetBlock = rewriteText(entry.content, rewriteRules).content;
			for (const replacement of rule.postRewrites ?? []) {
				const replacementCount = countOccurrences(targetBlock, replacement.from);
				if (replacementCount === 0 && !replacement.optional) {
					throw new Error(`registration post-rewrite source is missing in ${rule.file}`);
				}
				targetBlock = targetBlock.replaceAll(replacement.from, replacement.to);
			}
			return `${entry.indent}${targetBlock}`;
		});
		for (const targetBlock of targetBlocks) {
			assertNoSourceIdentifiers(targetBlock, source, rule.file);
		}
		const insertionIndex = matches.at(-1).end;
		return {
			content: `${content.slice(0, insertionIndex)}\n${targetBlocks.join("\n")}${content.slice(insertionIndex)}`,
			insertedCount: targetBlocks.length,
		};
	}

	if (rule.kind === "json-object-entries") {
		// Copies every entry of one JSON object (for example the lazy-load heavy-reach
		// baseline) whose key names the source variant, under the rewritten key.
		const document = JSON.parse(content);
		const table = document?.[rule.objectKey];
		if (!table || typeof table !== "object" || Array.isArray(table)) {
			throw new Error(`registration object ${rule.objectKey} is missing in ${rule.file}`);
		}
		const keys = Object.keys(table);
		if (keys.some((key) => key.includes(rule.targetMarker))) {
			throw new Error(`target registration already exists in ${rule.file}`);
		}
		const matches = keys.filter((key) => key.includes(rule.sourceMarker));
		if (matches.length === 0) {
			if (rule.optional) return { content, insertedCount: 0 };
			throw new Error(`registration source entries are missing in ${rule.file}`);
		}
		const additions = matches.map((key) => {
			const targetKey = rewriteText(key, rewriteRules).content;
			assertNoSourceIdentifiers(targetKey, source, rule.file);
			return [targetKey, structuredClone(table[key])];
		});
		document[rule.objectKey] = Object.fromEntries(
			[...Object.entries(table), ...additions].sort(([left], [right]) => left.localeCompare(right)),
		);
		return {
			content: `${JSON.stringify(document, null, "\t")}\n`,
			insertedCount: additions.length,
		};
	}

	throw new Error(`unsupported registration kind: ${rule.kind}`);
}
