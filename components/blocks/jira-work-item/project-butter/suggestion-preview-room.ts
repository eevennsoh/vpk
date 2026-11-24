/**
 * The bottom padding a scrollport can keep after a suggestion preview ends without moving what the reader sees: the
 * room below the viewport is dropped, the room still on screen stays. Returns null once nothing beyond `minimum` is
 * needed, so the original padding can come back.
 */
export function releasedPreviewPadding(port: Readonly<{ padding: number; minimum: number; scrollHeight: number; scrollTop: number; clientHeight: number }>): number | null {
	const slack = port.scrollHeight - port.scrollTop - port.clientHeight;
	const next = port.padding - slack;
	return next > port.minimum ? next : null;
}
