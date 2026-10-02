import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { rmrf } from './fs.mjs';
import { dist, here, requireRoot } from './paths.mjs';

/**
 * Vendor Buf-registry packages (`@buf/*`) into dist/vendor so Hosts need no Buf `.npmrc`.
 * Leave `@bufbuild/protobuf` as a normal dependency — it is on the public npm registry, and
 * vendoring it breaks package subpath imports (`@bufbuild/protobuf/codegenv2`).
 * Returns package names successfully vendored (removed from dependencies).
 */
export function vendorBufPackages(runtimeUsed) {
  const bufNames = [...runtimeUsed].filter((n) => n.startsWith('@buf/'));
  if (!bufNames.length) return new Set();

  const vendored = new Set();
  const vendorRoot = join(dist, 'vendor');
  mkdirSync(vendorRoot, { recursive: true });

  for (const name of bufNames) {
    let pkgRoot;
    try {
      pkgRoot = dirname(requireRoot.resolve(`${name}/package.json`));
    } catch {
      const nm = join(here, 'node_modules', ...name.split('/'));
      if (existsSync(nm)) pkgRoot = nm;
    }
    if (!pkgRoot || !existsSync(pkgRoot)) {
      console.warn(
        `[build] Could not resolve ${name} for vendoring; leaving in dependencies (Host may need Buf registry).`,
      );
      continue;
    }
    const dest = join(vendorRoot, ...name.split('/'));
    rmrf(dest);
    mkdirSync(dirname(dest), { recursive: true });
    // pnpm store paths are often symlinks; npm pack does not follow them into the tarball.
    cpSync(pkgRoot, dest, { recursive: true, dereference: true });
    vendored.add(name);
  }

  if (!vendored.size) return vendored;

  const rewriteWalk = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) {
        rewriteWalk(p);
        continue;
      }
      if (!/\.(js|svelte\.js|mjs|cjs)$/.test(ent.name)) continue;
      let src = readFileSync(p, 'utf8');
      let changed = false;
      for (const name of vendored) {
        const relToVendor = relative(dirname(p), join(vendorRoot, ...name.split('/'))).replace(
          /\\/g,
          '/',
        );
        const prefix = relToVendor.startsWith('.') ? relToVendor : `./${relToVendor}`;
        const re = new RegExp(
          `(from\\s+|import\\s*\\(\\s*)(['"])${name.replace(/\//g, '\\/')}(\\/[^'"]*)?\\2`,
          'g',
        );
        src = src.replace(re, (_full, head, quote, sub = '') => {
          changed = true;
          return `${head}${quote}${prefix}${sub}${quote}`;
        });
      }
      if (changed) writeFileSync(p, src);
    }
  };
  rewriteWalk(dist);
  return vendored;
}
