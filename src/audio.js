import ffmpeg from 'fluent-ffmpeg';
import { stat } from 'node:fs/promises';
import { promisify } from 'node:util';

const ffprobe = promisify(ffmpeg.ffprobe);

export async function probe(path) {
  let meta;
  try {
    meta = await ffprobe(path);
  } catch (err) {
    let size = '?';
    try {
      size = (await stat(path)).size;
    } catch {}
    throw new Error(`ffprobe failed on ${path} (size: ${size} bytes): ${err.message}`);
  }
  const duration = parseFloat(meta.format.duration);
  const size = Number(meta.format.size) || (await stat(path)).size;
  return { duration, size };
}

export async function optimize(input, output, opts = {}) {
  const {
    speedup = 1.35, //
    silenceTrim = true,
    silenceThresholdDb = -50,
    silenceMinDuration = 0.5,
    silencePaddingSec = 0.5,
    bitrate = '24k',
    sampleRate = 16000,
  } = opts;

  const before = await probe(input);

  const filters = [];
  if (silenceTrim) {
    filters.push(
      `silenceremove=start_periods=1` +
        `:start_duration=${silenceMinDuration}` +
        `:start_silence=${silencePaddingSec}` +
        `:start_threshold=${silenceThresholdDb}dB` +
        `:stop_periods=-1` +
        `:stop_duration=${silenceMinDuration}` +
        `:stop_silence=${silencePaddingSec}` +
        `:stop_threshold=${silenceThresholdDb}dB`,
    );
  }
  if (speedup !== 1) {
    filters.push(`atempo=${speedup}`);
  }

  let ffmpegStderr = '';
  await new Promise((resolve, reject) => {
    const cmd = ffmpeg(input)
      .audioCodec('libopus')
      .audioBitrate(bitrate)
      .audioFrequency(sampleRate)
      .audioChannels(1)
      .format('ogg')
      .on('stderr', line => {
        ffmpegStderr += line + '\n';
      })
      .on('error', err => reject(new Error(`ffmpeg failed: ${err.message}\nstderr tail:\n${ffmpegStderr.slice(-800)}`)))
      .on('end', resolve);
    if (filters.length) cmd.audioFilters(filters.join(','));
    cmd.save(output);
  });

  const outStat = await stat(output).catch(() => null);
  if (!outStat || outStat.size < 1000) {
    throw new Error(
      `Optimization produced empty/tiny output (${outStat?.size ?? 'no file'} bytes). ` +
        `The silenceremove filter consumed (almost) the entire input. ` +
        `Try SILENCE_TRIM=false or a more negative SILENCE_THRESHOLD_DB.`,
    );
  }

  const after = await probe(output);

  return {
    originalDuration: before.duration,
    optimizedDuration: after.duration,
    originalSize: before.size,
    optimizedSize: after.size,
    durationSavings: 1 - after.duration / before.duration,
    sizeSavings: 1 - after.size / before.size,
    filters,
  };
}
