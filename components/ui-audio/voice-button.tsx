"use client"

import * as React from "react"
import type { Ref } from "react"
import { CheckIcon, XIcon } from "@/components/ui/vpk-icons"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LiveWaveform } from "@/components/ui-audio/live-waveform"

export type VoiceButtonState =
  | "idle"
  | "recording"
  | "processing"
  | "success"
  | "error"

export interface VoiceButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onError"> {
  /**
   * Current state of the voice button
   * @default "idle"
   */
  state?: VoiceButtonState

  /**
   * Callback when button is clicked
   */
  onPress?: () => void

  /**
   * Content to display on the left side (label)
   * Can be a string or ReactNode for custom components
   */
  label?: React.ReactNode

  /**
   * Content to display on the right side (e.g., keyboard shortcut)
   * Can be a string or ReactNode for custom components
   * @example "⌥Space" or <kbd>⌘K</kbd>
   */
  trailing?: React.ReactNode

  /**
   * Icon to display in the center when idle (for icon size buttons)
   */
  icon?: React.ReactNode

  /**
   * Custom variant for the button
   * @default "outline"
   */
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link"

  /**
   * Size of the button
   * @default "default"
   */
  size?: "default" | "compact" | "icon" | "icon-compact"

  /**
   * Custom className for the button
   */
  className?: string

  /**
   * Custom className for the waveform container
   */
  waveformClassName?: string

  /**
   * Duration in ms to show success/error states
   * @default 1500
   */
  feedbackDuration?: number

  /**
   * Disable the button
   */
  disabled?: boolean

  /**
   * Allow presses while the button is in processing state.
   * Useful for toggle-style voice controls that need the same button
   * to cancel an active voice session.
   * @default false
   */
  allowPressWhileProcessing?: boolean

  /**
   * Forwarded ref to the underlying button element (React 19 ref-as-prop).
   */
  ref?: Ref<HTMLButtonElement>
}

export function VoiceButton({
  state = "idle",
  onPress,
  label,
  trailing,
  icon,
  variant = "outline",
  size = "default",
  className,
  waveformClassName,
  feedbackDuration = 1500,
  disabled,
  allowPressWhileProcessing = false,
  onClick,
  ref,
  "aria-label": ariaLabelProp,
  ...props
}: VoiceButtonProps) {
  const [feedbackState, setFeedbackState] = React.useState({
    showFeedback: false,
    status: state,
  })
  let resolvedFeedbackState = feedbackState
  if (feedbackState.status !== state) {
    resolvedFeedbackState = {
      showFeedback: state === "success" || state === "error",
      status: state,
    }
    setFeedbackState(resolvedFeedbackState)
  }
  const showFeedback = resolvedFeedbackState.showFeedback

  React.useEffect(() => {
    if (!showFeedback) {
      return
    }

    const timeout = setTimeout(
      () => setFeedbackState((currentState) => ({ ...currentState, showFeedback: false })),
      feedbackDuration
    )
    return () => clearTimeout(timeout)
  }, [feedbackDuration, showFeedback])

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e)
    onPress?.()
  }

  const isRecording = state === "recording"
  const isProcessing = state === "processing"
  const isSuccess = state === "success"
  const isError = state === "error"

  const buttonVariant = variant
  const isDisabled = disabled || (isProcessing && !allowPressWhileProcessing)

  const displayLabel = label

  const shouldShowWaveform = isRecording || isProcessing || showFeedback
  const shouldShowTrailing = !shouldShowWaveform && trailing

  // Dynamic aria-label reflects the current state so SR users know what
  // pressing the button will do. Caller-provided aria-label always wins.
  const stateAriaLabel = isRecording
    ? "Stop recording"
    : isProcessing
      ? "Processing voice input"
      : isSuccess
        ? "Voice input captured"
        : isError
          ? "Voice input failed, try again"
          : "Start recording"

  return (
    <Button
      ref={ref}
      type="button"
      variant={buttonVariant}
      size={size}
      onClick={handleClick}
      disabled={isDisabled}
      className={cn(
        "gap-2 transition-all duration-200",
        size === "icon" && "relative",
        className
      )}
      aria-label={ariaLabelProp ?? stateAriaLabel}
      aria-pressed={isRecording}
      {...props}
    >
      {size !== "icon" && displayLabel ? <span className="inline-flex shrink-0 items-center justify-start">
          {displayLabel}
        </span> : null}

      <div
        className={cn(
          "relative box-content flex shrink-0 items-center justify-center overflow-hidden transition-all duration-300",
          size === "icon"
            ? "absolute inset-0 rounded-sm border-0"
            : "h-5 w-24 rounded-sm border",
          isRecording
            ? "bg-bg-selected"
            : size === "icon"
              ? "bg-bg-neutral/50 border-0"
              : "border-border bg-bg-neutral/50",
          waveformClassName
        )}
      >
        {shouldShowWaveform ? <LiveWaveform
            active={isRecording}
            processing={isProcessing || isSuccess}
            barWidth={2}
            barGap={1}
            barRadius={4}
            fadeEdges={false}
            sensitivity={1.8}
            smoothingTimeConstant={0.85}
            height={20}
            mode="static"
            className="animate-in fade-in absolute inset-0 h-full w-full duration-300"
          /> : null}

        {shouldShowTrailing ? <div className="animate-in fade-in absolute inset-0 flex items-center justify-center duration-300">
            {typeof trailing === "string" ? (
              <span className="text-text-subtle px-1.5 font-mono text-[10px] font-medium select-none">
                {trailing}
              </span>
            ) : (
              trailing
            )}
          </div> : null}

        {!shouldShowWaveform &&
          !shouldShowTrailing &&
          icon &&
          size === "icon" ? <div className="animate-in fade-in absolute inset-0 flex items-center justify-center duration-300">
              {icon}
            </div> : null}

        {isSuccess && showFeedback ? <div className="animate-in fade-in bg-surface absolute inset-0 flex items-center justify-center duration-300">
            <span className="text-icon-success text-[10px] font-medium">
              <CheckIcon className="size-3.5" />
            </span>
          </div> : null}

        {/* Error Icon */}
        {isError && showFeedback ? <div className="animate-in fade-in bg-surface absolute inset-0 flex items-center justify-center duration-300">
            <span className="text-icon-danger text-[10px] font-medium">
              <XIcon className="size-3.5" />
            </span>
          </div> : null}
      </div>
    </Button>
  )
}

VoiceButton.displayName = "VoiceButton"
