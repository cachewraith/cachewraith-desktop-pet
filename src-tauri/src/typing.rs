//! Global keyboard-activity watcher so the pet can "type along" with the
//! user. Privacy: only *whether* any key is currently pressed is checked
//! (via polling, no keyboard hook). Key identities are never inspected,
//! stored, logged or transmitted.

use std::thread;
use std::time::{Duration, Instant};

use device_query::{DeviceQuery, DeviceState};
use tauri::{AppHandle, Emitter, Runtime};

/// How often the keyboard state is sampled.
const POLL_MS: u64 = 200;
/// Minimum gap between emitted activity events, so sustained typing does
/// not flood the webviews.
const EMIT_GAP: Duration = Duration::from_millis(600);

pub fn spawn_typing_watcher<R: Runtime>(app: AppHandle<R>) {
    thread::spawn(move || {
        let device = DeviceState::new();
        let mut last_emit = Instant::now() - EMIT_GAP;
        loop {
            thread::sleep(Duration::from_millis(POLL_MS));
            let any_key_down = !device.get_keys().is_empty();
            if any_key_down && last_emit.elapsed() >= EMIT_GAP {
                last_emit = Instant::now();
                let _ = app.emit(crate::events::USER_TYPING, ());
            }
        }
    });
}
