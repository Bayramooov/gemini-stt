// FIFO concurrency gate. JS is single-threaded, so the sync check + push/
// increment pair is atomic; only awaits can interleave callers.
import { config } from './config.js';

let inFlight = 0;
const waiters = [];

function queueText(pos) {
  const ahead = pos - 1;
  if (ahead === 0) return `⏳ Queued — you're next…`;
  return `⏳ Queued — ${ahead} ${ahead === 1 ? 'job' : 'jobs'} ahead of you…`;
}

// Sends a "Queued" message via `progress` if the caller has to wait, and edits
// it as the position changes. Resolves once a slot is free.
export async function acquireSlot(progress) {
  if (inFlight < config.maxConcurrent && waiters.length === 0) {
    inFlight++;
    return;
  }
  let initialPos;
  const slot = new Promise(resolve => {
    waiters.push({
      take: () => {
        inFlight++;
        resolve();
      },
      onUpdate: pos => progress.show(queueText(pos)).catch(() => {}),
    });
    initialPos = waiters.length;
  });
  // Queue-position messages are cosmetic — if they can't be sent (user blocked
  // the bot, rate limit), the caller must still get its slot, not a rejection.
  await progress.show(queueText(initialPos)).catch(() => {});
  await slot;
}

export function releaseSlot() {
  inFlight--;
  if (waiters.length > 0) {
    waiters.shift().take();
    waiters.forEach((w, i) => w.onUpdate(i + 1));
  }
}
