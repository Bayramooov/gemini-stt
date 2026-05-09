function str(name, fallback) {
  const v = process.env[name] || fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function int(name, fallback) {
  const v = str(name, fallback);
  const n = Number(v);
  if (!Number.isInteger(n)) throw new Error(`Invalid ${name}: ${v}`);
  return n;
}

export const config = {
  // Telegram
  botToken: str('BOT_TOKEN'),
  adminUserId: int('ADMIN_USER_ID'),
  tgBotApiUrl: str('TG_BOT_API_URL', 'https://api.telegram.org'),

  // Gemini
  geminiApiKey: str('GEMINI_API_KEY'),
  geminiModel: str('GEMINI_MODEL', 'gemini-2.5-pro'),

  // Concurrency
  maxConcurrent: Math.max(1, int('MAX_CONCURRENT', 4)),
};

export function isLocalApi(url = config.tgBotApiUrl) {
  return !url.includes('api.telegram.org');
}
