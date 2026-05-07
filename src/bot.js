import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { config, isLocalApi } from './config.js';
import * as allowlist from './allowlist.js';
import { runPipeline } from './pipeline.js';

allowlist.load();

const isAdmin = id => id === config.adminUserId;
const isAllowed = id => isAdmin(id) || allowlist.has(id);

const bot = new Telegraf(config.botToken, {
  telegram: { apiRoot: config.tgBotApiUrl },
  handlerTimeout: 60 * 60 * 1000, // 60 min — long enough for the longest meetings, short enough to recover from a true deadlock
});

// DM-only: silently drop anything from groups/channels.
bot.use((ctx, next) => (ctx.chat?.type === 'private' ? next() : undefined));

const WELCOME = 'Send me a voice note or audio file. I will transcribe and reply.';

const formatWhoami = (u, allowed) => `ID: ${u.id}\n` + `Username: @${u.username ?? '(none)'}\n` + `Status: ${allowed ? 'authorized ✓' : 'not authorized — contact the admin'}`;

// /start and /whoami work for everyone in DMs (regardless of allowlist).
bot.start(ctx => {
  const u = ctx.from;
  const allowed = isAllowed(u.id);
  if (allowed) return ctx.reply(WELCOME);
  console.log(`/start unauthorized — id=${u.id}, username=@${u.username ?? 'none'}`);
  return ctx.reply(`${WELCOME}\n\n${formatWhoami(u, false)}`);
});

bot.command('whoami', ctx => {
  const u = ctx.from;
  const allowed = isAllowed(u.id);
  if (!allowed) {
    console.log(`/whoami unauthorized — id=${u.id}, username=@${u.username ?? 'none'}`);
  }
  return ctx.reply(formatWhoami(u, allowed));
});

// Admin commands.
bot.command('allow', ctx => {
  if (!isAdmin(ctx.from.id)) return;
  const id = Number(ctx.message.text.split(' ')[1]);
  if (!Number.isInteger(id)) return ctx.reply('Usage: /allow <user_id>');
  allowlist.add(id);
  return ctx.reply(`Allowed: ${id}`);
});

bot.command('deny', ctx => {
  if (!isAdmin(ctx.from.id)) return;
  const id = Number(ctx.message.text.split(' ')[1]);
  if (!Number.isInteger(id)) return ctx.reply('Usage: /deny <user_id>');
  allowlist.remove(id);
  return ctx.reply(`Denied: ${id}`);
});

bot.command('list', ctx => {
  if (!isAdmin(ctx.from.id)) return;
  const ids = allowlist.list();
  return ctx.reply(ids.length ? `Allowed users (${ids.length}):\n${ids.join('\n')}` : 'Allowlist is empty.');
});

// Allowlist: silently ignore non-allowlisted users.
bot.use((ctx, next) => (isAllowed(ctx.from?.id) ? next() : undefined));

// Audio handlers.
bot.on(message('voice'), ctx => runPipeline(ctx, ctx.message.voice.file_id));
bot.on(message('audio'), ctx => runPipeline(ctx, ctx.message.audio.file_id));
bot.on(message('document'), ctx => {
  const d = ctx.message.document;
  if (!d.mime_type?.startsWith('audio/')) {
    return ctx.reply(`Document is not audio (mime: ${d.mime_type ?? '?'}). Ignored.`);
  }
  return runPipeline(ctx, d.file_id);
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

console.log(`▶ starting bot`);
console.log(`  api:           ${config.tgBotApiUrl}  (${isLocalApi() ? 'local' : 'cloud'})`);
console.log(`  model:         ${config.geminiModel}`);
console.log(`  speedup:       ${config.speedup}×`);
console.log(`  silence trim:  ${config.silenceTrim}`);
console.log(`  admin:         ${config.adminUserId}`);
console.log(`  allowed users: ${allowlist.list().join(', ') || '(none — only admin works)'}`);

const baseCommands = [
  { command: 'start', description: 'Welcome message' },
  { command: 'whoami', description: 'Show your Telegram ID and authorization status' },
];

await bot.telegram.setMyCommands(baseCommands);

// Extra commands visible only in the admin's DM with the bot.
await bot.telegram.setMyCommands(
  [
    ...baseCommands,
    { command: 'allow', description: 'Allow a user — /allow <user_id>' },
    { command: 'deny', description: 'Deny a user — /deny <user_id>' },
    { command: 'list', description: 'List allowed users' },
  ],
  { scope: { type: 'chat', chat_id: config.adminUserId } },
);

bot.launch();
