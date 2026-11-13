import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const SOURCE = readFileSync(
	join(dirname(fileURLToPath(import.meta.url)), "failing-checks-composer-chip.tsx"),
	"utf8",
);

test("FailingChecksComposerChip uses danger icon color for StatusErrorIcon", () => {
	// Atlaskit StatusErrorIcon resolves via currentColor; wrap so ghost-button
	// text color does not leave the icon charcoal.
	assert.match(SOURCE, /className="text-icon-danger"/u);
	assert.match(
		SOURCE,
		/<StatusErrorIcon color="currentColor" label="" size="small" \/>/u,
	);
});
