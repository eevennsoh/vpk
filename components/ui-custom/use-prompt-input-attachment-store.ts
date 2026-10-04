"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
	createPromptInputAttachmentStore,
	type PromptInputAttachmentStore,
} from "@/lib/prompt-input-attachments";

export function usePromptInputAttachmentStore(providedStore?: PromptInputAttachmentStore | null) {
	const [initialStore] = useState(() => providedStore ?? createPromptInputAttachmentStore());
	const store = providedStore ?? initialStore;
	const files = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

	useEffect(() => {
		if (providedStore) {
			return;
		}
		return () => store.clear();
	}, [providedStore, store]);

	return { files, store };
}
