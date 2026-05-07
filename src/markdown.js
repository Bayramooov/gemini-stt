// Telegram caps messages at 4096 chars; longer transcripts ship as a file.
const MESSAGE_THRESHOLD = 3800;

export function formatOutput(transcript) {
  const text = transcript.trim();
  if (text.length < MESSAGE_THRESHOLD) {
    return { kind: 'message', text: mdToTelegramHtml(text), parseMode: 'HTML' };
  }
  return { kind: 'file', filename: 'transcript.md', content: `${text}\n` };
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
