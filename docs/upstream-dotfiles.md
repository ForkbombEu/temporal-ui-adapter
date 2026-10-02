# Upstream → root file sync

Which Upstream files the Adapter root should mirror, adapt, or ignore. The generator is [`scripts/sync-from-upstream.mjs`](../scripts/sync-from-upstream.mjs) (`pnpm sync:upstream`). Re-run on every Upstream pin bump ([UPSTREAM.md](../UPSTREAM.md)).

Vocabulary: [CONTEXT.md](../CONTEXT.md). Architecture: [ADR 0004](./adr/0004-derived-deps-kit-root.md).

## Copied as-is (script)

| Root file | Upstream source |
|-----------|-----------------|
| `.npmrc` | `upstream/.npmrc` (Buf registry + `engine-strict`) |
| `.node-version` | `upstream/.node-version` |
| `.editorconfig` | `upstream/.editorconfig` |

## Adapted by script

| Root file | Rule |
|-----------|------|
| `package.json` | Derived lean Kit root from `upstream/package.json` (deps, peers, engines, overrides; Adapter scripts/name/version). Commit with `pnpm-lock.yaml` after `pnpm install`. |
| `.tool-versions` | Set `nodejs` from Upstream `.node-version`. **Keep** the existing root `pnpm` pin (Adapter-owned, currently 10.15). Drop Upstream `golang` and other tools. |

## Adapter-owned (edit by hand; script never overwrites)

| Root file | Rule |
|-----------|------|
| `.gitignore` | Merge as needed: keep `.build/`, `/package`, consumer artifacts, `upstream/{node_modules,.svelte-kit}`. Do not replace with Upstream’s product ignore list. |
| `.github/workflows/*` | Adapter Release workflow (root install). Do not copy Upstream Chromatic/product workflows. |
| `svelte.config.js`, `vite.config.js`, `tsconfig.json`, `postcss.config.cjs` | Root Kit aliases / stubs. Stage uses `packaging/stage.*` + Upstream postcss/tailwind via build links. |
| `.prettierrc`, `.prettierignore`, `eslint.config.js`, `.lintstagedrc.json`, `.husky/` | Optional later. If added, write Adapter-scoped configs — do not mirror Upstream Playwright/Storybook/product hooks. |

## Never sync to root

All Upstream `.env*`, `.storybook`, `.stylelintrc`, `.dockerignore`, `.whitesource`, agent/IDE product dirs (`.agents`, `.claude`, `.codex`, Upstream `.vscode`), `pnpm-workspace.yaml`, and Upstream app configs (`svelte.config.js`, `vite.config.*`, `tsconfig*.json`, `tailwind.config.ts`) — those stay in the submodule or are linked only inside `.build/stage/` at package time.
