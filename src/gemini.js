import { GoogleGenAI } from '@google/genai';
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 8;
const BASE_BACKOFF_MS = 1500;
const MAX_BACKOFF_MS = 30_000;

// Prompt lives in src/prompt.md — edit there, restart the bot to pick up changes.
const PROMPT_PATH = resolve(dirname(fileURLToPath(import.meta.url)), 'prompt.md');
const TRANSCRIPTION_PROMPT = readFileSync(PROMPT_PATH, 'utf8').trim();

const PRICING = {
  'gemini-2.5-flash': { audio: 1.0, text: 0.3, output: 2.5 },
  'gemini-2.5-pro': { audio: 1.0, text: 1.25, output: 10.0 },
};

export function createClient(apiKey) {
  if (!apiKey) throw new Error('GEMINI_API_KEY is required');
  return new GoogleGenAI({ apiKey });
}

export async function transcribe(client, audioPath, opts = {}) {
  const {
    model = 'gemini-2.5-pro', //
    mimeType = 'audio/ogg',
    prompt = TRANSCRIPTION_PROMPT,
  } = opts;

  const uploaded = await withRetry(
    () =>
      client.files.upload({
        file: audioPath,
        config: { mimeType, displayName: basename(audioPath) },
      }),
    opts.onRetry,
  );
  opts.onRetry?.(null);

  const ready = await waitUntilActive(client, uploaded.name);

  const t0 = Date.now();
  const response = await withRetry(
    () =>
      client.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [{ fileData: { fileUri: ready.uri, mimeType } }],
          },
        ],
        config: { systemInstruction: prompt },
      }),
    opts.onRetry,
  );
  opts.onRetry?.(null);
  const generationMs = Date.now() - t0;

  client.files.delete({ name: ready.name }).catch(() => {});

  const usage = response.usageMetadata ?? {};
  const audioModality = usage.promptTokensDetails?.find(d => d.modality === 'AUDIO');

  return {
    text: response.text ?? '',
    model,
    promptTokens: usage.promptTokenCount ?? 0,
    audioTokens: audioModality?.tokenCount ?? 0,
    outputTokens: usage.candidatesTokenCount ?? 0,
    generationMs,
  };
}

export function estimateCost({ model, audioTokens, promptTokens, outputTokens }) {
  const p = PRICING[model];
  if (!p) return null;
  const textTokens = Math.max(0, (promptTokens ?? 0) - (audioTokens ?? 0));
  return (audioTokens * p.audio + textTokens * p.text + outputTokens * p.output) / 1_000_000;
}

async function waitUntilActive(client, name) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let file = await client.files.get({ name });
  while (file.state === 'PROCESSING') {
    if (Date.now() > deadline) {
      throw new Error(`File ${name} still PROCESSING after ${POLL_TIMEOUT_MS / 1000}s`);
    }
    await sleep(POLL_INTERVAL_MS);
    file = await client.files.get({ name });
  }
  if (file.state !== 'ACTIVE') {
    throw new Error(`File ${name} ended in state ${file.state}`);
  }
  return file;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function withRetry(fn, onRetry) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      const status = err?.status ?? err?.response?.status;
      if (!RETRYABLE_STATUSES.has(status) || attempt >= MAX_RETRIES) throw err;
      attempt++;
      const delayMs = Math.min(BASE_BACKOFF_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS) + Math.random() * BASE_BACKOFF_MS * 0.5;
      onRetry?.({ attempt, status, delayMs, error: err, maxRetries: MAX_RETRIES });
      await sleep(delayMs);
    }
  }
}
