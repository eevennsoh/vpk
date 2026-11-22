const { requireBrowserArgument, requirePreviewKey } = require("./input-schemas")

// Modifier flags in the order the preview's press strings use (`Control+Meta+Alt+Shift+Tab`).
const PREVIEW_KEY_MODIFIERS = [
	["ctrlKey", "Control"],
	["metaKey", "Meta"],
	["altKey", "Alt"],
	["shiftKey", "Shift"],
]

/**
 * The agent-browser arguments for one forwarded preview key event, or null when there is
 * no key. agent-browser's keydown/keyup take a bare key, keep no modifier state, and do
 * not insert printable text. Modified and printable keys go out as one `press` on
 * keyDown; their keyUp sends nothing.
 * A modifier key's own flag is dropped (pressing Shift reports `shiftKey`), so a lone
 * Shift stays a plain keydown/keyup. Messages without modifiers read as unmodified.
 * @param {{ eventType?: unknown, key?: unknown, code?: unknown, text?: unknown, modifiers?: Record<string, unknown> }} event
 * @returns {string[] | null}
 */
function resolvePreviewKeyCommand({ eventType, key, code, text, modifiers }) {
	const value =
		typeof key === "string" && key
			? key
			: typeof text === "string" && text
				? text
				: typeof code === "string" && code
					? code
					: null
	if (!value) {
		return null
	}

	const modifierNames = modifiers && typeof modifiers === "object"
		? PREVIEW_KEY_MODIFIERS.filter(([flag, name]) => modifiers[flag] === true && name !== value).map(([, name]) => name)
		: []
	const isPrintable = value === " " || (value.length === 1 && !/[\p{Cc}\p{Cs}\p{Z}]/u.test(value))
	if (modifierNames.length > 0 || isPrintable) {
		if (eventType === "keyUp") {
			return null
		}
		const pressKey = value === " " ? "Space" : value
		const shortcut = modifierNames.length > 0 ? `${modifierNames.join("+")}+${pressKey}` : pressKey
		return ["press", requirePreviewKey(shortcut)]
	}

	return [eventType === "keyUp" ? "keyup" : "keydown", requireBrowserArgument(value, "A key")]
}

module.exports = { resolvePreviewKeyCommand }
