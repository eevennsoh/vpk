# Implementation Plan: Rename VPK-rovo to VPK

## Overview

Migrate the current Venn Prototype Kit repository from `vpk-rovo` to `vpk` across tracked source, documentation, local tooling, GitHub, saved Codex configuration, and development origins. Delete the unrelated repository currently occupying `eevennsoh/vpk` as explicitly requested. Preserve compatibility for persisted browser state, the Rovo response header, the external Bitbucket upstream, and Micros deployment identifiers until their independent migrations are proven.

## Architecture Decisions

- Permanently delete the unrelated `eevennsoh/vpk` repository after revalidating its exact identity.
- Use `VPK` for product prose and `vpk` for package, repository, directory, hostname, and machine identifiers.
- Treat `VPK` as the stable product brand, but derive mutable repository slugs, checkout directories, remotes, and development hosts from Git, package metadata, or the current working tree whenever possible. Use neutral wording such as "this repository" in prose.
- Introduce read-old/write-new compatibility for persisted local state and protocol headers.
- Connected-repository fixtures now use `vpk` and `https://bitbucket.org/atlassian/vpk`.
- Rename the Bitbucket repository to `atlassian/vpk` and update its remote. Micros service/image identity is `vpk`, with settings under SSM `/vpk/*`; new deployments use this canonical identity.
- Edit canonical `.agents` sources and regenerate symlinked/generated views rather than editing provider views independently.

## Task List

### Phase 1: Safety and reservation

- [x] Revalidate and permanently delete the existing private `vpk` repository.
- [x] Create the source migration branch from current `origin/main`.

### Phase 2: Tracked repository migration

- [x] Rename package, Portless, worktree, Symphony, UI fixture, and runtime identities.
- [x] Add compatibility handling for the old response header and remove obsolete browser-storage residue.
- [x] Update canonical documentation, agent skills, templates, and generated indexes.
- [x] Keep deployment identifiers transitional until replacement Micros infrastructure exists.

### Checkpoint: Source migration

- [x] Targeted runtime, worktree, Portless, Symphony, skill, and source-contract tests pass.
- [x] `pnpm run lint` and `pnpm run typecheck` pass.
- [x] Exhaustive scan contains only approved transitional or distinct-repository identifiers.

### Phase 3: Hosted and local cutover

- [ ] Land the source migration through protected GitHub review.
- [x] Rename `eevennsoh/vpk-rovo` to `eevennsoh/vpk` and verify protection, secrets, PRs, and redirects.
- [x] Rename `atlassian/vpk-rovo` to `atlassian/vpk`, verify SSH access, and update Git/LFS remotes.
- [ ] Move the persistent checkout to a chosen local directory and repair registered worktrees safely.
- [ ] Update the saved Codex project, existing automations, ignored local configuration, and Portless routes.

### Checkpoint: Complete

- [ ] `vpk.localhost` works and relevant UI routes compile.
- [ ] GitHub, local Git, Codex projects, and automations use the new identity.
- [ ] Any remaining old-name occurrences are listed with an external migration owner.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Existing `vpk` history is permanently lost | High | Proceed only under the user's explicit deletion instruction and revalidate the exact repository before deletion. |
| Tool-managed worktrees break after moving the common Git dir | High | Quiesce work, move the main checkout, run `git worktree repair`, and recreate managed worktrees where safer. |
| Persisted UI state disappears | Low | The old localStorage key is dead after the backend persistence migration; remove the stale constant instead of reintroducing browser storage. |
| Rovo producer still sends the old header | Medium | Prefer `x-vpk-port` and retain an `x-vpk-rovo-port` fallback. |
| Deployment fails after a string-only rename | High | Keep the old service/image/SSM identifiers until new Micros resources exist. |

## Open Questions

- Bitbucket was renamed manually and the new Secretive-backed SSH endpoint is verified.
- Micros service, Docker repository, and `/vpk/*` SSM stashes must be provisioned before the deployment identity can cut over.
