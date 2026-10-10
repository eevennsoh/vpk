# Statlas commands and troubleshooting

Source guidance read on 2026-10-05:

- [Statlas: How to Host Static Files on Atlassian's CDN](https://hello.atlassian.net/wiki/spaces/~7120205beb314d6ea948a58c4defce84107861/blog/2026/09/13/7772900838/Statlas+How+to+Host+Static+Files+on+Atlassian+s+CDN), Arpan Gupta, updated September 13, 2026.
- [Deploying a Prototype/App to Statlas](https://hello.atlassian.net/wiki/spaces/~701219e72425b21f84502bfbf45eab86c7fbd/pages/7129569663/Deploying+a+Prototype+App+to+Statlas), Guru Kallubhavi, displayed update June 15. Its examples use Vite.
- Next.js documentation installed with VPK, specifically
  `node_modules/next/dist/docs/01-app/02-guides/static-exports.md` and
  `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/basePath.md`.

The sources disagree on some CLI flags and ZIP reliability. Statlas plugin
1.1.19 help was verified on 2026-10-08. Read live help before an actual run;
do not guess replacements for rejected flags.

## CLI and authentication

Start with read-only inspection:

```bash
atlas statlas --help
klist
```

Resolve and retain the Atlassian executable before changing directories.
This machine also has the unrelated Ariga database CLI at
`/opt/homebrew/bin/atlas`; changing the working directory can change which
binary a bare `atlas` selects. `/opt/atlassian/bin/atlas` is the verified
Atlassian executable here. Use its absolute path for uploads from the archive
directory. A missing `statlas` command in the Ariga CLI is not a Statlas upload
or authentication failure.

When hosting requires the missing official plugin, install it with the Atlas
plugin command supported by local help:

```bash
atlas plugin install -n statlas
```

Inspect the relevant command help, for example:

```bash
atlas statlas auth set --help
atlas statlas auth get --help
atlas statlas post --help
atlas statlas put --help
atlas statlas list --help
atlas statlas head --help
```

The prototype guide reports that expired Kerberos tickets can cause silent
upload hangs and 403 responses. Check `klist`; if a ticket needs renewal, let
the user complete the password prompt without putting credentials in commands
or logs. The guide's renewal command is:

```bash
kinit <actual-atlassian-id>@OFFICE.ATLASSIAN.COM
```

Do not run `atlas auth login` as a substitute. A 403 can also mean the wrong
Slauth group or recently created group membership that has not propagated.
Avoid repeated uploads while diagnosing the same authentication failure.

## Namespace permissions

Discover existing access before asking the user to name a group:

```bash
twg statlas auth status
atlas rollcall person --person <staff-id> --groups --output json
atlas rollcall group --group <project-group> --output json
```

The TWG status command is optional when TWG is installed. Treat saved namespace,
group, and prefix values as hints: they may belong to another user. Inspect only
the relevant directory membership fields. For an existing Micros prototype,
`atlas micros service show` identifies its owner and authorization container;
verify the actual project administrator group with Rollcall. Reusing that
verified group for a new project namespace avoids creating a directory group.

```bash
atlas statlas auth get --namespace <namespace>
atlas statlas list --namespace <namespace> --subdirectory <project>/
```

The September guide creates a namespace with:

```bash
atlas statlas auth set --namespace <namespace> --auth-group <group>
```

The prototype guide instead supplies an explicit owner and group:

```bash
atlas statlas auth set -n <namespace> -o <owner-group> -g <publishing-group>
```

Use the installed help to resolve that difference. Preserve any existing
namespace and grants. Ask for missing ownership/group choices; do not create
an AD group or widen access just to make publishing succeed. New membership
can take time to propagate; the prototype guide reports 5 to 10 minutes.

Plugin 1.1.19 supports explicit `--owner`, `--groups`, and `--auth-group`.
After confirming an unused namespace and the user's membership in the selected
project group, create its initial owner and publishing grant with:

```bash
atlas statlas auth set --namespace <namespace> --owner <owner-group> \
  --groups <publishing-group> --auth-group <verified-member-group>
atlas statlas auth get --namespace <namespace>
```

Namespace permissions govern upload/delete access. The September guide says
files are publicly accessible within the Atlassian network without additional
viewer authentication. Do not describe a namespace as a private share or
promise customer access outside that network without verifying it.

## ZIP upload

Use a new archive filename on every packaging attempt. `zip` updates an
existing archive and can retain files removed from a later export.
From inside the reviewed export directory:

```bash
zip -qr /absolute/project/output/statlas/site-<release>.zip . -x '*.DS_Store'
unzip -Z1 /absolute/project/output/statlas/site-<release>.zip
shasum -a 256 /absolute/project/output/statlas/site-<release>.zip
```

Review the source directory first. `zip` does not automatically exclude
dotenv files, Git metadata, credential files, symlink targets, or source maps.
Do not include them accidentally. Local evidence stays outside the export.

Then change to the archive's containing directory and use its basename:

```bash
atlas statlas post \
  --file site-<release>.zip \
  --namespace <namespace> \
  --subdirectory <project>/ \
  --auth-group <group>
```

`post` unpacks the ZIP, according to the September guide. Omit the
`--subdirectory` option when publishing at namespace root. Include all
exported files rather than only `index.html` and obvious JS/CSS assets.
The prototype guide warns that ZIP uploads can hang. Check auth and remote
state once, then choose a deliberate retry or individual-file fallback.
Do not repeat a failed upload indefinitely.

The live service rejected ZIP objects over 250 MB on 2026-10-08 with HTTP 413.
For a larger reviewed export, make fresh independent ZIPs below that limit,
each retaining the original export-relative paths. Verify their combined file
inventory matches the selected export. Upload assets and navigation payloads
first and HTML in the last archive. Do not use byte-split ZIP fragments, which
cannot be unpacked independently. Retain a checksum and completion record for
each part so interrupted publication can resume without guessing remote state.

## Individual-file fallback

For each file, run `put` from its containing directory and give a complete
destination path, preserving the export's relative layout. For example, when
the local file is `out/3p/icons/example.svg`, change into `out/3p/icons/`:

```bash
atlas statlas put \
  --file example.svg \
  --namespace <namespace> \
  --subdirectory <project>/3p/icons/example.svg \
  --auth-group <group>
```

Upload non-HTML assets and Next navigation payloads first, then HTML files,
with the main entry last. Stop on a failure and report the partial state.
Preserve older hashed assets during an update so already-open clients can
continue loading their chunks. Uploading HTML first, as the Vite guide's sample
script does, can expose references to assets that do not exist yet.

For a single finished HTML file, run from its containing directory:

```bash
atlas statlas put --file index.html --namespace <namespace> \
  --subdirectory <project>/index.html --auth-group <group>
```

The guide warns that local paths can leak into remote paths. Using a basename
from the containing directory avoids accidental `/tmp/` or `out/` prefixes.
With a trailing `/` in `--subdirectory`, the original filename is appended.

## Verify the remote files

```bash
atlas statlas list --namespace <namespace> --subdirectory <project>/
atlas statlas head --namespace <namespace> --subdirectory <project>/index.html
curl -I 'https://statlas.prod.atl-paas.net/<namespace>/<project>/index.html'
```

Use exact selected paths, replacing the examples above. Check HTML bytes,
asset MIME types, and the live browser experience. Verify `/.../` and nested
route reloads separately; `index.html` is the explicit documented entry form.
Use bounded retries for propagation/cache evidence and report stale content
when the served release cannot be established. No cache invalidation command
or atomic upload guarantee was verified from these sources.

The September guide lists `--lifecycle temporary|month` and `--metadata/-m`
for uploaded files. Inspect live help for the selected upload command before
using them. Confirm the user's intended expiry and do not infer a default TTL
or guarantee that it applies recursively to ZIP entries.

Deletion is separate. File deletion triggers CPRS peer review, followed by
rerunning the exact delete with its returned `--reviewId`. Namespace deletion
permanently removes the namespace and all files. A hosting request authorizes
neither deletion nor bypassing CPRS.
