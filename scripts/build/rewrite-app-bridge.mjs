import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

/**
 * Specifier → file under dist/forkbomb/app-bridge/ (post svelte-package names).
 * `$app/types` is type-only — left alone.
 */
const APP_BRIDGE_MAP = {
  '$app/state': 'page-state.js',
  '$app/paths': 'paths.js',
  '$app/navigation': 'navigation.js',
  '$app/stores': 'stores.js',
};

const REWRITE_EXTS = /\.(js|svelte\.js|mjs|svelte)$/;

/**
 * Rewrite bare `$app/{state,paths,navigation,stores}` imports in packaged
 * Upstream modules to relative paths into `dist/forkbomb/app-bridge/*`.
 * Skips files already under `forkbomb/app-bridge/`.
 *
 * @param {string} distDir package dist root (e.g. package/dist)
 * @returns {{ rewritten: number, hits: number }}
 */
export function rewriteAppBridgeImports(distDir) {
  const bridgeRoot = join(distDir, 'forkbomb', 'app-bridge');
  if (!existsSync(bridgeRoot)) {
    console.warn(
      '[build] rewrite-app-bridge: forkbomb/app-bridge missing from dist; skip rewrite.',
    );
    return { rewritten: 0, hits: 0 };
  }

  for (const [spec, file] of Object.entries(APP_BRIDGE_MAP)) {
    if (!existsSync(join(bridgeRoot, file))) {
      throw new Error(
        `[build] rewrite-app-bridge: expected bridge file missing: forkbomb/app-bridge/${file} (for ${spec})`,
      );
    }
  }

  let rewritten = 0;
  let hits = 0;

  const walk = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(p);
        continue;
      }
      if (!REWRITE_EXTS.test(ent.name)) continue;

      const relFromDist = relative(distDir, p).replace(/\\/g, '/');
      if (relFromDist.startsWith('forkbomb/app-bridge/')) continue;

      let src = readFileSync(p, 'utf8');
      let changed = false;

      for (const [spec, bridgeFile] of Object.entries(APP_BRIDGE_MAP)) {
        const target = join(bridgeRoot, bridgeFile);
        let rel = relative(dirname(p), target).replace(/\\/g, '/');
        if (!rel.startsWith('.')) rel = `./${rel}`;

        const escaped = spec.replace(/\$/g, '\\$').replace(/\//g, '\\/');
        // from '…' | from "…" | import('…') | import("…") | export … from '…'
        const re = new RegExp(
          `((?:from\\s+|import\\s*\\(\\s*))(['"])${escaped}\\2`,
          'g',
        );
        src = src.replace(re, (full, head, quote) => {
          hits += 1;
          changed = true;
          return `${head}${quote}${rel}${quote}`;
        });
      }

      if (changed) {
        writeFileSync(p, src);
        rewritten += 1;
      }
    }
  };

  walk(distDir);
  console.log(
    `[build] rewrite-app-bridge: ${rewritten} file(s), ${hits} specifier(s) → forkbomb/app-bridge`,
  );
  return { rewritten, hits };
}
