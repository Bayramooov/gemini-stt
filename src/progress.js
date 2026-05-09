// Sends one Telegram message and edits it over time. Edit failures (rate
// limits, deleted message, etc.) are silently swallowed — they aren't
// actionable and would otherwise crash the ticker.
export class Progress {
  constructor(ctx) {
    this.ctx = ctx;
    this.text = '';
    this.messageId = null;
    this.timer = null;
  }

  async show(text) {
    if (text === this.text) return;
    if (!this.messageId) {
      const sent = await this.ctx.reply(text);
      this.messageId = sent.message_id;
      this.text = text;
      return;
    }
    try {
      await this.ctx.telegram.editMessageText(this.ctx.chat.id, this.messageId, undefined, text);
      this.text = text;
    } catch {}
  }

  startTicker(fn) {
    this.stopTicker();
    const tick = () => this.show(fn());
    tick();
    this.timer = setInterval(tick, 2000);
  }

  stopTicker() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async finish(text) {
    this.stopTicker();
    await this.show(text);
  }
}
