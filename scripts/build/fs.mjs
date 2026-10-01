import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, symlinkSync, lstatSync } from 'node:fs';
import { dirname } from 'node:path';

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
