# Ruler interaction acceptance

Source: `/Users/esoh/Desktop/marks.mov`, 26.36 seconds, 1494 × 264 at 120 fps. Reviewed the full contact sheet at 0, 2, 4, …, 26 seconds and the frame at 12 seconds. Public implementation inspected on 1 November 2026: `https://www.pengzhe.ng/#timeline`, `StripTimeline.astro_astro_type_script_index_0_lang.Byc5GA7a.js` and `strip-physics.BgFN69bD.js`.

The recording uses a horizontal ruler with a common baseline, varied short strokes, a local proximity wave, and an orange stroke occupying a real ruler mark. The source uses a 20px engagement zone with a further 26px approach range; tick lengths grow from 8px to roughly 32px at the wave center. Pointer pull, hover scale and settling share one motion state. A selected stroke is never drawn as an extra line between ticks.

Adaptation: keep the user's right-side vertical rail, 1px stroke thickness, yellow-orange accent, right-edge anchor, chapter names, synchronized text, single image preview and explicit Frames gallery. The latest correction retains only evenly spaced normal marks and removes faint subdivisions and extra chapter inserts. Chapter timing maps independently to this uniform grid. The native 44px input remains stationary while the decorative ruler expands vertically. Exact model time remains continuous; only the visual indicator chooses a ruler tick.

| Beat | Acceptance |
| --- | --- |
| Rest | One orange tick in the existing grid; no independent overlay or doubled row. Crisp 1px strokes share the same right anchor. |
| Approach | Scaling begins before the pointer reaches the native input. Strength increases continuously over the approach range. |
| Engage | Local lengths and opacity follow distance from the pointer. Magnetic lean is bounded to 8px horizontally and 3px vertically. |
| Move | The wave reverses from its current position. Native scrubbing preserves exact authored time and matching text. |
| Leave / cancel | Field settles to exact rest; temporary chapter text and illustration restore together. No idle frame loop remains. |
| Keyboard / touch | Existing native range and Frames controls continue to work; no touch hover magnet. |
| Motion off | Active color and chapter updates remain; magnetic translation and wave scaling stay off. |

The offline builder inlines the shared VPK `resolveMagneticAxisOffset` function from `components/ui-custom/hooks/magnetic-proximity-model.ts`. The timeline's spring uses the existing Awake GlassSlider hover response (stiffness 260, damping 22, mass 0.55). This keeps the source module as the owner of bounded magnetic normalization without adding React or network dependencies to the HTML.
