const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");
const { compile } = require("tailwindcss");
const postcss = require("postcss");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

test("compiled disclosure height and chevron transitions apply only when motion is allowed", async () => {
	const view = await renderComponent({
		entry: "app/sandbox/agent-selector-canvas/teammate-session-disclosure.tsx", exportName: "TeammateSessionDisclosure",
		props: { approach: "quiet", items: [] },
	});
	try {
		const trigger = view.getByRole("button", { name: /Sessions from your teammates/u });
		await view.click(trigger);
		const panel = view.container.querySelector('[data-slot="collapsible-content"]');
		const chevron = trigger.querySelector('[data-slot="icon"]');
		const theme = path.resolve(__dirname, "../../tailwind-theme.css");
		const compiler = await compile(`${await fs.readFile(theme, "utf8")}\n@tailwind utilities;`, {
			base: path.dirname(theme),
			loadStylesheet: async (id, base) => {
				const file = path.resolve(base, id);
				return { path: file, base: path.dirname(file), content: await fs.readFile(file, "utf8") };
			},
		});
		const css = postcss.parse(compiler.build([...panel.classList, ...chevron.classList]));
		const guarded = [];
		css.walkDecls(/^transition-(property|duration|timing-function)$/u, (declaration) => {
			let parent = declaration.parent;
			while (parent && !(parent.type === "atrule" && parent.name === "media" && parent.params === "(prefers-reduced-motion: no-preference)")) parent = parent.parent;
			guarded.push(parent !== undefined);
		});
		assert.equal(guarded.length >= 6, true, "height, chevron and enter/exit timing utilities must compile");
		assert.equal(guarded.every(Boolean), true, "no disclosure transition may run in reduced motion");
	} finally { await view.unmount(); }
});
