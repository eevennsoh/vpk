const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SHELL_FILE = path.join(__dirname, "rovo-app-shell.tsx");
const SHELL_SOURCE = fs.readFileSync(SHELL_FILE, "utf8");

function extractSlice(startMarker, endMarker) {
	const startIndex = SHELL_SOURCE.indexOf(startMarker);
	assert.notEqual(startIndex, -1, `Expected to find start marker: ${startMarker}`);

	const endIndex = SHELL_SOURCE.indexOf(endMarker, startIndex);
	assert.notEqual(endIndex, -1, `Expected to find end marker: ${endMarker}`);

	return SHELL_SOURCE.slice(startIndex, endIndex);
}

test("RovoAppShell keeps dismissal state for the approval card", () => {
	assert.match(
		SHELL_SOURCE,
		/const \[dismissedApprovalCardKey, setDismissedApprovalCardKey\] = useState<string \| null>\(null\);/,
	);
	assert.match(
		SHELL_SOURCE,
		/&& pendingPlanKey !== dismissedApprovalCardKey/,
	);
	assert.match(
		SHELL_SOURCE,
		/setDismissedApprovalCardKey\(null\);\s*\n\t\tsetIsSubmittingPlanApproval\(false\);/,
	);
	assert.match(
		SHELL_SOURCE,
		/const handleDismissApprovalCard = useCallback\(\(\) => {\s*\n\t\tsetDismissedApprovalCardKey\(pendingPlanKey\);/,
	);
});

test("RovoAppShell renders the approval-card shortcuts footer and dismissal handler together", () => {
	const approvalBranch = extractSlice(
		") : shouldShowApprovalCard && activePendingPlan ? (",
		") : (",
	);

	assert.match(approvalBranch, /<ApprovalCard/);
	assert.match(approvalBranch, /onDismiss=\{handleDismissApprovalCard\}/);
	assert.match(approvalBranch, /onSelect=\{handlePlanApprovalSubmit\}/);
	assert.match(
		approvalBranch,
		/<QuestionCardShortcutsFooter escLabel="cancel" \/>/,
	);
});
