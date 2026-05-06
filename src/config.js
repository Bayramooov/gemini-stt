function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function parseIdList(raw) {
  return new Set(
    (raw || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => {
        const n = Number(s);
        if (!Number.isInteger(n)) throw new Error(`Invalid user ID: ${s}`);
        return n;
      }),
  );
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
  allowedUserIds: parseIdList(process.env.ALLOWED_USER_IDS),
  tgBotApiUrl: process.env.TG_BOT_API_URL || 'https://api.telegram.org',

  // Gemini
  geminiApiKey: required('GEMINI_API_KEY'),
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-pro',

  // Audio pipeline
  silenceTrim: process.env.SILENCE_TRIM !== 'false',
  silenceThresholdDb: num('SILENCE_THRESHOLD_DB', -50),
  silenceMinDuration: num('SILENCE_MIN_DURATION', 0.5),
  silencePaddingSec: num('SILENCE_PADDING_SEC', 0.5),
  speedup: num('SPEEDUP_FACTOR', 1.35),
};

export function isLocalApi(url = config.tgBotApiUrl) {
  return !url.includes('api.telegram.org');
}
