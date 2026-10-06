# Update to Rovo Stage Kit 1.3.0

Copy everything below the line into the coding agent that integrated the kit before.

---

Update the Rovo Stage Kit in this codebase from 1.2.0 to 1.3.0. The new kit is in this folder, beside this file.

1. **Replace the kit whole.** Swap the old kit folder (or package) for this one; don't merge files by hand. If it's installed as a local package, reinstall it.
2. **Swap the stage file.** Replace the app's `rovo-stage.json` with this kit's `rovo-stage.json`. Other stages are in `stages/` if the app shows more than one; see `CHANGELOG.md`.
3. **Leave the integration alone.**
    - The API and the stage file format are unchanged, so integration code should not need to change.
    - If the app lists pieces by id (from `pieces.json` or `PIECES`), the 23 new ones in `CHANGELOG.md` are now available.
    - If the app lays pieces out itself (the organic layout or the masonry), add the new ones to its list. Their sizes come from `pieces.json` like the others: `w × scale`, never stretched.
    - Never restyle the pieces.
4. **Check your work.** Read `GUIDE.md` → "Check your work" again: render the frames in `reference/` (`reference/reference.json` says how) and compare. Expect under 0.1 % of pixels to differ by more than 8/255.
5. **Report back** with a screenshot of the stage, and of two of the new pieces (for example `agentSessions` and `costByModel`) through `RovoPiece`.
