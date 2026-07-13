//! Global shortcut (Ctrl+Shift+Space) that toggles pet visibility.

use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use crate::events;

pub const ACCELERATOR: &str = "ctrl+shift+space";

#[derive(Debug, Clone, Serialize)]
pub struct ShortcutStatus {
    pub accelerator: String,
    pub registered: bool,
    pub error: Option<String>,
}

pub struct ShortcutStatusState(pub Mutex<ShortcutStatus>);

pub fn toggle_pet_visibility<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_webview_window("pet") else {
        return;
    };
    match window.is_visible() {
        Ok(true) => {
            let _ = window.hide();
            let _ = app.emit(events::HIDE_PET, ());
        }
        Ok(false) => {
            let _ = window.show();
            let _ = window.set_focus();
            let _ = app.emit(events::SHOW_PET, ());
        }
        Err(_) => {}
    }
}

/// Register the toggle shortcut. Never panics: if another application owns
/// the accelerator, the failure is recorded and surfaced in Settings via
/// the `get_shortcut_status` command.
pub fn register_toggle_shortcut(app: &AppHandle) {
    let result = app
        .global_shortcut()
        .on_shortcut(ACCELERATOR, |app_handle, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                toggle_pet_visibility(app_handle);
            }
        });

    let status = match result {
        Ok(()) => ShortcutStatus {
            accelerator: ACCELERATOR.to_string(),
            registered: true,
            error: None,
        },
        Err(e) => ShortcutStatus {
            accelerator: ACCELERATOR.to_string(),
            registered: false,
            error: Some(e.to_string()),
        },
    };
    app.manage(ShortcutStatusState(Mutex::new(status)));
}

pub fn status(app: &AppHandle) -> ShortcutStatus {
    match app.try_state::<ShortcutStatusState>() {
        Some(state) => state.0.lock().expect("shortcut status poisoned").clone(),
        None => ShortcutStatus {
            accelerator: ACCELERATOR.to_string(),
            registered: false,
            error: Some("shortcut registration did not run".to_string()),
        },
    }
}
