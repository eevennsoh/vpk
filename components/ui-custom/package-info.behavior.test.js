// PackageInfoChangeType renders the change category as a VPK Lozenge whose tone follows the change type.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const PROBE = `
import { PackageInfo, PackageInfoChangeType } from "@/components/ui-custom/package-info";

const TYPES = ["major", "minor", "patch", "added", "removed"];

export default function Probe() {
	return (
		<div>
			{TYPES.map((type) => (
				<PackageInfo key={type} name="react" changeType={type}>
					<PackageInfoChangeType />
				</PackageInfo>
			))}
		</div>
	);
}
`;

test("PackageInfoChangeType renders a toned Lozenge with a leading icon per change type", async () => {
	const view = await renderComponent({ source: PROBE });
	const lozenges = [...view.container.querySelectorAll('[data-slot="lozenge"]')].map((el) => ({
		hasIcon: el.querySelector('[data-slot="lozenge-leading-icon"]') !== null,
		text: el.textContent.trim(),
		variant: el.getAttribute("data-variant"),
	}));
	assert.deepEqual(lozenges, [
		{ hasIcon: true, text: "major", variant: "danger" },
		{ hasIcon: true, text: "minor", variant: "warning" },
		{ hasIcon: true, text: "patch", variant: "success" },
		{ hasIcon: true, text: "added", variant: "information" },
		{ hasIcon: true, text: "removed", variant: "neutral" },
	]);
	assert.equal(view.container.querySelectorAll('[data-slot="badge"]').length, 0);
});
