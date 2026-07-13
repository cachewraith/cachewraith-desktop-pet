# Contributing to CacheWraith

Thanks for helping the little ghost grow!

## Getting started

1. Install the prerequisites listed in the README (Node.js, Rust MSVC, C++ Build Tools).
2. `npm install`
3. `npm run tauri dev`

## Before opening a pull request

Run everything:

```powershell
npm run check                 # prettier + eslint + tsc + vitest
cd src-tauri
cargo fmt
cargo clippy -- -D warnings
```

## Guidelines

- Strict TypeScript; avoid `any`.
- Keep modules small and focused; UI components never write SQL directly — use the
  repositories in `src/features/*`.
- Event names live in `src/types/events.ts` and `src-tauri/src/events.rs` — keep them in sync.
- Never commit API keys, `.env` files with secrets, databases or build output.
- New logic should come with Vitest tests when it is testable without a real window.
- Animation belongs in the PixiJS layer (`src/components/pet/ghost.ts`), not in React state.

## Commit style

Short imperative subject lines ("Add walk particles"), body only when the why is not obvious.
