import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { Input } from 'telegraf';
import { config } from './config.js';
import { downloadTelegramFile } from './files.js';
import { optimize } from './audio.js';
import { createClient, transcribe, estimateCost } from './gemini.js';
import { Progress } from './progress.js';
import { formatOutput, fmtDuration, fmtBytes } from './markdown.js';

const gemini = createClient(config.geminiApiKey);

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

const ts = () => `[${new Date().toISOString().slice(0, 19).replace('T', ' ')}]`;

// info: { fileId, mimeType, fileName? }
export async function runPipeline(ctx, info) {
  const tempDir = await mkdtemp(join(tmpdir(), 'gemini-stt-'));
  const progress = new Progress(ctx);
  const jobStart = Date.now();
  let opt = null;
  let retryCount = 0;
  let lastRetry = null;

  try {
    await progress.start('📥 Downloading from Telegram…');
    const downloadPath = resolve(tempDir, 'input');
    await downloadTelegramFile(ctx.telegram, info.fileId, downloadPath);

    await progress.update('🔧 Optimizing audio…');
    const optimizedPath = resolve(tempDir, 'optimized.ogg');
    opt = await optimize(downloadPath, optimizedPath, {
      speedup: config.speedup,
      silenceTrim: config.silenceTrim,
      silenceThresholdDb: config.silenceThresholdDb,
      silenceMinDuration: config.silenceMinDuration,
      silencePaddingSec: config.silencePaddingSec,
    });

    const optSummary =
      `${fmtDuration(opt.originalDuration)} → ${fmtDuration(opt.optimizedDuration)}` +
      ` (-${(opt.durationSavings * 100).toFixed(0)}%)\n` +
      `${fmtBytes(opt.originalSize)} → ${fmtBytes(opt.optimizedSize)}`;

    await progress.update(`📤 Sending optimized file…\n${optSummary}`);
    await ctx.replyWithAudio(Input.fromLocalFile(optimizedPath), {
      caption: `🔧 Optimized\n${optSummary}\n\nThis is exactly what is being sent to Gemini.`,
    });

    progress.startTicker(elapsedMs => {
      const lines = [`🎙 Transcribing with ${config.geminiModel}…`];
      if (lastRetry) lines.push(`Gemini busy, retry ${lastRetry.attempt}/${lastRetry.maxRetries}`);
      lines.push(`Elapsed: ${fmtDuration(elapsedMs / 1000)}`);
      return lines.join('\n');
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

    if (!result.text?.trim()) throw new Error('Gemini returned an empty transcript.');

    const cost = estimateCost(result) ?? 0;
    const output = formatOutput(result.text, {
      originalDuration: opt.originalDuration,
      optimizedDuration: opt.optimizedDuration,
      durationSavings: opt.durationSavings,
      model: result.model,
      audioTokens: result.audioTokens,
      outputTokens: result.outputTokens,
      cost,
    });

    if (output.kind === 'message') {
      await ctx.reply(output.text, output.parseMode ? { parse_mode: output.parseMode } : {});
    } else {
      await ctx.replyWithDocument(Input.fromBuffer(Buffer.from(output.content), output.filename), {
        caption: `🎙 ${result.model}  ·  ${fmtDuration(opt.optimizedDuration)}  ·  $${cost.toFixed(4)}`,
      });
    }

    const elapsed = (Date.now() - jobStart) / 1000;
    const u = ctx.from;
    const name = u.username ? `@${u.username}` : [u.first_name, u.last_name].filter(Boolean).join(' ');
    console.log(
      `${ts()} ✓ ${name} (${u.id}) · ${fmtDuration(opt.originalDuration)} (${fmtBytes(opt.originalSize)}) → ${fmtDuration(opt.optimizedDuration)} · ${result.model.replace('gemini-2.5-', '')} · $${cost.toFixed(4)} · ${result.text.length} chars · ${fmtDuration(elapsed)} total${formatRetries(retryCount)}`,
    );
    await progress.finish(`✅ Done in ${fmtDuration(elapsed)}`);
  } catch (err) {
    progress.stopTicker();
    const elapsed = (Date.now() - jobStart) / 1000;
    const u = ctx.from;
    const name = u.username ? `@${u.username}` : [u.first_name, u.last_name].filter(Boolean).join(' ');
    const optPart = opt ? ` · ${fmtDuration(opt.originalDuration)} (${fmtBytes(opt.originalSize)}) → ${fmtDuration(opt.optimizedDuration)}` : '';
    console.log(
      `${ts()} ✗ ${name} (${u.id})${optPart} · ${config.geminiModel.replace('gemini-2.5-', '')} · ${fmtDuration(elapsed)} total${formatRetries(retryCount)} · failed: ${extractReason(err)}`,
    );
    await progress.finish(`❌ ${err.message ?? String(err)}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
