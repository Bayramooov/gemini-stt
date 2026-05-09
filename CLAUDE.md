# Project philosophy

When changing this codebase, optimize in this order:

1. **UX.** What the user sees and feels using the bot. Per-chat command scoping, helpful command menus, clear error messages — these stay even if they cost LOC.
2. **Readable.** Code a person can understand at a glance.
3. **Simple.** Each piece does one thing the most direct way.
4. **Solid.** Don't drop error context, debugging info, or operational signals just to save lines.
5. **Few LOC.** Less code is better — but only after the four above are satisfied.

Fewer lines is the _last_ goal, not the first. If a refactor makes the file shorter but harder to read, or worsens the user experience, undo it.

## Concrete rules

- **UX over LOC.** Things like per-chat admin command scope, `/list`, helpful "ignored: wrong mime" replies — keep them. They cost a few lines and save real friction.
- **Don't loop to dedupe handler-style code.** Four explicit `bot.on(...)` lines beat a `for` loop with dynamic property access. Repetition is fine when each line is independently scannable.
- **Don't introduce premature abstractions.** 3–7 similar lines are acceptable. Abstract only when duplication is large _and_ the pattern recurs across modules.
- **Delete dead code aggressively.** Returned fields nobody reads, computed values nobody uses — gone.
- **Pass-through configs.** When a function destructures the fields it cares about, pass the whole config object instead of copying field-by-field.
- **Keep error context.** If a function enriches errors with diagnostic info (path, size, stderr tail), don't strip it for LOC.
- **Comments only when WHY is non-obvious.** Don't restate WHAT the code does.
- **No backwards-compat shims** when a clean change is possible.

## Operational notes

- Prompt at [src/prompt.md](src/prompt.md) is read once at startup. Restart the bot after editing.
- Persistent state: `data/access.json` (allowlist) and temp working files. No DB.
- Two run modes: docker (self-hosted bot-api, 2 GB files) and local (cloud API, 20 MB).
- Video is supported by extracting the audio track via ffmpeg (`-vn`).
