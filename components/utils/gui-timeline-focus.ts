export function restoreGUITimelineFocus(root: HTMLElement) {
	const document = root.ownerDocument;
	const pendingRestorations = new Set<ReturnType<typeof setTimeout>>();
	type Opener = { clip: HTMLElement; section: HTMLElement; label: string | null; index: number };
	const openers = new WeakMap<HTMLElement, Opener>();
	let pendingOpener: Opener | undefined;
	const rememberOpener = (event: Event) => {
		if (event instanceof KeyboardEvent && event.key !== "Enter" && event.key !== " ") return;
		const clip = event.target instanceof Element ? event.target.closest<HTMLElement>(".dialkit-timeline-clip") : null;
		const section = clip?.closest<HTMLElement>(".dialkit-timeline-section");
		if (clip && section && root.contains(section)) {
			pendingOpener = { clip, section, label: clip.getAttribute("aria-label"), index: [...section.querySelectorAll(".dialkit-timeline-clip")].indexOf(clip) };
		}
	};
	const popupObserver = new MutationObserver((records) => {
		if (!pendingOpener) return;
		for (const record of records) {
			for (const node of record.addedNodes) {
				if (!(node instanceof HTMLElement)) continue;
				const popup = node.matches(".dialkit-timeline-popover") ? node : node.querySelector<HTMLElement>(".dialkit-timeline-popover");
				if (!popup || !popup.contains(document.activeElement) || !popup.getAttribute("aria-label")?.startsWith(pendingOpener.label ?? "")) continue;
				openers.set(popup, pendingOpener);
				pendingOpener = undefined;
				return;
			}
		}
	});
	popupObserver.observe(document.body, { childList: true });
	const restoreAfterDismissal = (popup: HTMLElement) => {
		const origin = openers.get(popup);
		if (!origin) return;
		const timer = setTimeout(() => {
			pendingRestorations.delete(timer);
			if (popup.isConnected || !root.isConnected || !origin.section.isConnected || document.activeElement !== document.body) return;
			const clips = [...origin.section.querySelectorAll<HTMLElement>(".dialkit-timeline-clip")];
			const current = clips[origin.index];
			const clip = origin.clip.isConnected ? origin.clip : current?.getAttribute("aria-label") === origin.label ? current : clips.find((candidate) => candidate.getAttribute("aria-label") === origin.label);
			clip?.focus({ preventScroll: true });
		}, 0);
		pendingRestorations.add(timer);
	};
	const handleKey = (event: KeyboardEvent) => {
		if (event.key !== "Escape" || !(event.target instanceof Element)) return;
		const popup = event.target.closest<HTMLElement>(".dialkit-timeline-popover");
		if (popup) restoreAfterDismissal(popup);
	};
	const handleClose = (event: MouseEvent) => {
		if (!(event.target instanceof Element) || !event.target.closest(".dialkit-timeline-popover-close")) return;
		const popup = event.target.closest<HTMLElement>(".dialkit-timeline-popover");
		if (popup) restoreAfterDismissal(popup);
	};
	root.addEventListener("keydown", rememberOpener, true);
	root.addEventListener("pointerdown", rememberOpener, true);
	document.addEventListener("keydown", handleKey, true);
	document.addEventListener("click", handleClose, true);
	return () => {
		popupObserver.disconnect();
		pendingRestorations.forEach((timer) => clearTimeout(timer));
		pendingRestorations.clear();
		root.removeEventListener("keydown", rememberOpener, true);
		root.removeEventListener("pointerdown", rememberOpener, true);
		document.removeEventListener("keydown", handleKey, true);
		document.removeEventListener("click", handleClose, true);
	};
}
