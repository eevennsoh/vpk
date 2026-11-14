import type { ShaderLabEffectDefinition } from "../types";

export const BLOB_TRACKING_LAYER = {
	"type": "blob-tracking",
	"label": "Blob Tracking",
	"description": "Detects moving or bright regions and frames them with tracked shapes, labels, connectors, and trails.",
	"params": [
		{ "key": "blobAmount", "label": "Blob Amount", "type": "number", "defaultValue": 6, "min": 1, "max": 32, "step": 1, "group": "Detection" },
		{ "key": "detectionMode", "label": "Detection Mode", "type": "select", "defaultValue": "auto", "options": [
			{ "label": "Auto", "value": "auto" },
			{ "label": "Motion", "value": "motion" },
			{ "label": "Luminance", "value": "luminance" }
		], "group": "Detection" },
		{ "key": "minBlobSize", "label": "Minimum Blob Size", "type": "number", "defaultValue": 3, "min": 1, "max": 64, "step": 1, "group": "Detection" },
		{ "key": "motionThreshold", "label": "Motion Threshold", "type": "number", "defaultValue": 0.12, "min": 0, "max": 1, "step": 0.01, "group": "Detection" },
		{ "key": "motionMaskThreshold", "label": "Motion Mask Threshold", "type": "number", "defaultValue": 0.08, "min": 0, "max": 0.5, "step": 0.01, "group": "Detection" },
		{ "key": "motionPersistence", "label": "Motion Persistence", "type": "number", "defaultValue": 0.82, "min": 0, "max": 0.99, "step": 0.01, "group": "Detection" },
		{ "key": "sensitivity", "label": "Sensitivity", "type": "number", "defaultValue": 0.8, "min": 0, "max": 1, "step": 0.01, "group": "Tracking" },
		{ "key": "smoothing", "label": "Smoothing", "type": "number", "defaultValue": 0.6, "min": 0, "max": 1, "step": 0.01, "group": "Tracking" },
		{ "key": "persistentTracking", "label": "Persistent Tracking", "type": "boolean", "defaultValue": true, "group": "Tracking" },
		{ "key": "shapeType", "label": "Shape", "type": "select", "defaultValue": "square", "options": [
			{ "label": "Square", "value": "square" },
			{ "label": "Circle", "value": "circle" },
			{ "label": "Diamond", "value": "diamond" }
		], "group": "Shape" },
		{ "key": "shapeScale", "label": "Shape Scale", "type": "number", "defaultValue": 1, "min": 0.25, "max": 3, "step": 0.05, "group": "Shape" },
		{ "key": "centerShape", "label": "Center Marker", "type": "select", "defaultValue": "dot", "options": [
			{ "label": "Dot", "value": "dot" },
			{ "label": "Cross", "value": "cross" },
			{ "label": "None", "value": "none" }
		], "group": "Shape" },
		{ "key": "showOutline", "label": "Show Outline", "type": "boolean", "defaultValue": true, "group": "Decoration" },
		{ "key": "showLabels", "label": "Show Labels", "type": "boolean", "defaultValue": true, "group": "Decoration" },
		{ "key": "connectLines", "label": "Connect Lines", "type": "boolean", "defaultValue": true, "group": "Decoration" },
		{ "key": "connectorArrows", "label": "Connector Arrows", "type": "boolean", "defaultValue": false, "group": "Decoration" },
		{ "key": "connectorDashed", "label": "Dashed Connectors", "type": "boolean", "defaultValue": false, "group": "Decoration" },
		{ "key": "curvedLines", "label": "Curved Lines", "type": "boolean", "defaultValue": false, "group": "Decoration" },
		{ "key": "strokeColor", "label": "Stroke Color", "type": "color", "defaultValue": "#ffffff", "group": "Decoration" },
		{ "key": "strokeWidth", "label": "Stroke Width", "type": "number", "defaultValue": 2, "min": 1, "max": 8, "step": 0.25, "group": "Decoration" },
		{ "key": "trailDecay", "label": "Trail Decay", "type": "number", "defaultValue": 0.35, "min": 0, "max": 1, "step": 0.01, "group": "Decoration" },
		{ "key": "invert", "label": "Invert", "type": "boolean", "defaultValue": false, "group": "Output" },
		{ "key": "outputMode", "label": "Output Mode", "type": "select", "defaultValue": "decorated", "options": [
			{ "label": "Decorated", "value": "decorated" },
			{ "label": "Motion mask", "value": "motion" }
		], "group": "Output" },
		{ "key": "innerEffectType", "label": "Inner Effect", "type": "select", "defaultValue": "none", "options": [
			{ "label": "None", "value": "none" },
			{ "label": "Bloom", "value": "bloom" },
			{ "label": "CRT", "value": "crt" },
			{ "label": "Halftone", "value": "halftone" },
			{ "label": "Pixelation", "value": "pixelation" },
			{ "label": "Threshold", "value": "threshold" }
		], "group": "Inner Effect" },
		{ "key": "innerEffectParams", "label": "Inner Effect Parameters", "type": "text", "defaultValue": "{}", "group": "Inner Effect" }
	]
} as const satisfies ShaderLabEffectDefinition;
