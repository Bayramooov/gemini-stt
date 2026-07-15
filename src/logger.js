import { appendFileSync, mkdirSync } from 'node:fs';
import { inspect } from 'node:util';
import { config } from './config.js';
import { fmtDuration, fmtBytes } from './format.js';
import { extractReason } from './gemini.js';

mkdirSync('./data', { recursive: true });
const LOG_PATH = './data/bot.log';

const ts = () => new Date().toLocaleString('sv');
const fmtRetries = n => (n ? ` · ${n} ${n === 1 ? 'retry' : 'retries'}` : '');
const userTag = u => `${u.username ? `@${u.username}` : [u.first_name, u.last_name].filter(Boolean).join(' ')} (${u.id})`;
const optPart = opt => (opt ? ` · ${fmtDuration(opt.originalDuration)} (${fmtBytes(opt.originalSize)}) → ${fmtDuration(opt.optimizedDuration)}` : '');
const stripModel = m => m.replace('gemini-2.5-', '');

export const log = line => {
  console.log(line);
  try {
    appendFileSync(LOG_PATH, line + '\n');
  } catch (err) {
    // A failing bot.log write (disk full, permissions) must never take down a
    // job — the line is already on the console, so only the mirror is lost.
    console.error(`bot.log write failed: ${err.code ?? err.message}`);
  }
};

export function logSuccess({ u, opt, result, cost, retryCount, jobStart }) {
  const elapsed = (Date.now() - jobStart) / 1000;
  log(`[${ts()}] ✓ ${userTag(u)}${optPart(opt)} · ${stripModel(result.model)} · $${cost.toFixed(4)} · ${result.text.length} chars · ${fmtDuration(elapsed)} total${fmtRetries(retryCount)}`);
}

export function logFailure({ u, opt, retryCount, jobStart, err }) {
  const elapsed = (Date.now() - jobStart) / 1000;
  log(`[${ts()}] ✗ ${userTag(u)}${optPart(opt)} · ${stripModel(config.geminiModel)} · ${fmtDuration(elapsed)} total${fmtRetries(retryCount)} · failed: ${extractReason(err)}`);
  // Full error with stack and cause chain — for diagnosing "fetch failed" and similar opaque errors.
  log(inspect(err, { depth: 5 }));
}
