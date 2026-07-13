use tauri::AppHandle;

use crate::positioning::{self, WindowPos};

/// Restore a previously saved pet-window position, falling back to the
/// bottom-right corner when the saved spot is off-screen (e.g. after a
/// monitor was unplugged). Returns the position that was actually applied.
#[tauri::command]
pub fn apply_saved_position(
    app: AppHandle,
    x: Option<i32>,
    y: Option<i32>,
) -> Result<WindowPos, String> {
    let window = positioning::pet_window(&app)?;
    if let (Some(x), Some(y)) = (x, y) {
        if positioning::is_position_reachable(&window, x, y) {
            let pos = WindowPos { x, y };
            positioning::move_window(&window, pos)?;
            return Ok(pos);
        }
    }
    let pos = positioning::corner_position(&window)?;
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
