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

// info: { fileId, mimeType, fileName? }
export async function runPipeline(ctx, info) {
  const tempDir = await mkdtemp(join(tmpdir(), 'gemini-stt-'));
  const progress = new Progress(ctx);
  const jobStart = Date.now();

  try {
    await progress.start('📥 Downloading from Telegram…');
    const downloadPath = resolve(tempDir, 'input');
    await downloadTelegramFile(ctx.telegram, info.fileId, downloadPath);

    await progress.update('🔧 Optimizing audio…');
    const optimizedPath = resolve(tempDir, 'optimized.ogg');
    const opt = await optimize(downloadPath, optimizedPath, {
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

    progress.startTicker(elapsedMs => `🎙 Transcribing with ${config.geminiModel}…\n` + `Elapsed: ${fmtDuration(elapsedMs / 1000)}`);

    const result = await transcribe(gemini, optimizedPath, { model: config.geminiModel });
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

    await progress.finish(`✅ Done in ${fmtDuration((Date.now() - jobStart) / 1000)}`);
  } catch (err) {
    console.error('pipeline error:', err);
    progress.stopTicker();
    await progress.finish(`❌ ${err.message ?? String(err)}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
