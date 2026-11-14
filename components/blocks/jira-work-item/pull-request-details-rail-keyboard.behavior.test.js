// In the pull-request details rail, a commit row (and, in experimental-v2, a CI check
// row) is itself a keyboard link that opens its SCM page, and it holds a real button
// (Copy commit, Fix). Enter/Space on that nested button must run the button, not open
// the row's URL. Covers the three variants that fork the rail.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const VARIANTS = ["experimental-v2", "experimental-v3", "team-eu26"];
const COMMIT_URL = "https://scm.example/acme/app/commit/abc1234";
const CHECK_URL = "https://ci.example/acme/app/runs/42";

const source = (variant) => `
import { MetadataRailProvider } from "@/components/blocks/jira-work-item/${variant}/context-metadata-rail";
import { PullRequestDetailsRail } from "@/components/blocks/jira-work-item/${variant}/components/pull-request-detail/pull-request-details-rail";
import { resolvePullRequestDetailData } from "@/components/blocks/jira-work-item/${variant}/lib/pull-request-detail-data";

const entry = {
	pullRequest: {
		number: 7,
		repository: "acme/app",
		title: "Keyboard guard",
		status: "open",
		commits: [{
			id: "abc1234",
			shortSha: "abc1234",
			title: "Guard nested keys",
			author: { id: "venn", name: "Venn" },
			timestamp: "2 minutes ago",
			additions: 2,
			deletions: 0,
			url: "${COMMIT_URL}",
		}],
		checks: [{ id: "unit", name: "Unit tests", status: "failed", details: "1 failed", url: "${CHECK_URL}" }],
	},
};

export default function Harness({ onFixCheck }) {
	return (
		<MetadataRailProvider>
			<PullRequestDetailsRail data={resolvePullRequestDetailData(entry)} onFixCheck={onFixCheck} />
		</MetadataRailProvider>
	);
}
`;

function stubBrowser() {
	const opened = [];
	const copied = [];
	const originalOpen = window.open;
	window.open = (url) => {
		opened.push(url);
		return null;
	};
	const clipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: { writeText: async (text) => void copied.push(text) },
	});
	return {
		copied,
		opened,
		restore() {
			window.open = originalOpen;
			if (clipboard) Object.defineProperty(navigator, "clipboard", clipboard);
			else delete navigator.clipboard;
		},
	};
}

async function renderRail(t, variant) {
	const browser = stubBrowser();
	t.after(() => browser.restore());
	const fixed = [];
	const view = await renderComponent({
		props: { onFixCheck: (checks) => fixed.push(checks.map((check) => check.id)) },
		source: source(variant),
	});
	// The Commits disclosure starts closed; CI checks start open.
	await view.click(view.getByRole("button", { name: /^Commits/ }));
	return { ...browser, fixed, view };
}

for (const variant of VARIANTS) {
	for (const key of ["Enter", " "]) {
		const keyName = key === " " ? "Space" : key;

		test(`${variant}: ${keyName} on Copy commit copies the SHA without opening the commit`, async (t) => {
			const { copied, opened, view } = await renderRail(t, variant);
			const copy = view.getByRole("button", { name: "Copy commit abc1234" });

			await view.focus(copy);
			await view.press(copy, key);

			assert.deepEqual(opened, []);
			assert.deepEqual(copied, ["abc1234"]);
		});

		test(`${variant}: ${keyName} on the commit row still opens the commit`, async (t) => {
			const { opened, view } = await renderRail(t, variant);
			const row = view.getAllByRole("link").find((link) => link.textContent.includes("Guard nested keys"));
			assert.ok(row, "the commit row is a link");

			await view.focus(row);
			await view.press(row, key);

			assert.deepEqual(opened, [COMMIT_URL]);
		});
	}
}

for (const key of ["Enter", " "]) {
	const keyName = key === " " ? "Space" : key;

	test(`experimental-v2: ${keyName} on Fix runs Fix without opening the check`, async (t) => {
		const { fixed, opened, view } = await renderRail(t, "experimental-v2");
		const fix = view.getByRole("button", { name: "Fix Unit tests" });

		await view.focus(fix);
		await view.press(fix, key);

		assert.deepEqual(opened, []);
		assert.deepEqual(fixed, [["unit"]]);
	});
}
