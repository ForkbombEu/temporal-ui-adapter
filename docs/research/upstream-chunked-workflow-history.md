# Upstream chunked workflow history loading

**Date:** 2026-10-01  
**Upstream pin:** `v2.54.1` (`upstream/` submodule)  
**Question:** How does Upstream Temporal Web UI load history (and related data) dynamically for large workflow runs, and what does that mean for the Adapter / Host (credimi)?

## Verdict

Upstream paginates Temporal history with `nextPageToken`, racing **ascending and descending** cursors in parallel (up to 1000 events/page), pausing after the first two pages so the UI can paint bookends, then filling the middle. Live runs also long-poll for new events.

That orchestration lives in the **Upstream app shell** (`workflow-run-layout`), **not** in the Adapter’s `WorkflowHistory` component. The Adapter is presentational: Host passes `execution` + `history[]`. Credimi today fetches the **entire** history server-side in one response and blocks page load on it.

## Upstream: how it works

### Orchestrator

[`upstream/src/lib/layouts/workflow-run-layout.svelte`](../../upstream/src/lib/layouts/workflow-run-layout.svelte) owns the run page. On open it:

1. Fetches workflow execution (`fetchWorkflow`) — status, pending activities, `historyEvents` count, etc.
2. Fetches pollers / optional worker count / metadata
3. Resets the grouped event buffer
4. Starts history fetch + (if running) live poll

### Bidirectional page fetch

Core: [`upstream/src/lib/services/fetch-bidirectional.ts`](../../upstream/src/lib/services/fetch-bidirectional.ts)

| Direction   | API route (via `routeForApi`) | Order            |
|-------------|-------------------------------|------------------|
| Ascending   | `.../history`                 | oldest → newest  |
| Descending  | `.../history-reverse`         | newest → oldest  |

Wiring from the layout ([`workflow-run-layout.svelte`](../../upstream/src/lib/layouts/workflow-run-layout.svelte)):

- `maximumPageSize: 1000`
- `pauseAfterPages: 2` — after first asc + first desc pages, both cursors pause
- Each page → `onRawPage` → `ingestHistoryEvent` into [`grouped-event-buffer`](../../upstream/src/lib/services/grouped-event-buffer.ts)
- When the gap between cursors is ≤ one page, one side aborts (winner) to avoid overlap

Routes: [`upstream/src/lib/utilities/route-for-api.ts`](../../upstream/src/lib/utilities/route-for-api.ts) (`events.ascending` / `events.descending`).

### Progressive UX

1. Pause after two pages → oldest + newest bookends available quickly
2. History / timeline layouts call `historyCtx.resume()` on mount ([`workflow-history-layout.svelte`](../../upstream/src/lib/layouts/workflow-history-layout.svelte), [`workflow-timeline-layout.svelte`](../../upstream/src/lib/layouts/workflow-timeline-layout.svelte))
3. Context API: [`upstream/src/lib/contexts/history-context.ts`](../../upstream/src/lib/contexts/history-context.ts) — `fetchComplete`, `totalExpectedEvents`, `descMinId`, `resume()`
4. Views update as pages land; buffer uses slot array indexed by `eventId - 1` and lazy group materialization

### Live updates (running workflows)

[`upstream/src/lib/services/live-poll.ts`](../../upstream/src/lib/services/live-poll.ts): long-poll with `waitNewEvent=true`, appends into the same buffer (deduped against the bidirectional fetch). Pause auto-refresh aborts the poll and resumes from the last token.

### Older unidirectional path

[`fetchAllEvents`](../../upstream/src/lib/services/events-service.ts) + [`paginated`](../../upstream/src/lib/utilities/paginated.ts) still follow a single direction’s `nextPageToken` until done. Used for raw/JSON / archival / some standalone pages — **not** the main run page path.

There is also a duplicate bidirectional implementation in `events-service.ts` (`fetchAllEventsBidirectional`); the layout uses `fetch-bidirectional.ts`.

## Adapter: out of scope for fetch orchestration

Per [`CONTEXT.md`](../../CONTEXT.md): **Host owns routing, data fetching, and mutations.** Adapter turns Upstream into a stable Host API.

[`src/workflow-history.svelte`](../../src/workflow-history.svelte):

- Props: `execution`, `history: HistoryEvent[]`, `namespace`, optional `workers`
- Stubs `HISTORY_CTX` with `fetchComplete: true` and no-op `resume()`
- Ingests whatever `history` array the Host passes into the buffer and renders timeline/history layouts

Example Host usage: [`examples/consumer/src/routes/+page.svelte`](../../examples/consumer/src/routes/+page.svelte) — static fixtures, no fetch.

**Conclusion:** chunked loading is not Adapter behavior today. Progressive UX indicators from Upstream (`fetchComplete`, skeletons, resume) will not work until the Host contract is extended.

## Credimi (Host) today

Observed in DIDimo / credimi webapp:

| Layer | Behavior |
|-------|----------|
| Backend | `HandleGetMyWorkflowRunHistory` drains Temporal Go client `GetWorkflowHistory` iterator and returns one JSON `{ history: [...] }` ([`workflows_handlers.go`](../../../DIDimo/pkg/internal/apis/handlers/workflows_handlers.go)) |
| Load | [`+layout.ts`](../../../DIDimo/webapp/src/routes/my/tests/runs/[workflow_id]/[run_id]/+layout.ts) awaits `fetchWorkflowExecution` **and** full `fetchWorkflowHistory` before render |
| Client | [`queries.ts`](../../../DIDimo/webapp/src/lib/workflows/queries.ts) `fetchWorkflowHistory` — single GET, parse full array |
| UI bridge | iframe / postMessage or store write of complete `eventHistory` ([`temporal/+page.svelte`](../../../DIDimo/webapp/src/routes/my/tests/runs/[workflow_id]/[run_id]/temporal/+page.svelte), [`temporal-workflow.svelte`](../../../DIDimo/webapp/src/routes/my/tests/runs/[workflow_id]/[run_id]/temporal/temporal-workflow.svelte)) |

No `nextPageToken`, no bidirectional fetch, no live-poll loop on the Host side.

## What credimi would need for Upstream-like behavior

### 1. Paged history API (backend)

Stop returning the full drain. Expose something like:

- Query: `nextPageToken`, `maximumPageSize`, `order` (`ascending` | `descending`)
- Response: `{ history, nextPageToken }`

(Or two endpoints mirroring Upstream’s forward / reverse history routes.)

Without this, the browser cannot stream chunks; the server already paid the full cost.

### 2. Frontend fetch orchestration (Host)

Replace the one-shot load:

1. Load **execution** first → render with `[]` or first page
2. Fetch history in pages (optionally both directions)
3. Accumulate into a growing `history` array; re-pass as Adapter prop
4. Optionally long-poll / refresh while status is `Running`

That is the Upstream `fetchBidirectional` + pause/resume logic, owned by credimi (or a shared Host helper) — not by the Adapter.

### 3. Adapter contract as it exists

Minimum: pass the **growing** array; `$effect` re-ingests.

Upstream-parity UI (loading skeletons, `resume`) needs Host contract extensions, e.g. `fetchComplete` / progress props.

### Effort tiers

| Tier | Scope |
|------|--------|
| Minimum useful | Paged history API + client loop appending pages into the prop |
| Upstream parity | Bidirectional pages + early bookends + live poll + Adapter loading/progress props |

## Source map

| Claim | Primary source |
|-------|----------------|
| Layout owns fetch + pauseAfterPages: 2 | `upstream/src/lib/layouts/workflow-run-layout.svelte` |
| Bidirectional cursors + page tokens | `upstream/src/lib/services/fetch-bidirectional.ts` |
| History context / resume | `upstream/src/lib/contexts/history-context.ts` |
| Live long-poll | `upstream/src/lib/services/live-poll.ts` |
| Unidirectional paginate helper | `upstream/src/lib/utilities/paginated.ts`, `events-service.ts` |
| Adapter is props-in, no fetch | `src/workflow-history.svelte`, `CONTEXT.md` |
| Credimi full-history API | DIDimo `pkg/internal/apis/handlers/workflows_handlers.go` |
| Credimi one-shot load | DIDimo `webapp/.../+layout.ts`, `webapp/src/lib/workflows/queries.ts` |
