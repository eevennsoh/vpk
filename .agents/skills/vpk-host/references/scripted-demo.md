# Scripted static demos on Statlas

Use this workflow when the user has agreed to replace backend-dependent
prototype interactions with scripted behavior. Statlas serves static files;
an export can render correctly while a later interaction fails on `/api/*`.
Do not infer agreement merely from a request to host a prototype. Once the user
has authorized a scripted variant, proceed within that scope without asking again.

## Audit the actual experience

1. Identify the current source and hosted versions, route, gallery views and
   entry points. Inspect the import trace, client-side calls and state owners;
   a backend route count of zero does not establish runtime independence.
2. Exercise representative paths in both versions and record a matrix: view,
   trigger, backend dependency, expected visible result, scripted replacement,
   state lifetime, and verification status. Include delayed and conditional
   actions, follow-up replies, session switching, edits, creation, file or
   workspace access, voice, and links outside the extract when applicable.
   Capture network and console errors while interacting, not just initial load.
3. Trace a missing result through the entire chain. For example, a scripted
   reply may still wait for server thread creation; the answer must update the
   transcript, session status and associated work item together. Account for
   cancellation, switching and re-opening so state is not lost or applied to
   the wrong session.

## Adapt deliberately

- Reuse existing scripted scenarios and state transitions. Put the replacement
  at the canonical behavior owner and gate it to the authorized static build,
  preserving the normal backend-backed experience. Avoid a fake API server,
  unrelated backend, credentials in client bundles, or an unmarked simulation.
- Choose and document state lifetime: in-memory state survives only while its
  owning app remains mounted; persistence across reloads needs an explicit,
  appropriate client-side design. Preserve each session's history during
  switches and distinguish demo-created entities from real ones.
- Make simulated device or external actions clear in the UI. For example, a
  sample dictation is not microphone transcription and a demo workspace is not
  access to local files or a terminal. Keep such labels accurate and accessible.
- Cover every reachable requested backend-dependent action, or record it as a
  remaining gap. A generic canned response is not evidence of real AI or of
  parity with a scenario-specific conversation.
- If adapting an extraction, copy the exact selected source changes, including
  new files, into the target; preflight missing files and preserve unrelated
  target config. Record baseline revision, dirty state, changed source hashes,
  build flags and extraction adaptations. Rebuild after the final change.

## Prove and report

Run relevant regression tests and the source and target checks. Serve the
finished export at the exact hosted prefix; verify the preview resolves to that
export and compare its entry hash, because a stale symlink can show an older
build. Exercise the matrix, including answer, status and card movement, session
switch/reopen, normal follow-up and each simulated device or creation path that
exists. Check requests for unexpected backend calls and verify labels and
accessibility. Test ordinary backend mode when shared code changes.

After publishing assets before HTML, compare the served entry hash to the
verified export, check representative assets, and repeat key interactions on
the actual hosted URL in a fresh browser. Capture evidence and report what was
observed, any checks that failed, untested paths, state lifetime and real
integration limitations. Do not call the entire experience scripted or verified
when the matrix still has gaps.
