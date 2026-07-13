mod ai;
mod commands;
mod events;
mod positioning;
#[cfg(desktop)]
mod shortcuts;
#[cfg(desktop)]
mod tray;

use tauri::WindowEvent;
use tauri_plugin_sql::{Migration, MigrationKind};

fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "create initial tables",
        sql: include_str!("../migrations/0001_init.sql"),
        kind: MigrationKind::Up,
    }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:cachewraith.db", migrations())
                .build(),
        );

    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build());

    builder
        .invoke_handler(tauri::generate_handler![
            commands::apply_saved_position,
            commands::reset_pet_position,
            commands::get_shortcut_status,
            ai::ai_set_api_key,
            ai::ai_has_api_key,
            ai::ai_clear_api_key,
            ai::ai_chat,
            ai::ai_test_connection,
        ])
        .setup(|app| {
            #[cfg(desktop)]
            {
                tray::create_tray(app.handle())?;
                shortcuts::register_toggle_shortcut(app.handle());
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing any window only hides it; the app lives in the tray
            // and quits exclusively through the tray "Quit" entry.
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running CacheWraith");
}
