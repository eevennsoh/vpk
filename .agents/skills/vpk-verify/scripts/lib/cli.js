"use strict";

// Argument parsing and output helpers shared by control-vpk subcommands.

// Expected input errors print without a stack trace.
function usageError(message, usageText) {
	return Object.assign(new Error(usageText ? `${message}\n${usageText}` : message), { expected: true });
}

function splitOptions(args, { booleanFlags, usageText, valueFlags }) {
	const flags = {};
	const positional = [];
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (!arg.startsWith("--")) {
			positional.push(arg);
			continue;
		}
		const equalsIndex = arg.indexOf("=");
		const name = equalsIndex === -1 ? arg : arg.slice(0, equalsIndex);
		if (booleanFlags.includes(name) && equalsIndex === -1) {
			flags[name] = true;
		} else if (valueFlags.includes(name)) {
			const inline = equalsIndex !== -1;
			const value = inline ? arg.slice(equalsIndex + 1) : args[index + 1];
			if (!inline) index += 1;
			if (typeof value !== "string" || value === "" || (!inline && value.startsWith("--"))) {
				throw usageError(`${name} requires a value.`, usageText);
			}
			flags[name] = value;
		} else {
			throw usageError(`Unknown option: ${arg}`, usageText);
		}
	}
	return { flags, positional };
}

function plural(count, noun) {
	return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

module.exports = {
	plural,
	splitOptions,
	usageError,
};
