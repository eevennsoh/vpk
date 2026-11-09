"use strict";

const {
	extractTextFromUiParts,
	getNonEmptyString,
	getPositiveInteger,
} = require("./shared-utils");
const {
	isSmartRouteTargetSurface,
} = require("./smart-generation-surface-gate");

const SMART_WIDTH_CLASS_VALUES = new Set(["compact", "regular", "wide"]);

function getSmartWidthClass(value) {
	const normalizedValue = getNonEmptyString(value);
	if (!normalizedValue) {
		return null;
	}

	const lowerValue = normalizedValue.toLowerCase();
	return SMART_WIDTH_CLASS_VALUES.has(lowerValue) ? lowerValue : null;
}

function inferSmartWidthClass({ containerWidthPx, viewportWidthPx, surface }) {
	const widthSource = containerWidthPx ?? viewportWidthPx;
	if (typeof widthSource === "number") {
		if (widthSource <= 520) {
			return "compact";
		}
		if (widthSource <= 900) {
			return "regular";
		}
		return "wide";
	}

	if (surface === "sidebar" || surface === "multiport") {
		return "compact";
	}
	if (surface === "fullscreen") {
		return "wide";
	}

	return null;
}

function normalizeSmartGenerationOptions(value) {
	if (!value || typeof value !== "object") {
		return {
			enabled: false,
			surface: null,
			containerWidthPx: null,
			viewportWidthPx: null,
			widthClass: null,
		};
	}

	const enabled = value.enabled === true;
	const surface = getNonEmptyString(value.surface);
	const containerWidthPx = getPositiveInteger(value.containerWidthPx);
	const viewportWidthPx = getPositiveInteger(value.viewportWidthPx);
	const explicitWidthClass = getSmartWidthClass(value.widthClass);
	const inferredWidthClass = inferSmartWidthClass({
		containerWidthPx,
		viewportWidthPx,
		surface,
	});

	return {
		enabled,
		surface,
		containerWidthPx: containerWidthPx ?? null,
		viewportWidthPx: viewportWidthPx ?? null,
		widthClass: explicitWidthClass ?? inferredWidthClass,
	};
}

function isSmartGenerationEnabled(value) {
	const normalized = normalizeSmartGenerationOptions(value);
	return (
		normalized.enabled &&
		typeof normalized.surface === "string" &&
		isSmartRouteTargetSurface(normalized.surface)
	);
}

function mapUiMessagesToRoleContent(messages) {
	if (!Array.isArray(messages)) {
		return [];
	}

	return messages
		.map((message) => {
			if (!message || (message.role !== "assistant" && message.role !== "user")) {
				return null;
			}

			const content = extractTextFromUiParts(message.parts);
			if (!content) {
				return null;
			}

			return {
				role: message.role === "assistant" ? "assistant" : "user",
				content,
			};
		})
		.filter(Boolean);
}

module.exports = {
	getSmartWidthClass,
	inferSmartWidthClass,
	isSmartGenerationEnabled,
	mapUiMessagesToRoleContent,
	normalizeSmartGenerationOptions,
};
