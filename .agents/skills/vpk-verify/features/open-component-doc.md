# Open a component doc

Open Accordion documentation directly to inspect its hero and breadcrumb; separately verify its UI catalog title link when that entry path is requested.

## Sub-features

- `doc-open-direct` opens `/components/ui/accordion` directly for component debugging.
- `doc-open-card` opens `/components/ui/accordion` from the Accordion catalog link.
- `doc-hero` shows the Accordion heading, breadcrumb, and Import section.
- `doc-breadcrumb` returns to `/` (projects home) from the breadcrumb `Components` link.

## How to get to it (user POV)

- From `/ui`, choose the `Accordion` card title.
- Open `/components/ui/accordion` directly.
- From the doc, choose `Components` in the breadcrumb. That link always goes to `/`, not `/ui`.

## Driving it with control-vpk

Preconditions:

- `control-vpk doctor` reports `"ok": true` for this worktree.
- The direct object route `/components/ui/accordion` is mapped. Use `/ui` only for explicit catalog-title entry verification.
- Evidence directory `output/agent-browser/vpk-verify/open-component-doc/` exists.

- **Open directly.** Run `control-vpk open-target /components/ui/accordion`. `control-vpk browser get url` contains `/components/ui/accordion`.
- **Catalog entry (only when requested).** Run `control-vpk browser open "$ORIGIN/ui"`; on `/ui`, choose Accordion by href. Run `control-vpk browser click "a[href='/components/ui/accordion']"`. `control-vpk browser get url` contains `/components/ui/accordion`.
- **Confirm hero.** The page shows heading `Accordion`, navigation named `Breadcrumb` containing `Components`, `UI`, and `Accordion`, and heading `Import`. Run `control-vpk browser find role heading text --name Accordion` and `control-vpk browser find role heading text --name Import`.
- **Breadcrumb back.** Choose the breadcrumb `Components` link by href, not by the bare name `Components`. Run `control-vpk browser click "nav[aria-label='Breadcrumb'] a[href='/']"`. `control-vpk browser get url` is `$ORIGIN/` (projects home), not `/ui` and not the Accordion doc.
- **Proof.** Recapture the Accordion doc after reopening it if breadcrumb left the page. Run `control-vpk browser snapshot -i --compact --depth 8 > output/agent-browser/vpk-verify/open-component-doc/accordion.aria.txt` and `control-vpk browser screenshot output/agent-browser/vpk-verify/open-component-doc/accordion.png`. Both artifacts show `Accordion` and `Import`.

## Gotchas

- Several Accordion links can exist (sidebar + card). Prefer `a[href='/components/ui/accordion']`.
- The doc `h1` is `Accordion`. The Import section heading is `Import`, not `Installation`.
- `/ui` cards use inline previews (iframes are for other categories). Click the title link, or `open` the doc URL as the direct entry point and say so in the artifact notes.
- Breadcrumb `Components` always goes to `/`. `find role link click --name Components` can report success without leaving the doc. Use `nav[aria-label='Breadcrumb'] a[href='/']`.
- Re-open `/ui` before proving another catalog click.
