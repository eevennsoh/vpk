import assert from "node:assert/strict";
import { test } from "node:test";

import { PROJECT_BUTTER_VIEWER, projectButterPersonAvatar } from "./people.ts";

test("the presenter persona is Venn and resolves to Venn's own avatar", () => {
	assert.deepEqual(PROJECT_BUTTER_VIEWER, { id: "venn", name: "Venn", avatarSrc: "/avatar-user/venn/venn.png" });
	assert.equal(projectButterPersonAvatar("Venn"), "/avatar-user/venn/venn.png");
});
