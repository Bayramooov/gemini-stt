function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function parseId(name) {
  const v = required(name);
  const n = Number(v);
  if (!Number.isInteger(n)) throw new Error(`Invalid ${name}: ${v}`);
  return n;
}

function num(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid ${name}: ${raw} (must be a number)`);
  }
  return n;
}

export const config = {
  // Telegram
  botToken: required('BOT_TOKEN'),
  adminUserId: parseId('ADMIN_USER_ID'),
  tgBotApiUrl: process.env.TG_BOT_API_URL || 'https://api.telegram.org',

  // Gemini
  geminiApiKey: required('GEMINI_API_KEY'),
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-pro',

  // Audio pipeline
  silenceTrim: process.env.SILENCE_TRIM !== 'false',
  silenceThresholdDb: num('SILENCE_THRESHOLD_DB', -50),
  silenceMinDuration: num('SILENCE_MIN_DURATION', 0.5),
  silencePaddingSec: num('SILENCE_PADDING_SEC', 0.5),
  speedup: num('SPEEDUP_FACTOR', 1.3),
};

export function isLocalApi(url = config.tgBotApiUrl) {
  return !url.includes('api.telegram.org');
}
