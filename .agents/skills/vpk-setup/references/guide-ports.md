# Port Selection and 409 Recovery

How the Rovo pool behaves in multiport mode. For how the launchers lay out services and assign per-worktree port slots, see [Runtime Topology and Ports](runtime-topology.md).

## Runtime Model

```text
Interactive thread      → stick to the last successful healthy port
Stuck / unhealthy port  → mark unhealthy, quarantine briefly, fail over
Background helper turn  → avoid the active interactive port when possible
```

Each `rovo serve` instance is still single-threaded for chat. A second turn on the same instance while the previous one is active returns HTTP 409.

## What Changed

### 1. Linked worktrees now get their own base port

The worktree detector now reads actual `.git` metadata instead of assuming only paths containing `/worktrees/` are linked worktrees. A linked checkout like `plan-mode` therefore resolves to its own base slot instead of falling back to `8000`.

Each worktree slot now spans 20 ports per service family. That means one worktree can use a 6-port Rovo pool and still leave room for port auto-increment without overlapping the next worktree's reserved range.

### 2. The pool is sticky, not round-robin

Sequential turns do not rotate evenly across all ports. The pool prefers the last successful port for a given interactive thread, which preserves session affinity and keeps follow-up turns on the same healthy instance.

### 3. Failures trigger failover instead of snap-back

When a port is reported stuck or unhealthy, the backend marks it as failed for that thread and the pool quarantines it briefly. The next turn prefers a different healthy port if one exists.

### 4. Background helper turns avoid the active interactive port

Follow-up text generation that happens alongside an interactive turn can pass `avoidPorts` so it does not immediately reuse the currently active chat port when the pool has alternatives.

### 5. Release still uses a readiness gate

Released ports enter cooldown and are probed before they become available again. That prevents immediate reacquire while rovo serve is still clearing the prior turn.

## Request Flow

1. A thread sends its first interactive message.
2. The pool acquires the preferred port if one is known and healthy; otherwise it picks the first healthy available port.
3. On success, that port becomes the thread's preferred port.
4. If the port hits a stuck-turn path or health failure, the thread marks that port as failed.
5. The next interactive turn avoids the failed port and fails over to another healthy port.
6. After a successful failover, the new port becomes the thread's preferred port.

## Debugging

Check `/api/health` for both:

- `worktreePorts`
- `rovoPool`

The pool payload includes each port's `status` and `quarantinedUntil` timestamp when applicable.

If a thread keeps falling back to the same bad port:

1. Confirm the checkout resolved to the expected worktree slot via `worktreePorts`.
2. Confirm the bad port enters `unhealthy` state and receives a `quarantinedUntil` value.
3. Confirm another pool port is actually healthy.
4. If every port is unhealthy, restart the tmux stack or the affected fixed-port supervisor.
