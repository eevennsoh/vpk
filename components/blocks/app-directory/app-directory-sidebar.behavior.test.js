// Renders the default App Directory and reads which logo branch each "By companies"
// sidebar entry takes. The logo marks are stubbed so the result names the field that
// reached SidebarToolAvatar (logoName, brandName or avatarSrc) instead of depending on
// the lazily loaded third-party svg modules, which happy-dom never draws.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const LOGO_MARK_STUB = `
export function AtlassianLogoGlyph() {
	return null;
}
export function AtlassianLogoMark({ name }) {
	return <span data-logo-mark={"logoName:" + name} />;
}
export function BrandLogoMark({ name, src }) {
	return <span data-logo-mark={name ? "brandName:" + name : "avatarSrc:" + src} />;
}
`;

const HARNESS = `
import { DIRECTORY_APPS } from "@/app/data/directory/apps";
import { AppDirectoryDialog } from "@/components/blocks/app-directory";

export default function Harness() {
	return <AppDirectoryDialog onOpenChange={() => {}} open tools={DIRECTORY_APPS} />;
}
`;

function sidebarGroupLogos(title) {
	const heading = [...document.querySelectorAll("nav[aria-label='Tool categories'] p")]
		.find((node) => node.textContent?.trim() === title);
	const list = heading?.nextElementSibling;
	return [...(list?.querySelectorAll("[data-slot='sidebar-nav-item']") ?? [])].map((item) => {
		const label = item.querySelector("[data-slot='sidebar-nav-item-content']")?.textContent?.trim() ?? "";
		const mark = item.querySelector("[data-slot='sidebar-nav-item-leading'] [data-logo-mark]");
		return `${label} -> ${mark?.getAttribute("data-logo-mark") ?? "none"}`;
	});
}

test("every By companies sidebar entry renders a logo through the field its app defines", async () => {
	await renderComponent({ mocks: { "@/components/ui/logo-mark": LOGO_MARK_STUB }, source: HARNESS });

	// Ten of the eleven are package brands: before getSidebarGroupItems carried brandName,
	// each of those rendered "none".
	assert.deepEqual(sidebarGroupLogos("By companies"), [
		"Atlassian -> logoName:atlassian",
		"Google Drive -> brandName:google-drive",
		"GitHub Copilot -> brandName:github",
		"Slack -> brandName:slack",
		"Asana -> brandName:asana",
		"ServiceNow -> brandName:servicenow",
		"Salesforce -> brandName:salesforce",
		"Miro -> brandName:miro",
		"Sentry -> brandName:sentry",
		"Microsoft Outlook -> brandName:microsoft-outlook",
		"Stripe -> brandName:stripe",
	]);
});
