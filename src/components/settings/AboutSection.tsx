export function AboutSection() {
  return (
    <section aria-labelledby="about-heading">
      <h2 id="about-heading">About</h2>
      <p>
        <strong>CacheWraith</strong> v0.1.0 — a small, friendly ghost that lives on your desktop.
      </p>
      <h3>Keyboard shortcut</h3>
      <p>
        <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Space</kbd> toggles the pet's visibility.
      </p>
      <h3>Technology</h3>
      <p>Built with Tauri 2, Rust, React, TypeScript, Vite, PixiJS, XState and SQLite.</p>
      <h3>Privacy</h3>
      <p>
        Everything CacheWraith knows — its stats, your conversations and settings — is stored
        locally on this computer. Nothing is sent anywhere unless you enable AI chat, in which case
        your messages are sent to OpenAI using your own API key. The key is kept in the Windows
        Credential Manager and is never bundled with the app.
      </p>
    </section>
  );
}
