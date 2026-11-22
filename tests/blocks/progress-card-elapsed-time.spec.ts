import { expect, test, type Page } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";
import { collectPageErrors, hydrationErrors } from "@/tests/helpers/page-errors";

// A running progress card given no runCreatedAt starts its run DEFAULT_RUN_AGE_MS (651 s,
// "10m 51s") before it mounts. That start must be fixed once (useTimestampAgo) so the timer
// counts up; recomputing it every render froze the header at 10m 50s-10m 51s. Each doc page's
// "Running" example renders that case: planTitle "Sprint Planning", runStatus "running", no runCreatedAt.
const ROUTES = [
	{ route: "/components/blocks/task-progress", cardName: "Sprint Planning task progress" },
	{ route: "/components/blocks/agent-progress", cardName: "Sprint Planning agent progress" },
];

const DEFAULT_RUN_AGE_SECONDS = 651;
// Time the docs page may take between mounting the card and the first reading on a slow runner.
const MOUNT_TO_READ_SLACK_SECONDS = 30;
// formatElapsedTime output: "10m 51s", "11m" on a whole minute, "51s" under a minute.
const ELAPSED_TEXT = /^(?:\d+m \d{2}s|\d+m|\d+s)$/u;

function parseElapsed(text: string): number {
	const match = /^(?:(\d+)m)? ?(?:(\d+)s)?$/u.exec(text.trim());
	if (!match || (match[1] === undefined && match[2] === undefined)) {
		throw new Error(`"${text}" is not an elapsed time such as "10m 51s"`);
	}
	return Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
}

async function openRunningCard(page: Page, route: string, cardName: string) {
	await page.goto(appUrl(route));
	const card = page.getByRole("button", { name: cardName, exact: true });
	await card.scrollIntoViewIfNeeded();
	await expect(card).toBeVisible();
	// The action button is an overlay inside the card shell; the header text is its sibling content.
	const elapsed = card.locator("..").getByText(ELAPSED_TEXT);
	await expect(elapsed, `one elapsed-time label in the ${cardName} card`).toHaveCount(1);
	return elapsed;
}

for (const { route, cardName } of ROUTES) {
	test(`a running card without runCreatedAt counts up from 10m 51s, with no hydration error reported, on ${route}`, { tag: "@smoke" }, async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "no-preference" });
		const errors = collectPageErrors(page);
		const elapsed = await openRunningCard(page, route, cardName);

		const first = parseElapsed(await elapsed.innerText());
		expect(first, "the default start is 651 s before mount").toBeGreaterThanOrEqual(DEFAULT_RUN_AGE_SECONDS);
		expect(first, "the default start is 651 s before mount, not an older fixed date").toBeLessThanOrEqual(DEFAULT_RUN_AGE_SECONDS + MOUNT_TO_READ_SLACK_SECONDS);

		// The interval ticks every second; a frozen timer never reaches first + 2.
		await expect.poll(async () => parseElapsed(await elapsed.innerText()), {
			message: `the elapsed time keeps counting up from ${first} s`,
			timeout: 10_000,
		}).toBeGreaterThanOrEqual(first + 2);
		const second = parseElapsed(await elapsed.innerText());
		expect(second - first, "the timer advanced, and not by an implausible jump").toBeLessThanOrEqual(15);

		// The progress demos load with ssr: false, so the card itself is never hydrated and this
		// does not prove timer hydration. It proves only that the route reports no hydration
		// error (console or uncaught) while the card mounts and counts.
		expect(hydrationErrors(errors), "no hydration error reported on the route while the card mounts and counts").toEqual([]);
	});
}
