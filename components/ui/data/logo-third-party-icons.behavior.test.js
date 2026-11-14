// Third-party brand logos load their package entrypoint on first render. Each lazy brand must
// render exactly what a static import of its manifest entrypoint and export renders.
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const ICONS_SOURCE = readFileSync(path.join(__dirname, "logo-third-party-icons.ts"), "utf8");
const ENTRYPOINT_SPECIFIERS = [...ICONS_SOURCE.matchAll(/"([a-z0-9-]+)": \(\) => import\((?:\/\*[^*]*\*\/ )?"([^"]+)"\)/gu)].map(([, entrypoint, specifier]) => ({ entrypoint, specifier }));

const PROBE = `
import { THIRD_PARTY_LOGO_PACKAGE_ICON_ENTRIES } from "@/components/ui/data/logo-third-party-data";
import { THIRD_PARTY_LOGO_ICONS } from "@/components/ui/data/logo-third-party-icons";
${ENTRYPOINT_SPECIFIERS.map(({ specifier }, index) => `import * as Entry${index} from "${specifier}";`).join("\n")}
const MODULES = { ${ENTRYPOINT_SPECIFIERS.map(({ entrypoint }, index) => `"${entrypoint}": Entry${index}`).join(", ")} };

export default function Probe() {
	return THIRD_PARTY_LOGO_PACKAGE_ICON_ENTRIES.map((entry) => {
		const Lazy = THIRD_PARTY_LOGO_ICONS[entry.name];
		const Eager = MODULES[entry.packageIcon.entrypoint]?.[entry.packageIcon.exportName];
		return (
			<div data-row={entry.name} key={entry.name}>
				<div data-side="lazy">{Lazy ? <Lazy label="" size="small" /> : null}</div>
				<div data-side="eager">{Eager ? <Eager label="" size="small" /> : null}</div>
			</div>
		);
	});
}
`;

test("every lazy third-party logo renders its manifest entrypoint's export", async () => {
	assert.ok(ENTRYPOINT_SPECIFIERS.length > 100, `loaders found: ${ENTRYPOINT_SPECIFIERS.length}`);
	const view = await renderComponent({ source: PROBE });
	for (let attempt = 0; attempt < 10; attempt += 1) await view.rerender({});
	// Gradient ids carry React's useId, which differs between the two renders.
	const normalize = (html) => html.replace(/_r_[0-9a-z]+_/gu, "_r_");
	const rows = [...view.container.querySelectorAll("[data-row]")];
	assert.ok(rows.length > 100, `rows: ${rows.length}`);
	const mismatched = rows.filter((row) => {
		const lazy = row.querySelector('[data-side="lazy"]').innerHTML;
		const eager = row.querySelector('[data-side="eager"]').innerHTML;
		return eager === "" || normalize(lazy) !== normalize(eager);
	}).map((row) => row.dataset.row);
	assert.deepEqual(mismatched, []);
	await view.unmount();
});

