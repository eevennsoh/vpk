// Fake binaries shared by the suites that run the deploy scripts (deploy-safety.test.js,
// image-upload.test.js). Every fake appends "<name> <args>" to $FAKE_CALL_LOG, the log
// those suites assert on; what a fake does beyond that is the suite's own body.

const { chmodSync, writeFileSync } = require("node:fs");
const path = require("node:path");

// Longer than a pipe buffer, so a fake docker that ignores the --password-stdin payload
// fails every run instead of rarely.
const PIPE_BUFFER_PASSWORD = "fixture-password".repeat(10_000);

function writeFakeBin(binDir, name, body = "") {
	const file = path.join(binDir, name);
	writeFileSync(file, `#!/bin/bash\nprintf '${name} %s\\n' "$*" >> "$FAKE_CALL_LOG"\n${body}\n`);
	chmodSync(file, 0o755);
	return file;
}

// dev-deploy-fast.sh pipes the password into `docker login --password-stdin` under
// pipefail. A fake that exits before reading it lets echo die of SIGPIPE and the step
// report "Docker login failed", so login drains stdin here and nowhere else.
function writeFakeDocker(binDir, body = "") {
	return writeFakeBin(binDir, "docker", `if [ "\${1:-}" = login ]; then cat > /dev/null; exit 0; fi\n${body}`);
}

module.exports = { PIPE_BUFFER_PASSWORD, writeFakeBin, writeFakeDocker };
