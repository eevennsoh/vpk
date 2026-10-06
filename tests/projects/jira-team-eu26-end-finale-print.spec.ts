import { buildSync } from "esbuild";
import { expect, test } from "@playwright/test";

const captureScript = buildSync({
	stdin: { contents: 'export { printFinaleElement } from "./components/projects/jira-team-eu26-end/finale/hooks/use-finale-prints";', resolveDir: process.cwd(), loader: "ts" },
	bundle: true,
	format: "iife",
	globalName: "finaleCapture",
	platform: "browser",
	define: { "process.env.NODE_ENV": '"production"' },
	write: false,
}).outputFiles[0].text;

declare global {
	interface Window {
		finaleCapture: { printFinaleElement: (element: HTMLElement, options: { detach: boolean }) => Promise<HTMLCanvasElement> };
	}
}

test("finale snapshots preserve the live font sizes and text widths through rasterization", async ({ page }) => {
	await page.setContent(`<div id="face" style="width:560px;height:220px;font-family:Arial;background:white">
		<div><span data-sample="work" style="font-size:24.643px">Work</span></div>
		<div><span data-sample="legend" style="font-size:14.985px">40.3K sessions</span></div>
		<div><span data-sample="sessions" style="font-size:23.341px">Jordan Okafor</span></div>
	</div>`);
	await page.addScriptTag({ content: captureScript });
	const result = await page.evaluate(async () => {
		const source = document.getElementById("face");
		if (!source) throw new Error("Missing capture fixture");
		const sizes = (root: Element) => [...root.querySelectorAll("[data-sample]")].map((element) => ({
			font: getComputedStyle(element).fontSize,
			width: element.getBoundingClientRect().width,
		}));
		const live = sizes(source);
		const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
		const setSource = descriptor?.set;
		if (!descriptor || !setSource) throw new Error("Image source setter unavailable");
		let svg = "";
		Object.defineProperty(HTMLImageElement.prototype, "src", {
			...descriptor,
			set(value: string) {
				if (value.startsWith("data:image/svg+xml")) svg = value;
				setSource.call(this, value);
			},
		});
		try {
			await window.finaleCapture.printFinaleElement(source, { detach: true });
		} finally {
			Object.defineProperty(HTMLImageElement.prototype, "src", descriptor);
		}
		if (!svg) throw new Error("The capture never rasterized an SVG");
		const rendered = document.createElement("div");
		rendered.innerHTML = decodeURIComponent(svg.slice(svg.indexOf(",") + 1));
		document.body.append(rendered);
		return { live, printed: sizes(rendered), sourceMutated: source.querySelector("[data-finale-print-font]") !== null };
	});
	expect(result.sourceMutated).toBe(false);
	expect(result.printed.map((entry) => entry.font)).toEqual(["24.643px", "14.985px", "23.341px"]);
	for (let index = 0; index < result.live.length; index += 1) {
		expect(result.printed[index].width).toBeCloseTo(result.live[index].width, 2);
	}
});
