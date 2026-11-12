import { proxyToBackend } from "@/app/api/_utils/proxy";
import { refuseNonLocalRequest } from "@/app/api/_utils/local-request";

export async function POST(request: Request) {
	const refused = refuseNonLocalRequest(request);
	if (refused) {
		return refused;
	}

	return proxyToBackend({
		body: {},
		method: "POST",
		path: "/api/personal-graph/vault/select",
	});
}
