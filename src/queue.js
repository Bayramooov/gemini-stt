// FIFO concurrency gate. JS is single-threaded, so the sync check + push/
// increment pair is atomic; only awaits can interleave callers.
import { config } from './config.js';

let inFlight = 0;
const waiters = [];

const queueText = pos => {
  const ahead = pos - 1;
  if (ahead === 0) return `⏳ Queued — you're next…`;
  return `⏳ Queued — ${ahead} ${ahead === 1 ? 'job' : 'jobs'} ahead of you…`;
};

// Returns true if the caller had to wait. The caller's `progress` is reused:
// we send the initial "Queued" message and edit it as the position changes.
export async function acquireSlot(progress) {
  if (inFlight < config.maxConcurrent && waiters.length === 0) {
    inFlight++;
    return false;
  }
  let initialPos;
  const slot = new Promise(resolve => {
    waiters.push({
      take: () => {
        inFlight++;
        resolve();
      },
      onUpdate: pos => progress.update(queueText(pos)),
    });
    initialPos = waiters.length;
  });
  await progress.start(queueText(initialPos));
  await slot;
  return true;
}

export function releaseSlot() {
  inFlight--;
  if (waiters.length > 0) {
    waiters.shift().take();
    waiters.forEach((w, i) => w.onUpdate(i + 1));
  }
}
