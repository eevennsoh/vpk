// hairline/runtime/boot — mounts every hairline host on the page with the figures this page's bundle carries.
// A host is `<div data-vpk-hairline="<id>">` inside a `[data-vpk-engine="hairline"]` plate; the figure's onRead
// caption goes to the plate's `[data-vpk-hairline-read]` readout. A host already mounted is left alone.
export function boot(figures) {
	for (const host of document.querySelectorAll("[data-vpk-hairline]")) {
		const make = figures[host.getAttribute("data-vpk-hairline")];
		if (!make || host.hasAttribute("data-hairline")) continue;
		const readout = host.closest('[data-vpk-engine="hairline"]')?.querySelector("[data-vpk-hairline-read]");
		make(host, {
			onRead: text => {
				if (readout) readout.textContent = text;
			},
		});
	}
}
