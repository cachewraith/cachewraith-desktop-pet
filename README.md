# CacheWraith 👻

A lightweight animated AI desktop pet for Windows. CacheWraith is a small, friendly digital
ghost that floats above your taskbar: it idles, walks, sleeps, eats, celebrates — and chats
with you, either fully offline or powered by your own OpenAI API key.

## Screenshots

> _Placeholders — add screenshots here._
>
> - Pet floating on the desktop
> - Chat panel open
> - Settings window

## Features

- Transparent, borderless, always-on-top pet window near the bottom-right corner
- Drag the ghost anywhere; its position is remembered and restored (monitor-aware — if a saved
  position is off-screen after a monitor change, it snaps back to the primary monitor)
- System tray with Show/Hide, Talk, Feed, autostart + mute toggles, Reset Position, About, Quit
- Global shortcut **Ctrl+Shift+Space** toggles pet visibility
- XState-driven behavior: idle, walking, sleeping, happy, sad, hungry, eating, talking,
  celebrating, dragging, hidden
- PixiJS-rendered original ghost with blinking, floating, particles and reduced-motion support
- Pet statistics (happiness, energy, hunger, XP, levels) persisted in SQLite
- Compact chat panel with history; works fully offline with local fallback replies
- Optional OpenAI integration (Responses API) — the key is stored in the
  **Windows Credential Manager**, never in files, code or the database
- Settings window: General, Pet, AI, Data (JSON export/import) and About
- First-run onboarding, optional notifications, tiny generated sound effects
- Start-with-Windows via the official Tauri autostart plugin

## Technology stack

Tauri 2 · Rust · React 19 · TypeScript (strict) · Vite 7 · PixiJS 8 · XState 5 ·
SQLite (tauri-plugin-sql) · tauri-plugin-store / autostart / notification / global-shortcut ·
ESLint · Prettier · Vitest

## Prerequisites (Windows)

| Tool | Install |
| --- | --- |
| Node.js ≥ 20 | <https://nodejs.org> |
| Rust (stable MSVC) | `winget install Rustlang.Rustup` then `rustup default stable-x86_64-pc-windows-msvc` |
| Microsoft C++ Build Tools | `winget install Microsoft.VisualStudio.2022.BuildTools` (select "Desktop development with C++") |
| WebView2 Runtime | Preinstalled on Windows 10/11; otherwise `winget install Microsoft.EdgeWebView2Runtime` |

## Setup

```powershell
npm install
```

## Development

```powershell
npm run tauri dev      # run the desktop app with hot reload
npm run dev            # frontend only (browser, limited functionality)
```

Frontend checks:

```powershell
npm run check          # format:check + lint + typecheck + tests
npm run lint           # ESLint
npm run lint:fix
npm run format         # Prettier write
npm run format:check
npm run typecheck      # tsc --noEmit
npm test               # Vitest
```

Rust checks (run inside `src-tauri/`):

```powershell
cargo fmt
cargo check
cargo clippy -- -D warnings
```

## Production build

```powershell
npm run tauri build
```

Installers are written to `src-tauri/target/release/bundle/`:

- NSIS installer: `bundle/nsis/CacheWraith_0.1.0_x64-setup.exe`
- MSI installer: `bundle/msi/CacheWraith_0.1.0_x64_en-US.msi`

## Project structure

```text
src/                    React frontend
├── app/                App shells (pet window, settings window, error boundary)
├── components/         pet / chat / settings UI components
├── features/           pet (machine, stats, repo, service), chat, settings logic
├── services/           ai, database, storage, autostart, notifications, shortcuts, sound, windows
├── styles/             plain CSS, organized per surface
├── types/              shared types incl. central event names
└── utils/              logger, clamp

src-tauri/              Rust backend
├── capabilities/       Tauri permission capabilities (least privilege)
├── icons/              generated project-owned icons (scripts/generate-icon.mjs)
├── migrations/         SQLite migrations
└── src/                lib.rs, tray.rs, positioning.rs, shortcuts.rs, ai.rs, commands.rs
```

## AI configuration

1. Open **Settings → AI** (tray icon → Open Settings).
2. Enable AI, paste your OpenAI API key, and click **Save key**.
3. Optionally change the model (default: `gpt-5-mini`) and the pet personality.
4. Click **Test connection**.

**Privacy / key handling:** the key is stored in the Windows Credential Manager via the Rust
`keyring` crate. It is never written to preferences, SQLite, logs or the frontend. All OpenAI
requests are sent from the Rust side using the Responses API. Using your own key may incur
costs billed by OpenAI. Without a key, CacheWraith answers with honest local fallback phrases —
it never fakes an AI response.

## Database location

`%APPDATA%\com.cachewraith.desktoppet\cachewraith.db` (shown precisely in Settings → Data).
Preferences live next to it in `preferences.json`.

## Autostart

Settings → General → “Start CacheWraith when I sign in to Windows” uses the official Tauri
autostart plugin (registry Run key, current user). The checkbox always reflects the real OS
state; failures are reported instead of silently claimed.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+Shift+Space` | Toggle pet visibility (global) |
| `Enter` | Send chat message |
| `Shift+Enter` | New line in chat |
| `Esc` | Close chat panel |

## Troubleshooting

- **Pet is invisible** — press `Ctrl+Shift+Space` or double-click the tray icon. Use tray →
  Reset Pet Position if it ended up off-screen.
- **Shortcut not working** — another app may own `Ctrl+Shift+Space`; Settings → General shows
  the registration status.
- **Blank window** — make sure the WebView2 Runtime is installed.
- **AI errors** — Settings → AI → Test connection distinguishes invalid keys, rate limits and
  network problems.
- **Build fails with linker errors** — install the Microsoft C++ Build Tools workload.

## Known limitations

- Within its 280×320 window rectangle the transparent area still captures mouse events
  (Tauri/WebView2 has no per-pixel hit testing).
- A pending AI request cannot be aborted mid-flight; a newer message simply supersedes it.
- The global shortcut is fixed to `Ctrl+Shift+Space` in this MVP.
- Import/export uses copy/paste JSON instead of file dialogs (keeps filesystem permissions at
  zero).

## Roadmap

1. Per-pixel window hit-testing so clicks pass through empty areas.
2. Configurable global shortcut and more pet skins/accessories.
3. Streaming AI responses with cancel support.

## License

MIT — see [LICENSE](LICENSE).
