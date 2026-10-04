"use client"

// oxlint-disable react-doctor/exhaustive-deps -- Effects in this file intentionally coordinate refs, external animation loops, timers, subscriptions, or measured DOM state; dependencies are constrained to avoid restarting those bridges.
// oxlint-disable react-doctor/no-aria-hidden-on-focusable -- These generated visual layers are managed as decorative/focus-bridged surfaces by the owning component.
// oxlint-disable react-doctor/no-event-handler -- Effects in this file bridge external systems, animation/media state, timers, or parent-controlled state rather than user event handlers.
// oxlint-disable react-doctor/no-initialize-state -- These components intentionally seed local interactive state from props or external runtime state before user edits take ownership.
// oxlint-disable react-doctor/prefer-module-scope-pure-function -- These helpers are intentionally local to the component/demo because they depend on the surrounding interaction contract.

// oxlint-disable react-doctor/prefer-tag-over-role -- This file uses ARIA roles for custom generated visuals or composite widgets where the suggested native tag would change semantics or behavior.

import { useCallback, useEffect, useRef, useState, type HTMLAttributes } from "react"
import { useReducedMotion } from "motion/react"

import {
  STATIC_ACTIVE_HANDOFF_DURATION_MS,
  getWaveformBarHeight,
  getScrollingBarVisualIndex,
  getScrollingBarX,
  getStaticBarDataIndex,
  getStaticProcessingBarValue,
  getCompressedVoiceEnergy,
  getVoiceResponsiveBarValue,
  getWaveformEaseOutProgress,
  getWaveformPaletteIndex,
  getWaveformSeriesValue,
} from "@/components/ui-audio/live-waveform-layout"
import { cn } from "@/lib/utils"

export type LiveWaveformProps = HTMLAttributes<HTMLDivElement> & {
  active?: boolean
  processing?: boolean
  deviceId?: string
  mediaStream?: MediaStream | null
  barWidth?: number
  barCount?: number
  barHeight?: number
  barGap?: number
  barRadius?: number
  barColor?: string
  barColors?: string[]
  barOpacityMin?: number
  barOpacityMax?: number
  fadeEdges?: boolean
  fadeWidth?: number
  height?: string | number
  barHeightScale?: number
  entranceAnimation?: "none" | "stagger"
  entranceDurationMs?: number
  entranceStaggerMs?: number
  sensitivity?: number
  smoothingTimeConstant?: number
  fftSize?: number
  historySize?: number
  updateRate?: number
  mode?: "scrolling" | "static"
  onError?: (error: Error) => void
  onStreamReady?: (stream: MediaStream) => void
  onStreamEnd?: () => void
}

export const LiveWaveform = ({
  active = false,
  processing = false,
  deviceId,
  mediaStream: externalStream,
  barWidth = 3,
  barCount: fixedBarCount,
  barGap = 1,
  barRadius = 1.5,
  barColor,
  barColors,
  barOpacityMin = 0.4,
  barOpacityMax = 1,
  fadeEdges = true,
  fadeWidth = 24,
  barHeight: baseBarHeight = 6,
  height = 64,
  barHeightScale = 0.8,
  entranceAnimation = "none",
  entranceDurationMs = 260,
  entranceStaggerMs = 18,
  sensitivity = 1,
  smoothingTimeConstant = 0.8,
  fftSize = 256,
  historySize = 60,
  updateRate = 30,
  mode = "static",
  onError,
  onStreamReady,
  onStreamEnd,
  className,
  ...props
}: LiveWaveformProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const historyRef = useRef<number[]>([])
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number>(0)
  const lastUpdateRef = useRef<number>(0)
  const processingAnimationRef = useRef<number | null>(null)
  const lastActiveDataRef = useRef<number[]>([])
  const transitionProgressRef = useRef(0)
  const staticBarsRef = useRef<number[]>([])
  const needsRedrawRef = useRef(true)
  const gradientCacheRef = useRef<CanvasGradient | null>(null)
  const lastWidthRef = useRef(0)
  const entranceStartTimeRef = useRef<number | null>(null)
  const wasWaveformVisibleRef = useRef(false)
  const activeTransitionSourceBarsRef = useRef<number[]>([])
  const activeTransitionStartTimeRef = useRef<number | null>(null)
  const wasActiveRef = useRef(false)

  const heightStyle = typeof height === "number" ? `${height}px` : height
  const minBarOpacity = Math.max(0, Math.min(1, barOpacityMin))
  const maxBarOpacity = Math.max(minBarOpacity, Math.min(1, barOpacityMax))
  const getBarCount = useCallback(
    (width: number) =>
      Math.max(
        0,
        Math.floor(fixedBarCount ?? width / Math.max(1, barWidth + barGap))
      ),
    [barGap, barWidth, fixedBarCount]
  )

  const reduced = useReducedMotion()
  const [inView, setInView] = useState(false)
  const [tabVisible, setTabVisible] = useState(
    typeof document === "undefined" ? true : document.visibilityState === "visible",
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "200px" },
    )
    io.observe(el)
    const onVis = () => setTabVisible(document.visibilityState === "visible")
    document.addEventListener("visibilitychange", onVis)
    return () => {
      io.disconnect()
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [])

  const shouldAnimate = !reduced && inView && tabVisible

  const getContainerSize = () => {
    const container = containerRef.current
    if (!container) {
      return {
        height: 0,
        width: 0,
      }
    }

    return {
      width: container.clientWidth,
      height: container.clientHeight,
    }
  }

  const resolveCanvasColor = (
    style: CSSStyleDeclaration,
    colorValue: string
  ) => {
    if (colorValue === "currentColor") {
      return style.color || "#000"
    }

    const cssVariableMatch = colorValue.match(/^var\((--[^)]+)\)$/)
    if (cssVariableMatch) {
      const resolved = style.getPropertyValue(cssVariableMatch[1]).trim()
      return resolved || style.color || "#000"
    }

    return colorValue
  }

  const getBarFillColor = ({
    fallbackColor,
    index,
    palette,
  }: {
    fallbackColor: string
    index: number
    palette: string[]
  }) => {
    if (palette.length === 0) {
      return fallbackColor
    }

    const paletteIndex = getWaveformPaletteIndex({
      index,
      paletteLength: palette.length,
    })

    return palette[paletteIndex] || fallbackColor
  }

  // Handle canvas resizing
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const resizeObserver = new ResizeObserver(() => {
      const { width, height } = getContainerSize()
      const dpr = window.devicePixelRatio || 1

      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = "100%"
      canvas.style.height = "100%"

      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.scale(dpr, dpr)
      }

      gradientCacheRef.current = null
      lastWidthRef.current = width
      needsRedrawRef.current = true
    })

    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    const isWaveformVisible = active || processing

    if (
      entranceAnimation === "stagger" &&
      isWaveformVisible &&
      !wasWaveformVisibleRef.current
    ) {
      entranceStartTimeRef.current = performance.now()
      needsRedrawRef.current = true
    } else if (!isWaveformVisible) {
      entranceStartTimeRef.current = null
    }

    wasWaveformVisibleRef.current = isWaveformVisible
  }, [active, entranceAnimation, processing])

  useEffect(() => {
    if (active && !wasActiveRef.current && mode === "static") {
      if (staticBarsRef.current.length > 0) {
        activeTransitionSourceBarsRef.current = [...staticBarsRef.current]
        activeTransitionStartTimeRef.current = performance.now()
        needsRedrawRef.current = true
      }
    } else if (!active) {
      activeTransitionSourceBarsRef.current = []
      activeTransitionStartTimeRef.current = null
    }

    wasActiveRef.current = active
  }, [active, mode])

  useEffect(() => {
    if (!shouldAnimate) return
    if (processing && !active) {
      let time = 0
      transitionProgressRef.current = 0
      const processingStartTime = performance.now()

      const animateProcessing = (frameTime: number) => {
        const elapsedMs = frameTime - processingStartTime
        time = (elapsedMs / 1000) * 1.8
        transitionProgressRef.current = Math.min(
          1,
          transitionProgressRef.current + 0.02
        )

        const processingData = []
        const barCount = getBarCount(getContainerSize().width || 200)

        if (mode === "static") {
          for (let i = 0; i < barCount; i++) {
            const processingValue = getStaticProcessingBarValue({
              barCount,
              elapsedMs,
              index: i,
            })

            let finalValue = processingValue
            if (
              lastActiveDataRef.current.length > 0 &&
              transitionProgressRef.current < 1
            ) {
              const lastDataIndex = Math.min(
                i,
                lastActiveDataRef.current.length - 1
              )
              const lastValue = lastActiveDataRef.current[lastDataIndex] || 0
              finalValue =
                lastValue * (1 - transitionProgressRef.current) +
                processingValue * transitionProgressRef.current
            }

            processingData.push(Math.max(0.05, Math.min(1, finalValue)))
          }
        } else {
          for (let i = 0; i < barCount; i++) {
            const normalizedPosition = (i - barCount / 2) / Math.max(1, barCount / 2)
            const centerWeight = 1 - Math.abs(normalizedPosition) * 0.4

            const wave1 = Math.sin(time * 1.5 + i * 0.15) * 0.25
            const wave2 = Math.sin(time * 0.8 - i * 0.1) * 0.2
            const wave3 = Math.cos(time * 2 + i * 0.05) * 0.15
            const combinedWave = wave1 + wave2 + wave3
            const processingValue = (0.2 + combinedWave) * centerWeight

            let finalValue = processingValue
            if (
              lastActiveDataRef.current.length > 0 &&
              transitionProgressRef.current < 1
            ) {
              const lastDataIndex = Math.floor(
                (i / Math.max(1, barCount)) * lastActiveDataRef.current.length
              )
              const lastValue = lastActiveDataRef.current[lastDataIndex] || 0
              finalValue =
                lastValue * (1 - transitionProgressRef.current) +
                processingValue * transitionProgressRef.current
            }

            processingData.push(Math.max(0.05, Math.min(1, finalValue)))
          }
        }

        if (mode === "static") {
          staticBarsRef.current = processingData
        } else {
          historyRef.current = processingData
        }

        needsRedrawRef.current = true
        processingAnimationRef.current =
          requestAnimationFrame(animateProcessing)
      }

      animateProcessing(processingStartTime)

      return () => {
        if (processingAnimationRef.current) {
          cancelAnimationFrame(processingAnimationRef.current)
        }
      }
    } else if (!active && !processing) {
      const hasData =
        mode === "static"
          ? staticBarsRef.current.length > 0
          : historyRef.current.length > 0

      if (hasData) {
        let fadeProgress = 0
        const fadeToIdle = () => {
          fadeProgress += 0.03
          if (fadeProgress < 1) {
            if (mode === "static") {
              staticBarsRef.current = staticBarsRef.current.map(
                (value) => value * (1 - fadeProgress)
              )
            } else {
              historyRef.current = historyRef.current.map(
                (value) => value * (1 - fadeProgress)
              )
            }
            needsRedrawRef.current = true
            requestAnimationFrame(fadeToIdle)
          } else {
            if (mode === "static") {
              staticBarsRef.current = []
            } else {
              historyRef.current = []
            }
          }
        }
        fadeToIdle()
      }
    }
  }, [processing, active, barWidth, barGap, fixedBarCount, getBarCount, mode, shouldAnimate])

  // Handle microphone setup and teardown
  useEffect(() => {
    // Track whether we created the stream ourselves (vs. using an external one)
    let ownsStream = false

    if (!active) {
      if (streamRef.current) {
        // Only stop tracks if we created the stream
        if (!externalStream) {
          streamRef.current.getTracks().forEach((track) => track.stop())
        }
        streamRef.current = null
        onStreamEnd?.()
      }
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = 0
      }
      return
    }

    const setupAudio = async () => {
      try {
        let stream: MediaStream

        if (externalStream) {
          // Use the externally provided stream
          stream = externalStream
        } else {
          // Create our own stream via getUserMedia
          ownsStream = true
          stream = await navigator.mediaDevices.getUserMedia({
            audio: deviceId
              ? {
                  deviceId: { exact: deviceId },
                  echoCancellation: true,
                  noiseSuppression: true,
                  autoGainControl: true,
                }
              : {
                  echoCancellation: true,
                  noiseSuppression: true,
                  autoGainControl: true,
                },
          })
        }

        streamRef.current = stream
        onStreamReady?.(stream)

        const AudioContextConstructor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext
        const audioContext = new AudioContextConstructor()
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = fftSize
        analyser.smoothingTimeConstant = smoothingTimeConstant

        const source = audioContext.createMediaStreamSource(stream)
        source.connect(analyser)

        audioContextRef.current = audioContext
        analyserRef.current = analyser

        // Clear history when starting
        historyRef.current = []
      } catch (error) {
        onError?.(error as Error)
      }
    }

    setupAudio()

    return () => {
      if (streamRef.current) {
        // Only stop tracks for streams we created
        if (ownsStream) {
          streamRef.current.getTracks().forEach((track) => track.stop())
        }
        streamRef.current = null
        onStreamEnd?.()
      }
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = 0
      }
    }
  }, [
    active,
    externalStream,
    deviceId,
    fftSize,
    smoothingTimeConstant,
    onError,
    onStreamReady,
    onStreamEnd,
  ])

  // Animation loop
  useEffect(() => {
    if (!shouldAnimate) return
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let rafId: number

    const animate = (currentTime: number) => {
      const getEntranceProgress = ({
        index,
        totalBars,
      }: {
        index: number
        totalBars: number
      }) => {
        if (
          entranceAnimation !== "stagger" ||
          entranceStartTimeRef.current == null
        ) {
          return 1
        }

        const revealIndex =
          mode === "static"
            ? Math.min(index, Math.max(0, totalBars - 1 - index))
            : index
        const elapsed = currentTime - entranceStartTimeRef.current
        const rawProgress =
          (elapsed - revealIndex * entranceStaggerMs) / entranceDurationMs
        const clampedProgress = Math.max(0, Math.min(1, rawProgress))

        return 1 - (1 - clampedProgress) ** 3
      }

      // Render waveform
      const { width, height } = getContainerSize()

      // Update audio data if active
      if (active && currentTime - lastUpdateRef.current > updateRate) {
        lastUpdateRef.current = currentTime

        if (analyserRef.current) {
          const dataArray = new Uint8Array(
            analyserRef.current.frequencyBinCount
          )
          analyserRef.current.getByteFrequencyData(dataArray)

          if (mode === "static") {
            // For static mode, update bars in place
            const startFreq = Math.floor(dataArray.length * 0.05)
            const endFreq = Math.floor(dataArray.length * 0.4)
            const relevantData = dataArray.slice(startFreq, endFreq)
            const barCount = getBarCount(width)
            const newBars: number[] = []

            // Render current frequency bands in place so compact mic surfaces
            // respond to the user's voice instead of scrolling averaged history.
            for (let i = 0; i < barCount; i++) {
              const mirroredDataIndex = getStaticBarDataIndex({
                barCount,
                dataLength: relevantData.length,
                index: i,
              })
              const responsiveValue = getVoiceResponsiveBarValue({
                barCount,
                data: relevantData,
                index: i,
                sensitivity,
              })
              const mirroredValue = Math.min(
                1,
                getCompressedVoiceEnergy({
                  sensitivity,
                  value: relevantData[mirroredDataIndex] / 255,
                })
              )
              const value = Math.max(responsiveValue, mirroredValue * 0.42)
              newBars.push(Math.max(0.05, value))
            }

            if (
              activeTransitionStartTimeRef.current != null &&
              activeTransitionSourceBarsRef.current.length > 0
            ) {
              const progress = getWaveformEaseOutProgress({
                durationMs: STATIC_ACTIVE_HANDOFF_DURATION_MS,
                elapsedMs: currentTime - activeTransitionStartTimeRef.current,
              })

              for (let i = 0; i < newBars.length; i += 1) {
                const sourceValue = getWaveformSeriesValue({
                  bars: activeTransitionSourceBarsRef.current,
                  index: i,
                  totalCount: newBars.length,
                })

                newBars[i] =
                  sourceValue * (1 - progress) + newBars[i] * progress
              }

              if (progress >= 1) {
                activeTransitionSourceBarsRef.current = []
                activeTransitionStartTimeRef.current = null
              }
            }

            staticBarsRef.current = newBars
            lastActiveDataRef.current = newBars
          } else {
            // Scrolling mode - original behavior
            let sum = 0
            const startFreq = Math.floor(dataArray.length * 0.05)
            const endFreq = Math.floor(dataArray.length * 0.4)
            const relevantData = dataArray.slice(startFreq, endFreq)

            for (let i = 0; i < relevantData.length; i++) {
              sum += relevantData[i]
            }
            const average = (sum / relevantData.length / 255) * sensitivity

            // Add to history
            historyRef.current.push(Math.min(1, Math.max(0.05, average)))

            // Maintain history size
            if (historyRef.current.length > historySize) {
              historyRef.current.shift()
            }

            lastActiveDataRef.current = [...historyRef.current]
          }
          needsRedrawRef.current = true
        }
      }

      // Only redraw if needed
      if (!needsRedrawRef.current && !active) {
        rafId = requestAnimationFrame(animate)
        return
      }

      needsRedrawRef.current = active
      ctx.clearRect(0, 0, width, height)

      const style = getComputedStyle(canvas)
      const computedBarColor = resolveCanvasColor(
        style,
        barColor || "currentColor"
      )
      const resolvedBarColors =
        barColors?.map((colorValue) => resolveCanvasColor(style, colorValue)) ||
        []

      const step = barWidth + barGap
      const barCount = getBarCount(width)
      const centerY = height / 2

      // Draw bars based on mode
      if (mode === "static") {
        // Static mode - bars in fixed positions
        const dataToRender = processing
          ? staticBarsRef.current
          : active
            ? staticBarsRef.current
            : staticBarsRef.current.length > 0
              ? staticBarsRef.current
              : []

        // Always render the full bar count, centered, so the resting/idle
        // state keeps the same quantity and position as the active state
        // instead of collapsing to a short, left-anchored cluster.
        const renderedWidth = Math.max(0, barCount * step - barGap)
        const centerOffset = Math.max(0, (width - renderedWidth) / 2)

        for (let i = 0; i < barCount; i++) {
          const value = getWaveformSeriesValue({
            bars: dataToRender,
            index: i,
            totalCount: barCount,
          })
          const x = centerOffset + i * step
          const entranceProgress = getEntranceProgress({
            index: i,
            totalBars: barCount,
          })
          const barHeight = getWaveformBarHeight({
            baseBarHeight,
            barHeightScale,
            height,
            value,
          }) * entranceProgress
          const y = centerY - barHeight / 2

          ctx.fillStyle = getBarFillColor({
            fallbackColor: computedBarColor,
            index: i,
            palette: resolvedBarColors,
          })
          ctx.globalAlpha =
            (minBarOpacity + value * (maxBarOpacity - minBarOpacity)) *
            entranceProgress

          if (barRadius > 0) {
            ctx.beginPath()
            ctx.roundRect(x, y, barWidth, barHeight, barRadius)
            ctx.fill()
          } else {
            ctx.fillRect(x, y, barWidth, barHeight)
          }
        }
      } else {
        // Scrolling mode - bars scroll in from the right, but keep the same
        // centered horizontal envelope as static mode so the active <-> idle
        // handoff doesn't shift the row left/right.
        const renderedWidth = Math.max(0, barCount * step - barGap)
        const centerOffset = Math.max(0, (width - renderedWidth) / 2)

        for (let i = 0; i < barCount && i < historyRef.current.length; i++) {
          const dataIndex = historyRef.current.length - 1 - i
          const value = historyRef.current[dataIndex] || 0.1
          const x =
            getScrollingBarX({
              barGap,
              barWidth,
              index: i,
              width: renderedWidth,
            }) + centerOffset
          const entranceProgress = getEntranceProgress({
            index: i,
            totalBars: barCount,
          })
          const barHeight = getWaveformBarHeight({
            baseBarHeight,
            barHeightScale,
            height,
            value,
          }) * entranceProgress
          const y = centerY - barHeight / 2

          ctx.fillStyle = getBarFillColor({
            fallbackColor: computedBarColor,
            index: getScrollingBarVisualIndex({
              barCount,
              index: i,
            }),
            palette: resolvedBarColors,
          })
          ctx.globalAlpha =
            (minBarOpacity + value * (maxBarOpacity - minBarOpacity)) *
            entranceProgress

          if (barRadius > 0) {
            ctx.beginPath()
            ctx.roundRect(x, y, barWidth, barHeight, barRadius)
            ctx.fill()
          } else {
            ctx.fillRect(x, y, barWidth, barHeight)
          }
        }
      }

      // Apply edge fading
      if (fadeEdges && fadeWidth > 0 && width > 0) {
        // Cache gradient if width hasn't changed
        if (!gradientCacheRef.current || lastWidthRef.current !== width) {
          const gradient = ctx.createLinearGradient(0, 0, width, 0)
          const fadePercent = Math.min(0.3, fadeWidth / width)

          // destination-out: removes destination where source alpha is high
          // We want: fade edges out, keep center solid
          // Left edge: start opaque (1) = remove, fade to transparent (0) = keep
          gradient.addColorStop(0, "rgba(255,255,255,1)")
          gradient.addColorStop(fadePercent, "rgba(255,255,255,0)")
          // Center stays transparent = keep everything
          gradient.addColorStop(1 - fadePercent, "rgba(255,255,255,0)")
          // Right edge: fade from transparent (0) = keep to opaque (1) = remove
          gradient.addColorStop(1, "rgba(255,255,255,1)")

          gradientCacheRef.current = gradient
          lastWidthRef.current = width
        }

        ctx.globalCompositeOperation = "destination-out"
        ctx.fillStyle = gradientCacheRef.current
        ctx.fillRect(0, 0, width, height)
        ctx.globalCompositeOperation = "source-over"
      }

      ctx.globalAlpha = 1

      rafId = requestAnimationFrame(animate)
    }

    rafId = requestAnimationFrame(animate)

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [
    active,
    processing,
    sensitivity,
    updateRate,
    historySize,
    barWidth,
    fixedBarCount,
    baseBarHeight,
    barHeightScale,
    entranceAnimation,
    entranceDurationMs,
    entranceStaggerMs,
    minBarOpacity,
    maxBarOpacity,
    barGap,
    barRadius,
    barColor,
    barColors,
    barOpacityMin,
    barOpacityMax,
    fadeEdges,
    fadeWidth,
    getBarCount,
    mode,
    shouldAnimate,
  ])

  return (
    <div
      className={cn("relative h-full w-full", className)}
      ref={containerRef}
      style={{ height: heightStyle }}
      aria-label={
        active
          ? "Live audio waveform"
          : processing
            ? "Processing audio"
            : "Audio waveform idle"
      }
      role="img"
      {...props}
    >
      {!active && !processing ? <div className="border-muted-foreground/20 absolute top-1/2 right-0 left-0 -translate-y-1/2 border-t-2 border-dotted" /> : null}
      <canvas
        className="block h-full w-full"
        ref={canvasRef}
        aria-hidden="true"
      />
    </div>
  )
}
