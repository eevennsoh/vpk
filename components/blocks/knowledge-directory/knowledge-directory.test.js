const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

function readProjectFile(relativePath) {
	return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function readKnowledgeDetailsSection() {
	const source = readDetailCategorySource("blocks");
	const start = source.indexOf('\t"knowledge-directory": {');
	const end = source.indexOf('\t"mermaid-diagram": {', start);

	assert.notEqual(start, -1);
	assert.notEqual(end, -1);

	return source.slice(start, end);
}

function readKnowledgeApps() {
	return JSON.parse(readProjectFile("app/data/directory/knowledge.json"));
}

function getKnowledgeAppById(apps, id) {
	const app = apps.find((candidate) => candidate.id === id);
	assert.ok(app, `knowledge catalog should include ${id}`);
	return app;
}

test("Knowledge Directory is exposed as a website block", () => {
	assert.match(
		readProjectFile("app/data/component-manifest.ts"),
		/blockComponent\("knowledge-directory", "Knowledge Directory"\)/u,
	);
	assert.match(
		readProjectFile("app/data/component-manifest.ts"),
		/blockComponent\("knowledge-directory", "Knowledge Directory"\)/u,
	);
	assert.match(
		readDetailCategorySource("blocks"),
		/import \{ KnowledgeDirectoryDialog \} from "@\/components\/blocks\/knowledge-directory";/u,
	);
	assert.match(
		readWebsiteRegistrySource(),
		/"knowledge-directory": dynamic\(\s*\(\) => import\("\.\/demos\/blocks\/knowledge-directory-demo"\)/u,
	);
});

test("Knowledge Directory docs demo starts closed until the trigger is clicked", () => {
	const source = readProjectFile("components/blocks/knowledge-directory/page.tsx");

	assert.match(source, /const \[open, setOpen\] = useState\(false\);/u);
	assert.match(source, /className="flex h-full min-h-screen items-center justify-center p-4"/u);
	assert.match(source, /Browse knowledge/u);
	assert.doesNotMatch(source, /Browse skills/u);
});

test("Knowledge Directory owns a knowledge-specific modal without the copied sidebar", () => {
	const source = readProjectFile("components/blocks/knowledge-directory/components/knowledge-directory.tsx");

	assert.doesNotMatch(source, /AgentBrowserDialog/u);
	assert.doesNotMatch(source, /KnowledgeDirectorySidebar/u);
	assert.doesNotMatch(source, /SkillDirectorySidebar/u);
	assert.match(source, /<DialogContent/u);
	assert.match(source, /sm:max-w-\[960px\]/u);
	assert.match(source, /sm:max-w-\[640px\]/u);
	assert.match(source, /title = "Browse knowledge"/u);
	assert.match(source, /onBack=\{selectedApp \? handleBack : undefined\}/u);
	assert.match(source, /function KnowledgeDirectoryHeader[\s\S]*className="flex items-center justify-between px-6 py-6"/u);
	assert.match(source, /function KnowledgeDirectoryFooter[\s\S]*className="flex items-center justify-end gap-2 border-t border-border bg-surface-overlay px-6 py-6"/u);
	assert.match(source, /aria-label="Back to knowledge apps"[\s\S]*size="icon"[\s\S]*<ArrowLeftIcon label="" color="currentColor" \/>/u);
});

test("Knowledge Directory exposes app, content, and callback props", () => {
	const source = readProjectFile("components/blocks/knowledge-directory/components/knowledge-directory.tsx");
	const indexSource = readProjectFile("components/blocks/knowledge-directory/index.ts");

	assert.match(source, /export interface KnowledgeDirectoryDialogProps/u);
	assert.match(source, /apps\?: readonly KnowledgeDirectoryApp\[\]/u);
	assert.match(source, /selectedAppId\?: string \| null/u);
	assert.match(source, /defaultSelectedAppId\?: string \| null/u);
	assert.match(source, /selectedMode\?: KnowledgeDirectoryMode/u);
	assert.match(source, /defaultSelectedMode\?: KnowledgeDirectoryMode/u);
	assert.match(source, /selectedContentIds\?: readonly string\[\]/u);
	assert.match(source, /defaultSelectedContentIds\?: readonly string\[\]/u);
	assert.match(source, /onBrowseFiles\?: \(\) => void/u);
	assert.match(source, /onAddKnowledge\?: \(payload: KnowledgeDirectoryAddPayload\) => void/u);
	assert.match(source, /onSelectApp\?: \(app: KnowledgeDirectoryApp\) => void/u);
	assert.match(source, /onSelectMode\?: \(mode: KnowledgeDirectoryMode\) => void/u);
	assert.match(source, /onSelectedContentIdsChange\?: \(contentIds: readonly string\[\]\) => void/u);
	assert.match(indexSource, /KnowledgeDirectoryAddPayload/u);
	assert.match(indexSource, /KnowledgeDirectoryApp/u);
	assert.match(indexSource, /KnowledgeDirectoryContent/u);
	assert.match(indexSource, /KnowledgeDirectoryMode/u);
	assert.doesNotMatch(indexSource, /KnowledgeDirectorySkill/u);
});

test("Knowledge Directory includes real connector defaults", () => {
	// App data is now the single-source-of-truth JSON catalog.
	const apps = readKnowledgeApps();
	const byName = new Map(apps.map((app) => [app.name, app]));

	for (const name of [
		"Confluence",
		"Google Drive",
		"Microsoft Teams",
		"Microsoft SharePoint",
		"GitHub",
		"Loom",
	]) {
		assert.ok(byName.has(name), `knowledge catalog should include ${name}`);
	}

	assert.deepEqual(byName.get("Confluence").visual, { kind: "logo", logoName: "confluence" });
	assert.deepEqual(byName.get("Google Drive").visual, {
		kind: "third-party",
		name: "google-drive",
	});
	assert.ok(apps.every((app) => Array.isArray(app.contents)));
	for (const app of apps) {
		assert.equal(typeof app.starCount, "number", `knowledge app ${app.id} should have starCount`);
		assert.equal(typeof app.teammateCount, "number", `knowledge app ${app.id} should have teammateCount`);
		assert.equal(typeof app.verified, "boolean", `knowledge app ${app.id} should have verified`);
	}
});

test("Knowledge Directory includes Atlassian platform and software sources", () => {
	const apps = readKnowledgeApps();
	const ids = new Set(apps.map((app) => app.id));

	for (const id of [
		"goals",
		"projects",
		"atlassian-teams",
		"analytics",
		"assets",
		"jira-product-discovery",
		"customer-service-management",
		"trello",
		"jira-align",
		"talent",
		"focus",
		"dx",
	]) {
		assert.ok(ids.has(id), `knowledge catalog should include ${id}`);
	}

	assert.equal(getKnowledgeAppById(apps, "atlassian-teams").visual.logoName, "teams");
	assert.equal(getKnowledgeAppById(apps, "jira-align").visual.logoName, "align");
	assert.equal(getKnowledgeAppById(apps, "dx").visual.kind, "icon");
});

test("Knowledge Directory custom content metadata and visuals follow source rules", () => {
	const apps = readKnowledgeApps();
	const confluenceTypes = new Set(getKnowledgeAppById(apps, "confluence").contents.map((content) => content.type));
	const jiraTypes = new Set(getKnowledgeAppById(apps, "jira").contents.map((content) => content.type));

	assert.deepEqual(confluenceTypes, new Set(["space", "page", "whiteboard", "blog"]));
	assert.deepEqual(jiraTypes, new Set(["space", "jira work item"]));

	for (const app of apps) {
		for (const content of app.contents) {
			assert.equal(typeof content.type, "string", `${app.id}/${content.id} should include type`);
			assert.ok(content.type.length > 0, `${app.id}/${content.id} should include non-empty type`);
			assert.ok(content.visual, `${app.id}/${content.id} should include visual`);

			if (content.type === "space") {
				assert.equal(content.visual.kind, "avatar", `${app.id}/${content.id} space should use a project avatar`);
				assert.equal(content.visual.shape, "square", `${app.id}/${content.id} space avatar should be square`);
				assert.match(content.visual.src, /^\/avatar-project\//u, `${app.id}/${content.id} space should use /avatar-project/`);
			}

			if (app.visual.kind === "image") {
				assert.deepEqual(
					content.visual,
					app.visual,
					`${app.id}/${content.id} 2p/3p content should reuse the parent company logo`,
				);
			}

			if (app.providerName === "Atlassian" && content.type !== "space") {
				assert.equal(content.visual.kind, "icon", `${app.id}/${content.id} Atlassian content should use icon visuals`);
				assert.equal(
					content.visual.iconColor,
					"text-icon-accent-blue",
					`${app.id}/${content.id} Atlassian content should use the blue accent`,
				);
			}
		}
	}
});

test("Knowledge Directory implements app selection and content-scope actions", () => {
	const source = readProjectFile("components/blocks/knowledge-directory/components/knowledge-directory.tsx");

	assert.match(source, /function BrowseAppsStep/u);
	assert.match(source, /<EntityCardKnowledgeCard/u);
	assert.match(source, /getKnowledgeAppIcon\(app\)/u);
	assert.match(source, /publisher=\{app\.providerName\}/u);
	assert.match(source, /starCount=\{app\.starCount\}/u);
	assert.match(source, /teammateCount=\{app\.teammateCount\}/u);
	assert.match(source, /verified=\{app\.verified\}/u);
	assert.doesNotMatch(source, /function KnowledgeAppCard/u);
	assert.match(source, /function AppContentStep/u);
	assert.match(source, /function ContentModeSelector/u);
	assert.match(source, /All content/u);
	assert.match(source, /Custom content/u);
	assert.match(source, /Select content/u);
	assert.match(source, /onSelectApp\(app\)/u);
	assert.match(source, /commitMode\("all"\)/u);
	assert.match(source, /commitContentIds\(getContentIds\(app\)\)/u);
	assert.match(source, /contentIds: resolvedMode === "all" \? "all" : resolvedContentIds/u);
});

test("Knowledge Directory custom content can be searched and removed", () => {
	const source = readProjectFile("components/blocks/knowledge-directory/components/knowledge-directory.tsx");

	assert.match(source, /function filterContent/u);
	assert.match(source, /selectedIdSet\.has\(content\.id\)/u);
	assert.match(source, /content\.description, content\.type/u);
	assert.match(source, /function SelectedContentList/u);
	assert.match(source, /function KnowledgeContentVisual/u);
	assert.match(source, /RichTextMentionVisualMark/u);
	assert.match(source, /resolveDirectoryVisual\(content\.visual\)/u);
	assert.match(source, /content\.type/u);
	assert.doesNotMatch(source, /GlobeIcon/u);
	assert.doesNotMatch(source, /content\.description\}<\/span>/u);
	assert.match(source, /onRemoveContent/u);
	assert.match(source, /DeleteIcon/u);
	assert.match(source, /Remove \$\{content\.name\}/u);
	assert.match(source, /No custom content selected\./u);
});

test("Knowledge Directory demo and docs use knowledge-specific examples", () => {
	const pageSource = readProjectFile("components/blocks/knowledge-directory/page.tsx");
	const detailsSource = readKnowledgeDetailsSection();

	assert.doesNotMatch(pageSource, /defaultSelectedSkillIds/u);
	assert.doesNotMatch(pageSource, /sessionSkills/u);
	assert.match(detailsSource, /KnowledgeDirectoryApp/u);
	assert.match(detailsSource, /apps=\{apps\}/u);
	assert.match(detailsSource, /onBrowseFiles/u);
	assert.match(detailsSource, /onAddKnowledge/u);
	assert.doesNotMatch(detailsSource, /KnowledgeDirectorySkill/u);
	assert.doesNotMatch(detailsSource, /onAddSkills/u);
});
