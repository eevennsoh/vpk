"use client";

/* eslint-disable react-hooks/exhaustive-deps -- These callbacks/effects intentionally read stable refs that bridge external animation, drag, preview, and editor state. */

// oxlint-disable react-doctor/exhaustive-deps -- Effects in this file intentionally coordinate refs, external animation loops, timers, subscriptions, or measured DOM state; dependencies are constrained to avoid restarting those bridges.
// oxlint-disable react-doctor/no-initialize-state -- These components intentionally seed local interactive state from props once before user edits take ownership.
// oxlint-disable react-doctor/prefer-module-scope-pure-function -- These helpers are intentionally local to the component/demo because they depend on the surrounding interaction contract.

// oxlint-disable react-doctor/no-event-handler -- Effects in this file bridge external systems, animation/media state, timers, or parent-controlled state rather than user event handlers.

import React, { useRef, useEffect, useLayoutEffect, useCallback, useId, useState } from "react";
import { useLazyRef } from "@/lib/use-lazy-ref";
import { useLatestRef } from "@/lib/use-latest-ref";

import { useTheme } from "@/components/utils/theme-wrapper";
import { cn } from "@/lib/utils";
import { getEmbeddedSpotIllustrationSvg } from "./assets.generated";
import { processIllustrationSvg } from "./spot-illustration-process";
import {
	ILLUS_ELEMENTS,
	ILLUS_ENTER_DURATION,
	ILLUS_ENTER_Y_OFFSET,
	ILLUS_EXIT_DURATION,
	ILLUS_EXIT_Y_OFFSET,
	ILLUS_HOLD_DURATION,
	ILLUS_MOTION,
	ILLUS_PAUSE_BETWEEN,
	ILLUS_ROTATE_GROUP,
	MOSAIC_SPIN_DEG_PER_SEC,
	SPOT_ILLUSTRATIONS,
} from "./spot-illustration-config";
import {
	applyOverlapClipPath,
	easeInBack,
	easeInCubic,
	easeInQuart,
	easeOutCubic,
	easeOutQuart,
	getSpotIllustrationUrl,
	lerp,
	mountProcessedIllustrationSvg,
	springEase,
} from "./spot-illustration-utils";

export {
	applyOverlapClipPath,
	easeInBack,
	easeInCubic,
	easeInQuart,
	easeOutCubic,
	easeOutQuart,
	getSpotIllustrationUrl,
	lerp,
	springEase,
} from "./spot-illustration-utils";
export {
	CHAT_ENTER_DURATION,
	CHAT_EXIT_DURATION,
	CHAT_HOLD_DURATION,
	CHAT_PAUSE_DURATION,
	ILLUS_ELEMENTS,
	ILLUS_ENTER_DURATION,
	ILLUS_ENTER_Y_OFFSET,
	ILLUS_EXIT_DURATION,
	ILLUS_EXIT_Y_OFFSET,
	ILLUS_HAND_DRAWN,
	ILLUS_HOLD_DURATION,
	ILLUS_MOTION,
	ILLUS_ROTATE_GROUP,
	MOSAIC_SPIN_DEG_PER_SEC,
	SPOT_ILLUSTRATIONS,
} from "./spot-illustration-config";
export type { ILLUS_MOTION_TYPE } from "./spot-illustration-config";
export { processIllustrationSvg } from "./spot-illustration-process";

const CANVAS_SIZE = 400;
const MOSAIC_W = 125;
const MOSAIC_H = 117;
const MOSAIC_SHAPES = [
  { type: "circle" as const, cx: 37, cy: 37, r: 37, fill: "#A44FDD" },
  { type: "circle" as const, cx: 88, cy: 37, r: 37, fill: "#FCA700" },
  { type: "circle" as const, cx: 64, cy: 80, r: 37, fill: "#165DD5" },
  { type: "path" as const, d: "M64 43C81.675 43 96.4524 55.394 100.122 71.9648C96.324 73.2814 92.2461 74 88 74C70.3247 74 55.5473 61.6054 51.8779 45.0342C55.6759 43.7177 59.754 43 64 43Z", fill: "#6A9A23" },
];

interface SvgData {
  paths: string[];
  viewBox: string;
  fills?: string[];
}

interface GestureData {
  id: string;
  label: string;
  viewBox: string;
  renderAs: string;
  paths: string[];
  centerlines: string[];
}

interface TransformState {
  x: number;
  y: number;
  rotation: number;
  scale: number;
}

const svg1: SvgData = {"paths":["M33.593 13.251C33.593 17.199 32.228 20.167 29.904 22.26C28.791 23.268 27.44 24.066 25.928 24.689C23.492 25.69 20.601 26.187 17.451 26.236L8.918 34.552V25.081C8.484 24.941 8.071 24.794 7.665 24.626C6.202 24.01 4.893 23.233 3.794 22.26C1.414 20.16 0 17.199 0 13.251C0 9.303 1.463 6.132 3.899 3.99C4.977 3.045 6.244 2.282 7.658 1.68C10.304 0.553001 13.482 0 16.919 0C20.356 0 23.359 0.532001 25.928 1.603C27.391 2.205 28.7 2.996 29.799 3.983C32.186 6.132 33.593 9.184 33.593 13.244V13.251Z"],"viewBox":"0 0 34 35","fills":["black"]};
const svg2: SvgData = {"paths":["M0 13.251C0 17.199 1.365 20.167 3.689 22.26C4.802 23.268 6.153 24.066 7.665 24.689C10.101 25.69 12.992 26.187 16.142 26.236L24.675 34.552V25.081C25.109 24.941 25.522 24.794 25.928 24.626C27.391 24.01 28.7 23.233 29.799 22.26C32.179 20.16 33.593 17.199 33.593 13.251C33.593 9.303 32.13 6.132 29.694 3.99C28.616 3.045 27.349 2.282 25.935 1.68C23.289 0.553001 20.111 0 16.674 0C13.237 0 10.234 0.532001 7.665 1.603C6.202 2.205 4.893 2.996 3.794 3.983C1.407 6.132 0 9.184 0 13.244V13.251Z"],"viewBox":"0 0 34 35","fills":["#DDDEE1"]};
const gestureLines: GestureData = {"id":"eyelash","label":"Eyelash","viewBox":"-36.5 -23.5 146 94","renderAs":"fill","paths":["M23.8826 33.8781C23.6526 34.7281 26.2626 36.8181 27.0426 36.4081C28.1426 35.8281 29.1026 35.0581 30.0926 33.8681C31.0626 32.4081 30.7926 31.6281 31.6026 30.7581C32.8526 29.1881 35.6926 27.1381 36.3926 26.6481C36.4926 26.5781 36.5726 26.4881 36.6426 26.3781C37.0826 25.6281 39.0626 22.3581 41.2826 19.9681C42.7126 18.1681 43.6026 17.0481 44.0626 16.4681C45.1426 15.0781 45.7026 13.8481 46.0126 12.4381C46.1826 11.6681 43.9126 9.84812 43.1926 10.1781C41.8926 10.7881 40.8026 11.5981 39.6826 12.9481C39.2526 13.4781 37.7326 14.0881 36.3726 15.5681C36.1526 15.8081 35.9926 16.0981 35.8826 16.4281C34.9826 19.2981 32.4626 21.9381 32.4626 21.9381C32.4626 21.9381 29.0526 26.1681 27.6226 27.9481C26.5526 29.2981 26.0326 29.9481 25.7126 30.3481C24.7626 31.5681 24.2226 32.6681 23.8926 33.8681L23.8826 33.8781Z","M0.192569 30.1881C0.372569 31.0481 3.65257 31.7081 4.16257 30.9881C4.87257 29.9681 5.37257 28.8381 5.70257 27.3281C5.89257 25.5781 5.30257 25.0181 5.61257 23.8681C6.00257 21.8981 7.58257 18.7681 7.97257 18.0181C8.03257 17.9081 8.06257 17.7881 8.07257 17.6681C8.12257 16.7981 8.37257 12.9881 9.25257 9.83812C9.70257 7.57812 9.97257 6.17812 10.1226 5.44812C10.4426 3.71812 10.3726 2.36812 10.0026 0.978119C9.80257 0.218119 6.94257 -0.361881 6.46257 0.268119C5.58257 1.40812 4.99257 2.62812 4.61257 4.34812C4.47257 5.01812 3.41257 6.25812 2.87257 8.19812C2.78257 8.51812 2.77257 8.84812 2.83257 9.18812C3.34257 12.1481 2.33257 15.6581 2.33257 15.6581C2.33257 15.6581 1.25257 20.9781 0.792569 23.2181C0.462569 24.9081 0.302569 25.7281 0.202569 26.2281C-0.0774306 27.7481 -0.0574306 28.9781 0.202569 30.1981L0.192569 30.1881Z","M43.1126 42.9981C42.5026 43.6381 43.8126 46.7181 44.6926 46.7281C45.9426 46.7381 47.1526 46.5181 48.5826 45.9381C50.1326 45.1081 50.2626 44.2981 51.3826 43.9081C53.2226 43.1281 56.7026 42.6681 57.5426 42.5581C57.6626 42.5381 57.7826 42.5081 57.8826 42.4481C58.6826 41.9581 61.7926 40.4381 64.5826 39.5981C66.6426 38.6281 67.6926 37.8581 68.3426 37.4181C69.7426 36.4881 70.5526 35.5781 71.2326 34.3681C71.6326 33.6681 70.6126 31.0881 69.8126 31.2081C68.3426 31.4281 67.0726 31.9281 65.5226 32.9981C64.9426 33.3881 63.5826 33.3381 61.7926 34.2681C61.5026 34.4181 61.2526 34.6281 61.0626 34.8881C59.2826 37.3481 56.4526 38.5781 56.4526 38.5781C56.4526 38.5781 51.6626 40.5581 49.5326 41.3381C47.8826 41.9581 47.0826 42.2581 46.5926 42.4481C45.1826 43.0081 44.0926 43.0181 43.1026 42.9881L43.1126 42.9981Z"],"centerlines":["M45.5326 11.1681C41.3726 16.4881 33.6726 26.4581 24.0026 33.9181","M9.78258 0.708115C7.80258 9.88812 3.17258 21.6481 0.51258 30.1781","M69.5926 31.4181C64.8526 34.2081 53.3526 39.3381 43.4126 42.9381"]};


const CYCLED_SPOT_ILLUSTRATIONS = SPOT_ILLUSTRATIONS.filter(i => i.id !== "chat");
const DEFAULT_CYCLE_IDS = CYCLED_SPOT_ILLUSTRATIONS.map(i => i.id);

function resolveCycleConfig(illusIds: string[] | undefined): { cycleIds: string[]; includeChat: boolean } {
  if (!illusIds || illusIds.length === 0) {
    return { cycleIds: DEFAULT_CYCLE_IDS, includeChat: true };
  }
  const valid = SPOT_ILLUSTRATIONS.map(i => i.id);
  const filtered = illusIds.filter(id => valid.includes(id));
  return {
    cycleIds: filtered.filter(id => id !== "chat"),
    includeChat: filtered.includes("chat"),
  };
}


const PARAMS = {
  mode: "simple" as const,
  svg1Start: { x: 16, y: 36, rotation: 0, scale: 0.5 } as TransformState,
  svg1End: { x: 0, y: 0, rotation: 0, scale: 1 } as TransformState,
  svg2Start: { x: -20, y: 36, rotation: 0, scale: 0.5 } as TransformState,
  svg2End: { x: 0, y: 0, rotation: 0, scale: 1 } as TransformState,
  svg1Exit: { x: 0, y: -20, rotation: 0, scale: 0.8 } as TransformState,
  svg2Exit: { x: 20, y: -20, rotation: 0, scale: 0.7 } as TransformState,
  gestureDrawReverse: false,
  mosaicTarget: "svg1" as string,
  mosaicScale: 1.7,
  mosaicOffsetX: 0,
  mosaicOffsetY: 0,
  entranceDuration: 0.65,
  holdDuration: 3.2,
  swapDuration: 0.8,
  exitDuration: 0.4,
  gestureScale: 0.5,
  gestureOffset: { x: 63, y: -111 },
};


function lerpState(start: TransformState, end: TransformState, p: number): TransformState {
  return {
    x: lerp(start.x, end.x, p),
    y: lerp(start.y, end.y, p),
    rotation: lerp(start.rotation, end.rotation, p),
    scale: lerp(start.scale, end.scale, p),
  };
}

function MosaicSvg({ svg, uniqueId, mosaicRef, entranceRef, theme }: {
  svg: SvgData;
  uniqueId: string;
  mosaicRef: (el: SVGGElement | null) => void;
  entranceRef: React.RefObject<HTMLDivElement | null>;
  theme: "light" | "dark";
}) {
  const vbParts = svg.viewBox.split(/\s+/).map(Number);
  const vbW = vbParts[2] || 100;
  const vbH = vbParts[3] || 100;
  const coverScale = Math.max(vbW / MOSAIC_W, vbH / MOSAIC_H);
  const baseScale = coverScale * PARAMS.mosaicScale;
  const tx = (vbW - MOSAIC_W * baseScale) / 2 + PARAMS.mosaicOffsetX * (vbW / 100);
  const ty = (vbH - MOSAIC_H * baseScale) / 2 + PARAMS.mosaicOffsetY * (vbH / 100);
  const shadowFill = theme === "dark" ? "#FFF" : "#000";
  const baseLayerCx = (vbW / 2 - tx) / baseScale;
  const baseLayerCy = (vbH / 2 - ty) / baseScale;
  const baseLayerR = Math.hypot(vbW, vbH) / baseScale;
  const baseLayerFill = MOSAIC_SHAPES[0].fill;

  return (
    <div ref={entranceRef} style={{ width: "100%", height: "100%", position: "relative", opacity: 0, transformOrigin: "center center" }}>
      <svg viewBox={svg.viewBox} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.06, transition: "opacity 0.3s" }} fill="none">
        {svg.paths.map((d, i) => <path key={i} d={d} fill={shadowFill} style={{ transition: "fill 0.3s" }} />)}
      </svg>
      <svg viewBox={`0 0 ${vbW} ${vbH}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "hidden" }}>
        <defs>
          <clipPath id={`mosaic-clip-${uniqueId}`}>
            {svg.paths.map((d, i) => <path key={i} d={d} />)}
          </clipPath>
        </defs>
        <g clipPath={`url(#mosaic-clip-${uniqueId})`}>
          <g ref={mosaicRef} style={{ transformOrigin: `${vbW / 2}px ${vbH / 2}px` }}>
            <g transform={`translate(${tx}, ${ty}) scale(${baseScale})`}>
              <circle cx={baseLayerCx} cy={baseLayerCy} r={baseLayerR} fill={baseLayerFill} />
              {MOSAIC_SHAPES.map((s, i) =>
                s.type === "circle"
                  ? <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.fill} />
                  : <path key={i} d={s.d} fill={s.fill} />
              )}
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}


export interface SpotIllustrationProps {
	size?: number;
	loop?: boolean;
	className?: string;
	baseUrl?: string;
	chatOnly?: boolean;
	paused?: boolean;
	illusIds?: string[];
	controlledChatLifecycle?: boolean;
	wantChatExit?: boolean;
	onChatExitComplete?: () => void;
}

export default function SpotIllustration({ size = CANVAS_SIZE, loop = true, className, baseUrl = "/", chatOnly = false, paused = false, illusIds, controlledChatLifecycle = false, wantChatExit = false, onChatExitComplete }: Readonly<SpotIllustrationProps>) {
  const { cycleIds: cycleIdsResolved, includeChat: includeChatResolved } = resolveCycleConfig(illusIds);
  const cycleIdsRef = useLatestRef<string[]>(cycleIdsResolved);
  const includeChatRef = useLatestRef<boolean>(includeChatResolved);
  const baseId = useId().replace(/:/g, "");
  const pr = size / 300;
  const { actualTheme: theme } = useTheme();

  const svg1HasMosaic = PARAMS.mosaicTarget === "svg1" || PARAMS.mosaicTarget === "both";
  const svg2HasMosaic = PARAMS.mosaicTarget === "svg2" || PARAMS.mosaicTarget === "both";

  const svg1EntranceRef = useRef<HTMLDivElement | null>(null);
  const svg1MosaicGroupRef = useRef<SVGGElement | null>(null);
  const svg1PlainRef = useRef<HTMLDivElement | null>(null);
  const svg2Ref = useRef<HTMLDivElement | null>(null);
  const svg2EntranceRef = useRef<HTMLDivElement | null>(null);
  const svg2MosaicGroupRef = useRef<SVGGElement | null>(null);
  const gestureRef = useRef<HTMLDivElement | null>(null);
  const gestureMaskRefs = useRef<(SVGPathElement | null)[]>([]);
  const intersectionRef = useRef<HTMLDivElement | null>(null);
  const intersectionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const intersectionCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const animRef = useRef(0);
  const clockRef = useRef({ accumulated: 0, lastTimestamp: null as number | null });
  const mosaicClockRef = useRef(0);
  const stageRef = useRef<"chatEntrance" | "chatExit" | "illusEntrance" | "illusHold" | "illusExit" | "illusPause">("chatEntrance");
  const exitMosaicRotRef = useRef<number | null>(null);
  const currentIllusIndexRef = useRef(0);
  const [visibleIllusId, setVisibleIllusId] = useState<string>(() => cycleIdsResolved[0] ?? "");
  const illusImagePreparedRef = useRef(false);
  const illusContainerRef = useRef<HTMLDivElement | null>(null);
  const chatBubbleContainerRef = useRef<HTMLDivElement | null>(null);
  const svgCacheRef = useLazyRef<Map<string, string>>(() => new Map());
  const [svgsLoaded, setSvgsLoaded] = useState(false);
  const illusMosaicRefs = useRef<SVGGElement[]>([]);
  const illusMosaicRotStartRef = useRef<number | null>(null);
  const illusGestureEls = useRef<Element[]>([]);
  const illusGestureGroups = useRef<Element[][]>([]);
  const illusSvgWrapperRef = useRef<HTMLDivElement | null>(null);
  const illusGreyLayersRef = useRef<SVGGElement[]>([]);
  const illusMosaicLayersRef = useRef<SVGGElement[]>([]);
  const illusOverlapLayersRef = useRef<SVGGElement[]>([]);
  const illusGreyClipRef = useRef<SVGGElement[]>([]);
  const illusRotateEls = useRef<SVGGElement[]>([]);
  const illusRoamRef = useRef({ x: 0, y: 0 });
  // Controlled chat lifecycle: when enabled, the chat scene plays its
  // entrance once, holds the idle (frozen end-of-enter) state indefinitely,
  // then plays its exit only when wantChatExit becomes true. This avoids
  // looping the full enter/idle/exit cycle that the free-running default
  // mode produces, so consumers like the Rovo Prompt Studio can drive chat
  // transitions on word-association just like every other illustration.
  const controlledChatLifecycleRef = useLatestRef(controlledChatLifecycle);
  const wantChatExitRef = useLatestRef(wantChatExit);
  const onChatExitCompleteRef = useLatestRef(onChatExitComplete);
  const chatExitCompleteFiredRef = useRef(false);

  const pauseBetweenLoops = 0;

  const path2dCache = useLazyRef(() => new Map<string, Path2D>());

  function getPath2D(d: string) {
    let p = path2dCache.current.get(d);
    if (!p) { p = new Path2D(d); path2dCache.current.set(d, p); }
    return p;
  }

  function drawPathsOnCtx(ctx: CanvasRenderingContext2D, paths: string[], mapping: { scale: number; tx: number; ty: number }) {
    ctx.save();
    ctx.translate(mapping.tx, mapping.ty);
    ctx.scale(mapping.scale, mapping.scale);
    for (const d of paths) ctx.fill(getPath2D(d));
    ctx.restore();
  }

  function getCanvasPixelSize(devicePixelRatio: number) {
    return Math.max(1, Math.round(size * devicePixelRatio));
  }

  function getResizedIntersectionContext(canvas: HTMLCanvasElement, devicePixelRatio: number) {
    const pixelSize = getCanvasPixelSize(devicePixelRatio);
    if (canvas.width !== pixelSize || canvas.height !== pixelSize) {
      canvas.width = pixelSize;
      canvas.height = pixelSize;
      intersectionCtxRef.current = null;
    }
    if (!intersectionCtxRef.current) {
      intersectionCtxRef.current = canvas.getContext("2d");
    }

    return {
      ctx: intersectionCtxRef.current,
      pixelSize,
    };
  }

  function computeMapping(viewBox: string, cx: number, cy: number, cw: number, ch: number) {
    const [vbx, vby, vbw, vbh] = viewBox.split(/\s+/).map(Number);
    const scale = Math.min(cw / vbw, ch / vbh);
    const tx = cx + (cw - vbw * scale) / 2 - vbx * scale;
    const ty = cy + (ch - vbh * scale) / 2 - vby * scale;
    return { scale, tx, ty };
  }

  const pausedRef = useLatestRef(paused);

  const updateAnimation = useCallback((timestamp: number) => {
    const clock = clockRef.current;
    if (pausedRef.current) {
      clock.lastTimestamp = null;
      return;
    }
    if (clock.lastTimestamp === null) clock.lastTimestamp = timestamp;
    const dt = timestamp - clock.lastTimestamp;
    clock.lastTimestamp = timestamp;
    const dtSec = dt / 1000;
    clock.accumulated += dtSec;
    mosaicClockRef.current += dtSec;

    const stage = stageRef.current;
    const totalTime = mosaicClockRef.current;
    const t = clock.accumulated;

    let mosaicProgress = 0, gestureOpacity = 0, gScale = 0.85;
    let svg2Opacity = 1, svg1Opacity = 1;
    let svg1ScaleVal = 1, svg2ScaleVal = 1;
    let svg1TX = 0, svg1TY = 0, svg1Rot = 0;
    let svg2TX = 0, svg2TY = 0, svg2Rot = 0;

    let chatVisible = false;
    let illusVisible = false;
    let illusOpacity = 0;
    let illusTX = 0;
    let illusTY = 0;
    let illusScale = 1;
    let illusContainerRotation = 0;
    let illusGestureOpacity = 0;
    let illusGreyOpacity = 1, illusMosaicLayerOpacity = 1, illusOverlapOpacity = 1;
    let illusGreyTX = 0, illusGreyTY = 0, illusMosaicTX = 0, illusMosaicTY = 0;
    let illusOverlapTX = 0, illusOverlapTY = 0;
    let illusOverlapScale = 1;
    let illusGreyClipTX = 0, illusGreyClipTY = 0;
    const illusGreyClipScale = 1;
    let illusMosaicScale = 1;
    let illusTelescopeAngle = 0;
    const cycleIdsNow = cycleIdsRef.current;
    const includeChatNow = includeChatRef.current;
    const currentIllusId = currentIllusIndexRef.current < cycleIdsNow.length
      ? cycleIdsNow[currentIllusIndexRef.current] : '';
    const hasIllusElements = !!ILLUS_ELEMENTS[currentIllusId];

    if (stage === "chatEntrance") {
      chatVisible = true;
      if (t < PARAMS.entranceDuration) {
        const p = t / PARAMS.entranceDuration;

        const s2sp = springEase(p);
        const s2fp = easeOutCubic(p);
        const s2 = lerpState(PARAMS.svg2Start, PARAMS.svg2End, s2sp);
        svg2Opacity = s2fp;
        svg2ScaleVal = s2.scale;
        svg2TX = s2.x * pr; svg2TY = s2.y * pr; svg2Rot = s2.rotation;

        const s1Raw = Math.max(0, (p - 0.08) / 0.92);
        const ep = springEase(s1Raw);
        const fadeP = easeOutCubic(s1Raw);
        const s1 = lerpState(PARAMS.svg1Start, PARAMS.svg1End, ep);
        mosaicProgress = fadeP;
        svg1Opacity = fadeP;
        svg1ScaleVal = s1.scale;
        svg1TX = s1.x * pr; svg1TY = s1.y * pr; svg1Rot = s1.rotation;

        const gestureRaw = Math.max(0, (p - 0.25) / 0.75);
        gestureOpacity = easeOutCubic(gestureRaw);
        gScale = 0.85 + easeOutCubic(gestureRaw) * 0.15;
      } else if (controlledChatLifecycleRef.current) {
        // Controlled mode: hold the idle (frozen end-of-enter) state until
        // the host signals wantChatExit. Mirrors the generic illus path
        // where idle plays indefinitely until a word-association swap.
        mosaicProgress = 1; gestureOpacity = 1; gScale = 1;
        svg1Opacity = 1; svg2Opacity = 1;
        svg1ScaleVal = PARAMS.svg1End.scale; svg2ScaleVal = PARAMS.svg2End.scale;
        if (wantChatExitRef.current) {
          stageRef.current = "chatExit";
          clock.accumulated = 0; clock.lastTimestamp = null;
          exitMosaicRotRef.current = (totalTime * MOSAIC_SPIN_DEG_PER_SEC) % 360;
        }
      } else if (t < PARAMS.entranceDuration + PARAMS.holdDuration) {
        mosaicProgress = 1; gestureOpacity = 1; gScale = 1;
        svg1Opacity = 1; svg2Opacity = 1;
        svg1ScaleVal = PARAMS.svg1End.scale; svg2ScaleVal = PARAMS.svg2End.scale;
      } else {
        stageRef.current = "chatExit";
        clock.accumulated = 0; clock.lastTimestamp = null;
        exitMosaicRotRef.current = (totalTime * MOSAIC_SPIN_DEG_PER_SEC) % 360;
        mosaicProgress = 1; gestureOpacity = 1; gScale = 1;
        svg1Opacity = 1; svg2Opacity = 1;
        svg1ScaleVal = PARAMS.svg1End.scale; svg2ScaleVal = PARAMS.svg2End.scale;
      }
    } else if (stage === "chatExit") {
      chatVisible = true;
      if (t < PARAMS.exitDuration) {
        const p = t / PARAMS.exitDuration;
        const ep = easeInBack(p);
        const fadeP = easeInCubic(p);

        mosaicProgress = 1 - fadeP;
        gestureOpacity = Math.max(0, 1 - p / 0.6);
        gScale = 1 - easeInCubic(Math.min(1, p / 0.6)) * 0.15;

        const s1 = lerpState(PARAMS.svg1End, PARAMS.svg1Exit, ep);
        svg1Opacity = 1 - fadeP;
        svg1ScaleVal = s1.scale;
        svg1TX = s1.x * pr; svg1TY = s1.y * pr; svg1Rot = s1.rotation;

        const exitDelay = 0.12;
        const s2p = easeInBack(Math.min(1, Math.max(0, (p - exitDelay) / (1 - exitDelay))));
        const s2FadeP = easeInCubic(Math.min(1, Math.max(0, (p - exitDelay) / (1 - exitDelay))));
        const s2 = lerpState(PARAMS.svg2End, PARAMS.svg2Exit, s2p);
        svg2Opacity = 1 - s2FadeP;
        svg2ScaleVal = s2.scale;
        svg2TX = s2.x * pr; svg2TY = s2.y * pr; svg2Rot = s2.rotation;
      } else {
        mosaicProgress = 0; gestureOpacity = 0; gScale = 0.85;
        svg1Opacity = 0; svg2Opacity = 0;
        chatVisible = false;
        if (controlledChatLifecycleRef.current) {
          // Controlled mode: stay invisible/done. Never loop. Fire the
          // completion callback exactly once so the host can swap to the
          // next illustration in its pending queue.
          if (!chatExitCompleteFiredRef.current) {
            chatExitCompleteFiredRef.current = true;
            onChatExitCompleteRef.current?.();
          }
        } else {
          if (!illusImagePreparedRef.current) {
            currentIllusIndexRef.current = 0;
            updateIllusImage();
            illusImagePreparedRef.current = true;
          }
          if (t >= PARAMS.exitDuration + pauseBetweenLoops) {
            if (chatOnly || cycleIdsNow.length === 0) {
              stageRef.current = "chatEntrance";
              clock.accumulated = 0; clock.lastTimestamp = null;
              exitMosaicRotRef.current = null;
            } else {
              stageRef.current = "illusEntrance";
              clock.accumulated = 0; clock.lastTimestamp = null;
              exitMosaicRotRef.current = null;
              illusImagePreparedRef.current = false;
              illusMosaicRotStartRef.current = totalTime;
            }
          }
        }
      }
    } else if (stage === "illusEntrance") {
      illusVisible = true;
      chatVisible = false;
      svg1Opacity = 0; svg2Opacity = 0; mosaicProgress = 0; gestureOpacity = 0;
      if (t < ILLUS_ENTER_DURATION) {
        const p = t / ILLUS_ENTER_DURATION;
        const motion = ILLUS_MOTION[currentIllusId];
        const sp = easeOutQuart(p);
        const fp = easeOutCubic(p);
        const eTX = (motion?.enterTX ?? 0) * pr;
        const eTY = (motion?.enterTY ?? ILLUS_ENTER_Y_OFFSET) * pr;
        const eScale = motion?.enterScale ?? 0.85;
        const eRot = motion?.enterRotation ?? 0;
        illusTX = lerp(eTX, 0, sp);
        illusTY = lerp(eTY, 0, sp);
        illusScale = lerp(eScale, 1, sp);
        illusContainerRotation = lerp(eRot, 0, sp);
        const gestureDelay = 0.3;
        const gestureRaw = Math.max(0, (p - gestureDelay) / (1 - gestureDelay));
        illusGestureOpacity = easeOutCubic(gestureRaw);
        if (hasIllusElements) {
          illusOpacity = 1;
          const greyFrom = motion?.greyEnterFrom || { x: -2.5, y: 3 };
          const mosaicFrom = motion?.mosaicEnterFrom || { x: 2.5, y: 3 };
          const greyFade = Math.min(1, easeOutCubic(p) * 2.5);
          const greySp = easeOutQuart(p);
          illusGreyOpacity = greyFade;
          illusGreyTX = lerp(greyFrom.x, 0, greySp);
          illusGreyTY = lerp(greyFrom.y, 0, greySp);
          const mosaicRaw = Math.max(0, (p - 0.1) / 0.9);
          const mosaicFade = Math.min(1, easeOutCubic(mosaicRaw) * 2.5);
          const mosaicSp = easeOutQuart(mosaicRaw);
          illusMosaicLayerOpacity = mosaicFade;
          illusMosaicTX = lerp(mosaicFrom.x, 0, mosaicSp);
          illusMosaicTY = lerp(mosaicFrom.y, 0, mosaicSp);
          if (motion?.mosaicEnterScale != null) {
            illusMosaicScale = lerp(motion.mosaicEnterScale, 1, mosaicSp);
          }
          if (motion?.overlapTrack === 'mosaic') {
            illusOverlapOpacity = illusGreyOpacity * illusMosaicLayerOpacity;
            illusOverlapTX = illusMosaicTX;
            illusOverlapTY = illusMosaicTY;
            illusOverlapScale = illusMosaicScale;
          } else if (motion?.overlapTrack === 'grey') {
            illusOverlapOpacity = illusGreyOpacity;
            illusOverlapTX = illusGreyTX;
            illusOverlapTY = illusGreyTY;
          } else {
            illusOverlapOpacity = illusGreyOpacity;
          }
          illusGreyClipTX = illusGreyTX;
          illusGreyClipTY = illusGreyTY;
        } else {
          illusOpacity = Math.min(1, fp * 2.5);
        }
      } else {
        stageRef.current = "illusHold";
        clock.accumulated = 0; clock.lastTimestamp = null;
        illusOpacity = 1;
        illusTY = 0;
        illusScale = 1;
        illusGestureOpacity = 1;
        illusRoamRef.current = { x: 0, y: 0 };
        if (hasIllusElements) {
          illusGreyOpacity = 1; illusMosaicLayerOpacity = 1; illusOverlapOpacity = 1;
          illusGreyTX = 0; illusGreyTY = 0; illusMosaicTX = 0; illusMosaicTY = 0;
        }
      }
    } else if (stage === "illusHold") {
      illusVisible = true;
      chatVisible = false;
      svg1Opacity = 0; svg2Opacity = 0; mosaicProgress = 0; gestureOpacity = 0;
      illusOpacity = 1;
      illusTY = 0;
      illusScale = 1;
      illusGestureOpacity = 1;
      if (hasIllusElements) {
        illusGreyOpacity = 1; illusMosaicLayerOpacity = 1; illusOverlapOpacity = 1;
        illusGreyTX = 0; illusGreyTY = 0; illusMosaicTX = 0; illusMosaicTY = 0;
        const motion = ILLUS_MOTION[currentIllusId];
        if (motion?.idleMosaicRoam) {
          const { ax, ay, period } = motion.idleMosaicRoam;
          const ramp = easeOutCubic(Math.min(1, t / 0.8));
          illusMosaicTX = ax * Math.sin(t * 2 * Math.PI / period) * ramp;
          illusMosaicTY = ay * Math.sin(t * 2 * Math.PI / period * 0.7 + 0.5) * ramp;
          illusRoamRef.current = { x: illusMosaicTX, y: illusMosaicTY };
        }
        if (motion?.overlapTrack === 'mosaic') {
          illusOverlapTX = illusMosaicTX;
          illusOverlapTY = illusMosaicTY;
        } else if (motion?.overlapTrack === 'grey') {
          illusOverlapTX = illusGreyTX;
          illusOverlapTY = illusGreyTY;
        }
        illusGreyClipTX = illusGreyTX;
        illusGreyClipTY = illusGreyTY;
      }
      const rotConfig = ILLUS_ROTATE_GROUP[currentIllusId];
      if (rotConfig) {
        illusTelescopeAngle = rotConfig.degrees * Math.sin(t * 2 * Math.PI / rotConfig.period);
      }
      if (t >= ILLUS_HOLD_DURATION) {
        stageRef.current = "illusExit";
        clock.accumulated = 0; clock.lastTimestamp = null;
      }
    } else if (stage === "illusExit") {
      illusVisible = true;
      chatVisible = false;
      svg1Opacity = 0; svg2Opacity = 0; mosaicProgress = 0; gestureOpacity = 0;
      if (t < ILLUS_EXIT_DURATION) {
        const p = t / ILLUS_EXIT_DURATION;
        const motion = ILLUS_MOTION[currentIllusId];
        const ep = easeInQuart(p);
        const fp = easeInCubic(p);
        const xTX = (motion?.exitTX ?? 0) * pr;
        const xTY = (motion?.exitTY ?? ILLUS_EXIT_Y_OFFSET) * pr;
        const xScale = motion?.exitScale ?? 0.85;
        const xRot = motion?.exitRotation ?? 0;
        illusTX = lerp(0, xTX, ep);
        illusTY = lerp(0, xTY, ep);
        illusScale = lerp(1, xScale, ep);
        illusContainerRotation = lerp(0, xRot, ep);
        if (hasIllusElements) {
          illusOpacity = 1;
          const greyTo = motion?.greyExitTo || { x: 2, y: -2 };
          const mosaicTo = motion?.mosaicExitTo || { x: -2, y: -2 };
          const mosaicFade = Math.max(0, 1 - easeInCubic(p) * 2.5);
          const mosaicEp = easeInQuart(p);
          illusMosaicLayerOpacity = mosaicFade;
          illusMosaicTX = lerp(0, mosaicTo.x, mosaicEp);
          illusMosaicTY = lerp(0, mosaicTo.y, mosaicEp);
          if (motion?.mosaicExitScale != null) {
            illusMosaicScale = lerp(1, motion.mosaicExitScale, mosaicEp);
          }
          if (motion?.idleMosaicRoam) {
            const fadeOut = 1 - easeInCubic(p);
            illusMosaicTX += illusRoamRef.current.x * fadeOut;
            illusMosaicTY += illusRoamRef.current.y * fadeOut;
          }
          const greyRaw = Math.max(0, (p - 0.12) / 0.88);
          const greyFade = Math.max(0, 1 - easeInCubic(greyRaw) * 2.5);
          const greyEp = easeInQuart(greyRaw);
          illusGreyOpacity = greyFade;
          illusGreyTX = lerp(0, greyTo.x, greyEp);
          illusGreyTY = lerp(0, greyTo.y, greyEp);
          if (motion?.overlapTrack === 'mosaic') {
            illusOverlapOpacity = illusGreyOpacity * illusMosaicLayerOpacity;
            illusOverlapTX = illusMosaicTX;
            illusOverlapTY = illusMosaicTY;
            illusOverlapScale = illusMosaicScale;
          } else if (motion?.overlapTrack === 'grey') {
            illusOverlapOpacity = illusGreyOpacity;
            illusOverlapTX = illusGreyTX;
            illusOverlapTY = illusGreyTY;
          } else {
            illusOverlapOpacity = illusGreyOpacity;
          }
          illusGreyClipTX = illusGreyTX;
          illusGreyClipTY = illusGreyTY;
          illusGestureOpacity = Math.max(mosaicFade, greyFade);
        } else {
          illusOpacity = Math.max(0, 1 - fp * 2.5);
          illusGestureOpacity = 1;
        }
        const rotConfig = ILLUS_ROTATE_GROUP[currentIllusId];
        if (rotConfig) {
          illusTelescopeAngle = rotConfig.degrees * Math.sin((ILLUS_HOLD_DURATION + t) * 2 * Math.PI / rotConfig.period);
        }
      } else {
        illusOpacity = 0;
        illusVisible = false;
        stageRef.current = "illusPause";
        clock.accumulated = 0; clock.lastTimestamp = null;
        const nextIndex = currentIllusIndexRef.current + 1;
        if (nextIndex < cycleIdsNow.length) {
          currentIllusIndexRef.current = nextIndex;
          updateIllusImage();
        } else {
          currentIllusIndexRef.current = cycleIdsNow.length;
        }
      }
    } else if (stage === "illusPause") {
      chatVisible = false;
      illusVisible = false;
      svg1Opacity = 0; svg2Opacity = 0; mosaicProgress = 0; gestureOpacity = 0;
      illusOpacity = 0;
      if (t >= ILLUS_PAUSE_BETWEEN) {
        if (currentIllusIndexRef.current < cycleIdsNow.length) {
          stageRef.current = "illusEntrance";
          clock.accumulated = 0; clock.lastTimestamp = null;
          illusMosaicRotStartRef.current = totalTime;
        } else if (loop) {
          if (includeChatNow) {
            stageRef.current = "chatEntrance";
          } else {
            stageRef.current = "illusEntrance";
            illusMosaicRotStartRef.current = totalTime;
            illusImagePreparedRef.current = false;
          }
          clock.accumulated = 0; clock.lastTimestamp = null;
          exitMosaicRotRef.current = null;
          currentIllusIndexRef.current = 0;
        }
      }
    }

    if (chatBubbleContainerRef.current) {
      chatBubbleContainerRef.current.style.opacity = chatVisible ? "1" : "0";
      chatBubbleContainerRef.current.style.pointerEvents = chatVisible ? "auto" : "none";
    }
    if (illusContainerRef.current) {
      const containerOpacity = hasIllusElements && illusVisible ? 1 : (illusVisible ? illusOpacity : 0);
      illusContainerRef.current.style.opacity = String(containerOpacity);
      illusContainerRef.current.style.pointerEvents = illusVisible ? "auto" : "none";
      if (illusVisible) {
        illusContainerRef.current.style.transform = `translate(${illusTX}px, ${illusTY}px) scale(${illusScale})${illusContainerRotation !== 0 ? ` rotate(${illusContainerRotation}deg)` : ''}`;
        const illusRotElapsed = illusMosaicRotStartRef.current !== null ? totalTime - illusMosaicRotStartRef.current : 0;
        const illusRot = (illusRotElapsed * MOSAIC_SPIN_DEG_PER_SEC) % 360;
        illusMosaicRefs.current.forEach(el => {
          el.style.transform = `rotate(${illusRot}deg)`;
        });
        const motion = ILLUS_MOTION[currentIllusId];
        const gestureStagger = motion?.gestureStagger ?? 0;
        if (gestureStagger > 0 && illusGestureGroups.current.length > 1) {
          const gestureDelay = 0.3;
          const enterP = stage === "illusEntrance" ? Math.min(1, t / ILLUS_ENTER_DURATION) : -1;
          const exitP = stage === "illusExit" ? Math.min(1, t / ILLUS_EXIT_DURATION) : -1;
          const groupCount = illusGestureGroups.current.length;
          illusGestureGroups.current.forEach((groupEls, gi) => {
            let groupOpacity: number;
            if (enterP >= 0) {
              const groupDelay = gestureDelay + gi * gestureStagger;
              const groupRaw = Math.max(0, (enterP - groupDelay) / Math.max(0.01, 1 - groupDelay));
              groupOpacity = easeOutCubic(groupRaw);
            } else if (exitP >= 0) {
              const groupDelay = (groupCount - 1 - gi) * gestureStagger;
              const groupRaw = Math.max(0, (exitP - groupDelay) / Math.max(0.01, 1 - groupDelay));
              groupOpacity = Math.max(0, 1 - easeInCubic(groupRaw) * 2.5);
            } else {
              groupOpacity = illusGestureOpacity;
            }
            groupEls.forEach(el => { (el as SVGElement).style.opacity = String(groupOpacity); });
          });
        } else {
          illusGestureEls.current.forEach(el => {
            (el as SVGElement).style.opacity = String(illusGestureOpacity);
          });
        }
        if (hasIllusElements) {
          illusGreyLayersRef.current.forEach(el => {
            el.style.opacity = String(illusGreyOpacity);
            el.setAttribute('transform', `translate(${illusGreyTX}, ${illusGreyTY})`);
          });
          illusMosaicLayersRef.current.forEach(el => {
            el.style.opacity = String(illusMosaicLayerOpacity);
            el.style.transform = `translate(${illusMosaicTX}px, ${illusMosaicTY}px)${illusMosaicScale !== 1 ? ` scale(${illusMosaicScale})` : ''}`;
          });
          illusOverlapLayersRef.current.forEach(el => {
            el.style.opacity = String(illusOverlapOpacity);
            if (illusOverlapTX !== 0 || illusOverlapTY !== 0 || illusOverlapScale !== 1) {
              el.style.transform = `translate(${illusOverlapTX}px, ${illusOverlapTY}px)${illusOverlapScale !== 1 ? ` scale(${illusOverlapScale})` : ''}`;
            } else {
              el.style.transform = '';
            }
          });
          illusGreyClipRef.current.forEach(el => {
            if (illusGreyClipTX !== 0 || illusGreyClipTY !== 0 || illusGreyClipScale !== 1) {
              el.setAttribute('transform', `translate(${illusGreyClipTX}, ${illusGreyClipTY})${illusGreyClipScale !== 1 ? ` scale(${illusGreyClipScale})` : ''}`);
            } else {
              el.removeAttribute('transform');
            }
          });
        }
        const rotConfig = ILLUS_ROTATE_GROUP[currentIllusId];
        if (rotConfig && illusRotateEls.current.length > 0) {
          illusRotateEls.current.forEach(el => {
            el.setAttribute('transform', `rotate(${illusTelescopeAngle}, ${rotConfig.anchorX}, ${rotConfig.anchorY})`);
          });
        }
      } else {
        illusContainerRef.current.style.transform = "";
        if (hasIllusElements) {
          illusGreyLayersRef.current.forEach(el => {
            el.style.opacity = '1';
            el.removeAttribute('transform');
          });
          illusMosaicLayersRef.current.forEach(el => {
            el.style.opacity = '1';
            el.style.transform = '';
          });
          illusOverlapLayersRef.current.forEach(el => {
            el.style.opacity = '1';
            el.style.transform = '';
          });
          illusGreyClipRef.current.forEach(el => {
            el.removeAttribute('transform');
          });
        }
        illusRotateEls.current.forEach(el => {
          el.removeAttribute('transform');
        });
      }
    }

    let rotationDeg = (totalTime * MOSAIC_SPIN_DEG_PER_SEC) % 360;
    if (stage === "chatExit" && exitMosaicRotRef.current !== null) {
      rotationDeg = exitMosaicRotRef.current;
    }

    if (svg1HasMosaic) {
      if (svg1MosaicGroupRef.current) {
        svg1MosaicGroupRef.current.style.transform = "rotate(" + rotationDeg + "deg)";
        svg1MosaicGroupRef.current.style.opacity = String(mosaicProgress);
      }
      if (svg1EntranceRef.current) {
        svg1EntranceRef.current.style.opacity = String(mosaicProgress);
        svg1EntranceRef.current.style.transform = "translate(" + svg1TX + "px, " + svg1TY + "px) rotate(" + svg1Rot + "deg) scale(" + svg1ScaleVal + ")";
      }
    }
    if (svg1PlainRef.current && !svg1HasMosaic) {
      svg1PlainRef.current.style.opacity = String(svg1Opacity);
      svg1PlainRef.current.style.transform = "translate(" + svg1TX + "px, " + svg1TY + "px) rotate(" + svg1Rot + "deg) scale(" + svg1ScaleVal + ")";
    }
    if (svg2Ref.current) {
      if (svg2HasMosaic) {
        if (svg2MosaicGroupRef.current) {
          svg2MosaicGroupRef.current.style.transform = "rotate(" + rotationDeg + "deg)";
          svg2MosaicGroupRef.current.style.opacity = String(mosaicProgress * svg2Opacity);
        }
        if (svg2EntranceRef.current) {
          svg2EntranceRef.current.style.opacity = String(mosaicProgress * svg2Opacity);
          svg2EntranceRef.current.style.transform = "translate(" + svg2TX + "px, " + svg2TY + "px) rotate(" + svg2Rot + "deg) scale(" + svg2ScaleVal + ")";
        }
      } else {
        svg2Ref.current.style.opacity = String(svg2Opacity);
      }
      svg2Ref.current.style.transform = "translate(" + svg2TX + "px, " + svg2TY + "px) rotate(" + svg2Rot + "deg) scale(" + svg2ScaleVal + ")";
    }

    if (gestureRef.current) {
      gestureRef.current.style.opacity = String(gestureOpacity > 0 ? 1 : 0);
      gestureRef.current.style.transform = "translate(" + (PARAMS.gestureOffset.x * pr) + "px, " + (PARAMS.gestureOffset.y * pr) + "px) scale(" + (gScale * PARAMS.gestureScale) + ")";
    }

    const drawProgress = gestureLines.renderAs === "fill" && gestureLines.centerlines.length > 0
      ? Math.max(0, Math.min(1, gestureOpacity)) : 1;
    for (let gi = 0; gi < gestureMaskRefs.current.length; gi++) {
      const maskEl = gestureMaskRefs.current[gi];
      if (maskEl) {
        const len = maskEl.getTotalLength();
        maskEl.style.strokeDasharray = String(len);
        const offset = PARAMS.gestureDrawReverse ? -len * (1 - drawProgress) : len * (1 - drawProgress);
        maskEl.style.strokeDashoffset = String(offset);
      }
    }

    if (intersectionRef.current && svg1 && svg2) {
      const dpr = window.devicePixelRatio || 1;
      const cvs = intersectionCanvasRef.current;
      if (cvs) {
        const { ctx, pixelSize } = getResizedIntersectionContext(cvs, dpr);
        if (ctx) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, pixelSize, pixelSize);
          ctx.save();
          ctx.scale(dpr, dpr);
          const s1BaseW = size * 0.6, s1BaseH = size * 0.6;
          const s1CenterX = size / 2 + svg1TX;
          const s1CenterY = size / 2 + svg1TY;
          const s1ScaledW = s1BaseW * svg1ScaleVal, s1ScaledH = s1BaseH * svg1ScaleVal;
          const s1Map = computeMapping(svg1.viewBox, s1CenterX - s1ScaledW / 2, s1CenterY - s1ScaledH / 2, s1ScaledW, s1ScaledH);
          const intColor = "#101214";
          ctx.fillStyle = intColor;
          drawPathsOnCtx(ctx, svg1.paths, s1Map);
          ctx.globalCompositeOperation = "source-in";
          const s2BaseW = size * 0.45, s2BaseH = size * 0.45;
          const s2CenterX = size * 0.725 + svg2TX;
          const s2CenterY = size * 0.725 + svg2TY;
          const s2ScaledW = s2BaseW * svg2ScaleVal, s2ScaledH = s2BaseH * svg2ScaleVal;
          const s2Map = computeMapping(svg2.viewBox, s2CenterX - s2ScaledW / 2, s2CenterY - s2ScaledH / 2, s2ScaledW, s2ScaledH);
          ctx.fillStyle = intColor;
          drawPathsOnCtx(ctx, svg2.paths, s2Map);
          ctx.globalCompositeOperation = "source-over";
          ctx.restore();
        }
      }
      const intAlpha = Math.max(0, Math.min(1, svg2Opacity * svg1Opacity));
      intersectionRef.current.style.opacity = String(intAlpha);
    }

    animRef.current = requestAnimationFrame(updateAnimation);
  }, [size, pr, loop, chatOnly]);

  function updateIllusImage() {
    const cycleIds = cycleIdsRef.current;
    const id = cycleIds[currentIllusIndexRef.current];
    if (id && id !== "chat") {
      setVisibleIllusId(id);
    }
  }

  useLayoutEffect(() => {
    if (illusContainerRef.current) {
      illusContainerRef.current.style.opacity = "0";
      illusContainerRef.current.style.pointerEvents = "none";
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const promises: Promise<void>[] = [];
    SPOT_ILLUSTRATIONS.forEach(illus => {
      (['dark', 'light'] as const).forEach(t => {
        const embedded = getEmbeddedSpotIllustrationSvg(illus.id, t);
        if (embedded) {
          svgCacheRef.current.set(`${illus.id}-${t}`, processIllustrationSvg(embedded, illus.id));
          return;
        }
        const url = getSpotIllustrationUrl(illus.id, t, baseUrl);
        promises.push(
          fetch(url).then((response) => {
            if (!response.ok) throw new Error(`Unable to load illustration: ${response.status}`);
            return response.text();
          }).then(text => {
            if (mounted) svgCacheRef.current.set(`${illus.id}-${t}`, processIllustrationSvg(text, illus.id));
          }).catch(() => {})
        );
      });
    });
    if (promises.length === 0) {
      setSvgsLoaded(true);
    } else {
      Promise.allSettled(promises).then(() => { if (mounted) setSvgsLoaded(true); });
    }
    return () => { mounted = false; };
  }, []);

  const prevThemeRef = useRef(theme);
  const illusTransitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!illusSvgWrapperRef.current || !svgsLoaded) return;
    const wrapper = illusSvgWrapperRef.current;
    if (!visibleIllusId || visibleIllusId === "chat") {
      if (illusTransitionTimer.current) {
        clearTimeout(illusTransitionTimer.current);
        illusTransitionTimer.current = null;
      }
      wrapper.replaceChildren();
      wrapper.style.transition = "";
      wrapper.style.opacity = "1";
      illusMosaicRefs.current = [];
      illusGestureEls.current = [];
      illusGestureGroups.current = [];
      illusGreyLayersRef.current = [];
      illusMosaicLayersRef.current = [];
      illusOverlapLayersRef.current = [];
      illusGreyClipRef.current = [];
      illusRotateEls.current = [];
      return;
    }
    const key = `${visibleIllusId}-${theme}`;
    const processed = svgCacheRef.current.get(key);
    if (!processed) return;

    if (illusTransitionTimer.current) {
      clearTimeout(illusTransitionTimer.current);
      illusTransitionTimer.current = null;
    }

    const applyNewSvg = () => {
      const svgEl = mountProcessedIllustrationSvg(wrapper, processed);
      if (svgEl) applyOverlapClipPath(svgEl);
      illusMosaicRefs.current = Array.from(wrapper.querySelectorAll('[data-mosaic-rotate]')) as SVGGElement[];
      illusGestureEls.current = Array.from(wrapper.querySelectorAll('.illus-gesture'));
      illusGestureEls.current.forEach(el => { (el as SVGElement).style.opacity = '0'; });
      const groupMap = new Map<number, Element[]>();
      illusGestureEls.current.forEach(el => {
        const gi = parseInt(el.getAttribute('data-gesture-group') || '0', 10);
        if (!groupMap.has(gi)) groupMap.set(gi, []);
        groupMap.get(gi)!.push(el);
      });
      const maxGroup = groupMap.size > 0 ? Math.max(...groupMap.keys()) : -1;
      illusGestureGroups.current = [];
      for (let g = 0; g <= maxGroup; g++) illusGestureGroups.current.push(groupMap.get(g) || []);
      illusGreyLayersRef.current = Array.from(wrapper.querySelectorAll('[data-illus-layer="grey"]')) as SVGGElement[];
      illusMosaicLayersRef.current = Array.from(wrapper.querySelectorAll('[data-illus-layer="mosaic"]')) as SVGGElement[];
      illusOverlapLayersRef.current = Array.from(wrapper.querySelectorAll('[data-illus-layer="overlap"]')) as SVGGElement[];
      illusGreyClipRef.current = Array.from(wrapper.querySelectorAll('[data-illus-grey-clip]')) as SVGGElement[];
      illusRotateEls.current = Array.from(wrapper.querySelectorAll('[data-illus-rotate]')) as SVGGElement[];
    };

    const themeChanged = prevThemeRef.current !== theme;
    prevThemeRef.current = theme;

    if (themeChanged && wrapper.childElementCount > 0) {
      const savedOpacity = wrapper.style.opacity;
      wrapper.style.transition = "opacity 0.15s ease-out";
      wrapper.style.opacity = "0";
      illusTransitionTimer.current = setTimeout(() => {
        applyNewSvg();
        wrapper.style.transition = "opacity 0.2s ease-in";
        wrapper.style.opacity = savedOpacity || "1";
        illusTransitionTimer.current = setTimeout(() => {
          wrapper.style.transition = "opacity 0.25s";
          illusTransitionTimer.current = null;
        }, 200);
      }, 150);
    } else {
      applyNewSvg();
    }

    return () => {
      if (illusTransitionTimer.current) {
        clearTimeout(illusTransitionTimer.current);
        illusTransitionTimer.current = null;
      }
    };
  }, [visibleIllusId, theme, svgsLoaded]);

  useEffect(() => {
    stageRef.current = (chatOnly || includeChatRef.current) ? "chatEntrance" : "illusEntrance";
    clockRef.current = { accumulated: 0, lastTimestamp: null };
    mosaicClockRef.current = 0;
    exitMosaicRotRef.current = null;
    currentIllusIndexRef.current = 0;
    illusImagePreparedRef.current = false;
    if (stageRef.current === "illusEntrance") {
      illusMosaicRotStartRef.current = 0;
    }
    animRef.current = requestAnimationFrame(updateAnimation);
    return () => cancelAnimationFrame(animRef.current);
  }, [updateAnimation, chatOnly]);

  useEffect(() => {
    if (!paused) {
      cancelAnimationFrame(animRef.current);
      animRef.current = requestAnimationFrame(updateAnimation);
    }
  }, [paused, updateAnimation]);

  return (
    <div className={cn("shrink-0", className)} style={{ position: "relative", width: size, height: size }}>
      <div ref={chatBubbleContainerRef}>
        {svg1 ? <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ position: "relative", width: "60%", height: "60%" }}>
              {svg1HasMosaic ? (
                <MosaicSvg
                  svg={svg1}
                  uniqueId={baseId + "-svg1"}
                  mosaicRef={(el) => { svg1MosaicGroupRef.current = el; }}
                  entranceRef={svg1EntranceRef}
                  theme={theme}
                />
              ) : (
                <div ref={svg1PlainRef} style={{ width: "100%", height: "100%", opacity: 0, transformOrigin: "center center" }}>
                  <svg viewBox={svg1.viewBox} style={{ width: "100%", height: "100%" }} fill="none">
                    {svg1.paths.map((d, i) => {
                      const baseFill = svg1.fills?.[i] || "#1868DB";
                      const fill = baseFill === "black" ? (theme === "dark" ? "#FFFFFF" : "#000000") : baseFill;
                      return <path key={i} d={d} fill={fill} style={{ transition: "fill 0.3s" }} />;
                    })}
                  </svg>
                </div>
              )}
            </div>
          </div> : null}

        {svg2 ? <div
            ref={svg2Ref}
            style={{
              position: "absolute", display: "flex", alignItems: "center", justifyContent: "center",
              width: "45%", height: "45%", right: "5%", bottom: "5%",
              opacity: svg2HasMosaic ? 1 : 0, transformOrigin: "center center",
            }}
          >
            {svg2HasMosaic ? (
              <div style={{ position: "relative", width: "100%", height: "100%" }}>
                <MosaicSvg
                  svg={svg2}
                  uniqueId={baseId + "-svg2"}
                  mosaicRef={(el) => { svg2MosaicGroupRef.current = el; }}
                  entranceRef={svg2EntranceRef}
                  theme={theme}
                />
              </div>
            ) : (
              <svg viewBox={svg2.viewBox} style={{ width: "100%", height: "100%" }} fill="none">
                {svg2.paths.map((d, i) => {
                  const baseFill = svg2.fills?.[i] || "#94a3b8";
                  const fill = baseFill === "#DDDEE1" ? (theme === "dark" ? "#4B4D51" : "#DDDEE1") : baseFill;
                  return <path key={i} d={d} fill={fill} style={{ transition: "fill 0.3s" }} />;
                })}
              </svg>
            )}
          </div> : null}

        {svg1 && svg2 ? <div ref={intersectionRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0, zIndex: 5 }}>
            <canvas ref={intersectionCanvasRef} style={{ width: size, height: size }} />
          </div> : null}

        {gestureLines.paths.length > 0 ? <div ref={gestureRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0, transformOrigin: "center center" }}>
            <svg viewBox={gestureLines.viewBox} style={{ width: "100%", height: "100%" }} fill="none">
              <style>{`
                @keyframes gesturePulse {
                  0%, 49.9% { transform: scale(1); }
                  50%, 100% { transform: scale(0.9); }
                }
                .gesture-line { transform-box: fill-box; transform-origin: center center; animation: gesturePulse 0.8s steps(1) infinite; }
                .gesture-line-stagger { animation-delay: 0.4s; }
              `}</style>
              {gestureLines.renderAs === "fill" && gestureLines.centerlines.length > 0 ? <defs>
                  {gestureLines.centerlines.map((cl, i) => (
                    <mask key={i} id={`gesture-mask-${baseId}-${i}`}>
                      <path ref={(el) => { gestureMaskRefs.current[i] = el; }} d={cl} stroke="white" strokeWidth={30} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </mask>
                  ))}
                </defs> : null}
              {gestureLines.paths.map((d, i) => (
                <g key={i} className={"gesture-line" + (i % 2 === 1 ? " gesture-line-stagger" : "")}>
                  {gestureLines.renderAs === "fill" ? (
                    <path d={d} fill={theme === "dark" ? "#FFFFFF" : "#101214"} mask={gestureLines.centerlines.length > 0 ? `url(#gesture-mask-${baseId}-${i})` : undefined} />
                  ) : (
                    <path d={d} stroke={theme === "dark" ? "#FFFFFF" : "#1a1a1a"} strokeWidth={2} strokeLinecap="round" fill="none" />
                  )}
                </g>
              ))}
            </svg>
          </div> : null}
      </div>

      <div
        ref={illusContainerRef}
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transformOrigin: "center center",
        }}
      >
        <div ref={illusSvgWrapperRef} style={{ width: "55%", height: "55%", position: "relative", transition: "opacity 0.25s" }} />
      </div>
    </div>
  );
}
