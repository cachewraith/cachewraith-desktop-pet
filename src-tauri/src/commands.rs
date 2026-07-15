use tauri::{AppHandle, WebviewWindow};

use crate::positioning::{self, WindowPos};

/// Restore a previously saved position for the window that invoked the
/// command (the main pet or a companion), falling back to the bottom-right
/// corner when the saved spot is off-screen (e.g. after a monitor was
/// unplugged). `offset_x` shifts the corner fallback left so companion
/// windows fan out instead of stacking. Returns the applied position.
#[tauri::command]
pub fn apply_saved_position(
    window: WebviewWindow,
    x: Option<i32>,
    y: Option<i32>,
    offset_x: Option<i32>,
) -> Result<WindowPos, String> {
    if let (Some(x), Some(y)) = (x, y) {
        if positioning::is_position_reachable(&window, x, y) {
            let pos = WindowPos { x, y };
            positioning::move_window(&window, pos)?;
            return Ok(pos);
        }
    }
    let pos = positioning::corner_position(&window, offset_x.unwrap_or(0))?;
    positioning::move_window(&window, pos)?;
    Ok(pos)
}

#[tauri::command]
pub fn reset_pet_position(app: AppHandle) -> Result<WindowPos, String> {
    positioning::reset_to_corner(&app)
}

#[tauri::command]
pub fn get_shortcut_status(app: AppHandle) -> crate::shortcuts::ShortcutStatus {
    crate::shortcuts::status(&app)
}

/// Update the tray tooltip to the active character's name.
#[tauri::command]
pub fn set_tray_tooltip(app: AppHandle, tooltip: String) -> Result<(), String> {
    let trimmed: String = tooltip.chars().take(60).collect();
    match app.tray_by_id("cachewraith-tray") {
        Some(tray) => tray.set_tooltip(Some(trimmed)).map_err(|e| e.to_string()),
        None => Err("tray icon not found".to_string()),
    }
}
