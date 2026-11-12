const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const TREES = ["experimental-v2", "experimental-v3"];

for (const tree of TREES) {
	const rootSource = fs.readFileSync(
		path.join(process.cwd(), `components/blocks/jira-work-item/${tree}/${tree}-jira-work-item.tsx`),
		"utf8",
	);
	const composerSource = fs.readFileSync(
		path.join(process.cwd(), `components/blocks/jira-work-item/${tree}/components/activity-composer.tsx`),
		"utf8",
	);

	test(`${tree} host-owned composer context bar is optional and reaches ActivityComposer`, () => {
		assert.match(rootSource, /composerContextBar\?: ReactNode;/u);
		assert.match(rootSource, /composerContextBar=\{props\.composerContextBar\}/u);
		assert.match(rootSource, /<ActivityComposer[\s\S]*composerContextBar=\{composerContextBar\}/u);
	});

	test(`${tree} host-owned bar replaces only the standard context-pill row`, () => {
		assert.match(composerSource, /composerContextBar\?: ReactNode;/u);
		if (tree !== "experimental-v2") {
			assert.match(
				composerSource,
				/hasExpandedPullRequestComposer \? null : \([\s\S]*<ActivityComposerContextPills[\s\S]*contextBar=\{composerContextBar\}/u,
			);
		} else {
			assert.match(
				composerSource,
				/hasExpandedPullRequestComposer \? null : \([\s\S]*composerContextBar !== undefined[\s\S]*<ActivityComposerContextPills/u,
			);
		}
		assert.match(composerSource, /onInvokeAgent=\{handleInvokeAgent\}/u);
		assert.match(composerSource, /onInvokeSkill=\{handleInvokeSkill\}/u);
	});
}
