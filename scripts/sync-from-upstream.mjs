/**
 * Derive the root package.json toolchain from the pinned Upstream submodule.
 *
 * Root becomes a real Kit-shaped project that installs at the repo root.
 * Upstream stays pristine — we only read its package.json (and engines).
 *
 * Not copied: Upstream scripts/prepare/husky, product adapters, exports, files.
 * Publishable lean deps still come from build.mjs prune, not this manifest.
 *
 * Usage: node scripts/sync-from-upstream.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const upstreamPkgPath = join(root, 'upstream/package.json');
const outPath = join(root, 'package.json');

const PACKAGE_VERSION_SUFFIX = '-fb.0';

/** DevDependencies needed to sync, package, and compile scoped CSS. */
const TOOLCHAIN_DEV_DEPS = [
  '@buf/temporalio_api.bufbuild_es',
  '@bufbuild/protobuf',
  '@sveltejs/adapter-static',
  '@sveltejs/kit',
  '@sveltejs/package',
  '@sveltejs/vite-plugin-svelte',
  '@types/node',
  'autoprefixer',
  'cssnano',
  'postcss',
  'postcss-load-config',
  'svelte',
  'svelte-check',
  'svelte-preprocess',
  'tailwindcss',
  'typescript',
  'vite',
];

const upstream = JSON.parse(readFileSync(upstreamPkgPath, 'utf8'));

const pick = (names, from) =>
  Object.fromEntries(
    names
      .filter((name) => name in from)
      .map((name) => [name, from[name]])
      .sort(([a], [b]) => a.localeCompare(b)),
  );

const missingToolchain = TOOLCHAIN_DEV_DEPS.filter(
  (name) => !(name in upstream.devDependencies) && !(name in upstream.dependencies),
);
if (missingToolchain.length) {
  console.warn(
    `[sync-from-upstream] Upstream missing toolchain pins (skipped): ${missingToolchain.join(', ')}`,
  );
}

const fromDev = pick(TOOLCHAIN_DEV_DEPS, upstream.devDependencies);
const fromDepsAsDev = pick(
  TOOLCHAIN_DEV_DEPS.filter((n) => !(n in fromDev)),
  upstream.dependencies,
);

const pkg = {
  name: '@forkbombeu/temporal-ui',
  version: `${upstream.version}${PACKAGE_VERSION_SUFFIX}`,
  private: true,
  type: 'module',
  description: 'Host-facing Adapter around temporalio/ui workflow history',
  scripts: {
    'sync:upstream': 'node scripts/sync-from-upstream.mjs',
    prepare: 'svelte-kit sync',
    build: 'node build.mjs',
    pack: 'npm pack --pack-destination . --workdir package',
    check: 'svelte-check --tsconfig ./tsconfig.json',
  },
  engines: {
    node: upstream.engines?.node ?? '>=22.14',
    ...(upstream.engines?.pnpm ? { pnpm: upstream.engines.pnpm } : {}),
  },
  packageManager: upstream.packageManager ?? 'pnpm@10.10.0',
  // Full Upstream runtime graph — prune happens at package/ publish time.
  dependencies: Object.fromEntries(
    Object.entries(upstream.dependencies).sort(([a], [b]) => a.localeCompare(b)),
  ),
  devDependencies: {
    ...fromDev,
    ...fromDepsAsDev,
  },
  peerDependencies: {
    '@sveltejs/kit': upstream.peerDependencies['@sveltejs/kit'],
    svelte: upstream.peerDependencies.svelte,
  },
  pnpm: {
    overrides: upstream.pnpm?.overrides ?? {},
    onlyBuiltDependencies: [
      'esbuild',
      'svelte-preprocess',
      ...(upstream.pnpm?.onlyBuiltDependencies?.includes('protobufjs')
        ? ['protobufjs']
        : []),
    ],
  },
};

writeFileSync(outPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      wrote: 'package.json',
      version: pkg.version,
      dependencies: Object.keys(pkg.dependencies).length,
      devDependencies: Object.keys(pkg.devDependencies).length,
      upstreamVersion: upstream.version,
    },
    null,
    2,
  ),
);
