//! Native system tray with the CacheWraith menu.

use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Wry};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_store::StoreExt;

use crate::{events, positioning, shortcuts};

fn show_pet(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("pet") {
        let _ = window.show();
        let _ = window.set_focus();
    }
    let _ = app.emit(events::SHOW_PET, ());
}

fn hide_pet(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("pet") {
        let _ = window.hide();
    }
    let _ = app.emit(events::HIDE_PET, ());
}

pub fn show_settings(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn sound_enabled_pref(app: &AppHandle) -> bool {
    app.store("preferences.json")
        .ok()
        .and_then(|store| store.get("soundEnabled"))
        .and_then(|value| value.as_bool())
        .unwrap_or(true)
}

pub fn create_tray(app: &AppHandle) -> tauri::Result<()> {
    let autostart_enabled = app.autolaunch().is_enabled().unwrap_or(false);
    let muted = !sound_enabled_pref(app);

    let show = MenuItem::with_id(app, "show", "Show CacheWraith", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", "Hide CacheWraith", true, None::<&str>)?;
    let talk = MenuItem::with_id(app, "talk", "Talk to CacheWraith", true, None::<&str>)?;
    let feed = MenuItem::with_id(app, "feed", "Feed CacheWraith", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Open Settings", true, None::<&str>)?;
    let autostart = CheckMenuItem::with_id(
        app,
        "autostart",
        "Start with Windows",
        true,
        autostart_enabled,
        None::<&str>,
    )?;
    let mute = CheckMenuItem::with_id(app, "mute", "Mute Sounds", true, muted, None::<&str>)?;
    let reset_pos = MenuItem::with_id(app, "reset_pos", "Reset Pet Position", true, None::<&str>)?;
    let about = MenuItem::with_id(app, "about", "About", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let sep = || PredefinedMenuItem::separator(app);

    let menu = Menu::with_items(
        app,
        &[
            &show,
            &hide,
            &sep()?,
            &talk,
            &feed,
            &sep()?,
            &settings,
            &autostart,
            &mute,
            &reset_pos,
            &sep()?,
            &about,
            &quit,
        ],
    )?;

    let autostart_item = autostart.clone();
    let mute_item = mute.clone();

    TrayIconBuilder::with_id("cachewraith-tray")
        .icon(
            app.default_window_icon()
                .cloned()
                .ok_or(tauri::Error::WindowNotFound)?,
        )
        .tooltip("CacheWraith")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| {
            handle_menu_event(app, event.id().as_ref(), &autostart_item, &mute_item)
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::DoubleClick { .. } = event {
                show_pet(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn handle_menu_event(
    app: &AppHandle,
    id: &str,
    autostart_item: &CheckMenuItem<Wry>,
    mute_item: &CheckMenuItem<Wry>,
) {
    match id {
        "show" => show_pet(app),
        "hide" => hide_pet(app),
        "talk" => {
            show_pet(app);
            let _ = app.emit(events::OPEN_CHAT, ());
        }
        "feed" => {
            show_pet(app);
            let _ = app.emit(events::FEED_PET, ());
        }
        "settings" => show_settings(app),
        "autostart" => {
            let manager = app.autolaunch();
            let currently = manager.is_enabled().unwrap_or(false);
            let result = if currently {
                manager.disable()
            } else {
                manager.enable()
            };
            if result.is_err() {
                eprintln!("[cachewraith] failed to toggle autostart");
            }
            // Reflect the real OS state, not the intended one.
            let actual = manager.is_enabled().unwrap_or(false);
            let _ = autostart_item.set_checked(actual);
            let _ = app.emit(events::AUTOSTART_CHANGED, actual);
        }
        "mute" => {
            let enabled = sound_enabled_pref(app);
            let next_enabled = !enabled;
            if let Ok(store) = app.store("preferences.json") {
                store.set("soundEnabled", serde_json::Value::Bool(next_enabled));
                let _ = store.save();
            }
            let _ = mute_item.set_checked(!next_enabled);
            let _ = app.emit(events::TOGGLE_MUTE, next_enabled);
        }
        "reset_pos" => {
            if let Ok(pos) = positioning::reset_to_corner(app) {
                show_pet(app);
                let _ = app.emit(events::RESET_POSITION, pos);
            }
        }
        "about" => {
            show_settings(app);
            let _ = app.emit(events::OPEN_SETTINGS_SECTION, "about");
        }
        "quit" => {
            let _ = app.global_shortcut_cleanup();
            app.exit(0);
        }
        _ => {}
    }
}

trait GlobalShortcutCleanup {
    fn global_shortcut_cleanup(&self) -> Result<(), String>;
}

impl GlobalShortcutCleanup for AppHandle {
    fn global_shortcut_cleanup(&self) -> Result<(), String> {
        use tauri_plugin_global_shortcut::GlobalShortcutExt;
        self.global_shortcut()
            .unregister(shortcuts::ACCELERATOR)
            .map_err(|e| e.to_string())
    }
}
