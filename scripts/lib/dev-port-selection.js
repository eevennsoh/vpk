const { getPortsClaimedByOtherWorktrees } = require("./worktree-ports");
const { isPortAvailable } = require("./rovo-utils");

async function findAvailableWorktreePort(basePort, {
	minPort = basePort,
	maxTries = Number.parseInt(process.env.PORT_SEARCH_MAX ?? "20", 10),
	claimedPorts = getPortsClaimedByOtherWorktrees(process.cwd()),
	isPortAvailable: probe = isPortAvailable,
	onClaimed = () => {},
} = {}) {
	const start = Math.max(basePort, minPort);
	const end = basePort + maxTries;
	for (let port = start; port < end; port += 1) {
		const owner = claimedPorts.get(port);
		if (owner) {
			onClaimed(port, owner);
			continue;
		}
		if (await probe(port)) return port;
	}
	throw new Error(`No available port found from ${start} to ${end - 1}.`);
}

module.exports = { findAvailableWorktreePort };
