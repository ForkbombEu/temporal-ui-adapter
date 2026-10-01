import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { adapterSrc, buildDir, fullDist, upstream } from './paths.mjs';

/** Bump when stage skip rules change so stale `.build/full` is invalidated. */
const STAGE_FILTER_VERSION = 1;

const stampPath = join(buildDir, 'full.stamp');

function walkFiles(dir, out = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walkFiles(p, out);
    else if (ent.isFile()) out.push(p);
  }
  return out;
}

function upstreamRev() {
  try {
    return execFileSync('git', ['-C', upstream, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
  } catch {
    return `mtime:${statSync(join(upstream, 'package.json')).mtimeMs}`;
  }
}

function hashAdapterSrc() {
  const hash = createHash('sha256');
  const files = walkFiles(adapterSrc).sort();
  for (const file of files) {
    if (file.endsWith('/app.html')) continue;
    hash.update(relative(adapterSrc, file));
    hash.update('\0');
    hash.update(readFileSync(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

export function stageCacheKey() {
  return [
    `filter:v${STAGE_FILTER_VERSION}`,
    `upstream:${upstreamRev()}`,
    `adapter:${hashAdapterSrc()}`,
  ].join('\n');
}

/** True when `.build/full` is reusable (same Upstream + Adapter + filter rules). */
export function canReuseFullDist() {
  if (!existsSync(join(fullDist, 'forkbomb/index.js'))) return false;
  if (!existsSync(stampPath)) return false;
  try {
    return readFileSync(stampPath, 'utf8') === stageCacheKey();
  } catch {
    return false;
  }
}

export function writeFullDistStamp() {
  writeFileSync(stampPath, stageCacheKey());
}
