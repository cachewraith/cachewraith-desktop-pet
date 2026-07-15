//! Monitor-aware helpers for placing the pet window.

use serde::Serialize;
use tauri::{AppHandle, Manager, PhysicalPosition, Runtime, WebviewWindow};

/// Margin between the pet window and the work-area edge, in physical pixels
/// (scaled by the monitor's DPI factor).
const MARGIN: f64 = 24.0;

#[derive(Debug, Clone, Copy, Serialize)]
pub struct WindowPos {
    pub x: i32,
    pub y: i32,
}

pub fn pet_window<R: Runtime>(app: &AppHandle<R>) -> Result<WebviewWindow<R>, String> {
    app.get_webview_window("pet")
        .ok_or_else(|| "pet window not found".to_string())
}

/// Bottom-right corner of the primary monitor's work area (respects the
/// Windows taskbar), with a small margin. `offset_x` shifts the spot to the
/// left (clamped to the work area) so companion windows don't stack exactly
/// on top of the main pet.
pub fn corner_position<R: Runtime>(
    window: &WebviewWindow<R>,
    offset_x: i32,
) -> Result<WindowPos, String> {
    let monitor = window
        .primary_monitor()
        .map_err(|e| e.to_string())?
        .or(window.current_monitor().map_err(|e| e.to_string())?)
        .ok_or_else(|| "no monitor available".to_string())?;

    let work = monitor.work_area();
    let margin = (MARGIN * monitor.scale_factor()).round() as i32;
    let size = window.outer_size().map_err(|e| e.to_string())?;

    let x = (work.position.x + work.size.width as i32 - size.width as i32 - margin - offset_x)
        .max(work.position.x + margin);
    Ok(WindowPos {
        x,
        y: work.position.y + work.size.height as i32 - size.height as i32 - margin,
    })
}

/// True when enough of the window at (x, y) intersects some monitor's work
/// area for the user to still grab it.
pub fn is_position_reachable<R: Runtime>(window: &WebviewWindow<R>, x: i32, y: i32) -> bool {
    let size = match window.outer_size() {
        Ok(s) => s,
        Err(_) => return false,
    };
    let monitors = match window.available_monitors() {
        Ok(m) => m,
        Err(_) => return false,
    };
    // Require at least a 60x60 physical-pixel corner of the window on screen.
    const MIN_VISIBLE: i32 = 60;
    for monitor in monitors {
        let work = monitor.work_area();
        let (wx, wy) = (work.position.x, work.position.y);
        let (ww, wh) = (work.size.width as i32, work.size.height as i32);
        let overlap_x = (x + size.width as i32).min(wx + ww) - x.max(wx);
        let overlap_y = (y + size.height as i32).min(wy + wh) - y.max(wy);
        if overlap_x >= MIN_VISIBLE && overlap_y >= MIN_VISIBLE {
            return true;
        }
    }
    false
}

pub fn move_window<R: Runtime>(window: &WebviewWindow<R>, pos: WindowPos) -> Result<(), String> {
    window
        .set_position(PhysicalPosition::new(pos.x, pos.y))
        .map_err(|e| e.to_string())
}

/// Move the pet window back to the default bottom-right corner.
pub fn reset_to_corner<R: Runtime>(app: &AppHandle<R>) -> Result<WindowPos, String> {
    let window = pet_window(app)?;
    let pos = corner_position(&window, 0)?;
    move_window(&window, pos)?;
    Ok(pos)
}
