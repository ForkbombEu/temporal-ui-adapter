# Recreate `@forkbombeu/temporal-ui` from scratch

Agent playbook for the **derived-deps Kit root** architecture. Vocabulary: [CONTEXT.md](../CONTEXT.md). Decisions: [docs/adr/](./adr/) (incl. [0004](./adr/0004-derived-deps-kit-root.md)).

**Outcome:** Host-facing Package exporting only `WorkflowHistory` + `WorkflowStatus`; GitHub Release `.tgz`; pristine `upstream/`; develop toolchain installed at **repo root**.

**Global done:** `pnpm build` writes `package/` (no `routes/` leak); `pnpm dev` at `/` shows status badge + Timeline above Event History with populated Input/Result.

**How to use the packager:** do **not** reinvent it from prose. Transplant `scripts/build/` + thin root `build.mjs` re-export + `packaging/` from a known-good tree (this branch / prior release tag), then adjust only if Upstream APIs moved. Optional gated slices if you must rebuild it: stage+`svelte-package` → prune graph → scoped CSS → Buf vendor — green smoke after each slice. Prefer `node scripts/build/index.mjs` (`pnpm build`); `node build.mjs` still works via the re-export.

---

## Locked design (do not re-litigate)

| Decision | Choice |
|----------|--------|
| Upstream | Submodule `upstream/` → `temporalio/ui` @ **v2.54.1** ([UPSTREAM.md](../UPSTREAM.md)) |
| Adapter only outside Upstream | `src/` (Adapter files + demo `routes/`), `scripts/build/` (+ thin root `build.mjs`), `scripts/`, `packaging/`, docs |
| Lean Surface | `WorkflowHistory`, `WorkflowStatus` (+ CSS via component imports) |
| Host Contract | Raw Temporal API in; Adapter converts; Host owns mutations; `canBeTerminated` false |
| Styles | Adapter-compiled Upstream TW3 under `.temporal-ui` |
| Distribution | Release `.tgz` (`X.Y.Z-fb.n`); no registry auth |
| Root shape | Derived `package.json`; root `pnpm install`; build uses root `node_modules` ([ADR 0004](./adr/0004-derived-deps-kit-root.md)) |
| Kit adapter | `@sveltejs/adapter-auto` (Upstream product uses adapter-static — do not copy that) |
| Peers | `svelte` + `@sveltejs/kit` = **peerDependencies** |
| Bundled | `date-fns` + `date-fns-tz` = Package **dependencies** |
| Local demo | Root `src/routes/+page.svelte` + co-located `fixtures/`; not published |
| Staging | `.build/stage/` only — never `upstream/src/lib/forkbomb`; skip `app.html` + `routes/` |

**Non-goals (positive target):** pristine submodule + root toolchain + lean Package. That rules out: Upstream-as-workspace package, Vite rewrite of the packager, Buf/CSS removal, nesting `svelte`/`kit` as Package deps, editing `upstream/`, PRs against `temporalio/ui`.

**pnpm pin:** develop and CI use **pnpm 10.15** (`.tool-versions` / corepack). `sync-from-upstream` may copy Upstream’s `packageManager` field (often `pnpm@10.10.0`) — leave it or align to 10.15; engines stay `>=10.10`. Mise/CI must still resolve to ≥10.10 (prefer 10.15).

---

## Phase 0 — Preconditions

1. Node 22.18 + pnpm 10.15 on PATH (mise: `mise install`; confirm `pnpm -v` ≥ 10.10).
2. Remotes: `ForkbombEu/temporal-ui` only (`gh … --repo ForkbombEu/temporal-ui`).
3. Wipe old fork tree (server, committed `dist/`, product `src/`, e2e, Chromatic product workflows). Keep `LICENSE`.

**Done when:** clean tree; correct Node/pnpm.

---

## Phase 1 — Skeleton + Upstream submodule

1. Create dirs: `src/routes/fixtures/`, `packaging/`, `scripts/`, `docs/adr/`, `.github/workflows/`.
2. `.gitmodules` → `upstream` = `https://github.com/temporalio/ui.git`.
3. Add submodule; checkout **v2.54.1**; commit pointer.
4. Write [UPSTREAM.md](../UPSTREAM.md) (bump + re-sync note).
5. `.gitignore`: `node_modules`, `.build`, `.build.lock*`, `.svelte-kit`, `/package`, consumer build artifacts, `upstream/{node_modules,.svelte-kit}`, `.pnpm-store`.

**Done when:** `upstream/package.json` is v2.54.1; `git -C upstream status` stays clean for the rest of the playbook.

---

## Phase 2 — Domain docs

1. [CONTEXT.md](../CONTEXT.md) glossary (Upstream, Adapter, Host, Pollers/`workers`, Host Contract, Package, Lean Surface, Scoped Styles).
2. ADRs 0001–0003 (submodule, Release tarball, scoped CSS) + **0004** (derived-deps Kit root / stage).
3. [upstream-dotfiles.md](./upstream-dotfiles.md) — which pins sync as-is vs adapt vs stay Adapter-owned.

**Done when:** “what may be edited?” and “how does a Host install?” are answerable from docs alone.

---

## Phase 3 — Derived-deps Kit root

Root is Kit-shaped for IDE + `svelte-kit sync` + packaging bins — **not** the Host app.

### Sync rule (committed artifacts)

`scripts/sync-from-upstream.mjs` generates root `package.json` **and** shared Upstream pins (policy: [upstream-dotfiles.md](./upstream-dotfiles.md)). After sync + `pnpm install`, **commit** `package.json`, `pnpm-lock.yaml`, `.npmrc`, `.node-version`, `.editorconfig`, `.tool-versions`. Re-run sync when bumping Upstream or changing `TOOLCHAIN_DEV_DEPS` / `COPY_AS_IS` in the script.

1. Implement `scripts/sync-from-upstream.mjs` (SoT: `TOOLCHAIN_DEV_DEPS` + `COPY_AS_IS`):
   - Read `upstream/package.json` → write root manifest `@forkbombeu/temporal-ui` @ `${upstream.version}-fb.0`, `private`, `type: module`.
   - Full Upstream **dependencies**; picked packaging **devDependencies**; peers `svelte` + `@sveltejs/kit`.
   - Scripts: `sync:upstream`, `prepare` → `svelte-kit sync`, `build` → `node scripts/build/index.mjs`, `pack`, `check`.
   - Engines / overrides from Upstream; strip prepare/husky/product scripts.
   - Copy `.npmrc`, `.node-version`, `.editorconfig`; adapt `.tool-versions` (nodejs from Upstream, keep Adapter pnpm).
   - DevDep `@sveltejs/adapter-auto` (fallback pin if Upstream lacks it); strip `@sveltejs/adapter-static`.
2. Root Kit configs:
   - `svelte.config.js` — **`adapter-auto`**; aliases `$lib` / `$types` / `$components` → **`upstream/src/…`**.
   - `vite.config.js` — `sveltekit()` only.
   - `tsconfig.json` — extends `.svelte-kit/tsconfig.json`.
   - `src/app.html` — minimal shell.
   - `postcss.config.cjs` — empty stub (stage uses Upstream postcss/tailwind).
3. Bootstrap:
   ```sh
   git submodule update --init --recursive
   pnpm sync:upstream
   pnpm install
   pnpm exec svelte-kit sync
   ```

**Done when:** `node_modules/.bin/svelte-package` and `.svelte-kit/` exist at root; no develop/build `pnpm install` inside `upstream/`.

---

## Phase 4 — Adapter sources (`src/`)

Write Adapter **after** root aliases exist. Validate with Svelte MCP / `svelte-file-editor` when editing `.svelte`.

| File | Role |
|------|------|
| `src/index.ts` | Export `WorkflowHistory`, `WorkflowStatus` |
| `src/ensure-i18n.ts` | Idempotent i18n via Upstream `$lib/i18n` (not public) |
| `src/workflow-status.svelte` | Badge wrap; named `WorkflowStatusProps` |
| `src/workflow-history.svelte` | Host Contract → stores/buffer; Timeline then History |
| `src/workflow-{status,history}.css` | Stubs; build overwrites with scoped CSS |
| `src/app.html` | Already from Phase 3 |

### `WorkflowHistory` (implement exactly)

Props: `execution`, `history`, `namespace`, optional `workers`.

1. `toWorkflowExecution`; force `canBeTerminated = false`.
2. `$effect.pre`: `workflowRun` (+ optional workers); `setPendingMetadata`.
3. `$effect.pre`: on runId change `reset` + clear `fullEventHistory`; `ingestHistoryEvent` each event.
4. `$effect`: `fullEventHistory.set(eventBuffer.events)` (Input/Result).
5. `setContext(HISTORY_CTX, …)` — `fetchComplete: true`, ids from `history`.
6. UI: `.temporal-ui` → Timeline above History; hide duplicate Input/Result under history; CSS-disable `a[href]`.

### `WorkflowStatus`

Props: `status`, optional `delayed`, `taskFailure`. Badge inside `.temporal-ui` after `ensureI18n()`.

**Done when:** `pnpm check` passes (or only Adapter-related diagnostics remain); imports are `$lib` / `$components` only; Upstream untouched.

---

## Phase 5 — Packaging (`packaging/` + `scripts/build/`)

1. Commit `packaging/stage.svelte.config.js` and `stage.tsconfig.json` (`$lib` → staged `src/lib`).
2. **Transplant** known-good `scripts/build/` + thin root `build.mjs` re-export (see top). Required behavior checklist:
   - Exclusive `.build.lock`
   - Stage under `.build/stage/`: Upstream lib + Adapter as `forkbomb/` (skip `app.html`); link root `node_modules` + `.svelte-kit`; link Upstream postcss/tailwind/`src/components`/`app.css`
   - `svelte-package` from stage → `.build/full`
   - Runtime graphs for status, history, index; declaration expand; copy keep-set → `package/dist`
   - `fixDateFnsTzInterop` for Host Vite 7 SSR
   - Two scoped TW compiles (`important: '.temporal-ui'` + rewrite `:root`/`html`/`body`/headings); write component CSS
   - Vendor `@buf/*` with `dereference: true`; keep `@bufbuild/protobuf` as a normal dependency
   - Lean `package/package.json` exports `dist/forkbomb`; force `date-fns*` into dependencies

**Done when:** `pnpm build` exits 0; `package/dist/forkbomb/` has components + CSS; `git -C upstream status` clean.

---

## Phase 6 — Host smoke (`examples/consumer`)

1. SvelteKit + Tailwind **4** Host. Dep: `"@forkbombeu/temporal-ui": "file:../../package"`.
2. `preinstall` requires `../../package/package.json` (run root `pnpm build` first).
3. `dev` wipes `node_modules/.vite` + `--force`.
4. Any Host route is fine (e.g. `routes/demo/+page.svelte`). Adapter `app-bridge` + build rewrite satisfy Upstream `page.params` / `resolve` / filter `goto` — Host need not use Temporal-shaped Kit params.
5. **Fixtures:** copy from this repo’s `examples/consumer/src/lib/fixtures/{workflow,history}.fixture.json`, or from Credimi (`DIDimo/webapp`) exports of the same shape. Do not invent a full history by hand.
6. Map proto enum status → readable labels for `WorkflowStatus`.
7. Render `<WorkflowStatus>` + `<WorkflowHistory {execution} {history} namespace="default" />`.

```sh
pnpm build
cd examples/consumer && pnpm install && pnpm run build
pnpm exec vite preview --port 5199 --strictPort
```

**Done when:** badge + Timeline above History + Input/Result filled; no Host `temporal.css` / iframe.

---

## Phase 7 — README + Release CI

1. README: Host install from `.tgz`; raw props; scoped CSS; props-only Host contract (no Temporal Kit params); Develop = submodule → sync → root install → sync Kit → `pnpm build` → consumer.
2. **Replace** `.github/workflows/release-package.yml` if it still installs inside `upstream/`. Required flow:
   ```yaml
   - checkout (submodules: recursive)
   - Node from .node-version; corepack pnpm@10.15
   - node scripts/sync-from-upstream.mjs   # optional if committed package.json already matches pin
   - pnpm install                          # repo root
   - pnpm exec svelte-kit sync
   - node scripts/build/index.mjs   # or node build.mjs (thin re-export)
   - (cd package && npm pack)
   - softprops/action-gh-release ← package/*.tgz
   ```
3. Version: Upstream `X.Y.Z` → Package `X.Y.Z-fb.n` (first pin: `-fb.0`).

**Done when:** README Develop matches Phases 3–6; tag `v2.54.1-fb.0` would attach the `.tgz` using **root** install.

---

## Known failure modes

| Symptom | Fix (already in good `scripts/build/` / Adapter) |
|---------|-----------------------------------------------|
| Concurrent build corruption | `.build.lock` |
| Empty Buf files in tarball | `cpSync` with `dereference: true` |
| Broken `@bufbuild/protobuf/…` | Do not vendor it |
| Empty Input/Result | `fullEventHistory.set(eventBuffer.events)` |
| No Timeline | Mount Timeline **and** History |
| `date-fns-tz` undefined under Vite 7 SSR | `fixDateFnsTzInterop` |
| ENOENT `file:../../package` | Root `pnpm build` before consumer install |
| Stale consumer UI after rebuild | Consumer `dev` clears `.vite` |

---

## Suggested commit sequence

1. `docs: CONTEXT + ADRs + UPSTREAM`
2. `chore: add upstream submodule @ v2.54.1`
3. `feat: derive root Kit toolchain from Upstream`
4. `feat: Adapter WorkflowHistory + WorkflowStatus`
5. `feat: stage build outside Upstream + scoped CSS package`
6. `chore: examples/consumer Host smoke with fixtures`
7. `ci: release Package tarball on v* tags (root install)`
8. `docs: README Host contract + Develop`

---

## Out of scope here

Host migration (Credimi): switch to Release `.tgz`, replace iframe with `<WorkflowHistory>` / `<WorkflowStatus>` on Host-owned routes (any path; Adapter bridges `$app`), delete `static/temporal.css`. Track separately — not part of Package recreate.
