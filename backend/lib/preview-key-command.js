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
 * no key. agent-browser's keydown/keyup take a bare key and keep no modifier state, so a
 * modified key goes out as one `press Shift+Tab` on keyDown and its keyUp sends nothing.
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
	if (modifierNames.length > 0) {
		if (eventType === "keyUp") {
			return null
		}
		const pressKey = value === " " ? "Space" : value
		return ["press", requirePreviewKey(`${modifierNames.join("+")}+${pressKey}`)]
	}

	return [eventType === "keyUp" ? "keyup" : "keydown", requireBrowserArgument(value, "A key")]
}

module.exports = { resolvePreviewKeyCommand }
