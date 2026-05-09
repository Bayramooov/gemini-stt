import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { Input } from 'telegraf';
import { config } from './config.js';
import { downloadTelegramFile } from './files.js';
import { optimize } from './audio.js';
import { createClient, transcribe, estimateCost } from './gemini.js';
import { Progress } from './progress.js';
import { acquireSlot, releaseSlot } from './queue.js';
import { formatOutput, fmtDuration, fmtBytes } from './markdown.js';

const gemini = createClient(config.geminiApiKey);
const PHRASES = [
  'Listening',
  'Decoding',
  'Diarizing',
  'Transcribing',
  'Untangling',
  'Disambiguating',
  'Distilling',
  'Crystallizing',
  'Discerning',
  'Synthesizing',
  'Annotating',
  'Polishing',
];

// Gemini's ApiError stringifies as "ApiError: {json}". Pull the human-readable
// message out so it fits on one log line.
function extractReason(err) {
  const status = err?.status ?? err?.response?.status;
  let msg = err?.message ?? String(err);
  try {
    const parsed = JSON.parse(msg.slice(msg.indexOf(':') + 1).trim());
    if (parsed?.error?.message) msg = parsed.error.message;
  } catch {}
  msg = msg.split('\n')[0].slice(0, 200);
  return status ? `${status} ${msg}` : msg;
}

function formatRetries(n) {
  return n ? ` · ${n} ${n === 1 ? 'retry' : 'retries'}` : '';
}

const ts = () => new Date().toLocaleString('sv');

export async function runPipeline(ctx, fileId) {
  const progress = new Progress(ctx);
  const wasQueued = await acquireSlot(progress);

  try {
    const tempDir = await mkdtemp(join(tmpdir(), 'gemini-stt-'));
    const jobStart = Date.now();
    const u = ctx.from;
    const name = u.username ? `@${u.username}` : [u.first_name, u.last_name].filter(Boolean).join(' ');
    const tag = randomBytes(3).toString('hex');
    let opt = null;
    let optimizedBlock = '';
    let retryCount = 0;
    let lastRetry = null;

    try {
      if (wasQueued) await progress.update('📥 Downloading from Telegram…');
      else await progress.start('📥 Downloading from Telegram…');
      const downloadPath = resolve(tempDir, 'input');
      await downloadTelegramFile(ctx.telegram, fileId, downloadPath);

      await progress.update('🔧 Optimizing audio…');
      const optimizedPath = resolve(tempDir, `optimized-${tag}.ogg`);
      opt = await optimize(downloadPath, optimizedPath, config);

      optimizedBlock =
        `🔧 Optimized\n` +
        `${fmtDuration(opt.originalDuration)} → ${fmtDuration(opt.optimizedDuration)} (-${(opt.durationSavings * 100).toFixed(0)}%)\n` +
        `${fmtBytes(opt.originalSize)} → ${fmtBytes(opt.optimizedSize)}`;

      await progress.update(`${optimizedBlock}\n\n📤 Sending optimized file…`);
      await ctx.replyWithAudio(Input.fromLocalFile(optimizedPath));

      progress.startTicker(() => {
        const phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)];
        const retry = lastRetry ? ` (retry ${lastRetry.attempt}/${lastRetry.maxRetries})` : '';
        return `${optimizedBlock}\n\n🎙 ${phrase}…${retry}`;
      });

      const result = await transcribe(gemini, optimizedPath, {
        model: config.geminiModel,
        onRetry: r => {
          if (r) {
            retryCount++;
            lastRetry = r;
          } else {
            lastRetry = null;
          }
        },
      });
      progress.stopTicker();

      if (!result.text?.trim()) throw new Error('Got an empty transcript.');

      const cost = estimateCost(result) ?? 0;
      const output = formatOutput(result.text, tag);

      if (output.kind === 'message') {
        await ctx.reply(output.text);
      } else {
        await ctx.replyWithDocument(Input.fromBuffer(Buffer.from(output.content), output.filename));
      }

      const elapsed = (Date.now() - jobStart) / 1000;
      console.log(
        `[${ts()}] ✓ ${name} (${u.id}) · ${fmtDuration(opt.originalDuration)} (${fmtBytes(opt.originalSize)}) → ${fmtDuration(opt.optimizedDuration)} · ${result.model.replace('gemini-2.5-', '')} · $${cost.toFixed(4)} · ${result.text.length} chars · ${fmtDuration(elapsed)} total${formatRetries(retryCount)}`,
      );
      await progress.finish(optimizedBlock);
    } catch (err) {
      progress.stopTicker();
      const elapsed = (Date.now() - jobStart) / 1000;
      const optPart = opt ? ` · ${fmtDuration(opt.originalDuration)} (${fmtBytes(opt.originalSize)}) → ${fmtDuration(opt.optimizedDuration)}` : '';
      console.log(
        `[${ts()}] ✗ ${name} (${u.id})${optPart} · ${config.geminiModel.replace('gemini-2.5-', '')} · ${fmtDuration(elapsed)} total${formatRetries(retryCount)} · failed: ${extractReason(err)}`,
      );
      const prefix = optimizedBlock ? `${optimizedBlock}\n\n` : '';
      await progress.finish(`${prefix}❌ ${err.message ?? String(err)}`);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  } finally {
    releaseSlot();
  }
}
