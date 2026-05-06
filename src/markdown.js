// Decides how to deliver a transcript to Telegram based on its length.
// Telegram's hard cap is 4096 chars per message; we leave headroom for footer.
const SHORT_THRESHOLD = 500;
const MESSAGE_THRESHOLD = 3800;

export function formatOutput(transcript, meta) {
  const text = transcript.trim();

  if (text.length < SHORT_THRESHOLD) {
    return { kind: 'message', text: mdToTelegramHtml(text), parseMode: 'HTML' };
  }

  if (text.length < MESSAGE_THRESHOLD) {
    const footer = `\n\n<i>${fmtDuration(meta.optimizedDuration)} · ${meta.model} · $${meta.cost.toFixed(4)}</i>`;
    return { kind: 'message', text: mdToTelegramHtml(text) + footer, parseMode: 'HTML' };
  }

  return { kind: 'file', filename: 'transcript.md', content: buildMarkdown(text, meta) };
}

// Converts the standard markdown Gemini might emit into Telegram HTML, after
// escaping HTML-special chars in the rest of the text. Supported:
//   **bold**       → <b>bold</b>
//   _italic_       → <i>italic</i>   (skipped inside words like snake_case)
//   *italic*       → <i>italic</i>
//   ~~strike~~     → <s>strike</s>
//   `code`         → <code>code</code>
function mdToTelegramHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(?<!\w)_([^_\n]+?)_(?!\w)/g, '<i>$1</i>')
    .replace(/\*([^*\n]+?)\*/g, '<i>$1</i>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/`([^`\n]+?)`/g, '<code>$1</code>');
}

function buildMarkdown(transcript, meta) {
  const lines = [
    '---',
    `original_duration: ${fmtDuration(meta.originalDuration)}`,
    `optimized_duration: ${fmtDuration(meta.optimizedDuration)}`,
    `duration_savings: ${(meta.durationSavings * 100).toFixed(1)}%`,
    `model: ${meta.model}`,
    `transcribed_at: ${new Date().toISOString()}`,
    `audio_tokens: ${meta.audioTokens}`,
    `output_tokens: ${meta.outputTokens}`,
    `estimated_cost_usd: ${meta.cost.toFixed(4)}`,
    '---',
    '',
    transcript,
    '',
  ];
  return lines.join('\n');
}

export function fmtDuration(seconds) {
  if (!Number.isFinite(seconds)) return '?';
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function fmtBytes(b) {
  if (b == null) return '?';
  if (b >= 1e9) return `${(b / 1e9).toFixed(2)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(2)} MB`;
  if (b >= 1e3) return `${(b / 1e3).toFixed(1)} KB`;
  return `${b} B`;
}
