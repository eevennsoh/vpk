# CI timing and coverage

`ci.yml` runs static validation alongside four sequential directory-batch unit
shards. `PR checks` always evaluates both jobs and succeeds only when static
validation and **every** matrix shard succeed. Matrix fail-fast is disabled so
one failure does not cancel the remaining coverage. Local `pnpm run ci:pr` and
unsharded `pnpm run test:unit:js` keep their full coverage.

The committed `scripts/js-unit-test-timings.json` records `[file count, seconds]`
per batch: the median of three aligned successful cached GitHub Ubuntu / Node 24
audits (`2073-final`, `2074-first`, `2074-final`). Each audit selected 1,328 test
files in 272 batches. Summed batch durations were 742.72, 764.53 and 735.60 seconds;
observed unit-step time was 747–777 seconds. These are measurements of the old
serial workflow. Observed ESLint was 170–182 seconds, guards 17 seconds, design
lint 11–12 seconds, types 19–21 seconds and setup 70–85 seconds.

Assignment sorts batches by descending estimated duration, breaks ties by batch
identity, and puts each in the lightest shard (ties choose the lowest shard
number). VM-module suites retain isolated batches and their Node flags. Changed
batch sizes scale their historical duration per file; new batches use one second
per file until measured. Nothing is selected by changed paths. Every shard runs
the unfiltered manifest checks before selecting its batches.

With the new workflow regression suite, selection is 1,329 files in 272 batches:

| Shard | Batches | Files | Historical-weight estimate (seconds) |
| --- | ---: | ---: | ---: |
| 1/4 | 51 | 107 | 186.36 |
| 2/4 | 73 | 568 | 186.36 |
| 3/4 | 74 | 272 | 186.41 |
| 4/4 | 74 | 382 | 186.35 |

These are balancing estimates, **not measured hosted runtimes or a speedup**.
Runner scheduling, five installations, resource contention, cache availability
and subsequent suite growth affect latency. The 5–7 minute target needs a real
hosted run; this implementation does not launch one.

The work-item directory remains the indivisible 173–184 second batch. Skill
batches cost 160–164 seconds in total; the HTML anatomy batch alone was about
52 seconds. Those and the remaining lint/setup costs are future measurement
targets. This change does not rewrite those suites or raise local concurrency.

Each execution prints selected counts, batch identity, file count, elapsed
seconds, exit status and a slowest-ten summary (including on failure). Refresh
weights only from comparable successful runs, match VM batches by file and other
batches by directory, and retain the coverage/manifest tests when rebalancing.

Both ESLint commands use content validation and separate cache files under
ignored `node_modules/.cache/eslint/`. CI restores only a prefix matching the OS,
Node major, lockfile, package scripts, ESLint configuration and suppression
ledger; a unique run key saves the refreshed cache. Source edits are validated
by content, even when their size and mtime are unchanged. The workflow tests
exercise that case and all 25 aggregate result combinations.
