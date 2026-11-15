// VPK differences from upstream shadcn sidebar.tsx that a future shadcn sync must keep:
// - SidebarInset renders an unnamed <section>, not upstream's <main>: the root layout's MainLandmark
//   is the page's only main landmark (gotchas-ui.md), so a nested main trips axe's landmark rules.
//   The section still scopes a <header> in the inset out of the banner role, as <main> did.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const SOURCE = `
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function Demo() {
	return (
		<SidebarProvider>
			<Sidebar><SidebarContent /></Sidebar>
			<SidebarInset className="custom-inset"><header>Inset header</header></SidebarInset>
		</SidebarProvider>
	);
}
`;

test("SidebarInset adds no main landmark and keeps its header out of the banner role", async () => {
	const view = await renderComponent({ source: SOURCE });
	const inset = view.container.querySelector("[data-slot=sidebar-inset]");
	assert.equal(inset.tagName, "SECTION");
	assert.equal(inset.hasAttribute("aria-label") || inset.hasAttribute("aria-labelledby"), false, "an unnamed section is not a region landmark");
	assert.equal(inset.querySelector("header").parentElement.closest("article, aside, nav, section, main"), inset);
	assert.match(inset.className, /custom-inset/u);
	assert.equal(view.container.querySelector("main, [role=main]"), null);
});
