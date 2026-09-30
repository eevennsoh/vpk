import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

const PERSONAL_GRAPH_URL = appUrl("/arts/personal-graph");

const explorerFixture = {
	edges: [
		{
			id: "wiki_link:wiki:concepts/Ingestion Workflow<->wiki:entities/Graph Vault",
			kind: "wiki_link",
			label: "wikilink",
			metadata: {},
			relationKinds: ["wiki_link"],
			source: "wiki:concepts/Ingestion Workflow",
			target: "wiki:entities/Graph Vault",
		},
	],
	generatedAt: "2026-04-30T00:00:00.000Z",
	nodes: [
		{
			bodyPreview: "",
			connectionCount: 0,
			dangling: false,
			externalUrl: null,
			frontmatter: {},
			id: "raw:sample-source",
			kind: "raw",
			label: "sample-source.md",
			missing: false,
			path: "/vault/raw/sample-source.md",
			provider: "vault",
			relativePath: "raw/sample-source.md",
			size: 128,
			slug: "sample-source",
			title: "sample-source.md",
			updatedAt: "2026-04-30T00:00:00.000Z",
		},
		{
			bodyPreview: "# Ingestion Workflow\n\nA mocked workflow page.",
			connectionCount: 1,
			dangling: false,
			externalUrl: null,
			frontmatter: { tags: ["wiki/concept"] },
			id: "wiki:concepts/Ingestion Workflow",
			kind: "concept",
			label: "Ingestion Workflow",
			missing: false,
			path: "/vault/wiki/concepts/Ingestion Workflow.md",
			provider: "vault",
			relativePath: "wiki/concepts/Ingestion Workflow.md",
			size: 256,
			slug: "concepts/Ingestion Workflow",
			title: "Ingestion Workflow",
			updatedAt: "2026-04-30T00:00:00.000Z",
			wikiLinks: ["wiki/entities/Graph Vault"],
		},
		{
			bodyPreview: "# Graph Vault\n\nA mocked entity page.",
			connectionCount: 1,
			dangling: false,
			externalUrl: "https://example.com/graph-vault",
			frontmatter: { tags: ["wiki/entity"] },
			id: "wiki:entities/Graph Vault",
			kind: "entity",
			label: "Graph Vault",
			missing: false,
			path: "/vault/wiki/entities/Graph Vault.md",
			provider: "vault",
			relativePath: "wiki/entities/Graph Vault.md",
			size: 192,
			slug: "entities/Graph Vault",
			title: "Graph Vault",
			updatedAt: "2026-04-30T00:00:00.000Z",
			wikiLinks: ["wiki/concepts/Ingestion Workflow"],
		},
	],
	stats: {
		danglingCount: 0,
		edgeCount: 1,
		nodeCount: 3,
		rawCount: 1,
		wikiCount: 2,
	},
};

async function mockPersonalGraphApi(page: Page) {
	const vaultSettings = {
		message: "Personal Graph vault is ready.",
		rawDirectoryExists: true,
		root: "/Users/esoh/Documents/Obsidian Vault/Graph",
		source: "folder-picker",
		status: "ready",
		wikiDirectoryExists: true,
	};
	const graphSource = { generatedAt: null, source: "vault" };
	const unprocessedCount = { count: 1, paths: ["raw/sample-source.md"] };
	const log = {
		entries: [
			{
				date: "2026-04-30",
				pagesWritten: ["wiki/concepts/Ingestion Workflow.md"],
				source: "raw/sample-source.md",
				type: "ingest",
			},
		],
	};
	const search = {
		results: [
			{
				excerpt: "A mocked workflow page.",
				path: "wiki/concepts/Ingestion Workflow.md",
				score: 0.94,
				slug: "concepts/Ingestion Workflow",
				title: "Ingestion Workflow",
			},
		],
	};
	const pageBody = {
		body: "# Ingestion Workflow\n\nA mocked workflow page.",
		content: "---\ntags:\n  - wiki/concept\n---\n# Ingestion Workflow\n\nA mocked workflow page.",
		frontmatter: { tags: ["wiki/concept"] },
		path: "/vault/wiki/concepts/Ingestion Workflow.md",
		relativePath: "wiki/concepts/Ingestion Workflow.md",
		slug: "concepts/Ingestion Workflow",
		updatedAt: "2026-04-30T00:00:00.000Z",
	};
	const rawWrite = {
		name: "sample.md",
		path: "/vault/raw/sample.md",
		relativePath: "raw/sample.md",
		size: 32,
		slug: "sample",
		updatedAt: "2026-04-30T00:00:00.000Z",
	};
	const ingestEvents = [
		{ stage: "reading", sourcePath: "raw/sample-source.md", type: "stage" },
		{
			stage: "summarizing",
			summary: "A mocked summary.",
			takeaways: ["Keep raw sources immutable", "Confirm before writing"],
			type: "summary",
		},
		{
			related: [
				{
					excerpt: "Existing workflow note.",
					path: "wiki/concepts/Ingestion Workflow.md",
					score: 0.91,
					slug: "concepts/Ingestion Workflow",
					title: "Ingestion Workflow",
				},
			],
			stage: "linking",
			type: "related",
		},
		{ stage: "awaiting-confirmation", token: "confirm-1", type: "confirmation" },
	];
	const confirmEvents = [
		{
			logEntry: { source: "raw/sample-source.md", type: "ingest" },
			pagesWritten: ["wiki/concepts/Ingestion Workflow.md"],
			stage: "done",
			type: "done",
		},
	];
	const summaryEvents = [
		{
			action: "summary",
			length: "medium",
			nodeId: "wiki:concepts/Ingestion Workflow",
			stage: "validating",
			type: "stage",
		},
		{
			action: "summary",
			articleMarkdown: "# Editorial browser article\nThis article verifies the iframe preview and export path.\n\n## What this is\nA generated editorial article from selected graph context.\n\n## Why it matters\nIt proves the UI renders the same HTML string it can export.\n\n## Connected work\n- Graph Vault supports the selected source.\n\n## Source evidence\nEvidence is collapsed by default and derived from graph data.",
			cache: "miss",
			inputKind: "context-file",
			length: "medium",
			nodeId: "wiki:concepts/Ingestion Workflow",
			source: "vault",
			sourceFingerprint: "browser-fingerprint",
			type: "article",
			workWindow: null,
		},
		{
			action: "summary",
			nodeId: "wiki:concepts/Ingestion Workflow",
			source: "vault",
			stage: "done",
			type: "done",
		},
	];

	await page.route("**/api/personal-graph/**", async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		const fulfillJson = async (body: unknown) => {
			await route.fulfill({
				body: JSON.stringify(body),
				contentType: "application/json",
				status: 200,
			});
		};
		const fulfillSse = async (events: unknown[]) => {
			await route.fulfill({
				body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
				contentType: "text/event-stream",
				status: 200,
			});
		};

		if (url.pathname === "/api/personal-graph/vault" || url.pathname === "/api/personal-graph/vault/select") {
			await fulfillJson(vaultSettings);
			return;
		}
		if (url.pathname === "/api/personal-graph/source") {
			await fulfillJson(graphSource);
			return;
		}
		if (url.pathname === "/api/personal-graph/explorer") {
			await fulfillJson(explorerFixture);
			return;
		}
		if (url.pathname === "/api/personal-graph/unprocessed-count") {
			await fulfillJson(unprocessedCount);
			return;
		}
		if (url.pathname === "/api/personal-graph/log") {
			await fulfillJson(log);
			return;
		}
		if (url.pathname === "/api/personal-graph/search") {
			await fulfillJson(search);
			return;
		}
		if (url.pathname.startsWith("/api/personal-graph/page/")) {
			await fulfillJson(pageBody);
			return;
		}
		if (url.pathname === "/api/personal-graph/raw") {
			await fulfillJson(rawWrite);
			return;
		}
		if (url.pathname === "/api/personal-graph/ingest") {
			const body = request.postData() ? JSON.parse(request.postData() as string) as { confirmToken?: string } : {};
			await fulfillSse(body.confirmToken ? confirmEvents : ingestEvents);
			return;
		}
		if (url.pathname === "/api/personal-graph/summarize") {
			await fulfillSse(summaryEvents);
			return;
		}

		await route.fallback();
	});
}

async function openMockedPersonalGraph(page: Page) {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await mockPersonalGraphApi(page);
	await page.goto(PERSONAL_GRAPH_URL, { waitUntil: "domcontentloaded" });

	await expect(page.getByRole("heading", { name: "Personal Graph" })).toBeVisible({ timeout: 15000 });
	await expect(page.locator("ul[aria-label='Personal Graph nodes'] li")).toHaveCount(3, { timeout: 15000 });
	await expect(page.getByLabel("Search Personal Graph")).toBeVisible({ timeout: 15000 });
}

async function openCaptureQueue(page: Page) {
	await page.getByRole("button", { name: "Open graph controls" }).click();
	await page.getByRole("button", { name: "Add data" }).click();
	await expect(page.getByRole("button", { name: "Drop raw source" })).toBeVisible();
}

test("Personal Graph renders graph data, fallback, search, capture, and ingest controls", async ({
	page,
}) => {
	await openMockedPersonalGraph(page);

	await expect(page.getByText("2 wiki pages · 1 raw sources")).toBeVisible();
	await expect(page.locator("section[aria-label='Personal Graph text fallback']")).toBeAttached();
	await expect(page.locator("ul[aria-label='Personal Graph edges'] li")).toHaveCount(1);
	await expect(page.getByText("Ingestion Workflow to Graph Vault")).toBeAttached();
	await expect(page.locator("canvas")).not.toHaveCount(0);

	await page.getByLabel("Search Personal Graph").fill("ingestion");
	const searchResult = page.getByRole("button", { name: /Ingestion Workflow/i });
	await expect(searchResult).toBeVisible();
	await searchResult.click();
	await expect(
		page.getByRole("heading", { level: 2, name: "Ingestion Workflow" })
	).toBeVisible();
	await expect(page.getByText("A mocked workflow page.")).toBeVisible();

	await openCaptureQueue(page);
	await expect(page.getByRole("button", { name: "Ingest" })).toBeEnabled();
	await page.getByRole("button", { name: "Drop raw source" }).focus();
	await expect(page.getByRole("button", { name: "Drop raw source" })).toBeFocused();
	await page
		.locator("input[type='file']")
		.setInputFiles({
			buffer: Buffer.from("# Sample\n\nMock raw source."),
			mimeType: "text/markdown",
			name: "sample.md",
		});
	await expect(page.getByText("Added")).toBeVisible();

	await page.getByRole("button", { name: "Ingest" }).click();
	await expect(page.getByText("Keep raw sources immutable")).toBeVisible();
	await expect(page.getByText("Related pages found by qmd")).toBeVisible();
	await page.getByRole("button", { name: "Confirm" }).click();
	await expect(page.getByText("done").last()).toBeVisible();
});

test("Personal Graph previews and exports the generated editorial HTML summary", async ({
	page,
}) => {
	await openMockedPersonalGraph(page);

	await page.getByLabel("Search Personal Graph").fill("ingestion");
	const searchResult = page.getByRole("button", { name: /Ingestion Workflow/i });
	await expect(searchResult).toBeVisible();
	await searchResult.click();
	await expect(page.getByText("Selected node summary")).toBeVisible();
	await page.getByRole("button", { name: "Generate" }).click();

	const articleFrame = page.frameLocator('iframe[title="Personal Graph summary article"]');
	await expect(articleFrame.getByRole("heading", { name: "Editorial browser article" })).toBeVisible();
	await expect(articleFrame.getByText("A generated editorial article from selected graph context.")).toBeVisible();
	const evidenceIsCollapsed = await articleFrame.locator("details#source-evidence").evaluate((element) =>
		!element.hasAttribute("open")
	);
	expect(evidenceIsCollapsed).toBe(true);

	const previewHtml = await page.locator('iframe[title="Personal Graph summary article"]').getAttribute("srcdoc");
	const downloadPromise = page.waitForEvent("download");
	await page.getByRole("button", { name: "Export HTML" }).click();
	const download = await downloadPromise;
	const downloadPath = await download.path();
	expect(downloadPath).toBeTruthy();
	const exportedHtml = fs.readFileSync(downloadPath as string, "utf8");

	expect(exportedHtml).toBe(previewHtml);
	await page.goto(`file://${downloadPath}`);
	await expect(page.getByRole("heading", { name: "Editorial browser article" })).toBeVisible();
	await expect(page.locator("details#source-evidence")).toHaveCount(1);
});
