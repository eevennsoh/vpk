import { expect, test, type Locator, type Page } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

const CODE_REVIEW_URL = appUrl("/preview/blocks/code-review");

type DiffSide = "additions" | "deletions";

function getFileDiff(page: Page, fileId: string): Locator {
	return page.locator(`[data-code-review-file-id="${fileId}"]`).locator("diffs-container");
}

function getDiffLine(
	page: Page,
	side: DiffSide,
	lineNumber: number,
	fileId = "user-profile-dialog",
): Locator {
	const lineType = side === "additions" ? "change-addition" : "change-deletion";

	return getFileDiff(page, fileId)
		.locator([
			`[data-${side}] [data-line="${lineNumber}"]`,
			`[data-unified] [data-line="${lineNumber}"][data-line-type="${lineType}"]`,
		].join(", "))
		.first();
}

async function getCenter(locator: Locator, description: string) {
	const box = await locator.boundingBox();
	if (!box) {
		throw new Error(`Expected ${description} to have a visible bounding box.`);
	}

	return {
		x: box.x + box.width / 2,
		y: box.y + box.height / 2,
	};
}

async function getGutterButton(
	page: Page,
	side: DiffSide,
	lineNumber: number,
	fileId = "user-profile-dialog",
) {
	await getDiffLine(page, side, lineNumber, fileId).hover();
	const button = page.getByRole("button", { name: "Add inline comment" });
	await expect(button).toBeVisible();
	return button;
}

async function expectGutterButtonToOverlayLineNumber(
	page: Page,
	side: DiffSide,
	lineNumber: number,
	fileId: string,
) {
	const lineType = side === "additions" ? "change-addition" : "change-deletion";
	const button = await getGutterButton(page, side, lineNumber, fileId);
	const lineNumberContent = getFileDiff(page, fileId)
		.locator(
			`[data-line-type="${lineType}"][data-column-number="${lineNumber}"] [data-line-number-content]`,
		)
		.first();
	const buttonCenter = await getCenter(button, "Pierre's gutter utility");
	const lineNumberCenter = await getCenter(lineNumberContent, `line number ${lineNumber}`);

	expect(Math.abs(buttonCenter.x - lineNumberCenter.x)).toBeLessThanOrEqual(0.75);
}

async function dragGutterToLine({
	endLineNumber,
	endSide,
	fileId = "user-profile-dialog",
	page,
	side,
	startLineNumber,
}: {
	endLineNumber: number;
	endSide?: DiffSide;
	fileId?: string;
	page: Page;
	side: DiffSide;
	startLineNumber: number;
}) {
	const resolvedEndSide = endSide ?? side;
	const button = await getGutterButton(page, side, startLineNumber, fileId);
	const start = await getCenter(button, "Pierre's gutter utility");
	const endLine = await getCenter(
		getDiffLine(page, resolvedEndSide, endLineNumber, fileId),
		`diff line ${endLineNumber}`,
	);

	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	await page.mouse.move(endLine.x, endLine.y, { steps: 8 });
	await page.mouse.up();
}

async function commitOpenComment(page: Page, accessibleName: string, comment: string) {
	const editor = page.getByRole("textbox", { name: accessibleName });
	const draft = page.locator('[data-inline-comment-kind="draft"]').filter({ has: editor });
	await expect(editor).toHaveCount(1);
	await expect(editor).toBeFocused();
	await editor.fill(comment);
	await editor.press("Control+Enter");
	await expect(draft).toHaveCount(0);
	await expect(page.locator('[data-inline-comment-kind="comment"]').filter({ has: editor })).toHaveCount(1);
}

test("comments persist across expanded files and layouts and attach to the composer", async ({ page }) => {
	await page.goto(CODE_REVIEW_URL, { waitUntil: "domcontentloaded" });
	await expect(page.getByRole("heading", { name: /TWC-109/u })).toBeVisible();

	const photoCommentButton = await getGutterButton(page, "additions", 2, "photo-uploader");
	await photoCommentButton.click();
	await commitOpenComment(
		page,
		"Comment on line 2",
		"Keep the accepted upload types explicit.",
	);
	await expect(page.getByRole("button", { name: "Review 1 comment" })).toBeVisible();

	const postCommitButton = await getGutterButton(page, "additions", 2, "photo-uploader");
	await postCommitButton.click();
	const postCommitEditor = page
		.locator('[data-inline-comment-kind="draft"]')
		.getByRole("textbox", { name: "Comment on line 2" });
	await expect(postCommitEditor).toHaveCount(1);
	await postCommitEditor.press("Escape");

	await page.getByRole("treeitem", { name: /UserProfileDialog\.ts/u }).click();
	await expect(page.getByRole("region", { name: "src/components/UserProfileDialog.ts changes" })).toBeVisible();
	await page.getByRole("button", { name: "Split diff layout" }).click();
	await expect(page.getByRole("button", { name: "Split diff layout" })).toHaveAttribute("aria-pressed", "true");

	const profileCommentButton = await getGutterButton(page, "additions", 16);
	await profileCommentButton.click();
	await commitOpenComment(
		page,
		"Comment on line 16",
		"Keep this validation explicit before merging.",
	);

	const reviewComments = page.getByRole("button", { name: "Review 2 comments" });
	await expect(reviewComments).toBeVisible();
	await expect(page.getByRole("button", { name: "Submit" })).toBeEnabled();

	await page.getByRole("button", { name: "Unified diff layout" }).click();
	await expect(page.getByRole("button", { name: "Unified diff layout" })).toHaveAttribute("aria-pressed", "true");
	await expect(reviewComments).toBeVisible();

	await reviewComments.click();
	const commentsPopover = page.locator('[data-slot="popover-content"]');
	await expect(commentsPopover).toBeVisible();
	await expect(commentsPopover.getByText("src/components/PhotoUploader.tsx", { exact: true })).toBeVisible();
	await expect(commentsPopover.getByText("Line 2", { exact: true })).toBeVisible();
	await expect(commentsPopover.getByText("src/components/UserProfileDialog.ts", { exact: true })).toBeVisible();
	await expect(commentsPopover.getByText("Line 16", { exact: true })).toBeVisible();
	await page.keyboard.press("Escape");

	await page.getByRole("treeitem", { name: /PhotoUploader\.tsx/u }).click();
	await page.getByRole("button", {
		name: "Delete comment on src/components/PhotoUploader.tsx, line 2",
	}).click();
	await expect(page.getByRole("button", { name: "Review 1 comment" })).toBeVisible();

	await page.getByRole("button", { name: "Remove all inline comments" }).click();
	await expect(page.getByTestId("inline-comments-chip")).toHaveCount(0);
	await expect(page.getByRole("button", { name: "Submit" })).toBeDisabled();
});

test("gutter comment button optically overlays one- and two-digit line numbers", async ({ page }) => {
	await page.goto(CODE_REVIEW_URL, { waitUntil: "domcontentloaded" });
	await expect(page.getByRole("heading", { name: /TWC-109/u })).toBeVisible();

	await expectGutterButtonToOverlayLineNumber(page, "additions", 2, "photo-uploader");
	await expectGutterButtonToOverlayLineNumber(page, "additions", 16, "user-profile-dialog");
});

test("single-line keyboard activation remains available and cancelled ranges create no draft", async ({ page }) => {
	await page.goto(CODE_REVIEW_URL, { waitUntil: "domcontentloaded" });
	await expect(page.getByRole("heading", { name: /TWC-109/u })).toBeVisible();
	await page.getByRole("treeitem", { name: /UserProfileDialog\.ts/u }).click();

	const keyboardButton = await getGutterButton(page, "additions", 16);
	await keyboardButton.focus();
	await keyboardButton.press("Enter");
	const singleLineEditor = page.getByRole("textbox", { name: "Comment on line 16" });
	await expect(singleLineEditor).toHaveCount(1);
	await singleLineEditor.press("Escape");
	await expect(singleLineEditor).toHaveCount(0);

	await page.getByRole("button", { name: "Split diff layout" }).click();
	await dragGutterToLine({
		endLineNumber: 16,
		page,
		side: "deletions",
		startLineNumber: 17,
	});
	const reverseRangeEditor = page.getByRole("textbox", { name: "Comment on lines 16 - 17" });
	await expect(reverseRangeEditor).toHaveCount(1);
	await reverseRangeEditor.press("Escape");
	await expect(reverseRangeEditor).toHaveCount(0);
	await page.getByRole("button", { name: "Unified diff layout" }).click();
	await page.getByRole("button", { name: "Split diff layout" }).click();

	await dragGutterToLine({
		endLineNumber: 16,
		endSide: "deletions",
		page,
		side: "additions",
		startLineNumber: 16,
	});
	await expect(page.getByRole("textbox", { name: /Comment on/u })).toHaveCount(0);

	const cancelButton = await getGutterButton(page, "additions", 16);
	const cancelStart = await getCenter(cancelButton, "Pierre's gutter utility");
	const cancelEnd = await getCenter(getDiffLine(page, "additions", 22), "diff line 22");
	await page.mouse.move(cancelStart.x, cancelStart.y);
	await page.mouse.down();
	await page.mouse.move(cancelEnd.x, cancelEnd.y, { steps: 8 });
	await cancelButton.dispatchEvent("pointercancel", {
		bubbles: true,
		composed: true,
		pointerId: 1,
		pointerType: "mouse",
	});
	await page.mouse.up();
	await expect(page.getByRole("textbox", { name: /Comment on/u })).toHaveCount(0);
	await expect(page.getByTestId("inline-comments-chip")).toHaveCount(0);
});

test("Changes navigation reveals every file and exposes file header actions", async ({ page }) => {
	await page.goto(CODE_REVIEW_URL, { waitUntil: "domcontentloaded" });
	await expect(page.getByRole("heading", { name: /TWC-109/u })).toBeVisible();
	await page.evaluate(() => {
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: {
				writeText: async (text: string) => {
					window.sessionStorage.setItem("code-review-copied-path", text);
				},
			},
		});
	});

	await expect(page.getByRole("button", { name: /^All changes,/u })).toBeVisible();
	await expect(page.locator("[data-code-review-file-id]")).toHaveCount(3);
	await expect(page.getByRole("tree", { name: "Code review files" })).toHaveCount(0);

	const filePath = "src/components/PhotoUploader.tsx";
	const fileHeader = page.locator('[data-code-review-file-header="photo-uploader"]');
	const collapseButton = page.getByRole("button", { name: `Collapse ${filePath}` });
	const copyButton = page.getByRole("button", { name: `Copy path ${filePath}` });
	await expect(copyButton).toHaveCSS("opacity", "0");

	await fileHeader.hover();
	await expect(copyButton).toHaveCSS("opacity", "1");
	await copyButton.click();
	await expect.poll(() => page.evaluate(() => (
		window.sessionStorage.getItem("code-review-copied-path")
	))).toBe(filePath);

	await page.getByRole("button", { name: "Show file tree" }).click();
	await expect(page.getByRole("tree", { name: "Code review files" })).toBeVisible();
	await page.getByRole("button", { name: "Hide file tree" }).click();
	await expect(page.getByRole("tree", { name: "Code review files" })).toHaveCount(0);

	await collapseButton.click();
	await expect(page.getByRole("button", { name: `Expand ${filePath}` })).toBeVisible();
	await expect(getDiffLine(page, "additions", 2, "photo-uploader")).toBeHidden();
	const expandButton = page.getByRole("button", { name: `Expand ${filePath}` });
	await expandButton.click();
	await expect(getDiffLine(page, "additions", 2, "photo-uploader")).toBeVisible();

	await page.mouse.move(0, 0);
	await collapseButton.focus();
	await page.keyboard.press("Shift+Tab");
	await page.keyboard.press("Tab");
	await expect(collapseButton).toBeFocused();
	await expect(collapseButton).toHaveCSS("opacity", "1");
});
