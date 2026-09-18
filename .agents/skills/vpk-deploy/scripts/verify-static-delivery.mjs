import { isImmutableNextAssetPath } from "../../../../backend/lib/static-asset-delivery.js";

export function verifyStaticDelivery(headers, pathname, decodedBodyBytes, type) {
	const errors = [];
	const encoding = headers.get("content-encoding");
	const cache = headers.get("cache-control") || "";
	const html = type === "HTML";
	const text = html || ["CSS", "JavaScript"].includes(type);
	if (text && decodedBodyBytes >= 1024 && !["br", "gzip"].includes(encoding)) errors.push("large static text response is not compressed");
	if (encoding && !/(?:^|,)\s*(?:accept-encoding|\*)\s*(?:,|$)/iu.test(headers.get("vary") || "")) errors.push("compressed response lacks Vary: Accept-Encoding");
	if (html && (!/(?:^|,)\s*(?:no-cache|no-store|max-age\s*=\s*0)\s*(?:,|$)/iu.test(cache) || /\bimmutable\b/iu.test(cache))) {
		errors.push("HTML must revalidate instead of using immutable caching");
	}
	const relative = decodeURIComponent(pathname).replace(/^\//u, "");
	if (isImmutableNextAssetPath(relative)) {
		const maxAge = Number(/\bmax-age\s*=\s*(\d+)/iu.exec(cache)?.[1]);
		if (!/\bimmutable\b/iu.test(cache) || !(maxAge >= 31536000)) errors.push("generated Next asset lacks one-year immutable caching");
	}
	return errors;
}
