import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { Input } from 'telegraf';
import { config } from './config.js';
import { downloadFile } from './download.js';
import { optimize } from './audio.js';
import { createClient, transcribe, estimateCost } from './gemini.js';
import { acquireSlot, releaseSlot } from './queue.js';
import { fmtOutput } from './format.js';
import { logSuccess, logFailure } from './logger.js';
import * as status from './status.js';

const gemini = createClient(config.geminiApiKey);

export async function run(ctx, fileId) {
  const ui = status.createStatus(ctx);
  await acquireSlot(ui);

  const tempDir = await mkdtemp(join(tmpdir(), 'gemini-stt-'));
  const jobStart = Date.now();
  const u = ctx.from;
  const tag = randomBytes(3).toString('hex');
  let opt = null;
  let block = '';
  let retryCount = 0;
  let lastRetry = null;

  try {
    await ui.show(status.DOWNLOADING);
    const downloadPath = resolve(tempDir, 'input');
    await downloadFile(ctx.telegram, fileId, downloadPath);

    await ui.show(status.OPTIMIZING);
    const optimizedPath = resolve(tempDir, `optimized-${tag}.ogg`);
    opt = await optimize(downloadPath, optimizedPath);
    block = status.optimizedBlock(opt);

    await ui.show(status.sendingOptimized(block));
    await ctx.replyWithAudio(Input.fromLocalFile(optimizedPath));

    ui.startTicker(() => status.transcribing(block, lastRetry));

    const result = await transcribe(gemini, optimizedPath, {
      model: config.geminiModel,
      onRetry: r => {
        if (r) retryCount++;
        lastRetry = r;
      },
    });
    ui.stopTicker();

    if (!result.text?.trim()) throw new Error('Got an empty transcript.');

    const cost = estimateCost(result) ?? 0;
    const output = fmtOutput(result.text, tag);

    if (output.kind === 'message') {
      await ctx.reply(output.text);
    } else {
      await ctx.replyWithDocument(Input.fromBuffer(Buffer.from(output.content), output.filename));
    }

    logSuccess({ u, opt, result, cost, retryCount, jobStart });
    await ui.finish(block);
  } catch (err) {
    ui.stopTicker();
    logFailure({ u, opt, retryCount, jobStart, err });
    await ui.finish(status.failure(block, err.message ?? String(err)));
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    releaseSlot();
  }
}
