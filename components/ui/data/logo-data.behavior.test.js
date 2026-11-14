// Product logos load their own @atlaskit/logo entrypoint on first render instead of the package
// barrel. Each lazy logo must render exactly what the barrel export of the same name renders
// (including the names the barrel aliases), and hold its square box while it loads.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const PARITY_PROBE = `
import * as Barrel from "@atlaskit/logo";
import { LOGO_ICON_COMPONENTS, LOGO_LOCKUP_COMPONENTS } from "@/components/ui/data/logo-data";

const pascal = (name) => name.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join("");
const ROWS = Object.keys(LOGO_ICON_COMPONENTS).flatMap((name) => [
	{ key: name + ":icon", Lazy: LOGO_ICON_COMPONENTS[name], Eager: Barrel[pascal(name) + "Icon"] },
	{ key: name + ":lockup", Lazy: LOGO_LOCKUP_COMPONENTS[name], Eager: Barrel[pascal(name) + "Logo"] ?? Barrel[pascal(name) + "Icon"] },
]);

export default function Probe() {
	return ROWS.map(({ key, Lazy, Eager }) => (
		<div data-row={key} key={key}>
			<div data-side="lazy"><Lazy label="" shouldUseHexLogo shouldUseNewLogoDesign size="small" /></div>
			<div data-side="eager">{Eager ? <Eager label="" shouldUseHexLogo shouldUseNewLogoDesign size="small" /> : null}</div>
		</div>
	));
}
`;

test("every lazy product logo renders what the barrel export of the same name renders", async () => {
	const view = await renderComponent({ source: PARITY_PROBE });
	for (let attempt = 0; attempt < 10; attempt += 1) await view.rerender({});
	// Gradient ids carry React's useId, which differs between the two renders.
	const normalize = (html) => html.replace(/_r_[0-9a-z]+_/gu, "_r_");
	const rows = [...view.container.querySelectorAll("[data-row]")];
	assert.ok(rows.length >= 80, `rows: ${rows.length}`);
	const mismatched = rows.filter((row) => {
		const lazy = row.querySelector('[data-side="lazy"]').innerHTML;
		const eager = row.querySelector('[data-side="eager"]').innerHTML;
		return eager === "" || lazy.includes('aria-hidden="true" class="inline-block shrink-0"') || normalize(lazy) !== normalize(eager);
	}).map((row) => row.dataset.row);
	assert.deepEqual(mismatched, []);
	await view.unmount();
});

test("a product logo holds its square box at its size until its entrypoint loads", async () => {
	const view = await renderComponent({
		source: `
import { LOGO_ICON_COMPONENTS } from "@/components/ui/data/logo-data";
const Jira = LOGO_ICON_COMPONENTS.jira;
export default function Probe() { return <span data-probe><Jira label="Jira" size="large" /></span>; }
`,
		// An entrypoint whose component never finishes loading keeps the logo pending.
		mocks: { "@atlaskit/logo/jira/icon": "export const JiraIcon = () => { throw new Promise(() => {}); };" },
	});
	const html = view.container.querySelector("[data-probe]").innerHTML.replaceAll(" ", "");
	assert.ok(html.includes("height:40px;width:40px"), html);
	assert.ok(html.includes('aria-hidden="true"'), html);
	await view.unmount();
});
