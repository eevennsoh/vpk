"use client";

// Animated icon art ported from the Rovo Dialect prototype (generated from the
// MIT-licensed animate-ui icon set). Each icon is a self-contained motion.svg
// driven by a `hovered` prop: it plays its entrance while hovered and reverses
// on leave. Kept in the prototype's original 2-space style so the SVG path data
// stays byte-for-byte faithful; the public wrapper lives in ./animated-icon.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
} from "react";
import { motion, useAnimation } from "motion/react";

export type RovoIconProps = {
  size?: number;
  color?: string;
  hovered?: boolean;
  singleColor?: boolean;
};

const RovoIconCtx = createContext<{
  solidControls: ReturnType<typeof useAnimation>;
} | null>(null);
const TEXT_SUMMARY_RETURN_TRANSITION = { duration: 0.6, ease: "easeInOut" as const };
const TEXT_SUMMARY_SOLID_LINE_VARIANTS = {
  initial: { opacity: 1, transition: TEXT_SUMMARY_RETURN_TRANSITION },
  hovered: { opacity: 1, transition: TEXT_SUMMARY_RETURN_TRANSITION },
};
const TEXT_SUMMARY_SPARKLE_GROUP_VARIANTS = {
  initial: { y: 0, rotate: 0, transition: TEXT_SUMMARY_RETURN_TRANSITION },
  hovered: { y: -6, rotate: 180, transition: { duration: 0.6, ease: "easeInOut" as const } },
};
const TEXT_SUMMARY_SPARKLE_GRADIENT_VARIANTS = {
  initial: { opacity: 0, transition: TEXT_SUMMARY_RETURN_TRANSITION },
  hovered: { opacity: 1, transition: { duration: 0.3, ease: "easeInOut" as const } },
};

function useRovoControls() {
  return useContext(RovoIconCtx)!;
}

const SPARKLE_PATH = "M17.694 14.241 a1.125 1.125 0 0 1 2.115 0 l0.9225 2.5305 2.529 0.9225 a1.125 1.125 0 0 1 0 2.115 l-2.529 0.9225 -0.9225 2.529 a1.125 1.125 0 0 1 -2.115 0 l-0.9225 -2.529 -2.5305 -0.9225 a1.125 1.125 0 0 1 0 -2.115 l2.5305 -0.9225 Z";

export const ROVO_GRADIENT_CSS = "conic-gradient(from 90deg, #FCA700 0% 20.19%, #6A9A23 20.20% 46.64%, #1868DB 46.65% 70.19%, #AF59E0 70.20% 100%)";

const ROVO_COLORS = ["#FCA700", "#6A9A23", "#1868DB", "#AF59E0"];
function easeInOut(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

interface LineSpec {
  totalLength: number;
  consumeFrac: number;
  refs: (SVGLineElement | null)[];
  solidRef: SVGLineElement | null;
}

function updatePassThrough(spec: LineSpec, progress: number, bandFrac: number) {
  const { totalLength, consumeFrac, refs, solidRef } = spec;
  const bandWidth = totalLength * bandFrac;
  const totalTravel = totalLength + bandWidth;

  const headPos = totalLength - progress * totalTravel;
  const tailPos = headPos + bandWidth;

  const visStart = Math.max(0, headPos);
  const visEnd = Math.min(totalLength, tailPos);
  const visLen = Math.max(0, visEnd - visStart);

  for (let ci = 0; ci < 4; ci++) {
    const el = refs[ci];
    if (!el) continue;

    const cs = ci / 4;
    const ce = (ci + 1) / 4;
    const segStart = visStart + cs * visLen;
    const segEnd = visStart + ce * visLen;
    const seg = Math.max(0, segEnd - segStart);
    const gap = totalLength + 1;

    el.setAttribute("stroke-dasharray", `${seg.toFixed(3)} ${gap.toFixed(1)}`);
    el.setAttribute("stroke-dashoffset", `${(-segStart).toFixed(3)}`);
    el.setAttribute("opacity", visLen > 0.01 ? "1" : "0");
  }

  if (solidRef) {
    const consumeLength = totalLength * consumeFrac;
    const consumed = Math.max(0, Math.min(consumeLength, totalLength - headPos));
    const solidLen = Math.max(0, totalLength - consumed);
    const gap = totalLength + 1;
    solidRef.setAttribute("stroke-dasharray", `${solidLen.toFixed(3)} ${gap.toFixed(1)}`);
    solidRef.setAttribute("stroke-dashoffset", "0");
    solidRef.setAttribute("opacity", solidLen > 0.01 ? "1" : "0");
  }
}

const LINE_DEFS = [
  { x1: 1.5, y1: 8.874, x2: 22.5, y2: 8.874, consumeFrac: 0.5 },
  { x1: 1.5, y1: 15.125, x2: 12, y2: 15.125, consumeFrac: 1 },
  { x1: 1.5, y1: 21.375, x2: 9, y2: 21.375, consumeFrac: 1 },
];

function Comp_ai_generative_text_summary({ size, color = "currentColor", hovered, singleColor }: { size: number; color?: string; hovered?: boolean; singleColor?: boolean }) {
  const { solidControls } = useRovoControls();
  const clipId = useId();

  const gradLineRefs = useRef<(SVGLineElement | null)[][]>([[], [], []]);
  const solidLineRefs = useRef<(SVGLineElement | null)[]>([null, null, null]);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const sparkleStartedRef = useRef(false);
  const mountedRef = useRef(false);

  const setGradRef = useCallback((lineIdx: number, colorIdx: number) => (el: SVGLineElement | null) => {
    if (!gradLineRefs.current[lineIdx]) gradLineRefs.current[lineIdx] = [];
    gradLineRefs.current[lineIdx][colorIdx] = el;
  }, []);

  const setSolidRef = useCallback((lineIdx: number) => (el: SVGLineElement | null) => {
    solidLineRefs.current[lineIdx] = el;
  }, []);

  const resetAll = useCallback(() => {
    for (let li = 0; li < 3; li++) {
      for (let ci = 0; ci < 4; ci++) {
        const el = gradLineRefs.current[li]?.[ci];
        if (el) {
          el.setAttribute("stroke-dasharray", "0 100");
          el.setAttribute("stroke-dashoffset", "0");
          el.setAttribute("opacity", "0");
        }
      }
      const sel = solidLineRefs.current[li];
      if (sel) {
        const L = Math.abs(LINE_DEFS[li].x2 - LINE_DEFS[li].x1);
        sel.setAttribute("stroke-dasharray", `${L} ${L + 1}`);
        sel.setAttribute("stroke-dashoffset", "0");
        sel.setAttribute("opacity", "1");
      }
    }
  }, []);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      resetAll();
      return;
    }
    if (hovered) {
      startRef.current = 0;
      sparkleStartedRef.current = false;

      solidControls.start("hovered");

      const PASS_DUR = 0.6;
      const BAND_FRAC = 0.5;
      const STAGGER = 0.1;

      function tick(ts: number) {
        if (startRef.current === 0) startRef.current = ts;
        const elapsed = (ts - startRef.current) / 1000;

        let allDone = true;
        for (let li = 0; li < 3; li++) {
          const ld = LINE_DEFS[li];
          const totalLength = Math.abs(ld.x2 - ld.x1);
          const lineElapsed = Math.max(0, elapsed - li * STAGGER);
          const p = easeInOut(Math.min(1, lineElapsed / PASS_DUR));

          if (p < 1) allDone = false;

          const spec: LineSpec = {
            totalLength,
            consumeFrac: ld.consumeFrac,
            refs: gradLineRefs.current[li] || [],
            solidRef: solidLineRefs.current[li],
          };
          updatePassThrough(spec, p, BAND_FRAC);
        }

        if (allDone) return;
        rafRef.current = requestAnimationFrame(tick);
      }

      rafRef.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(rafRef.current);
      sparkleStartedRef.current = false;
      solidControls.start("initial");

      startRef.current = 0;
      const RETURN_DUR = 0.6;

      function returnTick(ts: number) {
        if (startRef.current === 0) startRef.current = ts;
        const elapsed = (ts - startRef.current) / 1000;
        const p = easeInOut(Math.min(1, elapsed / RETURN_DUR));

        for (let li = 0; li < 3; li++) {
          for (let ci = 0; ci < 4; ci++) {
            const el = gradLineRefs.current[li]?.[ci];
            if (el) {
              el.setAttribute("opacity", `${Math.max(0, 1 - p * 3).toFixed(2)}`);
            }
          }
          const sel = solidLineRefs.current[li];
          if (sel) {
            const ld = LINE_DEFS[li];
            const totalLength = Math.abs(ld.x2 - ld.x1);
            const consumeLength = totalLength * ld.consumeFrac;
            const currentSolid = totalLength - consumeLength * (1 - p);
            sel.setAttribute("stroke-dasharray", `${currentSolid.toFixed(3)} ${(totalLength + 1).toFixed(1)}`);
            sel.setAttribute("stroke-dashoffset", "0");
            sel.setAttribute("opacity", "1");
          }
        }

        if (p < 1) {
          rafRef.current = requestAnimationFrame(returnTick);
        } else {
          resetAll();
        }
      }

      rafRef.current = requestAnimationFrame(returnTick);
    }

    return () => cancelAnimationFrame(rafRef.current);
  }, [hovered, solidControls, resetAll, singleColor]);

  const sparkleSolid = {
    initial: { opacity: 1, transition: TEXT_SUMMARY_RETURN_TRANSITION },
    hovered: singleColor ? { opacity: 1, transition: TEXT_SUMMARY_RETURN_TRANSITION } : { opacity: 0, transition: { duration: 0.3, ease: "easeInOut" as const } },
  };
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.25}
      strokeLinecap="butt"
      strokeLinejoin="round"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={SPARKLE_PATH} />
        </clipPath>
      </defs>

      <motion.line
        x1="1.5" y1="2.625" x2="22.5" y2="2.625"
            variants={TEXT_SUMMARY_SOLID_LINE_VARIANTS}
        initial="initial"
        animate={solidControls}
      />

      {LINE_DEFS.map((ld, li) => (
        <line
          key={`solid-${li}`}
          ref={setSolidRef(li)}
          x1={ld.x1}
          y1={ld.y1}
          x2={ld.x2}
          y2={ld.y2}
          stroke={color}
          strokeWidth={2.25}
          strokeLinecap="butt"
          fill="none"
        />
      ))}

      {!singleColor ? LINE_DEFS.map((ld, li) =>
        ROVO_COLORS.map((clr, ci) => (
          <line
            key={`grad-${li}-${ci}`}
            ref={setGradRef(li, ci)}
            x1={ld.x1}
            y1={ld.y1}
            x2={ld.x2}
            y2={ld.y2}
            stroke={clr}
            strokeWidth={2.25}
            strokeLinecap="butt"
            fill="none"
            opacity={0}
            strokeDasharray="0 100"
            strokeDashoffset="0"
          />
        ))
      ) : null}

      <motion.g
            variants={TEXT_SUMMARY_SPARKLE_GROUP_VARIANTS}
        initial="initial"
        animate={solidControls}
        style={{ transformOrigin: "18.75px 18.75px" }}
      >
        <motion.path
          d={SPARKLE_PATH}
          fill={color}
          stroke="none"
          variants={sparkleSolid}
          initial="initial"
          animate={solidControls}
        />
        {!singleColor ? <motion.g
            variants={TEXT_SUMMARY_SPARKLE_GRADIENT_VARIANTS}
            initial="initial"
            animate={solidControls}
          >
            <foreignObject x="13.7" y="13.7" width="10.2" height="10.2" clipPath={`url(#${clipId})`}>
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: ROVO_GRADIENT_CSS,
                }}
              />
            </foreignObject>
          </motion.g> : null}
      </motion.g>
    </motion.svg>
  );
}

export function AiGenerativeTextSummary({ size = 20, color = "var(--ds-icon, #505258)", hovered, singleColor = true }: RovoIconProps) {
  const solidControls = useAnimation();
  const contextValue = useMemo(() => ({ solidControls }), [solidControls]);

  return (
    <RovoIconCtx.Provider value={contextValue}>
      <Comp_ai_generative_text_summary size={size} color={color} hovered={hovered} singleColor={singleColor} />
    </RovoIconCtx.Provider>
  );
}

const MW_WAND_BODY =
  "M36 36L11.7678 60.2322C10.7915 61.2085 9.20855 61.2085 8.23223 60.2322L3.76777 55.7678C2.79146 54.7915 2.79146 53.2085 3.76777 52.2322L28 28L38.2322 17.7678C39.2085 16.7915 40.7915 16.7915 41.7678 17.7678L46.2322 22.2322C47.2085 23.2085 47.2085 24.7915 46.2322 25.7678L36 36Z";


const MW_SPARKLE_DEFS: { d: string; color: string; cx: number; cy: number }[] = [
  { d: "M41 0V8", color: "#6A9A23", cx: 41, cy: 4 },
  { d: "M52.1925 11.8076L57.8494 6.15076", color: "#FCA700", cx: 55.02, cy: 8.98 },
  { d: "M56 23H64", color: "#1868DB", cx: 60, cy: 23 },
  { d: "M24.1509 6.15076L29.8077 11.8076", color: "#AF59E0", cx: 26.98, cy: 8.98 },
  { d: "M52.1925 34.1924L57.8494 39.8492", color: "#6A9A23", cx: 55.02, cy: 37.02 },
];


function Comp_magic_wand({ size, color = "currentColor", hovered, singleColor }: { size: number; color?: string; hovered?: boolean; singleColor?: boolean }) {
  const controls = useAnimation();

  useEffect(() => {
    if (hovered) {
      controls.start("hovered");
    } else {
      controls.start("initial");
    }
  }, [hovered, controls]);

  const ease = "easeInOut" as const;

  const wandPulse = {
    initial: { scale: 1, transition: { duration: 0.5, ease } },
    hovered: {
      scale: [1, 0.82, 1],
      transition: { duration: 0.6, ease },
    },
  };

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      overflow="visible"
    >
      <motion.g
        variants={wandPulse}
        initial="initial"
        animate={controls}
        style={{ transformOrigin: "32px 32px" }}
      >
        <path
          d={MW_WAND_BODY}
          stroke={color}
          strokeWidth="6"
          strokeLinejoin="round"
          fill="none"
        />
        <line
          x1="27.1213"
          y1="27.8787"
          x2="36.1213"
          y2="36.8787"
          stroke={color}
          strokeWidth="6"
          strokeLinejoin="round"
        />
      </motion.g>

      {MW_SPARKLE_DEFS.map((s, i) => {
        const hideDelay = i * 0.03;
        const drawDelay = 0.3 + i * 0.05;

        const solidVariant = {
          initial: {
            opacity: 1,
            scale: 1,
            transition: { duration: 0.25, ease, delay: 0 },
          },
          hovered: {
            opacity: 0,
            scale: 0,
            transition: { duration: 0.12, ease, delay: hideDelay },
          },
        };

        const colorVariant = {
          initial: {
            opacity: 0,
            scale: 0,
            transition: { duration: 0.2, ease, delay: 0 },
          },
          hovered: {
            opacity: 1,
            scale: [0, 1.15, 1],
            transition: { duration: 0.3, ease, delay: drawDelay },
          },
        };

        return (
          <g key={i}>
            <motion.path
              d={s.d}
              fill="none"
              stroke={color}
              strokeWidth="6"
              strokeLinecap="butt"
              variants={solidVariant}
              initial="initial"
              animate={controls}
              style={{ transformOrigin: `${s.cx}px ${s.cy}px` }}
            />
            <motion.path
              d={s.d}
              fill="none"
              stroke={singleColor ? color : s.color}
              strokeWidth="6"
              strokeLinecap="butt"
              variants={colorVariant}
              initial="initial"
              animate={controls}
              style={{ transformOrigin: `${s.cx}px ${s.cy}px` }}
            />
          </g>
        );
      })}
    </motion.svg>
  );
}

export function MagicWand({ size = 20, color = "var(--ds-icon, #505258)", hovered, singleColor = true }: RovoIconProps) {
  return <Comp_magic_wand size={size} color={color} hovered={hovered} singleColor={singleColor} />;
}

const RC_BUBBLE = "M12 1.125H3.9375A2.8125 2.8125 0 0 0 1.125 3.9375V22.125L6.375 19.125H20.0625A2.8125 2.8125 0 0 0 22.875 16.3125V12";
const RC_SPARKLE = "M18.7497 1.125H18.7503L19.8528 4.1472L22.875 5.2497V5.2503L19.8528 6.3528L18.7503 9.375H18.7497L17.6472 6.3528L14.625 5.2503V5.2497L17.6472 4.1472L18.7497 1.125Z";
const RC_STROKE_WIDTH = 2.25;

function Comp_rovo_chat({ size, color = "currentColor", hovered, singleColor }: { size: number; color?: string; hovered?: boolean; singleColor?: boolean }) {
  const controls = useAnimation();
  const sparkleMaskId = useId();
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (hovered) {
      controls.start("hovered");
    } else {
      controls.start("initial");
    }
  }, [hovered, controls]);

  const ease = "easeInOut" as const;
  const returnTransition = { duration: 0.6, ease };

  const bubbleWobble = {
    initial: { rotate: 0, transition: returnTransition },
    hovered: {
      rotate: [0, -8, 8, -2, 0],
      transition: {
        duration: 0.8,
        ease,
        times: [0, 0.4, 0.6, 0.8, 1],
      },
    },
  };

  const sparkleRotate = {
    initial: { rotate: 0, transition: returnTransition },
    hovered: { rotate: 180, transition: { duration: 0.5, ease, delay: 0.35 } },
  };

  const sparkleSolid = {
    initial: { opacity: 1, transition: returnTransition },
    hovered: singleColor ? { opacity: 1, transition: returnTransition } : { opacity: 0, transition: { duration: 0.25, ease, delay: 0.35 } },
  };

  const sparkleGradient = {
    initial: { opacity: 0, transition: returnTransition },
    hovered: { opacity: 1, transition: { duration: 0.25, ease, delay: 0.35 } },
  };

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      overflow="visible"
    >
      <defs>
        <mask id={sparkleMaskId}>
          <path
            d={RC_SPARKLE}
            fill="white"
            stroke="white"
            strokeWidth={RC_STROKE_WIDTH}
            strokeLinejoin="round"
          />
        </mask>
      </defs>

      <motion.g
        variants={bubbleWobble}
        initial="initial"
        animate={controls}
        style={{ transformOrigin: "1.125px 22.125px" }}
      >
        <path
          d={RC_BUBBLE}
          stroke={color}
          strokeWidth={RC_STROKE_WIDTH}
          strokeLinecap="butt"
          strokeLinejoin="round"
          fill="none"
        />

        <motion.g
          variants={sparkleRotate}
          initial="initial"
          animate={controls}
          style={{ transformOrigin: "18.75px 5.25px" }}
        >
          <motion.path
            d={RC_SPARKLE}
            fill={color}
            stroke={color}
            strokeWidth={RC_STROKE_WIDTH}
            strokeLinejoin="round"
            variants={sparkleSolid}
            initial="initial"
            animate={controls}
          />
          {!singleColor ? <motion.g
              variants={sparkleGradient}
              initial="initial"
              animate={controls}
            >
              <foreignObject
                x="13.7"
                y="0.2"
                width="10.1"
                height="10.1"
                mask={`url(#${sparkleMaskId})`}
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    background: ROVO_GRADIENT_CSS,
                  }}
                />
              </foreignObject>
            </motion.g> : null}
        </motion.g>
      </motion.g>
    </motion.svg>
  );
}

export function RovoChat({ size = 20, color = "var(--ds-icon, #505258)", hovered, singleColor = true }: RovoIconProps) {
  return <Comp_rovo_chat size={size} color={color} hovered={hovered} singleColor={singleColor} />;
}

const ABR_LEFT = "M6.75 13.125L1.125 9L6.75 4.875";
const ABR_SLASH = "M7.5 22.125L16.5 1.875";
const ABR_RIGHT = "M17.25 19.125L22.875 15L17.25 10.875";
const ABR_STROKE_WIDTH = 2.25;
const ABR_SLASH_LEN = 22.16;

function Comp_angle_brackets({ size, color = "currentColor", hovered, singleColor }: { size: number; color?: string; hovered?: boolean; singleColor?: boolean }) {
  const controls = useAnimation();
  const mountedRef = useRef(false);
  const slashGradRefs = useRef<(SVGPathElement | null)[]>([]);
  const slashSolidRef = useRef<SVGPathElement | null>(null);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  const setSlashGradRef = useCallback((colorIdx: number) => (el: SVGPathElement | null) => {
    slashGradRefs.current[colorIdx] = el;
  }, []);

  const L = ABR_SLASH_LEN;
  const gap = L + 1;

  const resetSlash = useCallback(() => {
    for (let ci = 0; ci < 4; ci++) {
      const el = slashGradRefs.current[ci];
      if (el) {
        el.setAttribute("stroke-dasharray", "0 100");
        el.setAttribute("stroke-dashoffset", "0");
        el.setAttribute("opacity", "0");
      }
    }
    if (slashSolidRef.current) {
      slashSolidRef.current.setAttribute("stroke-dasharray", `${L} ${gap}`);
      slashSolidRef.current.setAttribute("stroke-dashoffset", "0");
      slashSolidRef.current.setAttribute("opacity", "1");
    }
  }, [L, gap]);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      resetSlash();
      return;
    }

    if (singleColor) {
      controls.start(hovered ? "hovered" : "initial");
      cancelAnimationFrame(rafRef.current);
      startRef.current = 0;
      const DUR = 0.6;

      if (hovered) {
        if (slashSolidRef.current) {
          slashSolidRef.current.setAttribute("stroke-dasharray", `0 ${gap.toFixed(1)}`);
          slashSolidRef.current.setAttribute("stroke-dashoffset", "0");
          slashSolidRef.current.setAttribute("opacity", "0");
        }

        function drawTick(ts: number) {
          if (startRef.current === 0) startRef.current = ts;
          const elapsed = (ts - startRef.current) / 1000;
          const p = easeInOut(Math.min(elapsed / DUR, 1));
          const headPos = p * L;
          if (slashSolidRef.current) {
            slashSolidRef.current.setAttribute("stroke-dasharray", `${headPos.toFixed(3)} ${gap.toFixed(1)}`);
            slashSolidRef.current.setAttribute("stroke-dashoffset", "0");
            slashSolidRef.current.setAttribute("opacity", headPos > 0.01 ? "1" : "0");
          }
          if (elapsed < DUR) {
            rafRef.current = requestAnimationFrame(drawTick);
          } else if (slashSolidRef.current) {
            slashSolidRef.current.setAttribute("stroke-dasharray", `${L} ${gap.toFixed(1)}`);
            slashSolidRef.current.setAttribute("opacity", "1");
          }
        }
        rafRef.current = requestAnimationFrame(drawTick);
      } else {
        if (slashSolidRef.current) {
          slashSolidRef.current.setAttribute("stroke-dasharray", `${L} ${gap.toFixed(1)}`);
          slashSolidRef.current.setAttribute("stroke-dashoffset", "0");
          slashSolidRef.current.setAttribute("opacity", "1");
        }
      }

      return () => cancelAnimationFrame(rafRef.current);
    }

    if (hovered) {
      controls.start("hovered");
      startRef.current = 0;

      const DRAW_DUR = 0.6;

      function tick(ts: number) {
        if (startRef.current === 0) startRef.current = ts;
        const elapsed = (ts - startRef.current) / 1000;

        if (elapsed < DRAW_DUR) {
          const p = easeInOut(elapsed / DRAW_DUR);
          const headPos = p * L;

          if (slashSolidRef.current) {
            slashSolidRef.current.setAttribute("opacity", "0");
          }

          const visLen = headPos;
          for (let ci = 0; ci < 4; ci++) {
            const el = slashGradRefs.current[ci];
            if (!el) continue;
            const segStart = (ci / 4) * visLen;
            const seg = visLen / 4;
            el.setAttribute("stroke-dasharray", `${seg.toFixed(3)} ${gap.toFixed(1)}`);
            el.setAttribute("stroke-dashoffset", `${(-segStart).toFixed(3)}`);
            el.setAttribute("opacity", visLen > 0.01 ? "1" : "0");
          }
        } else {
          if (slashSolidRef.current) {
            slashSolidRef.current.setAttribute("opacity", "0");
          }
          for (let ci = 0; ci < 4; ci++) {
            const el = slashGradRefs.current[ci];
            if (!el) continue;
            const seg = L / 4;
            const segStart = (ci / 4) * L;
            el.setAttribute("stroke-dasharray", `${seg.toFixed(3)} ${gap.toFixed(1)}`);
            el.setAttribute("stroke-dashoffset", `${(-segStart).toFixed(3)}`);
            el.setAttribute("opacity", "1");
          }
          return;
        }

        rafRef.current = requestAnimationFrame(tick);
      }

      rafRef.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(rafRef.current);
      controls.start("initial");
      startRef.current = 0;

      const PASS_DUR = 0.6;

      function returnTick(ts: number) {
        if (startRef.current === 0) startRef.current = ts;
        const elapsed = (ts - startRef.current) / 1000;

        if (elapsed < PASS_DUR) {
          const p = easeInOut(elapsed / PASS_DUR);
          const tailPos = p * L;

          if (slashSolidRef.current) {
            slashSolidRef.current.setAttribute("stroke-dasharray", `${tailPos.toFixed(3)} ${gap.toFixed(1)}`);
            slashSolidRef.current.setAttribute("stroke-dashoffset", "0");
            slashSolidRef.current.setAttribute("opacity", tailPos > 0.01 ? "1" : "0");
          }

          const visStart = tailPos;
          const visLen = L - tailPos;
          for (let ci = 0; ci < 4; ci++) {
            const el = slashGradRefs.current[ci];
            if (!el) continue;
            const segStart = visStart + (ci / 4) * visLen;
            const seg = visLen / 4;
            el.setAttribute("stroke-dasharray", `${seg.toFixed(3)} ${gap.toFixed(1)}`);
            el.setAttribute("stroke-dashoffset", `${(-segStart).toFixed(3)}`);
            el.setAttribute("opacity", visLen > 0.01 ? "1" : "0");
          }
        } else {
          resetSlash();
          return;
        }

        rafRef.current = requestAnimationFrame(returnTick);
      }

      rafRef.current = requestAnimationFrame(returnTick);
    }

    return () => cancelAnimationFrame(rafRef.current);
  }, [hovered, controls, resetSlash, L, gap, singleColor]);

  const ease = "easeInOut" as const;
  const returnTransition = { duration: 0.4, ease };

  const leftSpread = {
    initial: { x: 0, transition: returnTransition },
    hovered: { x: -1.5, transition: { duration: 0.3, ease } },
  };

  const rightSpread = {
    initial: { x: 0, transition: returnTransition },
    hovered: { x: 1.5, transition: { duration: 0.3, ease } },
  };

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={ABR_STROKE_WIDTH}
      strokeLinecap="butt"
      strokeLinejoin="round"
      overflow="visible"
    >
      <motion.g variants={leftSpread} initial="initial" animate={controls}>
        <path d={ABR_LEFT} />
      </motion.g>

      <g>
        <path
          ref={slashSolidRef}
          d={ABR_SLASH}
        />
        {!singleColor ? ROVO_COLORS.map((clr, ci) => (
          <path
            key={ci}
            ref={setSlashGradRef(ci)}
            d={ABR_SLASH}
            stroke={clr}
            fill="none"
            opacity={0}
            strokeDasharray="0 100"
          />
        )) : null}
      </g>

      <motion.g variants={rightSpread} initial="initial" animate={controls}>
        <path d={ABR_RIGHT} />
      </motion.g>
    </motion.svg>
  );
}

export function AngleBrackets({ size = 20, color = "var(--ds-icon, #505258)", hovered, singleColor = true }: RovoIconProps) {
  return <Comp_angle_brackets size={size} color={color} hovered={hovered} singleColor={singleColor} />;
}

const AGT_PENCIL = "M17.064 8.411L19.301 6.174C20.033 5.442 20.033 4.255 19.301 3.523L17.452 1.674C16.720 0.942 15.533 0.942 14.801 1.674L12.564 3.911M17.064 8.411L7.152 18.322C6.890 18.584 6.557 18.762 6.194 18.835L1.125 19.848L2.139 14.780C2.211 14.417 2.390 14.084 2.652 13.822L12.564 3.911M17.064 8.411L12.564 3.911";
const AGT_SPARKLE = "M18.750 14.600H18.751L19.853 17.622L22.875 18.724V18.725L19.853 19.827L18.751 22.848H18.750L17.648 19.827L14.626 18.725V18.724L17.648 17.622L18.750 14.600Z";
const AGT_STROKE_WIDTH = 2.25;

function Comp_ai_generative_text({ size, color = "currentColor", hovered, singleColor }: { size: number; color?: string; hovered?: boolean; singleColor?: boolean }) {
  const controls = useAnimation();
  const sparkleMaskId = useId();
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (hovered) {
      controls.start("hovered");
    } else {
      controls.start("initial");
    }
  }, [hovered, controls]);

  const ease = "easeInOut" as const;
  const returnTransition = { duration: 0.6, ease };

  const pencilWobble = {
    initial: { rotate: 0, transition: returnTransition },
    hovered: {
      rotate: [0, -5, 5, -1.5, 0],
      transition: {
        duration: 0.7,
        ease,
        times: [0, 0.4, 0.6, 0.8, 1],
      },
    },
  };

  const sparkleRotate = {
    initial: { rotate: 0, transition: returnTransition },
    hovered: { rotate: 180, transition: { duration: 0.5, ease, delay: 0.3 } },
  };

  const sparkleSolid = singleColor
    ? {
        initial: { opacity: 1, transition: returnTransition },
        hovered: { opacity: 1, transition: returnTransition },
      }
    : {
        initial: { opacity: 1, transition: returnTransition },
        hovered: { opacity: 0, transition: { duration: 0.25, ease, delay: 0.3 } },
      };

  const sparkleGradient = {
    initial: { opacity: 0, transition: returnTransition },
    hovered: { opacity: 1, transition: { duration: 0.25, ease, delay: 0.3 } },
  };

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="butt"
      overflow="visible"
    >
      <defs>
        <mask id={sparkleMaskId}>
          <path
            d={AGT_SPARKLE}
            fill="white"
            stroke="white"
            strokeWidth={AGT_STROKE_WIDTH}
            strokeLinejoin="round"
          />
        </mask>
      </defs>

      <motion.g
        variants={pencilWobble}
        initial="initial"
        animate={controls}
        style={{ transformOrigin: "1.125px 19.848px" }}
      >
        <path
          d={AGT_PENCIL}
          stroke={color}
          strokeWidth={AGT_STROKE_WIDTH}
          strokeLinecap="butt"
          strokeLinejoin="round"
          fill="none"
        />
      </motion.g>

      <motion.g
        variants={sparkleRotate}
        initial="initial"
        animate={controls}
        style={{ transformOrigin: "18.751px 18.724px" }}
      >
        <motion.path
          d={AGT_SPARKLE}
          fill={color}
          stroke={color}
          strokeWidth={AGT_STROKE_WIDTH}
          strokeLinejoin="round"
          variants={sparkleSolid}
          initial="initial"
          animate={controls}
        />
        {!singleColor ? <motion.g
            variants={sparkleGradient}
            initial="initial"
            animate={controls}
          >
            <foreignObject
              x="13.5"
              y="13.5"
              width="10.5"
              height="10.5"
              mask={`url(#${sparkleMaskId})`}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: ROVO_GRADIENT_CSS,
                }}
              />
            </foreignObject>
          </motion.g> : null}
      </motion.g>
    </motion.svg>
  );
}

export function AiGenerativeText({ size = 20, color = "var(--ds-icon, #505258)", hovered, singleColor = true }: RovoIconProps) {
  return <Comp_ai_generative_text size={size} color={color} hovered={hovered} singleColor={singleColor} />;
}

const AISEARCH_GLASS = "M21.75 21.75L16.0685 16.0685M16.0685 16.0685C17.4936 14.6434 18.375 12.6746 18.375 10.5C18.375 6.1508 14.8493 2.625 10.5 2.625C6.1508 2.625 2.625 6.1508 2.625 10.5C2.625 14.8493 6.1508 18.375 10.5 18.375C12.6746 18.375 14.6434 17.4936 16.0685 16.0685Z";
const AISEARCH_SPARKLE = "M16.1246 1.1253C16.1246 1.1251 16.1248 1.125 16.125 1.125C16.1252 1.125 16.1254 1.1251 16.1254 1.1253L16.8284 3.0526C17.0181 3.5724 17.4276 3.9819 17.9474 4.1716L19.8747 4.8746C19.8749 4.8746 19.875 4.8748 19.875 4.875C19.875 4.8752 19.8749 4.8754 19.8747 4.8754L17.9474 5.5784C17.4276 5.7681 17.0181 6.1776 16.8284 6.6974L16.1254 8.6247C16.1254 8.6249 16.1252 8.625 16.125 8.625C16.1248 8.625 16.1246 8.6249 16.1246 8.6247L15.4216 6.6974C15.2319 6.1776 14.8224 5.7681 14.3026 5.5784L12.3753 4.8754C12.3751 4.8754 12.375 4.8752 12.375 4.875C12.375 4.8748 12.3751 4.8746 12.3753 4.8746L14.3026 4.1716C14.8224 3.9819 15.2319 3.5724 15.4216 3.0526L16.1246 1.1253Z";
const AISEARCH_CUTOUT = "M9 0V12H24V24H0V0H9Z";
const AISEARCH_STROKE_WIDTH = 2.25;

function Comp_ai_search({ size, color = "currentColor", hovered, singleColor }: { size: number; color?: string; hovered?: boolean; singleColor?: boolean }) {
  const controls = useAnimation();
  const glassMaskId = useId();
  const glassStrokeMaskId = useId();
  const sparkleClipId = useId();

  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (hovered) {
      controls.start("hovered");
    } else {
      controls.start("initial");
    }
  }, [hovered, controls]);

  const ease = "easeInOut" as const;
  const returnTransition = { duration: 0.6, ease };

  const solidFade = {
    initial: { opacity: 1, transition: { duration: 0.3, ease } },
    hovered: singleColor ? { opacity: 1, transition: { duration: 0.3, ease } } : { opacity: 0, transition: { duration: 0.3, ease } },
  };

  const gradientFade = {
    initial: { opacity: 0, transition: { duration: 0.3, ease } },
    hovered: { opacity: 1, transition: { duration: 0.3, ease } },
  };

  const sparkleSpin = {
    initial: { rotate: 0, transition: returnTransition },
    hovered: { rotate: 180, transition: { duration: 0.6, ease } },
  };

  const sparkleSolidFade = {
    initial: { opacity: 1, transition: returnTransition },
    hovered: singleColor ? { opacity: 1, transition: returnTransition } : { opacity: 0, transition: { duration: 0.3, ease } },
  };

  const sparkleGradientFade = {
    initial: { opacity: 0, transition: returnTransition },
    hovered: { opacity: 1, transition: { duration: 0.3, ease } },
  };

  const glassScale = {
    initial: { scale: 1, transition: returnTransition },
    hovered: { scale: 0.9, transition: { duration: 0.6, ease } },
  };

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      overflow="visible"
    >
      <defs>
        <mask id={glassMaskId}>
          <path d={AISEARCH_CUTOUT} fill="white" />
        </mask>
        <mask id={glassStrokeMaskId}>
          <g mask={`url(#${glassMaskId})`}>
            <path
              d={AISEARCH_GLASS}
              stroke="white"
              strokeWidth={AISEARCH_STROKE_WIDTH}
              strokeLinecap="butt"
              strokeLinejoin="round"
              fill="none"
            />
          </g>
        </mask>
        <mask id={sparkleClipId}>
          <path d={AISEARCH_SPARKLE} fill="white" stroke="white" strokeWidth={AISEARCH_STROKE_WIDTH} strokeLinejoin="round" />
        </mask>
      </defs>

      <motion.g variants={glassScale} initial="initial" animate={controls} style={{ transformOrigin: "10.5px 10.5px" }}>
        <g mask={`url(#${glassMaskId})`}>
          <motion.path
            d={AISEARCH_GLASS}
            stroke={color}
            strokeWidth={AISEARCH_STROKE_WIDTH}
            strokeLinecap="butt"
            strokeLinejoin="round"
            fill="none"
            variants={solidFade}
            initial="initial"
            animate={controls}
          />
        </g>

        {!singleColor ? <motion.g
            variants={gradientFade}
            initial="initial"
            animate={controls}
          >
            <foreignObject x="-4" y="-4" width="32" height="32" mask={`url(#${glassStrokeMaskId})`}>
              <motion.div
                style={{
                  width: "100%",
                  height: "100%",
                  background: ROVO_GRADIENT_CSS,
                  transformOrigin: "center center",
                }}
                variants={{
                  initial: { rotate: -180, transition: { duration: 0.575, ease } },
                  hovered: { rotate: 0, transition: { duration: 0.575, ease } },
                }}
                initial="initial"
                animate={controls}
              />
            </foreignObject>
          </motion.g> : null}
      </motion.g>

      <motion.g variants={sparkleSpin} initial="initial" animate={controls} style={{ transformOrigin: "16.125px 4.875px" }}>
        <motion.path
          d={AISEARCH_SPARKLE}
          fill={color}
          stroke={color}
          strokeWidth={AISEARCH_STROKE_WIDTH}
          strokeLinejoin="round"
          variants={sparkleSolidFade}
          initial="initial"
          animate={controls}
        />
        {!singleColor ? <motion.g
            variants={sparkleGradientFade}
            initial="initial"
            animate={controls}
          >
            <foreignObject x="11" y="-1" width="11" height="12" mask={`url(#${sparkleClipId})`}>
              <motion.div
                style={{
                  width: "100%",
                  height: "100%",
                  background: ROVO_GRADIENT_CSS,
                  transformOrigin: "center center",
                }}
                variants={{
                  initial: { rotate: -180, transition: { duration: 0.575, ease } },
                  hovered: { rotate: 0, transition: { duration: 0.575, ease } },
                }}
                initial="initial"
                animate={controls}
              />
            </foreignObject>
          </motion.g> : null}
      </motion.g>
    </motion.svg>
  );
}

export function AiSearch({ size = 20, color = "var(--ds-icon, #505258)", hovered, singleColor = true }: RovoIconProps) {
  return <Comp_ai_search size={size} color={color} hovered={hovered} singleColor={singleColor} />;
}
