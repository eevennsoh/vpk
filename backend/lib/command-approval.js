/**
 * Dangerous command approval for tool inputs.
 *
 * Detects destructive command patterns (rm -rf, sudo, DROP TABLE, etc.)
 * in tool call arguments before execution. Used by this repository's backend
 * to flag or pause dangerous operations from Rovo Serve tool calls.
 */

/**
 * @typedef {{ pattern: RegExp, label: string }} DangerousPattern
 * @typedef {{ label: string, match: string }} ClassifiedCommand
 */

/** @type {DangerousPattern[]} */
const DEFAULT_DANGEROUS_PATTERNS = [
	{ pattern: /rm\s+(-\w*r\w*|-\w*f\w*r\w*|--recursive)/giu, label: "Recursive delete" },
	{ pattern: /sudo\s+/giu, label: "Privileged execution" },
	{ pattern: /DROP\s+(TABLE|DATABASE)\s+/giu, label: "SQL drop" },
	{ pattern: /TRUNCATE\s+(TABLE\s+)?/giu, label: "SQL truncate" },
	{ pattern: /kill\s+-9\s+/giu, label: "Force kill" },
	{ pattern: /chmod\s+777\s+/giu, label: "World-writable permissions" },
	{ pattern: /mkfs\./giu, label: "Filesystem format" },
	{ pattern: /dd\s+if=/giu, label: "Raw disk write" },
	{ pattern: />\s*\/dev\//giu, label: "Device write" },
	{ pattern: /git\s+push\s+.*--force/giu, label: "Force push" },
	{ pattern: /git\s+reset\s+--hard/giu, label: "Hard reset" },
];

/**
 * Check whether a command string matches any dangerous pattern.
 *
 * @param {string} command - The command string to check.
 * @param {DangerousPattern[]} [extraPatterns] - Additional patterns beyond defaults.
 * @param {Set<string>} [allowlist] - Commands that bypass detection.
 * @returns {boolean} True if the command is dangerous and not allowlisted.
 */
function isDangerousCommand(command, extraPatterns, allowlist) {
	if (typeof command !== "string" || command.length === 0) {
		return false;
	}

	if (allowlist && allowlist.has(command)) {
		return false;
	}

	const allPatterns = extraPatterns
		? [...DEFAULT_DANGEROUS_PATTERNS, ...extraPatterns]
		: DEFAULT_DANGEROUS_PATTERNS;

	for (const { pattern } of allPatterns) {
		pattern.lastIndex = 0;
		if (pattern.test(command)) {
			return true;
		}
	}

	return false;
}

/**
 * Classify a command and return the first matching dangerous pattern.
 *
 * @param {string} command - The command string to classify.
 * @param {DangerousPattern[]} [extraPatterns] - Additional patterns beyond defaults.
 * @param {Set<string>} [allowlist] - Commands that bypass detection.
 * @returns {ClassifiedCommand | null} Details of the match, or null if safe.
 */
function classifyCommand(command, extraPatterns, allowlist) {
	if (typeof command !== "string" || command.length === 0) {
		return null;
	}

	if (allowlist && allowlist.has(command)) {
		return null;
	}

	const allPatterns = extraPatterns
		? [...DEFAULT_DANGEROUS_PATTERNS, ...extraPatterns]
		: DEFAULT_DANGEROUS_PATTERNS;

	for (const { pattern, label } of allPatterns) {
		pattern.lastIndex = 0;
		const match = pattern.exec(command);
		if (match) {
			return { label, match: match[0] };
		}
	}

	return null;
}

/**
 * Extract command string from tool call arguments.
 * Handles dict-style args ({command: "..."}) and plain strings.
 *
 * @param {object | string} args - The tool call arguments.
 * @returns {string | null} The command string, or null if not extractable.
 */
function extractCommandFromArgs(args) {
	if (typeof args === "string") {
		return args;
	}

	if (args && typeof args === "object") {
		for (const key of ["command", "cmd", "script", "code"]) {
			if (typeof args[key] === "string") {
				return args[key];
			}
		}
	}

	return null;
}

module.exports = {
	DEFAULT_DANGEROUS_PATTERNS,
	classifyCommand,
	extractCommandFromArgs,
	isDangerousCommand,
};
