# Open Studio

Open Studio lets a user reach the Studio agent-builder shell, see the home starters, and find the composer without sending a message to Rovo.

## Sub-features

- `studio-open` loads `/studio`.
- `studio-composer` shows the Message textbox with placeholder `Describe the agent you want to build`.
- `studio-starters` shows home prompt starters, including `Browse all agents`.

## How to get to it (user POV)

- Open `/studio`.
- From the projects catalog, choose the `Studio` card title (`a[href='/components/projects/studio']`) then use the live app at `/studio` — the card is the catalog entry; the product shell is `/studio`.

## Driving it with control-vpk

Preconditions:

- `pnpm control-vpk doctor` reports `"ok": true` for this worktree.
- Do **not** require backend unless you intend to send a message (out of scope here).
- Evidence directory `output/agent-browser/vpk-verify/studio-shell/` exists.

- **Open Studio.** Open the product route. Run `pnpm control-vpk browser open "$ORIGIN/studio"`. The URL contains `/studio`.
- **Composer.** The Message textbox is present. Run `pnpm control-vpk browser find role textbox text --name Message`. Overlay placeholder copy is `Describe the agent you want to build` (not a native `placeholder` attribute).
- **Starters.** A control named `Browse all agents` is present. Run `pnpm control-vpk browser find role button text --name "Browse all agents"`. Default home starters are Planning tiles (for example `Use prompt starter: Decision Director`). `Use prompt starter: Customer Insights` appears only after the Insights category is selected or the home cycle reaches it — not because the viewport is wide.
- **Do not send.** Do not press `Submit` / Enter in the composer. A send is not this feature.
- **Proof.** Run `pnpm control-vpk browser snapshot -i --compact --depth 8 > output/agent-browser/vpk-verify/studio-shell/home.aria.txt` and `pnpm control-vpk browser screenshot output/agent-browser/vpk-verify/studio-shell/home.png`. Artifacts show `/studio`, the Message field, and `Browse all agents`.

## Gotchas

- `/components/projects/studio` is the catalog doc, not the Studio app. The app is `/studio`.
- A loaded shell is not proof that Rovo Serve or ASAP works. `doctor --require-backend` plus a real send is a different feature, not claimed here.
- Home starters follow the active category (default Planning) and a 6s auto-cycle. `Browse all agents` and the Message field are the stable handles.
- Presence checks must use `find role … text --name`. A bare `find role … --name` is not a valid agent-browser command.
- Onboarding tours or dialogs can intercept the first visit. Dismiss them (Escape or their close control) rather than clicking through a starter, which prefills the composer.
