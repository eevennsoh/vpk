# Voice Glow integration

Imported runtime: `voice-glow@0.2.0` by Jakub Antalik, MIT.
Source: https://github.com/Jakubantalik/Libraries.dev/tree/main/packages/voice-glow
Docs: https://libraries.dev/voice
Published artifact: https://registry.npmjs.org/voice-glow/-/voice-glow-0.2.0.tgz
SHA-1: `f49c6f1eceadf1b99741012c6c695aadcf808bf2`.

VPK exports `VoiceGlow` as a thin alias of `VoiceBeam`, preserving every
upstream prop and export. Existing VPK border glows and audio waveforms do
not supply this sound-reactive lobe/band geometry. No upstream source is
vendored. The MIT notice is retained in `LICENSE.md` for bundled distribution.

Version policy: Cautious (`~0.2.0`), since this is a new pre-1.0 effect engine.
The explicitly requested package first appeared on 2026-09-17, so its initial
release has an exact `minimumReleaseAgeExclude` entry. Future releases remain
subject to the seven-day maturity gate and pnpm trust checks.

## API and demo coverage

| Upstream surface | VPK disposition |
| --- | --- |
| `VoiceBeam`, default, props/types | `VoiceGlow` and default aliases; original names/types also re-exported |
| `useMicrophone`, options/result/state | Main demo’s explicit start/stop; never auto-started |
| `getAudioContext`, `isAudioSupported` | Re-exported for integrations; no separate GUI action required |
| `resolveVoiceDefaults`, `resolveVoiceStyle`, `themePresets` | Resolve GUI defaults from the selected preset/theme |
| `voiceDefaults`, `voiceTypePresets`, `voiceTypeStyle`, `voicePalettes`, `voiceLobes`, `LOBE_SPACING`, `LOBE_SPAN`, `parseRgb`, remaining types | Re-exported advanced data/utilities; palettes also seed custom color controls |
| `type`: default, pill, mobile | Main shape selector and dedicated pill/mobile examples |
| `stream`, numeric/getter `level` | Live microphone and manual-intensity slider; getter API documented for frequent updates |
| `active`, `paused`, `processing`, `bands`, `staticColors`, theme/palette | Interactive main controls; processing has a dedicated example |
| `colors`, `bandColors` | Optional seven-lobe palette and four band-color editors |
| Every `VoiceGeometry` member, response/color/clock props | Grouped numeric controls; test checks full geometry coverage and every preset’s bounds |
| `borderRadius` | Auto-detection by default; optional explicit-radius control |
| `css`, HTML attributes, style/ref, level/fade callbacks | Preserved and documented; arbitrary CSS/code editing is outside the GUI |

The canonical route is `/components/visual/voice-glow`; standalone preview:
`/preview/visual/voice-glow`. Demo auto-theme follows VPK’s active page theme;
upstream `theme="auto"` continues to mean the OS preference in consumer code.
Simulated voice is on by default in the main demo and pill/mobile examples.
It supplies speech-like phrases, syllables, and pauses through upstream’s
level getter, sampled by its existing driver with no additional frame loop or
React updates per frame. Manual intensity remains available when simulation
is disabled. Pause/offscreen gaps hold the simulation’s phase, and reset
restarts it. Reduced motion uses a constant level instead of the simulation.
The actual-microphone button switches simulation off before requesting access.
Manual intensity starts at 0.5 in the demo; upstream’s default is 0.

Upstream owns instance-scoped CSS, decorative canvases, one shared frame loop,
and reference-counted Web Audio sources. Audio is analyzed locally without
playback. Observers and analysis disconnect on unmount; the microphone hook
stops established tracks. A VPK demo guard stops permission requests completed
after reset/unmount and prevents overlapping requests (see below). Offscreen
instances stop analysis. Reduced motion stops decorative breathing, sideways
flow, hue drift, distortion, and processing travel while retaining the sound
meter response. Pause freezes the current frame. No compatibility wrappers
are added to rendering; verify these behaviors on package upgrades.

## Microphone request guard

In 0.2.0, `useMicrophone.start()` unconditionally adopts the result of
`getUserMedia`, even when stop/unmount happened during the permission prompt.
Reproduction: start with a pending prompt, reset or navigate away, then grant
permission. Upstream retains the late stream. The demo’s
`use-voice-glow-microphone.ts` invalidates that request and stops every track
on resolution, with focused asynchronous coverage in `data.test.ts`. The
demo only displays microphone errors while denied/error states are current;
reset and switching back to simulation hide errors from cancelled requests.
The browser suite covers delayed denial after reset as well as a current
denial followed by simulation. The
original upstream hook remains exported unchanged for API compatibility.
Remove the demo guard once upstream cancels late requests itself.

## Verification

- Full `pnpm run ci:pr` passed with the new unit suite discovered by the
  unfiltered runner. Final responsive adjustments passed targeted ESLint and
  `pnpm run typecheck` again.
- Six unit tests cover current microphone status, the bounded speech signal, clock/reset, preset/theme defaults, complete control coverage,
  GUI bounds, and release of late microphone results.
- `tests/visual/voice-glow.spec.ts`: rendered tests check simulated voice without
  microphone access, manual-mode/reset switching, and every
  shape at 1280px and 390px, pause/resume, processing travel, reset, and dark
  reduced motion. Surface and wrapper widths/positions must match; this guards
  the original mobile overflow and narrow-screen pill mismatch.
- Next.js `get_compilation_issues` and `get_errors` returned no issues/errors.
- Initial scoped axe audit: zero violations; color-contrast checks on some
  offscreen GUI controls were incomplete. ADS analysis MCP was unavailable.
- agent-browser initially rendered the catalog but repeatedly restored `/`
  during later commands. Playwright supplied the final rendered proof under
  `output/agent-browser/voice-glow/`; failed browser commands are not proof.
- Live physical microphone audio was not tested. Capture is opt-in; the
  permission-request cancellation path is covered with deferred test streams.

Reference comparison: `/Users/esoh/Desktop/voice.mov` (3.953s, 494 × 576,
120fps) shows a dark composer glow fading through a speech pause before
rising again. The previous demo’s fixed `level={0.5}` could not reproduce
that intensity change. The simulation supplies that changing input; host
content, the page-selected theme, and responsive demo sizes remain VPK
adaptations rather than a claim of pixel-identical video recreation.
