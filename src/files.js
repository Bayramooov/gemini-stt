import { createWriteStream } from 'node:fs';
import { mkdir, copyFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { isLocalApi } from './config.js';

// Downloads a Telegram file to destPath, regardless of whether we're using the
// hosted Bot API (HTTPS download) or a self-hosted server (already on disk at
// the same path the bot can read directly).
export async function downloadTelegramFile(telegram, fileId, destPath) {
  await mkdir(dirname(destPath), { recursive: true });

  if (isLocalApi()) {
    const file = await telegram.getFile(fileId);
    await copyFile(file.file_path, destPath);
    return;
  }

  const url = await telegram.getFileLink(fileId);
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Download failed: HTTP ${res.status}`);
  }
  await pipeline(res.body, createWriteStream(destPath));
}
