const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

function readProjectFile(filePath) {
	return fs.readFileSync(path.join(process.cwd(), filePath), "utf8");
}

const SOURCE = readProjectFile("components/projects/skills/components/skill-creation-result-card.tsx");
const GENERATIVE_CARD_SOURCE = readProjectFile("components/blocks/generative-card/index.tsx");

test("generated skill result uses tile-backed generative card with collapsed header edit action", () => {
	assert.match(SOURCE, /import EditIcon from "@atlaskit\/icon\/core\/edit";/u);
	assert.match(SOURCE, /import \{ Tile \} from "@\/components\/ui\/tile";/u);
	assert.match(SOURCE, /getSkillCollectionMetadata/u);
	assert.match(SOURCE, /SKILL_ICON_TILE_TO_TILE_VARIANTS/u);
	assert.match(SOURCE, /const \[isExpanded, setExpanded\] = useState\(true\);/u);
	assert.match(SOURCE, /<GenerativeCard className="w-full" expanded=\{isExpanded\} onExpandedChange=\{setExpanded\}>/u);
	assert.match(SOURCE, /<GenerativeCardHeader[\s\S]*action=\{!isExpanded \? \([\s\S]*aria-label="Edit skill"[\s\S]*<EditIcon label="" size="small" \/>[\s\S]*\) : null\}[\s\S]*title=\{payload\.name\}/u);
	assert.match(SOURCE, /<Tile label=\{payload\.name\} size="medium" variant=\{getSkillResultTileVariant\(payload\.collectionId\)\}>/u);
	assert.match(SOURCE, /blue: "blueSubtle"/u);
	assert.match(SOURCE, /green: "greenSubtle"/u);
	assert.match(SOURCE, /gray: "graySubtle"/u);
	assert.match(SOURCE, /<GenerativeCardFooter>[\s\S]*<Button type="button" variant="outline" onClick=\{\(\) => onEdit\(payload\.skillId\)\}>[\s\S]*Edit[\s\S]*<\/Button>[\s\S]*<\/GenerativeCardFooter>/u);
});

test("generative card header places action and collapse buttons 4px apart", () => {
	assert.match(GENERATIVE_CARD_SOURCE, /showToggle\?: boolean;/u);
	assert.match(GENERATIVE_CARD_SOURCE, /showToggle = true/u);
	assert.match(GENERATIVE_CARD_SOURCE, /const shouldShowToggle = showToggle && typeof setExpanded === "function";/u);
	assert.match(GENERATIVE_CARD_SOURCE, /\{action \|\| shouldShowToggle \? \(/u);
	assert.match(GENERATIVE_CARD_SOURCE, /<div className="flex items-center gap-1">[\s\S]*\{action\}[\s\S]*\{shouldShowToggle \? \(/u);
});
