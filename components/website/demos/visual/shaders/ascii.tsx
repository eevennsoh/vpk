"use client";

import { DecorativeFonts } from "@/components/visual/decorative-fonts";

import { useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties } from "react";

import {
	ASCII_ANIMATION_STYLES,
	ASCII_BACKGROUND_MODES,
	ASCII_BLEND_MODES,
	ASCII_CHARACTER_MODES,
	ASCII_CHARSETS,
	ASCII_COLOR_MODES,
	ASCII_COLOR_SOURCE_MODES,
	ASCII_COMPOSITE_MODES,
	ASCII_DEFAULT_CHARACTERS,
	ASCII_DEFAULT_SOURCE_COLORS,
	ASCII_MASK_MODES,
	ASCII_MASK_SOURCES,
	ASCII_MAX_SOURCE_COLORS,
	ASCII_SIGNAL_MODES,
	ASCII_TONE_MAPPING_MODES,
	type AsciiBackgroundMode,
	type AsciiBlendMode,
	type AsciiCharset,
	type AsciiAnimationStyle,
	type AsciiCharacterMode,
	type AsciiColorMode,
	type AsciiColorSourceMode,
	type AsciiCompositeMode,
	type AsciiFontWeight,
	type AsciiMaskMode,
	type AsciiMaskSource,
	type AsciiSignalMode,
	type AsciiSourceMode,
	type AsciiToneMappingMode,
	type EffectAmount,
	type LegacyAsciiBackgroundMode,
} from "./ascii-core";

export {
	ASCII_ANIMATION_STYLES,
	ASCII_BACKGROUND_MODES,
	ASCII_BLEND_MODES,
	ASCII_CHARACTER_MODES,
	ASCII_CHARSETS,
	ASCII_COLOR_MODES,
	ASCII_COLOR_SOURCE_MODES,
	ASCII_COMPOSITE_MODES,
	ASCII_CONTROL_BLEND_MODES,
	ASCII_CONTROL_COLOR_MODES,
	ASCII_DEFAULT_CHARACTERS,
	ASCII_DEFAULT_SOURCE_COLORS,
	ASCII_FONT_WEIGHTS,
	ASCII_MASK_MODES,
	ASCII_MASK_SOURCES,
	ASCII_MAX_SOURCE_COLORS,
	ASCII_SIGNAL_MODES,
	ASCII_TONE_MAPPING_MODES,
} from "./ascii-core";
export type {
	AsciiAnimationStyle,
	AsciiBackgroundMode,
	AsciiBlendMode,
	AsciiCharset,
	AsciiCharacterMode,
	AsciiColorMode,
	AsciiColorSourceMode,
	AsciiCompositeMode,
	AsciiFontWeight,
	AsciiMaskMode,
	AsciiMaskSource,
	AsciiSignalMode,
	AsciiSourceMode,
	AsciiToneMappingMode,
} from "./ascii-core";

const ASCII_ATLAS_TILE_SIZE = 64;

const VERTEX_SHADER = `#version 300 es
precision highp float;
in vec2 a_position;
out vec2 v_uv;

void main() {
	v_uv = a_position * 0.5 + 0.5;
	gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform sampler2D u_texture;
uniform sampler2D u_asciiAtlas;
uniform float u_sourceMode;
uniform float u_cellSize;
uniform float u_layerOpacity;
uniform float u_blendMode;
uniform float u_compositeMode;
uniform float u_hue;
uniform float u_saturation;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_characterMode;
uniform float u_colorMode;
uniform float u_colorSourceMode;
uniform float u_directionBias;
uniform float u_glyphSignalMode;
uniform float u_colorSignalMode;
uniform float u_maskSource;
uniform float u_maskMode;
uniform float u_maskInvert;
uniform float u_toneMappingMode;
uniform float u_signalBlackPoint;
uniform float u_signalWhitePoint;
uniform float u_signalGamma;
uniform float u_presenceThreshold;
uniform float u_presenceSoftness;
uniform float u_characterOpacity;
uniform float u_randomizeCharacters;
uniform float u_randomSeed;
uniform float u_animatedCharacters;
uniform float u_animationStyle;
uniform float u_animationIntensity;
uniform float u_animationRandomness;
uniform float u_characterCycleSpeed;
uniform float u_dotGridOverlay;
uniform float u_shimmerAmount;
uniform float u_shimmerSpeed;
uniform float u_bloomEnabled;
uniform float u_bloomIntensity;
uniform float u_bloomThreshold;
uniform float u_bloomRadius;
uniform float u_bloomSoftness;
uniform float u_bgOpacity;
uniform float u_backgroundMode;
uniform float u_backgroundOpacity;
uniform float u_backgroundBlurRadius;
uniform float u_colorOverlay;
uniform vec3 u_colorOverlayColor;
uniform float u_colorOverlayBlendMode;
uniform float u_vignette;
uniform float u_scanLines;
uniform float u_crtCurvature;
uniform float u_chromatic;
uniform float u_chromaticOffset;
uniform float u_characterBloom;
uniform float u_characterChromatic;
uniform float u_characterChromaticOffset;
uniform float u_chromaticAberration;
uniform float u_rgbSplit;
uniform float u_rgbSplitOffset;
uniform float u_glitch;
uniform float u_blur;
uniform float u_blurRadius;
uniform float u_pixelate;
uniform float u_pixelateSize;
uniform float u_halftone;
uniform float u_halftoneSize;
uniform float u_filmGrain;
uniform float u_filmDust;
uniform float u_invert;
uniform float u_speed;
uniform float u_transparentBackground;
uniform float u_time;
uniform float u_atlasColumns;
uniform float u_atlasRows;
uniform float u_characterCount;
uniform int u_sourceColorCount;
uniform vec4 u_sourceColors[8];
uniform vec3 u_tintColor;
uniform vec3 u_backgroundColor;

vec3 getSourceColor(int index) {
	if (u_sourceColorCount < 1) return vec3(0.0);
	int safeIndex = clamp(index, 0, u_sourceColorCount - 1);
	return u_sourceColors[safeIndex].rgb;
}

vec3 palette(float t) {
	if (u_sourceColorCount < 1) return vec3(0.0);
	if (u_sourceColorCount < 2) return getSourceColor(0);
	float scaledT = clamp(t, 0.0, 1.0) * float(u_sourceColorCount - 1);
	int index = min(int(floor(scaledT)), u_sourceColorCount - 2);
	float localT = fract(scaledT);
	localT = localT * localT * (3.0 - 2.0 * localT);
	return mix(getSourceColor(index), getSourceColor(index + 1), localT);
}

float luma(vec3 color) {
	return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

float hash21(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7)) + u_randomSeed * 17.13) * 43758.5453123);
}

float temporalHash(vec2 p, float rate) {
	return hash21(p + floor(u_time * rate));
}

vec3 sourceField(vec2 uv, float time) {
	vec2 p = uv * 2.0 - 1.0;
	p.x *= u_resolution.x / max(u_resolution.y, 1.0);

	float waveA = sin((p.x * 2.8 + p.y * 1.2) + time * 1.25);
	float waveB = sin(length(p + vec2(sin(time * 0.32), cos(time * 0.24)) * 0.32) * 8.0 - time * 1.6);
	float waveC = cos((p.x - p.y) * 4.4 - time * 0.9);
	float field = waveA * 0.36 + waveB * 0.42 + waveC * 0.22;
	field = field * 0.5 + 0.5;

	float vignette = smoothstep(1.45, 0.25, length(p));
	vec3 color = palette(field);
	color += vec3(0.16, 0.06, 0.24) * sin((uv.x + uv.y + time * 0.2) * 12.0);
	return clamp(color * (0.72 + vignette * 0.38), 0.0, 1.0);
}

vec3 sampleCoverTexture(vec2 uv) {
	ivec2 texSizeI = textureSize(u_texture, 0);
	vec2 texSize = vec2(texSizeI);
	float aspect = u_resolution.x / max(u_resolution.y, 1.0);
	float textureAspect = texSize.x / max(texSize.y, 1.0);

	vec2 coverScale = vec2(1.0);
	vec2 coverOffset = vec2(0.0);

	if (aspect > textureAspect) {
		float scale = aspect / textureAspect;
		coverScale = vec2(1.0, 1.0 / scale);
		coverOffset = vec2(0.0, (1.0 - coverScale.y) * 0.5);
	} else {
		float scale = textureAspect / aspect;
		coverScale = vec2(1.0 / scale, 1.0);
		coverOffset = vec2((1.0 - coverScale.x) * 0.5, 0.0);
	}

	vec2 sampleUV = uv * coverScale + coverOffset;
	sampleUV.y = 1.0 - sampleUV.y;
	return texture(u_texture, clamp(sampleUV, vec2(0.0), vec2(1.0))).rgb;
}

vec3 sampleSource(vec2 uv) {
	return u_sourceMode > 0.5
		? sampleCoverTexture(uv)
		: sourceField(uv, u_time * u_speed);
}

vec3 sampleBlurredSource(vec2 uv, float radius) {
	vec2 texel = vec2(radius) / max(u_resolution, vec2(1.0));
	vec3 color = sampleSource(uv) * 4.0;
	color += sampleSource(clamp(uv + vec2(texel.x, 0.0), 0.0, 1.0)) * 2.0;
	color += sampleSource(clamp(uv - vec2(texel.x, 0.0), 0.0, 1.0)) * 2.0;
	color += sampleSource(clamp(uv + vec2(0.0, texel.y), 0.0, 1.0)) * 2.0;
	color += sampleSource(clamp(uv - vec2(0.0, texel.y), 0.0, 1.0)) * 2.0;
	color += sampleSource(clamp(uv + texel, 0.0, 1.0));
	color += sampleSource(clamp(uv - texel, 0.0, 1.0));
	color += sampleSource(clamp(uv + vec2(texel.x, -texel.y), 0.0, 1.0));
	color += sampleSource(clamp(uv + vec2(-texel.x, texel.y), 0.0, 1.0));
	return color / 16.0;
}

vec2 applyCrtCurvature(vec2 uv) {
	float amount = clamp(u_crtCurvature, 0.0, 1.0);
	vec2 centered = uv * 2.0 - 1.0;
	float radius = dot(centered, centered);
	vec2 curved = uv + centered * radius * 0.085 * amount;
	return clamp(mix(uv, curved, amount), vec2(0.0), vec2(1.0));
}

vec3 acesTonemap(vec3 color) {
	float a = 2.51;
	float b = 0.03;
	float c = 2.43;
	float d = 0.59;
	float e = 0.14;
	return clamp((color * (a * color + b)) / (color * (c * color + d) + e), 0.0, 1.0);
}

vec3 reinhardTonemap(vec3 color) {
	return color / (color + vec3(1.0));
}

vec3 totosTonemap(vec3 color) {
	vec3 compressed = color * vec3(1.18, 1.04, 0.94) / (color * vec3(0.82, 0.9, 0.98) + vec3(0.78, 0.68, 0.6));
	float lum = luma(compressed);
	float shadowLift = smoothstep(0.0, 0.38, lum);
	float highlightRoll = smoothstep(0.42, 1.0, lum);
	float toneMix = smoothstep(0.16, 0.82, lum);
	vec3 cool = vec3(compressed.r * 0.82, compressed.g * 0.98 + shadowLift * 0.04, compressed.b * 1.24 + shadowLift * 0.08);
	vec3 warm = vec3(compressed.r * 1.14 + highlightRoll * 0.08, compressed.g * 1.03 + highlightRoll * 0.03, compressed.b * 0.84);
	vec3 splitToned = mix(cool, warm, toneMix);
	vec3 curved = vec3(pow(splitToned.r, 0.86), pow(splitToned.g, 0.95), pow(splitToned.b, 1.12));
	return clamp(mix(curved, vec3(lum), highlightRoll * 0.06), 0.0, 1.0);
}

vec3 cinematicTonemap(vec3 color) {
	return clamp(vec3(
		smoothstep(0.05, 0.95, color.r * 0.95 + 0.02),
		smoothstep(0.05, 0.95, color.g * 1.05),
		smoothstep(0.05, 0.95, color.b * 1.1)
	), 0.0, 1.0);
}

vec3 toneMap(vec3 color) {
	if (u_toneMappingMode < 0.5) return color;
	if (u_toneMappingMode < 1.5) return acesTonemap(color);
	if (u_toneMappingMode < 2.5) return reinhardTonemap(color);
	if (u_toneMappingMode < 3.5) return totosTonemap(color);
	return cinematicTonemap(color);
}

vec3 applyIntensity(vec3 color) {
	vec3 contrasted = (color - 0.5) * max(u_contrast, 0.0) + 0.5;
	return clamp(contrasted + u_brightness, 0.0, 1.0);
}

float signalValue(vec3 color, float mode) {
	if (mode < 0.5) return luma(color);
	if (mode < 1.5) return (color.r + color.g + color.b) / 3.0;
	if (mode < 2.5) return color.r;
	if (mode < 3.5) return color.g;
	return color.b;
}

float maskValue(vec3 color, float alpha) {
	if (u_maskSource < 0.5) return luma(color);
	if (u_maskSource < 1.5) return alpha;
	if (u_maskSource < 2.5) return color.r;
	if (u_maskSource < 3.5) return color.g;
	return color.b;
}

float shapedSignal(float rawSignal) {
	float signal = u_invert > 0.5 ? 1.0 - rawSignal : rawSignal;
	float signalRange = max(u_signalWhitePoint - u_signalBlackPoint, 0.001);
	float gammaExp = 1.0 / max(u_signalGamma, 0.1);
	return pow(clamp((signal - u_signalBlackPoint) / signalRange, 0.0, 1.0), gammaExp);
}

vec3 sourceColorFromMode(vec3 color, float mode) {
	if (mode < 0.5) return color;

	float signalMode = mode - 1.0;
	float signal = shapedSignal(signalValue(color, signalMode));

	if (mode < 2.5) return vec3(signal);
	if (mode < 3.5) return vec3(signal, 0.0, 0.0);
	if (mode < 4.5) return vec3(0.0, signal, 0.0);
	return vec3(0.0, 0.0, signal);
}

vec3 clipColor(vec3 color) {
	float lum = luma(color);
	float colorMin = min(color.r, min(color.g, color.b));
	float colorMax = max(color.r, max(color.g, color.b));
	if (colorMin < 0.0) {
		color = lum + ((color - lum) * lum) / max(lum - colorMin, 0.000001);
	}
	if (colorMax > 1.0) {
		color = lum + ((color - lum) * (1.0 - lum)) / max(colorMax - lum, 0.000001);
	}
	return color;
}

vec3 setLum(vec3 color, float lum) {
	return clipColor(color + (lum - luma(color)));
}

float sat(vec3 color) {
	return max(color.r, max(color.g, color.b)) - min(color.r, min(color.g, color.b));
}

vec3 setSat(vec3 color, float nextSat) {
	float colorMin = min(color.r, min(color.g, color.b));
	float colorMax = max(color.r, max(color.g, color.b));
	float delta = max(colorMax - colorMin, 0.000001);
	return clamp((color - colorMin) * nextSat / delta, 0.0, nextSat);
}

vec3 blendColor(vec3 base, vec3 blend, float mode) {
	if (mode < 0.5) return blend;
	if (mode < 1.5) return base * blend;
	if (mode < 2.5) return 1.0 - (1.0 - base) * (1.0 - blend);
	if (mode < 3.5) {
		vec3 dark = 2.0 * base * blend;
		vec3 light = 1.0 - 2.0 * (1.0 - base) * (1.0 - blend);
		return mix(dark, light, step(vec3(0.5), base));
	}
	if (mode < 4.5) return min(base, blend);
	if (mode < 5.5) return max(base, blend);
	if (mode < 6.5) return clamp(base / max(1.0 - blend, 0.000001), 0.0, 1.0);
	if (mode < 7.5) return clamp(1.0 - (1.0 - base) / max(blend, 0.000001), 0.0, 1.0);
	if (mode < 8.5) {
		vec3 dark = 2.0 * base * blend;
		vec3 light = 1.0 - 2.0 * (1.0 - base) * (1.0 - blend);
		return mix(dark, light, step(vec3(0.5), blend));
	}
	if (mode < 9.5) {
		vec3 dark = base - (1.0 - 2.0 * blend) * base * (1.0 - base);
		vec3 d = mix(((16.0 * base - 12.0) * base + 4.0) * base, sqrt(max(base, 0.0)), step(vec3(0.25), base));
		vec3 light = base + (2.0 * blend - 1.0) * (d - base);
		return mix(dark, light, step(vec3(0.5), blend));
	}
	if (mode < 10.5) return abs(base - blend);
	if (mode < 11.5) return base + blend - 2.0 * base * blend;
	if (mode < 12.5) return setLum(setSat(blend, sat(base)), luma(base));
	if (mode < 13.5) return setLum(setSat(base, sat(blend)), luma(base));
	if (mode < 14.5) return setLum(blend, luma(base));
	return setLum(base, luma(blend));
}

vec3 rotateHue(vec3 color, float angle) {
	float c = cos(angle);
	float s = sin(angle);
	mat3 hueRotation = mat3(
		0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
		0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283,
		0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072
	);
	return clamp(color * hueRotation, 0.0, 1.0);
}

vec3 applyLayerAdjustments(vec3 color) {
	vec3 saturated = mix(vec3(luma(color)), color, max(u_saturation, 0.0));
	return rotateHue(saturated, radians(u_hue));
}

vec3 backgroundFromMode(vec2 uv, vec3 solidColor, vec3 sourceToneColor, vec3 sourceGlyphColor) {
	if (u_backgroundMode < 0.5) {
		vec3 blurredSource = applyIntensity(toneMap(sampleBlurredSource(uv, u_backgroundBlurRadius)));
		return mix(solidColor, blurredSource, clamp(u_backgroundOpacity, 0.0, 1.0));
	}

	if (u_backgroundMode < 1.5 || u_backgroundMode > 2.5) {
		return u_colorMode < 0.5
			? mix(solidColor, sourceGlyphColor, clamp(u_bgOpacity, 0.0, 1.0))
			: solidColor;
	}

	vec3 backgroundSource = sourceToneColor;
	float backgroundMix = clamp(max(u_backgroundOpacity, u_bgOpacity), 0.0, 1.0);
	return mix(solidColor, backgroundSource, backgroundMix);
}

vec3 applyDotGridOverlay(vec3 color, vec3 glyphColor, vec2 cellUV, float colorSignal) {
	float edgeDistance = min(min(cellUV.x, 1.0 - cellUV.x), min(cellUV.y, 1.0 - cellUV.y));
	float gridEdge = 1.0 - smoothstep(0.0, 0.075, edgeDistance);
	float gridDot = 1.0 - smoothstep(0.04, 0.2, length(cellUV - 0.5));
	float gridMask = clamp(gridEdge * 0.35 + gridDot * 0.65, 0.0, 1.0) * clamp(u_dotGridOverlay, 0.0, 1.0);
	vec3 gridColor = max(color, glyphColor * (0.2 + colorSignal * 0.8));
	return mix(color, gridColor, gridMask);
}

vec3 applyGlitch(vec3 color, vec2 uv, vec2 pixelCoord) {
	float amount = clamp(u_glitch, 0.0, 1.0);
	if (amount <= 0.001) return color;

	float bandId = floor(uv.y * 28.0);
	float bandGate = step(0.78, temporalHash(vec2(bandId, 19.0), 10.0));
	float bandOffset = (temporalHash(vec2(bandId, 41.0), 12.0) - 0.5) * amount * 0.16 * bandGate;
	vec2 glitchUV = clamp(uv + vec2(bandOffset, 0.0), vec2(0.0), vec2(1.0));
	vec3 glitchSource = applyIntensity(toneMap(sampleSource(glitchUV)));
	float digitalNoise = (hash21(floor(pixelCoord * vec2(0.2, 1.0)) + u_time * 38.0) - 0.5) * amount * 0.16;
	vec3 glitched = vec3(glitchSource.r, color.g + digitalNoise, glitchSource.b);
	return mix(color, glitched, clamp(amount * (0.25 + bandGate * 0.75), 0.0, 1.0));
}

vec3 applyHalftone(vec3 color, vec2 uv) {
	float amount = clamp(u_halftone, 0.0, 1.0);
	if (amount <= 0.001) return color;

	float angle = 0.78539816;
	mat2 rotation = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
	vec2 halftoneUV = rotation * ((uv - 0.5) * u_resolution / clamp(u_halftoneSize, 2.0, 20.0));
	vec2 dotUV = fract(halftoneUV) - 0.5;
	float tone = clamp(luma(color), 0.0, 1.0);
	float dotRadius = mix(0.08, 0.48, tone);
	float dotMask = 1.0 - smoothstep(dotRadius, dotRadius + 0.08, length(dotUV));
	vec3 halftoneColor = color * (0.34 + dotMask * 0.9);
	return mix(color, halftoneColor, amount);
}

struct AsciiRender {
	vec3 color;
	float alpha;
	float characterMask;
};

float animationStylePhase(vec2 cellID, vec2 cellCount, vec2 sampleUV, float cellPhase) {
	float horizontalPhase = cellCount.x <= 1.0 ? 0.0 : cellID.x / max(cellCount.x - 1.0, 1.0);
	float verticalPhase = cellCount.y <= 1.0 ? 0.0 : 1.0 - (cellID.y / max(cellCount.y - 1.0, 1.0));
	float wavePhase = fract(sampleUV.x * 0.85 + sin(sampleUV.y * 12.5663706) * 0.12 + 1.0);

	if (u_animationStyle < 0.5) return wavePhase;
	if (u_animationStyle < 1.5) return horizontalPhase;
	if (u_animationStyle < 2.5) return 1.0 - horizontalPhase;
	if (u_animationStyle < 3.5) return verticalPhase;
	if (u_animationStyle < 4.5) return horizontalPhase;
	return cellPhase;
}

float animationPhaseWithRandomness(float phase, float cellPhase) {
	return fract(mix(phase, cellPhase, clamp(u_animationRandomness, 0.0, 1.0) * 0.65));
}

float animationWrappedDistance(float phase, float progress) {
	return abs(fract(phase - progress + 0.5) - 0.5);
}

float animationMaskMultiplier(float phase, float cellPhase, float characterCount) {
	float animationActive = step(0.5, u_animatedCharacters);
	float intensity = clamp(u_animationIntensity, 0.0, 1.0) * animationActive;
	float randomness = clamp(u_animationRandomness, 0.0, 1.0);
	if (intensity <= 0.001) return 1.0;

	float styledPhase = animationPhaseWithRandomness(phase, cellPhase);
	float progress = fract(u_time * max(u_characterCycleSpeed, 0.0) / max(characterCount, 1.0));

	if (u_animationStyle < 0.5) {
		float wave = 0.5 + 0.5 * sin((styledPhase - progress) * 6.2831853);
		float waveMask = mix(0.52, 1.14, wave);
		return mix(1.0, waveMask, intensity * 0.82);
	}

	if (u_animationStyle < 3.5) {
		float sweepWidth = mix(0.34, 0.14, intensity);
		float sweepDistance = animationWrappedDistance(styledPhase, progress);
		float sweepHead = 1.0 - smoothstep(0.035, sweepWidth, sweepDistance);
		float sweepMask = 0.38 + sweepHead * 0.86;
		return mix(1.0, sweepMask, intensity);
	}

	if (u_animationStyle > 3.5 && u_animationStyle < 4.5) {
		float revealHead = progress * 1.24 - 0.12;
		float revealMask = 1.0 - smoothstep(revealHead, revealHead + 0.14, styledPhase);
		return mix(1.0, revealMask, intensity);
	}

	if (u_animationStyle > 4.5) {
		float pulsePhase = u_time * max(u_characterCycleSpeed, 0.0) * 0.55 + styledPhase * 6.2831853 + cellPhase * randomness * 6.2831853;
		float pulse = 0.42 + 0.58 * (0.5 + 0.5 * sin(pulsePhase));
		return mix(1.0, pulse, intensity);
	}

	return 1.0;
}

AsciiRender renderAsciiBase(vec2 effectUV) {
	vec2 safeUV = clamp(effectUV, vec2(0.0), vec2(1.0));
	float cellSize = max(u_cellSize * max(u_pixelRatio, 1.0), 1.0);
	vec2 cellCount = max(floor(u_resolution / cellSize), vec2(1.0));
	vec2 gridUV = safeUV * cellCount;
	vec2 cellID = floor(gridUV);
	vec2 cellUV = fract(gridUV);
	vec2 sampleUV = (cellID + 0.5) / cellCount;

	vec3 sourceColor = sampleSource(sampleUV);
	vec3 toneMapped = applyIntensity(toneMap(sourceColor));
	float rawGlyphSignal = signalValue(toneMapped, u_glyphSignalMode);
	float rawColorSignal = signalValue(toneMapped, u_colorSignalMode);

	float glyphSignal = shapedSignal(rawGlyphSignal);
	float colorSignal = shapedSignal(rawColorSignal);

	vec2 uvOffset = vec2(cellSize / max(u_resolution.x, 1.0), cellSize / max(u_resolution.y, 1.0));
	float leftLuma = luma(sampleSource(clamp(sampleUV - vec2(uvOffset.x, 0.0), 0.0, 1.0)));
	float rightLuma = luma(sampleSource(clamp(sampleUV + vec2(uvOffset.x, 0.0), 0.0, 1.0)));
	float topLuma = luma(sampleSource(clamp(sampleUV - vec2(0.0, uvOffset.y), 0.0, 1.0)));
	float bottomLuma = luma(sampleSource(clamp(sampleUV + vec2(0.0, uvOffset.y), 0.0, 1.0)));
	float gradMag = clamp(length(vec2(rightLuma - leftLuma, bottomLuma - topLuma)), 0.0, 1.0);
	float biasedGlyphSignal = mix(glyphSignal, gradMag, clamp(u_directionBias, 0.0, 1.0));

	float characterCount = max(u_characterCount, 1.0);
	float signalCharacterIndex = min(floor(clamp(biasedGlyphSignal, 0.0, 1.0) * characterCount), characterCount - 1.0);
	float sequenceCharacterIndex = floor(mod(cellID.x + cellID.y * cellCount.x, characterCount));
	float characterIndex = u_characterMode > 0.5 ? sequenceCharacterIndex : signalCharacterIndex;
	float cellPhase = hash21(cellID);
	float randomCharacterIndex = floor(cellPhase * characterCount);
	float randomGate = step(cellPhase, clamp(u_randomizeCharacters, 0.0, 1.0));
	characterIndex = mix(characterIndex, randomCharacterIndex, randomGate);
	float animationPhase = animationStylePhase(cellID, cellCount, sampleUV, cellPhase);
	float styledAnimationPhase = animationPhaseWithRandomness(animationPhase, cellPhase);
	float animationPhaseOffset = styledAnimationPhase * clamp(u_animationIntensity, 0.0, 1.0) * characterCount;
	float animatedOffset = floor(u_time * max(u_characterCycleSpeed, 0.0) + animationPhaseOffset);
	characterIndex = mod(characterIndex + animatedOffset * step(0.5, u_animatedCharacters), characterCount);
	vec2 atlasSize = vec2(max(u_atlasColumns, 1.0), max(u_atlasRows, 1.0));
	vec2 atlasCell = vec2(mod(characterIndex, atlasSize.x), floor(characterIndex / atlasSize.x));
	vec2 atlasUV = (atlasCell + vec2(cellUV.x, 1.0 - cellUV.y)) / atlasSize;
	float characterMask = texture(u_asciiAtlas, atlasUV).a;

	float halfSoft = max(u_presenceSoftness * 0.5, 0.001);
	float presenceMask = smoothstep(u_presenceThreshold - halfSoft, u_presenceThreshold + halfSoft, biasedGlyphSignal);
	float shimmerWave = sin(u_time * u_shimmerSpeed * 0.3 + cellPhase * 6.2831);
	float shimmerOpacity = 1.0 - ((shimmerWave + 1.0) * 0.5 * clamp(u_shimmerAmount, 0.0, 1.0));
	float animationMask = animationMaskMultiplier(animationPhase, cellPhase, characterCount);
	float finalMask = characterMask * presenceMask * shimmerOpacity * animationMask * clamp(u_characterOpacity, 0.0, 1.0);

	vec3 monochromeColor = u_tintColor * colorSignal;
	vec3 greenTerminalColor = vec3(0.0, colorSignal, 0.0);
	vec3 sourceGlyphColor = sourceColorFromMode(toneMapped, u_colorSourceMode);
	vec3 glyphColor = u_colorMode < 0.5
		? sourceGlyphColor
		: (u_colorMode < 1.5 ? monochromeColor : greenTerminalColor);
	vec3 backgroundColor = backgroundFromMode(sampleUV, u_backgroundColor, toneMapped, sourceGlyphColor);
	vec3 asciiColor = mix(backgroundColor, glyphColor, finalMask);

	float bloomThresholdRange = max(u_bloomSoftness * 0.5, 0.001);
	float bloomSignal = smoothstep(u_bloomThreshold - bloomThresholdRange, u_bloomThreshold + bloomThresholdRange, biasedGlyphSignal);
	float cellDistance = length(cellUV - 0.5);
	float bloomRadius = clamp(u_bloomRadius / 24.0, 0.0, 1.0);
	float cellGlow = 1.0 - smoothstep(max(0.04, 0.48 - bloomRadius * 0.42), 0.72, cellDistance);
	asciiColor += glyphColor * bloomSignal * finalMask * cellGlow * u_bloomIntensity * u_bloomEnabled;
	asciiColor += glyphColor * finalMask * cellGlow * (0.3 + colorSignal * 0.7) * clamp(u_characterBloom, 0.0, 1.0);
	asciiColor = applyDotGridOverlay(asciiColor, glyphColor, cellUV, colorSignal);
	asciiColor = applyLayerAdjustments(clamp(asciiColor, 0.0, 1.0));

	vec3 blendedColor = blendColor(toneMapped, asciiColor, u_blendMode);
	vec3 filterColor = mix(toneMapped, blendedColor, clamp(u_layerOpacity, 0.0, 1.0));
	float rawMask = maskValue(asciiColor, finalMask);
	rawMask = u_maskInvert > 0.5 ? 1.0 - rawMask : rawMask;
	float maskStrength = mix(1.0, clamp(rawMask, 0.0, 1.0), clamp(u_layerOpacity, 0.0, 1.0));
	vec3 multiplyMaskColor = toneMapped * maskStrength;
	vec3 stencilMaskColor = toneMapped * step(0.5, maskStrength);
	vec3 maskColor = u_maskMode > 0.5 ? stencilMaskColor : multiplyMaskColor;
	vec3 finalColor = u_compositeMode > 0.5 ? maskColor : filterColor;
	float outputAlpha = u_transparentBackground > 0.5 ? clamp(finalMask * u_layerOpacity, 0.0, 1.0) : 1.0;
	vec3 outputColor = u_transparentBackground > 0.5 ? glyphColor : finalColor;

	return AsciiRender(clamp(outputColor, 0.0, 1.0), outputAlpha, finalMask);
}

vec2 effectPixelOffset(vec2 direction, float pixels) {
	return direction * pixels * max(u_pixelRatio, 1.0) / max(u_resolution, vec2(1.0));
}

AsciiRender sampleRenderedBaseRender(vec2 uv) {
	return renderAsciiBase(clamp(uv, vec2(0.0), vec2(1.0)));
}

vec3 sampleRenderedBase(vec2 uv) {
	return sampleRenderedBaseRender(uv).color;
}

vec3 sampleBlurredRender(vec2 uv, float radius) {
	vec2 texel = effectPixelOffset(vec2(1.0), radius);
	vec3 color = sampleRenderedBase(uv) * 4.0;
	color += sampleRenderedBase(uv + vec2(texel.x, 0.0)) * 2.0;
	color += sampleRenderedBase(uv - vec2(texel.x, 0.0)) * 2.0;
	color += sampleRenderedBase(uv + vec2(0.0, texel.y)) * 2.0;
	color += sampleRenderedBase(uv - vec2(0.0, texel.y)) * 2.0;
	color += sampleRenderedBase(uv + texel);
	color += sampleRenderedBase(uv - texel);
	color += sampleRenderedBase(uv + vec2(texel.x, -texel.y));
	color += sampleRenderedBase(uv + vec2(-texel.x, texel.y));
	return color / 16.0;
}

vec3 applyRenderedChannelSplit(vec3 color, vec2 uv, vec2 offset, float amount) {
	vec3 redSample = sampleRenderedBase(uv + offset);
	vec3 greenSample = sampleRenderedBase(uv);
	vec3 blueSample = sampleRenderedBase(uv - offset);
	vec3 splitColor = vec3(redSample.r, greenSample.g, blueSample.b);
	return mix(color, splitColor, clamp(amount, 0.0, 1.0));
}

vec3 applyCharacterChannelSplit(vec3 color, vec2 uv, vec2 offset, float amount) {
	AsciiRender redRender = sampleRenderedBaseRender(uv + offset);
	AsciiRender greenRender = sampleRenderedBaseRender(uv);
	AsciiRender blueRender = sampleRenderedBaseRender(uv - offset);
	vec3 splitColor = vec3(redRender.color.r, greenRender.color.g, blueRender.color.b);
	float splitMask = max(max(redRender.characterMask, greenRender.characterMask), blueRender.characterMask);
	return mix(color, splitColor, clamp(amount, 0.0, 1.0) * clamp(splitMask, 0.0, 1.0));
}

vec3 applyFilmDust(vec3 color, vec2 uv, vec2 pixelCoord) {
	float dustAmount = clamp(u_filmDust, 0.0, 1.0);
	if (dustAmount <= 0.001) {
		return color;
	}

	float dustFrame = floor(u_time * 0.45);
	vec2 dustCellSize = vec2(34.0, 27.0);
	vec2 dustCell = floor(pixelCoord / dustCellSize);
	vec2 dustCellUV = fract(pixelCoord / dustCellSize);
	vec2 dustFleckCenter = vec2(
		hash21(dustCell + vec2(4.7, 19.3) + dustFrame * 11.0),
		hash21(dustCell + vec2(27.1, 5.9) + dustFrame * 11.0)
	);
	float dustFleckGate = step(0.996 - dustAmount * 0.012, hash21(dustCell + dustFrame * 17.0));
	float dustFleckRadius = mix(0.028, 0.088, hash21(dustCell + vec2(2.1, 9.4)));
	vec2 dustFleckStretch = vec2(mix(0.62, 1.72, hash21(dustCell + vec2(13.6, 1.8))), 1.0);
	float dustFleck = 1.0 - smoothstep(dustFleckRadius * 0.35, dustFleckRadius, length((dustCellUV - dustFleckCenter) * dustFleckStretch));
	float brightFleck = dustFleck * dustFleckGate * step(0.47, hash21(dustCell + vec2(8.2, 31.0)));
	float darkFleck = dustFleck * dustFleckGate * (1.0 - step(0.47, hash21(dustCell + vec2(8.2, 31.0))));
	color = mix(color, vec3(1.0), brightFleck * dustAmount * 0.48);
	color *= 1.0 - darkFleck * dustAmount * 0.58;

	float dustScratchFrame = floor(u_time * 0.22);
	float dustScratch = 0.0;
	for (int i = 0; i < 4; i++) {
		float scratchIndex = float(i);
		float scratchSeed = hash21(vec2(scratchIndex * 19.0 + 3.0, dustScratchFrame));
		float scratchActive = step(0.82 - dustAmount * 0.22, scratchSeed);
		float scratchLength = mix(0.12, 0.46, hash21(vec2(scratchIndex + 7.0, dustScratchFrame + 2.0)));
		float scratchTop = hash21(vec2(scratchIndex + 29.0, dustScratchFrame + 5.0)) * (1.0 - scratchLength);
		float scratchX = hash21(vec2(scratchIndex + 43.0, dustScratchFrame + 11.0));
		float scratchTilt = (hash21(vec2(scratchIndex + 61.0, dustScratchFrame + 17.0)) - 0.5) * 0.034;
		float scratchWidth = mix(0.72, 1.55, hash21(vec2(scratchIndex + 83.0, dustScratchFrame + 23.0))) / max(u_resolution.x, 1.0);
		float xAtY = scratchX + (uv.y - scratchTop) * scratchTilt;
		float lineMask = 1.0 - smoothstep(scratchWidth, scratchWidth * 3.8, abs(uv.x - xAtY));
		float segmentMask = smoothstep(scratchTop, scratchTop + 0.018, uv.y) *
			(1.0 - smoothstep(scratchTop + scratchLength - 0.026, scratchTop + scratchLength, uv.y));
		float scratchBand = floor((uv.y - scratchTop) * mix(52.0, 88.0, scratchSeed));
		float scratchBreak = step(0.18, hash21(vec2(scratchBand, scratchIndex * 31.0 + dustScratchFrame)));
		dustScratch = max(dustScratch, lineMask * segmentMask * scratchBreak * scratchActive);
	}
	color = mix(color, vec3(0.94), dustScratch * dustAmount * 0.36);

	return color;
}

vec3 applyPostEffects(vec3 color, vec2 uv, vec2 pixelCoord) {
	vec2 centered = uv * 2.0 - 1.0;
	centered.x *= u_resolution.x / max(u_resolution.y, 1.0);

	float pixelateAmount = clamp(u_pixelate, 0.0, 1.0);
	if (pixelateAmount > 0.001) {
		float pixelBlock = clamp(u_pixelateSize, 2.0, 30.0);
		vec2 pixelatedUV = (floor(uv * u_resolution / pixelBlock) + 0.5) * pixelBlock / max(u_resolution, vec2(1.0));
		vec3 pixelatedRender = sampleRenderedBase(pixelatedUV);
		color = mix(color, pixelatedRender, pixelateAmount);
	}

	float blurAmount = clamp(u_blur, 0.0, 1.0);
	if (blurAmount > 0.001) {
		vec3 blurredRender = sampleBlurredRender(uv, clamp(u_blurRadius, 1.0, 20.0));
		color = mix(color, blurredRender, blurAmount);
	}

	float vignetteMask = smoothstep(1.28, 0.22, length(centered));
	color = mix(color, color * vignetteMask, clamp(u_vignette, 0.0, 1.0));

	float crtAmount = clamp(u_crtCurvature, 0.0, 1.0);
	if (crtAmount > 0.001) {
		float edgeFalloff = smoothstep(1.42, 0.72, length(centered));
		color *= mix(1.0, 0.82 + edgeFalloff * 0.18, crtAmount);
		color += vec3(0.02, 0.04, 0.08) * crtAmount * (1.0 - edgeFalloff);
	}

	float scanWave = 0.5 + 0.5 * sin(pixelCoord.y * 3.14159265);
	color *= 1.0 - clamp(u_scanLines, 0.0, 1.0) * (0.08 + scanWave * 0.16);

	float chromaticAmount = clamp(u_chromatic, 0.0, 1.0);
	if (chromaticAmount > 0.001) {
		vec2 chromaDirection = normalize(centered + vec2(0.0001));
		vec2 chromaOffset = effectPixelOffset(chromaDirection, clamp(u_chromaticOffset, 1.0, 20.0));
		color = applyRenderedChannelSplit(color, uv, chromaOffset, chromaticAmount);
	}

	float characterChromaticAmount = clamp(u_characterChromatic, 0.0, 1.0);
	if (characterChromaticAmount > 0.001) {
		vec2 characterOffset = effectPixelOffset(vec2(1.0, 0.0), clamp(u_characterChromaticOffset, 1.0, 20.0));
		color = applyCharacterChannelSplit(color, uv, characterOffset, characterChromaticAmount);
	}

	float splitAmount = clamp(max(u_rgbSplit, u_chromaticAberration), 0.0, 1.0);
	if (splitAmount > 0.001) {
		vec2 splitOffset = effectPixelOffset(vec2(1.0, 0.0), clamp(u_rgbSplitOffset, 1.0, 20.0));
		color = applyRenderedChannelSplit(color, uv, splitOffset, splitAmount);
	}

	color = applyGlitch(color, uv, pixelCoord);
	color = applyHalftone(color, uv);

	float overlayAmount = clamp(u_colorOverlay, 0.0, 1.0);
	if (overlayAmount > 0.001) {
		vec3 overlayColor = blendColor(color, u_colorOverlayColor, u_colorOverlayBlendMode);
		color = mix(color, overlayColor, overlayAmount);
	}

	float grain = hash21(pixelCoord + u_time * 60.0) - 0.5;
	color += grain * clamp(u_filmGrain, 0.0, 1.0);

	color = applyFilmDust(color, uv, pixelCoord);

	return clamp(color, 0.0, 1.0);
}

void main() {
	vec2 effectUV = applyCrtCurvature(v_uv);
	vec2 pixelCoord = effectUV * u_resolution;
	AsciiRender baseRender = renderAsciiBase(effectUV);
	vec3 outputColor = applyPostEffects(baseRender.color, effectUV, pixelCoord);

	fragColor = vec4(clamp(outputColor, 0.0, 1.0), baseRender.alpha);
}
`;

type AsciiAtlas = Readonly<{
	canvas: HTMLCanvasElement;
	columns: number;
	rows: number;
	characterCount: number;
}>;

type RGB = readonly [number, number, number];

function createAsciiAtlas(characters: string, fontWeight: AsciiFontWeight): AsciiAtlas {
	const glyphs = Array.from(characters.length > 0 ? characters : " ");
	const columns = Math.max(Math.ceil(Math.sqrt(glyphs.length)), 1);
	const rows = Math.max(Math.ceil(glyphs.length / columns), 1);
	const canvas = document.createElement("canvas");
	canvas.width = columns * ASCII_ATLAS_TILE_SIZE;
	canvas.height = rows * ASCII_ATLAS_TILE_SIZE;

	const ctx = canvas.getContext("2d");
	if (!ctx) {
		return { canvas, columns, rows, characterCount: glyphs.length };
	}

	const fontWeightMap: Record<AsciiFontWeight, string> = {
		bold: "700",
		regular: "400",
		thin: "100",
	};

	ctx.imageSmoothingEnabled = false;
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = "#ffffff";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.font = `${fontWeightMap[fontWeight]} ${Math.round(ASCII_ATLAS_TILE_SIZE * 0.78)}px "JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace`;

	for (let index = 0; index < glyphs.length; index++) {
		const column = index % columns;
		const row = Math.floor(index / columns);
		ctx.fillText(
			glyphs[index] ?? "",
			column * ASCII_ATLAS_TILE_SIZE + ASCII_ATLAS_TILE_SIZE / 2,
			row * ASCII_ATLAS_TILE_SIZE + ASCII_ATLAS_TILE_SIZE / 2 + 1,
		);
	}

	return { canvas, columns, rows, characterCount: glyphs.length };
}

function createEmptyTexture(): HTMLCanvasElement {
	const canvas = document.createElement("canvas");
	canvas.width = 1;
	canvas.height = 1;
	const ctx = canvas.getContext("2d");
	ctx?.clearRect(0, 0, canvas.width, canvas.height);

	return canvas;
}

function resolveCssColorValue(value: string, depth = 0): string {
	const normalized = value.trim();
	if (depth > 6) return normalized;

	const variable = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/i.exec(normalized);
	if (!variable || typeof window === "undefined") return normalized;

	const tokenValue = window.getComputedStyle(document.documentElement).getPropertyValue(variable[1]).trim();
	if (tokenValue) return resolveCssColorValue(tokenValue, depth + 1);

	const fallback = variable[2]?.trim();
	return fallback ? resolveCssColorValue(fallback, depth + 1) : normalized;
}

function parseColor(value: string, fallback: RGB): RGB {
	const normalized = resolveCssColorValue(value);
	const short = /^#([0-9a-f]{3})$/i.exec(normalized);
	if (short) {
		return [
			parseInt(short[1][0] + short[1][0], 16) / 255,
			parseInt(short[1][1] + short[1][1], 16) / 255,
			parseInt(short[1][2] + short[1][2], 16) / 255,
		];
	}

	const full = /^#([0-9a-f]{6})$/i.exec(normalized);
	if (full) {
		return [
			parseInt(full[1].slice(0, 2), 16) / 255,
			parseInt(full[1].slice(2, 4), 16) / 255,
			parseInt(full[1].slice(4, 6), 16) / 255,
		];
	}

	const rgb = /^rgba?\(\s*([\d.]+)(?:\s*,\s*|\s+)([\d.]+)(?:\s*,\s*|\s+)([\d.]+)(?:\s*[,/]\s*[\d.]+%?)?\s*\)$/i.exec(normalized);
	if (!rgb) return fallback;

	return [
		Math.min(Number.parseFloat(rgb[1]) / 255, 1),
		Math.min(Number.parseFloat(rgb[2]) / 255, 1),
		Math.min(Number.parseFloat(rgb[3]) / 255, 1),
	];
}

function resolveSourceColorValues(sourceColors?: readonly string[]): readonly RGB[] {
	const colors = sourceColors?.slice(0, ASCII_MAX_SOURCE_COLORS) ?? [...ASCII_DEFAULT_SOURCE_COLORS];
	const safeColors = colors.length > 0 ? colors : [...ASCII_DEFAULT_SOURCE_COLORS];
	return safeColors.map((color, index) => {
		const fallbackColor = ASCII_DEFAULT_SOURCE_COLORS[index % ASCII_DEFAULT_SOURCE_COLORS.length] ?? ASCII_DEFAULT_SOURCE_COLORS[0];
		const fallback = parseColor(fallbackColor, [0, 0, 0]);
		return parseColor(color, fallback);
	});
}

function flattenSourceColorValues(colors: readonly RGB[]): Float32Array {
	const data = new Float32Array(ASCII_MAX_SOURCE_COLORS * 4);
	for (let index = 0; index < ASCII_MAX_SOURCE_COLORS; index += 1) {
		const color = colors[index] ?? colors[colors.length - 1] ?? [0, 0, 0];
		data[index * 4] = color[0];
		data[index * 4 + 1] = color[1];
		data[index * 4 + 2] = color[2];
		data[index * 4 + 3] = 1;
	}
	return data;
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
	const shader = gl.createShader(type);
	if (!shader) return null;

	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.error(gl.getShaderInfoLog(shader));
		gl.deleteShader(shader);
		return null;
	}

	return shader;
}

function setTextureFromSource(
	gl: WebGL2RenderingContext,
	texture: WebGLTexture | null,
	source: TexImageSource,
) {
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
}

function enumIndex<const T extends readonly string[]>(values: T, value: T[number], fallback = 0): number {
	const index = values.indexOf(value);
	return index === -1 ? fallback : index;
}

function clampNumber(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function densityToCellSize(density: number): number {
	return 48 - clampNumber(density, 0, 1) * 44;
}

function resolveEffectAmount(value: EffectAmount | undefined): number {
	if (typeof value === "boolean") return value ? 1 : 0;
	return value ?? 0;
}

function resolveBackgroundModeIndex(backgroundMode: AsciiBackgroundMode | LegacyAsciiBackgroundMode): number {
	if (backgroundMode === "blurred-source") return enumIndex(ASCII_BACKGROUND_MODES, "blurred-image");
	if (backgroundMode === "solid") return enumIndex(ASCII_BACKGROUND_MODES, "solid-black");
	if (backgroundMode === "source") return enumIndex(ASCII_BACKGROUND_MODES, "original-image");
	return enumIndex(ASCII_BACKGROUND_MODES, backgroundMode);
}

function isTransparentBackgroundMode(backgroundMode: AsciiBackgroundMode | LegacyAsciiBackgroundMode): boolean {
	return backgroundMode === "transparent";
}

function resolveCharacters(charset: AsciiCharset, customChars: string, characters?: string): string {
	if (charset === "custom") {
		return customChars || characters || " ";
	}

	if (characters !== undefined) {
		return characters || " ";
	}

	return ASCII_CHARSETS[charset] ?? ASCII_DEFAULT_CHARACTERS;
}

function shouldUseAnonymousCrossOrigin(src: string): boolean {
	if (typeof window === "undefined") return false;

	try {
		const url = new URL(src, window.location.href);
		return (url.protocol === "http:" || url.protocol === "https:") && url.origin !== window.location.origin;
	} catch {
		return false;
	}
}

export interface AsciiProps {
	className?: string;
	style?: CSSProperties;
	imageSrc?: string;
	sourceMode?: AsciiSourceMode;
	sourceColors?: readonly string[];
	opacity?: number;
	blendMode?: AsciiBlendMode;
	compositeMode?: AsciiCompositeMode;
	hue?: number;
	saturation?: number;
	brightness?: number;
	contrast?: number;
	density?: number;
	cellSize?: number;
	charset?: AsciiCharset;
	characterMode?: AsciiCharacterMode;
	characters?: string;
	customChars?: string;
	characterOpacity?: number;
	randomizeCharacters?: number;
	randomSeed?: number;
	animatedCharacters?: boolean;
	animationPlaying?: boolean;
	animationStyle?: AsciiAnimationStyle;
	animationIntensity?: number;
	animationRandomness?: number;
	characterCycleSpeed?: number;
	dotGridOverlay?: number;
	fontWeight?: AsciiFontWeight;
	colorMode?: AsciiColorMode;
	colorSourceMode?: AsciiColorSourceMode;
	monoColor?: string;
	tint?: string;
	backgroundColor?: string;
	backgroundMode?: AsciiBackgroundMode | LegacyAsciiBackgroundMode;
	backgroundOpacity?: number;
	backgroundBlurRadius?: number;
	bgOpacity?: number;
	invert?: boolean;
	coverage?: number;
	edgeEmphasis?: number;
	directionBias?: number;
	maskSource?: AsciiMaskSource;
	maskMode?: AsciiMaskMode;
	maskInvert?: boolean;
	toneMapping?: AsciiToneMappingMode;
	glyphSignalMode?: AsciiSignalMode;
	colorSignalMode?: AsciiSignalMode;
	signalBlackPoint?: number;
	signalWhitePoint?: number;
	signalGamma?: number;
	presenceThreshold?: number;
	presenceSoftness?: number;
	shimmerAmount?: number;
	shimmerSpeed?: number;
	bloomEnabled?: boolean;
	bloomIntensity?: number;
	bloomThreshold?: number;
	bloomRadius?: number;
	bloomSoftness?: number;
	colorOverlay?: EffectAmount;
	colorOverlayColor?: string;
	colorOverlayBlendMode?: AsciiBlendMode;
	vignette?: EffectAmount;
	scanLines?: EffectAmount;
	crtCurvature?: EffectAmount;
	chromatic?: EffectAmount;
	chromaticOffset?: number;
	characterBloom?: EffectAmount;
	characterChromatic?: EffectAmount;
	characterChromaticOffset?: number;
	chromaticAberration?: number;
	rgbSplit?: EffectAmount;
	rgbSplitOffset?: number;
	glitch?: EffectAmount;
	blur?: EffectAmount;
	blurRadius?: number;
	pixelate?: EffectAmount;
	pixelateSize?: number;
	halftone?: EffectAmount;
	halftoneSize?: number;
	filmGrain?: EffectAmount;
	filmDust?: EffectAmount;
	speed?: number;
	transparentBackground?: boolean;
}

export default function Ascii({
	className,
	style,
	imageSrc,
	sourceMode = "field",
	sourceColors,
	opacity = 1,
	blendMode = "normal",
	compositeMode = "filter",
	hue = 0,
	saturation = 1,
	brightness = 0,
	contrast = 1,
	density,
	cellSize,
	charset = "light",
	characterMode,
	characters,
	customChars = ASCII_DEFAULT_CHARACTERS,
	characterOpacity = 1,
	randomizeCharacters = 0,
	randomSeed = 0,
	animatedCharacters = false,
	animationPlaying = true,
	animationStyle = "wave",
	animationIntensity = 0.83,
	animationRandomness = 0.5,
	characterCycleSpeed = 8,
	dotGridOverlay = 0,
	fontWeight = "regular",
	colorMode = "monochrome",
	colorSourceMode = "source",
	monoColor,
	tint,
	backgroundColor = "#000000",
	backgroundMode = "solid-black",
	backgroundOpacity = 1,
	backgroundBlurRadius = 60,
	bgOpacity = 0,
	invert = false,
	coverage,
	edgeEmphasis,
	directionBias,
	maskSource = "luminance",
	maskMode = "multiply",
	maskInvert = false,
	toneMapping = "none",
	glyphSignalMode = "luminance",
	colorSignalMode = "luminance",
	signalBlackPoint = 0,
	signalWhitePoint = 1,
	signalGamma = 1,
	presenceThreshold,
	presenceSoftness = 0,
	shimmerAmount = 0,
	shimmerSpeed = 1,
	bloomEnabled = false,
	bloomIntensity = 1.25,
	bloomThreshold = 0.6,
	bloomRadius = 6,
	bloomSoftness = 0.35,
	colorOverlay = false,
	colorOverlayColor = "#F5F5F0",
	colorOverlayBlendMode = "multiply",
	vignette = 0,
	scanLines = 0,
	crtCurvature = false,
	chromatic = false,
	chromaticOffset = 3,
	characterBloom = false,
	characterChromatic = false,
	characterChromaticOffset = 3,
	chromaticAberration = 0,
	rgbSplit,
	rgbSplitOffset = 2,
	glitch = false,
	blur = false,
	blurRadius = 2,
	pixelate = false,
	pixelateSize = 4,
	halftone = false,
	halftoneSize = 4,
	filmGrain = 0,
	filmDust = false,
	speed = 1,
	transparentBackground = false,
}: AsciiProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const animRef = useRef<number>(0);
	const elapsedTimeRef = useRef(0);
	const activeCharacters = useMemo(
		() => resolveCharacters(charset, customChars, characters),
		[characters, charset, customChars],
	);
	const resolvedCharacterMode = characterMode ?? "signal";
	const resolvedCellSize = cellSize ?? (density === undefined ? 12 : densityToCellSize(density));
	const resolvedDirectionBias = directionBias ?? edgeEmphasis ?? 0;
	const resolvedPresenceThreshold = presenceThreshold ?? (coverage === undefined ? 0 : 1 - clampNumber(coverage, 0, 1));
	const resolvedRgbSplit = rgbSplit ?? chromaticAberration;
	const resolvedTransparentBackground = transparentBackground || isTransparentBackgroundMode(backgroundMode);
	const activeMonoColor = monoColor ?? tint ?? "#F5F5F0";
	const sourceColorValues = useMemo(() => resolveSourceColorValues(sourceColors), [sourceColors]);

	const propsRef = useRef({
		activeCharacters,
		activeMonoColor,
		animatedCharacters,
		animationIntensity,
		animationPlaying,
		animationRandomness,
		animationStyle,
		backgroundBlurRadius,
		backgroundColor,
		backgroundMode,
		backgroundOpacity,
		blendMode,
		bloomEnabled,
		bloomIntensity,
		bloomRadius,
		bloomSoftness,
		bloomThreshold,
		bgOpacity,
		brightness,
		characterCycleSpeed,
		characterOpacity,
		characterBloom,
		characterChromatic,
		characterChromaticOffset,
		chromatic,
		chromaticOffset,
		chromaticAberration,
		colorOverlay,
		colorOverlayBlendMode,
		colorOverlayColor,
		colorMode,
		colorSourceMode,
		colorSignalMode,
		compositeMode,
		contrast,
		dotGridOverlay,
		blur,
		blurRadius,
		crtCurvature,
		filmGrain,
		filmDust,
		fontWeight,
		glyphSignalMode,
		hue,
		imageSrc,
		invert,
		maskInvert,
		maskMode,
		maskSource,
		opacity,
		presenceSoftness,
		glitch,
		halftone,
		halftoneSize,
		pixelate,
		pixelateSize,
		randomizeCharacters,
		randomSeed,
		resolvedCellSize,
		resolvedCharacterMode,
		resolvedDirectionBias,
		resolvedPresenceThreshold,
		resolvedRgbSplit,
		resolvedTransparentBackground,
		rgbSplitOffset,
		saturation,
		scanLines,
		shimmerAmount,
		shimmerSpeed,
		signalBlackPoint,
		signalGamma,
		signalWhitePoint,
		sourceColorValues,
		sourceMode,
		speed,
		toneMapping,
		vignette,
	});

	useLayoutEffect(() => {
		propsRef.current = {
			activeCharacters,
			activeMonoColor,
			animatedCharacters,
			animationIntensity,
			animationPlaying,
			animationRandomness,
			animationStyle,
			backgroundBlurRadius,
			backgroundColor,
			backgroundMode,
			backgroundOpacity,
			blendMode,
			bloomEnabled,
			bloomIntensity,
			bloomRadius,
			bloomSoftness,
			bloomThreshold,
			bgOpacity,
			brightness,
			characterCycleSpeed,
			characterOpacity,
			characterBloom,
			characterChromatic,
			characterChromaticOffset,
			chromatic,
			chromaticOffset,
			chromaticAberration,
			colorOverlay,
			colorOverlayBlendMode,
			colorOverlayColor,
			colorMode,
			colorSourceMode,
			colorSignalMode,
			compositeMode,
			contrast,
			dotGridOverlay,
			blur,
			blurRadius,
			crtCurvature,
			filmGrain,
			filmDust,
			fontWeight,
			glyphSignalMode,
			hue,
			imageSrc,
			invert,
			maskInvert,
			maskMode,
			maskSource,
			opacity,
			presenceSoftness,
			glitch,
			halftone,
			halftoneSize,
			pixelate,
			pixelateSize,
			randomizeCharacters,
			randomSeed,
			resolvedCellSize,
			resolvedCharacterMode,
			resolvedDirectionBias,
			resolvedPresenceThreshold,
			resolvedRgbSplit,
			resolvedTransparentBackground,
			rgbSplitOffset,
			saturation,
			scanLines,
			shimmerAmount,
			shimmerSpeed,
			signalBlackPoint,
			signalGamma,
			signalWhitePoint,
			sourceColorValues,
			sourceMode,
			speed,
			toneMapping,
			vignette,
		};
	});

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const initialProps = propsRef.current;
		// alpha/premultipliedAlpha are frozen at context creation; toggling
		// transparentBackground after mount won't change the canvas alpha channel
		// until next remount, but u_transparentBackground still updates per frame.
		const gl = canvas.getContext("webgl2", {
			alpha: initialProps.resolvedTransparentBackground,
			antialias: false,
			premultipliedAlpha: !initialProps.resolvedTransparentBackground,
		});
		if (!gl) return;

		const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
		const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
		if (!vertexShader || !fragmentShader) return;

		const program = gl.createProgram();
		if (!program) return;

		gl.attachShader(program, vertexShader);
		gl.attachShader(program, fragmentShader);
		gl.linkProgram(program);

		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			console.error(gl.getProgramInfoLog(program));
			return;
		}

		gl.useProgram(program);

		const buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

		const position = gl.getAttribLocation(program, "a_position");
		gl.enableVertexAttribArray(position);
		gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

		const sourceTexture = gl.createTexture();
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		setTextureFromSource(gl, sourceTexture, createEmptyTexture());

		const atlasTexture = gl.createTexture();
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

		const u = {
			texture: gl.getUniformLocation(program, "u_texture"),
			asciiAtlas: gl.getUniformLocation(program, "u_asciiAtlas"),
			resolution: gl.getUniformLocation(program, "u_resolution"),
			pixelRatio: gl.getUniformLocation(program, "u_pixelRatio"),
			time: gl.getUniformLocation(program, "u_time"),
			sourceMode: gl.getUniformLocation(program, "u_sourceMode"),
			cellSize: gl.getUniformLocation(program, "u_cellSize"),
			layerOpacity: gl.getUniformLocation(program, "u_layerOpacity"),
			blendMode: gl.getUniformLocation(program, "u_blendMode"),
			compositeMode: gl.getUniformLocation(program, "u_compositeMode"),
			hue: gl.getUniformLocation(program, "u_hue"),
			saturation: gl.getUniformLocation(program, "u_saturation"),
			brightness: gl.getUniformLocation(program, "u_brightness"),
			contrast: gl.getUniformLocation(program, "u_contrast"),
			characterMode: gl.getUniformLocation(program, "u_characterMode"),
			colorMode: gl.getUniformLocation(program, "u_colorMode"),
			colorSourceMode: gl.getUniformLocation(program, "u_colorSourceMode"),
			directionBias: gl.getUniformLocation(program, "u_directionBias"),
			glyphSignalMode: gl.getUniformLocation(program, "u_glyphSignalMode"),
			colorSignalMode: gl.getUniformLocation(program, "u_colorSignalMode"),
			maskSource: gl.getUniformLocation(program, "u_maskSource"),
			maskMode: gl.getUniformLocation(program, "u_maskMode"),
			maskInvert: gl.getUniformLocation(program, "u_maskInvert"),
			toneMappingMode: gl.getUniformLocation(program, "u_toneMappingMode"),
			signalBlackPoint: gl.getUniformLocation(program, "u_signalBlackPoint"),
			signalWhitePoint: gl.getUniformLocation(program, "u_signalWhitePoint"),
			signalGamma: gl.getUniformLocation(program, "u_signalGamma"),
			presenceThreshold: gl.getUniformLocation(program, "u_presenceThreshold"),
			presenceSoftness: gl.getUniformLocation(program, "u_presenceSoftness"),
			characterOpacity: gl.getUniformLocation(program, "u_characterOpacity"),
			randomizeCharacters: gl.getUniformLocation(program, "u_randomizeCharacters"),
			randomSeed: gl.getUniformLocation(program, "u_randomSeed"),
			animatedCharacters: gl.getUniformLocation(program, "u_animatedCharacters"),
			animationStyle: gl.getUniformLocation(program, "u_animationStyle"),
			animationIntensity: gl.getUniformLocation(program, "u_animationIntensity"),
			animationRandomness: gl.getUniformLocation(program, "u_animationRandomness"),
			characterCycleSpeed: gl.getUniformLocation(program, "u_characterCycleSpeed"),
			dotGridOverlay: gl.getUniformLocation(program, "u_dotGridOverlay"),
			shimmerAmount: gl.getUniformLocation(program, "u_shimmerAmount"),
			shimmerSpeed: gl.getUniformLocation(program, "u_shimmerSpeed"),
			bloomEnabled: gl.getUniformLocation(program, "u_bloomEnabled"),
			bloomIntensity: gl.getUniformLocation(program, "u_bloomIntensity"),
			bloomThreshold: gl.getUniformLocation(program, "u_bloomThreshold"),
			bloomRadius: gl.getUniformLocation(program, "u_bloomRadius"),
			bloomSoftness: gl.getUniformLocation(program, "u_bloomSoftness"),
			bgOpacity: gl.getUniformLocation(program, "u_bgOpacity"),
			backgroundMode: gl.getUniformLocation(program, "u_backgroundMode"),
			backgroundOpacity: gl.getUniformLocation(program, "u_backgroundOpacity"),
			backgroundBlurRadius: gl.getUniformLocation(program, "u_backgroundBlurRadius"),
			colorOverlay: gl.getUniformLocation(program, "u_colorOverlay"),
			colorOverlayBlendMode: gl.getUniformLocation(program, "u_colorOverlayBlendMode"),
			vignette: gl.getUniformLocation(program, "u_vignette"),
			scanLines: gl.getUniformLocation(program, "u_scanLines"),
			crtCurvature: gl.getUniformLocation(program, "u_crtCurvature"),
			chromatic: gl.getUniformLocation(program, "u_chromatic"),
			chromaticOffset: gl.getUniformLocation(program, "u_chromaticOffset"),
			characterBloom: gl.getUniformLocation(program, "u_characterBloom"),
			characterChromatic: gl.getUniformLocation(program, "u_characterChromatic"),
			characterChromaticOffset: gl.getUniformLocation(program, "u_characterChromaticOffset"),
			chromaticAberration: gl.getUniformLocation(program, "u_chromaticAberration"),
			rgbSplit: gl.getUniformLocation(program, "u_rgbSplit"),
			rgbSplitOffset: gl.getUniformLocation(program, "u_rgbSplitOffset"),
			glitch: gl.getUniformLocation(program, "u_glitch"),
			blur: gl.getUniformLocation(program, "u_blur"),
			blurRadius: gl.getUniformLocation(program, "u_blurRadius"),
			pixelate: gl.getUniformLocation(program, "u_pixelate"),
			pixelateSize: gl.getUniformLocation(program, "u_pixelateSize"),
			halftone: gl.getUniformLocation(program, "u_halftone"),
			halftoneSize: gl.getUniformLocation(program, "u_halftoneSize"),
			filmGrain: gl.getUniformLocation(program, "u_filmGrain"),
			filmDust: gl.getUniformLocation(program, "u_filmDust"),
			invert: gl.getUniformLocation(program, "u_invert"),
			speed: gl.getUniformLocation(program, "u_speed"),
			transparentBackground: gl.getUniformLocation(program, "u_transparentBackground"),
			atlasColumns: gl.getUniformLocation(program, "u_atlasColumns"),
			atlasRows: gl.getUniformLocation(program, "u_atlasRows"),
			characterCount: gl.getUniformLocation(program, "u_characterCount"),
			sourceColorCount: gl.getUniformLocation(program, "u_sourceColorCount"),
			sourceColors: gl.getUniformLocation(program, "u_sourceColors[0]"),
			tintColor: gl.getUniformLocation(program, "u_tintColor"),
			backgroundColor: gl.getUniformLocation(program, "u_backgroundColor"),
			colorOverlayColor: gl.getUniformLocation(program, "u_colorOverlayColor"),
		};

		if (u.texture) gl.uniform1i(u.texture, 0);
		if (u.asciiAtlas) gl.uniform1i(u.asciiAtlas, 1);

		let currentActiveCharacters: string | null = null;
		let currentFontWeight: typeof initialProps.fontWeight | null = null;
		const applyAtlas = (chars: string, weight: typeof initialProps.fontWeight) => {
			const atlas = createAsciiAtlas(chars, weight);
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
			setTextureFromSource(gl, atlasTexture, atlas.canvas);
			if (u.atlasColumns) gl.uniform1f(u.atlasColumns, atlas.columns);
			if (u.atlasRows) gl.uniform1f(u.atlasRows, atlas.rows);
			if (u.characterCount) gl.uniform1f(u.characterCount, atlas.characterCount);
			currentActiveCharacters = chars;
			currentFontWeight = weight;
		};
		applyAtlas(initialProps.activeCharacters, initialProps.fontWeight);

		let currentImageSrc: string | undefined;
		let currentSourceMode: typeof initialProps.sourceMode | null = null;
		let disposed = false;
		const applyImage = (src: string | undefined, mode: typeof initialProps.sourceMode) => {
			currentImageSrc = src;
			currentSourceMode = mode;
			if (mode === "image" && src) {
				const image = new window.Image();
				if (shouldUseAnonymousCrossOrigin(src)) {
					image.crossOrigin = "anonymous";
				}
				image.onload = () => {
					if (disposed) return;
					if (currentImageSrc !== src) return;
					gl.activeTexture(gl.TEXTURE0);
					setTextureFromSource(gl, sourceTexture, image);
				};
				image.src = src;
			} else {
				gl.activeTexture(gl.TEXTURE0);
				setTextureFromSource(gl, sourceTexture, createEmptyTexture());
			}
		};
		applyImage(initialProps.imageSrc, initialProps.sourceMode);

		let lastMonoColor: string | null = null;
		let lastBackgroundColor: string | null = null;
		let lastColorOverlayColor: string | null = null;
		let lastSourceColorValues: typeof initialProps.sourceColorValues | null = null;

		let previousFrameMs: number | null = null;
		const render = (timeMs = 0) => {
			const p = propsRef.current;
			if (previousFrameMs === null) previousFrameMs = timeMs;
			const frameDelta = Math.min(Math.max((timeMs - previousFrameMs) * 0.001, 0), 0.1);
			previousFrameMs = timeMs;
			if (p.animationPlaying) {
				elapsedTimeRef.current += frameDelta;
			}

			const dpr = window.devicePixelRatio || 1;
			const width = Math.max(Math.floor(canvas.clientWidth * dpr), 1);
			const height = Math.max(Math.floor(canvas.clientHeight * dpr), 1);

			if (canvas.width !== width || canvas.height !== height) {
				canvas.width = width;
				canvas.height = height;
				gl.viewport(0, 0, width, height);
			}

			if (p.activeCharacters !== currentActiveCharacters || p.fontWeight !== currentFontWeight) {
				applyAtlas(p.activeCharacters, p.fontWeight);
			}

			if (p.imageSrc !== currentImageSrc || p.sourceMode !== currentSourceMode) {
				applyImage(p.imageSrc, p.sourceMode);
			}

			if (u.tintColor && p.activeMonoColor !== lastMonoColor) {
				const rgb = parseColor(p.activeMonoColor, [0.96, 0.96, 0.94]);
				gl.uniform3f(u.tintColor, rgb[0], rgb[1], rgb[2]);
				lastMonoColor = p.activeMonoColor;
			}
			if (u.backgroundColor && p.backgroundColor !== lastBackgroundColor) {
				const rgb = parseColor(p.backgroundColor, [0, 0, 0]);
				gl.uniform3f(u.backgroundColor, rgb[0], rgb[1], rgb[2]);
				lastBackgroundColor = p.backgroundColor;
			}
			if (u.colorOverlayColor && p.colorOverlayColor !== lastColorOverlayColor) {
				const rgb = parseColor(p.colorOverlayColor, [0.96, 0.96, 0.94]);
				gl.uniform3f(u.colorOverlayColor, rgb[0], rgb[1], rgb[2]);
				lastColorOverlayColor = p.colorOverlayColor;
			}

			if (p.sourceColorValues !== lastSourceColorValues) {
				if (u.sourceColorCount) gl.uniform1i(u.sourceColorCount, p.sourceColorValues.length);
				if (u.sourceColors) gl.uniform4fv(u.sourceColors, flattenSourceColorValues(p.sourceColorValues));
				lastSourceColorValues = p.sourceColorValues;
			}

			if (u.sourceMode) gl.uniform1f(u.sourceMode, p.sourceMode === "image" ? 1 : 0);
			if (u.cellSize) gl.uniform1f(u.cellSize, p.resolvedCellSize);
			if (u.layerOpacity) gl.uniform1f(u.layerOpacity, p.opacity);
			if (u.blendMode) gl.uniform1f(u.blendMode, enumIndex(ASCII_BLEND_MODES, p.blendMode));
			if (u.compositeMode) gl.uniform1f(u.compositeMode, enumIndex(ASCII_COMPOSITE_MODES, p.compositeMode));
			if (u.hue) gl.uniform1f(u.hue, p.hue);
			if (u.saturation) gl.uniform1f(u.saturation, p.saturation);
			if (u.brightness) gl.uniform1f(u.brightness, p.brightness);
			if (u.contrast) gl.uniform1f(u.contrast, p.contrast);
			if (u.characterMode) gl.uniform1f(u.characterMode, enumIndex(ASCII_CHARACTER_MODES, p.resolvedCharacterMode));
			if (u.colorMode) gl.uniform1f(u.colorMode, enumIndex(ASCII_COLOR_MODES, p.colorMode, 1));
			if (u.colorSourceMode) gl.uniform1f(u.colorSourceMode, enumIndex(ASCII_COLOR_SOURCE_MODES, p.colorSourceMode));
			if (u.directionBias) gl.uniform1f(u.directionBias, p.resolvedDirectionBias);
			if (u.glyphSignalMode) gl.uniform1f(u.glyphSignalMode, enumIndex(ASCII_SIGNAL_MODES, p.glyphSignalMode));
			if (u.colorSignalMode) gl.uniform1f(u.colorSignalMode, enumIndex(ASCII_SIGNAL_MODES, p.colorSignalMode));
			if (u.maskSource) gl.uniform1f(u.maskSource, enumIndex(ASCII_MASK_SOURCES, p.maskSource));
			if (u.maskMode) gl.uniform1f(u.maskMode, enumIndex(ASCII_MASK_MODES, p.maskMode));
			if (u.maskInvert) gl.uniform1f(u.maskInvert, p.maskInvert ? 1 : 0);
			if (u.toneMappingMode) gl.uniform1f(u.toneMappingMode, enumIndex(ASCII_TONE_MAPPING_MODES, p.toneMapping));
			if (u.signalBlackPoint) gl.uniform1f(u.signalBlackPoint, p.signalBlackPoint);
			if (u.signalWhitePoint) gl.uniform1f(u.signalWhitePoint, p.signalWhitePoint);
			if (u.signalGamma) gl.uniform1f(u.signalGamma, p.signalGamma);
			if (u.presenceThreshold) gl.uniform1f(u.presenceThreshold, p.resolvedPresenceThreshold);
			if (u.presenceSoftness) gl.uniform1f(u.presenceSoftness, p.presenceSoftness);
			if (u.characterOpacity) gl.uniform1f(u.characterOpacity, p.characterOpacity);
			if (u.randomizeCharacters) gl.uniform1f(u.randomizeCharacters, p.randomizeCharacters);
			if (u.randomSeed) gl.uniform1f(u.randomSeed, p.randomSeed);
			if (u.animatedCharacters) gl.uniform1f(u.animatedCharacters, p.animatedCharacters ? 1 : 0);
			if (u.animationStyle) gl.uniform1f(u.animationStyle, enumIndex(ASCII_ANIMATION_STYLES, p.animationStyle));
			if (u.animationIntensity) gl.uniform1f(u.animationIntensity, p.animationIntensity);
			if (u.animationRandomness) gl.uniform1f(u.animationRandomness, p.animationRandomness);
			if (u.characterCycleSpeed) gl.uniform1f(u.characterCycleSpeed, p.characterCycleSpeed);
			if (u.dotGridOverlay) gl.uniform1f(u.dotGridOverlay, p.dotGridOverlay);
			if (u.shimmerAmount) gl.uniform1f(u.shimmerAmount, p.shimmerAmount);
			if (u.shimmerSpeed) gl.uniform1f(u.shimmerSpeed, p.shimmerSpeed);
			if (u.bloomEnabled) gl.uniform1f(u.bloomEnabled, p.bloomEnabled ? 1 : 0);
			if (u.bloomIntensity) gl.uniform1f(u.bloomIntensity, p.bloomIntensity);
			if (u.bloomThreshold) gl.uniform1f(u.bloomThreshold, p.bloomThreshold);
			if (u.bloomRadius) gl.uniform1f(u.bloomRadius, p.bloomRadius);
			if (u.bloomSoftness) gl.uniform1f(u.bloomSoftness, p.bloomSoftness);
			if (u.bgOpacity) gl.uniform1f(u.bgOpacity, p.bgOpacity);
			if (u.backgroundMode) gl.uniform1f(u.backgroundMode, resolveBackgroundModeIndex(p.backgroundMode));
			if (u.backgroundOpacity) gl.uniform1f(u.backgroundOpacity, p.backgroundOpacity);
			if (u.backgroundBlurRadius) gl.uniform1f(u.backgroundBlurRadius, p.backgroundBlurRadius);
			if (u.colorOverlay) gl.uniform1f(u.colorOverlay, resolveEffectAmount(p.colorOverlay));
			if (u.colorOverlayBlendMode) gl.uniform1f(u.colorOverlayBlendMode, enumIndex(ASCII_BLEND_MODES, p.colorOverlayBlendMode));
			if (u.vignette) gl.uniform1f(u.vignette, resolveEffectAmount(p.vignette));
			if (u.scanLines) gl.uniform1f(u.scanLines, resolveEffectAmount(p.scanLines));
			if (u.crtCurvature) gl.uniform1f(u.crtCurvature, resolveEffectAmount(p.crtCurvature));
			if (u.chromatic) gl.uniform1f(u.chromatic, resolveEffectAmount(p.chromatic));
			if (u.chromaticOffset) gl.uniform1f(u.chromaticOffset, p.chromaticOffset);
			if (u.characterBloom) gl.uniform1f(u.characterBloom, resolveEffectAmount(p.characterBloom));
			if (u.characterChromatic) gl.uniform1f(u.characterChromatic, resolveEffectAmount(p.characterChromatic));
			if (u.characterChromaticOffset) gl.uniform1f(u.characterChromaticOffset, p.characterChromaticOffset);
			if (u.chromaticAberration) gl.uniform1f(u.chromaticAberration, p.chromaticAberration);
			if (u.rgbSplit) gl.uniform1f(u.rgbSplit, resolveEffectAmount(p.resolvedRgbSplit));
			if (u.rgbSplitOffset) gl.uniform1f(u.rgbSplitOffset, p.rgbSplitOffset);
			if (u.glitch) gl.uniform1f(u.glitch, resolveEffectAmount(p.glitch));
			if (u.blur) gl.uniform1f(u.blur, resolveEffectAmount(p.blur));
			if (u.blurRadius) gl.uniform1f(u.blurRadius, p.blurRadius);
			if (u.pixelate) gl.uniform1f(u.pixelate, resolveEffectAmount(p.pixelate));
			if (u.pixelateSize) gl.uniform1f(u.pixelateSize, p.pixelateSize);
			if (u.halftone) gl.uniform1f(u.halftone, resolveEffectAmount(p.halftone));
			if (u.halftoneSize) gl.uniform1f(u.halftoneSize, p.halftoneSize);
			if (u.filmGrain) gl.uniform1f(u.filmGrain, resolveEffectAmount(p.filmGrain));
			if (u.filmDust) gl.uniform1f(u.filmDust, resolveEffectAmount(p.filmDust));
			if (u.invert) gl.uniform1f(u.invert, p.invert ? 1 : 0);
			if (u.speed) gl.uniform1f(u.speed, p.speed);
			if (u.transparentBackground) gl.uniform1f(u.transparentBackground, p.resolvedTransparentBackground ? 1 : 0);

			gl.uniform2f(u.resolution, width, height);
			gl.uniform1f(u.pixelRatio, dpr);
			gl.uniform1f(u.time, elapsedTimeRef.current);
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
			animRef.current = requestAnimationFrame(render);
		};

		animRef.current = requestAnimationFrame(render);

		return () => {
			disposed = true;
			cancelAnimationFrame(animRef.current);
			gl.deleteTexture(sourceTexture);
			gl.deleteTexture(atlasTexture);
			gl.deleteBuffer(buffer);
			gl.deleteProgram(program);
			gl.deleteShader(vertexShader);
			gl.deleteShader(fragmentShader);
		};
	}, []);

	return (
		<>
			<DecorativeFonts />
			<canvas
				ref={canvasRef}
				className={className}
				style={{ width: "100%", height: "100%", display: "block", ...style }}
			/>
		</>
	);
}
