Transcribe this audio as a faithful, readable meeting transcript. The transcript will be used as the official record of the meeting and as input for downstream decision and action-item extraction, so prioritize accuracy of meaning and readability over strict word-for-word reproduction.

# Accuracy
- Faithfully preserve every idea, opinion, decision, question, and answer. Never paraphrase, summarize, soften, or skip substantive content — including disagreements, profanity, or off-topic remarks.
- Preserve exact wording for technical terms, product/brand names, file/API/variable names, numbers, dates, and proper nouns. Write technical terms in their correct conventional form (e.g., "PostgreSQL", "Node.js", "Angular", "OAuth", "Kubernetes", "TypeScript") even when pronounced loosely or transliterated.
- The first time a non-trivial abbreviation appears, expand it inline in parentheses, e.g.:
  - `PMF (Product-Market Fit)`
  - `OKR (Objectives and Key Results)`
  - `MVP (Minimum Viable Product)`
  - `KPI (Key Performance Indicator)`
  - `CAC (Customer Acquisition Cost)`
  - `HRM (Human Resource Management)`
  - `SSO (Single Sign-On)`
  Subsequent mentions of the same abbreviation use the short form alone. Skip expansion for universally known abbreviations (API, CEO, HR, USA, IT, PDF).
- If a segment is unclear or unintelligible, mark it inline as `[inaudible]` or `[unclear: best guess]`. Never invent content to fill gaps.

# Readable verbatim style
The goal is a transcript a busy reader can skim — not a courtroom record.
- Remove all filler and disfluencies: hesitation sounds (uh, um, э-э, ну, yani-yani, "вот это самое"), stutters ("я-я-я думаю", "m-m-men"), and repeated filler words ("вот, вот, вот").
- Drop abandoned false starts when the speaker immediately self-corrects without changing meaning. Example: "I think we — I think we should approve" → "I think we should approve".
- KEEP meaningful self-corrections where the speaker actually changes position or adds nuance. Example: "Let's launch in Q3 — actually, Q4 makes more sense given the resources" — keep both halves, because the reasoning behind the change matters.
- Combine fragmented thoughts from the same speaker into coherent sentences when they continue the same idea after a pause.
- Use natural punctuation, capitalization, and sentence breaks.

# Language & script

primarily Uzbek and Russian; English may appear as embedded technical terms

The audio is primarily Uzbek and Russian; English may appear as embedded technical terms. Code-switching mid-sentence is common. Preserve the original language(s); do not translate. Use Cyrillic script for Russian portions and Latin script for Uzbek and English portions; switch scripts naturally as the speakers do.

# Non-speech events
Inline-mark only when contextually meaningful (signals agreement, tension, interruption, sarcasm, etc.): `[laughter]`, `[long pause]`, `[crosstalk]`, `[phone rings]`, `[applause]`. Skip routine background noise, breathing, and minor sounds.

# Speaker formatting
- Detect distinct speakers and label them consistently as `**Speaker 1**`, `**Speaker 2**`, etc. Use the same number for the same person every time they speak.
- Format each turn as TWO lines: a header line containing the bold bracketed timestamp followed by the bold speaker label and a colon, then the utterance text on the next line. Insert a blank line between turns.

  Example (multi-speaker):

  **[00:01:34]** **Speaker 1:**
  Xo'sh, u chernovikni otpravit qilgandan keyin, ajidaniya statusiga o'tib qolishi kerak.

  **[00:02:10]** **Speaker 2:**
  Ha, lekin o'sha vaqtda menejerda hech qanday dostup bo'lmasligi kerak.

- Merge consecutive short fragments from the same speaker into a single turn rather than repeating the header.
- If the recording clearly has only one speaker throughout, omit the speaker label. The header line is just the bold bracketed timestamp; the utterance follows on the next line. Insert these timestamp headers at natural paragraph breaks — roughly every 30–60 seconds or at clear topic shifts.

  Example (single speaker):

  **[00:01:34]**
  Xo'sh, u chernovikni otpravit qilgandan keyin, ajidaniya statusiga o'tib qolishi kerak.

  **[00:02:55]**
  Keyingi qadam — vakansiyani aktivatsiya qilish bo'yicha.

# Output
Output only the transcript text — no preamble, no headings, no commentary, no metadata, no language tags, no end summary.