const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

function readProjectFile(relativePath) {
	return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const SCREEN = "components/blocks/agent-user/components/agent-user.tsx";
const DIALOG = "components/blocks/agent-user/components/add-user-dialog.tsx";
const ROLE = "components/blocks/agent-user/components/role-select.tsx";
// People/role data is now owned by the directory data layer; the agent-user
// module re-exports it for back-compat.
const DATA = "app/data/directory/people.ts";
const INDEX = "components/blocks/agent-user/index.ts";

test("Agent User is exposed as a website block", () => {
	assert.match(
		readProjectFile("app/data/components.ts"),
		/blockComponent\("agent-user", "Agent User"\)/u,
	);
	assert.match(
		readProjectFile("app/data/component-manifest.ts"),
		/blockComponent\("agent-user", "Agent User"\)/u,
	);
	assert.match(
		readDetailCategorySource("blocks"),
		/import \{ AgentUser, AddUserDialog \} from "@\/components\/blocks\/agent-user";/u,
	);
	assert.match(
		readWebsiteRegistrySource(),
		/"agent-user": dynamic\(\s*\(\) => import\("\.\/demos\/blocks\/agent-user-demo"\)/u,
	);
});

test("Agent User screen composes design-system primitives, not custom rebuilds", () => {
	const source = readProjectFile(SCREEN);
	assert.match(source, /from "@\/components\/ui\/avatar"/u);
	assert.match(source, /from "@\/components\/ui\/switch"/u);
	assert.match(source, /from "@\/components\/ui\/lozenge"/u);
	assert.match(source, /from "@\/components\/ui\/table"/u);
	assert.match(source, /from "@\/components\/ui\/checkbox"/u);
	assert.match(source, /from "@\/components\/ui\/button"/u);
});

test("Agent User screen renders the documented access rows and people table", () => {
	const source = readProjectFile(SCREEN);
	assert.match(source, /Owner/u);
	assert.match(source, /Author display name/u);
	assert.match(source, /User access/u);
	assert.match(source, /Open to all users/u);
	assert.match(source, /Add people/u);
	assert.match(source, /More about Rovo agent users and permissions/u);
});

test("Add user dialog exposes name, role, and add/close actions", () => {
	const source = readProjectFile(DIALOG);
	assert.match(source, /export interface AddUserDialogProps/u);
	assert.match(source, /placeholder="Add people"/u);
	assert.match(source, /RoleSelect/u);
	assert.match(source, /Close/u);
	assert.match(source, /onAdd\?: \(payload: AddUserPayload\) => void/u);
});

test("Role select offers role options with descriptions", () => {
	const data = readProjectFile(DATA);
	assert.match(data, /value: "manager"/u);
	assert.match(data, /Permission to edit or delete the agent and invite collaborators\./u);
	const role = readProjectFile(ROLE);
	assert.match(role, /AGENT_ROLE_OPTIONS\.map/u);
});

test("Agent User index re-exports the public API", () => {
	const index = readProjectFile(INDEX);
	assert.match(index, /export \{ AgentUser \}/u);
	assert.match(index, /AddUserDialog/u);
	assert.match(index, /AgentPerson/u);
});
