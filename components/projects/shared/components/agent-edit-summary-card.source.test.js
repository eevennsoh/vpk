const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

function readProjectFile(filePath) {
	return fs.readFileSync(path.join(process.cwd(), filePath), "utf8");
}

const SOURCE = readProjectFile("components/projects/shared/components/agent-edit-summary-card.tsx");
const GENERATIVE_CARD_SOURCE = readProjectFile("components/blocks/generative-card/index.tsx");

test("agent edit summary card uses a collapsed header edit action and expanded footer edit action", () => {
	assert.match(SOURCE, /import EditIcon from "@atlaskit\/icon\/core\/edit";/u);
	assert.match(SOURCE, /const \[isExpanded, setExpanded\] = useState\(false\);/u);
	assert.match(SOURCE, /<GenerativeCard className="w-full" expanded=\{isExpanded\} onExpandedChange=\{setExpanded\} size="sm">/u);
	assert.match(SOURCE, /<GenerativeCardHeader[\s\S]*action=\{!isExpanded && onOpen \? \([\s\S]*aria-label="Edit automation"[\s\S]*<EditIcon label="" size="small" \/>[\s\S]*\) : null\}[\s\S]*title=\{payload\.headline\}/u);
	assert.match(SOURCE, /<GenerativeCardFooter>[\s\S]*<Button type="button" variant="outline" onClick=\{onOpen\}>[\s\S]*Edit[\s\S]*<\/Button>[\s\S]*<\/GenerativeCardFooter>/u);
	assert.doesNotMatch(SOURCE, /ExternalLinkIcon/u);
	assert.match(GENERATIVE_CARD_SOURCE, /<div className="flex items-center gap-1">[\s\S]*\{action\}[\s\S]*\{shouldShowToggle \? \(/u);
});
