# gemini-stt

Personal Telegram bot. Send a voice note, audio file, or video → get back a transcript via Gemini.

- **Audio optimization** — silence trim + speedup + Opus re-encode. ~30–40% cheaper Gemini calls.
- **Returns the optimized audio** before transcribing, so you can hear what Gemini hears.
- **Smart output** — short transcripts as a Telegram message, long ones as a `.txt` document.
- **Speaker diarization** with timestamps (configured in [`src/prompt.md`](src/prompt.md)).
- **Two run modes**: docker (self-hosted Bot API, 2 GB files) or local (cloud Bot API, 20 MB files).

## Setup

### 1. Configure

```bash
cp .env.example .env
# fill in BOT_TOKEN, ADMIN_USER_ID, GEMINI_API_KEY
```

For docker mode, also fill `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` from <https://my.telegram.org/apps>.

### 2. Run

**Docker** (production / self-hosted):

First time only — release the bot from Telegram's cloud:

```bash
curl -X POST "https://api.telegram.org/bot$BOT_TOKEN/logOut"
```

Then:

```bash
docker compose up -d --build
docker compose logs -f bot
```

**Local** (dev / cloud API) — requires Node 20+ and `ffmpeg` on `PATH` ([install](#installing-ffmpeg)):

```bash
npm install
npm run dev:start
```

Don't run both modes at once — Telegram allows only one polling client per token.

## How it works

1. Voice/audio/video arrives → bot downloads it (HTTPS in cloud mode; direct disk read from shared `tg-data` volume in self-hosted mode).
2. ffmpeg extracts audio (video stream dropped) and optimizes: trim silences, speed up, encode to 16 kHz mono Opus.
3. Bot sends the optimized file back so you can hear what's going to Gemini.
4. File uploaded to Gemini File API; `generateContent` called with the system instruction from [`src/prompt.md`](src/prompt.md).
5. Transcript replied as inline message (< 3800 chars) or `transcript.txt` document.

Edit [`src/prompt.md`](src/prompt.md) to change transcription behavior (speaker labels, language, formatting). Restart the bot.

## Configuration

Defaults work; tune in `.env` only if needed.

**Required**

- `BOT_TOKEN` — from [@BotFather](https://t.me/BotFather).
- `ADMIN_USER_ID` — your Telegram user ID. DM `/whoami` to find it. Admin is always allowed and can manage the allowlist via `/allow <id>`, `/deny <id>`, `/list`. Other users are persisted in `data/access.json`.
- `GEMINI_API_KEY` — from <https://aistudio.google.com/apikey>.

**Required for docker (self-hosted bot-api)**

- `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` — from <https://my.telegram.org/apps>. Read by the bot-api container only.

**Gemini**

- `GEMINI_MODEL` — `gemini-2.5-pro` (default) or `gemini-2.5-flash` (~3× cheaper).

Audio optimization parameters (silence trim, 1.25× speedup) are hardcoded in [`src/audio.js`](src/audio.js).

## Reverting docker → local

```bash
curl -X POST "http://localhost:8081/bot$BOT_TOKEN/close"
docker compose down
```

`close` returns 429 in the first 10 minutes after the local server starts — Telegram-side limit, wait and retry.

## Installing ffmpeg

Only needed for local mode. Docker bundles its own.

**macOS**:

```bash
brew install ffmpeg
```

**Linux** (Debian / Ubuntu):

```bash
sudo apt update && sudo apt install -y ffmpeg
```

Arch: `sudo pacman -S ffmpeg`. Fedora/RHEL: `sudo dnf install ffmpeg`.

**Windows** (winget, built into Windows 10/11):

```powershell
winget install Gyan.FFmpeg
```

Alternatives: `choco install ffmpeg` or `scoop install ffmpeg`.

Verify with `ffmpeg -version`.
