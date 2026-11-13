import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

// The production backend allows only the origins in DEFAULT_ALLOWED_ORIGINS; a same-origin API POST
// from a page browsed at any other origin is rejected (500). This makes the smallest such POST the app
// makes (creating a Rovo thread needs no credentials and no Rovo) from a stable route, without driving
// any product UI, so it breaks only when the page's origin is not allowed.
test("a same-origin API POST is not rejected for its origin", { tag: "@smoke" }, async ({ page }) => {
	await page.goto(appUrl("/components/ui/page-header"));
	const origin = new URL(page.url()).origin;
	const posted = page.waitForRequest((request) => request.method() === "POST" && new URL(request.url()).pathname === "/api/rovo/threads");
	const created = await page.evaluate(async () => {
		const response = await fetch("/api/rovo/threads", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "Smoke: same-origin POST" }),
		});
		const body = await response.json().catch(() => null) as { thread?: { id?: string } } | null;
		return { status: response.status, id: body?.thread?.id ?? null };
	});
	const request = await posted;
	expect((await request.allHeaders()).origin, "the POST carries the page's own origin").toBe(origin);
	expect(created.status, "POST /api/rovo/threads").toBeLessThan(400);
	if (created.id) {
		await page.evaluate(async (id) => { await fetch(`/api/rovo/threads/${encodeURIComponent(id)}`, { method: "DELETE" }); }, created.id);
	}
});
