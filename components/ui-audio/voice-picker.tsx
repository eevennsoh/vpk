"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import type { ElevenLabs } from "@elevenlabs/elevenlabs-js"
import {
  CheckIcon as Check,
  ChevronsUpDownIcon as ChevronsUpDown,
  PauseIcon as Pause,
  PlayIcon as Play,
} from "@/components/ui/vpk-icons"

import { cn } from "@/lib/utils"
import {
  AudioPlayerProvider,
  useAudioPlayer,
} from "@/components/ui-audio/audio-player"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

// Lazy-load the Orb: it pulls in three / @react-three/fiber / drei (a large
// WebGL stack). Code-splitting keeps that out of the initial bundle for every
// screen that mounts the voice picker; it loads on demand, client-only.
const Orb = dynamic(
  () => import("@/components/ui-audio/orb").then((m) => m.Orb),
  { ssr: false },
)

interface VoicePickerProps {
  voices: ElevenLabs.Voice[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  className?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function VoicePicker({
  voices,
  value,
  onValueChange,
  placeholder = "Select a voice...",
  className,
  open,
  onOpenChange,
}: VoicePickerProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = open !== undefined
  const isOpen = isControlled ? open : internalOpen
  const setIsOpen = isControlled ? onOpenChange : setInternalOpen
  const contentId = React.useId()

  const selectedVoice = voices.find((v) => v.voiceId === value)

  return (
    <AudioPlayerProvider>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger
          render={(
            <Button
              aria-label={
                selectedVoice?.name
                  ? `Selected voice ${selectedVoice.name}`
                  : placeholder
              }
              variant="outline"
              role="combobox"
              aria-controls={contentId}
              aria-expanded={isOpen}
              className={cn("w-full justify-between text-text-subtle", className)}
            />
          )}
        >
          {selectedVoice ? (
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="relative size-6 shrink-0 overflow-visible">
                <Orb agentState="thinking" className="absolute inset-0" />
              </div>
              <span className="truncate">{selectedVoice.name}</span>
            </div>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent id={contentId} className="w-(--anchor-width) p-0">
          <Command>
            <CommandInput placeholder="Search voices..." />
            <CommandList>
              <CommandEmpty>No voice found.</CommandEmpty>
              <CommandGroup>
                {voices.map((voice) => (
                  <VoicePickerItem
                    key={voice.voiceId}
                    voice={voice}
                    isSelected={value === voice.voiceId}
                    onSelect={() => {
                      onValueChange?.(voice.voiceId!)
                    }}
                  />
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </AudioPlayerProvider>
  )
}

interface VoicePickerItemProps {
  voice: ElevenLabs.Voice
  isSelected: boolean
  onSelect: () => void
}

function VoicePickerItem({
  voice,
  isSelected,
  onSelect,
}: VoicePickerItemProps) {
  const [isHovered, setIsHovered] = React.useState(false)
  const player = useAudioPlayer()

  const preview = voice.previewUrl
  const audioItem = React.useMemo(
    () => (preview ? { id: voice.voiceId!, src: preview, data: voice } : null),
    [preview, voice]
  )

  const isPlaying =
    audioItem && player.isItemActive(audioItem.id) && player.isPlaying

  const handlePreview = React.useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (!audioItem) return

      if (isPlaying) {
        player.pause()
      } else {
        void player.play(audioItem)
      }
    },
    [audioItem, isPlaying, player]
  )

  return (
    <CommandItem
      data-checked={isSelected}
      value={voice.voiceId!}
      keywords={[
        voice.name,
        voice.labels?.accent,
        voice.labels?.gender,
        voice.labels?.age,
        voice.labels?.description,
        voice.labels?.["use case"],
      ].filter((k): k is string => Boolean(k))}
      onSelect={onSelect}
      className="flex items-center gap-3"
    >
      <div
        className="relative z-10 size-8 shrink-0 cursor-pointer overflow-visible"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handlePreview}
      >
        <Orb
          agentState={isPlaying ? "talking" : undefined}
          className="pointer-events-none absolute inset-0"
        />
        {preview && isHovered ? <div className="pointer-events-none absolute inset-0 flex size-8 shrink-0 items-center justify-center rounded-full bg-bg-neutral-bold text-text-inverse transition-opacity">
            {isPlaying ? (
              <Pause className="size-3" />
            ) : (
              <Play className="size-3" />
            )}
          </div> : null}
      </div>

      <div className="flex flex-1 flex-col gap-0.5">
        <span className="font-medium">{voice.name}</span>
        {voice.labels ? <div className="text-text-subtle flex items-center gap-1.5 text-xs">
            {voice.labels.accent ? <span>{voice.labels.accent}</span> : null}
            {voice.labels.gender ? <span>•</span> : null}
            {voice.labels.gender ? <span className="capitalize">{voice.labels.gender}</span> : null}
            {voice.labels.age ? <span>•</span> : null}
            {voice.labels.age ? <span className="capitalize">{voice.labels.age}</span> : null}
          </div> : null}
      </div>

      <Check
        className={cn(
          "ml-auto size-4 shrink-0 text-icon-subtle [&_svg]:text-icon-subtle!",
          isSelected ? "opacity-100" : "opacity-0"
        )}
      />
    </CommandItem>
  )
}

export { VoicePicker, VoicePickerItem }
