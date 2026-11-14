export const DEFAULT_DESCRIPTION = "Generated from your request";

const SYSTEM_INSTRUCTIONS_BLOCK_PATTERN =
	/\[\s*System Instructions\s*\][\s\S]*?\[\s*End System Instructions\s*\]/gi;
const SYSTEM_INSTRUCTIONS_MARKER_PATTERN =
	/\[\s*(?:End\s+)?System Instructions\s*\]/gi;
const LEAKED_SYSTEM_PROMPT_PATTERN =
	/^you are (?:an?|the)\s+(?:ui generator|helpful assistant)\b/i;

export function isObjectRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function stripSystemInstructionArtifacts(value: string): string {
	return value
		.replace(SYSTEM_INSTRUCTIONS_BLOCK_PATTERN, " ")
		.replace(SYSTEM_INSTRUCTIONS_MARKER_PATTERN, " ");
}

export function getNonEmptyString(value: unknown): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}

	const trimmed = stripSystemInstructionArtifacts(value).trim();
	if (LEAKED_SYSTEM_PROMPT_PATTERN.test(trimmed)) {
		return undefined;
	}
	return trimmed.length > 0 ? trimmed : undefined;
}

export function readFirstNonEmptyString(
	record: Record<string, unknown>,
	keys: readonly string[]
): string | undefined {
	for (const key of keys) {
		const value = getNonEmptyString(record[key]);
		if (value) {
			return value;
		}
	}

	return undefined;
}

export function clipText(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text;
	}

	return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}
