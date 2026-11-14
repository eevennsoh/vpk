// Text rewriting and identity checks shared by the Jira variant scaffolder and its
// registration rules.

export function countOccurrences(content, value) {
	if (!value) return 0;
	let count = 0;
	let cursor = 0;
	while (true) {
		const index = content.indexOf(value, cursor);
		if (index < 0) return count;
		count += 1;
		cursor = index + value.length;
	}
}

export function rewriteText(content, rewriteRules) {
	let output = content;
	let rewriteCount = 0;
	for (const { from, to } of rewriteRules) {
		const count = countOccurrences(output, from);
		if (count === 0) continue;
		output = output.replaceAll(from, to);
		rewriteCount += count;
	}
	return { content: output, rewriteCount };
}

function sourceIdentifiers(identity) {
	return [
		identity.pascal,
		identity.upper,
		identity.camel,
		identity.title,
		identity.slug,
		identity.experimentalPascal,
		identity.experimentalUpper,
		identity.experimentalCamel,
		identity.experimentalSlug,
		identity.version,
	].sort((left, right) => right.length - left.length || left.localeCompare(right));
}

function targetIdentifiers(identity) {
	return sourceIdentifiers(identity);
}

export function assertNoAmbiguousTargetIdentifiers(content, target, filePath) {
	const identifier = targetIdentifiers(target).find((candidate) => content.includes(candidate));
	if (identifier) {
		throw new Error(
			`ambiguous rewrite in ${filePath}: source content already contains target identifier ${identifier}`,
		);
	}
}

export function assertNoSourceIdentifiers(content, source, filePath) {
	const identifier = sourceIdentifiers(source).find((candidate) => content.includes(candidate));
	if (identifier) {
		throw new Error(`unresolved source identifier in ${filePath}: ${identifier}`);
	}
}
