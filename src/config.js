// Lift Node's bundled undici headersTimeout (default 5 min) so long Gemini
// transcriptions don't fail with UND_ERR_HEADERS_TIMEOUT after we've been
// billed. Done via the public global-dispatcher symbol to avoid pulling a
// separate `undici` npm package, which would clash with Node's bundled version.
{
  const sym = Symbol.for('undici.globalDispatcher.1');
  fetch('data:,').catch(() => {}); // trigger lazy init of the global dispatcher
  const Agent = globalThis[sym].constructor;
  globalThis[sym] = new Agent({ headersTimeout: 60 * 60 * 1000, bodyTimeout: 60 * 60 * 1000 });
}

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

export const isLocalApi = (url = config.tgBotApiUrl) => !url.includes('api.telegram.org');
