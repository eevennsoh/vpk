import { type NextRequest } from "next/server";
import { proxyToBackend } from "@/app/api/_utils/proxy";
import { readJsonBody } from "@/app/api/_utils/read-json-body";
import { refuseNonLocalRequest } from "@/app/api/_utils/local-request";

interface RouteProps {
	params: Promise<{ slug: string[] }>;
}

export async function GET(_: NextRequest, { params }: RouteProps) {
	const { slug } = await params;
	const encodedSlug = slug.map((part) => encodeURIComponent(part)).join("/");
	return proxyToBackend({
		method: "GET",
		path: `/api/personal-graph/page/${encodedSlug}`,
	});
}

export async function PUT(request: NextRequest, { params }: RouteProps) {
	const refused = refuseNonLocalRequest(request);
	if (refused) {
		return refused;
	}

	const { slug } = await params;
	const { body, errorResponse } = await readJsonBody(request);
	if (errorResponse) {
		return errorResponse;
	}
	const encodedSlug = slug.map((part) => encodeURIComponent(part)).join("/");
	return proxyToBackend({
		body,
		method: "PUT",
		path: `/api/personal-graph/page/${encodedSlug}`,
	});
}
