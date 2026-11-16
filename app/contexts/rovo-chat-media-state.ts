import type { RovoUIMessage } from "@/lib/rovo-ui-messages";

const MEDIA_WIDGET_TYPES = new Set(["image-preview", "audio-preview", "video-preview"]);

/**
 * The loading state of the latest media widget (image, audio or video) on the
 * latest assistant message, or null when that message has none. User messages
 * are skipped, so an unfinished widget from the previous turn still counts
 * until a newer assistant message arrives.
 */
export function findLatestMediaLoadingState(messages: ReadonlyArray<RovoUIMessage>): boolean | null {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message.role !== "assistant") {
			continue;
		}

		let loading: boolean | null = null;
		for (const part of message.parts) {
			if (part.type !== "data-widget-loading") {
				continue;
			}
			const data = (part as { data?: { type?: string; loading?: boolean } }).data;
			if (data?.type && MEDIA_WIDGET_TYPES.has(data.type)) {
				loading = !!data.loading;
			}
		}
		return loading;
	}

	return null;
}
