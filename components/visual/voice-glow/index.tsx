"use client";

// Imported runtime: https://libraries.dev/voice (voice-glow 0.2.0, MIT).
// Keep the upstream API intact; VPK supplies the catalog name and demos.
export { VoiceBeam as VoiceGlow, VoiceBeam as default } from "voice-glow";
export * from "voice-glow";
export type { VoiceBeamProps as VoiceGlowProps } from "voice-glow";
