import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repo root (scripts/build → ../..). */
export const here = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const upstream = resolve(process.env.UPSTREAM_DIR || join(here, 'upstream'));
export const buildDir = join(here, '.build');
export const stageDir = join(buildDir, 'stage');
export const fullDist = join(buildDir, 'full');
export const pkgDir = join(here, 'package');
export const dist = join(pkgDir, 'dist');
export const SCOPE = '.temporal-ui';
export const PACKAGE_VERSION_SUFFIX = '-fb.0';
export const lockPath = join(here, '.build.lock');
export const packagingDir = join(here, 'packaging');

export const adapterSrc = join(here, 'src');
export const upstreamLib = join(upstream, 'src/lib');

export const requireRoot = createRequire(join(here, 'package.json'));
export const bin = (name) => join(here, 'node_modules/.bin', name);

/** Fail fast if Adapter / Upstream / root toolchain are missing. */
export function assertBuildPrereqs() {
  if (!existsSync(join(adapterSrc, 'workflow-history.svelte'))) {
    console.error(`Adapter sources not found at ${adapterSrc}`);
    process.exit(1);
  }
  if (!existsSync(join(upstream, 'package.json'))) {
    console.error(
      `Upstream not found at ${upstream}. Set UPSTREAM_DIR or init the submodule.`,
    );
    process.exit(1);
  }
  if (!existsSync(join(here, 'node_modules/.bin/svelte-package'))) {
    console.error(
      `Root toolchain not installed (missing node_modules/.bin/svelte-package).\n` +
        `  node scripts/sync-from-upstream.mjs && pnpm install && pnpm exec svelte-kit sync`,
    );
    process.exit(1);
  }
  if (!existsSync(join(here, '.svelte-kit'))) {
    console.error(
      `Missing .svelte-kit at repo root. Run: pnpm exec svelte-kit sync`,
    );
    process.exit(1);
  }
}
