import { proxyToBackend } from "@/app/api/_utils/proxy";
import { refuseNonLocalRequest } from "@/app/api/_utils/local-request";

export async function POST(request: Request) {
	const refused = refuseNonLocalRequest(request);
	if (refused) {
		return refused;
	}

	const rawBody = await request.text();
	return proxyToBackend({
		method: "POST",
		path: "/api/personal-graph/twg/refresh",
		rawBody: rawBody || "{}",
	});
}
