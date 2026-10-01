import { execSync } from 'node:child_process';
import {
  cpSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

/** rmSync can hit transient ENOTEMPTY on macOS; retry then fall back to rm -rf. */
export function rmrf(path) {
  try {
    lstatSync(path);
  } catch {
    return;
  }
  for (let i = 0; i < 8; i++) {
    try {
      rmSync(path, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
      try {
        lstatSync(path);
      } catch {
        return;
      }
    } catch {
      /* retry */
    }
    try {
      execSync(`rm -rf ${JSON.stringify(path)}`, { stdio: 'ignore' });
    } catch {
      /* retry */
    }
    try {
      lstatSync(path);
    } catch {
      return;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100 * (i + 1));
  }
  throw new Error(`Failed to remove ${path}`);
}

export function linkOrCopy(target, linkPath) {
  rmrf(linkPath);
  mkdirSync(dirname(linkPath), { recursive: true });
  symlinkSync(target, linkPath);
}

/**
 * Copy a directory tree with optional skip predicates.
 * Prefer filtered cpSync over per-file hardlinks — Node linkSync×N is slower on APFS.
 * @param {{ skipDir?: (name: string) => boolean, skipFile?: (name: string) => boolean }} [opts]
 */
export function copyTreeFiltered(src, dest, opts = {}) {
  const { skipDir = () => false, skipFile = () => false } = opts;
  mkdirSync(dest, { recursive: true });
  for (const ent of readdirSync(src, { withFileTypes: true })) {
    if (ent.name === '.' || ent.name === '..') continue;
    const from = join(src, ent.name);
    const to = join(dest, ent.name);
    if (ent.isDirectory()) {
      if (skipDir(ent.name)) continue;
      copyTreeFiltered(from, to, opts);
    } else if (ent.isFile() || ent.isSymbolicLink()) {
      if (skipFile(ent.name)) continue;
      cpSync(from, to);
    }
  }
}
