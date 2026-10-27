import { DialStore, TimelineStore, type ControlMeta } from "dialkit/vanilla";

function findControl(controls: readonly ControlMeta[], path: string): ControlMeta | undefined {
	for (const control of controls) {
		if (control.path === path) return control;
		const nested = findControl(control.children ?? [], path);
		if (nested) return nested;
	}
}

export function deduplicateGUITimelineFromFolders(root: HTMLElement) {
	let pending: { label: string; from: ControlMeta } | undefined;
	const observed = new Map<HTMLElement, MutationObserver>();
	const rememberClip = (event: Event) => {
		const clip = event.target instanceof Element ? event.target.closest<HTMLElement>(".dialkit-timeline-clip") : null;
		const section = clip?.closest<HTMLElement>(".dialkit-timeline-section");
		if (!clip || !section || !root.contains(section)) return;
		pending = undefined;
		const index = [...root.querySelectorAll(".dialkit-timeline-section")].indexOf(section);
		const meta = TimelineStore.getTimelines()[index];
		if (!meta || section.querySelector(".dialkit-timeline-title")?.textContent !== meta.name) return;
		const matches = meta.clips.filter((candidate) => `Edit ${candidate.label}` === clip.getAttribute("aria-label"));
		if (matches.length !== 1) return;
		const [matched] = matches;
		if (matched.stepKeys !== undefined || matched.tracks !== undefined) return;
		const from = findControl(DialStore.getPanel(meta.id)?.controls ?? [], `${matched.key}.from`);
		if (from?.type === "folder") pending = { label: `Edit ${matched.label}`, from };
	};
	const repairPopup = (popup: HTMLElement, from: ControlMeta) => {
		const body = popup.querySelector<HTMLElement>(".dialkit-timeline-popover-body");
		if (!body) return;
		const repair = () => {
			const folders = [...body.children].filter((child): child is HTMLElement => child instanceof HTMLElement
				&& child.classList.contains("dialkit-folder")
				&& child.querySelector(":scope > .dialkit-folder-header > .dialkit-folder-header-top")?.getAttribute("aria-label") === from.label);
			if (folders.length === 2) folders[1].remove();
		};
		repair();
		const observer = new MutationObserver(repair);
		observer.observe(body, { childList: true });
		observed.set(popup, observer);
	};
	const document = root.ownerDocument;
	const observer = new MutationObserver((records) => {
		for (const [popup, popupObserver] of observed) {
			if (!popup.isConnected) {
				popupObserver.disconnect();
				observed.delete(popup);
			}
		}
		if (!pending) return;
		const origin = pending;
		for (const record of records) {
			for (const node of record.addedNodes) {
				if (!(node instanceof HTMLElement)) continue;
				const popup = node.querySelector<HTMLElement>(".dialkit-timeline-popover");
				if (popup?.getAttribute("aria-label") === origin.label && !observed.has(popup)) {
					repairPopup(popup, origin.from);
					pending = undefined;
					return;
				}
			}
		}
	});
	observer.observe(document.body, { childList: true });
	root.addEventListener("keydown", rememberClip, true);
	root.addEventListener("pointerdown", rememberClip, true);
	return () => {
		observer.disconnect();
		observed.forEach((popupObserver) => popupObserver.disconnect());
		observed.clear();
		root.removeEventListener("keydown", rememberClip, true);
		root.removeEventListener("pointerdown", rememberClip, true);
	};
}
