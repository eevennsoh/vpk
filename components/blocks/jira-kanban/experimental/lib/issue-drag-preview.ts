/** Keep the attached-session backdrop around an issue-only native preview. */
export function createIssueDragPreview(card: HTMLElement): HTMLElement {
	const shell = card.closest<HTMLElement>('[data-slot="jira-issue-agent-shell"]');
	const backdrop = shell?.querySelector<HTMLElement>('[data-slot="jira-issue-agent-backdrop"]');
	const surface = card.querySelector<HTMLElement>('[data-slot="jira-issue-surface"]');
	if (!shell || !backdrop || !surface) return card;

	const bounds = card.getBoundingClientRect();
	const inset = surface.getBoundingClientRect().top - bounds.top;
	if (inset <= 0) return card;

	// Clone the existing chrome without the session chin. Extending only the
	// preview preserves the issue body's size and the source board's geometry.
	const preview = shell.cloneNode(false) as HTMLElement;
	const body = card.cloneNode(true) as HTMLElement;
	const sourceNodes = [card, ...card.querySelectorAll<HTMLElement | SVGElement>("*")];
	const previewNodes = [body, ...body.querySelectorAll<HTMLElement | SVGElement>("*")];
	// The offscreen clone cannot inherit the source's hover/focus state. Freeze
	// its painted appearance so revealed actions and chrome survive the lift.
	sourceNodes.forEach((source, index) => {
		const appearance = getComputedStyle(source);
		Object.assign(previewNodes[index].style, {
			opacity: appearance.opacity,
			visibility: appearance.visibility,
			color: appearance.color,
			backgroundColor: appearance.backgroundColor,
			borderColor: appearance.borderColor,
			boxShadow: appearance.boxShadow,
		});
	});
	preview.setAttribute("aria-hidden", "true");
	preview.inert = true;
	preview.dataset.issueDragPreview = "";
	Object.assign(preview.style, {
		position: "fixed",
		left: "-10000px",
		top: "0",
		width: `${bounds.width}px`,
		height: `${bounds.height + inset}px`,
		padding: "0",
		transform: "none",
		opacity: "1",
		pointerEvents: "none",
	});
	Object.assign(body.style, {
		height: `${bounds.height}px`,
		transform: "none",
	});
	preview.append(backdrop.cloneNode(true), body);
	card.ownerDocument.body.append(preview);
	return preview;
}
