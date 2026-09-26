const RETIRED_CHAT_ROUTE_IDS = new Set(["jobs", "memories", "skills", "settings"]);

function isRetiredRovoThreadId(id) {
	return RETIRED_CHAT_ROUTE_IDS.has(id);
}

module.exports = { isRetiredRovoThreadId };
