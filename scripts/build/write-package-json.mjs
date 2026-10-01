import { readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { packageName } from './graph.mjs';
import {
  PACKAGE_VERSION_SUFFIX,
  adapterSrc,
  here,
  pkgDir,
  upstream,
} from './paths.mjs';
import { vendorBufPackages } from './vendor-buf.mjs';

const pick = (names, deps) =>
  Object.fromEntries(Object.entries(deps).filter(([name]) => names.has(name)));

/**
 * Build lean package.json from Upstream deps + runtime/type import graphs.
 * Vendors @buf/* as a side effect (same order as the monolithic script).
 */
export function writePackageJson({
  runtimeImports,
  typeImports,
  keep,
  runtimeFiles,
  statusCssModules,
  historyCssModules,
}) {
  const upstreamPkg = JSON.parse(readFileSync(join(upstream, 'package.json'), 'utf8'));
  const runtimeUsed = new Set([...runtimeImports].map(packageName));
  const typeOnlyUsed = new Set(
    [...typeImports].map(packageName).filter((n) => !runtimeUsed.has(n)),
  );
  const used = new Set([...runtimeUsed, ...typeOnlyUsed]);
  const declared = { ...upstreamPkg.devDependencies, ...upstreamPkg.dependencies };

  const peerDependencies = {
    ...pick(used, upstreamPkg.peerDependencies),
    ...pick(new Set([...typeOnlyUsed].filter((n) => !(n in upstreamPkg.peerDependencies))), declared),
  };
  // `$app/*` is rewritten to forkbomb/app-bridge — do not force @sveltejs/kit peer for those.
  const peerDependenciesMeta = Object.fromEntries(
    Object.keys(peerDependencies)
      .filter((n) => typeOnlyUsed.has(n) && !(n in upstreamPkg.peerDependencies))
      .map((n) => [n, { optional: true }]),
  );

  let dependencies = pick(
    new Set([...runtimeUsed].filter((n) => !(n in upstreamPkg.peerDependencies))),
    declared,
  );

  // Host need not install these — pin Upstream's versions as our runtime deps.
  // Do NOT do this for `svelte` / `@sveltejs/kit`: Hosts must share one runtime.
  const bundleAsDeps = ['date-fns', 'date-fns-tz'];
  for (const name of bundleAsDeps) {
    const ver =
      peerDependencies[name] ??
      upstreamPkg.peerDependencies?.[name] ??
      declared[name];
    delete peerDependencies[name];
    delete peerDependenciesMeta[name];
    if (ver && (used.has(name) || runtimeUsed.has(name))) dependencies[name] = ver;
  }

  const vendoredBuf = vendorBufPackages(runtimeUsed);
  for (const name of vendoredBuf) delete dependencies[name];

  const version = `${upstreamPkg.version}${PACKAGE_VERSION_SUFFIX}`;

  writeFileSync(
    join(pkgDir, 'package.json'),
    `${JSON.stringify(
      {
        name: '@forkbombeu/temporal-ui',
        version,
        type: 'module',
        license: 'MIT',
        files: ['dist'],
        sideEffects: ['**/*.css'],
        exports: {
          '.': {
            types: './dist/forkbomb/index.d.ts',
            svelte: './dist/forkbomb/index.js',
            default: './dist/forkbomb/index.js',
          },
        },
        peerDependencies,
        peerDependenciesMeta,
        dependencies,
      },
      null,
      2,
    )}\n`,
  );

  const unresolved = [...used].filter(
    (n) =>
      !n.startsWith('$app') &&
      !(n in dependencies) &&
      !(n in peerDependencies) &&
      !vendoredBuf.has(n) &&
      !n.startsWith('node:'),
  );

  const bufRegistryOnGraph = [...runtimeUsed].filter((n) => n.startsWith('@buf/'));
  if (bufRegistryOnGraph.some((n) => !vendoredBuf.has(n))) {
    console.warn(
      '[build] TODO(forkbomb): some @buf/* packages remain as dependencies — Host may need Buf registry (.npmrc @buf:registry=https://buf.build/gen/npm/v1/).',
    );
  }

  console.log(
    JSON.stringify(
      {
        adapterSrc: relative(here, adapterSrc),
        upstream: relative(here, upstream) || upstream,
        upstreamVersion: upstreamPkg.version,
        version,
        packagedFiles: keep.size,
        runtimeModules: runtimeFiles.size,
        statusCssModules,
        historyCssModules,
        dependencies: Object.keys(dependencies).length,
        vendoredBuf: [...vendoredBuf],
        unresolvedBareImports: unresolved,
        css: [
          'dist/forkbomb/workflow-status.css',
          'dist/forkbomb/workflow-history.css',
        ],
      },
      null,
      2,
    ),
  );

  return { version, dependencies, peerDependencies, vendoredBuf, unresolved };
}
