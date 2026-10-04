import type { FileUIPart } from "ai";
import { nanoid } from "nanoid";

export type PromptInputAttachment = FileUIPart & { id: string };

export interface PromptInputAttachmentError {
	code: "max_files" | "max_file_size" | "accept";
	message: string;
}

export interface PromptInputAttachmentLimits {
	accept?: string;
	maxFiles?: number;
	maxFileSize?: number;
	onError?: (error: PromptInputAttachmentError) => void;
}

type Admission =
	| { kind: "rejected"; error: PromptInputAttachmentError }
	| { kind: "admitted"; files: File[]; warning: PromptInputAttachmentError | null };

function admitFiles(incoming: File[], currentCount: number, limits: PromptInputAttachmentLimits): Admission {
	const patterns = limits.accept?.split(",").map((pattern) => pattern.trim()).filter(Boolean);
	const accepted = incoming.filter((file) => (
		!limits.accept?.trim() || patterns?.some((pattern) => (
			pattern.endsWith("/*") ? file.type.startsWith(pattern.slice(0, -1)) : file.type === pattern
		))
	));
	if (incoming.length > 0 && accepted.length === 0) {
		return { kind: "rejected", error: { code: "accept", message: "No files match the accepted types." } };
	}
	const sized = accepted.filter((file) => !limits.maxFileSize || file.size <= limits.maxFileSize);
	if (accepted.length > 0 && sized.length === 0) {
		return { kind: "rejected", error: { code: "max_file_size", message: "All files exceed the maximum size." } };
	}
	const capacity = typeof limits.maxFiles === "number" ? Math.max(0, limits.maxFiles - currentCount) : undefined;
	return {
		kind: "admitted",
		files: typeof capacity === "number" ? sized.slice(0, capacity) : sized,
		warning: typeof capacity === "number" && sized.length > capacity
			? { code: "max_files", message: "Too many files. Some were not added." }
			: null,
	};
}

export function createPromptInputAttachmentStore() {
	let files: PromptInputAttachment[] = [];
	const listeners = new Set<() => void>();
	const publish = (nextFiles: PromptInputAttachment[]) => {
		files = nextFiles;
		for (const listener of listeners) {
			listener();
		}
	};
	const revoke = (attachments: PromptInputAttachment[]) => {
		for (const attachment of attachments) {
			URL.revokeObjectURL(attachment.url);
		}
	};

	return {
		getSnapshot: () => files,
		subscribe: (listener: () => void) => {
			listeners.add(listener);
			return () => { listeners.delete(listener); };
		},
		add: (incoming: File[] | FileList, limits: PromptInputAttachmentLimits = {}) => {
			const admission = admitFiles([...incoming], files.length, limits);
			if (admission.kind === "rejected") {
				limits.onError?.(admission.error);
				return;
			}
			if (admission.warning) {
				limits.onError?.(admission.warning);
			}
			if (admission.files.length === 0) {
				return;
			}
			const added: PromptInputAttachment[] = [];
			try {
				for (const file of admission.files) {
					added.push({
						filename: file.name,
						id: nanoid(),
						mediaType: file.type,
						type: "file",
						url: URL.createObjectURL(file),
					});
				}
			} catch (error) {
				revoke(added);
				throw error;
			}
			publish([...files, ...added]);
		},
		remove: (id: string) => {
			const removed = files.filter((file) => file.id === id);
			if (removed.length === 0) {
				return;
			}
			revoke(removed);
			publish(files.filter((file) => file.id !== id));
		},
		clear: () => {
			if (files.length === 0) {
				return;
			}
			revoke(files);
			publish([]);
		},
	};
}

export type PromptInputAttachmentStore = ReturnType<typeof createPromptInputAttachmentStore>;
