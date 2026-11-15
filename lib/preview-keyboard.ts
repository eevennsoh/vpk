type ModifierKeyEvent = Pick<KeyboardEvent, "altKey" | "ctrlKey" | "key" | "metaKey" | "shiftKey">;

const hasModifier = (event: ModifierKeyEvent) => event.altKey || event.ctrlKey || event.metaKey;

/**
 * What a remote-preview viewport does with a keydown:
 * - `forward`: send the key to the remote page.
 * - `leave`: plain Tab/Shift+Tab while not captured; the browser moves focus out (WCAG 2.1.2).
 * - `start`: plain Enter while not captured and not yet engaged starts capture and is not forwarded.
 * - `release`: plain Escape while captured releases capture and is not forwarded, so while
 *   captured the remote page never receives a plain Escape (release first, then press Escape).
 */
export type PreviewKeyCaptureResolution = "forward" | "leave" | "start" | "release";

export interface PreviewKeyCaptureState {
	/** True while every key, including Tab, is forwarded to the remote page. */
	captured: boolean;
	/**
	 * True once the user has worked inside the viewport since it last gained focus (a pointer
	 * press or any forwarded key). An engaged viewport forwards Enter, so a mouse user who clicks
	 * a field and types can submit it; Enter only starts capture on a viewport reached by keyboard.
	 */
	engaged: boolean;
}

export function resolvePreviewKeyCaptureKey(
	event: ModifierKeyEvent,
	{ captured, engaged }: PreviewKeyCaptureState,
): PreviewKeyCaptureResolution {
	const plain = !hasModifier(event) && !event.shiftKey;
	if (captured) {
		return event.key === "Escape" && plain ? "release" : "forward";
	}
	if (event.key === "Tab" && !hasModifier(event)) {
		return "leave";
	}
	return event.key === "Enter" && plain && !engaged ? "start" : "forward";
}

/** Screen-reader hint for preview viewports, referenced through aria-describedby. */
export const PREVIEW_KEYBOARD_HINT =
	"Keys are sent to the page. Press Tab to leave the preview. To send every key, including Tab, press Enter when you first reach the preview or use Capture keys; press Escape to release them. Escape is not sent to the page while keys are captured.";

export const PREVIEW_KEY_CAPTURE_STARTED_MESSAGE = "Keyboard captured — press Escape to release";
export const PREVIEW_KEY_CAPTURE_RELEASED_MESSAGE = "Keyboard released — press Tab to leave the preview";
/** Announced when capture ends because focus left the viewport; Tab advice would be stale. */
export const PREVIEW_KEY_CAPTURE_BLUR_RELEASED_MESSAGE = "Keyboard released";
