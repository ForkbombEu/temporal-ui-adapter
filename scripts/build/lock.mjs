import { closeSync, openSync, unlinkSync } from 'node:fs';
import { lockPath } from './paths.mjs';

/**
 * Exclusive lock — concurrent builds race on `.build/stage` / package output.
 * Registers exit / signal handlers that release the lock.
 */
export function acquireBuildLock() {
  let lockFd;
  try {
    lockFd = openSync(lockPath, 'wx');
  } catch {
    console.error(`Another build holds ${lockPath}; aborting.`);
    process.exit(1);
  }
  const releaseLock = () => {
    try {
      closeSync(lockFd);
    } catch {
      /* already closed */
    }
    try {
      unlinkSync(lockPath);
    } catch {
      /* already unlinked */
    }
  };
  process.on('exit', releaseLock);
  process.on('SIGINT', () => {
    releaseLock();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    releaseLock();
    process.exit(143);
  });
  return releaseLock;
}
